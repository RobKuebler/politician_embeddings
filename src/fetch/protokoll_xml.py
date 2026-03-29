"""Download Plenarprotokoll XMLs from dserver.bundestag.de.

Reads dip_plenarprotokolle.csv and downloads missing XMLs.
Already-present files are skipped (upsert by file existence).

Usage:
    uv run python -m src.fetch.protokoll_xml --wahlperiode 20
"""

import argparse
import logging
import subprocess
from pathlib import Path

import pandas as pd

from ..cli import (
    add_wahlperiode_argument,
    build_parser,
    configure_logging,
    write_github_output,
)
from ..storage import DATA_DIR, current_wahlperiode

log = logging.getLogger(__name__)


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


def fetch_protokoll_xmls(wahlperiode: int, out_dir: Path) -> int:  # noqa: ARG001
    """Download missing Plenarprotokoll XMLs for a Wahlperiode.

    Reads dip_plenarprotokolle.csv from out_dir, downloads each XML whose
    file does not yet exist. Returns count of newly downloaded files.
    wahlperiode is accepted for API consistency but not used internally.
    """
    csv_path = Path(out_dir) / "dip_plenarprotokolle.csv"
    if not csv_path.exists():
        msg = f"{csv_path} nicht gefunden. Erst fetch/protokolle.py ausführen."
        raise SystemExit(msg)

    df = pd.read_csv(csv_path)
    xml_dir = Path(out_dir) / "plenarprotokolle"
    xml_dir.mkdir(exist_ok=True)

    downloaded = 0
    for _, row in df.iterrows():
        raw = row.get("xml_url", "")
        url = "" if pd.isna(raw) else str(raw).strip()
        if not url:
            log.warning(
                "Sitzung %s hat keine xml_url, übersprungen.", row.get("sitzungsnummer")
            )
            continue
        sitzungsnr = int(row["sitzungsnummer"])
        dest = xml_dir / f"{sitzungsnr:03d}.xml"
        if dest.exists():
            continue
        log.info("Lade %s → %s", url, dest.name)
        try:
            _curl_download(url, dest)
        except RuntimeError:
            dest.unlink(missing_ok=True)
            raise
        downloaded += 1

    log.info("%d neue XMLs heruntergeladen nach %s", downloaded, xml_dir)
    return downloaded


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = build_parser("Lade fehlende XML-Dateien zu Bundestags-Plenarprotokollen.")
    add_wahlperiode_argument(parser)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    configure_logging()
    args = parse_args(argv)

    wahlperiode = args.wahlperiode or current_wahlperiode()
    out_dir = DATA_DIR / str(wahlperiode)

    log.info("Wahlperiode %d…", wahlperiode)
    n = fetch_protokoll_xmls(wahlperiode, out_dir)
    write_github_output(changed=n > 0, downloaded_xmls=n, wahlperiode=wahlperiode)
    log.info("Fertig. %d neue XMLs.", n)


if __name__ == "__main__":
    main()
