import argparse
import logging
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)

PERIOD_ID = 161  # Target legislative period (Bundestag 2025 - 2029)
N_FACTORS = 2
N_EPOCHS = 50
BATCH_SIZE = 256
LR = 0.01

OUTPUTS_DIR = Path(__file__).parents[1] / "outputs"


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
        help="Legislative period ID",
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
    return parser.parse_args()


def main() -> None:
    args = parse_args()  # exits here if -h

    import lightning as L

    from models import (
        load_data,
        prepare_votes,
        save_2d_embeddings,
        save_embeddings,
        train,
    )

    L.seed_everything(42)
    OUTPUTS_DIR.mkdir(exist_ok=True)
    df_votes, p_df, poll_df = load_data(args.period)
    df_votes, p_ids, poll_ids = prepare_votes(df_votes, p_df, poll_df)
    model = train(
        df_votes,
        len(p_ids),
        len(poll_ids),
        n_factors=args.factors,
        n_epochs=args.epochs,
        batch_size=args.batch_size,
        lr=args.lr,
    )
    embeddings = save_embeddings(model, p_df, p_ids, args.period)
    save_2d_embeddings(embeddings, p_df, args.period)


if __name__ == "__main__":
    main()
