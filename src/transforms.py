from collections.abc import Callable

import numpy as np
import pandas as pd

from src.education_clusters import normalize_education_degree, normalize_education_field
from src.occupation_clusters import normalize_occupation


def _add_party_pct(df: pd.DataFrame) -> pd.DataFrame:
    """Add a 'pct' column: each row's count as % of its party's total count."""
    return df.assign(
        pct=lambda d: (
            d["count"] / d.groupby("party_label")["count"].transform("sum") * 100
        ).round(1)
    )


def _grouped_pct(
    pols_df: pd.DataFrame,
    raw_col: str,
    display_col: str,
    value_map: dict[str, str],
) -> pd.DataFrame:
    """Compute per-party distribution with percentage column.

    Maps raw values via value_map, falling back to the raw value if unmapped.
    Returns DataFrame with columns: party_label, display_col, count, pct.
    """
    return (
        pols_df.filter(["party_label", raw_col])
        .dropna(subset=[raw_col])
        .assign(
            **{display_col: lambda df: df[raw_col].map(value_map).fillna(df[raw_col])}
        )
        .groupby(["party_label", display_col])
        .size()
        .reset_index(name="count")  # type: ignore[call-overload]
        .pipe(_add_party_pct)
    )


def compute_cohesion(
    df: pd.DataFrame, *, exclude_party: str | None = None
) -> pd.DataFrame:
    """Compute average distance from party centroid per party.

    Accepts a 2D embeddings DataFrame with columns: x, y, party.
    Returns DataFrame with columns: party, streuung, label. Sorted ascending.
    """
    centroids = df.groupby("party")[["x", "y"]].mean()
    return (
        np.sqrt(
            (df["x"] - df["party"].map(centroids["x"])) ** 2
            + (df["y"] - df["party"].map(centroids["y"])) ** 2
        )
        .groupby(df["party"])
        .mean()
        .reset_index(name="streuung")
        .pipe(
            lambda df: (
                df[df["party"] != exclude_party] if exclude_party is not None else df
            )
        )
        .assign(label=lambda df: df["party"].str.replace("\xad", "", regex=False))
        .sort_values("streuung")
    )


def _build_category_pivot(
    pols_df: pd.DataFrame,
    col: str,
    normalize_fn: Callable[[str | None], str],
    cat_col: str,
    party_labels_ordered: list[str],
    top_n: int = 0,
    drop_labels: set[str] | None = None,
    unknown_labels: set[str] | None = None,
) -> tuple[pd.DataFrame, np.ndarray, np.ndarray, pd.DataFrame]:
    """Build a category pivot with %-values per party and deviation.

    Deviation is measured from the Bundestag average.

    Returns (pivot_pct, pct_z, dev_z, pivot_count) where:
    - pivot_pct: DataFrame with %-values (rows=categories, cols=parties)
    - pct_z: numpy matrix of %-values (0 replaced by NaN)
    - dev_z: numpy matrix of deviation from Bundestag average in percentage points
    - pivot_count: DataFrame with absolute counts (rows=categories, cols=parties)

    If unknown_labels is given, those categories are aggregated into an "Unbekannt"
    row at the bottom instead of being dropped. This makes party_totals equal to the
    true party size so tooltip denominators are correct.
    """
    tmp = pols_df.filter(["party_label", col]).copy()
    tmp[cat_col] = tmp[col].where(tmp[col].notna(), other=None).apply(normalize_fn)
    counts = tmp.groupby(["party_label", cat_col]).size().reset_index(name="count")  # type: ignore[call-overload]
    pivot = counts.pivot_table(
        index=cat_col, columns="party_label", values="count", fill_value=0
    )
    # Drop non-informative categories, sort by frequency
    cat_totals = counts.groupby(cat_col)["count"].sum().sort_values(ascending=False)
    _drop = (
        drop_labels
        if drop_labels is not None
        else {"Keine Angabe", "Nicht erkennbar", "Abgeordneter"}
    )
    effective_drop = _drop - (unknown_labels or set())
    cat_totals = cat_totals[~cat_totals.index.isin(effective_drop)]
    pivot = pivot.reindex(cat_totals.index)
    pivot = pivot.drop(index=effective_drop & set(pivot.index), errors="ignore")
    # Aggregate unknown categories into a single "Unbekannt" row at the bottom
    if unknown_labels:
        unknown_in_pivot = [lbl for lbl in unknown_labels if lbl in pivot.index]
        unbekannt_row = (
            pivot.loc[unknown_in_pivot].sum(axis=0)
            if unknown_in_pivot
            else pd.Series(0, index=pivot.columns)
        )
        pivot = pivot.drop(index=unknown_in_pivot, errors="ignore")
        pivot.loc["Unbekannt"] = unbekannt_row
    # Group small categories into "Sonstiges" if top_n is set
    if top_n:
        # Exclude "Sonstiges" from top_n ranking — it always collects the rest
        ranked = cat_totals[cat_totals.index != "Sonstiges"]
        top_cats = set(ranked.index[:top_n])
        rest = pivot.loc[~pivot.index.isin(top_cats)]
        if not rest.empty:
            sonstiges_row = rest.sum(axis=0)
            pivot = pivot.loc[pivot.index.isin(top_cats)]
            pivot.loc["Sonstiges"] = sonstiges_row
        order = [c for c in ranked.index[:top_n] if c in pivot.index] + ["Sonstiges"]
        pivot = pivot.reindex([o for o in order if o in pivot.index])
    pivot = pivot.reindex(
        columns=[p for p in party_labels_ordered if p in pivot.columns]
    )
    # Convert to %-share within each party
    party_sizes = pivot.sum(axis=0)
    pivot_pct = pivot.div(party_sizes, axis=1) * 100
    # Bundestag average: total count per category / total politicians
    avg_pct = (pivot.sum(axis=1) / party_sizes.sum()) * 100
    # Deviation matrix: party% - average%
    dev = pivot_pct.sub(avg_pct, axis=0)
    pct_z = pivot_pct.to_numpy().astype(float)
    pct_z[pct_z == 0] = np.nan
    dev_z = dev.to_numpy().astype(float)
    dev_z[np.isnan(pct_z)] = np.nan
    return pivot_pct, pct_z, dev_z, pivot


def compute_occupation_pivot(
    pols_df: pd.DataFrame, party_labels_ordered: list[str]
) -> tuple[pd.DataFrame, np.ndarray, np.ndarray, pd.DataFrame]:
    """Build occupation pivot with %-values and deviation from Bundestag average.

    Shows all categories (no Sonstiges grouping). 'Abgeordneter' is kept as an
    explicit category. 'Keine Angabe' and 'Nicht erkennbar' are aggregated into
    an 'Unbekannt' row at the bottom, so party_totals equals the true party size.
    """
    return _build_category_pivot(
        pols_df,
        "occupation",
        normalize_occupation,
        "occ_cat",
        party_labels_ordered,
        top_n=0,
        drop_labels=set(),
        unknown_labels={"Keine Angabe", "Nicht erkennbar", "Abgeordneter"},
    )


def compute_age_df(pols_df: pd.DataFrame, current_year: int) -> pd.DataFrame:
    """Add 'alter' (age) column; drops rows with missing year_of_birth."""
    return (
        pols_df.filter(["name", "party_label", "year_of_birth"])
        .dropna(subset=["year_of_birth"])
        .assign(alter=lambda df: current_year - df["year_of_birth"].astype(int))
    )


def compute_sex_counts(pols_df: pd.DataFrame) -> pd.DataFrame:
    """Compute gender distribution per party with percentage column.

    Returns DataFrame with columns: party_label, geschlecht, count, pct.
    """
    return _grouped_pct(
        pols_df,
        "sex",
        "geschlecht",
        value_map={"m": "Männlich", "f": "Weiblich", "d": "Divers"},
    )


def compute_education_field_pivot(
    pols_df: pd.DataFrame, party_labels_ordered: list[str]
) -> tuple[pd.DataFrame, np.ndarray, np.ndarray, pd.DataFrame]:
    """Build education-field pivot with %-values and deviation.

    Shows all categories (no Sonstiges grouping). 'Keine Angabe' and
    'Nicht erkennbar' are aggregated into an 'Unbekannt' row at the bottom.
    """
    return _build_category_pivot(
        pols_df,
        "education",
        normalize_education_field,
        "edu_field",
        party_labels_ordered,
        top_n=0,
        drop_labels=set(),
        unknown_labels={"Keine Angabe", "Nicht erkennbar"},
    )


def compute_education_degree_pivot(
    pols_df: pd.DataFrame, party_labels_ordered: list[str]
) -> tuple[pd.DataFrame, np.ndarray, np.ndarray, pd.DataFrame]:
    """Build degree-level pivot with %-values and deviation from Bundestag average.

    'Keine Angabe' and 'Nicht erkennbar' are aggregated into an 'Unbekannt' row.
    """
    return _build_category_pivot(
        pols_df,
        "education",
        normalize_education_degree,
        "degree",
        party_labels_ordered,
        drop_labels=set(),
        unknown_labels={"Keine Angabe", "Nicht erkennbar"},
    )


def compute_title_counts(pols_df: pd.DataFrame) -> pd.DataFrame:
    """Compute Mit Titel / Ohne Titel distribution per party with percentage column.

    Returns DataFrame with columns: party_label, titel, count, pct.
    Includes all rows (not just non-null), so _grouped_pct's dropna can't be used.
    """
    return (
        pols_df.assign(
            titel=lambda df: df["field_title"].apply(
                lambda t: (
                    "Mit Titel" if isinstance(t, str) and t.strip() else "Ohne Titel"
                )
            )
        )
        .groupby(["party_label", "titel"])
        .size()
        .reset_index(name="count")  # type: ignore[call-overload]
        .pipe(_add_party_pct)
    )
