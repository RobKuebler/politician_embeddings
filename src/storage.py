import logging
from datetime import UTC
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

log = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parents[1] / "data"
OUTPUTS_DIR = Path(__file__).parents[1] / "outputs"


def current_period() -> int:
    """Return the bundestag_number of the currently active legislature.

    Reads periods.csv and finds the period whose date range contains today.
    Falls back to the latest known period if today falls outside all known ranges
    (e.g. a future period whose end_date is not yet set).
    """
    from datetime import datetime

    df = pd.read_csv(DATA_DIR / "periods.csv")
    today = datetime.now(tz=UTC).date().isoformat()
    active = df[(df["start_date"] <= today) & (df["end_date"] >= today)]
    row = active.iloc[0] if not active.empty else df.iloc[-1]
    return int(row["bundestag_number"])


def current_wahlperiode() -> int:
    """Backward-compatible wrapper for the old helper name."""
    return current_period()


def period_id_for(period: int) -> int:
    """Return the abgeordnetenwatch API period_id for a given period.

    Reads periods.csv. Used internally by fetch/abgeordnetenwatch.py for API calls.
    """
    df = pd.read_csv(DATA_DIR / "periods.csv")
    match = df[df["bundestag_number"] == period]
    if match.empty:
        msg = f"Period {period} not found in periods.csv."
        raise ValueError(msg)
    return int(match.iloc[0]["period_id"])


def load_data(period: int) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Load votes, politicians and polls CSVs for a given period."""
    period_dir = DATA_DIR / str(period)
    required_paths = {
        "votes.csv": period_dir / "votes.csv",
        "politicians.csv": period_dir / "politicians.csv",
        "polls.csv": period_dir / "polls.csv",
    }
    missing = [name for name, path in required_paths.items() if not path.exists()]
    if missing:
        missing_list = ", ".join(missing)
        msg = (
            f"Missing input files for period {period}: {missing_list}. "
            "Run `python -m src.fetch.abgeordnetenwatch` first."
        )
        log.error(msg)
        raise SystemExit(msg)

    log.info("Loading data for period %d...", period)
    return (
        pd.read_csv(required_paths["votes.csv"]),
        pd.read_csv(required_paths["politicians.csv"]),
        pd.read_csv(required_paths["polls.csv"]),
    )


def save_embeddings(
    model: Any,
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
    p_df.merge(emb_df, on="politician_id").to_csv(path, index=False)
    log.info("Embeddings saved to %s", path)
