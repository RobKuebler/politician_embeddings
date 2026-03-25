import numpy as np
import pandas as pd
import pytest

from src.transforms import (
    compute_age_df,
    compute_cohesion,
    compute_occupation_pivot,
    compute_sex_counts,
    compute_title_counts,
)

# ─── compute_cohesion ─────────────────────────────────────────────────────────


def make_embeddings(rows: list[tuple]) -> pd.DataFrame:
    return pd.DataFrame(rows, columns=["party", "x", "y"])


def test_cohesion_all_at_centroid():
    """Politicians exactly on the party centroid -> streuung = 0."""
    df = make_embeddings([("A", 1.0, 1.0), ("A", 1.0, 1.0), ("B", 3.0, 3.0)])
    coh = compute_cohesion(df)
    assert coh[coh["party"] == "A"]["streuung"].iloc[0] == pytest.approx(0.0)
    assert coh[coh["party"] == "B"]["streuung"].iloc[0] == pytest.approx(0.0)


def test_cohesion_known_distance():
    """Two politicians 1 unit apart -> centroid is midpoint -> streuung = 0.5."""
    df = make_embeddings([("A", 0.0, 0.0), ("A", 1.0, 0.0)])
    coh = compute_cohesion(df)
    assert coh["streuung"].iloc[0] == pytest.approx(0.5)


def test_cohesion_sorted_ascending():
    """Result is sorted by streuung from lowest to highest."""
    df = make_embeddings(
        [
            ("Tight", 0.0, 0.0),
            ("Tight", 0.1, 0.0),
            ("Loose", 0.0, 0.0),
            ("Loose", 5.0, 0.0),
        ]
    )
    coh = compute_cohesion(df)
    assert coh["streuung"].iloc[0] < coh["streuung"].iloc[1]


def test_cohesion_exclude_party():
    """Excluded party does not appear in result."""
    df = make_embeddings([("A", 0.0, 0.0), ("B", 1.0, 1.0)])
    coh = compute_cohesion(df, exclude_party="B")
    assert "B" not in coh["party"].to_numpy()
    assert "A" in coh["party"].to_numpy()


def test_cohesion_label_strips_soft_hyphen():
    """Soft hyphens in party names are removed in the label column."""
    df = make_embeddings([("CDU\xadCSU", 0.0, 0.0), ("CDU\xadCSU", 1.0, 0.0)])
    coh = compute_cohesion(df)
    assert coh["label"].iloc[0] == "CDUCSU"


def test_cohesion_columns():
    df = make_embeddings([("A", 0.0, 0.0), ("A", 1.0, 0.0)])
    coh = compute_cohesion(df)
    assert {"party", "streuung", "label"} <= set(coh.columns)


# ─── compute_occupation_pivot ─────────────────────────────────────────────────


def make_pols(rows: list[tuple]) -> pd.DataFrame:
    return pd.DataFrame(rows, columns=["party_label", "occupation"])


def test_occupation_pivot_shape():
    """Pivot has one row per occupation category and one column per party."""
    df = make_pols([("SPD", "Lehrer"), ("CDU", "Lehrer"), ("SPD", "Arzt")])
    pivot, _z, _, _count = compute_occupation_pivot(df, ["SPD", "CDU"])
    assert "SPD" in pivot.columns
    assert "CDU" in pivot.columns


def test_occupation_pivot_zeros_become_nan():
    """Zero counts in the pivot matrix are replaced with NaN in z."""
    df = make_pols([("SPD", "Lehrer")])
    pivot, z, _, _count = compute_occupation_pivot(df, ["SPD", "CDU"])
    # CDU has 0 Lehrer -> should be NaN in z
    if "CDU" in pivot.columns:
        cdu_idx = list(pivot.columns).index("CDU")
        assert np.isnan(z[0, cdu_idx])


def test_occupation_pivot_party_order():
    """Party columns follow party_labels_ordered, unknown parties are excluded."""
    df = make_pols([("SPD", "Lehrer"), ("CDU", "Arzt"), ("FDP", "Jurist")])
    pivot, _, _, _count = compute_occupation_pivot(df, ["CDU", "SPD"])  # FDP excluded
    assert list(pivot.columns) == ["CDU", "SPD"]


def test_occupation_pivot_null_occupation():
    """Null occupations are dropped (Keine Angabe), not crash."""
    df = make_pols([("SPD", None), ("SPD", "Lehrer")])
    pivot, _z, _, _count = compute_occupation_pivot(df, ["SPD"])
    # "Keine Angabe" is dropped from the pivot by _build_category_pivot
    assert "Keine Angabe" not in pivot.index
    assert "Lehrer" in pivot.index


def test_occupation_pivot_dev_z_shape():
    """dev_z has the same shape as the pivot (categories x parties)."""
    df = make_pols(
        [
            ("SPD", "Lehrer"),
            ("SPD", "Lehrer"),
            ("SPD", "Lehrer"),
            ("CDU", "Lehrer"),
            ("SPD", "Arzt"),
            ("CDU", "Arzt"),
        ]
    )
    pivot, pct_z, dev_z, _count = compute_occupation_pivot(df, ["SPD", "CDU"])
    assert pct_z.shape == pivot.shape
    assert dev_z.shape == pivot.shape


# ─── compute_age_df ───────────────────────────────────────────────────────────


def make_pols_age(rows: list[tuple]) -> pd.DataFrame:
    df = pd.DataFrame(rows, columns=["party_label", "year_of_birth"])
    df["name"] = "Test Person"
    return df


def test_age_df_calculates_alter():
    df = make_pols_age([("SPD", 1980), ("CDU", 1990)])
    result = compute_age_df(df, current_year=2025)
    assert result[result["party_label"] == "SPD"]["alter"].iloc[0] == 45
    assert result[result["party_label"] == "CDU"]["alter"].iloc[0] == 35


def test_age_df_drops_missing_year():
    df = make_pols_age([("SPD", 1980), ("CDU", None)])
    result = compute_age_df(df, current_year=2025)
    assert len(result) == 1
    assert result["party_label"].iloc[0] == "SPD"


def test_age_df_columns():
    df = make_pols_age([("SPD", 1985)])
    result = compute_age_df(df, current_year=2025)
    assert {"party_label", "alter"} <= set(result.columns)


# ─── compute_sex_counts ───────────────────────────────────────────────────────


def make_pols_sex(rows: list[tuple]) -> pd.DataFrame:
    return pd.DataFrame(rows, columns=["party_label", "sex"])


def test_sex_counts_maps_codes_to_german():
    df = make_pols_sex([("SPD", "m"), ("SPD", "f"), ("SPD", "d")])
    result = compute_sex_counts(df)
    labels = set(result["geschlecht"])
    assert "Männlich" in labels
    assert "Weiblich" in labels
    assert "Divers" in labels


def test_sex_counts_percentages_sum_to_100():
    df = make_pols_sex([("SPD", "m"), ("SPD", "m"), ("SPD", "f")])
    result = compute_sex_counts(df)
    total_pct = result[result["party_label"] == "SPD"]["pct"].sum()
    assert total_pct == pytest.approx(100.0, abs=0.2)


def test_sex_counts_drops_missing():
    df = make_pols_sex([("SPD", "m"), ("CDU", None)])
    result = compute_sex_counts(df)
    assert "CDU" not in result["party_label"].to_numpy()


def test_sex_counts_columns():
    df = make_pols_sex([("SPD", "m")])
    result = compute_sex_counts(df)
    assert {"party_label", "geschlecht", "count", "pct"} <= set(result.columns)


# ─── compute_title_counts ─────────────────────────────────────────────────────


def make_pols_title(rows: list[tuple]) -> pd.DataFrame:
    return pd.DataFrame(rows, columns=["party_label", "field_title"])


def test_title_counts_mit_titel():
    df = make_pols_title([("SPD", "Dr."), ("SPD", "Prof.")])
    result = compute_title_counts(df)
    mit = result[(result["party_label"] == "SPD") & (result["titel"] == "Mit Titel")]
    assert mit["count"].iloc[0] == 2


def test_title_counts_ohne_titel_for_null_and_empty():
    """None and empty string both count as 'Ohne Titel'."""
    df = make_pols_title([("CDU", None), ("CDU", ""), ("CDU", "  ")])
    result = compute_title_counts(df)
    ohne = result[(result["party_label"] == "CDU") & (result["titel"] == "Ohne Titel")]
    assert ohne["count"].iloc[0] == 3


def test_title_counts_percentages_sum_to_100():
    df = make_pols_title([("SPD", "Dr."), ("SPD", None), ("SPD", None)])
    result = compute_title_counts(df)
    total_pct = result[result["party_label"] == "SPD"]["pct"].sum()
    assert total_pct == pytest.approx(100.0, abs=0.2)


def test_title_counts_columns():
    df = make_pols_title([("SPD", "Dr.")])
    result = compute_title_counts(df)
    assert {"party_label", "titel", "count", "pct"} <= set(result.columns)
