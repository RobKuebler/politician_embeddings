"""Smoke tests for src/pipeline.py orchestration.

Covers the two main failure modes identified in code review:
  C1 — export loop crashes on null end_date (active period)
  I4 — training is skipped when votes unchanged but embeddings are missing
"""

import pandas as pd
import pytest

PERIOD = 20


def _polls_df():
    return pd.DataFrame({"poll_id": [101], "topic": ["Test"]})


def _politicians_df():
    return pd.DataFrame(
        {
            "politician_id": [1],
            "name": ["Alice"],
            "party": ["SPD"],
            "occupation": [None],
            "year_of_birth": [1970],
            "field_title": [None],
            "sex": ["f"],
            "education": [None],
        }
    )


def _periods_df(end_date):
    return pd.DataFrame(
        {
            "period_id": [132],
            "label": [f"{PERIOD}. Wahlperiode"],
            "bundestag_number": [PERIOD],
            "start_date": ["2021-10-26"],
            "end_date": [end_date],
        }
    )


def _write_votes(data_dir):
    (data_dir / str(PERIOD) / "votes.csv").write_text(
        "politician_id,poll_id,answer\n1,101,yes\n", encoding="utf-8"
    )


def _write_embeddings(outputs_dir):
    pd.DataFrame(
        {
            "politician_id": [1],
            "name": ["Alice"],
            "party": ["SPD"],
            "x": [0.1],
            "y": [0.2],
        }
    ).to_csv(outputs_dir / f"politician_embeddings_{PERIOD}.csv", index=False)


@pytest.fixture
def env(tmp_path, monkeypatch):
    """Patch filesystem roots and stub out all API / training calls."""
    import src.export as exp
    import src.pipeline as pl

    data_dir = tmp_path / "data"
    outputs_dir = tmp_path / "outputs"
    out_dir = tmp_path / "out"
    (data_dir / str(PERIOD)).mkdir(parents=True)
    outputs_dir.mkdir()
    out_dir.mkdir()

    monkeypatch.setattr(pl, "DATA_DIR", data_dir)
    monkeypatch.setattr(pl, "OUTPUTS_DIR", outputs_dir)
    monkeypatch.setattr(exp, "DATA_DIR", data_dir)
    monkeypatch.setattr(exp, "OUTPUTS_DIR", outputs_dir)
    monkeypatch.setattr(exp, "OUTPUT_DIR", out_dir)

    monkeypatch.setattr(pl, "refresh_periods", lambda: PERIOD)
    monkeypatch.setattr(pl, "refresh_polls", lambda p: _polls_df())
    monkeypatch.setattr(
        pl, "refresh_politicians", lambda p: (_politicians_df(), {100: 1})
    )
    _sidejob_cols = [
        "politician_id",
        "job_title",
        "job_title_extra",
        "organization",
        "income_level",
        "income",
        "interval",
        "created",
        "date_start",
        "date_end",
        "category",
        "topics",
    ]
    monkeypatch.setattr(
        pl, "refresh_sidejobs", lambda p, m: pd.DataFrame(columns=_sidejob_cols)
    )
    monkeypatch.setattr(pl, "find_polls_missing_votes", lambda ids, path: [])
    monkeypatch.setattr(pl, "_train", lambda *a, **k: None)
    monkeypatch.setattr(pl, "write_github_output", lambda **k: None)
    return data_dir, outputs_dir, out_dir


def test_null_end_date_does_not_crash(env, monkeypatch):
    """C1: pipeline must not crash when end_date is None (currently active period)."""
    import src.pipeline as pl

    data_dir, outputs_dir, _ = env
    _write_votes(data_dir)
    _write_embeddings(outputs_dir)

    monkeypatch.setattr(pl, "fetch_periods_df", lambda: _periods_df(None))
    pl.main(["--period", str(PERIOD)])  # must not raise ValueError


def test_missing_embeddings_triggers_training(env, monkeypatch):
    """I4: training must run when embeddings are absent, even if votes are unchanged."""
    import src.pipeline as pl

    data_dir, _outputs_dir, _ = env
    _write_votes(data_dir)
    # Deliberately do NOT write embeddings — emb_path does not exist.

    monkeypatch.setattr(pl, "fetch_periods_df", lambda: _periods_df("2025-10-22"))

    trained = []
    monkeypatch.setattr(pl, "_train", lambda *a, **k: trained.append(True))
    pl.main(["--period", str(PERIOD)])
    assert trained, "Training must run when embeddings file is absent"


def test_training_skipped_when_votes_unchanged_and_embeddings_present(env, monkeypatch):
    """I4 baseline: training is correctly skipped when nothing changed."""
    import src.pipeline as pl

    data_dir, outputs_dir, _ = env
    _write_votes(data_dir)
    _write_embeddings(outputs_dir)

    monkeypatch.setattr(pl, "fetch_periods_df", lambda: _periods_df("2025-10-22"))

    trained = []
    monkeypatch.setattr(pl, "_train", lambda *a, **k: trained.append(True))
    pl.main(["--period", str(PERIOD)])
    assert not trained, (
        "Training must be skipped when votes unchanged and embeddings exist"
    )
