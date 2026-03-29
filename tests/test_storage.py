import pandas as pd
import pytest

from src import storage


def test_load_data_reads_all_required_csvs(tmp_path, monkeypatch):
    period_dir = tmp_path / "21"
    period_dir.mkdir(parents=True)
    (period_dir / "votes.csv").write_text(
        "politician_id,poll_id,answer\n1,10,yes\n", encoding="utf-8"
    )
    (period_dir / "politicians.csv").write_text(
        "politician_id,name\n1,A\n", encoding="utf-8"
    )
    (period_dir / "polls.csv").write_text("poll_id,topic\n10,Test\n", encoding="utf-8")
    monkeypatch.setattr(storage, "DATA_DIR", tmp_path)

    votes_df, politicians_df, polls_df = storage.load_data(21)

    assert isinstance(votes_df, pd.DataFrame)
    assert isinstance(politicians_df, pd.DataFrame)
    assert isinstance(polls_df, pd.DataFrame)
    assert votes_df.iloc[0]["answer"] == "yes"
    assert politicians_df.iloc[0]["name"] == "A"
    assert polls_df.iloc[0]["topic"] == "Test"


def test_load_data_fails_early_for_missing_required_csvs(tmp_path, monkeypatch):
    period_dir = tmp_path / "21"
    period_dir.mkdir(parents=True)
    (period_dir / "votes.csv").write_text(
        "politician_id,poll_id,answer\n1,10,yes\n", encoding="utf-8"
    )
    monkeypatch.setattr(storage, "DATA_DIR", tmp_path)

    with pytest.raises(SystemExit, match="politicians\\.csv, polls\\.csv"):
        storage.load_data(21)
