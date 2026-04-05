"""Tests for src/analysis/keyword_timeline.py."""

import pandas as pd
import pytest

import src.analysis.keyword_timeline as kt


@pytest.fixture
def sample_df():
    """Minimal DataFrame with two speeches in different months."""
    return pd.DataFrame(
        {
            "sitzungsnummer": [1, 1, 2],
            "rede_id": ["ID1", "ID2", "ID3"],
            "redner_id": ["R1", "R2", "R1"],
            "vorname": ["Anna", "Bernd", "Anna"],
            "nachname": ["Mueller", "Schmidt", "Mueller"],
            "fraktion": ["SPD", "AfD", "SPD"],
            "wortanzahl": [5, 3, 4],
            "text": [
                "klimawandel klimawandel migration energie energie",
                "migration sicherheit sicherheit",
                "energie energie energie wirtschaft",
            ],
            "datum": ["2025-01-15", "2025-01-20", "2025-02-10"],
        }
    )


def test_compute_keyword_timeline_monatsstruktur(sample_df):
    """Months are sorted ISO strings; arrays are parallel."""
    result = kt.compute_keyword_timeline(sample_df, stopwords=set(), min_count=1)
    months = result["meta"]["months"]
    assert months == ["2025-01", "2025-02"]
    assert len(result["meta"]["total_words_per_month"]) == len(months)


def test_compute_keyword_timeline_total_words(sample_df):
    """total_words_per_month sums wortanzahl per month correctly."""
    result = kt.compute_keyword_timeline(sample_df, stopwords=set(), min_count=1)
    # Jan: 5 + 3 = 8, Feb: 4
    assert result["meta"]["total_words_per_month"] == [8, 4]


def test_compute_keyword_timeline_term_counts(sample_df):
    """Term counts are per-month mention counts."""
    result = kt.compute_keyword_timeline(sample_df, stopwords=set(), min_count=1)
    terms = result["terms"]
    # "energie": Jan=2 (Anna), Feb=3 (Anna) → [2, 3]
    assert terms["energie"] == [2, 3]
    # "klimawandel": Jan=2 (Anna), Feb=0 → [2, 0]
    assert terms["klimawandel"] == [2, 0]


def test_compute_keyword_timeline_stopwords_excluded(sample_df):
    """Terms in stopwords set are not in output."""
    result = kt.compute_keyword_timeline(
        sample_df, stopwords={"migration"}, min_count=1
    )
    assert "migration" not in result["terms"]


def test_compute_keyword_timeline_min_count_filter(sample_df):
    """Terms with total mentions below min_count are excluded."""
    # "wirtschaft" appears only once total
    result = kt.compute_keyword_timeline(sample_df, stopwords=set(), min_count=2)
    assert "wirtschaft" not in result["terms"]
    assert "energie" in result["terms"]  # appears 5 times total


def test_compute_keyword_timeline_fehlende_daten(sample_df):
    """Rows with datum=None are silently skipped."""
    df = sample_df.copy()
    df.loc[0, "datum"] = None
    result = kt.compute_keyword_timeline(df, stopwords=set(), min_count=1)
    # Should not raise; months may differ but structure is valid
    assert "meta" in result
    assert "terms" in result


# ── Party breakdown tests ─────────────────────────────────────────────────────


def test_compute_keyword_timeline_parties_present(sample_df):
    """meta.parties lists parties from PARTY_ORDER that appear in data, excluding fraktionslos."""
    result = kt.compute_keyword_timeline(sample_df, stopwords=set(), min_count=1)
    parties = result["meta"]["parties"]
    # sample_df has SPD and AfD; SPD comes before AfD in PARTY_ORDER
    assert parties == ["SPD", "AfD"]


def test_compute_keyword_timeline_party_words(sample_df):
    """meta.party_words contains total wortanzahl per party per month.

    sample_df: SPD Jan=5, SPD Feb=4 → [5, 4]; AfD Jan=3, AfD Feb=0 → [3, 0]
    """
    result = kt.compute_keyword_timeline(sample_df, stopwords=set(), min_count=1)
    pw = result["meta"]["party_words"]
    assert pw["SPD"] == [5, 4]
    assert pw["AfD"] == [3, 0]


def test_compute_keyword_timeline_by_party_counts(sample_df):
    """by_party contains per-party term counts parallel to meta.months.

    sample_df texts:
      speech 1 SPD Jan: "klimawandel klimawandel migration energie energie"
      speech 2 AfD Jan: "migration sicherheit sicherheit"
      speech 3 SPD Feb: "energie energie energie wirtschaft"
    """
    result = kt.compute_keyword_timeline(
        sample_df, stopwords=set(), min_count=1, min_count_parties=1
    )
    bp = result["by_party"]
    # energie: SPD Jan=2, SPD Feb=3; AfD always 0
    assert bp["energie"]["SPD"] == [2, 3]
    assert bp["energie"]["AfD"] == [0, 0]
    # migration: SPD Jan=1, AfD Jan=1
    assert bp["migration"]["SPD"] == [1, 0]
    assert bp["migration"]["AfD"] == [1, 0]


def test_compute_keyword_timeline_by_party_only_filtered_terms(sample_df):
    """by_party uses min_count_parties independently from terms min_count."""
    # With min_count_parties=2, only terms with >=2 total mentions appear in by_party
    result = kt.compute_keyword_timeline(
        sample_df, stopwords=set(), min_count=1, min_count_parties=2
    )
    # terms with <2 total counts must be absent from by_party
    for term, counts in result["terms"].items():
        if sum(counts) < 2:
            assert term not in result["by_party"]
        else:
            assert term in result["by_party"]


def test_compute_keyword_timeline_fraktionslos_excluded(sample_df):
    """fraktionslos is never included in parties or by_party."""
    df = sample_df.copy()
    df.loc[0, "fraktion"] = "fraktionslos"
    result = kt.compute_keyword_timeline(
        df, stopwords=set(), min_count=1, min_count_parties=1
    )
    assert "fraktionslos" not in result["meta"]["parties"]
    for term_parties in result["by_party"].values():
        assert "fraktionslos" not in term_parties
