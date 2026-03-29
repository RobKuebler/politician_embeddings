"""Tests for src/export_json.py.

Verifies that export_period produces correctly-shaped JSON output.
Uses synthetic CSV fixtures — no fetched data required.
"""

import json
import textwrap
from datetime import date
from pathlib import Path
from typing import Any

import pytest

PERIOD_ID = 161

_POLITICIANS_CSV = textwrap.dedent("""\
    politician_id,name,party,sex,year_of_birth,occupation,education,field_title
    1,Hans Müller,CDU/CSU,m,1970,Rechtsanwalt,Dr. jur. Rechtswissenschaften,Dr.
    2,Maria Schmidt,SPD,f,1980,Ärztin,Diplom-Medizin,
    3,Klaus Fischer,AfD,m,1965,Lehrer,Staatsexamen Pädagogik,
    4,Anna Weber,CDU/CSU,f,1975,Unternehmerin,Diplom-Wirtschaftswissenschaften,
    5,Peter Braun,SPD,m,1985,Ingenieur,Dipl.-Ing. Ingenieurwissenschaften,
""")

_VOTES_CSV = textwrap.dedent("""\
    politician_id,poll_id,answer
    1,101,yes
    2,101,no
    3,101,yes
    4,102,no
    5,102,yes
""")

_POLLS_CSV = textwrap.dedent("""\
    poll_id,topic
    101,Haushalt
    102,Klimaschutz
""")

_EMBEDDINGS_CSV = textwrap.dedent("""\
    politician_id,x,y
    1,0.1,0.2
    2,0.3,0.4
    3,0.5,0.6
    4,0.2,0.3
    5,0.4,0.5
""")

_SIDEJOBS_CSV = textwrap.dedent("""\
    politician_id,income,income_level,category,date_start,date_end,created,interval,topics
    1,5000,2,29647,2025-01-01,,1640000000,1,Wirtschaft|Recht
    2,10000,3,29228,,,1640000000,2,Gesundheit
""")


@pytest.fixture(autouse=True)
def run_export(tmp_path, monkeypatch):
    """Run export_period with synthetic CSV fixtures into a temp dir."""
    import src.export_json as ej

    # Build input directory structure
    period_dir = tmp_path / "data" / str(PERIOD_ID)
    period_dir.mkdir(parents=True)
    outputs_dir = tmp_path / "outputs"
    outputs_dir.mkdir()
    out_dir = tmp_path / "output"
    out_dir.mkdir()

    (period_dir / "politicians.csv").write_text(_POLITICIANS_CSV, encoding="utf-8")
    (period_dir / "votes.csv").write_text(_VOTES_CSV, encoding="utf-8")
    (period_dir / "polls.csv").write_text(_POLLS_CSV, encoding="utf-8")
    (period_dir / "sidejobs.csv").write_text(_SIDEJOBS_CSV, encoding="utf-8")
    (outputs_dir / f"politician_embeddings_{PERIOD_ID}.csv").write_text(
        _EMBEDDINGS_CSV, encoding="utf-8"
    )

    monkeypatch.setattr(ej, "DATA_DIR", tmp_path / "data")
    monkeypatch.setattr(ej, "OUTPUTS_DIR", outputs_dir)
    monkeypatch.setattr(ej, "OUTPUT_DIR", out_dir)

    ej.export_period(PERIOD_ID, date(2025, 1, 1), date(2029, 12, 31))
    return out_dir


def _load(run_export: Path, name: str) -> Any:
    return json.loads((run_export / name).read_text())


def test_politicians_shape(run_export):
    data = _load(run_export, f"politicians_{PERIOD_ID}.json")
    assert isinstance(data, list)
    assert len(data) > 0
    required = {
        "politician_id",
        "name",
        "party",
        "sex",
        "year_of_birth",
        "occupation",
        "education",
        "field_title",
    }
    assert required.issubset(data[0].keys())


def test_embeddings_shape(run_export):
    data = _load(run_export, f"embeddings_{PERIOD_ID}.json")
    assert data["dimensions"] == 2
    assert len(data["data"]) > 0
    assert {"politician_id", "x", "y"}.issubset(data["data"][0].keys())
    assert "z" not in data["data"][0]


def test_votes_shape(run_export):
    data = _load(run_export, f"votes_{PERIOD_ID}.json")
    assert isinstance(data, list)
    assert len(data) > 0
    assert {"politician_id", "poll_id", "answer"}.issubset(data[0].keys())


def test_polls_shape(run_export):
    data = _load(run_export, f"polls_{PERIOD_ID}.json")
    assert isinstance(data, list)
    assert {"poll_id", "topic"}.issubset(data[0].keys())


def test_cohesion_shape(run_export):
    data = _load(run_export, f"cohesion_{PERIOD_ID}.json")
    assert isinstance(data, list)
    assert len(data) > 0
    assert {"party", "label", "streuung"}.issubset(data[0].keys())
    # fraktionslos must be excluded
    assert all(d["party"] != "fraktionslos" for d in data)


def test_sidejobs_interval_float64_proration(tmp_path, monkeypatch):
    """REGRESSION: interval column is float64 after CSV roundtrip with NaN rows.

    When some rows have interval=null, pandas reads the column as float64,
    making values 1.0 and 2.0 instead of 1 and 2. The old code compared
    str(row["interval"]) == "1" which gives "1.0" == "1" → False, silently
    skipping all proration. This test uses a CSV with a null-interval row
    to trigger the float64 coercion and verifies that proration still fires.
    """
    import src.export_json as ej

    # CSV with one null-interval row → forces pandas to read interval as float64
    csv_content = textwrap.dedent("""\
        politician_id,income,income_level,category,date_start,date_end,created,interval,topics
        1,1000,,29647,2025-01-01,2025-06-30,,1,
        2,12000,,29647,2025-01-01,2025-06-30,,2,
        3,500,,29647,,,1640000000,,
    """)
    pid = 999  # use a different ID to avoid conflict with the autouse fixture
    period_dir = tmp_path / "data" / str(pid)
    period_dir.mkdir(parents=True)
    outputs_dir = tmp_path / "outputs"
    outputs_dir.mkdir(exist_ok=True)
    out_dir = tmp_path / "output"
    out_dir.mkdir(exist_ok=True)

    (period_dir / "politicians.csv").write_text(_POLITICIANS_CSV, encoding="utf-8")
    (period_dir / "votes.csv").write_text(_VOTES_CSV, encoding="utf-8")
    (period_dir / "polls.csv").write_text(_POLLS_CSV, encoding="utf-8")
    (period_dir / "sidejobs.csv").write_text(csv_content, encoding="utf-8")
    (outputs_dir / f"politician_embeddings_{pid}.csv").write_text(
        _EMBEDDINGS_CSV, encoding="utf-8"
    )
    monkeypatch.setattr(ej, "DATA_DIR", tmp_path / "data")
    monkeypatch.setattr(ej, "OUTPUTS_DIR", outputs_dir)
    monkeypatch.setattr(ej, "OUTPUT_DIR", out_dir)

    # Period: Jan-Jun 2025 (6 months). date_start=2025-01-01, date_end=2025-06-30.
    ej.export_period(pid, date(2025, 1, 1), date(2025, 6, 30))

    data = json.loads((out_dir / f"sidejobs_{pid}.json").read_text())
    jobs = {j["politician_id"]: j for j in data["jobs"]}

    # interval=1 (monthly 1000 EUR) active Jan-Jun = 6 months -> 6000 EUR
    assert jobs[1]["prorated_income"] == pytest.approx(6000, rel=0.01), (
        f"Monthly job: expected ~6000 but got {jobs[1]['prorated_income']}. "
        "Likely interval float64 type mismatch ('1.0' != '1')."
    )
    # interval=2 (yearly 12000 EUR) active Jan-Jun = 6 months -> 12000 * 6/12 = 6000 EUR
    assert jobs[2]["prorated_income"] == pytest.approx(6000, rel=0.01), (
        f"Yearly job: expected ~6000 but got {jobs[2]['prorated_income']}. "
        "Likely interval float64 type mismatch ('2.0' != '2')."
    )


def test_sidejobs_shape(run_export):
    data = _load(run_export, f"sidejobs_{PERIOD_ID}.json")
    assert "jobs" in data
    assert "coverage" in data
    assert {"total", "with_amount"}.issubset(data["coverage"].keys())
    assert len(data["jobs"]) > 0, (
        "Expected period 161 to have sidejobs with income amounts"
    )
    job = data["jobs"][0]
    assert {
        "politician_id",
        "party",
        "prorated_income",
        "topics",
        "has_amount",
    }.issubset(job.keys())
    assert isinstance(job["topics"], list)


def test_party_profile_shape(run_export):
    data = _load(run_export, f"party_profile_{PERIOD_ID}.json")
    assert "parties" in data
    assert "age" in data
    assert "sex" in data
    assert "titles" in data
    assert "occupation" in data
    assert "education_field" in data
    assert "education_degree" in data
    for key in ("occupation", "education_field", "education_degree"):
        pivot = data[key]
        assert {"categories", "parties", "pct", "dev"}.issubset(pivot.keys())
        assert len(pivot["pct"]) == len(pivot["categories"])
        assert len(pivot["pct"][0]) == len(pivot["parties"])


# ---------------------------------------------------------------------------
# CSV fixtures for speech export tests
# ---------------------------------------------------------------------------

_WORD_FREQ_CSV = textwrap.dedent("""\
    fraktion,wort,tfidf,rang
    SPD,arbeit,0.000612,1
    SPD,sozial,0.000450,2
    SPD,rente,0.000380,3
    AfD,grenze,0.000700,1
    AfD,migration,0.000600,2
    AfD,sicherheit,0.000500,3
""")

_SPEECH_STATS_CSV = textwrap.dedent("""\
    fraktion,redner_id,vorname,nachname,anzahl_reden,wortanzahl_gesamt
    SPD,1001,Olaf,Scholz,84,94320
    SPD,1002,Rolf,Mützenich,60,71100
    AfD,2001,Alice,Weidel,50,55000
""")


@pytest.fixture
def speech_export(tmp_path, monkeypatch):
    """Set up tmp dirs with speech CSV fixtures and run the two export functions."""
    import src.export_json as ej

    period_dir = tmp_path / str(PERIOD_ID)
    period_dir.mkdir(parents=True)
    (period_dir / "party_word_freq.csv").write_text(_WORD_FREQ_CSV, encoding="utf-8")
    (period_dir / "party_speech_stats.csv").write_text(
        _SPEECH_STATS_CSV, encoding="utf-8"
    )

    out_dir = tmp_path / "out"
    out_dir.mkdir()
    monkeypatch.setattr(ej, "DATA_DIR", tmp_path)
    monkeypatch.setattr(ej, "OUTPUT_DIR", out_dir)

    ej.export_party_word_freq(PERIOD_ID)
    ej.export_party_speech_stats(PERIOD_ID)
    return out_dir


def _load_speech(out_dir, filename):
    return json.loads((out_dir / filename).read_text())


def test_word_freq_structure(speech_export):
    data = _load_speech(speech_export, f"party_word_freq_{PERIOD_ID}.json")
    assert isinstance(data, dict)
    assert set(data.keys()) == {"SPD", "AfD"}
    spd = data["SPD"]
    assert isinstance(spd, list)
    assert len(spd) == 3
    assert {"wort", "tfidf", "rang"}.issubset(spd[0].keys())
    assert spd[0]["wort"] == "arbeit"
    assert spd[0]["rang"] == 1


def test_word_freq_missing_csv_does_not_raise(tmp_path, monkeypatch):
    import src.export_json as ej

    out_dir = tmp_path / "out"
    out_dir.mkdir()
    monkeypatch.setattr(ej, "DATA_DIR", tmp_path)
    monkeypatch.setattr(ej, "OUTPUT_DIR", out_dir)
    # no CSV present — should log warning, not raise
    ej.export_party_word_freq(PERIOD_ID)
    assert not (out_dir / f"party_word_freq_{PERIOD_ID}.json").exists()


def test_speech_stats_structure(speech_export):
    data = _load_speech(speech_export, f"party_speech_stats_{PERIOD_ID}.json")
    assert isinstance(data, list)
    assert len(data) == 3
    required = {
        "fraktion",
        "redner_id",
        "vorname",
        "nachname",
        "anzahl_reden",
        "wortanzahl_gesamt",
    }
    assert required.issubset(data[0].keys())
    # sorted by wortanzahl_gesamt desc within fraktion (as produced by compute_speech_stats)
    spd_rows = [r for r in data if r["fraktion"] == "SPD"]
    assert spd_rows[0]["nachname"] == "Scholz"


def test_speech_stats_missing_csv_does_not_raise(tmp_path, monkeypatch):
    import src.export_json as ej

    out_dir = tmp_path / "out"
    out_dir.mkdir()
    monkeypatch.setattr(ej, "DATA_DIR", tmp_path)
    monkeypatch.setattr(ej, "OUTPUT_DIR", out_dir)
    ej.export_party_speech_stats(PERIOD_ID)
    assert not (out_dir / f"party_speech_stats_{PERIOD_ID}.json").exists()
