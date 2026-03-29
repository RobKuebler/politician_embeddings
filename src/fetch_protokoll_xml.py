"""Download Plenarprotokoll XMLs from dserver.bundestag.de.

Reads dip_plenarprotokolle.csv and downloads missing XMLs.
Already-present files are skipped (upsert by file existence).

Usage:
    uv run src/fetch_protokoll_xml.py --wahlperiode 20
"""

import logging
import subprocess
from pathlib import Path

import pandas as pd

from .storage import DATA_DIR

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
        msg = f"{csv_path} nicht gefunden. Erst fetch_protokolle.py ausführen."
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


if __name__ == "__main__":
    import argparse

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )
    parser = argparse.ArgumentParser(description="Download Plenarprotokoll XMLs")
    parser.add_argument("--wahlperiode", type=int, required=True)
    args = parser.parse_args()

    periods_df = pd.read_csv(DATA_DIR / "periods.csv")
    match = periods_df[periods_df["bundestag_number"] == args.wahlperiode]
    if match.empty:
        msg = f"Wahlperiode {args.wahlperiode} nicht in periods.csv."
        raise SystemExit(msg)
    period_id = int(match.iloc[0]["period_id"])
    out_dir = DATA_DIR / str(period_id)

    log.info("Wahlperiode %d (period_id=%d)…", args.wahlperiode, period_id)
    n = fetch_protokoll_xmls(args.wahlperiode, out_dir)
    log.info("Fertig. %d neue XMLs.", n)
