"""Comprehensive tests for API parsing, upsert logic, and CSV storage integrity.

Each test targets a specific assumption in fetch_data.py.
If a test fails, it reveals a real data integrity or crash risk.
"""

import pandas as pd

import src.fetch_data
from src.fetch_data import BASE_URL, _parse_sidejob_dates

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
    from src.fetch_data import fetch_votes

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
    from src.fetch_data import fetch_votes

    path = tmp_path / "votes.csv"
    fetch_votes([500], {1: 1}, path, append=False)
    df = pd.read_csv(path)
    assert len(df) == 0


# ─── upsert_polls: correctness ────────────────────────────────────────────────


def test_upsert_polls_first_run_all_polls_new(requests_mock, monkeypatch, tmp_path):
    """First run: all polls returned as new, CSV created correctly."""
    monkeypatch.setattr(src.fetch_data, "DATA_DIR", tmp_path)
    (tmp_path / "111").mkdir()
    _mock_polls(
        requests_mock, [{"id": 1, "label": "Poll A"}, {"id": 2, "label": "Poll B"}]
    )

    _df, new_ids = src.fetch_data.upsert_polls(111)

    assert sorted(new_ids) == [1, 2]
    saved = pd.read_csv(tmp_path / "111" / "polls.csv")
    assert len(saved) == 2
    assert set(saved["poll_id"]) == {1, 2}


def test_upsert_polls_updates_topic(requests_mock, monkeypatch, tmp_path):
    """Existing poll with updated topic: topic is updated, no duplicate row."""
    monkeypatch.setattr(src.fetch_data, "DATA_DIR", tmp_path)
    period_dir = tmp_path / "111"
    period_dir.mkdir()
    pd.DataFrame({"poll_id": [1], "topic": ["Old Topic"]}).to_csv(
        period_dir / "polls.csv", index=False
    )
    _mock_polls(
        requests_mock, [{"id": 1, "label": "New Topic"}, {"id": 2, "label": "Poll B"}]
    )

    _df, new_ids = src.fetch_data.upsert_polls(111)

    saved = pd.read_csv(period_dir / "polls.csv")
    assert len(saved) == 2  # not 3 (no duplicate for poll 1)
    assert saved.loc[saved["poll_id"] == 1, "topic"].iloc[0] == "New Topic"
    assert new_ids == [2]


def test_upsert_polls_no_new_polls_returns_empty_list(
    requests_mock, monkeypatch, tmp_path
):
    """When all polls already known, new_poll_ids is empty."""
    monkeypatch.setattr(src.fetch_data, "DATA_DIR", tmp_path)
    period_dir = tmp_path / "111"
    period_dir.mkdir()
    pd.DataFrame({"poll_id": [1, 2], "topic": ["A", "B"]}).to_csv(
        period_dir / "polls.csv", index=False
    )
    _mock_polls(requests_mock, [{"id": 1, "label": "A"}, {"id": 2, "label": "B"}])

    _, new_ids = src.fetch_data.upsert_polls(111)
    assert new_ids == []


def test_upsert_polls_poll_id_stays_integer_after_upsert(
    requests_mock, monkeypatch, tmp_path
):
    """ASSUMPTION: poll_id stays int64 after upsert CSV roundtrip.
    REALITY: pandas can silently coerce int to float64 via index operations.
    """
    monkeypatch.setattr(src.fetch_data, "DATA_DIR", tmp_path)
    period_dir = tmp_path / "111"
    period_dir.mkdir()
    pd.DataFrame({"poll_id": [1], "topic": ["A"]}).to_csv(
        period_dir / "polls.csv", index=False
    )
    _mock_polls(requests_mock, [{"id": 1, "label": "A"}, {"id": 2, "label": "B"}])

    src.fetch_data.upsert_polls(111)

    saved = pd.read_csv(period_dir / "polls.csv")
    assert pd.api.types.is_integer_dtype(saved["poll_id"]), (
        f"poll_id dtype is {saved['poll_id'].dtype}, expected int — "
        "a float here would silently break downstream joins"
    )


# ─── upsert_politicians: correctness ──────────────────────────────────────────


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


def test_upsert_politicians_first_run(requests_mock, monkeypatch, tmp_path):
    """First run: CSV and mandates.csv created, details fetched."""
    monkeypatch.setattr(src.fetch_data, "DATA_DIR", tmp_path)
    (tmp_path / "111").mkdir()
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

    _df, mapping = src.fetch_data.upsert_politicians(111)

    assert mapping[100] == 1
    saved = pd.read_csv(tmp_path / "111" / "politicians.csv")
    assert len(saved) == 1
    assert saved.iloc[0]["occupation"] == "Lehrerin"
    assert (tmp_path / "111" / "mandates.csv").exists()


def test_upsert_politicians_party_update(requests_mock, monkeypatch, tmp_path):
    """Politician who switched parties: party updated, existing occupation preserved."""
    monkeypatch.setattr(src.fetch_data, "DATA_DIR", tmp_path)
    period_dir = tmp_path / "111"
    period_dir.mkdir()
    _politicians_csv(
        period_dir, [[1, "Alice", "SPD", "Lehrerin", 1975, None, "f", None]]
    )
    # API now says CDU — no details fetch expected (occupation already known)
    _mock_mandates(requests_mock, [_mandate(100, 1, "Alice", "CDU")])

    _df, _ = src.fetch_data.upsert_politicians(111)

    saved = pd.read_csv(period_dir / "politicians.csv")
    assert saved.iloc[0]["party"] == "CDU"
    assert saved.iloc[0]["occupation"] == "Lehrerin"  # must not be overwritten


def test_upsert_politicians_new_politician_appended(
    requests_mock, monkeypatch, tmp_path
):
    """New politician not yet in CSV is added and details fetched."""
    monkeypatch.setattr(src.fetch_data, "DATA_DIR", tmp_path)
    period_dir = tmp_path / "111"
    period_dir.mkdir()
    _politicians_csv(
        period_dir, [[1, "Alice", "SPD", "Lehrerin", 1975, None, "f", None]]
    )
    _mock_mandates(
        requests_mock,
        [
            _mandate(100, 1, "Alice", "SPD"),
            _mandate(200, 2, "Bob", "CDU"),
        ],
    )
    _mock_details(
        requests_mock,
        [
            {
                "id": 2,
                "occupation": "Jurist",
                "year_of_birth": 1980,
                "field_title": "Dr.",
                "sex": "m",
                "education": "Uni",
            },
        ],
    )

    _df, mapping = src.fetch_data.upsert_politicians(111)

    saved = pd.read_csv(period_dir / "politicians.csv")
    assert len(saved) == 2
    assert set(saved["politician_id"]) == {1, 2}
    assert mapping[200] == 2


def test_upsert_politicians_details_only_for_null_occupation(
    requests_mock, monkeypatch, tmp_path
):
    """CRITICAL: fetch_politician_details called only for occupation IS NULL.
    If it's called for Alice too, her occupation gets overwritten by the mock
    (which only knows Bob), exposing the bug.
    """
    monkeypatch.setattr(src.fetch_data, "DATA_DIR", tmp_path)
    period_dir = tmp_path / "111"
    period_dir.mkdir()
    _politicians_csv(
        period_dir,
        [
            [1, "Alice", "SPD", "Lehrerin", 1975, None, "f", None],  # occupation known
            [2, "Bob", "CDU", None, None, None, None, None],  # occupation missing
        ],
    )
    _mock_mandates(
        requests_mock,
        [
            _mandate(100, 1, "Alice", "SPD"),
            _mandate(200, 2, "Bob", "CDU"),
        ],
    )
    # Only Bob's details in the mock response
    _mock_details(
        requests_mock,
        [
            {
                "id": 2,
                "occupation": "Jurist",
                "year_of_birth": 1980,
                "field_title": None,
                "sex": "m",
                "education": None,
            },
        ],
    )

    _df, _ = src.fetch_data.upsert_politicians(111)

    saved = pd.read_csv(period_dir / "politicians.csv")
    alice = saved[saved["politician_id"] == 1].iloc[0]
    bob = saved[saved["politician_id"] == 2].iloc[0]
    assert alice["occupation"] == "Lehrerin", (
        "Alice's occupation must not be overwritten"
    )
    assert bob["occupation"] == "Jurist", "Bob's occupation must be filled from details"


def test_upsert_politicians_empty_string_occupation_is_refetched(
    requests_mock, monkeypatch, tmp_path
):
    """KNOWN LIMITATION: occupation='' in CSV is read back as NaN by pandas (default
    na_values include empty strings). This means a politician whose API occupation is
    null will have occupation=NaN in every run and their details will be re-fetched
    each time. This is wasteful but not data-corrupting.

    Test documents this behavior so any future fix is detectable.
    """
    monkeypatch.setattr(src.fetch_data, "DATA_DIR", tmp_path)
    period_dir = tmp_path / "111"
    period_dir.mkdir()
    _politicians_csv(
        period_dir,
        [
            [1, "Alice", "SPD", "", 1975, None, "f", None],  # empty string occupation
        ],
    )
    _mock_mandates(requests_mock, [_mandate(100, 1, "Alice", "SPD")])
    # Mock details — API returns null occupation for Alice
    _mock_details(
        requests_mock,
        [
            {
                "id": 1,
                "occupation": None,
                "year_of_birth": 1975,
                "field_title": None,
                "sex": "f",
                "education": None,
            },
        ],
    )

    _df, _ = src.fetch_data.upsert_politicians(111)

    saved = pd.read_csv(period_dir / "politicians.csv")
    # Empty string was converted to NaN by read_csv → details were re-fetched →
    # API returned null → occupation is still NaN (not "").
    # A fix would change this to "" or preserve it across the CSV roundtrip.
    assert pd.isna(saved.iloc[0]["occupation"])


# ─── upsert_periods: correctness ──────────────────────────────────────────────


def test_upsert_periods_filters_out_elections(requests_mock, monkeypatch, tmp_path):
    """Only type=='legislature' rows go into periods.csv; elections are excluded."""
    monkeypatch.setattr(src.fetch_data, "DATA_DIR", tmp_path)
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

    src.fetch_data.upsert_periods()

    saved = pd.read_csv(tmp_path / "periods.csv")
    assert 999 not in saved["period_id"].to_numpy()
    assert len(saved) == 1


def test_upsert_periods_bundestag_number_assigned_correctly(
    requests_mock, monkeypatch, tmp_path
):
    """bundestag_number starts at FIRST_BUNDESTAG_NUMBER=16, increments
    chronologically."""
    monkeypatch.setattr(src.fetch_data, "DATA_DIR", tmp_path)
    _mock_periods(
        requests_mock,
        [
            _legislature(111, "16. WP", "2005-10-18", "2009-10-27"),
            _legislature(222, "17. WP", "2009-10-27", "2013-10-22"),
            _legislature(333, "18. WP", "2013-10-22", "2099-12-31"),
        ],
    )

    src.fetch_data.upsert_periods()

    saved = pd.read_csv(tmp_path / "periods.csv").sort_values("start_date")
    assert saved["bundestag_number"].tolist() == [16, 17, 18]


def test_upsert_periods_label_updated_on_upsert(requests_mock, monkeypatch, tmp_path):
    """Existing period with updated label: label is updated in CSV, no duplicate."""
    monkeypatch.setattr(src.fetch_data, "DATA_DIR", tmp_path)
    # Pre-write CSV (simulating a previous run)
    pd.DataFrame(
        {
            "period_id": [111],
            "label": ["16. WP Alt"],
            "bundestag_number": [16],
            "start_date": ["2005-10-18"],
            "end_date": ["2099-12-31"],
        }
    ).to_csv(tmp_path / "periods.csv", index=False)

    _mock_periods(
        requests_mock,
        [
            _legislature(111, "16. WP Neu", "2005-10-18", "2099-12-31"),
        ],
    )

    src.fetch_data.upsert_periods()

    saved = pd.read_csv(tmp_path / "periods.csv")
    assert len(saved) == 1
    assert saved.iloc[0]["label"] == "16. WP Neu"


def test_upsert_periods_period_id_stays_integer_after_upsert(
    requests_mock, monkeypatch, tmp_path
):
    """ASSUMPTION: period_id and bundestag_number remain int64 after CSV upsert.
    combine_first can silently upcast int->float64 when NaN values appear during merge.
    """
    monkeypatch.setattr(src.fetch_data, "DATA_DIR", tmp_path)
    pd.DataFrame(
        {
            "period_id": [111],
            "label": ["16. WP"],
            "bundestag_number": [16],
            "start_date": ["2005-10-18"],
            "end_date": ["2099-12-31"],
        }
    ).to_csv(tmp_path / "periods.csv", index=False)

    _mock_periods(
        requests_mock,
        [
            _legislature(111, "16. WP", "2005-10-18", "2099-12-31"),
        ],
    )
    src.fetch_data.upsert_periods()

    saved = pd.read_csv(tmp_path / "periods.csv")
    assert pd.api.types.is_integer_dtype(saved["period_id"]), (
        f"period_id is {saved['period_id'].dtype} — float would corrupt ID comparisons"
    )
    assert pd.api.types.is_integer_dtype(saved["bundestag_number"]), (
        f"bundestag_number is {saved['bundestag_number'].dtype}"
    )


def test_upsert_periods_existing_only_rows_preserved(
    requests_mock, monkeypatch, tmp_path
):
    """If a period exists in CSV but not in API response, it is preserved (not deleted).
    Edge case: old legislature no longer returned by API.
    """
    monkeypatch.setattr(src.fetch_data, "DATA_DIR", tmp_path)
    pd.DataFrame(
        {
            "period_id": [111, 222],
            "label": ["16. WP", "17. WP"],
            "bundestag_number": [16, 17],
            "start_date": ["2005-10-18", "2009-10-27"],
            "end_date": ["2009-10-27", "2099-12-31"],
        }
    ).to_csv(tmp_path / "periods.csv", index=False)

    # API only returns period 222 (111 somehow disappeared)
    _mock_periods(
        requests_mock,
        [
            _legislature(222, "17. WP", "2009-10-27", "2099-12-31"),
        ],
    )
    src.fetch_data.upsert_periods()

    saved = pd.read_csv(tmp_path / "periods.csv")
    assert 111 in saved["period_id"].to_numpy(), "Existing-only period preserved"


# ─── upsert_sidejobs: date parsing from label ─────────────────────────────────


def test_upsert_sidejobs_dates_parsed_from_label_parentheses(
    requests_mock, monkeypatch, tmp_path
):
    """ASSUMPTION: date info is always in job_title_extra.
    REALITY: many sidejobs have job_title_extra=null but embed dates in the label,
    e.g. 'Mitglied des Aufsichtsrates (ab 01.01.2024)' or '... (bis Juni 2023)'.
    Without parsing these, active_months falls back to created/period_start and
    monthly jobs accumulate months they were never active for.
    """
    monkeypatch.setattr(src.fetch_data, "DATA_DIR", tmp_path)
    period_dir = tmp_path / "111"
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

    src.fetch_data.upsert_sidejobs(111, {100: 1})

    saved = pd.read_csv(period_dir / "sidejobs.csv")
    assert saved.iloc[0]["date_start"] == "2023-06-01"
    assert pd.isna(saved.iloc[0]["date_end"])
    assert pd.isna(saved.iloc[1]["date_start"])
    assert saved.iloc[1]["date_end"] == "2023-12-31"
    assert saved.iloc[2]["date_start"] == "2023-01-01"
    assert saved.iloc[2]["date_end"] == "2023-06-30"


# ─── upsert_sidejobs: edge cases ──────────────────────────────────────────────


def test_upsert_sidejobs_null_organization_no_crash(
    requests_mock, monkeypatch, tmp_path
):
    """sidejob_organization=null: must not crash, organization column is NaN."""
    monkeypatch.setattr(src.fetch_data, "DATA_DIR", tmp_path)
    period_dir = tmp_path / "111"
    period_dir.mkdir()
    requests_mock.get(
        f"{BASE_URL}/sidejobs", json={"data": [{**_sidejob(1, [100], org_label=None)}]}
    )

    src.fetch_data.upsert_sidejobs(111, {100: 1})

    saved = pd.read_csv(period_dir / "sidejobs.csv")
    assert len(saved) == 1
    assert pd.isna(saved.iloc[0]["organization"])


def test_upsert_sidejobs_null_mandates_list_skipped(
    requests_mock, monkeypatch, tmp_path
):
    """Sidejob with mandates=null is silently skipped (not included in output)."""
    monkeypatch.setattr(src.fetch_data, "DATA_DIR", tmp_path)
    period_dir = tmp_path / "111"
    period_dir.mkdir()
    sj = _sidejob(1, [])  # start with empty mandates
    sj["mandates"] = None  # override to null
    requests_mock.get(f"{BASE_URL}/sidejobs", json={"data": [sj]})

    src.fetch_data.upsert_sidejobs(111, {100: 1})

    saved = pd.read_csv(period_dir / "sidejobs.csv")
    assert len(saved) == 0


def test_upsert_sidejobs_only_keeps_this_period(requests_mock, monkeypatch, tmp_path):
    """Sidejobs from other periods (mandate IDs not in this period) are filtered out."""
    monkeypatch.setattr(src.fetch_data, "DATA_DIR", tmp_path)
    period_dir = tmp_path / "111"
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

    src.fetch_data.upsert_sidejobs(111, {100: 1})

    saved = pd.read_csv(period_dir / "sidejobs.csv")
    assert len(saved) == 1
    assert saved.iloc[0]["job_title"] == "Job 1"


def test_upsert_sidejobs_null_field_topics_no_crash(
    requests_mock, monkeypatch, tmp_path
):
    """field_topics=null must not crash; topics column is empty string."""
    monkeypatch.setattr(src.fetch_data, "DATA_DIR", tmp_path)
    period_dir = tmp_path / "111"
    period_dir.mkdir()
    sj = _sidejob(1, [100])
    sj["field_topics"] = None
    requests_mock.get(f"{BASE_URL}/sidejobs", json={"data": [sj]})

    src.fetch_data.upsert_sidejobs(111, {100: 1})

    saved = pd.read_csv(period_dir / "sidejobs.csv")
    assert len(saved) == 1


def test_upsert_sidejobs_mandate_without_id_key_skipped(
    requests_mock, monkeypatch, tmp_path
):
    """ASSUMPTION: mandate objects always have an 'id' key.
    REALITY: mandate_to_politician.get(mandate['id']) raises KeyError if 'id' is absent.
    """
    monkeypatch.setattr(src.fetch_data, "DATA_DIR", tmp_path)
    period_dir = tmp_path / "111"
    period_dir.mkdir()
    sj = _sidejob(1, [])
    sj["mandates"] = [{"label": "no-id-key"}]  # mandate without 'id'
    requests_mock.get(f"{BASE_URL}/sidejobs", json={"data": [sj]})

    src.fetch_data.upsert_sidejobs(111, {100: 1})

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
    from src.fetch_data import fetch_votes

    path = tmp_path / "votes.csv"
    fetch_votes([500], {1000: 1, 1001: 2}, path, append=False)

    df = pd.read_csv(path)
    assert len(df) == 1, (
        "Only the row with missing 'vote' key should be skipped; "
        "the valid vote for politician 1 must survive"
    )
    assert df.iloc[0]["politician_id"] == 1
    assert df.iloc[0]["answer"] == "yes"


# ─── upsert_committees: empty DataFrames ─────────────────────────────────────


def test_upsert_committees_empty_result_has_headers(
    requests_mock, monkeypatch, tmp_path
):
    """If API returns 0 committees, committees.csv must still have column headers.
    pd.DataFrame([]).to_csv() produces a file with no columns → EmptyDataError on read.
    """
    monkeypatch.setattr(src.fetch_data, "DATA_DIR", tmp_path)
    period_dir = tmp_path / "111"
    period_dir.mkdir()
    requests_mock.get(f"{BASE_URL}/committees", json={"data": []})
    requests_mock.get(f"{BASE_URL}/committee-memberships", json={"data": []})

    src.fetch_data.upsert_committees(111, {})

    committees = pd.read_csv(period_dir / "committees.csv")
    assert set(committees.columns) == {"committee_id", "label", "topics"}
    assert len(committees) == 0

    memberships = pd.read_csv(period_dir / "committee_memberships.csv")
    assert set(memberships.columns) == {"politician_id", "committee_id", "role"}
    assert len(memberships) == 0


def test_upsert_committees_null_candidacy_mandate_no_crash(
    requests_mock, monkeypatch, tmp_path
):
    """ASSUMPTION: candidacy_mandate is always a dict.
    REALITY: the API may return candidacy_mandate=null (key present, value None).
    m.get("candidacy_mandate", {}) returns None for null, not {}, so .get("id") crashes.
    """
    monkeypatch.setattr(src.fetch_data, "DATA_DIR", tmp_path)
    period_dir = tmp_path / "111"
    period_dir.mkdir()
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

    # Must not raise AttributeError: 'NoneType' object has no attribute 'get'
    src.fetch_data.upsert_committees(111, {1: 99})

    memberships = pd.read_csv(period_dir / "committee_memberships.csv")
    assert len(memberships) == 0  # row skipped — no matching politician


def test_upsert_committees_null_committee_no_crash(
    requests_mock, monkeypatch, tmp_path
):
    """committee=null in a membership row must be skipped gracefully, not crash."""
    monkeypatch.setattr(src.fetch_data, "DATA_DIR", tmp_path)
    period_dir = tmp_path / "111"
    period_dir.mkdir()
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

    # Must not raise AttributeError: 'NoneType' object has no attribute 'get'
    src.fetch_data.upsert_committees(111, {1: 99})

    memberships = pd.read_csv(period_dir / "committee_memberships.csv")
    # Row was written, but committee_id is None
    assert len(memberships) == 1
    assert pd.isna(memberships.iloc[0]["committee_id"])


# ─── upsert_periods: null end_date_period ────────────────────────────────────


def test_upsert_periods_null_end_date_does_not_crash(
    requests_mock, monkeypatch, tmp_path
):
    """ASSUMPTION: end_date_period is always a string.
    REALITY: for an ongoing legislature the API may return end_date_period=null.
    'today <= None' raises TypeError — crashing the entire upsert_periods() call.
    """
    monkeypatch.setattr(src.fetch_data, "DATA_DIR", tmp_path)
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

    period_id = src.fetch_data.upsert_periods()
    assert period_id == 111


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
    from src.fetch_data import fetch_all_v2

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


def test_parse_dates_feb_last_day_non_leap_year():
    """February in a non-leap year resolves to Feb 28."""
    _, end = _parse_sidejob_dates("2023-01-01 bis Februar 2023")
    assert end == "2023-02-28"


# ─── fetch_politician_details ─────────────────────────────────────────────────


def test_fetch_politician_details_returns_all_rows(requests_mock):
    """Every requested ID gets exactly one row, even if the API returns fewer."""
    requests_mock.get(
        f"{BASE_URL}/politicians",
        json={
            "data": [
                {
                    "id": 1,
                    "occupation": "Arzt",
                    "year_of_birth": 1970,
                    "field_title": None,
                    "sex": "m",
                    "education": "Uni",
                },
                # id=2 not returned by API (unknown / deleted)
            ]
        },
    )
    from src.fetch_data import fetch_politician_details

    df = fetch_politician_details([1, 2])

    assert len(df) == 2
    assert df[df["politician_id"] == 1].iloc[0]["occupation"] == "Arzt"
    # id=2 missing from API → all-null details, will be retried next run
    row2 = df[df["politician_id"] == 2].iloc[0]
    assert pd.isna(row2["occupation"])
    assert pd.isna(row2["year_of_birth"])


def test_fetch_politician_details_multi_batch(requests_mock, monkeypatch):
    """With DETAIL_BATCH_SIZE=2 and 5 politicians, 3 API requests are sent."""
    monkeypatch.setattr(src.fetch_data, "DETAIL_BATCH_SIZE", 2)
    requests_mock.get(
        f"{BASE_URL}/politicians",
        json={"data": []},  # empty responses are fine — politicians get null details
    )
    from src.fetch_data import fetch_politician_details

    df = fetch_politician_details([1, 2, 3, 4, 5])

    assert len(df) == 5
    assert requests_mock.call_count == 3  # ceil(5/2) = 3 batches


def test_fetch_politician_details_batch_exception_yields_null_row(requests_mock):
    """On a batch HTTP error, all politicians in that batch get null details."""
    requests_mock.get(f"{BASE_URL}/politicians", status_code=500)

    from src.fetch_data import fetch_politician_details

    df = fetch_politician_details([1, 2])

    assert len(df) == 2
    for _, row in df.iterrows():
        assert pd.isna(row["occupation"])
        assert pd.isna(row["year_of_birth"])


def test_fetch_politician_details_null_data_field(requests_mock):
    """API returning {'data': null} for the politicians endpoint is handled."""
    requests_mock.get(f"{BASE_URL}/politicians", json={"data": None})

    from src.fetch_data import fetch_politician_details

    df = fetch_politician_details([1])

    assert len(df) == 1
    assert pd.isna(df.iloc[0]["occupation"])


# ─── upsert_politicians: backwards compatibility ──────────────────────────────


def test_upsert_politicians_old_csv_without_detail_columns(
    requests_mock, monkeypatch, tmp_path
):
    """Old CSV without detail columns (occupation etc.) gets them added transparently.

    Before the detail columns were introduced, politicians.csv only had
    [politician_id, name, party]. After an upgrade, a new run must not crash
    and must add the missing columns, then fetch details for all politicians.
    """
    monkeypatch.setattr(src.fetch_data, "DATA_DIR", tmp_path)
    period_dir = tmp_path / "111"
    period_dir.mkdir()
    # Simulate old-format CSV without detail columns
    pd.DataFrame({"politician_id": [1], "name": ["Alice"], "party": ["SPD"]}).to_csv(
        period_dir / "politicians.csv", index=False
    )
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

    _df, _ = src.fetch_data.upsert_politicians(111)

    saved = pd.read_csv(period_dir / "politicians.csv")
    assert "occupation" in saved.columns
    assert saved.iloc[0]["occupation"] == "Lehrerin"


# ─── upsert_polls: polls absent from API are preserved ───────────────────────


def test_upsert_polls_existing_only_polls_preserved_in_csv(
    requests_mock, monkeypatch, tmp_path
):
    """Poll in existing CSV but no longer returned by API remains in the file.

    This prevents data loss if the API temporarily omits a poll.
    """
    monkeypatch.setattr(src.fetch_data, "DATA_DIR", tmp_path)
    period_dir = tmp_path / "111"
    period_dir.mkdir()
    pd.DataFrame({"poll_id": [1, 2, 3], "topic": ["A", "B", "C"]}).to_csv(
        period_dir / "polls.csv", index=False
    )
    # API only returns polls 1 and 2 (poll 3 disappeared)
    _mock_polls(requests_mock, [{"id": 1, "label": "A"}, {"id": 2, "label": "B"}])

    _df, new_ids = src.fetch_data.upsert_polls(111)

    saved = pd.read_csv(period_dir / "polls.csv")
    assert 3 in saved["poll_id"].to_numpy(), "Poll 3 preserved even if API omits it"
    assert len(saved) == 3
    assert new_ids == []  # poll 3 was already known; not a new poll
