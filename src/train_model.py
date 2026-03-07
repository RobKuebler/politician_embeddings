import logging
from pathlib import Path

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

# Configuration
PERIOD_ID = 161  # Target legislative period (Bundestag 2025 - 2029)

DATA_DIR = Path(__file__).parents[1] / "data"
OUTPUTS_DIR = Path(__file__).parents[1] / "outputs"
OUTPUTS_DIR.mkdir(exist_ok=True)

# 1. Load and prepare data
votes_path = DATA_DIR / f"votes_{PERIOD_ID}.csv"
politicians_path = DATA_DIR / f"politicians_{PERIOD_ID}.csv"
polls_path = DATA_DIR / f"polls_{PERIOD_ID}.csv"

if not votes_path.exists():
    log.error("%s not found! Run fetch_data.py first.", votes_path)
    raise SystemExit(1)

log.info("Loading data for period %d...", PERIOD_ID)
df = pd.read_csv(votes_path)
p_df = pd.read_csv(politicians_path)
poll_df = pd.read_csv(polls_path)

# Only binary votes — abstain/no_show carry no clear signal
df = df[df["answer"].isin({"yes", "no"})].copy()
df["rating"] = (df["answer"] == "yes").astype(float)

# Map original IDs to continuous indices for the embedding layers
p_ids = p_df["politician_id"].unique()
poll_ids = poll_df["poll_id"].unique()

p_to_idx = {pid: i for i, pid in enumerate(p_ids)}
poll_to_idx = {pid: i for i, pid in enumerate(poll_ids)}

# Filter votes to ensure consistent data across files
df = df[df["politician_id"].isin(p_ids) & df["poll_id"].isin(poll_ids)].copy()
df["p_idx"] = df["politician_id"].map(p_to_idx)
df["poll_idx"] = df["poll_id"].map(poll_to_idx)


class VoteDataset(Dataset[tuple[torch.Tensor, torch.Tensor, torch.Tensor]]):
    """
    Standard PyTorch Dataset to serve politician, poll, and rating triplets.
    """

    def __init__(self, df):
        self.p = torch.tensor(df["p_idx"].to_numpy(), dtype=torch.long)
        self.poll = torch.tensor(df["poll_idx"].to_numpy(), dtype=torch.long)
        self.y = torch.tensor(df["rating"].to_numpy(), dtype=torch.float)

    def __len__(self):
        return len(self.y)

    def __getitem__(self, idx) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:  # ty: ignore[invalid-method-override]
        return self.p[idx], self.poll[idx], self.y[idx]


# 2. Model Definition
class PoliticianEmbeddingModel(nn.Module):
    """
    Matrix Factorization Model: Dot product of politician and poll embeddings
    plus biases, followed by a sigmoid to predict the vote probability.
    """

    def __init__(self, n_politicians, n_polls, n_factors=8):
        super().__init__()
        # Politician embeddings and bias
        self.p_embed = nn.Embedding(n_politicians, n_factors)
        self.p_bias = nn.Embedding(n_politicians, 1)
        # Poll embeddings and bias
        self.poll_embed = nn.Embedding(n_polls, n_factors)
        self.poll_bias = nn.Embedding(n_polls, 1)

        # Initialize weights
        nn.init.xavier_uniform_(self.p_embed.weight)
        nn.init.xavier_uniform_(self.poll_embed.weight)
        self.p_bias.weight.data.fill_(0.0)
        self.poll_bias.weight.data.fill_(0.0)

    def forward(self, p, poll):
        dot = (self.p_embed(p) * self.poll_embed(poll)).sum(dim=1)
        res = dot + self.p_bias(p).squeeze() + self.poll_bias(poll).squeeze()
        return torch.sigmoid(res)


# 3. Training Loop
log.info("Training on %d votes...", len(df))
n_p, n_poll = len(p_ids), len(poll_ids)
model = PoliticianEmbeddingModel(n_p, n_poll, n_factors=8)
criterion = nn.MSELoss()
optimizer = torch.optim.Adam(model.parameters(), lr=0.01, weight_decay=1e-5)

ds = VoteDataset(df)
dl = DataLoader(ds, batch_size=256, shuffle=True)

for epoch in range(10):
    model.train()
    total_loss = 0
    for p, poll, y in dl:
        optimizer.zero_grad()
        preds = model(p, poll)
        loss = criterion(preds, y)
        loss.backward()
        optimizer.step()
        total_loss += loss.item()
    log.info("Epoch %d/10 - Average Loss: %.4f", epoch + 1, total_loss / len(dl))

# 4. Export Embeddings
log.info("Exporting embeddings...")
embeddings = model.p_embed.weight.detach().numpy()
emb_columns = [f"dim_{i}" for i in range(embeddings.shape[1])]
emb_df = pd.DataFrame(embeddings, columns=emb_columns)
emb_df["politician_id"] = p_ids

# Merge embeddings with original metadata (Name, Party)
final_df = p_df.merge(emb_df, on="politician_id")
output_path = OUTPUTS_DIR / f"politician_embeddings_{PERIOD_ID}.csv"
final_df.to_csv(output_path, index=False)
log.info("Embeddings saved to %s", output_path)

# 5. UMAP: reduce to 2D for visualization and save separately
log.info("Running UMAP to produce 2D visualization embeddings...")
coords = umap.UMAP(n_components=2, random_state=42).fit_transform(embeddings)
viz_df = p_df.copy()
viz_df["x"] = coords[:, 0]
viz_df["y"] = coords[:, 1]
viz_path = OUTPUTS_DIR / f"politician_embeddings_{PERIOD_ID}_2d.csv"
viz_df.to_csv(viz_path, index=False)
log.info("2D embeddings saved to %s", viz_path)
