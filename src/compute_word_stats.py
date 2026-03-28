"""Compute TF-IDF word statistics and speech stats from speeches.csv.

Reads data/{period_id}/speeches.csv (written by parse_protokolle.py) and
produces two CSVs:
  - party_word_freq.csv: top-N TF-IDF words per Fraktion
  - party_speech_stats.csv: speech count + word count per MdB

Usage:
    uv run src/compute_word_stats.py --wahlperiode 20
"""

import logging
import math
from collections import Counter
from pathlib import Path

import pandas as pd

from .storage import DATA_DIR

log = logging.getLogger(__name__)

# German stopwords: parliamentary function words and common filler
_STOPWORDS: set[str] = {
    # Articles / pronouns
    "der",
    "die",
    "das",
    "den",
    "dem",
    "des",
    "ein",
    "eine",
    "einer",
    "einem",
    "eines",
    "ich",
    "sie",
    "er",
    "es",
    "wir",
    "ihr",
    "man",
    "mich",
    "mir",
    "sich",
    "uns",
    "euch",
    # Conjunctions / particles
    "und",
    "oder",
    "aber",
    "doch",
    "denn",
    "weil",
    "wenn",
    "dass",
    "ob",
    "also",
    "jedoch",
    "sondern",
    "damit",
    "obwohl",
    "waehrend",
    "bevor",
    "nachdem",
    # Prepositions
    "in",
    "im",
    "an",
    "am",
    "auf",
    "bei",
    "mit",
    "von",
    "zu",
    "zum",
    "zur",
    "fuer",
    "durch",
    "nach",
    "ueber",
    "unter",
    "um",
    "aus",
    "vor",
    "hinter",
    "bis",
    "seit",
    "gegen",
    "ohne",
    # Common verbs (inflected forms)
    "ist",
    "sind",
    "war",
    "waren",
    "hat",
    "haben",
    "hatte",
    "hatten",
    "wird",
    "werden",
    "wurde",
    "wurden",
    "worden",
    "sein",
    "kann",
    "koennen",
    "muss",
    "muessen",
    "soll",
    "sollen",
    "will",
    "wollen",
    "darf",
    "duerfen",
    "gibt",
    "geben",
    "gehen",
    "kommen",
    "machen",
    "sagen",
    "sehen",
    # Adverbs / particles
    "nicht",
    "noch",
    "auch",
    "schon",
    "nur",
    "sehr",
    "mehr",
    "als",
    "wie",
    "ja",
    "nein",
    "dann",
    "hier",
    "dort",
    "nun",
    "jetzt",
    "immer",
    "nie",
    "bereits",
    "wieder",
    "weiter",
    "mal",
    "einmal",
    "alle",
    "alles",
    "wohl",
    "etwa",
    "eben",
    "gerade",
    "zwar",
    "eigentlich",
    "natuerlich",
    "wirklich",
    # Parliamentary-specific
    "herr",
    "frau",
    "damen",
    "herren",
    "kolleginnen",
    "kollegen",
    "kollege",
    "bitte",
    "danke",
    "vielen",
    "liebe",
    "lieben",
    "geehrter",
    "geehrte",
    "bundesregierung",
    "bundesminister",
    "bundesministerin",
    "bundesrat",
    "bundestag",
    "abgeordnete",
    "abgeordneten",
    "fraktion",
    "fraktionen",
    "parlament",
    "sitzung",
    "tagesordnung",
    # Demonstratives / determiners
    "dieser",
    "diese",
    "dieses",
    "diesem",
    "diesen",
    "kein",
    "keine",
    "keiner",
    "keinem",
    "keines",
    "keinen",
    "mein",
    "meine",
    "unser",
    "unsere",
    "ihre",
    "seine",
}

_WORD_FREQ_COLS = ["fraktion", "wort", "tfidf", "rang"]
_SPEECH_STATS_COLS = [
    "fraktion",
    "redner_id",
    "vorname",
    "nachname",
    "anzahl_reden",
    "wortanzahl_gesamt",
]


def _tokenize(text: str) -> list[str]:
    """Lowercase, split on whitespace, keep only alphabetic tokens >= 4 chars."""
    return [w.lower() for w in text.split() if len(w) >= 4 and w.isalpha()]


def compute_tfidf(
    party_texts: dict[str, str],
    stopwords: set[str],
    top_n: int = 100,
) -> pd.DataFrame:
    """Compute TF-IDF top words per party.

    TF = word_count_in_party / total_words_in_party
    IDF = log(n_parties / n_parties_containing_word)
    Words in stopwords are excluded before computation.

    Returns DataFrame with columns: fraktion, wort, tfidf, rang.
    """
    # Tokenize and filter stopwords per party
    party_tokens: dict[str, list[str]] = {
        party: [t for t in _tokenize(text) if t not in stopwords]
        for party, text in party_texts.items()
    }

    n_parties = len(party_tokens)
    # Document frequency: how many parties contain each word
    df_counts: Counter = Counter()
    for tokens in party_tokens.values():
        for w in set(tokens):
            df_counts[w] += 1

    rows = []
    for party, tokens in party_tokens.items():
        if not tokens:
            continue
        total = len(tokens)
        tf = Counter(tokens)
        # When n_parties == 1, IDF would be 0; fall back to pure TF ranking.
        idf = {
            w: math.log(n_parties / df_counts[w]) if n_parties > 1 else 1.0 for w in tf
        }
        scores = {w: (count / total) * idf[w] for w, count in tf.items()}
        top = sorted(scores.items(), key=lambda x: -x[1])[:top_n]
        rows.extend(
            {"fraktion": party, "wort": wort, "tfidf": round(score, 6), "rang": rang}
            for rang, (wort, score) in enumerate(top, 1)
        )

    return pd.DataFrame(rows, columns=_WORD_FREQ_COLS)


def compute_speech_stats(speeches_df: pd.DataFrame) -> pd.DataFrame:
    """Aggregate speech count and word count per MdB.

    Returns DataFrame with columns: fraktion, redner_id, vorname, nachname,
    anzahl_reden, wortanzahl_gesamt — sorted by fraktion then wortanzahl_gesamt desc.
    """
    grouped = (
        speeches_df.groupby(
            ["fraktion", "redner_id", "vorname", "nachname"], sort=False
        )
        .agg(anzahl_reden=("rede_id", "count"), wortanzahl_gesamt=("wortanzahl", "sum"))
        .reset_index()
    )
    return (
        grouped.sort_values(["fraktion", "wortanzahl_gesamt"], ascending=[True, False])
        .reset_index(drop=True)
        .filter(_SPEECH_STATS_COLS)
    )


def fetch_word_stats(out_dir: Path, top_n: int = 100) -> None:
    """Read speeches.csv and write party_word_freq.csv + party_speech_stats.csv.

    Raises SystemExit if speeches.csv does not exist.
    """
    speeches_path = Path(out_dir) / "speeches.csv"
    if not speeches_path.exists():
        msg = f"{speeches_path} nicht gefunden. Erst parse_protokolle.py ausfuehren."
        raise SystemExit(msg)

    df = pd.read_csv(speeches_path)
    log.info("Geladene Reden: %d", len(df))

    # TF-IDF: combine all speech text per party
    party_texts = (
        df.groupby("fraktion")["text"]
        .apply(lambda texts: " ".join(texts.dropna()))
        .to_dict()
    )
    word_freq_df = compute_tfidf(party_texts, stopwords=_STOPWORDS, top_n=top_n)
    word_freq_path = Path(out_dir) / "party_word_freq.csv"
    word_freq_df.to_csv(word_freq_path, index=False)
    log.info("party_word_freq.csv: %d Eintraege", len(word_freq_df))

    speech_stats_df = compute_speech_stats(df)
    stats_path = Path(out_dir) / "party_speech_stats.csv"
    speech_stats_df.to_csv(stats_path, index=False)
    log.info("party_speech_stats.csv: %d MdBs", len(speech_stats_df))


if __name__ == "__main__":
    import argparse

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )
    parser = argparse.ArgumentParser(description="Compute word stats from speeches")
    parser.add_argument("--wahlperiode", type=int, required=True)
    parser.add_argument(
        "--top-n", type=int, default=100, help="Top-N Woerter pro Partei (default: 100)"
    )
    args = parser.parse_args()

    periods_df = pd.read_csv(DATA_DIR / "periods.csv")
    match = periods_df[periods_df["bundestag_number"] == args.wahlperiode]
    if match.empty:
        msg = f"Wahlperiode {args.wahlperiode} nicht in periods.csv."
        raise SystemExit(msg)
    period_id = int(match.iloc[0]["period_id"])
    out_dir = DATA_DIR / str(period_id)

    log.info("Wahlperiode %d (period_id=%d)…", args.wahlperiode, period_id)
    fetch_word_stats(out_dir, top_n=args.top_n)
    log.info("Fertig.")
