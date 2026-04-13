# src/analysis/drucksachen.py
"""Compute statistics from DIP Drucksachen for the frontend motions page.

All functions operate on raw DIP API document dicts as returned by fetch_drucksachen().
"""

import logging
from collections import Counter, defaultdict

from .word_stats import _STOPWORDS, compute_tfidf

log = logging.getLogger(__name__)

# Maps DIP urheber.bezeichnung codes to canonical frontend party names.
# Canonical names must match PARTY_COLORS keys in frontend/lib/constants.ts.
_PARTY_NAME_MAP: dict[str, str] = {
    "AfD": "AfD",
    "CDU/CSU": "CDU/CSU",
    "SPD": "SPD",
    "LINKE": "Die Linke",
    "B90/GR": "Grüne",
    "BSW": "BSW",
    "FDP": "FDP",
}

# Exported for use by export.py to order timeline series consistently with the frontend.
_CANONICAL_PARTY_ORDER = ["CDU/CSU", "SPD", "AfD", "Grüne", "Die Linke", "BSW", "FDP"]

# Additional stopwords for parliamentary Drucksachen titles.
_DRUCKSACHEN_STOPWORDS: set[str] = _STOPWORDS | {
    "antrag",
    "anfrage",
    "bundesregierung",
    "antwort",
    "frage",
    "fragen",
    "stellen",
    "stelle",
    "bitte",
    "betreffend",
    "bereich",
    "weiteren",
    "weitere",
    "sowie",
    "bzw",
}


def extract_party(doc: dict) -> str | None:
    """Return the canonical party name from a DIP Drucksache urheber field.

    Returns None if the document has no known party (unknown codes, empty urheber).
    """
    for urheber in doc.get("urheber", []):
        bezeichnung = urheber.get("bezeichnung", "")
        name = _PARTY_NAME_MAP.get(bezeichnung)
        if name:
            return name
    return None


def _doc_month(doc: dict) -> str | None:
    """Extract YYYY-MM from a document's datum field.

    Returns None if missing or malformed.
    """
    datum = doc.get("datum", "")
    if len(datum) >= 7:
        return datum[:7]
    return None


def compute_counts_by_party(docs: list[dict]) -> list[dict]:
    """Count Drucksachen per party, sorted by count descending.

    Returns list of {party: str, count: int}. Excludes unknown parties.
    """
    counts: Counter[str] = Counter()
    for doc in docs:
        party = extract_party(doc)
        if party:
            counts[party] += 1
    return [{"party": p, "count": c} for p, c in counts.most_common()]


def compute_timeline(docs: list[dict], parties: list[str]) -> dict:
    """Compute monthly submission counts per party.

    Returns {months: [YYYY-MM, ...], series: [{party, counts: [int, ...]}, ...]}.
    months is sorted ascending. counts are parallel to months (zeros for absent months).
    """
    monthly: dict[str, Counter[str]] = defaultdict(Counter)
    all_months: set[str] = set()

    for doc in docs:
        month = _doc_month(doc)
        party = extract_party(doc)
        if month and party:
            monthly[month][party] += 1
            all_months.add(month)

    if not all_months:
        return {"months": [], "series": []}

    sorted_months = sorted(all_months)
    active_parties = {p for counter in monthly.values() for p in counter}
    series = [
        {"party": p, "counts": [monthly[m].get(p, 0) for m in sorted_months]}
        for p in parties
        if p in active_parties
    ]
    return {"months": sorted_months, "series": series}


def compute_word_freq(docs: list[dict]) -> dict[str, list[dict]]:
    """Compute TF-IDF word frequencies from Drucksachen titles per party.

    Reuses compute_tfidf() from word_stats but without lemmatization and bigrams
    (short titles, fast path). Returns {party: [{wort, tfidf, rang}, ...]}.
    """
    party_titles: dict[str, list[str]] = defaultdict(list)
    for doc in docs:
        party = extract_party(doc)
        titel = doc.get("titel", "")
        if party and titel:
            party_titles[party].append(titel)

    if not party_titles:
        return {}

    party_texts = {p: " ".join(titles) for p, titles in party_titles.items()}
    df = compute_tfidf(
        party_texts,
        stopwords=_DRUCKSACHEN_STOPWORDS,
        top_n=50,
        lemmatize=False,
        include_bigrams=False,
    )
    result: dict[str, list[dict]] = {}
    for party, group in df.groupby("fraktion"):
        result[str(party)] = group[["wort", "tfidf", "rang"]].to_dict("records")
    return result


def compute_top_authors(docs: list[dict], top_n: int = 10) -> dict[str, list[dict]]:
    """Find the top-N authors by submission count per party.

    Uses autoren_anzeige[].id to deduplicate authors across documents.
    Falls back to autor_titel as the dedup key when id is absent (older API records).
    Returns {party: [{vorname, nachname, anzahl}, ...]} sorted by anzahl desc.
    """
    # Nested dict: party -> author_id -> {vorname, nachname, anzahl}
    author_data: dict[str, dict[str, dict]] = defaultdict(dict)

    for doc in docs:
        party = extract_party(doc)
        if not party:
            continue
        for author in doc.get("autoren_anzeige", []):
            # Prefer numeric id; fall back to full name for older records without id.
            author_id = str(author.get("id", "")) or author.get("autor_titel", "")
            if not author_id:
                continue
            if author_id not in author_data[party]:
                full_name = author.get("autor_titel", "")
                parts = full_name.rsplit(" ", 1)
                vorname = parts[0] if len(parts) == 2 else ""
                nachname = parts[-1] if parts else ""
                author_data[party][author_id] = {
                    "vorname": vorname,
                    "nachname": nachname,
                    "anzahl": 0,
                }
            author_data[party][author_id]["anzahl"] += 1

    result: dict[str, list[dict]] = {}
    for party, authors in author_data.items():
        sorted_authors = sorted(authors.values(), key=lambda a: -a["anzahl"])
        result[party] = sorted_authors[:top_n]
    return result
