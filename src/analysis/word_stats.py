"""Compute TF-IDF word statistics and speech stats from plenary protocol XMLs.

Parses data/{period}/plenary_protocols/*.xml directly and produces two CSVs:
  - party_word_freq.csv: top-N TF-IDF words per Fraktion
  - party_speech_stats.csv: speech count + word count per MdB

Usage:
    uv run python -m src.analysis.word_stats --period 20
"""

import argparse
import logging
import math
import re
from collections import Counter
from collections.abc import Iterable
from pathlib import Path
from typing import TYPE_CHECKING

import pandas as pd

from ..cli import add_period_argument, build_parser, configure_logging
from ..fetch.abgeordnetenwatch import refresh_periods
from ..parse.protocols import parse_alle_sitzungen
from ..paths import DATA_DIR

if TYPE_CHECKING:
    from HanTa.HanoverTagger import HanoverTagger

log = logging.getLogger(__name__)

# Lazy-loaded HanTa tagger — avoids import cost when module is imported but not used.
_tagger: "HanoverTagger | None" = None


def _get_tagger() -> "HanoverTagger":
    """Load HanTa German morphology tagger on first call and cache it."""
    global _tagger  # noqa: PLW0603 — deliberate module-level cache; single-process CLI only
    if _tagger is None:
        from HanTa.HanoverTagger import HanoverTagger as HanoverTaggerClass

        _tagger = HanoverTaggerClass("morphmodel_ger.pgz")
    return _tagger


def _lemmatize_tokens(tokens: list[str]) -> list[str]:
    """Lemmatize German tokens using HanTa.

    Hyphenated compounds (rheinland-pfalz) are kept verbatim — HanTa splits
    on hyphens and would only return the first component.

    Gender-marked forms (bürger*innen, lehrer:innen) have their marker
    stripped before lemmatization so HanTa receives a real word:
      bürger*innen → bürgerinnen → bürgerin
      ärzt*innen   → ärztinnen   → ärztin

    All other tokens go through HanTa's morphological analyzer directly.
    """
    if not tokens:
        return tokens

    tagger = _get_tagger()
    unique = list(set(tokens))

    # Hyphenated compounds: keep as-is
    lemma_map: dict[str, str] = {w: w for w in unique if "-" in w}

    # Gender-marked forms: strip marker, then lemmatize the resulting real word
    for word in unique:
        if "-" in word:
            continue
        if "*" in word or ":" in word:
            normalized = word.replace("*", "").replace(":", "")
            lemma = tagger.analyze(normalized)[0].lower()
            lemma_map[word] = (
                lemma if (lemma.isalpha() and len(lemma) >= 3) else normalized
            )

    # Regular tokens: lemmatize directly
    for word in unique:
        if word in lemma_map:
            continue
        lemma = tagger.analyze(word)[0].lower()
        lemma_map[word] = lemma if (lemma.isalpha() and len(lemma) >= 3) else word

    return [lemma_map.get(t, t) for t in tokens]


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
    "ganz",
    "genau",
    "deswegen",
    "nämlich",
    "möchten",
    "herzlich",
    "beispielsweise",
    "stelle",
    "innen",
    "dürfen",
    "müssen",
    "können",
    "während",
    "über",
    "für",
    "natürlich",
    "mögen",
    # Parliamentary-specific
    "herr",
    "frau",
    "damen",
    "herren",
    "dame",
    "gast",
    "gäste",
    "kolleginnen",
    "kollegen",
    "kollege",
    "kollegin",
    "präsident",
    "präsidentin",
    "vizepräsident",
    "vizepräsidentin",
    "bitte",
    "danke",
    "vielen",
    "liebe",
    "lieben",
    "geehrter",
    "geehrte",
    "geehrt",
    "geschätzt",
    "verehrt",
    "verehren",
    "zuschauer",
    "zuschauerin",
    "zuhörer",
    "zuhörerin",
    "zuhörend",
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

_PHRASE_TOKEN_BLACKLIST = {
    "dame",
    "gast",
    "gäste",
    "geehrt",
    "geschätzt",
    "kollege",
    "kollegen",
    "kollegin",
    "kolleginnen",
    "präsident",
    "präsidentin",
    "verehrt",
    "verehren",
    "vizepräsident",
    "vizepräsidentin",
    "zuhörer",
    "zuhörerin",
    "zuhörend",
    "zuschauer",
    "zuschauerin",
}


def _with_umlaut_variants(words: set[str]) -> set[str]:
    """Add common umlaut spellings for ASCII stopwords like fuer/über."""
    expanded = set(words)
    for word in words:
        expanded.add(word.replace("ae", "ä").replace("oe", "ö").replace("ue", "ü"))
    return expanded


# Expand the base set with ae/oe/ue → ä/ö/ü variants so tokens without proper
# umlaut encoding (common in older texts) are still filtered out.
_STOPWORDS = _with_umlaut_variants(_STOPWORDS)

_WORD_FREQ_COLS = ["fraktion", "wort", "tfidf", "rang"]
_SPEECH_STATS_COLS = [
    "fraktion",
    "redner_id",
    "vorname",
    "nachname",
    "anzahl_reden",
    "wortanzahl_gesamt",
]


# Gültige Token nach Edge-Stripping:
#   - Reine Buchstabenfolge:       "klimawandel", "migration"
#   - Bindestrich-Kompositum:      "rheinland-pfalz", "verbrenner-aus", "rot-grüne"
#   - Genderform mit * oder ::     "bürger*innen", "lehrer:innen"
# Ziffern, §, Schrägstrich etc. → ungültig
_VALID_TOKEN = re.compile(r"^[^\W\d_]+(?:[-*:][^\W\d_]+)*$", re.UNICODE)

# Nicht-Buchstaben (inkl. Ziffern) an Worträndern abstreifen:
# „Klimawandel" → Klimawandel | Hallo! → Hallo | 21.Wahlperiode → Wahlperiode
_EDGE_STRIP_RE = re.compile(r"^[\W\d_]+|[\W\d_]+$", re.UNICODE)

# Kurzformen wie "Besucher/-innen" oder "Lehrer/innen" vor dem generischen
# Slash-Splitting in eine zusammenhängende Genderform überführen.
_SLASH_GENDER_RE = re.compile(
    r"\b([^\W\d_]{3,})/(?:-)?(innen|in)\b", re.IGNORECASE | re.UNICODE
)


def _normalize_slash_gender(text: str) -> str:
    """Rewrite slash-shortcuts for gendered forms into a single token.

    Examples:
      Besucher/-innen → Besucher*innen
      Lehrer/innen    → Lehrer*innen
    """

    return _SLASH_GENDER_RE.sub(r"\1*\2", text)


def _preprocess_text(text: str) -> str:
    """Normalize whitespace variants and separator characters before tokenizing.

    Converts non-breaking spaces to regular spaces so they split correctly.
    En-dash and em-dash are sentence separators in Bundestag transcripts
    (not part of words) and are replaced with spaces.
    Slash-gender shortcuts like Besucher/-innen are normalized to a single token.
    All remaining slashes are replaced with spaces so CDU/CSU → two tokens.
    """
    text = _normalize_slash_gender(text)
    return (
        text.replace("\u00a0", " ")
        .replace("\u202f", " ")  # non-breaking spaces
        .replace("\u2013", " ")
        .replace("\u2014", " ")  # en-dash / em-dash
        .replace("/", " ")  # CDU/CSU → "CDU CSU"
    )


def _tokenize(text: str) -> list[str]:
    """Split text into clean lowercase tokens of at least 3 characters.

    Processing per token:
    1. Preprocess text: normalize whitespace, keep slash-gender shortcuts together,
       replace en-dashes and all remaining slashes.
    2. Strip non-letter characters from token edges (quotes, punctuation, digits).
    3. Strip leading/trailing hyphens and gender markers that ended up at the edge.
    4. Validate: token must consist only of letters, or letters connected by
       hyphens (Rheinland-Pfalz), asterisks (Bürger*innen), or colons (Lehrer:innen).
    5. Keep tokens >= 3 chars; common short words are removed by stopwords later.
    """
    tokens = []
    for raw in _preprocess_text(text).split():
        word = _EDGE_STRIP_RE.sub("", raw)
        word = word.strip("-*:")  # remove markers that ended up at edges
        if len(word) >= 3 and _VALID_TOKEN.match(word):
            tokens.append(word.lower())
    return tokens


def _iter_bigrams(tokens: list[str]) -> Iterable[tuple[str, str]]:
    """Yield adjacent token pairs in order."""
    import itertools

    return itertools.pairwise(tokens)


def _is_phrase_token_candidate(token: str) -> bool:
    """Return whether a token is suitable inside a concept phrase."""
    if token in _PHRASE_TOKEN_BLACKLIST:
        return False
    return not token.endswith(("fraktion", "bundestagsfraktion"))


def _build_phrase_tokens(tokens: list[str], min_count: int = 2) -> list[str]:
    """Return repeated adjacent bigrams as additional concept candidates.

    Only bigrams that occur at least ``min_count`` times within the same party
    are kept. This avoids flooding the cloud with one-off adjacency noise while
    still surfacing recurring concepts like "innere sicherheit".
    """
    if len(tokens) < 2:
        return []

    candidate_bigrams = [
        (first, second)
        for first, second in _iter_bigrams(tokens)
        if _is_phrase_token_candidate(first) and _is_phrase_token_candidate(second)
    ]
    bigram_counts = Counter(candidate_bigrams)
    phrases = []
    for first, second in candidate_bigrams:
        if bigram_counts[(first, second)] >= min_count:
            phrases.append(f"{first} {second}")
    return phrases


def compute_tfidf(
    party_texts: dict[str, str],
    stopwords: set[str],
    top_n: int = 100,
    *,
    lemmatize: bool = True,
    include_bigrams: bool = True,
) -> pd.DataFrame:
    """Compute TF-IDF top words per party.

    TF = word_count_in_party / total_words_in_party
    IDF = log(n_parties / n_parties_containing_word)
    Words in stopwords are excluded before computation.
    When lemmatize=True (default), German tokens are lemmatized via HanTa
    before counting so inflected forms merge (e.g. "rechtsextreme" → "rechtsextrem").
    When include_bigrams=True (default), repeated adjacent content-word pairs are
    added as additional phrase candidates so concept clouds can surface terms like
    "innere sicherheit".

    Returns DataFrame with columns: fraktion, wort, tfidf, rang.
    """
    party_tokens: dict[str, list[str]] = {
        party: _tokenize(text) for party, text in party_texts.items()
    }

    if lemmatize:
        all_tokens = [t for tokens in party_tokens.values() for t in tokens]
        all_lemmas = _lemmatize_tokens(all_tokens)
        idx = 0
        for party, tokens in party_tokens.items():
            n = len(tokens)
            party_tokens[party] = all_lemmas[idx : idx + n]
            idx += n

    party_tokens = {
        party: [t for t in tokens if t not in stopwords]
        for party, tokens in party_tokens.items()
    }
    if include_bigrams:
        party_tokens = {
            party: tokens + _build_phrase_tokens(tokens)
            for party, tokens in party_tokens.items()
        }

    n_parties = len(party_tokens)
    df_counts: Counter[str] = Counter()
    for tokens in party_tokens.values():
        for w in set(tokens):
            df_counts[w] += 1

    rows = []
    for party, tokens in party_tokens.items():
        if not tokens:
            continue
        total = len(tokens)
        tf = Counter(tokens)
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
    """Parse XMLs and write party_word_freq.csv + party_speech_stats.csv."""
    df = parse_alle_sitzungen(out_dir)
    df = df[~df["fraktion"].isin({"Unbekannt", "fraktionslos"})]
    log.info("Loaded speeches: %d", len(df))

    party_texts = (
        df.groupby("fraktion")["text"]
        .apply(lambda texts: " ".join(texts.dropna()))
        .to_dict()
    )
    word_freq_df = compute_tfidf(party_texts, stopwords=_STOPWORDS, top_n=top_n)
    word_freq_path = Path(out_dir) / "party_word_freq.csv"
    word_freq_df.to_csv(word_freq_path, index=False)
    log.info("party_word_freq.csv: %d entries", len(word_freq_df))

    speech_stats_df = compute_speech_stats(df)
    stats_path = Path(out_dir) / "party_speech_stats.csv"
    speech_stats_df.to_csv(stats_path, index=False)
    log.info("party_speech_stats.csv: %d MPs", len(speech_stats_df))


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = build_parser("Berechne TF-IDF-Wortstatistiken und Redestatistiken.")
    add_period_argument(parser)
    parser.add_argument(
        "--top-n",
        type=int,
        default=100,
        metavar="INT",
        help="Top-N Wörter pro Partei",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    configure_logging()
    args = parse_args(argv)

    period = args.period or refresh_periods()
    out_dir = DATA_DIR / str(period)

    log.info("Period %d...", period)
    fetch_word_stats(out_dir, top_n=args.top_n)
    log.info("Done.")


if __name__ == "__main__":
    main()
