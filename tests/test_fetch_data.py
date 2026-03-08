import pandas as pd
import pytest
import requests

import src.fetch_data
from src.fetch_data import BASE_URL, fetch_all_v2, find_polls_missing_votes


def test_fetch_all_v2_single_page(requests_mock):
    """Single page: only one request, all items returned."""
    requests_mock.get(
        f"{BASE_URL}/items",
        json={"data": [{"id": 1}, {"id": 2}]},
    )
    result = fetch_all_v2("items")
    assert result == [{"id": 1}, {"id": 2}]
    assert requests_mock.call_count == 1


def test_fetch_all_v2_pagination(requests_mock, monkeypatch):
    """Multiple pages: fetches until page is smaller than PAGE_SIZE."""
    monkeypatch.setattr(src.fetch_data, "PAGE_SIZE", 2)
    requests_mock.get(
        f"{BASE_URL}/ep",
        [
            {"json": {"data": [{"id": 1}, {"id": 2}]}},
            {"json": {"data": [{"id": 3}]}},
        ],
    )

    result = fetch_all_v2("ep")

    assert len(result) == 3
    assert result[0]["id"] == 1
    assert result[2]["id"] == 3
    assert requests_mock.call_count == 2
    assert requests_mock.request_history[0].qs["range_start"] == ["0"]
    assert requests_mock.request_history[1].qs["range_start"] == ["2"]


def test_fetch_all_v2_empty_page(requests_mock):
    """Empty first page returns empty list with one request."""
    requests_mock.get(f"{BASE_URL}/empty", json={"data": []})
    result = fetch_all_v2("empty")
    assert result == []
    assert requests_mock.call_count == 1


def test_fetch_all_v2_extra_params(requests_mock):
    """Extra params are forwarded and don't mutate the caller's dict."""
    requests_mock.get(f"{BASE_URL}/ep", json={"data": []})
    caller_params = {"field_legislature": 42}
    fetch_all_v2("ep", params=caller_params)
    assert caller_params == {"field_legislature": 42}  # not mutated
    assert requests_mock.last_request.qs["field_legislature"] == ["42"]


def test_fetch_all_v2_http_error(requests_mock):
    """HTTP errors raise requests.HTTPError."""
    requests_mock.get(f"{BASE_URL}/err", status_code=500)
    with pytest.raises(requests.HTTPError):
        fetch_all_v2("err")


def test_fetch_politicians_active_party(requests_mock):
    """Picks the still-active membership and strips the date suffix."""
    mandates = [
        {
            "id": 100,
            "politician": {"id": 1, "label": "Max Mustermann"},
            "fraction_membership": [
                {
                    "fraction": {"label": "Alte Partei (2000-2020)"},
                    "end_date": "2020-01-01",
                },
                {
                    "fraction": {"label": "Neue Partei (2021-2025)"},
                    "end_date": None,
                },
            ],
        }
    ]
    requests_mock.get(
        f"{BASE_URL}/candidacies-mandates",
        json={"data": mandates},
    )

    from src.fetch_data import fetch_politicians

    df, mapping = fetch_politicians(132)

    assert len(df) == 1
    assert df.iloc[0]["party"] == "Neue Partei"
    assert mapping[100] == 1


def test_fetch_politicians_no_membership(requests_mock):
    """Politicians with no party membership get 'Unknown'."""
    mandates = [
        {
            "id": 200,
            "politician": {"id": 2, "label": "Parteilos"},
            "fraction_membership": [],
        }
    ]
    requests_mock.get(
        f"{BASE_URL}/candidacies-mandates",
        json={"data": mandates},
    )

    from src.fetch_data import fetch_politicians

    df, _ = fetch_politicians(132)

    assert df.iloc[0]["party"] == "Unknown"


def test_fetch_politicians_deduplicates(requests_mock):
    """Two mandates for the same politician produce one row."""
    mandates = [
        {
            "id": 1,
            "politician": {"id": 42, "label": "A"},
            "fraction_membership": [],
        },
        {
            "id": 2,
            "politician": {"id": 42, "label": "A"},
            "fraction_membership": [],
        },
    ]
    requests_mock.get(
        f"{BASE_URL}/candidacies-mandates",
        json={"data": mandates},
    )

    from src.fetch_data import fetch_politicians

    df, mapping = fetch_politicians(1)

    assert len(df) == 1
    assert mapping[1] == 42
    assert mapping[2] == 42


def test_fetch_votes_writes_csv(requests_mock, tmp_path):
    """Writes only votes with known mandate ids to CSV."""
    mock_votes = [
        {"vote": "yes", "mandate": {"id": 1000}, "poll": {"id": 500}},
        {"vote": "no", "mandate": {"id": 9999}, "poll": {"id": 500}},  # unknown
    ]
    requests_mock.get(f"{BASE_URL}/votes", json={"data": mock_votes})

    from src.fetch_data import fetch_votes

    path = tmp_path / "votes.csv"
    fetch_votes([500], {1000: 1}, path, append=False)

    import pandas as pd

    df = pd.read_csv(path)
    assert len(df) == 1
    assert df.iloc[0]["politician_id"] == 1
    assert df.iloc[0]["poll_id"] == 500
    assert df.iloc[0]["answer"] == "yes"


def test_fetch_votes_append_mode(requests_mock, tmp_path):
    """append=True adds rows without writing a second header."""
    requests_mock.get(
        f"{BASE_URL}/votes",
        [
            {
                "json": {
                    "data": [{"vote": "yes", "mandate": {"id": 1}, "poll": {"id": 10}}]
                }
            },
            {
                "json": {
                    "data": [{"vote": "no", "mandate": {"id": 1}, "poll": {"id": 20}}]
                }
            },
        ],
    )

    import pandas as pd

    from src.fetch_data import fetch_votes

    path = tmp_path / "votes.csv"
    fetch_votes([10], {1: 100}, path, append=False)
    fetch_votes([20], {1: 100}, path, append=True)

    df = pd.read_csv(path)
    assert len(df) == 2
    assert list(df.columns) == ["politician_id", "poll_id", "answer"]


# ─── find_polls_missing_votes ─────────────────────────────────────────────────


def test_find_polls_missing_votes_no_file(tmp_path):
    """No votes.csv exists yet, so all polls need fetching."""
    result = find_polls_missing_votes([1, 2, 3], tmp_path / "votes.csv")
    assert result == [1, 2, 3]


def test_find_polls_missing_votes_partial(tmp_path):
    """votes.csv has votes for poll 1 only, poll 2 still needs fetching."""
    votes_path = tmp_path / "votes.csv"
    pd.DataFrame({"politician_id": [10], "poll_id": [1], "answer": ["yes"]}).to_csv(
        votes_path, index=False
    )

    result = find_polls_missing_votes([1, 2], votes_path)
    assert result == [2]


def test_find_polls_missing_votes_all_present(tmp_path):
    """votes.csv has votes for all polls, nothing to fetch."""
    votes_path = tmp_path / "votes.csv"
    pd.DataFrame(
        {"politician_id": [10, 20], "poll_id": [1, 2], "answer": ["yes", "no"]}
    ).to_csv(votes_path, index=False)

    result = find_polls_missing_votes([1, 2], votes_path)
    assert result == []


def test_find_polls_missing_votes_self_heals_after_failed_fetch(
    requests_mock, tmp_path, monkeypatch
):
    """Core bug scenario: poll is in polls.csv but has no votes.

    After a failed vote fetch, upsert_polls marks the poll as "known".
    find_polls_missing_votes must still detect it as missing by checking
    votes.csv instead of polls.csv.
    """
    monkeypatch.setattr(src.fetch_data, "DATA_DIR", tmp_path)
    period_dir = tmp_path / "132"
    period_dir.mkdir()

    # API returns polls 1 and 2
    requests_mock.get(
        f"{BASE_URL}/polls",
        json={
            "data": [
                {"id": 1, "label": "Poll 1"},
                {"id": 2, "label": "Poll 2"},
            ]
        },
    )

    # Run 1: upsert_polls writes both polls to polls.csv
    df_polls, _ = src.fetch_data.upsert_polls(132)

    # Simulate: votes fetched for poll 1 only (poll 2 failed)
    votes_path = period_dir / "votes.csv"
    pd.DataFrame({"politician_id": [10], "poll_id": [1], "answer": ["yes"]}).to_csv(
        votes_path, index=False
    )

    # Run 2: upsert_polls returns no "new" polls (both in polls.csv)
    _, new_from_upsert = src.fetch_data.upsert_polls(132)
    assert new_from_upsert == []  # upsert_polls can't detect the gap

    # But find_polls_missing_votes correctly identifies poll 2 as missing
    missing = find_polls_missing_votes(df_polls["poll_id"].tolist(), votes_path)
    assert missing == [2]
