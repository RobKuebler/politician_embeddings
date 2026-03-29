import argparse
import logging

from ..cli import add_period_argument, build_parser, configure_logging

log = logging.getLogger(__name__)

N_FACTORS = 2
N_EPOCHS = 50
BATCH_SIZE = 256
LR = 0.01
MIN_IMPROVEMENT = 0.01


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = build_parser("Trainiere das Embedding-Modell auf Abstimmungsdaten.")
    add_period_argument(parser)
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
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    configure_logging()
    args = parse_args(argv)

    import lightning as L

    from ..storage import OUTPUTS_DIR, current_period, load_data, save_embeddings
    from .model import prepare_votes, train

    period = args.period or current_period()
    L.seed_everything(42)
    OUTPUTS_DIR.mkdir(exist_ok=True)
    df_votes, p_df, poll_df = load_data(period)
    if df_votes.empty:
        log.warning("No voting data found for period %d. Skipping training.", period)
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
    save_embeddings(model, p_df, p_ids, period)


if __name__ == "__main__":
    main()
