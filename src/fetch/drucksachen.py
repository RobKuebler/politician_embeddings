# src/fetch/drucksachen.py
"""Fetch parliamentary Drucksachen (Anträge, Anfragen) from the DIP Bundestag API."""

from .dip import fetch_dip_all

DRUCKSACHE_TYPEN = ["Antrag", "Kleine Anfrage", "Große Anfrage"]


def fetch_drucksachen(period: int, typ: str) -> list[dict]:
    """Fetch all Drucksachen of one type for a Wahlperiode.

    Uses cursor pagination via fetch_dip_all. Filters to Bundestag only.
    typ must be one of DRUCKSACHE_TYPEN.
    """
    return fetch_dip_all(
        "drucksache",
        {
            "f.drucksachetyp": typ,
            "f.herausgeber": "BT",
            "f.wahlperiode": period,
        },
    )
