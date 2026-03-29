"""Tests for src/fetch/protocols.py."""

import pandas as pd

import src.fetch.protocols as fp

# ---------------------------------------------------------------------------
# Hilfsfunktionen
# ---------------------------------------------------------------------------


def _make_page(docs: list, cursor: str | None = None) -> dict:
    """Baut eine gefälschte DIP-API-Antwort."""
    result: dict = {"numFound": len(docs), "documents": docs}
    if cursor:
        result["cursor"] = cursor
    return result


def _make_doc(
    id_: str,
    sitzungsnummer: int,
    datum: str,
    period: int = 20,
    sitzungsbemerkung: str = "",
    vorgangsbezug_anzahl: int = 0,
) -> dict:
    """Baut ein minimales Plenarprotokoll-Dokument."""
    return {
        "id": id_,
        "dokumentnummer": f"{period}/{sitzungsnummer}",
        "titel": f"Protokoll der {sitzungsnummer}. Sitzung des {period}. Deutschen Bundestages",
        "datum": datum,
        "wahlperiode": period,
        "herausgeber": "BT",
        "sitzungsbemerkung": sitzungsbemerkung,
        "vorgangsbezug_anzahl": vorgangsbezug_anzahl,
        "pdf_hash": "abc123",
        "xml_hash": "def456",
        "aktualisiert": "2025-01-02T10:00:00+01:00",
        "fundstelle": {
            "pdf_url": f"https://dserver.bundestag.de/btp/{period}/{period}{sitzungsnummer:03d}.pdf",
            "xml_url": f"https://dserver.bundestag.de/btp/{period}/{period}{sitzungsnummer:03d}.xml",
        },
    }


# ---------------------------------------------------------------------------
# _doc_to_row
# ---------------------------------------------------------------------------


def test_doc_to_row_vollstaendig():
    doc = _make_doc(
        "42", 7, "2021-11-03", sitzungsbemerkung="Sondersitzung", vorgangsbezug_anzahl=5
    )
    row = fp._doc_to_row(doc)
    assert row["id"] == 42
    assert row["dokumentnummer"] == "20/7"
    assert row["sitzungsnummer"] == 7
    assert row["datum"] == "2021-11-03"
    assert row["sitzungsbemerkung"] == "Sondersitzung"
    assert row["pdf_url"] == "https://dserver.bundestag.de/btp/20/20007.pdf"
    assert row["xml_url"] == "https://dserver.bundestag.de/btp/20/20007.xml"
    assert row["vorgangsbezug_anzahl"] == 5
    assert row["pdf_hash"] == "abc123"


def test_doc_to_row_fehlende_felder():
    """Fehlende optionale Felder werden als Leerstring / 0 zurückgegeben."""
    doc = {
        "id": "1",
        "dokumentnummer": "20/1",
        "titel": "Protokoll",
        "datum": "2021-10-27",
        "wahlperiode": 20,
        "herausgeber": "BT",
        "vorgangsbezug_anzahl": 0,
        "pdf_hash": "",
        "aktualisiert": "2021-10-27T00:00:00+01:00",
        "fundstelle": {},
    }
    row = fp._doc_to_row(doc)
    assert row["sitzungsbemerkung"] == ""
    assert row["pdf_url"] == ""
    assert row["xml_url"] == ""


# ---------------------------------------------------------------------------
# fetch_dip_all (Pagination)
# ---------------------------------------------------------------------------


def test_fetch_dip_all_einzelne_seite(monkeypatch):
    """Einzelne Seite ohne cursor — kein weiterer Request."""
    docs = [_make_doc(str(i), i, "2021-11-01") for i in range(1, 5)]
    responses = [_make_page(docs)]  # kein cursor → fertig

    call_count = 0

    def fake_curl_get(url, params):
        nonlocal call_count
        call_count += 1
        return responses[call_count - 1]

    monkeypatch.setattr(fp, "_curl_get", fake_curl_get)
    result = fp.fetch_dip_all("plenarprotokoll", {"f.wahlperiode": 20})
    assert len(result) == 4
    assert call_count == 1


def test_fetch_dip_all_mehrere_seiten(monkeypatch):
    """Cursor-Pagination über zwei Seiten."""
    page1_docs = [_make_doc(str(i), i, "2021-11-01") for i in range(1, 101)]
    page2_docs = [_make_doc(str(i), i, "2021-11-02") for i in range(101, 105)]
    responses = [
        _make_page(page1_docs, cursor="CURSOR_PAGE2"),
        _make_page(page2_docs),  # kein cursor → letzte Seite
    ]
    call_idx = 0

    def fake_curl_get(url, params):
        nonlocal call_idx
        resp = responses[call_idx]
        call_idx += 1
        return resp

    monkeypatch.setattr(fp, "_curl_get", fake_curl_get)
    result = fp.fetch_dip_all("plenarprotokoll", {})
    assert len(result) == 104
    assert call_idx == 2


# ---------------------------------------------------------------------------
# fetch_dip_protocols — initial run (no existing CSV)
# ---------------------------------------------------------------------------


def test_erstlauf_ohne_csv(monkeypatch, tmp_path):
    """Erstlauf: alle Dokumente werden gespeichert."""
    docs = [
        _make_doc("1", 1, "2021-10-27"),
        _make_doc("2", 2, "2021-11-10"),
        _make_doc("3", 3, "2021-11-11"),
    ]

    monkeypatch.setattr(fp, "_curl_get", lambda url, p: _make_page(docs))

    df = fp.fetch_dip_protocols(20, tmp_path)
    assert len(df) == 3
    assert set(df["id"]) == {1, 2, 3}

    csv_path = tmp_path / "dip_plenary_protocols.csv"
    assert csv_path.exists()
    loaded = pd.read_csv(csv_path)
    assert len(loaded) == 3


# ---------------------------------------------------------------------------
# fetch_dip_protocols — upsert (existing data)
# ---------------------------------------------------------------------------


def test_upsert_fuegt_nur_neue_hinzu(monkeypatch, tmp_path):
    """Zweiter Lauf: nur neue IDs werden angehängt."""
    # Bestehende CSV mit Protokoll 1 und 2
    existing = pd.DataFrame(
        [
            fp._doc_to_row(_make_doc("1", 1, "2021-10-27")),
            fp._doc_to_row(_make_doc("2", 2, "2021-11-10")),
        ]
    )
    csv_path = tmp_path / "dip_plenary_protocols.csv"
    existing.to_csv(csv_path, index=False)

    # API gibt 1, 2 und das neue 3 zurück
    docs = [
        _make_doc("1", 1, "2021-10-27"),
        _make_doc("2", 2, "2021-11-10"),
        _make_doc("3", 3, "2021-11-11"),
    ]

    called_with_datum_start = []

    def fake_curl_get(url, params):
        called_with_datum_start.append(params.get("f.datum.start"))
        return _make_page(docs)

    monkeypatch.setattr(fp, "_curl_get", fake_curl_get)
    df = fp.fetch_dip_protocols(20, tmp_path)

    # Nur Protokoll 3 neu
    assert len(df) == 1
    assert df.iloc[0]["id"] == 3

    # CSV enthält jetzt 3 Einträge
    loaded = pd.read_csv(csv_path)
    assert len(loaded) == 3

    # f.datum.start wurde auf letztes bekanntes Datum gesetzt
    assert called_with_datum_start[0] == "2021-11-10"


def test_upsert_keine_aenderung_wenn_nichts_neues(monkeypatch, tmp_path):
    """Wenn API keine neuen IDs liefert, bleibt CSV unverändert."""
    docs = [_make_doc("1", 1, "2021-10-27")]
    existing = pd.DataFrame([fp._doc_to_row(docs[0])])
    csv_path = tmp_path / "dip_plenary_protocols.csv"
    existing.to_csv(csv_path, index=False)

    monkeypatch.setattr(fp, "_curl_get", lambda url, p: _make_page(docs))
    df = fp.fetch_dip_protocols(20, tmp_path)

    assert len(df) == 0
    loaded = pd.read_csv(csv_path)
    assert len(loaded) == 1


# ---------------------------------------------------------------------------
# --limit Parameter
# ---------------------------------------------------------------------------


def test_limit_begrenzt_neue_eintraege(monkeypatch, tmp_path):
    """limit=2 speichert nur die 2 ältesten neuen Protokolle."""
    docs = [
        _make_doc("1", 1, "2021-10-27"),
        _make_doc("2", 2, "2021-11-10"),
        _make_doc("3", 3, "2021-11-11"),
    ]

    monkeypatch.setattr(fp, "_curl_get", lambda url, p: _make_page(docs))
    df = fp.fetch_dip_protocols(20, tmp_path, limit=2)

    assert len(df) == 2
    # Älteste zuerst (aufsteigend nach datum)
    assert list(df["sitzungsnummer"]) == [1, 2]

    loaded = pd.read_csv(tmp_path / "dip_plenary_protocols.csv")
    assert len(loaded) == 2


# ---------------------------------------------------------------------------
# Bundesrat-Protokolle werden herausgefiltert
# ---------------------------------------------------------------------------


def test_bundesrat_wird_ignoriert(monkeypatch, tmp_path):
    """Dokumente mit herausgeber=BR werden nicht gespeichert."""
    docs = [
        _make_doc("1", 1, "2021-10-27"),
        {**_make_doc("99", 99, "2021-10-27"), "herausgeber": "BR"},
    ]

    monkeypatch.setattr(fp, "_curl_get", lambda url, p: _make_page(docs))
    df = fp.fetch_dip_protocols(20, tmp_path)

    assert len(df) == 1
    assert df.iloc[0]["id"] == 1
