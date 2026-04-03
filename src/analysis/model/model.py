import logging

import lightning as L
import numpy as np
import pandas as pd
import torch
from torch import nn
from torch.utils.data import DataLoader, Dataset

from ...paths import OUTPUTS_DIR

log = logging.getLogger(__name__)


class VoteDataset(Dataset):
    """PyTorch Dataset serving (politician_idx, poll_idx, rating) triplets."""

    def __init__(self, df: pd.DataFrame) -> None:
        """Initialize dataset tensors from a votes DataFrame.

        Expects columns: p_idx (int), poll_idx (int), rating (float).
        """
        self.p = torch.tensor(df["p_idx"].to_numpy(), dtype=torch.long)
        self.poll = torch.tensor(df["poll_idx"].to_numpy(), dtype=torch.long)
        self.y = torch.tensor(df["rating"].to_numpy(), dtype=torch.float)

    def __len__(self) -> int:
        return len(self.y)

    def __getitem__(self, idx: int) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:  # type: ignore[override]
        return self.p[idx], self.poll[idx], self.y[idx]


class PoliticianEmbeddingModel(L.LightningModule):
    """L2-distance model with per-entity biases.

    Biases absorb general yes/no tendencies so the embedding geometry stays clean.
    """

    def __init__(
        self, n_politicians: int, n_polls: int, n_factors: int, lr: float
    ) -> None:
        """Initialize embedding layers and loss criterion."""
        super().__init__()
        self.lr = lr
        self.p_embed = nn.Embedding(n_politicians, n_factors)
        self.p_bias = nn.Embedding(n_politicians, 1)
        self.poll_embed = nn.Embedding(n_polls, n_factors)
        self.poll_bias = nn.Embedding(n_polls, 1)
        self.criterion = nn.BCEWithLogitsLoss()

    def forward(self, p: torch.Tensor, poll: torch.Tensor) -> torch.Tensor:
        """Compute logits as negative L2 distance plus per-entity biases."""
        dist = torch.norm(self.p_embed(p) - self.poll_embed(poll), dim=1)
        return -dist + self.p_bias(p).squeeze() + self.poll_bias(poll).squeeze()

    def training_step(self, batch: tuple, _batch_idx: int) -> torch.Tensor:
        """Compute and log BCEWithLogitsLoss for a single batch."""
        p, poll, y = batch
        loss = self.criterion(self(p, poll), y)
        self.log("train_loss", loss, on_epoch=True, on_step=False, prog_bar=True)
        return loss

    def configure_optimizers(self) -> torch.optim.Optimizer:
        """Return Adam optimizer for all model parameters."""
        return torch.optim.Adam(self.parameters(), lr=self.lr)


class RelativeEarlyStopping(L.Callback):
    """Stop when loss improves by less than `min_rel` fraction epoch-over-epoch."""

    def __init__(self, min_rel: float = 0.01) -> None:
        """Initialize with minimum relative improvement threshold."""
        self.min_rel = min_rel
        self._prev = float("inf")

    def on_train_epoch_end(
        self,
        trainer: L.Trainer,
        pl_module: L.LightningModule,  # noqa: ARG002
    ) -> None:
        """Stop training if relative loss improvement falls below min_rel."""
        loss = trainer.callback_metrics.get("train_loss")
        if loss is None:
            return
        curr = loss.item()
        if self._prev == 0 or (self._prev - curr) / self._prev < self.min_rel:
            log.info(
                "Early stopping: loss improved by less than %.0f%% (%.4f → %.4f).",
                self.min_rel * 100,
                self._prev,
                curr,
            )
            trainer.should_stop = True
        self._prev = curr


def prepare_votes(
    df: pd.DataFrame, p_df: pd.DataFrame, poll_df: pd.DataFrame
) -> tuple[pd.DataFrame, np.ndarray, np.ndarray]:
    """Filter to binary yes/no votes and add integer indices for embedding layers."""
    p_ids = p_df["politician_id"].unique()
    poll_ids = poll_df["poll_id"].unique()
    p_map = {pid: i for i, pid in enumerate(p_ids)}
    poll_map = {pid: i for i, pid in enumerate(poll_ids)}

    df = df.query(
        "answer in ('yes', 'no') and politician_id in @p_ids and poll_id in @poll_ids"
    ).assign(
        rating=lambda x: (x["answer"] == "yes").astype(float),
        p_idx=lambda x: x["politician_id"].map(p_map),
        poll_idx=lambda x: x["poll_id"].map(poll_map),
    )

    return df, p_ids, poll_ids


def train(
    df: pd.DataFrame,
    n_politicians: int,
    n_polls: int,
    *,
    n_factors: int,
    n_epochs: int,
    batch_size: int,
    lr: float,
    min_improvement: float = 0.01,
) -> PoliticianEmbeddingModel:
    """Train for up to n_epochs, with early stopping on relative loss improvement."""
    log.info("Training on %d votes.", len(df))
    train_dl = DataLoader(VoteDataset(df), batch_size=batch_size, shuffle=True)
    model = PoliticianEmbeddingModel(n_politicians, n_polls, n_factors, lr)
    trainer = L.Trainer(
        max_epochs=n_epochs,
        callbacks=[RelativeEarlyStopping(min_rel=min_improvement)],
        enable_checkpointing=False,
        enable_model_summary=False,
        logger=False,
    )
    trainer.fit(model, train_dl)
    return model


def save_embeddings(
    model: PoliticianEmbeddingModel,
    p_df: pd.DataFrame,
    p_ids: np.ndarray,
    period: int | None = None,
    *,
    wahlperiode: int | None = None,
) -> None:
    """Export embeddings to CSV with politician metadata. Columns: x, y (z for 3D)."""
    if period is None:
        period = wahlperiode
    if period is None:
        msg = "save_embeddings() requires a period."
        raise TypeError(msg)

    weights = model.p_embed.weight.detach().numpy()
    n_dims = weights.shape[1]
    coords = {"x": weights[:, 0], "y": weights[:, 1]}
    if n_dims == 3:
        coords["z"] = weights[:, 2]
    emb_df = pd.DataFrame({"politician_id": p_ids, **coords})
    path = OUTPUTS_DIR / f"politician_embeddings_{period}.csv"
    merged = p_df.merge(emb_df, on="politician_id")
    # Inner join intentionally drops politicians with no embedding (no votes).
    n_dropped = len(p_df) - len(merged)
    if n_dropped:
        log.info("Dropped %d politician(s) with no votes from embeddings.", n_dropped)
    merged.to_csv(path, index=False)
    log.info("Embeddings saved to %s", path)
