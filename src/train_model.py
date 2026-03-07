import logging
from pathlib import Path

import numpy as np
import pandas as pd
import torch
import umap
from torch import nn
from torch.utils.data import DataLoader, Dataset

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

PERIOD_ID = 161  # Target legislative period (Bundestag 2025 - 2029)
N_FACTORS = 8
N_EPOCHS = 10
BATCH_SIZE = 256
LR = 0.01

DATA_DIR = Path(__file__).parents[1] / "data"
OUTPUTS_DIR = Path(__file__).parents[1] / "outputs"


class VoteDataset(Dataset[tuple[torch.Tensor, torch.Tensor, torch.Tensor]]):
    """PyTorch Dataset serving (politician_idx, poll_idx, rating) triplets."""

    def __init__(self, df: pd.DataFrame) -> None:
        self.p = torch.tensor(df["p_idx"].to_numpy(), dtype=torch.long)
        self.poll = torch.tensor(df["poll_idx"].to_numpy(), dtype=torch.long)
        self.y = torch.tensor(df["rating"].to_numpy(), dtype=torch.float)

    def __len__(self) -> int:
        return len(self.y)

    def __getitem__(self, idx) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:  # ty: ignore[invalid-method-override]
        return self.p[idx], self.poll[idx], self.y[idx]


class PoliticianEmbeddingModel(nn.Module):
    """Matrix factorization: dot product of politician and poll embeddings + biases."""

    def __init__(
        self, n_politicians: int, n_polls: int, n_factors: int = N_FACTORS
    ) -> None:
        super().__init__()
        self.p_embed = nn.Embedding(n_politicians, n_factors)
        self.p_bias = nn.Embedding(n_politicians, 1)
        self.poll_embed = nn.Embedding(n_polls, n_factors)
        self.poll_bias = nn.Embedding(n_polls, 1)

    def forward(self, p: torch.Tensor, poll: torch.Tensor) -> torch.Tensor:
        dot = (self.p_embed(p) * self.poll_embed(poll)).sum(dim=1)
        return torch.sigmoid(
            dot + self.p_bias(p).squeeze() + self.poll_bias(poll).squeeze()
        )


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
    df = df[df["answer"].isin({"yes", "no"})].copy()
    df["rating"] = (df["answer"] == "yes").astype(float)

    p_ids = p_df["politician_id"].unique()
    poll_ids = poll_df["poll_id"].unique()

    df = df[df["politician_id"].isin(p_ids) & df["poll_id"].isin(poll_ids)].copy()
    df["p_idx"] = df["politician_id"].map({pid: i for i, pid in enumerate(p_ids)})
    df["poll_idx"] = df["poll_id"].map({pid: i for i, pid in enumerate(poll_ids)})

    return df, p_ids, poll_ids


def train(
    df: pd.DataFrame, n_politicians: int, n_polls: int
) -> PoliticianEmbeddingModel:
    """Train the matrix factorization model and return it."""
    log.info("Training on %d votes...", len(df))
    model = PoliticianEmbeddingModel(n_politicians, n_polls)
    optimizer = torch.optim.Adam(model.parameters(), lr=LR, weight_decay=1e-5)
    criterion = nn.MSELoss()
    dl = DataLoader(VoteDataset(df), batch_size=BATCH_SIZE, shuffle=True)

    for epoch in range(N_EPOCHS):
        model.train()
        total_loss = 0.0
        for p, poll, y in dl:
            optimizer.zero_grad()
            loss = criterion(model(p, poll), y)
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
        log.info("Epoch %d/%d - Loss: %.4f", epoch + 1, N_EPOCHS, total_loss / len(dl))

    return model


def save_embeddings(
    model: PoliticianEmbeddingModel,
    p_df: pd.DataFrame,
    p_ids: np.ndarray,
    period_id: int,
) -> np.ndarray:
    """Export full-dimensional embeddings to CSV and return the raw numpy array."""
    embeddings = model.p_embed.weight.detach().numpy()
    emb_df = pd.DataFrame(
        embeddings, columns=[f"dim_{i}" for i in range(embeddings.shape[1])]
    )
    emb_df["politician_id"] = p_ids
    path = OUTPUTS_DIR / f"politician_embeddings_{period_id}.csv"
    p_df.merge(emb_df, on="politician_id").to_csv(path, index=False)
    log.info("Embeddings saved to %s", path)
    return embeddings


def save_2d_embeddings(
    embeddings: np.ndarray, p_df: pd.DataFrame, period_id: int
) -> None:
    """Reduce embeddings to 2D via UMAP and export visualization CSV."""
    log.info("Running UMAP to produce 2D visualization embeddings...")
    coords = umap.UMAP(n_components=2, random_state=42).fit_transform(embeddings)
    viz_df = p_df.copy()
    viz_df["x"] = coords[:, 0]
    viz_df["y"] = coords[:, 1]
    path = OUTPUTS_DIR / f"politician_embeddings_{period_id}_2d.csv"
    viz_df.to_csv(path, index=False)
    log.info("2D embeddings saved to %s", path)


def main() -> None:
    OUTPUTS_DIR.mkdir(exist_ok=True)
    df_votes, p_df, poll_df = load_data(PERIOD_ID)
    df_votes, p_ids, poll_ids = prepare_votes(df_votes, p_df, poll_df)
    model = train(df_votes, len(p_ids), len(poll_ids))
    embeddings = save_embeddings(model, p_df, p_ids, PERIOD_ID)
    save_2d_embeddings(embeddings, p_df, PERIOD_ID)


if __name__ == "__main__":
    main()
