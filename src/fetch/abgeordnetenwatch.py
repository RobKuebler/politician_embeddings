import argparse
import csv
import logging
import re
from datetime import UTC, datetime
from pathlib import Path

import pandas as pd
import requests
from requests.adapters import HTTPAdapter
from urllib3.util import Retry

from ..cli import (
    add_wahlperiode_argument,
    build_parser,
    configure_logging,
    write_github_output,
)
from ..storage import DATA_DIR

log = logging.getLogger(__name__)

BASE_URL = "https://www.abgeordnetenwatch.de/api/v2"
BUNDESTAG_PARLIAMENT_ID = 5
PAGE_SIZE = 1000  # API supports up to 1000 results per page
# The abgeordnetenwatch API only covers Bundestag history from 2005 onward;
# the first legislature in the API is the 16th Bundestag (2005-2009).
FIRST_BUNDESTAG_NUMBER = 16


def _period_id_for(wahlperiode: int) -> int:
    """Return the abgeordnetenwatch API period_id for a given wahlperiode.

    Reads DATA_DIR/periods.csv. Isolated from src.storage so that monkeypatching
    DATA_DIR in this module is sufficient for tests.
    """
    df = pd.read_csv(DATA_DIR / "periods.csv")
    match = df[df["bundestag_number"] == wahlperiode]
    if match.empty:
        msg = f"Wahlperiode {wahlperiode} nicht in periods.csv gefunden."
        raise ValueError(msg)
    return int(match.iloc[0]["period_id"])


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
        # range_end is the page size (not an absolute end position);
        # values > 1000 silently fall back to 100, breaking pagination.
        params.update({"range_start": range_start, "range_end": PAGE_SIZE})
        response = SESSION.get(f"{BASE_URL}/{endpoint}", params=params, timeout=15)
        response.raise_for_status()
        page = response.json().get("data") or []
        all_data.extend(page)
        if len(page) < PAGE_SIZE:
            break
        range_start += PAGE_SIZE
    return all_data


def upsert_periods() -> int:
    """Fetch all Bundestag legislature periods, upsert periods.csv, return wahlperiode.

    Writes data/periods.csv (period_id, bundestag_number, label, start_date, end_date)
    so the dashboard can list all available periods dynamically without hardcoding.
    Returns the bundestag_number (wahlperiode) of the currently active period.
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
                "start_date": p["start_date_period"],
                "end_date": p["end_date_period"],
            }
            for i, p in enumerate(legislatures)
        ]
    )
    if path.exists():
        df_existing = pd.read_csv(path).set_index("period_id")
        df_merged = df_api.set_index("period_id").combine_first(df_existing)
        df_merged.update(df_api.set_index("period_id"))
        df_merged.reset_index().to_csv(path, index=False)
    else:
        df_api.to_csv(path, index=False)

    # Find current active period and return its wahlperiode (bundestag_number)
    today = datetime.now(tz=UTC).date().isoformat()
    for i, p in enumerate(legislatures):
        end = p["end_date_period"] or "9999-12-31"
        if p["start_date_period"] <= today <= end:
            wahlperiode = i + FIRST_BUNDESTAG_NUMBER
            log.info("Current period: %s (wahlperiode=%d)", p["label"], wahlperiode)
            return wahlperiode
    msg = "No active Bundestag legislative period found."
    raise RuntimeError(msg)


def fetch_polls(period_id: int) -> pd.DataFrame:
    """Fetch all polls for a legislative period (uses abgeordnetenwatch period_id)."""
    log.info("Fetching polls for period_id %d...", period_id)
    polls = fetch_all_v2("polls", params={"field_legislature": period_id})
    df = pd.DataFrame([{"poll_id": p["id"], "topic": p["label"]} for p in polls])
    log.info("Found %d polls.", len(df))
    return df


def fetch_politicians(period_id: int) -> tuple[pd.DataFrame, dict]:
    """Fetch politicians for period_id. Returns (df, mandate_id -> politician_id)."""
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
                today = datetime.now(tz=UTC).date().isoformat()
                active = [
                    fm
                    for fm in memberships
                    if not fm.get("valid_until") or fm.get("valid_until") >= today
                ]
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
    poll_ids: list[int],
    mandate_to_politician: dict[int, int],
    path: Path,
    *,
    append: bool,
) -> None:
    """Fetch votes for the given polls and write (or append) to CSV.

    append=False: overwrite the file and write header.
    append=True: open in append mode, no header (file already has one).

    Votes are buffered per poll and written + flushed in one batch. This means
    a crash between polls leaves no partial data: find_polls_missing_votes
    would correctly re-detect the unfinished poll on the next run.
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
                # Use `or {}` to handle mandate=null (key exists, value is None):
                # v.get("mandate", {}) returns None for null, so .get("id") crashes.
                rows = []
                for v in votes:
                    m_id = (v.get("mandate") or {}).get("id")
                    p_id = mandate_to_politician.get(m_id)  # type: ignore[arg-type]
                    if p_id is not None and v.get("vote") is not None:
                        rows.append([p_id, poll_id, v.get("vote")])
                writer.writerows(rows)
                f.flush()  # durably written before moving to next poll
                log.info("  → %d votes written.", len(rows))
            except Exception:
                log.exception("Error fetching votes for poll %s", poll_id)


def find_polls_missing_votes(all_poll_ids: list[int], votes_path: Path) -> list[int]:
    """Return poll_ids that have no votes in votes.csv yet.

    Uses votes.csv (not polls.csv) as source of truth so that polls whose
    vote fetch previously failed are automatically retried on the next run.
    """
    if not votes_path.exists():
        return list(all_poll_ids)
    voted_ids = set(pd.read_csv(votes_path)["poll_id"].unique())
    return [pid for pid in all_poll_ids if pid not in voted_ids]


def upsert_polls(wahlperiode: int) -> tuple[pd.DataFrame, list]:
    """Fetch all polls from API, upsert into existing CSV.

    Returns (full polls df, list of new poll_ids that weren't in the CSV yet).
    New poll_ids are the ones we still need to fetch votes for.
    """
    period_id = _period_id_for(wahlperiode)
    df_api = fetch_polls(period_id)
    path = DATA_DIR / str(wahlperiode) / "polls.csv"

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


def fetch_politician_details(politician_ids: list[int]) -> pd.DataFrame:
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


def upsert_politicians(wahlperiode: int) -> tuple[pd.DataFrame, dict]:
    """Fetch all politicians from API, upsert into existing CSV.

    Updates changed name/party fields, adds newly elected politicians, and
    fetches detail fields (occupation, year_of_birth, etc.) for politicians
    where occupation is still unknown (incremental, no re-fetch).
    Returns (full politicians df, mandate_id -> politician_id mapping).
    """
    period_id = _period_id_for(wahlperiode)
    df_api, mandate_to_politician = fetch_politicians(period_id)
    path = DATA_DIR / str(wahlperiode) / "politicians.csv"

    if not path.exists():
        df_merged = df_api.copy()
        log.info("No existing politicians CSV — wrote %d politicians.", len(df_api))
    else:
        # Specify dtype=object for string columns so pandas doesn't coerce all-NaN
        # columns to float64. Without this, a column like field_title that has only
        # NaN values in the CSV is read as float64, and a subsequent .update() with
        # string values (e.g. "Dr.") raises TypeError.
        df_existing = pd.read_csv(
            path,
            dtype={
                "occupation": object,
                "field_title": object,
                "sex": object,
                "education": object,
            },
        )
        df_indexed = df_existing.set_index("politician_id")
        df_indexed.update(df_api.set_index("politician_id"))

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

    # Save mandate->politician mapping so upsert_sidejobs can build a cross-period
    # lookup
    mandate_df = pd.DataFrame(
        [
            {"mandate_id": k, "politician_id": v}
            for k, v in mandate_to_politician.items()
        ]
    )
    mandate_df.to_csv(DATA_DIR / str(wahlperiode) / "mandates.csv", index=False)

    return df_merged, mandate_to_politician


# German month names → month number for parsing job_title_extra date strings.
_MONTH_MAP = {
    "januar": 1,
    "februar": 2,
    "märz": 3,
    "april": 4,
    "mai": 5,
    "juni": 6,
    "juli": 7,
    "august": 8,
    "september": 9,
    "oktober": 10,
    "november": 11,
    "dezember": 12,
}

# Matches DD.MM.YYYY, DD.MM. YYYY, or DD.MM. (no year)
_RE_DMY = re.compile(r"(\d{1,2})\.(\d{1,2})\.\s*(\d{4})?")
# Matches German month + year, e.g. "Januar 2022"
_RE_MONTH_YEAR = re.compile(
    r"(" + "|".join(_MONTH_MAP) + r")\s+(\d{4})",
    re.IGNORECASE,
)
# Matches bare year, e.g. "ab 2026" or "bis 2025"
_RE_YEAR_ONLY = re.compile(r"\b(20\d{2})\b")


def _format_month_day(year: int, month: int, *, as_end: bool) -> str:
    """Return ISO date for the first or last day of a month."""
    if as_end:
        import calendar

        day = calendar.monthrange(year, month)[1]
        return f"{year:04d}-{month:02d}-{day:02d}"
    return f"{year:04d}-{month:02d}-01"


def _parse_date(
    text: str,
    *,
    fallback_year: int | None = None,
    as_end: bool = False,
) -> str | None:
    """Extract the first date from a German date string fragment.

    as_end=True makes bare-year hits resolve to Dec 31 instead of Jan 1,
    and bare-month hits resolve to the last day of that month.
    Returns an ISO date string (YYYY-MM-DD) or None.
    """
    m = _RE_DMY.search(text)
    if m:
        day, month = int(m.group(1)), int(m.group(2))
        if not (1 <= month <= 12 and 1 <= day <= 31):
            pass  # malformed date in source data (e.g. "30.0.2024"); skip
        else:
            year = int(m.group(3)) if m.group(3) else fallback_year
            return f"{year:04d}-{month:02d}-{day:02d}" if year else None

    m = _RE_MONTH_YEAR.search(text)
    if m:
        return _format_month_day(
            int(m.group(2)),
            _MONTH_MAP[m.group(1).lower()],
            as_end=as_end,
        )

    m = _RE_YEAR_ONLY.search(text)
    if m:
        year = int(m.group(1))
        return f"{year:04d}-12-31" if as_end else f"{year:04d}-01-01"

    # Bare month name without year — use fallback_year
    for name, num in _MONTH_MAP.items():
        if name in text.lower() and fallback_year:
            return _format_month_day(fallback_year, num, as_end=as_end)

    return None


def _parse_sidejob_dates(extra: str | None) -> tuple[str | None, str | None]:
    """Parse start/end dates from the job_title_extra field.

    Handles patterns like:
      "Einkommen ab 01.01.2022"
      "Einkommen ab 01.04.2025 bis 30.11.2025"
      "Einkommen bis 31.12.2023"
      "Einkommen vom 01.01.2022 bis 31.12.2022"
      "Einkommen ab Januar 2023"
      "Einkommen im Jahr 2022"
      "Einkommen Januar 2022 bis Dezember 2023"
    Returns (date_start, date_end) as ISO strings or None.
    """
    if not extra or not isinstance(extra, str):
        return None, None

    # "Einkommen im Jahr YYYY" → full year
    m = re.search(r"im Jahr\s+(\d{4})", extra)
    if m:
        year = m.group(1)
        return f"{year}-01-01", f"{year}-12-31"

    # Split on "bis" or " - " to separate start/end parts.
    parts = re.split(r"\s+bis\s+|\s+-\s+", extra, maxsplit=1)

    if len(parts) == 2:
        end_text = parts[1]
        start_text = parts[0]

        date_end = _parse_date(end_text, as_end=True)
        fallback_year = int(date_end[:4]) if date_end else None
        date_start = _parse_date(start_text, fallback_year=fallback_year)
        return date_start, date_end

    # Single part: either "ab ..." or "bis ..."
    text = parts[0]
    if re.search(r"\bab\b", text, re.IGNORECASE):
        return _parse_date(text), None
    if re.search(r"\bbis\b", text, re.IGNORECASE):
        return None, _parse_date(text, as_end=True)

    # Fallback: try to extract any date
    return _parse_date(text), None


def upsert_sidejobs(wahlperiode: int, mandate_to_politician: dict[int, int]) -> None:
    """Fetch all sidejobs, filter to this period's mandates, and save to CSV.

    The sidejobs API has no parliament_period filter, so we fetch everything
    and keep only entries whose mandate ID belongs to this period. This ensures
    each period's CSV contains only sidejobs disclosed under that legislature.
    Overwrites sidejobs.csv on every run so newly disclosed income is captured.
    """
    log.info("Fetching sidejobs...")
    raw = fetch_all_v2("sidejobs")

    rows = []
    for sj in raw:
        politician_id = None
        for mandate in sj.get("mandates") or []:
            pid = mandate_to_politician.get(mandate.get("id"))
            if pid is not None:
                politician_id = pid
                break
        if politician_id is None:
            continue

        org = sj.get("sidejob_organization") or {}
        topics = [t["label"] for t in (sj.get("field_topics") or [])]
        extra_text = sj.get("job_title_extra")
        if not extra_text:
            label = sj.get("label") or ""
            paren = re.search(r"\(([^)]+)\)", label)
            if paren:
                extra_text = paren.group(1)
        date_start, date_end = _parse_sidejob_dates(extra_text)
        rows.append(
            {
                "politician_id": politician_id,
                "job_title": sj.get("label"),
                "job_title_extra": sj.get("job_title_extra"),
                "organization": org.get("label"),
                "income_level": sj.get("income_level"),
                "income": sj.get("income"),
                "interval": sj.get("interval"),
                "created": sj.get("created"),
                "date_start": date_start,
                "date_end": date_end,
                "category": sj.get("category"),
                "topics": "|".join(topics),
            }
        )

    _cols = [
        "politician_id",
        "job_title",
        "job_title_extra",
        "organization",
        "income_level",
        "income",
        "interval",
        "created",
        "date_start",
        "date_end",
        "category",
        "topics",
    ]
    df = pd.DataFrame(rows, columns=_cols)
    path = DATA_DIR / str(wahlperiode) / "sidejobs.csv"
    df.to_csv(path, index=False)
    log.info("Saved %d sidejobs for Wahlperiode %d.", len(df), wahlperiode)


def upsert_committees(wahlperiode: int, mandate_to_politician: dict[int, int]) -> None:
    """Fetch committees and memberships for a period, save as CSVs.

    Produces two files:
      - committees.csv: committee_id, label, topics (pipe-separated)
      - committee_memberships.csv: politician_id, committee_id, role
    """
    period_id = _period_id_for(wahlperiode)
    log.info("Fetching committees for Wahlperiode %d...", wahlperiode)
    raw_committees = fetch_all_v2("committees", params={"field_legislature": period_id})
    committee_rows = []
    for c in raw_committees:
        topics = [t["label"] for t in (c.get("field_topics") or [])]
        committee_rows.append(
            {
                "committee_id": c["id"],
                "label": c["label"],
                "topics": "|".join(topics),
            }
        )
    df_committees = pd.DataFrame(
        committee_rows, columns=["committee_id", "label", "topics"]
    )
    path = DATA_DIR / str(wahlperiode) / "committees.csv"
    df_committees.to_csv(path, index=False)
    log.info("Saved %d committees.", len(df_committees))

    log.info("Fetching committee memberships...")
    raw_memberships = fetch_all_v2(
        "committee-memberships",
        params={"candidacy_mandate[entity.parliament_period]": period_id},
    )
    membership_rows = []
    for m in raw_memberships:
        mandate_id = (m.get("candidacy_mandate") or {}).get("id")
        p_id = mandate_to_politician.get(mandate_id)  # type: ignore[arg-type]
        if p_id is None:
            continue
        membership_rows.append(
            {
                "politician_id": p_id,
                "committee_id": (m.get("committee") or {}).get("id"),
                "role": m.get("committee_role"),
            }
        )
    df_memberships = pd.DataFrame(
        membership_rows, columns=["politician_id", "committee_id", "role"]
    )
    path = DATA_DIR / str(wahlperiode) / "committee_memberships.csv"
    df_memberships.to_csv(path, index=False)
    log.info("Saved %d committee memberships.", len(df_memberships))


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = build_parser("Lade und aktualisiere Bundestags-Abstimmungsdaten.")
    add_wahlperiode_argument(parser)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    configure_logging()
    args = parse_args(argv)
    wahlperiode = args.wahlperiode or upsert_periods()

    (DATA_DIR / str(wahlperiode)).mkdir(parents=True, exist_ok=True)

    df_polls, _ = upsert_polls(wahlperiode)
    _, mandate_to_politician = upsert_politicians(wahlperiode)
    upsert_sidejobs(wahlperiode, mandate_to_politician)
    upsert_committees(wahlperiode, mandate_to_politician)

    votes_path = DATA_DIR / str(wahlperiode) / "votes.csv"
    missing = find_polls_missing_votes(df_polls["poll_id"].tolist(), votes_path)
    if not missing:
        log.info("All votes up to date, nothing to fetch.")
        write_github_output(changed=False, wahlperiode=wahlperiode)
    else:
        log.info("%d poll(s) need vote fetching.", len(missing))
        fetch_votes(
            missing,
            mandate_to_politician,
            votes_path,
            append=votes_path.exists(),
        )
        write_github_output(
            changed=True,
            fetched_polls=len(missing),
            wahlperiode=wahlperiode,
        )

    log.info("Done! Data saved to %s", DATA_DIR / str(wahlperiode))


if __name__ == "__main__":
    main()
