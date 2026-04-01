"""Convert period CSVs to JSON files for the Next.js frontend.

Run after fetch/abgeordnetenwatch.py and model/train.py.
Writes to frontend/public/data/.
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
    compute_occupation_pivot,
    compute_sex_counts,
    compute_title_counts,
)
from .cli import add_period_argument, build_parser, configure_logging
from .fetch.abgeordnetenwatch import fetch_periods_df
from .storage import DATA_DIR, OUTPUTS_DIR

log = logging.getLogger(__name__)

OUTPUT_DIR = Path("frontend/public/data")

# Mirrors pages/constants.py — soft-hyphen (\xad) in GRÜNEN is intentional.
PARTY_ORDER = [
    "CDU/CSU",
    "SPD",
    "AfD",
    "BÜNDNIS 90/\xadDIE GRÜNEN",
    "Die Linke",
    "BSW",
    "FDP",
    "fraktionslos",
]

SIDEJOB_CATEGORIES: dict[int, str] = {
    29647: "Entgeltliche Tätigkeit",
    29228: "Unternehmensbeteiligung / Organmitglied",
    29229: "Funktionen in öffentlichen Institutionen",
    29230: "Verband / Stiftung / Verein",
    29231: "Unternehmensbeteiligung",
    29232: "Spende / Zuwendung",
    29233: "Vereinbarung über künftige Tätigkeit",
    29234: "Tätigkeit vor Mitgliedschaft",
}


def _active_months(
    date_start_str: str | None,
    date_end_str: str | None,
    period_start: date,
    period_end: date,
    created_ts: float | None = None,
) -> int:
    """Compute active months within period boundaries.

    Adapted from pages/sidejobs.py — adds a created_ts fallback for jobs with no
    date_start.

    created_ts is the disclosure timestamp, not the job start date. For retroactive
    disclosures (created after period_end), it tells us nothing about when the job
    started, so we fall back to period_start (assume active for the full period).
    """
    today = datetime.now(tz=UTC).date()
    if date_start_str:
        job_start = date.fromisoformat(date_start_str)
    elif created_ts:
        created_date = datetime.fromtimestamp(created_ts, tz=UTC).date()
        job_start = created_date if created_date <= period_end else period_start
    else:
        job_start = period_start
    job_end = date.fromisoformat(date_end_str) if date_end_str else today
    start = max(job_start, period_start)
    end = min(job_end, period_end, today)
    if start > end:
        return 0
    return (end.year - start.year) * 12 + (end.month - start.month) + 1


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
) -> None:
    """Build and write sidejobs JSON for one period.

    Skipped silently if sidejobs.csv is absent.
    """
    sj_path = period_dir / "sidejobs.csv"
    if not sj_path.exists():
        return

    sj_df = (
        pd.read_csv(sj_path)
        .merge(
            pols_df.filter(["politician_id", "party_label"]),
            on="politician_id",
            how="left",
        )
        .assign(
            category_label=lambda df: (
                df["category"].map(SIDEJOB_CATEGORIES).fillna("Sonstiges")
            )
        )
    )
    n_total = len(sj_df)
    n_with = int(sj_df["income"].notna().sum())

    sj_income = sj_df[sj_df["income"].notna()].assign(
        income=lambda df: pd.to_numeric(df["income"], errors="coerce")
    )

    def _effective_income(row: pd.Series) -> float:
        """Prorate income to period duration. Mirrors sidejobs.py.

        interval is read from CSV as float64 (pandas coerces int columns with
        NaN values to float), so compare as int, not as string.
        """
        raw_interval = row.get("interval")
        try:
            interval = int(raw_interval)
        except (TypeError, ValueError):
            interval = None
        ds = row.get("date_start") if pd.notna(row.get("date_start")) else None
        de = row.get("date_end") if pd.notna(row.get("date_end")) else None
        created = row.get("created") if pd.notna(row.get("created")) else None
        if interval in (1, 2):
            months = _active_months(ds, de, period_start, period_end, created)
            return row["income"] * (months if interval == 1 else months / 12)
        return row["income"]

    sj_income = sj_income.assign(
        prorated_income=lambda df: df.apply(_effective_income, axis=1)
    )
    topics_col = "topics" if "topics" in sj_income.columns else None

    jobs = []
    for _, row in sj_income.iterrows():
        jobs.append(
            {
                "politician_id": int(row["politician_id"]),
                "party": str(row.get("party_label", "")),
                "category_label": str(row.get("category_label", "Sonstiges")),
                "income_level": int(row["income_level"])
                if pd.notna(row.get("income_level"))
                else None,
                "prorated_income": round(float(row["prorated_income"]), 2),
                "topics": _split_topics(row.get(topics_col)) if topics_col else [],
                "has_amount": True,
            }
        )

    _write(
        OUTPUT_DIR / f"sidejobs_{period}.json",
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
        OUTPUT_DIR / f"party_profile_{period}.json",
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


def export_period(period: int, period_start: date, period_end: date) -> bool:
    """Export all JSON files for one parliament period.

    Returns False if embeddings are missing (period skipped).
    """
    period_dir = DATA_DIR / str(period)
    emb_path = OUTPUTS_DIR / f"politician_embeddings_{period}.csv"

    if not (period_dir / "politicians.csv").exists():
        log.warning("No politicians.csv for period %d, skipping", period)
        return False
    if not emb_path.exists():
        log.warning("No embeddings for period %d, skipping", period)
        return False

    pols_df = pd.read_csv(period_dir / "politicians.csv").assign(
        party_label=lambda df: df["party"].str.replace("\xad", "", regex=False)
    )

    # ── politicians ───────────────────────────────────────────────────────────
    _write(
        OUTPUT_DIR / f"politicians_{period}.json",
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
        OUTPUT_DIR / f"embeddings_{period}.json",
        {
            "dimensions": 2,
            "data": emb_df.filter(["politician_id", "x", "y"]).to_dict("records"),
        },
    )

    # ── votes ─────────────────────────────────────────────────────────────────
    votes_df = pd.read_csv(period_dir / "votes.csv")
    _write(
        OUTPUT_DIR / f"votes_{period}.json",
        votes_df.filter(["politician_id", "poll_id", "answer"]).to_dict("records"),
    )

    # ── polls ─────────────────────────────────────────────────────────────────
    polls_df = pd.read_csv(period_dir / "polls.csv")
    _write(
        OUTPUT_DIR / f"polls_{period}.json",
        polls_df.filter(["poll_id", "topic"]).to_dict("records"),
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
    _write(OUTPUT_DIR / f"cohesion_{period}.json", coh_df.to_dict("records"))

    # ── sidejobs ──────────────────────────────────────────────────────────────
    _export_sidejobs(period, period_dir, pols_df, period_start, period_end)

    # ── party profile ─────────────────────────────────────────────────────────
    _export_party_profile(period, pols_df, period_start)

    log.info("Exported period %d", period)
    return True


def export_party_word_freq(period: int) -> None:
    """Export party_word_freq.csv to JSON for the frontend.

    Output: frontend/public/data/party_word_freq_{period}.json
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
    _write(OUTPUT_DIR / f"party_word_freq_{period}.json", result)


def export_party_speech_stats(period: int) -> None:
    """Export party_speech_stats.csv to JSON for the frontend.

    Output: frontend/public/data/party_speech_stats_{period}.json
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
        OUTPUT_DIR / f"party_speech_stats_{period}.json",
        df.to_dict(orient="records"),
    )


def _period_is_exportable(period: int) -> bool:
    """Return whether a period has the required export inputs."""
    period_dir = DATA_DIR / str(period)
    emb_path = OUTPUTS_DIR / f"politician_embeddings_{period}.csv"
    return (period_dir / "politicians.csv").exists() and emb_path.exists()


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
        p_end = date.fromisoformat(str(row["end_date"]))

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

    _write(OUTPUT_DIR / "periods.json", available)
    log.info("Done. Exported %d periods.", len(available))


if __name__ == "__main__":
    main()
