import argparse
import csv
import logging
from datetime import UTC, datetime
from pathlib import Path

import pandas as pd
import requests
from requests.adapters import HTTPAdapter
from urllib3.util import Retry

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

BASE_URL = "https://www.abgeordnetenwatch.de/api/v2"
BUNDESTAG_PARLIAMENT_ID = 5
PAGE_SIZE = 100
# The abgeordnetenwatch API only covers Bundestag history from 2005 onward;
# the first legislature in the API is the 16th Bundestag (2005-2009).
FIRST_BUNDESTAG_NUMBER = 16

DATA_DIR = Path(__file__).parents[1] / "data"


def get_session() -> requests.Session:
    """Create a requests session with retry strategy."""
    session = requests.Session()
    retry_strategy = Retry(
        total=5,  # 5 attempts in total
        backoff_factor=1,  # wait 1s, 2s, 4s, 8s, 16s
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET"],
    )
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session


SESSION = get_session()


def fetch_all_v2(endpoint: str, params: dict | None = None) -> list:
    """Fetch all pages from a paginated API endpoint."""
    params = dict(params or {})  # copy to avoid mutating the caller's dict
    all_data = []
    range_start = 0
    while True:
        params.update(
            {"range_start": range_start, "range_end": range_start + PAGE_SIZE}
        )
        response = SESSION.get(f"{BASE_URL}/{endpoint}", params=params, timeout=15)
        response.raise_for_status()
        page = response.json()["data"]
        all_data.extend(page)
        if len(page) < PAGE_SIZE:
            break
        range_start += PAGE_SIZE
    return all_data


def upsert_periods() -> int:
    """Fetch all Bundestag legislature periods, upsert periods.csv, return current ID.

    Writes data/periods.csv (period_id, label) so the dashboard can list all
    available periods dynamically without hardcoding.
    """
    raw = fetch_all_v2(
        "parliament-periods",
        params={"parliament": BUNDESTAG_PARLIAMENT_ID},
    )
    legislatures = [p for p in raw if p["type"] == "legislature"]

    # Upsert into periods.csv
    path = DATA_DIR / "periods.csv"
    # Sort chronologically so position index == Bundestag ordinal number (1-based)
    legislatures.sort(key=lambda p: p["start_date_period"])
    df_api = pd.DataFrame(
        [
            {
                "period_id": p["id"],
                "label": p["label"],
                "bundestag_number": i + FIRST_BUNDESTAG_NUMBER,
            }
            for i, p in enumerate(legislatures)
        ]
    )
    if path.exists():
        df_existing = pd.read_csv(path).set_index("period_id")
        df_existing.update(df_api.set_index("period_id"))
        new = df_api[~df_api["period_id"].isin(df_existing.index)]
        if not new.empty:
            df_existing = pd.concat([df_existing, new.set_index("period_id")])
        df_existing.reset_index().to_csv(path, index=False)
    else:
        df_api.to_csv(path, index=False)

    # Find current active period
    today = datetime.now(tz=UTC).date().isoformat()
    for p in legislatures:
        if p["start_date_period"] <= today <= p["end_date_period"]:
            log.info("Current period: %s (id=%d)", p["label"], p["id"])
            return p["id"]
    msg = "No active Bundestag legislative period found."
    raise RuntimeError(msg)


def fetch_polls(period_id: int) -> pd.DataFrame:
    """Fetch all polls for a legislative period."""
    log.info("Fetching polls for period %d...", period_id)
    polls = fetch_all_v2("polls", params={"field_legislature": period_id})
    df = pd.DataFrame([{"poll_id": p["id"], "topic": p["label"]} for p in polls])
    log.info("Found %d polls.", len(df))
    return df


def fetch_politicians(period_id: int) -> tuple[pd.DataFrame, dict]:
    """Fetch politicians and return (df, mandate_id -> politician_id mapping)."""
    log.info("Fetching mandates (politicians)...")
    mandates = fetch_all_v2(
        "candidacies-mandates", params={"parliament_period": period_id}
    )

    politician_info = []
    seen_ids: set = set()
    mandate_to_politician = {}

    for m in mandates:
        pol = m["politician"]
        p_id = pol["id"]
        mandate_to_politician[m["id"]] = p_id

        if p_id not in seen_ids:
            memberships = m.get("fraction_membership", [])
            party = "Unknown"
            if memberships:
                # Find the currently active membership:
                # 1. No end_date (still active)
                # 2. Or the one with the latest end_date
                today = datetime.now(tz=UTC).date().isoformat()
                active = [
                    fm
                    for fm in memberships
                    if not fm.get("end_date") or fm.get("end_date") >= today
                ]
                # Fallback: if none are technically "active",
                # take the last one in the list
                current_membership = active[-1] if active else memberships[-1]
                party = current_membership.get("fraction", {}).get("label", "Unknown")

                # Strip legislative period suffix, e.g. "SPD (2021-2025)" -> "SPD"
                if " (" in party:
                    party = party.split(" (")[0]

            politician_info.append(
                {"politician_id": p_id, "name": pol["label"], "party": party}
            )
            seen_ids.add(p_id)

    df = pd.DataFrame(politician_info)
    log.info("Extracted %d unique politicians.", len(df))
    return df, mandate_to_politician


def fetch_votes(
    poll_ids: list, mandate_to_politician: dict, path: Path, *, append: bool
) -> None:
    """Fetch votes for the given polls and write (or append) to CSV.

    append=False: overwrite the file and write header.
    append=True: open in append mode, no header (file already has one).
    """
    mode = "a" if append else "w"
    n = len(poll_ids)
    log.info("Fetching votes for %d poll(s)...", n)
    with path.open(mode=mode, newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if not append:
            writer.writerow(["politician_id", "poll_id", "answer"])
        for i, poll_id in enumerate(poll_ids):
            log.info("[%d/%d] Fetching votes for poll %s...", i + 1, n, poll_id)
            try:
                votes = fetch_all_v2("votes", params={"poll": poll_id})
                for v in votes:
                    m_id = v.get("mandate", {}).get("id")
                    p_id = mandate_to_politician.get(m_id)
                    if p_id:
                        writer.writerow([p_id, poll_id, v["vote"]])
            except Exception:
                log.exception("Error fetching votes for poll %s", poll_id)


def upsert_polls(period_id: int) -> tuple[pd.DataFrame, list]:
    """Fetch all polls from API, upsert into existing CSV.

    Returns (full polls df, list of new poll_ids that weren't in the CSV yet).
    New poll_ids are the ones we still need to fetch votes for.
    """
    df_api = fetch_polls(period_id)
    path = DATA_DIR / str(period_id) / "polls.csv"

    if not path.exists():
        df_api.to_csv(path, index=False)
        log.info("No existing polls CSV — wrote %d polls.", len(df_api))
        return df_api, df_api["poll_id"].tolist()

    df_existing = pd.read_csv(path)
    known_ids = set(df_existing["poll_id"])
    new_poll_ids = [pid for pid in df_api["poll_id"] if pid not in known_ids]

    # Update existing rows (e.g. topic label changed) and append new ones
    df_merged = df_existing.set_index("poll_id")
    df_merged.update(df_api.set_index("poll_id"))
    if new_poll_ids:
        new_rows = df_api[df_api["poll_id"].isin(new_poll_ids)].set_index("poll_id")
        df_merged = pd.concat([df_merged, new_rows])
    df_merged.reset_index().to_csv(path, index=False)
    log.info("%d new poll(s), %d updated.", len(new_poll_ids), len(df_existing))
    return df_merged.reset_index(), new_poll_ids


def upsert_politicians(period_id: int) -> tuple[pd.DataFrame, dict]:
    """Fetch all politicians from API, upsert into existing CSV.

    Updates changed name/party fields and adds newly elected politicians.
    Returns (full politicians df, mandate_id -> politician_id mapping).
    """
    df_api, mandate_to_politician = fetch_politicians(period_id)
    path = DATA_DIR / str(period_id) / "politicians.csv"

    if not path.exists():
        df_api.to_csv(path, index=False)
        log.info("No existing politicians CSV — wrote %d politicians.", len(df_api))
        return df_api, mandate_to_politician

    df_existing = pd.read_csv(path)
    df_merged = df_existing.set_index("politician_id")
    df_merged.update(df_api.set_index("politician_id"))  # update changed name/party

    new_politicians = df_api[
        ~df_api["politician_id"].isin(df_existing["politician_id"])
    ]
    if not new_politicians.empty:
        df_merged = pd.concat([df_merged, new_politicians.set_index("politician_id")])
        log.info("%d new politician(s) added.", len(new_politicians))
    else:
        log.info("No new politicians.")

    df_merged.reset_index().to_csv(path, index=False)
    return df_merged.reset_index(), mandate_to_politician


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fetch/update Bundestag voting data from abgeordnetenwatch.de.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--period",
        type=int,
        default=None,
        metavar="INT",
        help="Legislative period ID (default: current active period)",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    period_id = args.period or upsert_periods()

    (DATA_DIR / str(period_id)).mkdir(parents=True, exist_ok=True)

    # Polls and politicians are always fetched (fast metadata endpoints).
    # Votes are only fetched for polls not yet in the CSV (the slow part).
    _, new_poll_ids = upsert_polls(period_id)
    _, mandate_to_politician = upsert_politicians(period_id)

    votes_path = DATA_DIR / str(period_id) / "votes.csv"
    if not new_poll_ids:
        log.info("No new polls — skipping vote fetching. All data is up to date.")
    else:
        fetch_votes(
            new_poll_ids,
            mandate_to_politician,
            votes_path,
            append=votes_path.exists(),
        )

    log.info("Done! Data saved to %s", DATA_DIR)


if __name__ == "__main__":
    main()
