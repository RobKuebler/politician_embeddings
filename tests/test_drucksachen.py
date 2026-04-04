# tests/test_drucksachen.py
"""Unit tests for src/analysis/drucksachen.py."""

from src.analysis.drucksachen import (
    compute_counts_by_party,
    compute_timeline,
    compute_top_authors,
    compute_word_freq,
    extract_party,
)


def _doc(
    bezeichnung: str,
    titel: str = "Test",
    datum: str = "2024-01-15",
    autoren: list[dict] | None = None,
) -> dict:
    """Build a minimal DIP Drucksache dict for testing."""
    return {
        "urheber": [{"bezeichnung": bezeichnung, "einbringer": False}],
        "titel": titel,
        "datum": datum,
        "autoren_anzeige": autoren or [],
    }


# ── extract_party ────────────────────────────────────────────────────────────


def test_extract_party_afd():
    assert extract_party(_doc("AfD")) == "AfD"


def test_extract_party_linke_maps_to_canonical():
    assert extract_party(_doc("LINKE")) == "Die Linke"


def test_extract_party_b90gr_maps_to_gruene():
    assert extract_party(_doc("B90/GR")) == "Grüne"


def test_extract_party_cdu_csu():
    assert extract_party(_doc("CDU/CSU")) == "CDU/CSU"


def test_extract_party_unknown_returns_none():
    assert extract_party(_doc("UNBEKANNT")) is None


def test_extract_party_empty_urheber_returns_none():
    assert extract_party({"urheber": [], "titel": "", "datum": ""}) is None


# ── compute_counts_by_party ───────────────────────────────────────────────────


def test_compute_counts_by_party_counts_correctly():
    docs = [_doc("AfD"), _doc("AfD"), _doc("SPD")]
    result = compute_counts_by_party(docs)
    counts = {r["party"]: r["count"] for r in result}
    assert counts["AfD"] == 2
    assert counts["SPD"] == 1


def test_compute_counts_by_party_sorted_descending():
    docs = [_doc("SPD"), _doc("AfD"), _doc("AfD")]
    result = compute_counts_by_party(docs)
    assert result[0]["party"] == "AfD"


def test_compute_counts_by_party_excludes_unknown():
    docs = [_doc("UNBEKANNT"), _doc("AfD")]
    result = compute_counts_by_party(docs)
    parties = [r["party"] for r in result]
    assert "UNBEKANNT" not in parties
    assert None not in parties


def test_compute_counts_by_party_empty_input():
    assert compute_counts_by_party([]) == []


# ── compute_timeline ──────────────────────────────────────────────────────────


def test_compute_timeline_months_sorted():
    docs = [_doc("AfD", datum="2024-03-01"), _doc("SPD", datum="2024-01-15")]
    result = compute_timeline(docs, ["AfD", "SPD"])
    assert result["months"] == ["2024-01", "2024-03"]


def test_compute_timeline_counts_per_party():
    docs = [
        _doc("AfD", datum="2024-01-01"),
        _doc("AfD", datum="2024-01-15"),
        _doc("SPD", datum="2024-01-20"),
    ]
    result = compute_timeline(docs, ["AfD", "SPD"])
    afd_series = next(s for s in result["series"] if s["party"] == "AfD")
    spd_series = next(s for s in result["series"] if s["party"] == "SPD")
    assert afd_series["counts"] == [2]
    assert spd_series["counts"] == [1]


def test_compute_timeline_empty_docs():
    result = compute_timeline([], ["AfD"])
    assert result == {"months": [], "series": []}


def test_compute_timeline_zero_fills_missing_months():
    docs = [
        _doc("AfD", datum="2024-01-01"),
        _doc("SPD", datum="2024-02-01"),  # SPD absent in Jan, AfD absent in Feb
    ]
    result = compute_timeline(docs, ["AfD", "SPD"])
    afd_series = next(s for s in result["series"] if s["party"] == "AfD")
    spd_series = next(s for s in result["series"] if s["party"] == "SPD")
    assert afd_series["counts"] == [1, 0]  # Jan=1, Feb=0
    assert spd_series["counts"] == [0, 1]  # Jan=0, Feb=1


# ── compute_top_authors ───────────────────────────────────────────────────────


def test_compute_top_authors_counts_by_id():
    docs = [
        _doc("AfD", autoren=[{"id": "1", "autor_titel": "Max Müller"}]),
        _doc("AfD", autoren=[{"id": "1", "autor_titel": "Max Müller"}]),
        _doc("AfD", autoren=[{"id": "2", "autor_titel": "Anna Koch"}]),
    ]
    result = compute_top_authors(docs)
    assert result["AfD"][0]["nachname"] == "Müller"
    assert result["AfD"][0]["anzahl"] == 2
    assert result["AfD"][1]["anzahl"] == 1


def test_compute_top_authors_splits_name():
    docs = [_doc("SPD", autoren=[{"id": "99", "autor_titel": "Maria Anna Schmidt"}])]
    result = compute_top_authors(docs)
    assert result["SPD"][0]["vorname"] == "Maria Anna"
    assert result["SPD"][0]["nachname"] == "Schmidt"


def test_compute_top_authors_top_n_limit():
    autoren = [{"id": str(i), "autor_titel": f"Autor {i}"} for i in range(20)]
    docs = [_doc("AfD", autoren=[a]) for a in autoren]
    result = compute_top_authors(docs, top_n=5)
    assert len(result["AfD"]) == 5


def test_compute_top_authors_empty():
    assert compute_top_authors([]) == {}


def test_compute_top_authors_sorted_descending():
    docs = [
        _doc("AfD", autoren=[{"id": "1", "autor_titel": "A B"}]),
        _doc("AfD", autoren=[{"id": "3", "autor_titel": "E F"}]),
        _doc("AfD", autoren=[{"id": "3", "autor_titel": "E F"}]),
        _doc("AfD", autoren=[{"id": "3", "autor_titel": "E F"}]),
        _doc("AfD", autoren=[{"id": "2", "autor_titel": "C D"}]),
        _doc("AfD", autoren=[{"id": "2", "autor_titel": "C D"}]),
    ]
    result = compute_top_authors(docs)
    anzahlen = [a["anzahl"] for a in result["AfD"]]
    assert anzahlen == sorted(anzahlen, reverse=True)
    assert anzahlen[0] == 3  # E F appears 3 times


# ── compute_word_freq ─────────────────────────────────────────────────────────


def test_compute_word_freq_returns_dict_keyed_by_party():
    docs = [
        _doc("AfD", titel="Klimaschutz und Migration und Sicherheit"),
        _doc("SPD", titel="Bildung Gesundheit Arbeit"),
    ]
    result = compute_word_freq(docs)
    assert "AfD" in result
    assert "SPD" in result


def test_compute_word_freq_entries_have_required_keys():
    docs = [_doc("AfD", titel="Klimaschutz und Migration Sicherheit Energie Bildung")]
    result = compute_word_freq(docs)
    assert result.get("AfD"), "Expected word freq entries for AfD"
    entry = result["AfD"][0]
    assert "wort" in entry
    assert "tfidf" in entry
    assert "rang" in entry


def test_compute_word_freq_empty_docs():
    assert compute_word_freq([]) == {}
