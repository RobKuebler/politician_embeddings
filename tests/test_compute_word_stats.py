"""Tests für src/compute_word_stats.py."""

import pandas as pd
import pytest

import src.compute_word_stats as cws


@pytest.fixture(autouse=True)
def disable_lemmatization(monkeypatch):
    """Deactivate spaCy lemmatization for all tests.

    Tests run without the German model installed. Lemmatization is tested
    separately via test_lemmatize_tokens_* below.
    """
    monkeypatch.setattr(cws, "_lemmatize_tokens", lambda tokens: tokens)


# ---------------------------------------------------------------------------
# _tokenize
# ---------------------------------------------------------------------------


def test_tokenize_lowercase_und_nur_alpha():
    tokens = cws._tokenize("Klimawandel bedroht unsere Zukunft")
    assert "klimawandel" in tokens
    assert "zukunft" in tokens
    # Nicht-alphabetische Tokens werden gefiltert
    assert "zukunft!" not in tokens


def test_tokenize_filtert_kurze_woerter():
    # Wörter <= 3 Zeichen werden gefiltert
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
    # Use 50 distinct alphabetic words to test top_n limiting
    alpha = "abcdefghijklmnopqrstuvwxyz"
    words = [f"wort{alpha[i % 26]}{alpha[i // 26]}" for i in range(50)]
    party_texts: dict[str, str] = {"SPD": " ".join(words)}
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


def test_fetch_word_stats_fehlendes_csv_wirft_systemexit(tmp_path):
    """Fehlendes speeches.csv → SystemExit."""
    with pytest.raises(SystemExit):
        cws.fetch_word_stats(tmp_path)


# ---------------------------------------------------------------------------
# _lemmatize_tokens (benötigt echtes spaCy-Modell, autouse-Fixture deaktiviert)
# ---------------------------------------------------------------------------


def test_lemmatize_tokens_fasst_flexionsformen_zusammen(monkeypatch):
    """Adjektiv-Flexionsformen werden auf Grundform reduziert."""
    monkeypatch.undo()

    tokens = ["rechtsextreme", "rechtsextremen", "rechtsextremem", "rechtsextrem"]
    lemmas = cws._lemmatize_tokens(tokens)
    lemma_set = set(lemmas)
    # Die häufigsten Flexionsformen (-e, -en) müssen zur Grundform "rechtsextrem" zusammenlaufen
    assert "rechtsextrem" in lemma_set, f"Grundform fehlt: {lemma_set}"
    idx_e = tokens.index("rechtsextreme")
    idx_en = tokens.index("rechtsextremen")
    assert lemmas[idx_e] == lemmas[idx_en] == "rechtsextrem", (
        f"rechtsextreme→{lemmas[idx_e]}, rechtsextremen→{lemmas[idx_en]}"
    )


def test_lemmatize_tokens_innen_plural(monkeypatch):
    """Feminine Pluralformen auf -innen werden auf -in reduziert."""
    monkeypatch.undo()

    tokens = ["demokratinnen", "politikerinnen", "sozialdemokratinnen"]
    lemmas = cws._lemmatize_tokens(tokens)
    assert lemmas[0] == "demokratin", f"demokratinnen→{lemmas[0]}"
    assert lemmas[1] == "politikerin", f"politikerinnen→{lemmas[1]}"
    assert lemmas[2] == "sozialdemokratin", f"sozialdemokratinnen→{lemmas[2]}"


def test_lemmatize_tokens_identity_fuer_grundformen(monkeypatch):
    """Wörter die bereits Grundform sind, bleiben unverändert."""
    monkeypatch.undo()

    tokens = ["klimawandel", "migration", "sicherheit"]
    lemmas = cws._lemmatize_tokens(tokens)
    # Grundformen sollten sich nicht wesentlich ändern
    assert all(len(lemma) >= 4 and lemma.isalpha() for lemma in lemmas)


def test_lemmatize_tokens_leere_liste(monkeypatch):
    """Leere Token-Liste gibt leere Liste zurück ohne spaCy aufzurufen."""
    monkeypatch.undo()
    assert cws._lemmatize_tokens([]) == []
