"""Tests for src/fetch/protocol_xml.py."""

import subprocess
from pathlib import Path

import pytest

import src.fetch.protocol_xml as fxml


@pytest.fixture(autouse=True)
def set_dummy_dip_api_key(monkeypatch):
    """Keep mocked protocol fetch tests independent from real secrets."""
    monkeypatch.setenv("DIP_API_KEY", "test-key")


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
    herausgeber: str = "BT",
) -> dict:
    """Baut ein minimales Plenarprotokoll-Dokument."""
    return {
        "id": id_,
        "dokumentnummer": f"{period}/{sitzungsnummer}",
        "titel": f"Protokoll der {sitzungsnummer}. Sitzung",
        "datum": datum,
        "wahlperiode": period,
        "herausgeber": herausgeber,
        "fundstelle": {
            "xml_url": f"https://dserver.bundestag.de/btp/{period}/{period}{sitzungsnummer:03d}.xml",
        },
    }


# ---------------------------------------------------------------------------
# _curl_get
# ---------------------------------------------------------------------------


def test_curl_get_gibt_json_zurueck(monkeypatch):
    """_curl_get parst curl-Output als JSON."""

    def fake_run(cmd, **kwargs):
        return subprocess.CompletedProcess(cmd, 0, b'{"numFound": 1}', b"")

    monkeypatch.setattr("subprocess.run", fake_run)
    result = fxml._curl_get("https://example.com", {"foo": "bar"})
    assert result == {"numFound": 1}


def test_curl_get_wirft_bei_curl_fehler(monkeypatch):
    """_curl_get wirft RuntimeError wenn curl exit != 0."""

    def fake_run(cmd, **kwargs):
        return subprocess.CompletedProcess(cmd, 1, b"", b"connection refused")

    monkeypatch.setattr("subprocess.run", fake_run)
    with pytest.raises(RuntimeError, match="curl failed"):
        fxml._curl_get("https://example.com", {})


# ---------------------------------------------------------------------------
# fetch_dip_all (Pagination)
# ---------------------------------------------------------------------------


def test_fetch_dip_all_einzelne_seite(monkeypatch):
    """Einzelne Seite ohne cursor — kein weiterer Request."""
    docs = [_make_doc(str(i), i, "2021-11-01") for i in range(1, 5)]
    call_count = 0

    def fake_curl_get(url, params):
        nonlocal call_count
        call_count += 1
        return _make_page(docs)

    monkeypatch.setattr(fxml, "_curl_get", fake_curl_get)
    result = fxml.fetch_dip_all("plenarprotokoll", {"f.wahlperiode": 20})
    assert len(result) == 4
    assert call_count == 1


def test_fetch_dip_all_mehrere_seiten(monkeypatch):
    """Cursor-Pagination über zwei Seiten."""
    page1_docs = [_make_doc(str(i), i, "2021-11-01") for i in range(1, 101)]
    page2_docs = [_make_doc(str(i), i, "2021-11-02") for i in range(101, 105)]
    responses = [
        _make_page(page1_docs, cursor="CURSOR_PAGE2"),
        _make_page(page2_docs),
    ]
    call_idx = 0

    def fake_curl_get(url, params):
        nonlocal call_idx
        resp = responses[call_idx]
        call_idx += 1
        return resp

    monkeypatch.setattr(fxml, "_curl_get", fake_curl_get)
    result = fxml.fetch_dip_all("plenarprotokoll", {})
    assert len(result) == 104
    assert call_idx == 2


# ---------------------------------------------------------------------------
# _curl_download
# ---------------------------------------------------------------------------


def test_curl_download_schreibt_datei(tmp_path, monkeypatch):
    """_curl_download schreibt den curl-Output in die Zieldatei."""

    def fake_run(cmd, **kwargs):
        out_idx = cmd.index("-o") + 1
        Path(cmd[out_idx]).write_text("<xml/>", encoding="utf-8")
        return subprocess.CompletedProcess(cmd, 0, b"", b"")

    monkeypatch.setattr("subprocess.run", fake_run)
    dest = tmp_path / "001.xml"
    fxml._curl_download("https://example.com/001.xml", dest)
    assert dest.read_text() == "<xml/>"


def test_curl_download_wirft_bei_fehler(tmp_path, monkeypatch):
    """_curl_download wirft RuntimeError wenn curl exit != 0."""

    def fake_run(cmd, **kwargs):
        return subprocess.CompletedProcess(
            cmd, 1, b"", b"curl: (6) Could not resolve host"
        )

    monkeypatch.setattr("subprocess.run", fake_run)
    with pytest.raises(RuntimeError, match="curl failed"):
        fxml._curl_download("https://example.com/001.xml", tmp_path / "x.xml")


# ---------------------------------------------------------------------------
# fetch_protocol_xmls
# ---------------------------------------------------------------------------


def test_erstlauf_laedt_alle(tmp_path, monkeypatch):
    """Erstlauf ohne existierende XMLs: alle werden heruntergeladen."""
    docs = [_make_doc("1", 1, "2021-10-27"), _make_doc("2", 2, "2021-11-10")]
    monkeypatch.setattr(fxml, "fetch_dip_all", lambda *a, **kw: docs)

    downloaded = []

    def fake_download(url, path):
        downloaded.append(url)
        path.write_text("<x/>", encoding="utf-8")

    monkeypatch.setattr(fxml, "_curl_download", fake_download)
    count = fxml.fetch_protocol_xmls(20, tmp_path)

    assert count == 2
    assert (tmp_path / "plenary_protocols" / "001.xml").exists()
    assert (tmp_path / "plenary_protocols" / "002.xml").exists()


def test_upsert_ueberspringt_vorhandene(tmp_path, monkeypatch):
    """Bereits vorhandene XMLs werden nicht erneut heruntergeladen."""
    docs = [_make_doc("1", 1, "2021-10-27"), _make_doc("2", 2, "2021-11-10")]
    monkeypatch.setattr(fxml, "fetch_dip_all", lambda *a, **kw: docs)

    xml_dir = tmp_path / "plenary_protocols"
    xml_dir.mkdir()
    (xml_dir / "001.xml").write_text("<existing/>", encoding="utf-8")

    downloaded = []

    def fake_download(url, path):
        downloaded.append(url)
        path.write_text("<x/>", encoding="utf-8")

    monkeypatch.setattr(fxml, "_curl_download", fake_download)
    count = fxml.fetch_protocol_xmls(20, tmp_path)

    assert count == 1
    assert downloaded == ["https://dserver.bundestag.de/btp/20/20002.xml"]
    assert (xml_dir / "001.xml").read_text() == "<existing/>"


def test_bundesrat_wird_ignoriert(tmp_path, monkeypatch):
    """Dokumente mit herausgeber=BR werden nicht heruntergeladen."""
    docs = [
        _make_doc("1", 1, "2021-10-27"),
        _make_doc("99", 99, "2021-10-27", herausgeber="BR"),
    ]
    monkeypatch.setattr(fxml, "fetch_dip_all", lambda *a, **kw: docs)

    downloaded = []

    def fake_download(url, path):
        downloaded.append(url)
        path.write_text("<x/>", encoding="utf-8")

    monkeypatch.setattr(fxml, "_curl_download", fake_download)
    count = fxml.fetch_protocol_xmls(20, tmp_path)

    assert count == 1
    assert not (tmp_path / "plenary_protocols" / "099.xml").exists()


def test_leere_xml_url_wird_uebersprungen(tmp_path, monkeypatch):
    """Protokoll ohne xml_url wird übersprungen."""
    docs = [
        {**_make_doc("1", 1, "2021-10-27"), "fundstelle": {"xml_url": ""}},
        _make_doc("2", 2, "2021-11-10"),
    ]
    monkeypatch.setattr(fxml, "fetch_dip_all", lambda *a, **kw: docs)

    downloaded = []

    def fake_download(url, path):
        downloaded.append(url)
        path.write_text("<x/>", encoding="utf-8")

    monkeypatch.setattr(fxml, "_curl_download", fake_download)
    count = fxml.fetch_protocol_xmls(20, tmp_path)

    assert count == 1
    assert len(downloaded) == 1
