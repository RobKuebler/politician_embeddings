"""Sidejob- and conflict-specific export helpers."""

from __future__ import annotations

from typing import TYPE_CHECKING

import pandas as pd

from .analysis.transforms import compute_effective_income
from .constants import SIDEJOB_CATEGORIES
from .export_utils import period_output_dir, split_topics, write_json

if TYPE_CHECKING:
    import logging
    from datetime import date
    from pathlib import Path


def prepare_income_sidejobs(
    period: int,
    period_start: date,
    period_end: date,
    df_sidejobs: pd.DataFrame,
    *,
    log: logging.Logger,
    positive_only: bool = False,
) -> pd.DataFrame:
    """Return sidejobs with numeric income and computed prorated income."""
    sj_income = df_sidejobs[df_sidejobs["income"].notna()].copy()
    sj_income["income"] = pd.to_numeric(sj_income["income"], errors="coerce")
    n_nan = int(sj_income["income"].isna().sum())
    if n_nan:
        log.warning(
            "Period %d: %d sidejob income value(s) could not be parsed as numeric"
            " and will be skipped.",
            period,
            n_nan,
        )
    sj_income = sj_income[sj_income["income"].notna()].copy()
    sj_income["prorated_income"] = sj_income.apply(
        lambda row: compute_effective_income(row, period_start, period_end), axis=1
    )
    if positive_only:
        sj_income = sj_income[sj_income["prorated_income"] > 0].copy()
    return sj_income


def export_sidejobs(
    output_dir: Path,
    period: int,
    pols_df: pd.DataFrame,
    period_start: date,
    period_end: date,
    df_sidejobs: pd.DataFrame,
    *,
    log: logging.Logger,
) -> None:
    """Build and write sidejobs JSON for one period."""
    sj_df = df_sidejobs.merge(
        pols_df.filter(["politician_id", "party_label"]),
        on="politician_id",
        how="left",
    ).assign(
        category_label=lambda df: (
            pd.to_numeric(df["category"], errors="coerce")
            .map(SIDEJOB_CATEGORIES)
            .fillna("Sonstiges")
        )
    )
    n_total = len(sj_df)
    n_with = int(sj_df["income"].notna().sum())

    sj_income = prepare_income_sidejobs(
        period,
        period_start,
        period_end,
        sj_df,
        log=log,
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
            "topics": split_topics(row.get("topics")) if has_topics else [],
            "has_amount": True,
        }
        for row in sj_income.to_dict("records")
    ]

    write_json(
        period_output_dir(output_dir, period) / "sidejobs.json",
        {"jobs": jobs, "coverage": {"total": n_total, "with_amount": n_with}},
        log=log,
    )


def export_conflicts(
    output_dir: Path,
    period: int,
    pols_df: pd.DataFrame,
    period_start: date,
    period_end: date,
    df_sidejobs: pd.DataFrame,
    df_committees: pd.DataFrame,
    df_memberships: pd.DataFrame,
    *,
    log: logging.Logger,
) -> None:
    """Compute and export conflict-of-interest data."""
    sj = prepare_income_sidejobs(
        period,
        period_start,
        period_end,
        df_sidejobs,
        log=log,
        positive_only=True,
    )
    sj["sidejob_topics"] = sj["topics"].apply(lambda value: set(split_topics(value)))
    sj = sj[sj["sidejob_topics"].map(len) > 0]

    committees = df_committees.copy()
    committees["committee_topics"] = committees["topics"].apply(
        lambda value: set(split_topics(value))
    )
    committees = committees[committees["committee_topics"].map(len) > 0]

    mem = df_memberships.merge(
        committees.filter(["committee_id", "label", "committee_topics"]),
        on="committee_id",
        how="inner",
    )
    merged = mem.merge(
        sj.filter(["politician_id", "sidejob_topics", "prorated_income"]),
        on="politician_id",
        how="inner",
    )

    empty_result = {
        "stats": {
            "total_income": 0.0,
            "affected_politicians": 0,
            "affected_committees": 0,
        },
        "conflicts": [],
    }
    output_path = period_output_dir(output_dir, period) / "conflicts.json"

    if merged.empty:
        write_json(output_path, empty_result, log=log)
        return

    merged["intersection"] = merged.apply(
        lambda row: row["committee_topics"] & row["sidejob_topics"], axis=1
    )
    conflicted = merged[merged["intersection"].map(len) > 0]
    if conflicted.empty:
        write_json(output_path, empty_result, log=log)
        return

    rows: list[dict] = []
    party_map = pols_df.set_index("politician_id")["party_label"].to_dict()
    for (politician_id, committee_label), group in conflicted.groupby(
        ["politician_id", "label"]
    ):
        rows.append(
            {
                "politician_id": int(politician_id),
                "party": str(party_map.get(int(politician_id), "")),
                "committee_label": str(committee_label),
                "matching_topics": sorted(set().union(*group["intersection"])),
                "conflicted_income": round(float(group["prorated_income"].sum()), 2),
            }
        )

    rows.sort(key=lambda row: row["conflicted_income"], reverse=True)
    stats = {
        "total_income": round(sum(row["conflicted_income"] for row in rows), 2),
        "affected_politicians": len({row["politician_id"] for row in rows}),
        "affected_committees": len({row["committee_label"] for row in rows}),
    }
    write_json(output_path, {"stats": stats, "conflicts": rows}, log=log)
