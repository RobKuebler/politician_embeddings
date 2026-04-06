"""Convert period CSVs to JSON files for the Next.js frontend.

Writes to frontend/public/data/. Run via src.pipeline or standalone.
"""

import argparse
import logging
from datetime import date
from pathlib import Path

import pandas as pd

from .analysis.transforms import compute_cohesion
from .cli import add_period_argument, build_parser, configure_logging
from .export_profile import export_party_profile as _export_party_profile_impl
from .export_sidejobs import (
    export_conflicts as _export_conflicts_impl,
)
from .export_sidejobs import (
    export_sidejobs as _export_sidejobs_impl,
)
from .export_sidejobs import (
    prepare_income_sidejobs as _prepare_income_sidejobs_impl,
)
from .export_utils import (
    period_output_dir,
    split_topics,
    write_json,
)
from .fetch.abgeordnetenwatch import fetch_periods_df
from .paths import DATA_DIR, FRONTEND_DATA_DIR, OUTPUTS_DIR

log = logging.getLogger(__name__)

OUTPUT_DIR = FRONTEND_DATA_DIR


def _period_output_dir(period: int) -> Path:
    """Return the output subdirectory for a period, creating it if needed."""
    return period_output_dir(OUTPUT_DIR, period)


def _write(path: Path, data: object) -> None:
    """Write data as JSON; create parent dirs if needed."""
    write_json(path, data, log=log)


def _split_topics(t: object) -> list[str]:
    """Split pipe-separated topic string into a list."""
    return split_topics(t)


def _prepare_income_sidejobs(
    period: int,
    period_start: date,
    period_end: date,
    df_sidejobs: pd.DataFrame,
    *,
    positive_only: bool = False,
) -> pd.DataFrame:
    """Return sidejobs with numeric income and computed prorated income."""
    return _prepare_income_sidejobs_impl(
        period,
        period_start,
        period_end,
        df_sidejobs,
        log=log,
        positive_only=positive_only,
    )


def _export_sidejobs(
    period: int,
    pols_df: pd.DataFrame,
    period_start: date,
    period_end: date,
    df_sidejobs: pd.DataFrame,
) -> None:
    """Build and write sidejobs JSON for one period."""
    _export_sidejobs_impl(
        OUTPUT_DIR,
        period,
        pols_df,
        period_start,
        period_end,
        df_sidejobs,
        log=log,
    )


def _export_conflicts(
    period: int,
    pols_df: pd.DataFrame,
    period_start: date,
    period_end: date,
    df_sidejobs: pd.DataFrame,
    df_committees: pd.DataFrame,
    df_memberships: pd.DataFrame,
) -> None:
    """Compute and export conflict-of-interest data.

    A conflict exists when a politician earns income (via a disclosed sidejob)
    in a topic area that their Ausschuss is also responsible for.
    Output: conflicts.json with pre-aggregated rows + summary stats.
    """
    _export_conflicts_impl(
        OUTPUT_DIR,
        period,
        pols_df,
        period_start,
        period_end,
        df_sidejobs,
        df_committees,
        df_memberships,
        log=log,
    )


def _export_party_profile(
    period: int, pols_df: pd.DataFrame, period_start: date
) -> None:
    """Build and write party_profile JSON for one period.

    Age is calculated as of the start of the period, not the current year.
    """
    _export_party_profile_impl(
        OUTPUT_DIR,
        period,
        pols_df,
        period_start,
        log=log,
    )


def export_period(
    period: int,
    period_start: date,
    period_end: date,
    *,
    df_politicians: pd.DataFrame,
    df_polls: pd.DataFrame,
    df_sidejobs: pd.DataFrame | None = None,
    df_committees: pd.DataFrame | None = None,
    df_memberships: pd.DataFrame | None = None,
) -> bool:
    """Export all JSON files for one parliament period.

    Returns False if required auxiliary files (embeddings, votes) are missing.
    """
    period_dir = DATA_DIR / str(period)
    emb_path = OUTPUTS_DIR / f"politician_embeddings_{period}.csv"

    if not emb_path.exists():
        log.warning("No embeddings for period %d, skipping", period)
        return False

    pols_df = df_politicians.assign(
        party_label=lambda df: df["party"].str.replace("\xad", "", regex=False)
    )

    # ── politicians ───────────────────────────────────────────────────────────
    _write(
        _period_output_dir(period) / "politicians.json",
        pols_df.filter(
            [
                "politician_id",
                "name",
                "party",
                "sex",
                "year_of_birth",
                "occupation",
                "education",
                "field_title",
            ]
        ).to_dict("records"),
    )

    # ── embeddings ────────────────────────────────────────────────────────────
    emb_df = pd.read_csv(emb_path)
    if "z" in emb_df.columns:
        log.warning("3D embeddings detected for period %d; exporting 2D only", period)
    if "politician_id" not in emb_df.columns:
        emb_df = emb_df.merge(
            pols_df.filter(["name", "politician_id"]), on="name", how="left"
        )
    _write(
        _period_output_dir(period) / "embeddings.json",
        {
            "dimensions": 2,
            "data": emb_df.filter(["politician_id", "x", "y"]).to_dict("records"),
        },
    )

    # ── votes ─────────────────────────────────────────────────────────────────
    votes_path = period_dir / "votes.csv"
    if not votes_path.exists():
        log.warning("No votes.csv for period %d, skipping", period)
        return False
    votes_df = pd.read_csv(votes_path)
    _write(
        _period_output_dir(period) / "votes.json",
        votes_df.filter(["politician_id", "poll_id", "answer"]).to_dict("records"),
    )

    # ── polls ─────────────────────────────────────────────────────────────────
    _write(
        _period_output_dir(period) / "polls.json",
        df_polls.filter(["poll_id", "topic"]).to_dict("records"),
    )

    # ── cohesion ──────────────────────────────────────────────────────────────
    # emb_df may already have a party column from save_embeddings; drop it to
    # avoid collision, then join the canonical party from pols_df.
    coh_df = compute_cohesion(
        emb_df.filter(["politician_id", "x", "y"]).merge(
            pols_df.filter(["politician_id", "party"]), on="politician_id", how="left"
        ),
        exclude_party="fraktionslos",
    )
    _write(_period_output_dir(period) / "cohesion.json", coh_df.to_dict("records"))

    # ── sidejobs ──────────────────────────────────────────────────────────────
    if df_sidejobs is not None:
        _export_sidejobs(period, pols_df, period_start, period_end, df_sidejobs)

    # ── conflicts ─────────────────────────────────────────────────────────────
    if (
        df_sidejobs is not None
        and df_committees is not None
        and df_memberships is not None
    ):
        _export_conflicts(
            period,
            pols_df,
            period_start,
            period_end,
            df_sidejobs,
            df_committees,
            df_memberships,
        )

    # ── party profile ─────────────────────────────────────────────────────────
    _export_party_profile(period, pols_df, period_start)

    log.info("Exported period %d", period)
    return True


def export_party_word_freq(period: int) -> None:
    """Export party_word_freq.csv to JSON for the frontend.

    Output: frontend/public/data/{period}/party_word_freq.json
    Format: {fraktion: [{wort, tfidf, rang}, ...], ...}
    """
    path = DATA_DIR / str(period) / "party_word_freq.csv"
    if not path.exists():
        log.warning(
            "party_word_freq.csv not found for period %d, skipping.",
            period,
        )
        return
    df = pd.read_csv(path)
    result = {}
    for fraktion, group in df.groupby("fraktion"):
        result[fraktion] = group[["wort", "tfidf", "rang"]].to_dict(orient="records")
    _write(_period_output_dir(period) / "party_word_freq.json", result)


def export_party_speech_stats(period: int) -> None:
    """Export party_speech_stats.csv to JSON for the frontend.

    Output: frontend/public/data/{period}/party_speech_stats.json
    Format: [{fraktion, redner_id, vorname, nachname, anzahl_reden,
    wortanzahl_gesamt}, ...]
    """
    path = DATA_DIR / str(period) / "party_speech_stats.csv"
    if not path.exists():
        log.warning(
            "party_speech_stats.csv not found for period %d, skipping.",
            period,
        )
        return
    df = pd.read_csv(path)
    _write(
        _period_output_dir(period) / "party_speech_stats.json",
        df.to_dict(orient="records"),
    )


def export_keyword_timeline(period: int) -> None:
    """Export keyword_timeline.json for the frontend.

    Output: frontend/public/data/{period}/keyword_timeline.json
    Skipped silently if no protocol XMLs exist for the period.
    """
    from .analysis.keyword_timeline import fetch_keyword_timeline

    xml_dir = DATA_DIR / str(period) / "plenary_protocols"
    if not xml_dir.exists() or not any(xml_dir.glob("*.xml")):
        log.warning(
            "No protocol XMLs for period %d, skipping keyword timeline.", period
        )
        return

    data = fetch_keyword_timeline(DATA_DIR / str(period))
    out = _period_output_dir(period)

    # Main file: backward-compatible schema (meta without party fields, terms only)
    _write(
        out / "keyword_timeline.json",
        {
            "meta": {
                "months": data["meta"]["months"],
                "total_words_per_month": data["meta"]["total_words_per_month"],
            },
            "terms": data["terms"],
        },
    )

    # Party file: lazy-loaded by the frontend when party features are used
    _write(
        out / "keyword_timeline_parties.json",
        {
            "parties": data["meta"]["parties"],
            "party_words": data["meta"]["party_words"],
            "by_party": data["by_party"],
        },
    )


def _drucksachen_cache_path(period: int, typ: str) -> Path:
    """Return the local cache file path for raw Drucksachen of one type.

    Stored in data/{period}/drucksachen_{slug}.json. The file is NOT committed
    to git — it is preserved between GitHub Actions runs via actions/cache.
    """
    slug = typ.lower().replace(" ", "_").replace("ß", "ss").replace("ö", "oe")
    return DATA_DIR / str(period) / f"drucksachen_{slug}.json"


def export_motions(period: int) -> None:
    """Fetch all Drucksachen for a period and write motions_stats.json
    and motions_titles.json.

    Raw records are cached in data/{period}/drucksachen_{typ}.json (preserved
    via GitHub Actions cache, not committed to git). If the cache file exists
    the API fetch is skipped entirely for that type.
    Skipped silently if DIP_API_KEY is not set.
    """
    import json
    import os

    if not os.environ.get("DIP_API_KEY"):
        log.warning(
            "DIP_API_KEY not set — skipping motions export for period %d.", period
        )
        return

    from .analysis.drucksachen import (
        _CANONICAL_PARTY_ORDER,
        compute_counts_by_party,
        compute_timeline,
        compute_top_authors,
        compute_word_freq,
        extract_party,
    )
    from .fetch.drucksachen import DRUCKSACHE_TYPEN, fetch_drucksachen

    stats: dict = {}
    all_titles: list[dict] = []

    for typ in DRUCKSACHE_TYPEN:
        cache_path = _drucksachen_cache_path(period, typ)

        cached: list[dict] = []
        since: str | None = None
        if cache_path.exists():
            cached = json.loads(cache_path.read_text(encoding="utf-8"))
            dates = [d["datum"] for d in cached if d.get("datum")]
            if dates:
                since = max(dates)

        new_docs = fetch_drucksachen(period, typ, since=since)

        # Merge: append only records not already in the cache (deduplicate by id).
        cached_ids = {d["id"] for d in cached if "id" in d}
        new_only = [d for d in new_docs if d.get("id") not in cached_ids]
        if new_only:
            log.info("%d new Drucksachen for %s/%s", len(new_only), period, typ)
        docs = cached + new_only

        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_text(
            json.dumps(docs, ensure_ascii=False, indent=None), encoding="utf-8"
        )

        if not docs:
            stats[typ] = {
                "counts_by_party": [],
                "timeline": {"months": [], "series": []},
                "word_freq": {},
                "top_authors": {},
            }
            continue

        counts = compute_counts_by_party(docs)
        active = {c["party"] for c in counts}
        ordered_parties = [p for p in _CANONICAL_PARTY_ORDER if p in active]

        stats[typ] = {
            "counts_by_party": counts,
            "timeline": compute_timeline(docs, ordered_parties),
            "word_freq": compute_word_freq(docs),
            "top_authors": compute_top_authors(docs),
        }

        for doc in docs:
            party = extract_party(doc)
            titel = doc.get("titel", "")
            if party and titel:
                all_titles.append(
                    {
                        "typ": typ,
                        "party": party,
                        "datum": doc.get("datum", ""),
                        "titel": titel,
                    }
                )

    out = _period_output_dir(period)
    _write(out / "motions_stats.json", stats)
    _write(out / "motions_titles.json", all_titles)


def export_periods(available: list[dict]) -> None:
    """Write the periods.json index file consumed by the frontend."""
    _write(OUTPUT_DIR / "periods.json", available)


def _period_is_exportable(period: int) -> bool:
    """Return True if a period has input data available (votes.csv exists)."""
    return (DATA_DIR / str(period) / "votes.csv").exists()


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = build_parser("Exportiere JSON-Dateien für das Frontend.")
    add_period_argument(parser)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    """Export JSON files for one or all periods."""
    configure_logging()
    args = parse_args(argv)

    periods_df = fetch_periods_df()
    if args.period is not None and args.period not in set(
        periods_df["bundestag_number"].astype(int)
    ):
        msg = f"Period {args.period} not found."
        raise SystemExit(msg)

    available: list[dict] = []

    for _, row in periods_df.iterrows():
        period = int(row["bundestag_number"])

        if _period_is_exportable(period):
            available.append(
                {
                    "wahlperiode": period,
                    "label": str(row.get("label", f"Wahlperiode {period}")),
                    "has_data": True,
                }
            )

        if args.period is not None and period != args.period:
            continue

        export_party_word_freq(period)
        export_party_speech_stats(period)
        export_keyword_timeline(period)
        export_motions(period)

    export_periods(available)
    log.info("Done. Exported %d periods.", len(available))


if __name__ == "__main__":
    main()
