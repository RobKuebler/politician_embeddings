"""Download plenary protocol XMLs from dserver.bundestag.de.

Fetches protocol metadata directly from the DIP API and downloads each
XML whose file does not yet exist. Already-present files are skipped.

Usage:
    uv run python -m src.fetch.protocol_xml --period 20
"""

import argparse
import json
import logging
import os
import subprocess
import time
import urllib.parse
from pathlib import Path

from ..cli import (
    add_period_argument,
    build_parser,
    configure_logging,
    write_github_output,
)
from ..storage import DATA_DIR, current_period

log = logging.getLogger(__name__)

DIP_BASE_URL = "https://search.dip.bundestag.de/api/v1"
DIP_PAGE_SIZE = 100


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
    api_key = os.environ.get("DIP_API_KEY")
    if not api_key:
        msg = (
            "DIP_API_KEY is missing. Set it as an environment variable "
            "or GitHub Actions secret."
        )
        raise RuntimeError(msg)

    results = []
    cursor = None
    base_params: dict = {
        "format": "json",
        "apikey": api_key,
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


def _curl_download(url: str, path: Path) -> None:
    """Download url to path via curl.

    curl is used instead of requests to bypass the enodia bot-challenge.
    """
    result = subprocess.run(  # noqa: S603
        ["curl", "-s", "-o", str(path), "--retry", "3", url],  # noqa: S607
        capture_output=True,
        check=False,
    )
    if result.returncode != 0:
        stderr = result.stderr.decode(errors="replace").strip()
        msg = f"curl failed (exit {result.returncode}): {stderr}"
        raise RuntimeError(msg)


def fetch_protocol_xmls(period: int, out_dir: Path) -> int:
    """Download missing plenary protocol XMLs for a period.

    Fetches the list of protocols from the DIP API, then downloads each
    XML whose file does not yet exist. Returns count of newly downloaded files.
    """
    docs = fetch_dip_all(
        "plenarprotokoll",
        {"f.wahlperiode": period, "f.herausgeber": "BT"},
    )

    xml_dir = Path(out_dir) / "plenary_protocols"
    xml_dir.mkdir(exist_ok=True)

    downloaded = 0
    for doc in docs:
        if doc.get("herausgeber") != "BT":
            continue
        fundstelle = doc.get("fundstelle") or {}
        url = str(fundstelle.get("xml_url", "") or "").strip()
        dok_nr = doc.get("dokumentnummer", "?")
        if not url:
            log.warning("Protocol %s has no xml_url, skipping.", dok_nr)
            continue
        try:
            sitzungsnr = int(dok_nr.split("/")[-1])
        except (ValueError, IndexError):
            log.warning("Cannot parse sitzungsnummer from %r, skipping.", dok_nr)
            continue
        dest = xml_dir / f"{sitzungsnr:03d}.xml"
        if dest.exists():
            continue
        log.info("Downloading %s -> %s", url, dest.name)
        try:
            _curl_download(url, dest)
        except RuntimeError:
            dest.unlink(missing_ok=True)
            raise
        downloaded += 1

    log.info("Downloaded %d new XML files to %s", downloaded, xml_dir)
    return downloaded


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = build_parser("Lade fehlende XML-Dateien zu Bundestags-Plenarprotokollen.")
    add_period_argument(parser)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    configure_logging()
    args = parse_args(argv)

    period = args.period or current_period()
    out_dir = DATA_DIR / str(period)

    log.info("Period %d...", period)
    n = fetch_protocol_xmls(period, out_dir)
    write_github_output(
        changed=n > 0,
        downloaded_xmls=n,
        period=period,
        wahlperiode=period,
    )
    log.info("Done. %d new XML files.", n)


if __name__ == "__main__":
    main()
