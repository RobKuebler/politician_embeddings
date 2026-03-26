import argparse
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

PERIOD_ID = None  # None = auto-detect current active Bundestag period
N_FACTORS = 2
N_EPOCHS = 50
BATCH_SIZE = 256
LR = 0.01
MIN_IMPROVEMENT = 0.01


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Train politician embedding model on Bundestag voting data.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--period",
        type=int,
        default=PERIOD_ID,
        metavar="INT",
        help="Legislative period ID (default: current active period)",
    )
    parser.add_argument(
        "--factors",
        type=int,
        default=N_FACTORS,
        metavar="INT",
        help="Embedding dimensions",
    )
    parser.add_argument(
        "--epochs",
        type=int,
        default=N_EPOCHS,
        metavar="INT",
        help="Max training epochs",
    )
    parser.add_argument(
        "--batch-size", type=int, default=BATCH_SIZE, metavar="INT", help="Batch size"
    )
    parser.add_argument(
        "--lr", type=float, default=LR, metavar="FLOAT", help="Learning rate"
    )
    parser.add_argument(
        "--min-improvement",
        type=float,
        default=MIN_IMPROVEMENT,
        metavar="FLOAT",
        help="Min relative loss improvement per epoch (e.g. 0.01 = 1%%)",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()  # exits here if -h

    import lightning as L

    from .fetch_data import upsert_periods
    from .model import prepare_votes, train
    from .storage import OUTPUTS_DIR, load_data, save_embeddings

    period_id = args.period or upsert_periods()
    L.seed_everything(42)
    OUTPUTS_DIR.mkdir(exist_ok=True)
    df_votes, p_df, poll_df = load_data(period_id)
    if df_votes.empty:
        log.warning("No voting data found for period %d. Skipping training.", period_id)
        return

    df_votes, p_ids, poll_ids = prepare_votes(df_votes, p_df, poll_df)
    model = train(
        df_votes,
        len(p_ids),
        len(poll_ids),
        n_factors=args.factors,
        n_epochs=args.epochs,
        batch_size=args.batch_size,
        lr=args.lr,
        min_improvement=args.min_improvement,
    )
    save_embeddings(model, p_df, p_ids, period_id)


if __name__ == "__main__":
    main()
