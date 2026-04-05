"""Tests for src/export.py.

Verifies that export_period produces correctly-shaped JSON output.
Uses synthetic CSV fixtures — no fetched data required.
"""

import json
import textwrap
from datetime import date
from pathlib import Path
from typing import Any

import pandas as pd
import pytest

WAHLPERIODE = 21

_DF_POLITICIANS = pd.DataFrame(
    {
        "politician_id": [1, 2, 3, 4, 5],
        "name": [
            "Hans Müller",
            "Maria Schmidt",
            "Klaus Fischer",
            "Anna Weber",
            "Peter Braun",
        ],
        "party": ["CDU/CSU", "SPD", "AfD", "CDU/CSU", "SPD"],
        "sex": ["m", "f", "m", "f", "m"],
        "year_of_birth": [1970, 1980, 1965, 1975, 1985],
        "occupation": [
            "Rechtsanwalt",
            "Ärztin",
            "Lehrer",
            "Unternehmerin",
            "Ingenieur",
        ],
        "education": [
            "Dr. jur. Rechtswissenschaften",
            "Diplom-Medizin",
            "Staatsexamen Pädagogik",
            "Diplom-Wirtschaftswissenschaften",
            "Dipl.-Ing. Ingenieurwissenschaften",
        ],
        "field_title": ["Dr.", None, None, None, None],
    }
)

_DF_POLLS = pd.DataFrame(
    {
        "poll_id": [101, 102],
        "topic": ["Haushalt", "Klimaschutz"],
    }
)

_DF_SIDEJOBS = pd.DataFrame(
    {
        "politician_id": [1, 2],
        "income": [5000.0, 10000.0],
        "income_level": [2, 3],
        "category": ["29647", "29228"],
        "date_start": ["2025-01-01", None],
        "date_end": [None, None],
        "created": [1640000000, 1640000000],
        "interval": [1, 2],
        "topics": ["Wirtschaft|Recht", "Gesundheit"],
    }
)

_DF_COMMITTEES = pd.DataFrame(
    {
        "committee_id": [10],
        "label": ["Wirtschaftsausschuss"],
        "topics": ["Wirtschaft"],
    }
)

_DF_MEMBERSHIPS = pd.DataFrame(
    {
        "politician_id": [1],  # Pol 1 has sidejob topic "Wirtschaft|Recht"
        "committee_id": [10],
        "role": ["Mitglied"],
    }
)

_VOTES_CSV = textwrap.dedent("""\
    politician_id,poll_id,answer
    1,101,yes
    2,101,no
    3,101,yes
    4,102,no
    5,102,yes
""")

_EMBEDDINGS_CSV = textwrap.dedent("""\
    politician_id,x,y
    1,0.1,0.2
    2,0.3,0.4
    3,0.5,0.6
    4,0.2,0.3
    5,0.4,0.5
""")


@pytest.fixture(autouse=True)
def run_export(tmp_path, monkeypatch):
    """Run export_period with synthetic CSV fixtures into a temp dir."""
    import src.export as ej

    # Build input directory structure
    period_dir = tmp_path / "data" / str(WAHLPERIODE)
    period_dir.mkdir(parents=True)
    outputs_dir = tmp_path / "outputs"
    outputs_dir.mkdir()
    out_dir = tmp_path / "output"
    out_dir.mkdir()

    (period_dir / "votes.csv").write_text(_VOTES_CSV, encoding="utf-8")
    (outputs_dir / f"politician_embeddings_{WAHLPERIODE}.csv").write_text(
        _EMBEDDINGS_CSV, encoding="utf-8"
    )

    monkeypatch.setattr(ej, "DATA_DIR", tmp_path / "data")
    monkeypatch.setattr(ej, "OUTPUTS_DIR", outputs_dir)
    monkeypatch.setattr(ej, "OUTPUT_DIR", out_dir)

    ej.export_period(
        WAHLPERIODE,
        date(2025, 1, 1),
        date(2029, 12, 31),
        df_politicians=_DF_POLITICIANS,
        df_polls=_DF_POLLS,
        df_sidejobs=_DF_SIDEJOBS,
        df_committees=_DF_COMMITTEES,
        df_memberships=_DF_MEMBERSHIPS,
    )
    return out_dir


def _load(run_export: Path, name: str) -> Any:
    return json.loads((run_export / str(WAHLPERIODE) / name).read_text())


def test_politicians_shape(run_export):
    data = _load(run_export, "politicians.json")
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
    data = _load(run_export, "embeddings.json")
    assert data["dimensions"] == 2
    assert len(data["data"]) > 0
    assert {"politician_id", "x", "y"}.issubset(data["data"][0].keys())
    assert "z" not in data["data"][0]


def test_votes_shape(run_export):
    data = _load(run_export, "votes.json")
    assert isinstance(data, list)
    assert len(data) > 0
    assert {"politician_id", "poll_id", "answer"}.issubset(data[0].keys())


def test_polls_shape(run_export):
    data = _load(run_export, "polls.json")
    assert isinstance(data, list)
    assert {"poll_id", "topic"}.issubset(data[0].keys())


def test_cohesion_shape(run_export):
    data = _load(run_export, "cohesion.json")
    assert isinstance(data, list)
    assert len(data) > 0
    assert {"party", "label", "streuung"}.issubset(data[0].keys())
    # fraktionslos must be excluded
    assert all(d["party"] != "fraktionslos" for d in data)


def test_sidejobs_interval_float64_proration(tmp_path, monkeypatch):
    """REGRESSION: interval column is float64 when NaN rows are present.

    When some rows have interval=NaN, the column dtype is float64,
    making values 1.0 and 2.0 instead of 1 and 2. The old code compared
    str(row["interval"]) == "1" which gives "1.0" == "1" → False, silently
    skipping all proration. Verifies that proration still fires with float64 intervals.
    """
    import src.export as ej

    # Row 3 has no interval → forces the column dtype to float64
    df_sidejobs = pd.DataFrame(
        {
            "politician_id": [1, 2, 3],
            "income": [1000.0, 12000.0, 500.0],
            "income_level": [None, None, None],
            "category": ["29647", "29647", "29647"],
            "date_start": ["2025-01-01", "2025-01-01", None],
            "date_end": ["2025-06-30", "2025-06-30", None],
            "created": [None, None, 1640000000],
            "interval": pd.array([1, 2, None], dtype="Float64"),
            "topics": [None, None, None],
        }
    )
    pid = 999  # use a different ID to avoid conflict with the autouse fixture
    period_dir = tmp_path / "data" / str(pid)
    period_dir.mkdir(parents=True)
    outputs_dir = tmp_path / "outputs"
    outputs_dir.mkdir(exist_ok=True)
    out_dir = tmp_path / "output"
    out_dir.mkdir(exist_ok=True)

    (period_dir / "votes.csv").write_text(_VOTES_CSV, encoding="utf-8")
    (outputs_dir / f"politician_embeddings_{pid}.csv").write_text(
        _EMBEDDINGS_CSV, encoding="utf-8"
    )
    monkeypatch.setattr(ej, "DATA_DIR", tmp_path / "data")
    monkeypatch.setattr(ej, "OUTPUTS_DIR", outputs_dir)
    monkeypatch.setattr(ej, "OUTPUT_DIR", out_dir)

    # Period: Jan-Jun 2025 (6 months). date_start=2025-01-01, date_end=2025-06-30.
    ej.export_period(
        pid,
        date(2025, 1, 1),
        date(2025, 6, 30),
        df_politicians=_DF_POLITICIANS,
        df_polls=_DF_POLLS,
        df_sidejobs=df_sidejobs,
    )

    data = json.loads((out_dir / str(pid) / "sidejobs.json").read_text())
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
    data = _load(run_export, "sidejobs.json")
    assert "jobs" in data
    assert "coverage" in data
    assert {"total", "with_amount"}.issubset(data["coverage"].keys())
    assert len(data["jobs"]) > 0, (
        "Expected period 21 to have sidejobs with income amounts"
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
    data = _load(run_export, "party_profile.json")
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
    import src.export as ej

    period_dir = tmp_path / str(WAHLPERIODE)
    period_dir.mkdir(parents=True)
    (period_dir / "party_word_freq.csv").write_text(_WORD_FREQ_CSV, encoding="utf-8")
    (period_dir / "party_speech_stats.csv").write_text(
        _SPEECH_STATS_CSV, encoding="utf-8"
    )

    out_dir = tmp_path / "out"
    out_dir.mkdir()
    monkeypatch.setattr(ej, "DATA_DIR", tmp_path)
    monkeypatch.setattr(ej, "OUTPUT_DIR", out_dir)

    ej.export_party_word_freq(WAHLPERIODE)
    ej.export_party_speech_stats(WAHLPERIODE)
    return out_dir


def _load_speech(out_dir, filename):
    return json.loads((out_dir / str(WAHLPERIODE) / filename).read_text())


def test_word_freq_structure(speech_export):
    data = _load_speech(speech_export, "party_word_freq.json")
    assert isinstance(data, dict)
    assert set(data.keys()) == {"SPD", "AfD"}
    spd = data["SPD"]
    assert isinstance(spd, list)
    assert len(spd) == 3
    assert {"wort", "tfidf", "rang"}.issubset(spd[0].keys())
    assert spd[0]["wort"] == "arbeit"
    assert spd[0]["rang"] == 1


def test_word_freq_missing_csv_does_not_raise(tmp_path, monkeypatch):
    import src.export as ej

    out_dir = tmp_path / "out"
    out_dir.mkdir()
    monkeypatch.setattr(ej, "DATA_DIR", tmp_path)
    monkeypatch.setattr(ej, "OUTPUT_DIR", out_dir)
    # no CSV present — should log warning, not raise
    ej.export_party_word_freq(WAHLPERIODE)
    assert not (out_dir / str(WAHLPERIODE) / "party_word_freq.json").exists()


def test_speech_stats_structure(speech_export):
    data = _load_speech(speech_export, "party_speech_stats.json")
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
    import src.export as ej

    out_dir = tmp_path / "out"
    out_dir.mkdir()
    monkeypatch.setattr(ej, "DATA_DIR", tmp_path)
    monkeypatch.setattr(ej, "OUTPUT_DIR", out_dir)
    ej.export_party_speech_stats(WAHLPERIODE)
    assert not (out_dir / str(WAHLPERIODE) / "party_speech_stats.json").exists()


def test_conflicts_shape(run_export):
    data = _load(run_export, "conflicts.json")
    assert "stats" in data
    assert "conflicts" in data
    assert isinstance(data["conflicts"], list)
    s = data["stats"]
    assert "total_income" in s
    assert "affected_politicians" in s
    assert "affected_committees" in s
    # Pol 1 (Wirtschaft|Recht sidejob) is in Wirtschaftsausschuss → conflict
    assert s["affected_politicians"] >= 1
    if data["conflicts"]:
        entry = data["conflicts"][0]
        assert "politician_id" in entry
        assert "party" in entry
        assert "committee_label" in entry
        assert "matching_topics" in entry
        assert "conflicted_income" in entry


def test_main_can_limit_export_to_one_period(tmp_path, monkeypatch):
    import src.export as ej

    data_dir = tmp_path / "data"
    outputs_dir = tmp_path / "outputs"
    out_dir = tmp_path / "frontend" / "public" / "data"
    outputs_dir.mkdir(exist_ok=True)
    out_dir.mkdir(parents=True, exist_ok=True)

    periods_csv = textwrap.dedent("""\
        period_id,label,bundestag_number,start_date,end_date
        132,20. Wahlperiode,20,2021-10-26,2025-10-22
        161,21. Wahlperiode,21,2025-10-23,2029-10-22
    """)
    (data_dir / "periods.csv").parent.mkdir(parents=True, exist_ok=True)
    (data_dir / "periods.csv").write_text(periods_csv, encoding="utf-8")

    for period in (20, 21):
        period_dir = data_dir / str(period)
        period_dir.mkdir(parents=True, exist_ok=True)
        (period_dir / "votes.csv").write_text(_VOTES_CSV, encoding="utf-8")
        (period_dir / "party_word_freq.csv").write_text(
            _WORD_FREQ_CSV, encoding="utf-8"
        )
        (period_dir / "party_speech_stats.csv").write_text(
            _SPEECH_STATS_CSV, encoding="utf-8"
        )

    monkeypatch.setattr(ej, "DATA_DIR", data_dir)
    monkeypatch.setattr(ej, "OUTPUTS_DIR", outputs_dir)
    monkeypatch.setattr(ej, "OUTPUT_DIR", out_dir)

    ej.main(["--period", "21"])

    # Only WP 21 should get its word_freq exported; WP 20 is skipped by --period filter
    assert not (out_dir / "20" / "party_word_freq.json").exists()
    assert (out_dir / "21" / "party_word_freq.json").exists()

    periods = json.loads((out_dir / "periods.json").read_text(encoding="utf-8"))
    assert {row["wahlperiode"] for row in periods} == {20, 21}
