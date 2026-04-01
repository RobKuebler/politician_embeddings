"""Parse plenary protocol XMLs and print speech counts (for debugging).

Reads all *.xml from data/{period}/plenary_protocols/.

Usage:
    uv run python -m src.parse.protocols --period 20
"""

import argparse
import logging
import re
from pathlib import Path
from xml.etree import ElementTree as ET

import pandas as pd

from ..cli import add_period_argument, build_parser, configure_logging
from ..fetch.abgeordnetenwatch import refresh_periods
from ..paths import DATA_DIR

log = logging.getLogger(__name__)

# p-Klassen die Redetext enthalten (aus realem XML inspiziert)
_SPEECH_KLASSEN = {"J_1", "J", "O"}

# Soft hyphen used throughout the project for BÜNDNIS 90/DIE GRÜNEN
_SOFT_HYPHEN = "\xad"

# Maps XML fraktion text (after whitespace normalization) to canonical party names.
# Covers inconsistent formatting in Bundestag XML exports across WP20 and WP21.
_FRAKTION_MAP: dict[str, str] = {
    "BÜNDNIS 90/DIE GRÜNEN": f"BÜNDNIS 90/{_SOFT_HYPHEN}DIE GRÜNEN",
    "DIE LINKE": "Die Linke",
    "Fraktionslos": "fraktionslos",
    # Concatenated party names — known XML data errors in source files
    # SPDSPD = Svenja Schulze (SPD), name+party duplicated in XML
    "SPDSPD": "SPD",
    # SPDCDU/CSU = two MdBs merged in XML (Mende SPD + Führ CDU/CSU)
    "SPDCDU/CSU": "Unbekannt",
}


def _normalize_fraktion(raw: str | None) -> str:
    """Normalize XML fraktion text to canonical party name.

    Collapses whitespace (including newlines and non-breaking spaces) that
    appears in multi-line <fraktion> tags, then maps known variants.
    """
    if not raw:
        return "fraktionslos"
    normalized = re.sub(r"[\s\u00a0]+", " ", raw).strip()
    if normalized in _FRAKTION_MAP:
        return _FRAKTION_MAP[normalized]
    # Only warn when the raw string contained non-standard whitespace that was
    # normalized away. A clean string not in the map is likely a valid party name
    # that the map simply doesn't cover; a mangled string is a data quality issue.
    if re.search(r"[\n\u00a0]", raw):
        log.warning(
            "Unknown faction after normalization: %r (raw: %r)", normalized, raw
        )
    return normalized


_COLS = [
    "sitzungsnummer",
    "rede_id",
    "redner_id",
    "vorname",
    "nachname",
    "fraktion",
    "wortanzahl",
    "text",
]


def parse_sitzung(xml_path: Path) -> list[dict]:
    """Parse one plenary protocol XML and return a list of speech dicts.

    Each dict corresponds to one <rede> element. Only paragraphs with
    klasse in _SPEECH_KLASSEN are included in the text (kommentar etc. excluded).
    """
    root = ET.parse(xml_path).getroot()  # noqa: S314 — trusted local files
    sitzung_nr_raw = root.get("sitzung-nr")
    if sitzung_nr_raw is None:
        log.warning("No sitzung-nr in %s, using 0", xml_path.name)
    sitzungsnr = int(sitzung_nr_raw or 0)
    rows = []

    for rede in root.findall(".//rede"):
        rede_id = rede.get("id", "")
        redner_el = rede.find(".//redner")
        if redner_el is None:
            continue
        name_el = redner_el.find("name")
        vorname = (
            (name_el.findtext("vorname") or "").strip() if name_el is not None else ""
        )
        nachname = (
            (name_el.findtext("nachname") or "").strip() if name_el is not None else ""
        )
        fraktion = _normalize_fraktion(
            name_el.findtext("fraktion") if name_el is not None else None
        )
        redner_id = redner_el.get("id", "")

        text_parts = [
            "".join(p.itertext()).strip()
            for p in rede.findall("p")
            if p.get("klasse", "") in _SPEECH_KLASSEN
        ]
        full_text = " ".join(filter(None, text_parts))
        wortanzahl = len(full_text.split()) if full_text else 0

        if wortanzahl == 0:
            continue

        rows.append(
            {
                "sitzungsnummer": sitzungsnr,
                "rede_id": rede_id,
                "redner_id": redner_id,
                "vorname": vorname,
                "nachname": nachname,
                "fraktion": fraktion,
                "wortanzahl": wortanzahl,
                "text": full_text,
            }
        )

    return rows


def parse_alle_sitzungen(out_dir: Path) -> pd.DataFrame:
    """Parse all XMLs in out_dir/plenary_protocols/ and return a DataFrame.

    Returns one row per speech. Does not write any files.
    """
    xml_dir = Path(out_dir) / "plenary_protocols"
    xml_files = sorted(xml_dir.glob("*.xml"))
    if not xml_files:
        log.warning("No XML files found in %s.", xml_dir)
        return pd.DataFrame(columns=_COLS)

    all_rows: list[dict] = []
    for xml_path in xml_files:
        rows = parse_sitzung(xml_path)
        all_rows.extend(rows)
        log.info("%s: extracted %d speeches", xml_path.name, len(rows))

    df = pd.DataFrame(all_rows, columns=_COLS)
    log.info("parsed %d speeches from %d sessions", len(df), len(xml_files))
    return df


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = build_parser("Parse XML-Protokolle und extrahiere Reden.")
    add_period_argument(parser)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    configure_logging()
    args = parse_args(argv)

    period = args.period or refresh_periods()
    out_dir = DATA_DIR / str(period)

    log.info("Period %d...", period)
    df = parse_alle_sitzungen(out_dir)
    log.info("Done. %d speeches.", len(df))


if __name__ == "__main__":
    main()
