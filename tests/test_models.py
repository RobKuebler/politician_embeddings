import numpy as np
import pandas as pd
import pytest
import torch

from src.models import (
    PoliticianEmbeddingModel,
    RelativeEarlyStopping,
    VoteDataset,
    prepare_votes,
    save_embeddings,
)

# ─── Helpers ───────────────────────────────────────────────────────────────────


def make_votes(rows: list[tuple]) -> pd.DataFrame:
    return pd.DataFrame(rows, columns=["politician_id", "poll_id", "answer"])


def make_p_df(ids: list) -> pd.DataFrame:
    return pd.DataFrame({"politician_id": ids})


def make_poll_df(ids: list) -> pd.DataFrame:
    return pd.DataFrame({"poll_id": ids})


# ─── VoteDataset ───────────────────────────────────────────────────────────────


def test_vote_dataset_length():
    df = pd.DataFrame(
        {"p_idx": [0, 1, 2], "poll_idx": [0, 1, 0], "rating": [1.0, 0.0, 1.0]}
    )
    assert len(VoteDataset(df)) == 3


def test_vote_dataset_dtypes():
    df = pd.DataFrame({"p_idx": [0], "poll_idx": [1], "rating": [1.0]})
    p, poll, y = VoteDataset(df)[0]
    assert p.dtype == torch.long
    assert poll.dtype == torch.long
    assert y.dtype == torch.float


# ─── prepare_votes ─────────────────────────────────────────────────────────────


def test_prepare_votes_filters_non_binary():
    """abstain and no_show rows are dropped; yes and no are kept."""
    df = make_votes(
        [(1, 10, "yes"), (1, 11, "no"), (1, 12, "abstain"), (1, 13, "no_show")]
    )
    result, _, _ = prepare_votes(df, make_p_df([1]), make_poll_df([10, 11, 12, 13]))
    assert set(result["answer"]) == {"yes", "no"}
    assert len(result) == 2


def test_prepare_votes_ratings():
    """yes -> 1.0, no -> 0.0."""
    df = make_votes([(1, 10, "yes"), (2, 10, "no")])
    result, _, _ = prepare_votes(df, make_p_df([1, 2]), make_poll_df([10]))
    assert result.loc[result["answer"] == "yes", "rating"].iloc[0] == 1.0
    assert result.loc[result["answer"] == "no", "rating"].iloc[0] == 0.0


def test_prepare_votes_indices_in_range():
    """p_idx and poll_idx are valid array indices."""
    df = make_votes([(1, 10, "yes"), (2, 11, "no")])
    p_df = make_p_df([1, 2])
    poll_df = make_poll_df([10, 11])
    result, p_ids, poll_ids = prepare_votes(df, p_df, poll_df)
    assert result["p_idx"].between(0, len(p_ids) - 1).all()
    assert result["poll_idx"].between(0, len(poll_ids) - 1).all()


def test_prepare_votes_filters_unknown_politicians():
    """Votes for politicians not in p_df are dropped."""
    df = make_votes([(1, 10, "yes"), (99, 10, "no")])
    result, _, _ = prepare_votes(df, make_p_df([1]), make_poll_df([10]))
    assert len(result) == 1
    assert result.iloc[0]["politician_id"] == 1


def test_prepare_votes_filters_unknown_polls():
    """Votes for polls not in poll_df are dropped."""
    df = make_votes([(1, 10, "yes"), (1, 99, "yes")])
    result, _, _ = prepare_votes(df, make_p_df([1]), make_poll_df([10]))
    assert len(result) == 1
    assert result.iloc[0]["poll_id"] == 10


def test_prepare_votes_empty_result():
    """All non-binary votes -> empty DataFrame."""
    df = make_votes([(1, 10, "abstain")])
    result, _, _ = prepare_votes(df, make_p_df([1]), make_poll_df([10]))
    assert result.empty


# ─── PoliticianEmbeddingModel ──────────────────────────────────────────────────


def test_model_forward_output_shape():
    model = PoliticianEmbeddingModel(n_politicians=5, n_polls=3, n_factors=2, lr=0.01)
    p = torch.tensor([0, 1, 2])
    poll = torch.tensor([0, 1, 2])
    out = model(p, poll)
    assert out.shape == (3,)


def test_model_forward_output_is_finite():
    model = PoliticianEmbeddingModel(n_politicians=4, n_polls=4, n_factors=2, lr=0.01)
    p = torch.tensor([0, 1])
    poll = torch.tensor([2, 3])
    out = model(p, poll)
    assert torch.isfinite(out).all()


# ─── RelativeEarlyStopping ────────────────────────────────────────────────────


class _FakeTrainer:
    """Minimal Trainer stub for testing the callback."""

    def __init__(self, loss: float) -> None:
        self.callback_metrics = {"train_loss": torch.tensor(loss)}
        self.should_stop = False


class _FakeModule:
    pass


def test_early_stopping_stops_below_threshold():
    """Loss improves only 3%, threshold 5% -> should stop."""
    cb = RelativeEarlyStopping(min_rel=0.05)
    cb._prev = 1.0  # noqa: SLF001
    trainer = _FakeTrainer(0.97)
    cb.on_train_epoch_end(trainer, _FakeModule())  # type: ignore[arg-type]
    assert trainer.should_stop is True


def test_early_stopping_continues_above_threshold():
    """Loss improves 10%, threshold 5% -> should continue."""
    cb = RelativeEarlyStopping(min_rel=0.05)
    cb._prev = 1.0  # noqa: SLF001
    trainer = _FakeTrainer(0.90)
    cb.on_train_epoch_end(trainer, _FakeModule())  # type: ignore[arg-type]
    assert trainer.should_stop is False


def test_early_stopping_first_epoch_never_stops():
    """First epoch: _prev=inf, any finite loss -> (inf-curr)/inf = 1.0 >= threshold."""
    cb = RelativeEarlyStopping(min_rel=0.05)
    trainer = _FakeTrainer(1.0)
    cb.on_train_epoch_end(trainer, _FakeModule())  # type: ignore[arg-type]
    assert trainer.should_stop is False


def test_early_stopping_updates_prev():
    cb = RelativeEarlyStopping(min_rel=0.05)
    cb._prev = 1.0  # noqa: SLF001
    trainer = _FakeTrainer(0.90)
    cb.on_train_epoch_end(trainer, _FakeModule())  # type: ignore[arg-type]
    assert cb._prev == pytest.approx(0.90)  # noqa: SLF001


def test_early_stopping_missing_metric():
    """No 'train_loss' in metrics -> do nothing, no crash."""
    cb = RelativeEarlyStopping(min_rel=0.05)
    trainer = _FakeTrainer(0.5)
    trainer.callback_metrics = {}
    cb.on_train_epoch_end(trainer, _FakeModule())  # type: ignore[arg-type]
    assert trainer.should_stop is False


# ─── save_embeddings ──────────────────────────────────────────────────────────


def test_save_embeddings_2d(tmp_path, monkeypatch):
    """2D model produces CSV with x and y columns, no z."""
    import src.models as m

    monkeypatch.setattr(m, "OUTPUTS_DIR", tmp_path)

    model = PoliticianEmbeddingModel(n_politicians=3, n_polls=2, n_factors=2, lr=0.01)
    p_df = pd.DataFrame(
        {
            "politician_id": [10, 20, 30],
            "name": ["A", "B", "C"],
            "party": ["P1", "P1", "P2"],
        }
    )

    save_embeddings(model, p_df, np.array([10, 20, 30]), period_id=999)

    df = pd.read_csv(tmp_path / "politician_embeddings_999.csv")
    assert {"politician_id", "name", "party", "x", "y"} <= set(df.columns)
    assert "z" not in df.columns
    assert len(df) == 3


def test_save_embeddings_3d(tmp_path, monkeypatch):
    """3D model produces CSV with z column."""
    import src.models as m

    monkeypatch.setattr(m, "OUTPUTS_DIR", tmp_path)

    model = PoliticianEmbeddingModel(n_politicians=2, n_polls=2, n_factors=3, lr=0.01)
    p_df = pd.DataFrame(
        {"politician_id": [1, 2], "name": ["A", "B"], "party": ["X", "Y"]}
    )

    save_embeddings(model, p_df, np.array([1, 2]), period_id=1)

    df = pd.read_csv(tmp_path / "politician_embeddings_1.csv")
    assert "z" in df.columns
