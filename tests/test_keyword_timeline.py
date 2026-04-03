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
