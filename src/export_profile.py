"""Party-profile-specific export helpers."""

from __future__ import annotations

from typing import TYPE_CHECKING

from .analysis.transforms import (
    compute_age_df,
    compute_education_degree_pivot,
    compute_education_field_pivot,
    compute_occupation_pivot,
    compute_sex_counts,
    compute_title_counts,
)
from .constants import PARTY_ORDER
from .export_utils import clean_matrix, period_output_dir, write_json

if TYPE_CHECKING:
    import logging
    from datetime import date
    from pathlib import Path

    import numpy as np
    import pandas as pd


def pivot_to_json(
    pivot_pct: pd.DataFrame,
    dev_z: np.ndarray,
    pivot_count: pd.DataFrame,
) -> dict:
    """Serialize a deviation pivot for the frontend DeviationHeatmap component."""
    return {
        "categories": list(pivot_pct.index),
        "parties": list(pivot_pct.columns),
        "pct": clean_matrix(pivot_pct.to_numpy().astype(float), 1),
        "dev": clean_matrix(dev_z, 2),
        "count": [
            [int(value) for value in row]
            for row in pivot_count.to_numpy().astype(int).tolist()
        ],
        "party_totals": [int(value) for value in pivot_count.sum(axis=0).tolist()],
    }


def export_party_profile(
    output_dir: Path,
    period: int,
    pols_df: pd.DataFrame,
    period_start: date,
    *,
    log: logging.Logger,
) -> None:
    """Build and write party_profile JSON for one period."""
    present = set(pols_df["party_label"].dropna().unique())
    canonical_order = {party.replace("\xad", "") for party in PARTY_ORDER}
    ordered_parties = [
        party.replace("\xad", "")
        for party in PARTY_ORDER
        if party.replace("\xad", "") in present
    ] + sorted(present - canonical_order)

    age_df = compute_age_df(pols_df, period_start.year)
    sex_df = compute_sex_counts(pols_df)
    title_df = compute_title_counts(pols_df)
    occ_pct, _, occ_dev_z, occ_count = compute_occupation_pivot(
        pols_df, ordered_parties
    )
    field_pct, _, field_dev_z, field_count = compute_education_field_pivot(
        pols_df, ordered_parties
    )
    degree_pct, _, degree_dev_z, degree_count = compute_education_degree_pivot(
        pols_df, ordered_parties
    )

    payload = {
        "parties": ordered_parties,
        "age": age_df.filter(["name", "party_label", "alter"])
        .rename(columns={"party_label": "party", "alter": "age"})
        .to_dict("records"),
        "sex": sex_df.to_dict("records"),
        "titles": title_df.to_dict("records"),
        "occupation": pivot_to_json(occ_pct, occ_dev_z, occ_count),
        "education_field": pivot_to_json(field_pct, field_dev_z, field_count),
        "education_degree": pivot_to_json(degree_pct, degree_dev_z, degree_count),
    }

    write_json(
        period_output_dir(output_dir, period) / "party_profile.json",
        payload,
        log=log,
    )
