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
PAGE_SIZE = 1000  # API supports up to 1000 results per page
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


def find_polls_missing_votes(all_poll_ids: list, votes_path: Path) -> list:
    """Return poll_ids that have no votes in votes.csv yet.

    Uses votes.csv (not polls.csv) as source of truth so that polls whose
    vote fetch previously failed are automatically retried on the next run.
    """
    if not votes_path.exists():
        return list(all_poll_ids)
    voted_ids = set(pd.read_csv(votes_path)["poll_id"].unique())
    return [pid for pid in all_poll_ids if pid not in voted_ids]


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


DETAIL_BATCH_SIZE = 200  # ids per id[in] request; keeps URLs well under limits


def fetch_politician_details(politician_ids: list) -> pd.DataFrame:
    """Fetch detail fields for politicians using batched id[in] queries.

    The API supports ?id[in]=[id1,id2,...] so we send one request per batch
    of DETAIL_BATCH_SIZE instead of one request per politician. On batch
    failure the whole batch falls back to None so the caller can retry.
    """
    rows = []
    n = len(politician_ids)
    log.info(
        "Fetching politician details for %d politicians in batches of %d...",
        n,
        DETAIL_BATCH_SIZE,
    )

    for batch_start in range(0, n, DETAIL_BATCH_SIZE):
        batch = politician_ids[batch_start : batch_start + DETAIL_BATCH_SIZE]
        log.info(
            "[%d/%d] Fetching detail batch...",
            min(batch_start + DETAIL_BATCH_SIZE, n),
            n,
        )
        try:
            id_list = "[" + ",".join(str(pid) for pid in batch) + "]"
            response = SESSION.get(
                f"{BASE_URL}/politicians",
                params={"id[in]": id_list, "range_start": 0, "range_end": len(batch)},
                timeout=30,
            )
            response.raise_for_status()
            fetched = {item["id"]: item for item in (response.json().get("data") or [])}
            for pid in batch:
                item = fetched.get(pid, {})
                rows.append(
                    {
                        "politician_id": pid,
                        "occupation": item.get("occupation"),
                        "year_of_birth": item.get("year_of_birth"),
                        "field_title": item.get("field_title"),
                        "sex": item.get("sex"),
                        "education": item.get("education"),
                    }
                )
        except Exception:  # noqa: BLE001
            log.warning(
                "Failed to fetch detail batch starting at index %d", batch_start
            )
            rows.extend(
                {
                    "politician_id": pid,
                    "occupation": None,
                    "year_of_birth": None,
                    "field_title": None,
                    "sex": None,
                    "education": None,
                }
                for pid in batch
            )
    return pd.DataFrame(rows)


def upsert_politicians(period_id: int) -> tuple[pd.DataFrame, dict]:
    """Fetch all politicians from API, upsert into existing CSV.

    Updates changed name/party fields, adds newly elected politicians, and
    fetches detail fields (occupation, year_of_birth, etc.) for politicians
    where occupation is still unknown (incremental, no re-fetch).
    Returns (full politicians df, mandate_id -> politician_id mapping).
    """
    df_api, mandate_to_politician = fetch_politicians(period_id)
    path = DATA_DIR / str(period_id) / "politicians.csv"

    if not path.exists():
        df_merged = df_api.copy()
        log.info("No existing politicians CSV — wrote %d politicians.", len(df_api))
    else:
        df_existing = pd.read_csv(path)
        df_indexed = df_existing.set_index("politician_id")
        df_indexed.update(
            df_api.set_index("politician_id")
        )  # update changed name/party

        new_politicians = df_api[
            ~df_api["politician_id"].isin(df_existing["politician_id"])
        ]
        if not new_politicians.empty:
            df_indexed = pd.concat(
                [df_indexed, new_politicians.set_index("politician_id")]
            )
            log.info("%d new politician(s) added.", len(new_politicians))
        else:
            log.info("No new politicians.")
        df_merged = df_indexed.reset_index()

    # Ensure detail columns exist (backwards compatible with old CSVs)
    detail_cols = ["occupation", "year_of_birth", "field_title", "sex", "education"]
    for col in detail_cols:
        if col not in df_merged.columns:
            df_merged[col] = pd.NA

    # Only fetch details for politicians where occupation is not yet known
    missing_ids = df_merged.loc[
        df_merged["occupation"].isna(), "politician_id"
    ].tolist()
    if missing_ids:
        log.info("%d politician(s) missing details, fetching...", len(missing_ids))
        df_details = fetch_politician_details(missing_ids)
        df_merged = df_merged.set_index("politician_id")
        df_merged.update(df_details.set_index("politician_id"))
        df_merged = df_merged.reset_index()

    df_merged.to_csv(path, index=False)
    return df_merged, mandate_to_politician


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
    # Votes are only fetched for polls without entries in votes.csv,
    # so that previously failed fetches are automatically retried.
    df_polls, _ = upsert_polls(period_id)
    _, mandate_to_politician = upsert_politicians(period_id)

    votes_path = DATA_DIR / str(period_id) / "votes.csv"
    missing = find_polls_missing_votes(df_polls["poll_id"].tolist(), votes_path)
    if not missing:
        log.info("All votes up to date, nothing to fetch.")
    else:
        log.info("%d poll(s) need vote fetching.", len(missing))
        fetch_votes(
            missing,
            mandate_to_politician,
            votes_path,
            append=votes_path.exists(),
        )

    log.info("Done! Data saved to %s", DATA_DIR)


if __name__ == "__main__":
    main()
