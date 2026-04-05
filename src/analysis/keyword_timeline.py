"""Compute keyword frequency timelines from plenary protocol XMLs.

Produces keyword_timeline.json: per-term monthly mention counts.
Produces keyword_timeline_parties.json: per-party breakdown (lazy-loaded).

Usage:
    uv run python -m src.analysis.keyword_timeline --period 21
"""

import argparse
import logging
from collections import Counter, defaultdict
from pathlib import Path

import pandas as pd

from ..cli import add_period_argument, build_parser, configure_logging
from ..constants import PARTY_ORDER
from ..fetch.abgeordnetenwatch import refresh_periods
from ..parse.protocols import parse_alle_sitzungen
from ..paths import DATA_DIR
from .word_stats import _STOPWORDS, _tokenize

log = logging.getLogger(__name__)


def compute_keyword_timeline(
    df: pd.DataFrame,
    stopwords: set[str],
    min_count: int = 5,
    top_n_words: int = 7500,
) -> dict:
    """Compute per-month term frequencies from a speeches DataFrame.

    Returns a dict with the full keyword_timeline data including party breakdowns:
    {
        "meta": {
            "months": [...],
            "total_words_per_month": [...],
            "parties": ["CDU/CSU", "SPD", ...],
            "party_words": {"SPD": [...], ...},
        },
        "terms": {"migration": [45, 38, ...], ...},
        "by_party": {"migration": {"SPD": [10, 8, ...], ...}, ...},
    }

    Terms in stopwords or with fewer than min_count total mentions are excluded.
    by_party only includes the top_n_words most frequent terms — rare terms
    don't have enough per-party data to show meaningful trends, and keeping all
    terms makes the file too large. Stopwords are always excluded.
    fraktionslos is excluded from party breakdown. Rows with datum=None are skipped.
    """
    df = df.dropna(subset=["datum", "text"]).copy()
    df["month"] = df["datum"].str[:7]  # "YYYY-MM"
    months = sorted(df["month"].unique().tolist())
    month_to_idx = {m: i for i, m in enumerate(months)}
    n = len(months)

    # Total words per month (for client-side normalization)
    total_words_series = df.groupby("month")["wortanzahl"].sum()
    total_words_per_month = [int(total_words_series.get(m, 0)) for m in months]

    # Parties present in data, ordered by PARTY_ORDER, excluding fraktionslos
    present = set(df["fraktion"].dropna().unique())
    parties = [p for p in PARTY_ORDER if p in present and p != "fraktionslos"]

    # Total words per party per month (for per-party normalization in the frontend)
    # Single groupby instead of N per-party filter+groupby passes.
    _pw = df.groupby(["fraktion", "month"])["wortanzahl"].sum()
    party_words: dict[str, list[int]] = {
        party: [int(_pw.get((party, m), 0)) for m in months] for party in parties
    }

    # Count term occurrences per month — total and per party in one pass
    term_counts: dict[str, list[int]] = defaultdict(lambda: [0] * n)
    # Use a plain dict of defaultdicts to avoid closure issues with n
    party_term_counts: dict[str, dict[str, list[int]]] = {
        party: defaultdict(lambda: [0] * n) for party in parties
    }

    for row in df.itertuples(index=False):  # type: ignore[call-overload]
        idx = month_to_idx.get(row.month)  # type: ignore[attr-defined]
        if idx is None:
            continue
        tokens = _tokenize(row.text)  # type: ignore[attr-defined]
        fraktion = row.fraktion  # type: ignore[attr-defined]
        term_bag = Counter(t for t in tokens if t not in stopwords)
        for term, count in term_bag.items():
            term_counts[term][idx] += count
            if fraktion in party_term_counts:
                party_term_counts[fraktion][term][idx] += count

    # Filter: remove terms below minimum total count
    terms = {
        term: counts for term, counts in term_counts.items() if sum(counts) >= min_count
    }

    # Build per-party counts for the top_n_words most frequent non-stopword terms.
    # Ranking by total count across all months; if fewer terms exist, keep all.
    top_terms = set(
        sorted(terms, key=lambda t: sum(terms[t]), reverse=True)[:top_n_words]
    )
    by_party = {
        term: {party: list(party_term_counts[party][term]) for party in parties}
        for term in terms
        if term in top_terms
    }

    return {
        "meta": {
            "months": months,
            "total_words_per_month": total_words_per_month,
            "parties": parties,
            "party_words": party_words,
        },
        "terms": terms,
        "by_party": by_party,
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
