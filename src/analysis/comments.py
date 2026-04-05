"""Analysiert Kommentare in Plenarprotokollen: Beifall, Zurufe, Lachen etc.

Parsed alle XMLs aller Wahlperioden und gibt pro Partei aus, wer wie oft
applaudiert, ruft, lacht, usw. Zusätzlich: Cross-Partei-Matrix (wer klatscht
bei wem, wer ruft bei wessen Rede).

Usage:
    uv run python -m src.analysis.comments
    uv run python -m src.analysis.comments --period 20
    uv run python -m src.analysis.comments --top 10
"""

import argparse
import logging
import re
from pathlib import Path
from xml.etree import ElementTree as ET

import pandas as pd

from ..cli import configure_logging
from ..paths import DATA_DIR, FRONTEND_DATA_DIR

log = logging.getLogger(__name__)

# ─── Party extraction ────────────────────────────────────────────────────────

# Ordered from most specific to least specific.
# Genitive and mixed-case forms are included (e.g. BÜNDNISSES, Linken, fraktionslosen).
_PARTY_PATTERNS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"CDU/CSU"), "CDU/CSU"),
    (re.compile(r"B[UÜ]NDNIS(?:SES)?\s*90/DIE\s*GR[UÜ]NEN", re.IGNORECASE), "Grünen"),
    (re.compile(r"\bGR[UÜ]NEN\b", re.IGNORECASE), "Grünen"),
    (re.compile(r"\bDIE\s+LINKE\b", re.IGNORECASE), "Die Linke"),
    # Matches LINKEN, Linken, linken (genitive/dative, various capitalizations)
    (re.compile(r"\bLinken?\b", re.IGNORECASE), "Die Linke"),
    (re.compile(r"\bAfD\b"), "AfD"),
    (re.compile(r"\bSPD\b"), "SPD"),
    (re.compile(r"\bFDP\b"), "FDP"),
    (re.compile(r"\bBSW\b"), "BSW"),
    (re.compile(r"\bCDU\b"), "CDU/CSU"),
    (re.compile(r"\bCSU\b"), "CDU/CSU"),
    # Matches fraktionslos, fraktionslosen, fraktionsloser, etc.
    (re.compile(r"\bfraktionslos\w*\b", re.IGNORECASE), "fraktionslos"),
    # "im ganzen Hause" = applause from all parties
    (re.compile(r"\bganzen\s+Hause?\b", re.IGNORECASE), "Alle"),
]


def _extract_parties(text: str) -> list[str]:
    """Extract all distinct canonical party names from a text fragment."""
    found: list[str] = []
    seen: set[str] = set()
    for pattern, canonical in _PARTY_PATTERNS:
        if pattern.search(text) and canonical not in seen:
            found.append(canonical)
            seen.add(canonical)
    return found


# ─── Kommentar parsing ───────────────────────────────────────────────────────

# Named interjection: "Vorname [Nachname] [PARTY]: text"  (party in square brackets)
_NAMED_INTERJECTION = re.compile(r"^([^\[]+)\[([^\]]+)\]\s*:")

# Segment separator in kommentar texts (en-dash and em-dash are intentional)
_SEG_SEP = re.compile(r"\s*[–—]\s*")  # noqa: RUF001

# Maps keyword → event type
_EVENT_KEYWORDS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"\bBeifall\b"), "Beifall"),
    (re.compile(r"\bLachen\b"), "Lachen"),
    (re.compile(r"\bHeiterkeit\b"), "Heiterkeit"),
    (re.compile(r"\bWiderspruch\b"), "Widerspruch"),
    (re.compile(r"\bZurufe?\b"), "Zuruf"),
]


def _parse_kommentar(raw: str) -> list[tuple[str, str]]:
    """Parse a <kommentar> text into (event_type, acting_party) pairs.

    Returns one tuple per (type, party) combination. If a party cannot be
    identified, 'Unbekannt' is used. Segments with no known keywords and no
    named person pattern are skipped (e.g. procedural notes like 'Unterbrechung').
    """
    text = raw.strip().lstrip("(").rstrip(")")
    segments = _SEG_SEP.split(text)

    events: list[tuple[str, str]] = []

    for raw_seg in segments:
        seg = raw_seg.strip()
        if not seg:
            continue

        # ── Named interjection: "Name [PARTY]: ..." ──────────────────────────
        m = _NAMED_INTERJECTION.match(seg)
        if m:
            party_text = m.group(2)
            parties = _extract_parties(party_text) or ["Unbekannt"]
            events.extend(("Zwischenruf", p) for p in parties)
            continue

        # ── Anonymous Zuruf without name: "Zuruf: ..." ───────────────────────
        if re.match(r"^Zuruf\s*:", seg):
            events.append(("Zuruf", "Unbekannt"))
            continue

        # ── Keyword-based events ─────────────────────────────────────────────
        # Collect all event types found in this segment.
        types_in_seg: list[str] = [
            etype for pat, etype in _EVENT_KEYWORDS if pat.search(seg)
        ]
        if not types_in_seg:
            continue  # procedural note (Unterbrechung, Anwesende erheben sich, …)

        parties = _extract_parties(seg)

        if not parties:
            # e.g. "(Beifall)" with no party info
            events.extend((etype, "Unbekannt") for etype in types_in_seg)
        else:
            events.extend((etype, p) for etype in types_in_seg for p in parties)

    return events


# ─── XML parsing ─────────────────────────────────────────────────────────────


def _parse_xml(xml_path: Path, wahlperiode: int) -> list[dict]:
    """Extract all (event_type, acting_party, speaker_party) rows from one XML."""
    root = ET.parse(xml_path).getroot()  # noqa: S314 — trusted local files
    rows: list[dict] = []

    for rede in root.findall(".//rede"):
        # Determine speaker's party from the first <redner> inside this <rede>
        redner_el = rede.find(".//redner")
        speaker_party: str | None = None
        if redner_el is not None:
            name_el = redner_el.find("name")
            if name_el is not None:
                raw_fraktion = name_el.findtext("fraktion") or ""
                parties = _extract_parties(raw_fraktion)
                speaker_party = parties[0] if parties else None

        for kommentar_el in rede.findall(".//kommentar"):
            raw = "".join(kommentar_el.itertext()).strip()
            if not raw:
                continue
            for event_type, acting_party in _parse_kommentar(raw):
                rows.append(
                    {
                        "wahlperiode": wahlperiode,
                        "event_type": event_type,
                        "acting_party": acting_party,
                        "speaker_party": speaker_party,
                    }
                )

    return rows


def load_all_events(periods: list[int] | None = None) -> pd.DataFrame:
    """Parse all XMLs for the given wahlperioden and return a flat DataFrame."""
    if periods is None:
        periods = sorted(
            int(p.name) for p in DATA_DIR.iterdir() if p.is_dir() and p.name.isdigit()
        )

    all_rows: list[dict] = []
    for wp in periods:
        xml_dir = DATA_DIR / str(wp) / "plenary_protocols"
        for xml_path in sorted(xml_dir.glob("*.xml")):
            all_rows.extend(_parse_xml(xml_path, wp))

    return pd.DataFrame(all_rows)


# ─── Reporting & Export ──────────────────────────────────────────────────────

_EVENT_ORDER = ["Beifall", "Zwischenruf", "Lachen", "Heiterkeit", "Widerspruch"]

# Normalizes Python party names to match frontend constants.ts PARTY_COLORS keys.
_FRONTEND_PARTY_NAME: dict[str, str] = {"Grünen": "Grüne"}

# Party display order matching frontend PARTY_ORDER (fraktionslos last).
_FRONTEND_PARTY_ORDER = [
    "CDU/CSU",
    "SPD",
    "AfD",
    "Grüne",
    "Die Linke",
    "FDP",
    "BSW",
    "fraktionslos",
]

# Parties to exclude from the frontend JSON (not real Fraktionen).
_EXCLUDE_PARTIES = {"Unbekannt", "Alle", "fraktionslos"}


def _fe_name(party: str) -> str:
    """Map Python canonical party name to frontend canonical name."""
    return _FRONTEND_PARTY_NAME.get(party, party)


def export_kommentare_json(df: pd.DataFrame, out_dir: Path) -> None:
    """Export kommentare data as JSON consumable by the Next.js frontend.

    Writes kommentare.json into out_dir. The JSON contains:
    - parties: ordered list of party names matching frontend PARTY_COLORS
    - summary: one row per party with counts per event type
    - cross: per event type, a square matrix[acting_idx][speaker_idx]
    """
    import json

    # Normalize party names and drop excluded entries
    df = df.copy()
    df["acting_party"] = df["acting_party"].map(_fe_name)
    df["speaker_party"] = df["speaker_party"].map(
        lambda p: _fe_name(p) if p is not None else None
    )
    mask_exclude_acting = df["acting_party"].isin(_EXCLUDE_PARTIES)
    mask_exclude_speaker = df["speaker_party"].isin(_EXCLUDE_PARTIES)
    df = df[~mask_exclude_acting & ~mask_exclude_speaker]

    # Build ordered party list from speaker_party only — a party with no speakers
    # has no Bundestagssitze and should not appear in the charts.
    parties_with_speakers = set(
        df.loc[df["speaker_party"].notna(), "speaker_party"].unique()
    )
    parties = [p for p in _FRONTEND_PARTY_ORDER if p in parties_with_speakers]

    # Summary: counts per (acting_party, event_type)
    summary_counts = (
        df.groupby(["acting_party", "event_type"]).size().unstack(fill_value=0)  # noqa: PD010
    )
    summary_rows = []
    for party in parties:
        row: dict = {"party": party}
        for etype in _EVENT_ORDER:
            row[etype] = (
                int(summary_counts.loc[party, etype])
                if (party in summary_counts.index and etype in summary_counts.columns)
                else 0
            )
        summary_rows.append(row)

    # Cross matrices: for each event type, matrix[acting_idx][speaker_idx]
    cross: dict[str, list[list[int]]] = {}
    n = len(parties)
    party_idx = {p: i for i, p in enumerate(parties)}
    for etype in _EVENT_ORDER:
        mat = [[0] * n for _ in range(n)]
        sub = df[(df["event_type"] == etype) & df["speaker_party"].notna()]
        for _, row in sub.iterrows():
            ai = party_idx.get(row["acting_party"])
            si = party_idx.get(row["speaker_party"])
            if ai is not None and si is not None:
                mat[ai][si] += 1
        cross[etype] = mat

    payload = {"parties": parties, "summary": summary_rows, "cross": cross}
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "kommentare.json"
    out_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    log.info("  -> %s", out_path)


def _summary_table(df: pd.DataFrame, top: int | None = None) -> pd.DataFrame:
    """Pivot table: parties as rows, event types as columns."""
    counts = df.groupby(["acting_party", "event_type"]).size().reset_index(name="n")  # type: ignore[call-overload]
    pivot = counts.pivot_table(
        index="acting_party", columns="event_type", values="n", fill_value=0
    )
    # Keep only known event types, in order
    cols = [c for c in _EVENT_ORDER if c in pivot.columns]
    pivot = pivot.filter(cols)
    pivot["Gesamt"] = pivot.sum(axis=1)
    pivot = pivot.sort_values("Gesamt", ascending=False)
    if top:
        pivot = pivot.head(top)
    return pivot


def _cross_table(
    df: pd.DataFrame, event_type: str, top: int | None = None
) -> pd.DataFrame:
    """Cross-party matrix: acting_party x speaker_party for one event type.

    Rows = who does the action, columns = during whose speech.
    Only includes rows where speaker_party is known.
    """
    sub = df[(df["event_type"] == event_type) & df["speaker_party"].notna()]
    if sub.empty:
        return pd.DataFrame()

    ct = sub.groupby(["acting_party", "speaker_party"]).size().unstack(fill_value=0)  # noqa: PD010
    ct["Gesamt"] = ct.sum(axis=1)
    ct = ct.sort_values("Gesamt", ascending=False)
    if top:
        ct = ct.head(top)
    return ct


def _fmt(df: pd.DataFrame) -> str:
    return df.to_string()


# ─── CLI ─────────────────────────────────────────────────────────────────────


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Analysiert Kommentare (Beifall, Zurufe, Lachen…) in Plenarprotokollen."
        )
    )
    parser.add_argument(
        "--period",
        type=int,
        default=None,
        help="Nur diese Wahlperiode analysieren (default: alle).",
    )
    parser.add_argument(
        "--top",
        type=int,
        default=None,
        help="Nur die top N Parteien pro Tabelle zeigen.",
    )
    parser.add_argument(
        "--export",
        action="store_true",
        help="Exportiere JSON für das Next.js-Frontend.",
    )
    args = parser.parse_args(argv)
    configure_logging()

    periods = [args.period] if args.period else None
    log.info("Lade Daten …")
    df = load_all_events(periods)
    if args.export:
        export_periods = periods or sorted(
            int(p.name) for p in DATA_DIR.iterdir() if p.is_dir() and p.name.isdigit()
        )
        for wp in export_periods:
            period_df = (
                df[df["wahlperiode"] == wp] if "wahlperiode" in df.columns else df
            )
            export_kommentare_json(period_df, FRONTEND_DATA_DIR / str(wp))
        log.info("JSON für %s exportiert.", export_periods)
        return
    log.info("%d Events aus %d Wahlperiode(n).", len(df), df["wahlperiode"].nunique())

    # ── Gesamtübersicht ───────────────────────────────────────────────────────
    log.info("=" * 60)
    log.info("GESAMTÜBERSICHT — Ereignisse pro Partei")
    log.info("=" * 60)
    summary = _summary_table(df, top=args.top)
    log.info("\n%s", _fmt(summary))

    # ── Cross-Partei-Tabellen ─────────────────────────────────────────────────
    for etype in _EVENT_ORDER:
        ct = _cross_table(df, etype, top=args.top)
        if ct.empty:
            continue
        log.info("=" * 60)
        log.info("CROSS-PARTEI: %s", etype.upper())
        log.info("Zeile = handelnde Partei | Spalte = Redner-Partei")
        log.info("=" * 60)
        log.info("\n%s", _fmt(ct))


if __name__ == "__main__":
    main()
