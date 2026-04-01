"""Comprehensive tests for API parsing, upsert logic, and CSV storage integrity.

Each test targets a specific assumption in fetch/abgeordnetenwatch.py.
If a test fails, it reveals a real data integrity or crash risk.
"""

import pandas as pd

import src.fetch.abgeordnetenwatch
from src.fetch.abgeordnetenwatch import BASE_URL, _parse_sidejob_dates

# ─── Helpers ──────────────────────────────────────────────────────────────────


def _legislature(period_id, label, start, end):
    return {
        "id": period_id,
        "type": "legislature",
        "label": label,
        "start_date_period": start,
        "end_date_period": end,
    }


def _mandate(mandate_id, politician_id, name, party_label=None):
    memberships = (
        [{"fraction": {"label": party_label}, "valid_until": None}]
        if party_label
        else []
    )
    return {
        "id": mandate_id,
        "politician": {"id": politician_id, "label": name},
        "fraction_membership": memberships,
    }


def _sidejob(sj_id, mandate_ids, org_label="Firma GmbH"):
    return {
        "id": sj_id,
        "label": f"Job {sj_id}",
        "job_title_extra": None,
        "sidejob_organization": {"label": org_label} if org_label else None,
        "income_level": "1",
        "income": None,
        "interval": None,
        "created": 1_000_000,
        "category": None,
        "field_topics": [],
        "mandates": [{"id": mid} for mid in mandate_ids],
    }


def _mock_polls(requests_mock, polls):
    requests_mock.get(
        f"{BASE_URL}/polls",
        json={"data": [{"id": p["id"], "label": p["label"]} for p in polls]},
    )


def _mock_mandates(requests_mock, mandates):
    requests_mock.get(
        f"{BASE_URL}/candidacies-mandates",
        json={"data": mandates},
    )


def _mock_details(requests_mock, details):
    requests_mock.get(
        f"{BASE_URL}/politicians",
        json={"data": details},
    )


def _mock_periods(requests_mock, periods):
    requests_mock.get(
        f"{BASE_URL}/parliament-periods",
        json={"data": periods},
    )


# ─── fetch_votes: null / missing mandate ──────────────────────────────────────


def test_fetch_votes_null_mandate_skipped(requests_mock, tmp_path):
    """ASSUMPTION: v.get('mandate', {}).get('id') is safe when mandate=null.
    REALITY: {'mandate': null}.get('mandate', {}) returns None, then None.get('id')
    crashes.

    """
    requests_mock.get(
        f"{BASE_URL}/votes",
        json={
            "data": [
                {"vote": "yes", "mandate": None},  # null mandate — potential crash
                {"vote": "no", "mandate": {"id": 1000}},
            ]
        },
    )
    from src.fetch.abgeordnetenwatch import fetch_votes

    path = tmp_path / "votes.csv"
    fetch_votes([500], {1000: 42}, path, append=False)

    df = pd.read_csv(path)
    assert len(df) == 1
    assert df.iloc[0]["answer"] == "no"
    assert df.iloc[0]["politician_id"] == 42


def test_fetch_votes_missing_mandate_key_skipped(requests_mock, tmp_path):
    """Vote with no 'mandate' key at all is silently skipped."""
    requests_mock.get(
        f"{BASE_URL}/votes",
        json={"data": [{"vote": "yes"}]},  # no mandate key
    )
    from src.fetch.abgeordnetenwatch import fetch_votes

    path = tmp_path / "votes.csv"
    fetch_votes([500], {1: 1}, path, append=False)
    df = pd.read_csv(path)
    assert len(df) == 0


# ─── refresh_polls: correctness ────────────────────────────────────────────────


def test_refresh_polls_schreibt_csv(requests_mock, monkeypatch, tmp_path):
    """Polls werden von API geladen und als CSV gespeichert."""
    monkeypatch.setattr(src.fetch.abgeordnetenwatch, "DATA_DIR", tmp_path)
    pd.DataFrame(
        {
            "period_id": [111],
            "label": ["16. WP"],
            "bundestag_number": [20],
            "start_date": ["2005-10-18"],
            "end_date": ["2099-12-31"],
        }
    ).to_csv(tmp_path / "periods.csv", index=False)
    (tmp_path / "20").mkdir()
    _mock_polls(
        requests_mock, [{"id": 1, "label": "Poll A"}, {"id": 2, "label": "Poll B"}]
    )

    df = src.fetch.abgeordnetenwatch.refresh_polls(20)

    assert set(df["poll_id"]) == {1, 2}
    saved = pd.read_csv(tmp_path / "20" / "polls.csv")
    assert len(saved) == 2
    assert set(saved["poll_id"]) == {1, 2}


def test_refresh_polls_poll_id_stays_integer(requests_mock, monkeypatch, tmp_path):
    """poll_id muss int64 bleiben — float würde Downstream-Joins brechen."""
    monkeypatch.setattr(src.fetch.abgeordnetenwatch, "DATA_DIR", tmp_path)
    pd.DataFrame(
        {
            "period_id": [111],
            "label": ["16. WP"],
            "bundestag_number": [20],
            "start_date": ["2005-10-18"],
            "end_date": ["2099-12-31"],
        }
    ).to_csv(tmp_path / "periods.csv", index=False)
    (tmp_path / "20").mkdir()
    _mock_polls(requests_mock, [{"id": 1, "label": "A"}, {"id": 2, "label": "B"}])

    src.fetch.abgeordnetenwatch.refresh_polls(20)

    saved = pd.read_csv(tmp_path / "20" / "polls.csv")
    assert pd.api.types.is_integer_dtype(saved["poll_id"]), (
        f"poll_id dtype is {saved['poll_id'].dtype}, expected int"
    )


# ─── refresh_politicians: correctness ──────────────────────────────────────────


def _politicians_csv(period_dir, rows):
    """Write politicians.csv with all expected columns."""
    pd.DataFrame(
        rows,
        columns=[
            "politician_id",
            "name",
            "party",
            "occupation",
            "year_of_birth",
            "field_title",
            "sex",
            "education",
        ],
    ).to_csv(period_dir / "politicians.csv", index=False)


def test_refresh_politicians_first_run(requests_mock, monkeypatch, tmp_path):
    """First run: politicians.csv created and details fetched."""
    monkeypatch.setattr(src.fetch.abgeordnetenwatch, "DATA_DIR", tmp_path)
    pd.DataFrame(
        {
            "period_id": [111],
            "label": ["16. WP"],
            "bundestag_number": [20],
            "start_date": ["2005-10-18"],
            "end_date": ["2099-12-31"],
        }
    ).to_csv(tmp_path / "periods.csv", index=False)
    (tmp_path / "20").mkdir()
    _mock_mandates(requests_mock, [_mandate(100, 1, "Alice", "SPD")])
    _mock_details(
        requests_mock,
        [
            {
                "id": 1,
                "occupation": "Lehrerin",
                "year_of_birth": 1975,
                "field_title": None,
                "sex": "f",
                "education": "Uni",
            },
        ],
    )

    _df, mapping = src.fetch.abgeordnetenwatch.refresh_politicians(20)

    assert mapping[100] == 1
    saved = pd.read_csv(tmp_path / "20" / "politicians.csv")
    assert len(saved) == 1
    assert saved.iloc[0]["occupation"] == "Lehrerin"


def test_refresh_politicians_party_korrekt(requests_mock, monkeypatch, tmp_path):
    """Party aus API wird korrekt gespeichert."""
    monkeypatch.setattr(src.fetch.abgeordnetenwatch, "DATA_DIR", tmp_path)
    pd.DataFrame(
        {
            "period_id": [111],
            "label": ["16. WP"],
            "bundestag_number": [20],
            "start_date": ["2005-10-18"],
            "end_date": ["2099-12-31"],
        }
    ).to_csv(tmp_path / "periods.csv", index=False)
    (tmp_path / "20").mkdir()
    _mock_mandates(requests_mock, [_mandate(100, 1, "Alice", "CDU")])
    _mock_details(
        requests_mock,
        [
            {
                "id": 1,
                "occupation": "Lehrerin",
                "year_of_birth": 1975,
                "field_title": None,
                "sex": "f",
                "education": None,
            }
        ],
    )

    _df, _ = src.fetch.abgeordnetenwatch.refresh_politicians(20)

    saved = pd.read_csv(tmp_path / "20" / "politicians.csv")
    assert saved.iloc[0]["party"] == "CDU"
    assert saved.iloc[0]["occupation"] == "Lehrerin"


# ─── refresh_periods: correctness ──────────────────────────────────────────────


def test_refresh_periods_filters_out_elections(requests_mock, monkeypatch, tmp_path):
    """Only type=='legislature' rows go into periods.csv; elections are excluded."""
    monkeypatch.setattr(src.fetch.abgeordnetenwatch, "DATA_DIR", tmp_path)
    _mock_periods(
        requests_mock,
        [
            _legislature(111, "16. WP", "2000-01-01", "2099-12-31"),
            {
                "id": 999,
                "type": "election",
                "label": "Wahl 2005",
                "start_date_period": "2005-09-18",
                "end_date_period": "2005-09-18",
            },
        ],
    )

    src.fetch.abgeordnetenwatch.refresh_periods()

    saved = pd.read_csv(tmp_path / "periods.csv")
    assert 999 not in saved["period_id"].to_numpy()
    assert len(saved) == 1


def test_refresh_periods_bundestag_number_assigned_correctly(
    requests_mock, monkeypatch, tmp_path
):
    """bundestag_number starts at FIRST_BUNDESTAG_NUMBER=16, increments
    chronologically."""
    monkeypatch.setattr(src.fetch.abgeordnetenwatch, "DATA_DIR", tmp_path)
    _mock_periods(
        requests_mock,
        [
            _legislature(111, "16. WP", "2005-10-18", "2009-10-27"),
            _legislature(222, "17. WP", "2009-10-27", "2013-10-22"),
            _legislature(333, "18. WP", "2013-10-22", "2099-12-31"),
        ],
    )

    src.fetch.abgeordnetenwatch.refresh_periods()

    saved = pd.read_csv(tmp_path / "periods.csv").sort_values("start_date")
    assert saved["bundestag_number"].tolist() == [16, 17, 18]


def test_refresh_periods_label_aktuell(requests_mock, monkeypatch, tmp_path):
    """Label aus der API wird frisch geschrieben."""
    monkeypatch.setattr(src.fetch.abgeordnetenwatch, "DATA_DIR", tmp_path)
    _mock_periods(
        requests_mock, [_legislature(111, "16. WP Neu", "2005-10-18", "2099-12-31")]
    )

    src.fetch.abgeordnetenwatch.refresh_periods()

    saved = pd.read_csv(tmp_path / "periods.csv")
    assert len(saved) == 1
    assert saved.iloc[0]["label"] == "16. WP Neu"


def test_refresh_periods_period_id_stays_integer(requests_mock, monkeypatch, tmp_path):
    """period_id und bundestag_number müssen int64 bleiben."""
    monkeypatch.setattr(src.fetch.abgeordnetenwatch, "DATA_DIR", tmp_path)
    _mock_periods(
        requests_mock, [_legislature(111, "16. WP", "2005-10-18", "2099-12-31")]
    )

    src.fetch.abgeordnetenwatch.refresh_periods()

    saved = pd.read_csv(tmp_path / "periods.csv")
    assert pd.api.types.is_integer_dtype(saved["period_id"])
    assert pd.api.types.is_integer_dtype(saved["bundestag_number"])


# ─── refresh_sidejobs: date parsing from label ─────────────────────────────────


def test_refresh_sidejobs_dates_parsed_from_label_parentheses(
    requests_mock, monkeypatch, tmp_path
):
    """ASSUMPTION: date info is always in job_title_extra.
    REALITY: many sidejobs have job_title_extra=null but embed dates in the label,
    e.g. 'Mitglied des Aufsichtsrates (ab 01.01.2024)' or '... (bis Juni 2023)'.
    Without parsing these, active_months falls back to created/period_start and
    monthly jobs accumulate months they were never active for.
    """
    monkeypatch.setattr(src.fetch.abgeordnetenwatch, "DATA_DIR", tmp_path)
    period_dir = tmp_path / "20"
    period_dir.mkdir()

    sj_start = {
        **_sidejob(1, [100]),
        "label": "Mitglied des Aufsichtsrates (ab 01.06.2023)",
        "job_title_extra": None,
    }
    sj_end = {
        **_sidejob(2, [100]),
        "label": "Vermietung (bis 31.12.2023)",
        "job_title_extra": None,
    }
    sj_range = {
        **_sidejob(3, [100]),
        "label": "Wahlkampfleiter (01.01.2023 bis 30.06.2023)",
        "job_title_extra": None,
    }
    requests_mock.get(
        f"{BASE_URL}/sidejobs", json={"data": [sj_start, sj_end, sj_range]}
    )

    src.fetch.abgeordnetenwatch.refresh_sidejobs(20, {100: 1})

    saved = pd.read_csv(period_dir / "sidejobs.csv")
    assert saved.iloc[0]["date_start"] == "2023-06-01"
    assert pd.isna(saved.iloc[0]["date_end"])
    assert pd.isna(saved.iloc[1]["date_start"])
    assert saved.iloc[1]["date_end"] == "2023-12-31"
    assert saved.iloc[2]["date_start"] == "2023-01-01"
    assert saved.iloc[2]["date_end"] == "2023-06-30"


# ─── refresh_sidejobs: edge cases ──────────────────────────────────────────────


def test_refresh_sidejobs_null_organization_no_crash(
    requests_mock, monkeypatch, tmp_path
):
    """sidejob_organization=null: must not crash, organization column is NaN."""
    monkeypatch.setattr(src.fetch.abgeordnetenwatch, "DATA_DIR", tmp_path)
    period_dir = tmp_path / "20"
    period_dir.mkdir()
    requests_mock.get(
        f"{BASE_URL}/sidejobs", json={"data": [{**_sidejob(1, [100], org_label=None)}]}
    )

    src.fetch.abgeordnetenwatch.refresh_sidejobs(20, {100: 1})

    saved = pd.read_csv(period_dir / "sidejobs.csv")
    assert len(saved) == 1
    assert pd.isna(saved.iloc[0]["organization"])


def test_refresh_sidejobs_null_mandates_list_skipped(
    requests_mock, monkeypatch, tmp_path
):
    """Sidejob with mandates=null is silently skipped (not included in output)."""
    monkeypatch.setattr(src.fetch.abgeordnetenwatch, "DATA_DIR", tmp_path)
    period_dir = tmp_path / "20"
    period_dir.mkdir()
    sj = _sidejob(1, [])  # start with empty mandates
    sj["mandates"] = None  # override to null
    requests_mock.get(f"{BASE_URL}/sidejobs", json={"data": [sj]})

    src.fetch.abgeordnetenwatch.refresh_sidejobs(20, {100: 1})

    saved = pd.read_csv(period_dir / "sidejobs.csv")
    assert len(saved) == 0


def test_refresh_sidejobs_only_keeps_this_period(requests_mock, monkeypatch, tmp_path):
    """Sidejobs from other periods (mandate IDs not in this period) are filtered out."""
    monkeypatch.setattr(src.fetch.abgeordnetenwatch, "DATA_DIR", tmp_path)
    period_dir = tmp_path / "20"
    period_dir.mkdir()
    requests_mock.get(
        f"{BASE_URL}/sidejobs",
        json={
            "data": [
                _sidejob(1, [100]),  # this period's mandate → kept
                _sidejob(2, [9999]),  # different period's mandate → filtered
            ]
        },
    )

    src.fetch.abgeordnetenwatch.refresh_sidejobs(20, {100: 1})

    saved = pd.read_csv(period_dir / "sidejobs.csv")
    assert len(saved) == 1
    assert saved.iloc[0]["job_title"] == "Job 1"


def test_refresh_sidejobs_null_field_topics_no_crash(
    requests_mock, monkeypatch, tmp_path
):
    """field_topics=null must not crash; topics column is empty string."""
    monkeypatch.setattr(src.fetch.abgeordnetenwatch, "DATA_DIR", tmp_path)
    period_dir = tmp_path / "20"
    period_dir.mkdir()
    sj = _sidejob(1, [100])
    sj["field_topics"] = None
    requests_mock.get(f"{BASE_URL}/sidejobs", json={"data": [sj]})

    src.fetch.abgeordnetenwatch.refresh_sidejobs(20, {100: 1})

    saved = pd.read_csv(period_dir / "sidejobs.csv")
    assert len(saved) == 1


def test_refresh_sidejobs_mandate_without_id_key_skipped(
    requests_mock, monkeypatch, tmp_path
):
    """ASSUMPTION: mandate objects always have an 'id' key.
    REALITY: mandate_to_politician.get(mandate['id']) raises KeyError if 'id' is absent.
    """
    monkeypatch.setattr(src.fetch.abgeordnetenwatch, "DATA_DIR", tmp_path)
    period_dir = tmp_path / "20"
    period_dir.mkdir()
    sj = _sidejob(1, [])
    sj["mandates"] = [{"label": "no-id-key"}]  # mandate without 'id'
    requests_mock.get(f"{BASE_URL}/sidejobs", json={"data": [sj]})

    src.fetch.abgeordnetenwatch.refresh_sidejobs(20, {100: 1})

    saved = pd.read_csv(period_dir / "sidejobs.csv")
    assert len(saved) == 0  # should be silently skipped, not crash


# ─── fetch_votes: missing 'vote' key ─────────────────────────────────────────


def test_fetch_votes_missing_vote_key_skips_that_row(requests_mock, tmp_path):
    """ASSUMPTION: all vote objects have a 'vote' key.
    REALITY: v['vote'] raises KeyError if absent; the except block catches it and
    drops ALL votes for that entire poll — not just the malformed row.
    After fix: only the malformed row is skipped; valid votes in the same poll survive.
    """
    requests_mock.get(
        f"{BASE_URL}/votes",
        json={
            "data": [
                {"vote": "yes", "mandate": {"id": 1000}},  # valid
                {"mandate": {"id": 1001}},  # missing 'vote' key
            ]
        },
    )
    from src.fetch.abgeordnetenwatch import fetch_votes

    path = tmp_path / "votes.csv"
    fetch_votes([500], {1000: 1, 1001: 2}, path, append=False)

    df = pd.read_csv(path)
    assert len(df) == 1, (
        "Only the row with missing 'vote' key should be skipped; "
        "the valid vote for politician 1 must survive"
    )
    assert df.iloc[0]["politician_id"] == 1
    assert df.iloc[0]["answer"] == "yes"


# ─── fetch_committees ────────────────────────────────────────────────────────


def test_fetch_committees_empty_result(requests_mock, monkeypatch, tmp_path):
    """If API returns 0 committees, both returned DataFrames are empty with correct columns."""
    monkeypatch.setattr(src.fetch.abgeordnetenwatch, "DATA_DIR", tmp_path)
    pd.DataFrame(
        {
            "period_id": [111],
            "label": ["16. WP"],
            "bundestag_number": [20],
            "start_date": ["2005-10-18"],
            "end_date": ["2099-12-31"],
        }
    ).to_csv(tmp_path / "periods.csv", index=False)
    requests_mock.get(f"{BASE_URL}/committees", json={"data": []})
    requests_mock.get(f"{BASE_URL}/committee-memberships", json={"data": []})

    df_c, df_m = src.fetch.abgeordnetenwatch.fetch_committees(20, {})

    assert set(df_c.columns) == {"committee_id", "label", "topics"}
    assert len(df_c) == 0
    assert set(df_m.columns) == {"politician_id", "committee_id", "role"}
    assert len(df_m) == 0


def test_fetch_committees_null_candidacy_mandate_no_crash(
    requests_mock, monkeypatch, tmp_path
):
    """candidacy_mandate=null in API response must be handled gracefully."""
    monkeypatch.setattr(src.fetch.abgeordnetenwatch, "DATA_DIR", tmp_path)
    pd.DataFrame(
        {
            "period_id": [111],
            "label": ["16. WP"],
            "bundestag_number": [20],
            "start_date": ["2005-10-18"],
            "end_date": ["2099-12-31"],
        }
    ).to_csv(tmp_path / "periods.csv", index=False)
    requests_mock.get(f"{BASE_URL}/committees", json={"data": []})
    requests_mock.get(
        f"{BASE_URL}/committee-memberships",
        json={
            "data": [
                {
                    "candidacy_mandate": None,  # null, not missing
                    "committee": {"id": 42},
                    "committee_role": "member",
                }
            ]
        },
    )

    _, df_m = src.fetch.abgeordnetenwatch.fetch_committees(20, {1: 99})
    assert len(df_m) == 0  # row skipped — no matching politician


def test_fetch_committees_null_committee_no_crash(requests_mock, monkeypatch, tmp_path):
    """committee=null in a membership row must be skipped gracefully, not crash."""
    monkeypatch.setattr(src.fetch.abgeordnetenwatch, "DATA_DIR", tmp_path)
    pd.DataFrame(
        {
            "period_id": [111],
            "label": ["16. WP"],
            "bundestag_number": [20],
            "start_date": ["2005-10-18"],
            "end_date": ["2099-12-31"],
        }
    ).to_csv(tmp_path / "periods.csv", index=False)
    requests_mock.get(f"{BASE_URL}/committees", json={"data": []})
    requests_mock.get(
        f"{BASE_URL}/committee-memberships",
        json={
            "data": [
                {
                    "candidacy_mandate": {"id": 1},
                    "committee": None,  # null committee
                    "committee_role": "member",
                }
            ]
        },
    )

    _, df_m = src.fetch.abgeordnetenwatch.fetch_committees(20, {1: 99})
    assert len(df_m) == 1
    assert pd.isna(df_m.iloc[0]["committee_id"])


# ─── refresh_periods: null end_date_period ────────────────────────────────────


def test_refresh_periods_null_end_date_does_not_crash(
    requests_mock, monkeypatch, tmp_path
):
    """ASSUMPTION: end_date_period is always a string.
    REALITY: for an ongoing legislature the API may return end_date_period=null.
    'today <= None' raises TypeError — crashing the entire refresh_periods() call.
    """
    monkeypatch.setattr(src.fetch.abgeordnetenwatch, "DATA_DIR", tmp_path)
    _mock_periods(
        requests_mock,
        [
            {
                "id": 111,
                "type": "legislature",
                "label": "20. WP",
                "start_date_period": "2021-10-26",
                "end_date_period": None,  # ongoing — no end date yet
            }
        ],
    )

    period = src.fetch.abgeordnetenwatch.refresh_periods()
    assert period == 16  # FIRST_BUNDESTAG_NUMBER + 0 (only one period in mock)


# ─── fetch_all_v2: null data field ────────────────────────────────────────────


def test_fetch_all_v2_null_data_field_returns_empty(requests_mock):
    """ASSUMPTION: API always returns {"data": [...]} — a list.
    REALITY: some endpoints may return {"data": null} for empty results.
    page = None → all_data.extend(None) crashes with TypeError.
    After fix: null data is treated as an empty page and an empty list is returned.
    """
    requests_mock.get(
        f"{BASE_URL}/items",
        json={"data": None},
    )
    from src.fetch.abgeordnetenwatch import fetch_all_v2

    result = fetch_all_v2("items")
    assert result == []


# ─── _parse_sidejob_dates ─────────────────────────────────────────────────────


def test_parse_dates_none_input():
    """None and empty string both return (None, None) without crash."""
    assert _parse_sidejob_dates(None) == (None, None)
    assert _parse_sidejob_dates("") == (None, None)
    assert _parse_sidejob_dates(42) == (None, None)  # type: ignore[arg-type]


def test_parse_dates_im_jahr():
    """'im Jahr YYYY' → full-year range."""
    start, end = _parse_sidejob_dates("Einkommen im Jahr 2022")
    assert start == "2022-01-01"
    assert end == "2022-12-31"


def test_parse_dates_ab_full_date():
    """'ab DD.MM.YYYY' → start date, no end."""
    start, end = _parse_sidejob_dates("Einkommen ab 01.01.2022")
    assert start == "2022-01-01"
    assert end is None


def test_parse_dates_bis_full_date():
    """'bis DD.MM.YYYY' → no start, end on that day."""
    start, end = _parse_sidejob_dates("Einkommen bis 31.12.2023")
    assert start is None
    assert end == "2023-12-31"


def test_parse_dates_ab_bis_range():
    """'ab DD.MM.YYYY bis DD.MM.YYYY' → exact start and end."""
    start, end = _parse_sidejob_dates("Einkommen ab 01.04.2025 bis 30.11.2025")
    assert start == "2025-04-01"
    assert end == "2025-11-30"


def test_parse_dates_vom_bis_range():
    """'vom DD.MM.YYYY bis DD.MM.YYYY' → same as ab...bis."""
    start, end = _parse_sidejob_dates("Einkommen vom 01.01.2022 bis 31.12.2022")
    assert start == "2022-01-01"
    assert end == "2022-12-31"


def test_parse_dates_ab_month_name():
    """'ab Januar YYYY' → first day of that month."""
    start, end = _parse_sidejob_dates("Einkommen ab Januar 2023")
    assert start == "2023-01-01"
    assert end is None


def test_parse_dates_month_name_range():
    """'Januar YYYY bis Dezember YYYY' → first/last day of respective months."""
    start, end = _parse_sidejob_dates("Einkommen Januar 2022 bis Dezember 2023")
    assert start == "2022-01-01"
    assert end == "2023-12-31"


def test_parse_dates_partial_start_uses_end_year():
    """'ab DD.MM. bis DD.MM.YYYY' — start has no year; end year used as fallback."""
    start, end = _parse_sidejob_dates("Einkommen ab 01.04. bis 30.11.2025")
    assert start == "2025-04-01"
    assert end == "2025-11-30"


def test_parse_dates_year_only_ab():
    """'ab YYYY' → Jan 1 of that year."""
    start, end = _parse_sidejob_dates("ab 2026")
    assert start == "2026-01-01"
    assert end is None


def test_parse_dates_year_only_bis():
    """'bis YYYY' → Dec 31 of that year."""
    start, end = _parse_sidejob_dates("bis 2025")
    assert start is None
    assert end == "2025-12-31"


def test_parse_dates_year_range():
    """'ab YYYY bis YYYY' → Jan 1 to Dec 31 range."""
    start, end = _parse_sidejob_dates("Einkommen ab 2022 bis 2023")
    assert start == "2022-01-01"
    assert end == "2023-12-31"


def test_parse_dates_dash_separator():
    """'DD.MM.YYYY - DD.MM.YYYY' — dash separator same as bis."""
    start, end = _parse_sidejob_dates("01.01.2022 - 31.12.2022")
    assert start == "2022-01-01"
    assert end == "2022-12-31"


def test_parse_dates_end_is_last_day_of_month():
    """Month-only end date resolves to the last day of that month (not the 1st)."""
    _, end = _parse_sidejob_dates("2022-01-01 bis November 2022")
    assert end == "2022-11-30"  # November has 30 days


def test_parse_dates_feb_last_day_leap_year():
    """February in a leap year resolves to Feb 29."""
    _, end = _parse_sidejob_dates("2024-01-01 bis Februar 2024")
    assert end == "2024-02-29"
