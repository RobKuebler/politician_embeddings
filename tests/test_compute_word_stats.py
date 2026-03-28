"""Tests für src/compute_word_stats.py."""

import pandas as pd

import src.compute_word_stats as cws

# ---------------------------------------------------------------------------
# _tokenize
# ---------------------------------------------------------------------------


def test_tokenize_lowercase_und_nur_alpha():
    tokens = cws._tokenize("Klimawandel bedroht unsere Zukunft!")
    assert "klimawandel" in tokens
    assert "zukunft" in tokens
    # Satzzeichen werden entfernt (nicht-alpha)
    assert "zukunft!" not in tokens


def test_tokenize_filtert_kurze_woerter():
    # Wörter <= 2 Zeichen werden gefiltert
    tokens = cws._tokenize("wir in an ja klimawandel")
    assert "klimawandel" in tokens
    assert "wir" not in tokens
    assert "in" not in tokens


# ---------------------------------------------------------------------------
# compute_tfidf
# ---------------------------------------------------------------------------


def test_tfidf_diskriminierende_woerter_ranken_hoeher():
    """Parteispezifische Wörter haben höheren TF-IDF als gemeinsame."""
    party_texts = {
        "SPD": "klimawandel klimawandel klimawandel sozial sozial arbeit bundestag bundestag",
        "AfD": "grenze grenze grenze migration migration sicherheit bundestag bundestag",
    }
    df = cws.compute_tfidf(party_texts, stopwords=set(), top_n=5)

    spd_top = df[df["fraktion"] == "SPD"].sort_values("rang")["wort"].tolist()
    afd_top = df[df["fraktion"] == "AfD"].sort_values("rang")["wort"].tolist()

    # Parteispezifische Wörter an der Spitze
    assert spd_top[0] in {"klimawandel", "sozial", "arbeit"}
    assert afd_top[0] in {"grenze", "migration", "sicherheit"}
    # Gemeinsames Wort nicht vorne
    assert "bundestag" not in spd_top[:3]
    assert "bundestag" not in afd_top[:3]


def test_tfidf_spalten_korrekt():
    party_texts = {"SPD": "klimawandel sozial", "CDU": "wirtschaft sicherheit"}
    df = cws.compute_tfidf(party_texts, stopwords=set(), top_n=10)
    assert set(df.columns) == {"fraktion", "wort", "tfidf", "rang"}


def test_tfidf_rang_beginnt_bei_1():
    party_texts = {"SPD": "klimawandel sozial arbeit"}
    df = cws.compute_tfidf(party_texts, stopwords=set(), top_n=5)
    assert df[df["fraktion"] == "SPD"]["rang"].min() == 1


def test_tfidf_stopwords_werden_entfernt():
    party_texts = {"SPD": "und oder aber klimawandel"}
    stopwords = {"und", "oder", "aber"}
    df = cws.compute_tfidf(party_texts, stopwords=stopwords, top_n=10)
    assert "und" not in df["wort"].to_numpy()
    assert "klimawandel" in df["wort"].to_numpy()


def test_tfidf_top_n_begrenzt_eintraege():
    party_texts = {"SPD": " ".join(f"wort{i}" for i in range(50))}
    df = cws.compute_tfidf(party_texts, stopwords=set(), top_n=10)
    assert len(df[df["fraktion"] == "SPD"]) == 10


# ---------------------------------------------------------------------------
# compute_speech_stats
# ---------------------------------------------------------------------------


def test_speech_stats_aggregiert_korrekt():
    df = pd.DataFrame(
        [
            {
                "fraktion": "SPD",
                "redner_id": "R1",
                "vorname": "Anna",
                "nachname": "M",
                "rede_id": "1",
                "wortanzahl": 100,
            },
            {
                "fraktion": "SPD",
                "redner_id": "R1",
                "vorname": "Anna",
                "nachname": "M",
                "rede_id": "2",
                "wortanzahl": 200,
            },
            {
                "fraktion": "AfD",
                "redner_id": "R2",
                "vorname": "Bernd",
                "nachname": "S",
                "rede_id": "3",
                "wortanzahl": 50,
            },
        ]
    )
    stats = cws.compute_speech_stats(df)
    anna = stats[stats["redner_id"] == "R1"].iloc[0]
    assert anna["anzahl_reden"] == 2
    assert anna["wortanzahl_gesamt"] == 300


def test_speech_stats_spalten_korrekt():
    df = pd.DataFrame(
        [
            {
                "fraktion": "SPD",
                "redner_id": "R1",
                "vorname": "A",
                "nachname": "B",
                "rede_id": "1",
                "wortanzahl": 100,
            },
        ]
    )
    stats = cws.compute_speech_stats(df)
    assert set(stats.columns) == {
        "fraktion",
        "redner_id",
        "vorname",
        "nachname",
        "anzahl_reden",
        "wortanzahl_gesamt",
    }


# ---------------------------------------------------------------------------
# fetch_word_stats (Integration)
# ---------------------------------------------------------------------------


def test_fetch_word_stats_schreibt_csvs(tmp_path):
    """fetch_word_stats liest speeches.csv und schreibt beide Output-CSVs."""
    speeches = pd.DataFrame(
        [
            {
                "sitzungsnummer": 1,
                "rede_id": "1",
                "redner_id": "R1",
                "vorname": "Anna",
                "nachname": "M",
                "fraktion": "SPD",
                "wortanzahl": 6,
                "text": "klimawandel sozial arbeit energie zukunft investieren",
            },
            {
                "sitzungsnummer": 1,
                "rede_id": "2",
                "redner_id": "R2",
                "vorname": "Bernd",
                "nachname": "S",
                "fraktion": "AfD",
                "wortanzahl": 5,
                "text": "grenze migration sicherheit ordnung kontrolle",
            },
        ]
    )
    (tmp_path / "speeches.csv").write_text(
        speeches.to_csv(index=False), encoding="utf-8"
    )

    cws.fetch_word_stats(tmp_path, top_n=5)

    wf = pd.read_csv(tmp_path / "party_word_freq.csv")
    ss = pd.read_csv(tmp_path / "party_speech_stats.csv")

    assert set(wf.columns) == {"fraktion", "wort", "tfidf", "rang"}
    assert set(ss.columns) == {
        "fraktion",
        "redner_id",
        "vorname",
        "nachname",
        "anzahl_reden",
        "wortanzahl_gesamt",
    }
    assert len(wf) == 10  # 5 Woerter x 2 Parteien
    assert len(ss) == 2  # 1 Redner pro Partei
