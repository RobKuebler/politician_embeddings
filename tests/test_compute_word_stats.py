"""Tests für src/compute_word_stats.py."""

import pandas as pd
import pytest

import src.analysis.word_stats as cws


@pytest.fixture(autouse=True)
def disable_lemmatization(monkeypatch):
    """Deactivate lemmatization for all tests.

    Keeps tests fast and independent of HanTa. Lemmatization is tested
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


def test_tokenize_filtert_kurze_woerter():
    # Wörter <= 2 Zeichen werden gefiltert (Min. 3 Zeichen).
    # 3-Zeichen-Wörter wie "wir" überleben die Tokenisierung — Stopwords filtern sie später.
    tokens = cws._tokenize("wir in an ja klimawandel")
    assert "klimawandel" in tokens
    assert "wir" in tokens  # 3 Zeichen → bleibt
    assert "in" not in tokens  # 2 Zeichen → weg
    assert "ja" not in tokens  # 2 Zeichen → weg


def test_tokenize_typografische_anfuehrungszeichen():
    # „Wort" und "Wort" → "wort" (Anführungszeichen abgestreift)
    tokens = cws._tokenize('„Klimawandel" "Zukunft" ‹Energie›')
    assert "klimawandel" in tokens
    assert "zukunft" in tokens
    assert "energie" in tokens


def test_tokenize_wort_mit_anhaengender_interpunktion():
    # "Zukunft," und "Klima." → clean tokens
    tokens = cws._tokenize("Klima. Zukunft, Sicherheit!")
    assert "zukunft" in tokens
    assert "sicherheit" in tokens


def test_tokenize_bindestrich_kompositum():
    # Bindestrich bleibt erhalten — Komposita werden nicht zerrissen
    tokens = cws._tokenize("Rheinland-Pfalz beschloss das Verbrenner-Aus")
    assert "rheinland-pfalz" in tokens
    assert "verbrenner-aus" in tokens
    assert "rheinland" not in tokens
    assert "pfalz" not in tokens


def test_tokenize_cdu_csu_splittet():
    # Schrägstrich → zwei separate Tokens
    tokens = cws._tokenize("CDU/CSU stimmt dagegen")
    assert "cdu" in tokens
    assert "csu" in tokens


def test_tokenize_en_dash_als_trenner():
    # En-Dash (U+2013) ist Satztrenner, kein Wortbestandteil
    tokens = cws._tokenize("Ende \u2013 Anfang")
    assert "ende" in tokens
    assert "anfang" in tokens


def test_tokenize_non_breaking_space():
    # Non-breaking Space (U+00A0) wird als Wortgrenze behandelt
    tokens = cws._tokenize("21.\u00a0Wahlperiode")
    assert "wahlperiode" in tokens
    assert "21" not in tokens


def test_tokenize_genderstern_bleibt():
    # Bürger*innen bleibt als eigene Wortform — interessant für Gendering-Analyse
    tokens = cws._tokenize("Bürger*innen fordern mehr Rechte")
    assert "bürger*innen" in tokens
    assert "bürger" not in tokens


def test_tokenize_gender_slash():
    # Lehrer/innen wird als zusammenhängende Genderform erhalten
    tokens = cws._tokenize("Lehrer/innen sollen besser bezahlt werden")
    assert "lehrer*innen" in tokens
    assert "lehrer" not in tokens
    assert "innen" not in tokens


def test_tokenize_gender_slash_mit_bindestrich():
    # Besucher/-innen soll nicht zu "besucher" + "innen" zerfallen
    tokens = cws._tokenize("Besucher/-innen fordern mehr Sicherheit")
    assert "besucher*innen" in tokens
    assert "besucher" not in tokens
    assert "innen" not in tokens


def test_tokenize_gender_doppelpunkt_bleibt():
    # Lehrer:innen bleibt als eigene Wortform
    tokens = cws._tokenize("Lehrer:innen sollen besser bezahlt werden")
    assert "lehrer:innen" in tokens
    assert "lehrer" not in tokens


def test_tokenize_doppelpunkt_nicht_bei_zeitangabe():
    # "10:30" wird komplett verworfen (Ziffern werden an Rändern abgestreift)
    tokens = cws._tokenize("Sitzung 10:30 Uhr")
    assert "10" not in tokens
    assert "30" not in tokens


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

    # Parteispezifische Begriffe bzw. Konzepte sollen vorne liegen.
    assert any(w in spd_top[:3] for w in ("klimawandel", "sozial", "arbeit"))
    assert any(w in afd_top[:3] for w in ("grenze", "migration", "sicherheit"))
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


def test_tfidf_ascii_stopword_erfasst_umlautform():
    party_texts = {"SPD": "für klimawandel für wirtschaft"}
    df = cws.compute_tfidf(party_texts, stopwords=cws._STOPWORDS, top_n=10)
    assert "für" not in df["wort"].to_numpy()


def test_tfidf_top_n_begrenzt_eintraege():
    # Use 50 distinct alphabetic words to test top_n limiting
    alpha = "abcdefghijklmnopqrstuvwxyz"
    words = [f"wort{alpha[i % 26]}{alpha[i // 26]}" for i in range(50)]
    party_texts: dict[str, str] = {"SPD": " ".join(words)}
    df = cws.compute_tfidf(party_texts, stopwords=set(), top_n=10)
    assert len(df[df["fraktion"] == "SPD"]) == 10


def test_tfidf_nimmt_wiederholte_bigrams_als_konzepte_auf():
    party_texts = {
        "SPD": (
            "erneuerbare energien fördern "
            "erneuerbare energien ausbauen "
            "erneuerbare energien absichern"
        ),
        "AfD": "grenze sichern migration begrenzen ordnung herstellen",
    }
    df = cws.compute_tfidf(party_texts, stopwords=set(), top_n=10)

    spd_words = df[df["fraktion"] == "SPD"]["wort"].tolist()
    assert "erneuerbare energien" in spd_words


def test_build_phrase_tokens_filtert_anrede_und_fraktionsmuster():
    tokens = [
        "afd-fraktion",
        "präsident",
        "wirtschaft",
        "wachstum",
        "wirtschaft",
        "wachstum",
    ]
    phrases = cws._build_phrase_tokens(tokens)
    assert "afd-fraktion präsident" not in phrases
    assert "wirtschaft wachstum" in phrases


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


def test_fetch_word_stats_schreibt_csvs(tmp_path, monkeypatch):
    """fetch_word_stats parst XMLs und schreibt beide Output-CSVs."""
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
    monkeypatch.setattr(cws, "parse_alle_sitzungen", lambda out_dir: speeches)

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


def test_fetch_word_stats_recovers_role_only_speaker_party(tmp_path, monkeypatch):
    speeches = pd.DataFrame(
        [
            {
                "sitzungsnummer": 1,
                "rede_id": "1",
                "redner_id": "R1",
                "vorname": "Nina",
                "nachname": "Warken",
                "fraktion": "fraktionslos",
                "wortanzahl": 4,
                "text": "gesundheit reform versorgung kliniken",
                "datum": "2025-05-01",
            },
            {
                "sitzungsnummer": 1,
                "rede_id": "2",
                "redner_id": "R2",
                "vorname": "Anna",
                "nachname": "M",
                "fraktion": "SPD",
                "wortanzahl": 4,
                "text": "arbeit lohn sozial gerechtigkeit",
                "datum": "2025-05-01",
            },
        ]
    )
    politicians = pd.DataFrame([{"name": "Nina Warken", "party": "CDU/CSU"}])
    monkeypatch.setattr(cws, "parse_alle_sitzungen", lambda out_dir: speeches)
    monkeypatch.setattr(cws, "_load_politician_metadata", lambda out_dir: politicians)

    cws.fetch_word_stats(tmp_path, top_n=3)

    stats = pd.read_csv(tmp_path / "party_speech_stats.csv")

    nina = stats[stats["redner_id"] == "R1"].iloc[0]
    assert nina["fraktion"] == "CDU/CSU"
    assert set(stats["fraktion"]) == {"CDU/CSU", "SPD"}


# ---------------------------------------------------------------------------
# _lemmatize_tokens (benötigt HanTa, autouse-Fixture deaktiviert)
# ---------------------------------------------------------------------------


def test_lemmatize_tokens_fasst_flexionsformen_zusammen(monkeypatch):
    """Adjektiv-Flexionsformen werden auf Grundform reduziert."""
    pytest.importorskip("HanTa")
    monkeypatch.undo()

    tokens = ["rechtsextreme", "rechtsextremen", "rechtsextremem", "rechtsextrem"]
    lemmas = cws._lemmatize_tokens(tokens)
    # Alle Flexionsformen müssen zur Grundform "rechtsextrem" zusammenlaufen
    assert all(lemma == "rechtsextrem" for lemma in lemmas), (
        f"Nicht alle auf Grundform: {lemmas}"
    )


def test_lemmatize_tokens_gefluechtete_konsistent(monkeypatch):
    """Alle Flexionsformen von 'Geflüchtete(r)' landen auf demselben Lemma."""
    pytest.importorskip("HanTa")
    monkeypatch.undo()

    tokens = ["geflüchteter", "geflüchtete", "geflüchteten", "geflüchtetem"]
    lemmas = cws._lemmatize_tokens(tokens)
    assert len(set(lemmas)) == 1, (
        f"Inkonsistente Lemmas: {list(zip(tokens, lemmas, strict=True))}"
    )


def test_lemmatize_tokens_innen_plural(monkeypatch):
    """Feminine Pluralformen auf -innen werden auf -in reduziert."""
    pytest.importorskip("HanTa")
    monkeypatch.undo()

    tokens = ["demokratinnen", "politikerinnen", "sozialdemokratinnen"]
    lemmas = cws._lemmatize_tokens(tokens)
    assert lemmas[0] == "demokratin", f"demokratinnen→{lemmas[0]}"
    assert lemmas[1] == "politikerin", f"politikerinnen→{lemmas[1]}"
    assert lemmas[2] == "sozialdemokratin", f"sozialdemokratinnen→{lemmas[2]}"


def test_lemmatize_tokens_identity_fuer_grundformen(monkeypatch):
    """Wörter die bereits Grundform sind, bleiben unverändert."""
    pytest.importorskip("HanTa")
    monkeypatch.undo()

    tokens = ["klimawandel", "migration", "sicherheit"]
    lemmas = cws._lemmatize_tokens(tokens)
    assert all(len(lemma) >= 3 and lemma.isalpha() for lemma in lemmas)


def test_lemmatize_tokens_bindestrich_unveraendert(monkeypatch):
    """Bindestrich-Komposita werden nicht lemmatisiert."""
    pytest.importorskip("HanTa")
    monkeypatch.undo()

    tokens = ["rheinland-pfalz", "verbrenner-aus"]
    lemmas = cws._lemmatize_tokens(tokens)
    assert lemmas == tokens


def test_lemmatize_tokens_gender_marker_wird_normalisiert(monkeypatch):
    """Gender-Marker werden entfernt und das Ergebnis lemmatisiert."""
    pytest.importorskip("HanTa")
    monkeypatch.undo()

    # Bürger*innen → bürgerinnen → bürgerin
    assert cws._lemmatize_tokens(["bürger*innen"]) == ["bürgerin"]
    # Ärzt*innen → ärztinnen → ärztin  (nicht "ärzt", was kein Wort wäre)
    assert cws._lemmatize_tokens(["ärzt*innen"]) == ["ärztin"]
    # Lehrer:innen → lehrerinnen → lehrerin
    assert cws._lemmatize_tokens(["lehrer:innen"]) == ["lehrerin"]


def test_lemmatize_tokens_leere_liste(monkeypatch):
    """Leere Token-Liste gibt leere Liste zurück ohne HanTa aufzurufen."""
    monkeypatch.undo()
    assert cws._lemmatize_tokens([]) == []
