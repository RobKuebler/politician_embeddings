"""Compute keyword frequency timelines from plenary protocol XMLs.

Produces keyword_timeline.json: per-term monthly mention counts.

Usage:
    uv run python -m src.analysis.keyword_timeline --period 21
"""

import argparse
import logging
from collections import Counter, defaultdict
from pathlib import Path

import pandas as pd

from ..cli import add_period_argument, build_parser, configure_logging
from ..fetch.abgeordnetenwatch import refresh_periods
from ..parse.protocols import parse_alle_sitzungen
from ..paths import DATA_DIR
from .word_stats import _STOPWORDS, _tokenize

log = logging.getLogger(__name__)


def compute_keyword_timeline(
    df: pd.DataFrame,
    stopwords: set[str],
    min_count: int = 5,
) -> dict:
    """Compute per-month term frequencies from a speeches DataFrame.

    Returns a dict matching the keyword_timeline.json schema:
    {
        "meta": {"months": [...], "total_words_per_month": [...]},
        "terms": {"migration": [45, 38, ...], ...}
    }

    Terms in stopwords or with fewer than min_count total mentions are excluded.
    Rows with datum=None are skipped.
    """
    df = df.dropna(subset=["datum", "text"]).copy()
    df["month"] = df["datum"].str[:7]  # "YYYY-MM"
    months = sorted(df["month"].unique().tolist())
    month_to_idx = {m: i for i, m in enumerate(months)}
    n = len(months)

    # Total words per month (for client-side normalization)
    total_words_series = df.groupby("month")["wortanzahl"].sum()
    total_words_per_month = [int(total_words_series.get(m, 0)) for m in months]

    # Count term occurrences per month across all speeches
    term_counts: dict[str, list[int]] = defaultdict(lambda: [0] * n)
    for _, row in df.iterrows():
        idx = month_to_idx.get(str(row["month"]))
        if idx is None:
            continue
        tokens = _tokenize(str(row["text"]))
        for term, count in Counter(t for t in tokens if t not in stopwords).items():
            term_counts[term][idx] += count

    # Filter: remove terms below minimum total count
    terms = {
        term: counts for term, counts in term_counts.items() if sum(counts) >= min_count
    }

    return {
        "meta": {
            "months": months,
            "total_words_per_month": total_words_per_month,
        },
        "terms": terms,
    }


def fetch_keyword_timeline(out_dir: Path, min_count: int = 5) -> dict:
    """Parse all XMLs in out_dir and return keyword timeline dict."""
    df = parse_alle_sitzungen(out_dir)
    log.info("Loaded %d speeches", len(df))
    return compute_keyword_timeline(df, stopwords=_STOPWORDS, min_count=min_count)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """Parse CLI arguments."""
    parser = build_parser("Berechne Keyword-Zeitverlauf aus Plenarprotokollen.")
    add_period_argument(parser)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    """CLI entry point."""
    configure_logging()
    args = parse_args(argv)
    period = args.period or refresh_periods()
    out_dir = DATA_DIR / str(period)
    log.info("Period %d...", period)
    result = fetch_keyword_timeline(out_dir)
    log.info(
        "Timeline: %d months, %d terms",
        len(result["meta"]["months"]),
        len(result["terms"]),
    )


if __name__ == "__main__":
    main()
