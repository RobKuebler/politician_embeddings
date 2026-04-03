"""Combined data pipeline: fetch → train → export in a single process.

Replaces running abgeordnetenwatch, model/train, and export as separate steps.
polls, politicians, and sidejobs are passed in-memory between stages; only
votes.csv is read/written to disk (it accumulates incrementally across runs).
"""

import argparse
import logging
from datetime import UTC, date, datetime
from pathlib import Path

import pandas as pd

from .cli import (
    add_period_argument,
    build_parser,
    configure_logging,
    write_github_output,
)
from .export import (
    OUTPUT_DIR,
    export_party_speech_stats,
    export_party_word_freq,
    export_period,
    export_periods,
)
from .fetch.abgeordnetenwatch import (
    fetch_periods_df,
    fetch_votes,
    find_polls_missing_votes,
    refresh_periods,
    refresh_politicians,
    refresh_polls,
    refresh_sidejobs,
)
from .model.model import save_embeddings
from .paths import DATA_DIR, OUTPUTS_DIR


def _read_bytes_or_none(path: Path) -> bytes | None:
    """Return file bytes if path exists, else None."""
    return path.read_bytes() if path.exists() else None


log = logging.getLogger(__name__)


def _export_period_or_check(
    period: int,
    p: int,
    p_start: date,
    p_end: date,
    df_politicians: pd.DataFrame,
    df_polls: pd.DataFrame,
    df_sidejobs: pd.DataFrame,
) -> bool:
    """Export current period or check if non-current period output exists.

    For the current period: call export_period() with in-memory DataFrames
    and export speech stats.
    For non-current periods: verify all 9 output JSON files exist in the
    per-period subdirectory.

    Returns True if the period was successfully exported or output files exist.
    """
    if p == period:
        exported = export_period(
            p,
            p_start,
            p_end,
            df_politicians=df_politicians,
            df_polls=df_polls,
            df_sidejobs=df_sidejobs,
        )
        if exported:
            export_party_word_freq(p)
            export_party_speech_stats(p)
        return exported
    # Non-current period: include if all output files already exist.
    period_out = OUTPUT_DIR / str(p)
    output_files = [
        "politicians.json",
        "embeddings.json",
        "votes.json",
        "polls.json",
        "sidejobs.json",
        "cohesion.json",
        "party_profile.json",
        "party_word_freq.json",
        "party_speech_stats.json",
    ]
    missing = [f for f in output_files if not (period_out / f).exists()]
    if missing:
        log.warning("Period %d skipped — missing output files: %s", p, missing)
        return False
    return True


def _train(
    period: int,
    df_votes: pd.DataFrame,
    df_politicians: pd.DataFrame,
    df_polls: pd.DataFrame,
    *,
    factors: int = 2,
    epochs: int = 50,
    batch_size: int = 256,
    lr: float = 0.01,
    min_improvement: float = 0.01,
) -> None:
    """Train the embedding model and save results to outputs/."""
    # Deferred: lightning is slow to import and not needed when training is skipped.
    import lightning as L

    from .model.model import prepare_votes, train

    L.seed_everything(42)
    OUTPUTS_DIR.mkdir(exist_ok=True)
    df_votes, p_ids, poll_ids = prepare_votes(df_votes, df_politicians, df_polls)
    model = train(
        df_votes,
        len(p_ids),
        len(poll_ids),
        n_factors=factors,
        n_epochs=epochs,
        batch_size=batch_size,
        lr=lr,
        min_improvement=min_improvement,
    )
    save_embeddings(model, df_politicians, p_ids, period)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = build_parser("Führe die komplette Datenpipeline in einem Prozess aus.")
    add_period_argument(parser)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    configure_logging()
    args = parse_args(argv)

    period = args.period or refresh_periods()
    period_dir = DATA_DIR / str(period)
    period_dir.mkdir(parents=True, exist_ok=True)

    # ── fetch ──────────────────────────────────────────────────────────────────
    df_polls = refresh_polls(period)
    df_politicians, mandate_to_politician = refresh_politicians(period)
    df_sidejobs = refresh_sidejobs(period, mandate_to_politician)

    votes_path = period_dir / "votes.csv"
    votes_before = _read_bytes_or_none(votes_path)
    missing = find_polls_missing_votes(df_polls["poll_id"].tolist(), votes_path)
    if missing:
        log.info("%d poll(s) need vote fetching.", len(missing))
        fetch_votes(
            missing, mandate_to_politician, votes_path, append=votes_path.exists()
        )
    else:
        log.info("All votes up to date, nothing to fetch.")
    votes_changed = _read_bytes_or_none(votes_path) != votes_before

    # ── train ──────────────────────────────────────────────────────────────────
    emb_path = OUTPUTS_DIR / f"politician_embeddings_{period}.csv"
    if votes_changed or not emb_path.exists():
        if not votes_path.exists():
            log.warning("No votes.csv for period %d, cannot train.", period)
        else:
            df_votes = pd.read_csv(votes_path)
            if not df_votes.empty:
                _train(period, df_votes, df_politicians, df_polls)
            else:
                log.warning(
                    "votes.csv is empty for period %d, skipping training.", period
                )
    else:
        log.info("Votes unchanged and embeddings present, skipping training.")

    # ── export ─────────────────────────────────────────────────────────────────
    periods_df = fetch_periods_df()

    # Export all periods; pass in-memory DataFrames for the current one.
    # For other periods, skip re-export if their output JSON already exists.
    available: list[dict] = []
    for _, row in periods_df.iterrows():
        p = int(row["bundestag_number"])
        p_start = date.fromisoformat(str(row["start_date"]))
        raw_end = row["end_date"]
        now = datetime.now(tz=UTC).date()
        p_end = date.fromisoformat(str(raw_end)) if pd.notna(raw_end) else now

        exported = _export_period_or_check(
            period,
            p,
            p_start,
            p_end,
            df_politicians,
            df_polls,
            df_sidejobs,
        )

        if exported:
            available.append(
                {
                    "wahlperiode": p,
                    "label": str(row.get("label", f"Wahlperiode {p}")),
                    "has_data": True,
                }
            )

    export_periods(available)
    log.info("Done. Exported %d periods.", len(available))

    write_github_output(
        votes_changed=votes_changed,
        fetched_polls=len(missing),
        period=period,
    )


if __name__ == "__main__":
    main()
