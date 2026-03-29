"""Tests für src/parse_protokolle.py."""

from pathlib import Path

import pandas as pd
import pytest

import src.parse_protokolle as pp

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

MINIMAL_XML = """\
<?xml version="1.0" encoding="utf-8"?>
<dbtplenarprotokoll wahlperiode="20" sitzung-nr="3">
  <sitzungsverlauf>
    <rede id="ID001">
      <p klasse="redner"><redner id="R001"><name>
        <vorname>Anna</vorname><nachname>Mueller</nachname>
        <fraktion>SPD</fraktion></name></redner>Anna Mueller (SPD):</p>
      <p klasse="J_1">Klimawandel bedroht unsere Zukunft wirklich sehr.</p>
      <p klasse="J">Wir muessen jetzt handeln und investieren.</p>
      <p klasse="kommentar">(Beifall bei der SPD)</p>
    </rede>
    <rede id="ID002">
      <p klasse="redner"><redner id="R002"><name>
        <vorname>Bernd</vorname><nachname>Schmidt</nachname>
        <fraktion>AfD</fraktion></name></redner>Bernd Schmidt (AfD):</p>
      <p klasse="J_1">Grenzsicherheit muss oberste Prioritaet haben.</p>
    </rede>
    <rede id="ID003">
      <p klasse="redner"><redner id="R003"><name>
        <vorname>Klaus</vorname><nachname>Weber</nachname>
        </name></redner>Klaus Weber:</p>
      <p klasse="J_1">Kurz.</p>
    </rede>
  </sitzungsverlauf>
</dbtplenarprotokoll>"""


@pytest.fixture
def xml_file(tmp_path) -> Path:
    p = tmp_path / "003.xml"
    p.write_text(MINIMAL_XML, encoding="utf-8")
    return p


# ---------------------------------------------------------------------------
# parse_sitzung
# ---------------------------------------------------------------------------


def test_parse_sitzung_liefert_korrekte_anzahl(xml_file):
    rows = pp.parse_sitzung(xml_file)
    assert len(rows) == 3


def test_parse_sitzung_redner_felder(xml_file):
    rows = pp.parse_sitzung(xml_file)
    anna = next(r for r in rows if r["nachname"] == "Mueller")
    assert anna["vorname"] == "Anna"
    assert anna["fraktion"] == "SPD"
    assert anna["rede_id"] == "ID001"
    assert anna["redner_id"] == "R001"
    assert anna["sitzungsnummer"] == 3


def test_parse_sitzung_kommentar_ignoriert(xml_file):
    """(Beifall...) erscheint nicht im Text."""
    rows = pp.parse_sitzung(xml_file)
    anna = next(r for r in rows if r["nachname"] == "Mueller")
    assert "Beifall" not in anna["text"]


def test_parse_sitzung_redetext_vollstaendig(xml_file):
    rows = pp.parse_sitzung(xml_file)
    anna = next(r for r in rows if r["nachname"] == "Mueller")
    assert "Klimawandel" in anna["text"]
    assert "handeln" in anna["text"]


def test_parse_sitzung_wortanzahl(xml_file):
    rows = pp.parse_sitzung(xml_file)
    anna = next(r for r in rows if r["nachname"] == "Mueller")
    # "Klimawandel bedroht unsere Zukunft wirklich sehr." = 6 Wörter
    # "Wir muessen jetzt handeln und investieren." = 6 Wörter → 12 gesamt
    assert anna["wortanzahl"] == 12


def test_parse_sitzung_fehlende_fraktion_ist_fraktionslos(xml_file):
    """Kein <fraktion>-Tag → 'fraktionslos'."""
    rows = pp.parse_sitzung(xml_file)
    weber = next(r for r in rows if r["nachname"] == "Weber")
    assert weber["fraktion"] == "fraktionslos"


# ---------------------------------------------------------------------------
# parse_alle_sitzungen
# ---------------------------------------------------------------------------


def test_parse_alle_sitzungen_kombiniert(tmp_path):
    """Mehrere XMLs werden kombiniert in speeches.csv geschrieben."""
    xml_dir = tmp_path / "plenarprotokolle"
    xml_dir.mkdir()
    for nr in [1, 2]:
        xml = MINIMAL_XML.replace('sitzung-nr="3"', f'sitzung-nr="{nr}"')
        (xml_dir / f"{nr:03d}.xml").write_text(xml, encoding="utf-8")

    df = pp.parse_alle_sitzungen(tmp_path)
    assert len(df) == 6  # 3 Reden x 2 Sitzungen

    csv_path = tmp_path / "speeches.csv"
    assert csv_path.exists()
    loaded = pd.read_csv(csv_path)
    assert len(loaded) == 6
    assert set(loaded.columns) == {
        "sitzungsnummer",
        "rede_id",
        "redner_id",
        "vorname",
        "nachname",
        "fraktion",
        "wortanzahl",
        "text",
    }


def test_parse_sitzung_rede_ohne_redner_wird_ignoriert(tmp_path):
    """<rede> ohne <redner>-Element wird übersprungen."""
    xml = """\
<?xml version="1.0" encoding="utf-8"?>
<dbtplenarprotokoll wahlperiode="20" sitzung-nr="1">
  <sitzungsverlauf>
    <rede id="ID_NO_SPEAKER">
      <p klasse="J_1">Text ohne Redner.</p>
    </rede>
    <rede id="ID001">
      <p klasse="redner"><redner id="R001"><name>
        <vorname>Anna</vorname><nachname>Mueller</nachname>
        <fraktion>SPD</fraktion></name></redner>Anna Mueller (SPD):</p>
      <p klasse="J_1">Klimawandel ist wichtig.</p>
    </rede>
  </sitzungsverlauf>
</dbtplenarprotokoll>"""
    p = tmp_path / "001.xml"
    p.write_text(xml, encoding="utf-8")
    rows = pp.parse_sitzung(p)
    assert len(rows) == 1
    assert rows[0]["rede_id"] == "ID001"


def test_parse_sitzung_rede_ohne_redetext_wird_ignoriert(tmp_path):
    """<rede> mit nur kommentar-Paragraphen (wortanzahl=0) wird übersprungen."""
    xml = """\
<?xml version="1.0" encoding="utf-8"?>
<dbtplenarprotokoll wahlperiode="20" sitzung-nr="1">
  <sitzungsverlauf>
    <rede id="ID001">
      <p klasse="redner"><redner id="R001"><name>
        <vorname>Anna</vorname><nachname>Mueller</nachname>
        <fraktion>SPD</fraktion></name></redner>Anna Mueller (SPD):</p>
      <p klasse="kommentar">(Beifall bei der SPD)</p>
    </rede>
  </sitzungsverlauf>
</dbtplenarprotokoll>"""
    p = tmp_path / "001.xml"
    p.write_text(xml, encoding="utf-8")
    rows = pp.parse_sitzung(p)
    assert len(rows) == 0


def test_parse_alle_sitzungen_leeres_verzeichnis(tmp_path):
    """Leeres plenarprotokolle/-Verzeichnis → leerer DataFrame."""
    xml_dir = tmp_path / "plenarprotokolle"
    xml_dir.mkdir()
    df = pp.parse_alle_sitzungen(tmp_path)
    assert len(df) == 0
    assert set(df.columns) == {
        "sitzungsnummer",
        "rede_id",
        "redner_id",
        "vorname",
        "nachname",
        "fraktion",
        "wortanzahl",
        "text",
    }
