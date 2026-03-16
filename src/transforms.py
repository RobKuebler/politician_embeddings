import numpy as np
import pandas as pd

from src.education_clusters import normalize_education_degree, normalize_education_field
from src.occupation_clusters import normalize_occupation


def compute_cohesion(
    df: pd.DataFrame, *, exclude_party: str | None = None
) -> pd.DataFrame:
    """Compute average distance from party centroid per party.

    Accepts a 2D embeddings DataFrame with columns: x, y, party.
    Returns DataFrame with columns: party, streuung, label. Sorted ascending.
    """
    centroids = df.groupby("party")[["x", "y"]].mean()
    cx = df["party"].map(centroids["x"])
    cy = df["party"].map(centroids["y"])
    coh = (
        np.sqrt((df["x"] - cx) ** 2 + (df["y"] - cy) ** 2)
        .groupby(df["party"])
        .mean()
        .reset_index(name="streuung")
    )
    if exclude_party is not None:
        coh = coh[coh["party"] != exclude_party]
    coh["label"] = coh["party"].str.replace("\xad", "", regex=False)
    return coh.sort_values("streuung")


def _build_category_pivot(
    pols_df: pd.DataFrame,
    col: str,
    normalize_fn,
    cat_col: str,
    party_labels_ordered: list[str],
    top_n: int = 0,
) -> tuple[pd.DataFrame, np.ndarray, np.ndarray]:
    """Build a category pivot with %-values per party and deviation.

    Deviation is measured from the Bundestag average.

    Returns (pivot_pct, pct_z, dev_z) where:
    - pivot_pct: DataFrame with %-values (rows=categories, cols=parties)
    - pct_z: numpy matrix of %-values (0 replaced by NaN)
    - dev_z: numpy matrix of deviation from Bundestag average in percentage points
    """
    tmp = pols_df[["party_label", col]].copy()
    tmp[cat_col] = tmp[col].where(tmp[col].notna(), other=None).apply(normalize_fn)
    counts = tmp.groupby(["party_label", cat_col]).size().reset_index(name="count")
    pivot = counts.pivot_table(
        index=cat_col, columns="party_label", values="count", fill_value=0
    )
    # Drop non-informative categories, sort by frequency
    cat_totals = counts.groupby(cat_col)["count"].sum().sort_values(ascending=False)
    drop_labels = {"Keine Angabe", "Nicht erkennbar", "Abgeordneter"}
    cat_totals = cat_totals[~cat_totals.index.isin(drop_labels)]
    pivot = pivot.reindex(cat_totals.index)
    pivot = pivot.drop(index=drop_labels & set(pivot.index), errors="ignore")
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
    return pivot_pct, pct_z, dev_z


def compute_occupation_pivot(
    pols_df: pd.DataFrame, party_labels_ordered: list[str]
) -> tuple[pd.DataFrame, np.ndarray, np.ndarray]:
    """Build occupation pivot with %-values and deviation from Bundestag average.

    Shows all categories (no Sonstiges grouping).
    Drops 'Abgeordneter', 'Keine Angabe', 'Nicht erkennbar' before ranking.
    """
    return _build_category_pivot(
        pols_df,
        "occupation",
        normalize_occupation,
        "occ_cat",
        party_labels_ordered,
        top_n=0,
    )


def compute_age_df(pols_df: pd.DataFrame, current_year: int) -> pd.DataFrame:
    """Add 'alter' (age) column; drops rows with missing year_of_birth."""
    age_df = (
        pols_df[["party_label", "year_of_birth"]]
        .dropna(subset=["year_of_birth"])
        .copy()
    )
    age_df["alter"] = current_year - age_df["year_of_birth"].astype(int)
    return age_df


def compute_sex_counts(pols_df: pd.DataFrame) -> pd.DataFrame:
    """Compute gender distribution per party with percentage column.

    Returns DataFrame with columns: party_label, geschlecht, count, pct.
    """
    sex_df = pols_df[["party_label", "sex"]].dropna(subset=["sex"]).copy()
    sex_map = {"m": "Männlich", "f": "Weiblich", "d": "Divers"}
    sex_df["geschlecht"] = sex_df["sex"].map(sex_map).fillna(sex_df["sex"])
    counts = (
        sex_df.groupby(["party_label", "geschlecht"]).size().reset_index(name="count")
    )
    totals = counts.groupby("party_label")["count"].transform("sum")
    counts["pct"] = (counts["count"] / totals * 100).round(1)
    return counts


def compute_education_field_pivot(
    pols_df: pd.DataFrame, party_labels_ordered: list[str]
) -> tuple[pd.DataFrame, np.ndarray, np.ndarray]:
    """Build education-field pivot with %-values and deviation.

    Shows all categories (no Sonstiges grouping).
    """
    return _build_category_pivot(
        pols_df,
        "education",
        normalize_education_field,
        "edu_field",
        party_labels_ordered,
        top_n=0,
    )


def compute_education_degree_pivot(
    pols_df: pd.DataFrame, party_labels_ordered: list[str]
) -> tuple[pd.DataFrame, np.ndarray, np.ndarray]:
    """Build degree-level pivot with %-values and deviation from Bundestag average."""
    return _build_category_pivot(
        pols_df, "education", normalize_education_degree, "degree", party_labels_ordered
    )


def compute_title_counts(pols_df: pd.DataFrame) -> pd.DataFrame:
    """Compute Mit Titel / Ohne Titel distribution per party with percentage column.

    Returns DataFrame with columns: party_label, titel, count, pct.
    """
    title_df = pols_df[["party_label", "field_title"]].copy()
    title_df["titel"] = title_df["field_title"].apply(
        lambda t: "Mit Titel" if isinstance(t, str) and t.strip() else "Ohne Titel"
    )
    counts = title_df.groupby(["party_label", "titel"]).size().reset_index(name="count")
    totals = counts.groupby("party_label")["count"].transform("sum")
    counts["pct"] = (counts["count"] / totals * 100).round(1)
    return counts
