# src/fetch/drucksachen.py
"""Fetch parliamentary Drucksachen (Anträge, Anfragen) from the DIP Bundestag API."""

from .dip import fetch_dip_all

DRUCKSACHE_TYPEN = ["Antrag", "Kleine Anfrage", "Große Anfrage"]


def fetch_drucksachen(period: int, typ: str, since: str | None = None) -> list[dict]:
    """Fetch Drucksachen of one type for a Wahlperiode.

    Uses cursor pagination via fetch_dip_all. Filters to Bundestag only.
    typ must be one of DRUCKSACHE_TYPEN.
    If since is given (ISO date string, e.g. "2024-11-01"), only records
    with datum >= since are fetched — used for incremental cache updates.
    """
    params: dict = {
        "f.drucksachetyp": typ,
        "f.herausgeber": "BT",
        "f.wahlperiode": period,
    }
    if since:
        params["f.datum.von"] = since
    return fetch_dip_all("drucksache", params)
