"""Fetch Plenarprotokolle from the DIP Bundestag API.

Writes CSV to data/{period_id}/dip_plenarprotokolle.csv.
Upsert: only new protocol IDs are appended.

Usage:
    uv run src/fetch_protokolle.py --wahlperiode 20
    uv run src/fetch_protokolle.py --wahlperiode 20 --limit 3
"""

import json
import logging
import subprocess
import time
import urllib.parse
from pathlib import Path

import pandas as pd

from .storage import DATA_DIR

log = logging.getLogger(__name__)

DIP_BASE_URL = "https://search.dip.bundestag.de/api/v1"
DIP_API_KEY = "OSOegLs.PR2lwJ1dwCeje9vTj7FPOt3hvpYKtwKkhw"
DIP_PAGE_SIZE = 100

# Reihenfolge der CSV-Spalten
_COLS = [
    "id",
    "dokumentnummer",
    "sitzungsnummer",
    "titel",
    "datum",
    "sitzungsbemerkung",
    "pdf_url",
    "xml_url",
    "vorgangsbezug_anzahl",
    "pdf_hash",
    "aktualisiert",
]


def _curl_get(url: str, params: dict) -> dict:
    """Make a GET request via curl and return parsed JSON.

    curl bypasses the enodia bot-challenge that blocks python-requests.
    Retries up to 5 times on empty or non-JSON responses.
    """
    full_url = f"{url}?{urllib.parse.urlencode(params)}"
    for attempt in range(5):
        result = subprocess.run(  # noqa: S603
            [  # noqa: S607
                "curl",
                "-s",
                "--retry",
                "3",
                "--retry-delay",
                "2",
                "--retry-connrefused",
                full_url,
            ],
            capture_output=True,
            check=False,
        )
        if result.returncode != 0:
            stderr = result.stderr.decode(errors="replace").strip()
            msg = f"curl failed (exit {result.returncode}): {stderr}"
            raise RuntimeError(msg)
        body = result.stdout.decode("utf-8")
        if not body.strip():
            wait = 2**attempt
            log.warning(
                "Empty response (attempt %d/5), retrying in %ds…", attempt + 1, wait
            )
            time.sleep(wait)
            continue
        try:
            return json.loads(body)
        except json.JSONDecodeError:
            wait = 2**attempt
            log.warning(
                "Non-JSON response (attempt %d/5), body: %.200s — retrying in %ds…",
                attempt + 1,
                body,
                wait,
            )
            time.sleep(wait)
    msg = "curl returned no valid JSON after 5 attempts"
    raise RuntimeError(msg)


def fetch_dip_all(endpoint: str, params: dict | None = None) -> list:
    """Fetch all records from a DIP endpoint using cursor pagination.

    Stops when a page returns fewer than DIP_PAGE_SIZE documents or
    when the response omits the cursor field.
    """
    results = []
    cursor = None
    base_params: dict = {
        "format": "json",
        "apikey": DIP_API_KEY,
        "limit": DIP_PAGE_SIZE,
    }
    if params:
        base_params.update(params)

    total_found = None
    while True:
        call_params = {**base_params}
        if cursor:
            call_params["cursor"] = cursor
        data = _curl_get(f"{DIP_BASE_URL}/{endpoint}", call_params)
        if total_found is None:
            total_found = data.get("numFound", "?")
        docs = data.get("documents", [])
        results.extend(docs)
        log.info("/%s: %d / %s records fetched…", endpoint, len(results), total_found)
        if len(docs) < DIP_PAGE_SIZE:
            break
        cursor = data.get("cursor")
        if not cursor:
            break

    log.info("Fetched %d records from /%s", len(results), endpoint)
    return results


def _doc_to_row(doc: dict) -> dict:
    """Convert a single DIP plenarprotokoll document to a flat CSV row dict."""
    fundstelle = doc.get("fundstelle") or {}
    # Sitzungsnummer aus "20/214" → 214
    dok_nr = doc.get("dokumentnummer", "")
    try:
        sitzungsnummer = int(dok_nr.split("/")[-1])
    except (ValueError, IndexError):
        sitzungsnummer = 0

    return {
        "id": int(doc["id"]),
        "dokumentnummer": dok_nr,
        "sitzungsnummer": sitzungsnummer,
        "titel": doc.get("titel", ""),
        "datum": doc.get("datum", ""),
        "sitzungsbemerkung": doc.get("sitzungsbemerkung", ""),
        "pdf_url": fundstelle.get("pdf_url", ""),
        "xml_url": fundstelle.get("xml_url", ""),
        "vorgangsbezug_anzahl": int(doc.get("vorgangsbezug_anzahl", 0)),
        "pdf_hash": doc.get("pdf_hash", ""),
        "aktualisiert": doc.get("aktualisiert", ""),
    }


def fetch_dip_plenarprotokolle(
    wahlperiode: int,
    out_dir: Path,
    limit: int | None = None,
) -> pd.DataFrame:
    """Fetch BT Plenarprotokolle for a Wahlperiode, upsert to CSV.

    Reads existing CSV (if any) to determine which IDs are already stored
    and which date to use as API start filter. Only new records are appended.
    Returns a DataFrame of the newly added rows (empty if nothing new).
    Note: limit is intended for testing only — a partial run does not resume
    where it left off; next run re-fetches from f.datum.start but correctly
    skips already-known IDs.
    """
    csv_path = Path(out_dir) / "dip_plenarprotokolle.csv"

    # Bestehende Daten laden
    existing_ids: set[int] = set()
    latest_datum: str | None = None
    if csv_path.exists():
        existing_df = pd.read_csv(csv_path)
        existing_ids = set(existing_df["id"].astype(int))
        if not existing_df.empty:
            latest_datum = existing_df["datum"].max()
        log.info(
            "Existing CSV: %d records, latest datum: %s",
            len(existing_ids),
            latest_datum,
        )

    # API-Parameter
    api_params: dict = {"f.wahlperiode": wahlperiode, "f.herausgeber": "BT"}
    if latest_datum:
        api_params["f.datum.start"] = latest_datum

    docs = fetch_dip_all("plenarprotokoll", api_params)

    # Nur BT-Dokumente, nur neue IDs
    new_rows = [
        _doc_to_row(d)
        for d in docs
        if d.get("herausgeber") == "BT" and int(d["id"]) not in existing_ids
    ]

    if not new_rows:
        log.info("No new protocols found.")
        return pd.DataFrame(columns=_COLS)

    # Aufsteigend nach datum sortieren (älteste zuerst)
    new_df = (
        pd.DataFrame(new_rows, columns=_COLS)
        .sort_values("datum")
        .reset_index(drop=True)
    )

    # Limit anwenden
    if limit is not None:
        new_df = new_df.head(limit)

    # An CSV anhängen (oder neu erstellen)
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    new_df.to_csv(csv_path, mode="a", header=len(existing_ids) == 0, index=False)
    log.info("Appended %d new records to %s", len(new_df), csv_path)

    return new_df


if __name__ == "__main__":
    import argparse

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )

    parser = argparse.ArgumentParser(description="Fetch DIP Plenarprotokolle")
    parser.add_argument(
        "--wahlperiode",
        type=int,
        required=True,
        help="Bundestag Wahlperiode (z.B. 20 oder 21)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Maximale Anzahl neuer Protokolle (für Tests)",
    )
    args = parser.parse_args()

    # period_id aus periods.csv ermitteln
    periods_df = pd.read_csv(DATA_DIR / "periods.csv")
    match = periods_df[periods_df["bundestag_number"] == args.wahlperiode]
    if match.empty:
        msg = f"Wahlperiode {args.wahlperiode} nicht in periods.csv gefunden."
        raise SystemExit(msg)
    period_id = int(match.iloc[0]["period_id"])
    out_dir = DATA_DIR / str(period_id)

    log.info(
        "Fetching Plenarprotokolle for Wahlperiode %d (period_id=%d)…",
        args.wahlperiode,
        period_id,
    )
    new_df = fetch_dip_plenarprotokolle(args.wahlperiode, out_dir, limit=args.limit)
    if new_df.empty:
        log.info("Nichts Neues.")
    else:
        log.info("%d neue Protokolle gespeichert nach %s", len(new_df), out_dir)
