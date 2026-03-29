"""Tests for src/fetch/protocol_xml.py."""

from pathlib import Path

import pandas as pd
import pytest

import src.fetch.protocol_xml as fxml


def _make_csv(tmp_path: Path, rows: list[dict]) -> Path:
    """Writes a minimal dip_plenary_protocols.csv."""
    df = pd.DataFrame(rows)
    p = tmp_path / "dip_plenary_protocols.csv"
    df.to_csv(p, index=False)
    return p


# ---------------------------------------------------------------------------
# _curl_download
# ---------------------------------------------------------------------------


def test_curl_download_schreibt_datei(tmp_path, monkeypatch):
    """_curl_download schreibt den curl-Output in die Zieldatei."""
    import subprocess

    def fake_run(cmd, **kwargs):
        # Simuliert curl -o path url: schreibt "<xml/>" in die Datei
        out_idx = cmd.index("-o") + 1
        Path(cmd[out_idx]).write_text("<xml/>", encoding="utf-8")
        return subprocess.CompletedProcess(cmd, 0, b"", b"")

    monkeypatch.setattr("subprocess.run", fake_run)
    dest = tmp_path / "001.xml"
    fxml._curl_download("https://example.com/001.xml", dest)
    assert dest.read_text() == "<xml/>"


def test_curl_download_wirft_bei_fehler(tmp_path, monkeypatch):
    """_curl_download wirft RuntimeError wenn curl exit != 0."""
    import subprocess

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
    _make_csv(
        tmp_path,
        [
            {"sitzungsnummer": 1, "xml_url": "https://example.com/001.xml"},
            {"sitzungsnummer": 2, "xml_url": "https://example.com/002.xml"},
        ],
    )

    downloaded = []

    def fake_download(url, path):
        downloaded.append(url)
        path.write_text("<x/>", encoding="utf-8")

    monkeypatch.setattr(fxml, "_curl_download", fake_download)
    count = fxml.fetch_protocol_xmls(20, tmp_path)

    assert count == 2
    assert set(downloaded) == {
        "https://example.com/001.xml",
        "https://example.com/002.xml",
    }
    assert (tmp_path / "plenary_protocols" / "001.xml").exists()
    assert (tmp_path / "plenary_protocols" / "002.xml").exists()


def test_upsert_ueberspringt_vorhandene(tmp_path, monkeypatch):
    """Bereits vorhandene XMLs werden nicht erneut heruntergeladen."""
    _make_csv(
        tmp_path,
        [
            {"sitzungsnummer": 1, "xml_url": "https://example.com/001.xml"},
            {"sitzungsnummer": 2, "xml_url": "https://example.com/002.xml"},
        ],
    )
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
    assert downloaded == ["https://example.com/002.xml"]
    # Bestehende Datei unverändert
    assert (xml_dir / "001.xml").read_text() == "<existing/>"


def test_kein_csv_wirft_systemexit(tmp_path):
    """Missing dip_plenary_protocols.csv -> SystemExit."""
    with pytest.raises(SystemExit):
        fxml.fetch_protocol_xmls(20, tmp_path)


def test_leere_xml_url_wird_uebersprungen(tmp_path, monkeypatch):
    """Protocol without xml_url is skipped."""
    _make_csv(
        tmp_path,
        [
            {"sitzungsnummer": 1, "xml_url": ""},
            {"sitzungsnummer": 2, "xml_url": "https://example.com/002.xml"},
        ],
    )

    downloaded = []

    def fake_download(url, path):
        downloaded.append(url)
        path.write_text("<x/>", encoding="utf-8")

    monkeypatch.setattr(fxml, "_curl_download", fake_download)
    count = fxml.fetch_protocol_xmls(20, tmp_path)

    assert count == 1
    assert len(downloaded) == 1
