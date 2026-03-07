import logging
from pathlib import Path

import lightning as L
import numpy as np
import pandas as pd
import torch
from torch import nn
from torch.utils.data import DataLoader, Dataset

log = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parents[1] / "data"
OUTPUTS_DIR = Path(__file__).parents[1] / "outputs"


class VoteDataset(Dataset):
    """PyTorch Dataset serving (politician_idx, poll_idx, rating) triplets."""

    def __init__(self, df: pd.DataFrame) -> None:
        self.p = torch.tensor(df["p_idx"].to_numpy(), dtype=torch.long)
        self.poll = torch.tensor(df["poll_idx"].to_numpy(), dtype=torch.long)
        self.y = torch.tensor(df["rating"].to_numpy(), dtype=torch.float)

    def __len__(self) -> int:
        return len(self.y)

    def __getitem__(self, idx):  # ty: ignore[invalid-method-override]
        return self.p[idx], self.poll[idx], self.y[idx]


class PoliticianEmbeddingModel(L.LightningModule):
    """Matrix factorization: dot product of politician and poll embeddings + biases."""

    def __init__(
        self, n_politicians: int, n_polls: int, n_factors: int, lr: float
    ) -> None:
        super().__init__()
        self.lr = lr
        self.p_embed = nn.Embedding(n_politicians, n_factors)
        self.p_bias = nn.Embedding(n_politicians, 1)
        self.poll_embed = nn.Embedding(n_polls, n_factors)
        self.poll_bias = nn.Embedding(n_polls, 1)
        self.criterion = nn.BCEWithLogitsLoss()

    def forward(self, p: torch.Tensor, poll: torch.Tensor) -> torch.Tensor:
        dot = (self.p_embed(p) * self.poll_embed(poll)).sum(dim=1)
        return dot + self.p_bias(p).squeeze() + self.poll_bias(poll).squeeze()

    def training_step(self, batch: tuple, _batch_idx: int) -> torch.Tensor:
        p, poll, y = batch
        loss = self.criterion(self(p, poll), y)
        self.log("train_loss", loss, on_epoch=True, on_step=False, prog_bar=True)
        return loss

    def configure_optimizers(self):
        return torch.optim.AdamW(self.parameters(), lr=self.lr, weight_decay=1e-5)


def load_data(period_id: int) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Load votes, politicians and polls CSVs for a given period."""
    votes_path = DATA_DIR / f"votes_{period_id}.csv"
    if not votes_path.exists():
        log.error("%s not found! Run fetch_data.py first.", votes_path)
        raise SystemExit(1)
    log.info("Loading data for period %d...", period_id)
    return (
        pd.read_csv(votes_path),
        pd.read_csv(DATA_DIR / f"politicians_{period_id}.csv"),
        pd.read_csv(DATA_DIR / f"polls_{period_id}.csv"),
    )


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
) -> PoliticianEmbeddingModel:
    """Train for a fixed number of epochs."""
    log.info("Training on %d votes.", len(df))
    train_dl = DataLoader(VoteDataset(df), batch_size=batch_size, shuffle=True)
    model = PoliticianEmbeddingModel(n_politicians, n_polls, n_factors, lr)
    trainer = L.Trainer(
        max_epochs=n_epochs,
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
    period_id: int,
) -> None:
    """Export embeddings directly to CSV with x, y (and z for 3D) columns."""
    weights = model.p_embed.weight.detach().numpy()
    n_dims = weights.shape[1]
    coords = {"x": weights[:, 0], "y": weights[:, 1]}
    if n_dims == 3:
        coords["z"] = weights[:, 2]
    emb_df = pd.DataFrame({"politician_id": p_ids, **coords})
    path = OUTPUTS_DIR / f"politician_embeddings_{period_id}.csv"
    p_df.merge(emb_df, on="politician_id").to_csv(path, index=False)
    log.info("Embeddings saved to %s", path)
