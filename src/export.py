"""Convert period CSVs to JSON files for the Next.js frontend.

Writes to frontend/public/data/. Run via src.pipeline or standalone.
"""

import argparse
import json
import logging
import math
from datetime import UTC, date, datetime
from pathlib import Path

import numpy as np
import pandas as pd

from .analysis.transforms import (
    compute_age_df,
    compute_cohesion,
    compute_education_degree_pivot,
    compute_education_field_pivot,
    compute_effective_income,
    compute_occupation_pivot,
    compute_sex_counts,
    compute_title_counts,
)
from .cli import add_period_argument, build_parser, configure_logging
from .constants import PARTY_ORDER, SIDEJOB_CATEGORIES
from .fetch.abgeordnetenwatch import fetch_periods_df
from .paths import DATA_DIR, OUTPUTS_DIR

log = logging.getLogger(__name__)

OUTPUT_DIR = Path(__file__).parents[1] / "frontend" / "public" / "data"


def _period_output_dir(period: int) -> Path:
    """Return the output subdirectory for a period, creating it if needed."""
    d = OUTPUT_DIR / str(period)
    d.mkdir(exist_ok=True)
    return d


def _sanitize(obj: object) -> object:
    """Recursively replace float NaN/inf with None so json.dumps produces valid JSON."""
    if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return None
    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize(v) for v in obj]
    return obj


def _write(path: Path, data: object) -> None:
    """Write data as JSON; create parent dirs if needed."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(_sanitize(data), ensure_ascii=False, default=str), encoding="utf-8"
    )
    log.info("Wrote %s (%.1f KB)", path, path.stat().st_size / 1024)


def _clean_matrix(arr: np.ndarray, precision: int) -> list:
    """Convert a 2D numpy array to a nested list, replacing NaN with None."""
    return [
        [None if np.isnan(v) else round(float(v), precision) for v in row]
        for row in arr.tolist()
    ]


def _split_topics(t: object) -> list[str]:
    """Split pipe-separated topic string into a list."""
    if not isinstance(t, str):
        return []
    return [x.strip() for x in t.split("|") if x.strip()]


def _pivot_to_json(
    pivot_pct: pd.DataFrame, dev_z: np.ndarray, pivot_count: pd.DataFrame
) -> dict:
    """Serialize a deviation pivot for the frontend DeviationHeatmap component."""
    pct_clean = _clean_matrix(pivot_pct.to_numpy().astype(float), 1)
    dev_clean = _clean_matrix(dev_z, 2)
    count_clean = [
        [int(v) for v in row] for row in pivot_count.to_numpy().astype(int).tolist()
    ]
    party_totals = [int(v) for v in pivot_count.sum(axis=0).tolist()]
    return {
        "categories": list(pivot_pct.index),
        "parties": list(pivot_pct.columns),
        "pct": pct_clean,
        "dev": dev_clean,
        "count": count_clean,
        "party_totals": party_totals,
    }


def _export_sidejobs(
    period: int,
    period_dir: Path,
    pols_df: pd.DataFrame,
    period_start: date,
    period_end: date,
    df_sidejobs: pd.DataFrame | None = None,
) -> None:
    """Build and write sidejobs JSON for one period.

    Uses df_sidejobs if provided, otherwise reads sidejobs.csv from disk.
    Skipped silently if neither is available.
    """
    if df_sidejobs is None:
        sj_path = period_dir / "sidejobs.csv"
        if not sj_path.exists():
            return
        df_sidejobs = pd.read_csv(sj_path)

    sj_df = df_sidejobs.merge(
        pols_df.filter(["politician_id", "party_label"]),
        on="politician_id",
        how="left",
    ).assign(
        category_label=lambda df: (
            df["category"].map(SIDEJOB_CATEGORIES).fillna("Sonstiges")
        )
    )
    n_total = len(sj_df)
    n_with = int(sj_df["income"].notna().sum())

    sj_income = sj_df[sj_df["income"].notna()].assign(
        income=lambda df: pd.to_numeric(df["income"], errors="coerce")
    )
    n_nan = int(sj_income["income"].isna().sum())
    if n_nan:
        log.warning(
            "Period %d: %d sidejob income value(s) could not be parsed as numeric"
            " and will be skipped.",
            period,
            n_nan,
        )
    sj_income = sj_income[sj_income["income"].notna()]

    sj_income = sj_income.assign(
        prorated_income=lambda df: df.apply(
            lambda row: compute_effective_income(row, period_start, period_end), axis=1
        )
    )
    has_topics = "topics" in sj_income.columns

    jobs = [
        {
            "politician_id": int(row["politician_id"]),
            "party": str(row.get("party_label") or ""),
            "category_label": str(row.get("category_label") or "Sonstiges"),
            "income_level": int(row["income_level"])
            if pd.notna(row.get("income_level"))
            else None,
            "prorated_income": round(float(row["prorated_income"]), 2),
            "topics": _split_topics(row.get("topics")) if has_topics else [],
            "has_amount": True,
        }
        for row in sj_income.to_dict("records")
    ]

    _write(
        _period_output_dir(period) / "sidejobs.json",
        {"jobs": jobs, "coverage": {"total": n_total, "with_amount": n_with}},
    )


def _export_party_profile(
    period: int, pols_df: pd.DataFrame, period_start: date
) -> None:
    """Build and write party_profile JSON for one period.

    Age is calculated as of the start of the period, not the current year.
    """
    present = set(pols_df["party_label"].dropna().unique())
    party_labels_ordered = [
        p.replace("\xad", "") for p in PARTY_ORDER if p.replace("\xad", "") in present
    ] + sorted(present - {p.replace("\xad", "") for p in PARTY_ORDER})

    age_df = compute_age_df(pols_df, period_start.year)
    sex_df = compute_sex_counts(pols_df)
    title_df = compute_title_counts(pols_df)
    occ_pct, _, occ_dev_z, occ_count = compute_occupation_pivot(
        pols_df, party_labels_ordered
    )
    edu_field_pct, _, edu_field_dev_z, edu_field_count = compute_education_field_pivot(
        pols_df, party_labels_ordered
    )
    edu_deg_pct, _, edu_deg_dev_z, edu_deg_count = compute_education_degree_pivot(
        pols_df, party_labels_ordered
    )

    _write(
        _period_output_dir(period) / "party_profile.json",
        {
            "parties": party_labels_ordered,
            "age": age_df.filter(["name", "party_label", "alter"])
            .rename(columns={"party_label": "party", "alter": "age"})
            .to_dict("records"),
            "sex": sex_df.to_dict("records"),
            "titles": title_df.to_dict("records"),
            "occupation": _pivot_to_json(occ_pct, occ_dev_z, occ_count),
            "education_field": _pivot_to_json(
                edu_field_pct, edu_field_dev_z, edu_field_count
            ),
            "education_degree": _pivot_to_json(
                edu_deg_pct, edu_deg_dev_z, edu_deg_count
            ),
        },
    )


def export_period(
    period: int,
    period_start: date,
    period_end: date,
    *,
    df_politicians: pd.DataFrame | None = None,
    df_polls: pd.DataFrame | None = None,
    df_sidejobs: pd.DataFrame | None = None,
) -> bool:
    """Export all JSON files for one parliament period.

    Uses df_politicians/df_polls/df_sidejobs if provided, otherwise reads from disk.
    Returns False if required data is missing (period skipped).
    """
    period_dir = DATA_DIR / str(period)
    emb_path = OUTPUTS_DIR / f"politician_embeddings_{period}.csv"

    if df_politicians is None:
        if not (period_dir / "politicians.csv").exists():
            log.warning("No politicians.csv for period %d, skipping", period)
            return False
        df_politicians = pd.read_csv(period_dir / "politicians.csv")

    if not emb_path.exists():
        log.warning("No embeddings for period %d, skipping", period)
        return False

    pols_df = df_politicians.assign(
        party_label=lambda df: df["party"].str.replace("\xad", "", regex=False)
    )

    # ── politicians ───────────────────────────────────────────────────────────
    _write(
        _period_output_dir(period) / "politicians.json",
        pols_df.filter(
            [
                "politician_id",
                "name",
                "party",
                "sex",
                "year_of_birth",
                "occupation",
                "education",
                "field_title",
            ]
        ).to_dict("records"),
    )

    # ── embeddings ────────────────────────────────────────────────────────────
    emb_df = pd.read_csv(emb_path)
    if "z" in emb_df.columns:
        log.warning("3D embeddings detected for period %d; exporting 2D only", period)
    if "politician_id" not in emb_df.columns:
        emb_df = emb_df.merge(
            pols_df.filter(["name", "politician_id"]), on="name", how="left"
        )
    _write(
        _period_output_dir(period) / "embeddings.json",
        {
            "dimensions": 2,
            "data": emb_df.filter(["politician_id", "x", "y"]).to_dict("records"),
        },
    )

    # ── votes ─────────────────────────────────────────────────────────────────
    votes_path = period_dir / "votes.csv"
    if not votes_path.exists():
        log.warning("No votes.csv for period %d, skipping", period)
        return False
    votes_df = pd.read_csv(votes_path)
    _write(
        _period_output_dir(period) / "votes.json",
        votes_df.filter(["politician_id", "poll_id", "answer"]).to_dict("records"),
    )

    # ── polls ─────────────────────────────────────────────────────────────────
    if df_polls is None:
        polls_path = period_dir / "polls.csv"
        if not polls_path.exists():
            log.warning("No polls.csv for period %d, skipping", period)
            return False
        df_polls = pd.read_csv(polls_path)
    _write(
        _period_output_dir(period) / "polls.json",
        df_polls.filter(["poll_id", "topic"]).to_dict("records"),
    )

    # ── cohesion ──────────────────────────────────────────────────────────────
    # emb_df may already have a party column from save_embeddings; drop it to
    # avoid collision, then join the canonical party from pols_df.
    coh_df = compute_cohesion(
        emb_df.filter(["politician_id", "x", "y"]).merge(
            pols_df.filter(["politician_id", "party"]), on="politician_id", how="left"
        ),
        exclude_party="fraktionslos",
    )
    _write(_period_output_dir(period) / "cohesion.json", coh_df.to_dict("records"))

    # ── sidejobs ──────────────────────────────────────────────────────────────
    _export_sidejobs(period, period_dir, pols_df, period_start, period_end, df_sidejobs)

    # ── party profile ─────────────────────────────────────────────────────────
    _export_party_profile(period, pols_df, period_start)

    log.info("Exported period %d", period)
    return True


def export_party_word_freq(period: int) -> None:
    """Export party_word_freq.csv to JSON for the frontend.

    Output: frontend/public/data/{period}/party_word_freq.json
    Format: {fraktion: [{wort, tfidf, rang}, ...], ...}
    """
    path = DATA_DIR / str(period) / "party_word_freq.csv"
    if not path.exists():
        log.warning(
            "party_word_freq.csv not found for period %d, skipping.",
            period,
        )
        return
    df = pd.read_csv(path)
    result = {}
    for fraktion, group in df.groupby("fraktion"):
        result[fraktion] = group[["wort", "tfidf", "rang"]].to_dict(orient="records")
    _write(_period_output_dir(period) / "party_word_freq.json", result)


def export_party_speech_stats(period: int) -> None:
    """Export party_speech_stats.csv to JSON for the frontend.

    Output: frontend/public/data/{period}/party_speech_stats.json
    Format: [{fraktion, redner_id, vorname, nachname, anzahl_reden,
    wortanzahl_gesamt}, ...]
    """
    path = DATA_DIR / str(period) / "party_speech_stats.csv"
    if not path.exists():
        log.warning(
            "party_speech_stats.csv not found for period %d, skipping.",
            period,
        )
        return
    df = pd.read_csv(path)
    _write(
        _period_output_dir(period) / "party_speech_stats.json",
        df.to_dict(orient="records"),
    )


def export_keyword_timeline(period: int) -> None:
    """Export keyword_timeline.json for the frontend.

    Output: frontend/public/data/{period}/keyword_timeline.json
    Skipped silently if no protocol XMLs exist for the period.
    """
    from .analysis.keyword_timeline import fetch_keyword_timeline

    xml_dir = DATA_DIR / str(period) / "plenary_protocols"
    if not xml_dir.exists() or not any(xml_dir.glob("*.xml")):
        log.warning(
            "No protocol XMLs for period %d, skipping keyword timeline.", period
        )
        return

    data = fetch_keyword_timeline(DATA_DIR / str(period))
    _write(_period_output_dir(period) / "keyword_timeline.json", data)


def export_motions(period: int) -> None:
    """Fetch all Drucksachen for a period and write motions_stats.json
    and motions_titles.json.

    Fetches each Drucksache type once (3 API calls total) and writes both output files
    in one pass to avoid redundant network requests.
    Skipped silently if DIP_API_KEY is not set.
    """
    import os

    if not os.environ.get("DIP_API_KEY"):
        log.warning(
            "DIP_API_KEY not set — skipping motions export for period %d.", period
        )
        return

    from .analysis.drucksachen import (
        _CANONICAL_PARTY_ORDER,
        compute_counts_by_party,
        compute_timeline,
        compute_top_authors,
        compute_word_freq,
        extract_party,
    )
    from .fetch.drucksachen import DRUCKSACHE_TYPEN, fetch_drucksachen

    stats: dict = {}
    all_titles: list[dict] = []

    for typ in DRUCKSACHE_TYPEN:
        docs = fetch_drucksachen(period, typ)
        if not docs:
            stats[typ] = {
                "counts_by_party": [],
                "timeline": {"months": [], "series": []},
                "word_freq": {},
                "top_authors": {},
            }
            continue

        counts = compute_counts_by_party(docs)
        active = {c["party"] for c in counts}
        ordered_parties = [p for p in _CANONICAL_PARTY_ORDER if p in active]

        stats[typ] = {
            "counts_by_party": counts,
            "timeline": compute_timeline(docs, ordered_parties),
            "word_freq": compute_word_freq(docs),
            "top_authors": compute_top_authors(docs),
        }

        for doc in docs:
            party = extract_party(doc)
            titel = doc.get("titel", "")
            if party and titel:
                all_titles.append(
                    {
                        "typ": typ,
                        "party": party,
                        "datum": doc.get("datum", ""),
                        "titel": titel,
                    }
                )

    out = _period_output_dir(period)
    _write(out / "motions_stats.json", stats)
    _write(out / "motions_titles.json", all_titles)


def export_periods(available: list[dict]) -> None:
    """Write the periods.json index file consumed by the frontend."""
    _write(OUTPUT_DIR / "periods.json", available)


def _period_is_exportable(period: int) -> bool:
    """Return whether a period has been exported (votes.json exists in output dir)."""
    return (OUTPUT_DIR / str(period) / "votes.json").exists()


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = build_parser("Exportiere JSON-Dateien für das Frontend.")
    add_period_argument(parser)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    """Export JSON files for one or all periods."""
    configure_logging()
    args = parse_args(argv)

    periods_df = fetch_periods_df()
    if args.period is not None and args.period not in set(
        periods_df["bundestag_number"].astype(int)
    ):
        msg = f"Period {args.period} not found."
        raise SystemExit(msg)

    available: list[dict] = []

    for _, row in periods_df.iterrows():
        period = int(row["bundestag_number"])
        p_start = date.fromisoformat(str(row["start_date"]))
        raw_end = row["end_date"]
        now = datetime.now(tz=UTC).date()
        p_end = date.fromisoformat(str(raw_end)) if pd.notna(raw_end) else now

        if _period_is_exportable(period):
            available.append(
                {
                    "wahlperiode": period,
                    "label": str(row.get("label", f"Wahlperiode {period}")),
                    "has_data": True,
                }
            )

        if args.period is not None and period != args.period:
            continue

        export_period(period, p_start, p_end)
        export_party_word_freq(period)
        export_party_speech_stats(period)
        export_keyword_timeline(period)
        export_motions(period)

    export_periods(available)
    log.info("Done. Exported %d periods.", len(available))


if __name__ == "__main__":
    main()
