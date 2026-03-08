import pytest
import requests
import requests_mock

import src.fetch_data
from src.fetch_data import BASE_URL, fetch_all_v2


def test_fetch_all_v2_pagination():
    endpoint = "test-endpoint"
    full_url = f"{BASE_URL}/{endpoint}"

    # Realistic mock with 'meta' and 'data' keys
    # Page 1 returns 2 items, Page 2 returns 1 item
    with requests_mock.Mocker() as m:
        m.get(
            full_url,
            [
                {
                    "json": {
                        "meta": {
                            "status": "ok",
                            "result_count": 3,
                        },
                        "data": [
                            {"id": 1, "label": "Item 1"},
                            {"id": 2, "label": "Item 2"},
                        ],
                    },
                    "status_code": 200,
                },
                {
                    "json": {
                        "meta": {
                            "status": "ok",
                            "result_count": 3,
                        },
                        "data": [
                            {"id": 3, "label": "Item 3"},
                        ],
                    },
                    "status_code": 200,
                },
            ],
        )

        # Force small page size to trigger pagination logic
        src.fetch_data.PAGE_SIZE = 2  # type: ignore[assignment]

        result = fetch_all_v2(endpoint)

        assert len(result) == 3
        assert result[0]["id"] == 1
        assert result[2]["id"] == 3
        assert m.call_count == 2
        # Verify query params for pagination (values in .qs are lists)
        assert m.request_history[0].qs["range_start"] == ["0"]
        assert m.request_history[1].qs["range_start"] == ["2"]


def test_fetch_all_v2_error():
    endpoint = "error-endpoint"
    full_url = f"{BASE_URL}/{endpoint}"

    with requests_mock.Mocker() as m:
        m.get(full_url, status_code=500)

        with pytest.raises(requests.HTTPError):
            fetch_all_v2(endpoint)


def test_fetch_politicians_party_logic():
    from src.fetch_data import fetch_politicians

    # Mock data with realistic nesting for politicians and fraction memberships
    mock_mandates = [
        {
            "id": 100,
            "label": "Mandat Max Mustermann",
            "politician": {
                "id": 1,
                "label": "Max Mustermann",
                "api_url": "https://...",
            },
            "fraction_membership": [
                {
                    "fraction": {"id": 10, "label": "Alte Partei (2000-2020)"},
                    "start_date": "2000-01-01",
                    "end_date": "2020-01-01",
                },
                {
                    "fraction": {"id": 11, "label": "Neue Partei (2021-2025)"},
                    "start_date": "2021-01-01",
                    "end_date": None,  # Still active
                },
            ],
        }
    ]

    with requests_mock.Mocker() as m:
        m.get(
            f"{BASE_URL}/candidacies-mandates",
            json={
                "meta": {"status": "ok"},
                "data": mock_mandates,
            },
        )

        df, mapping = fetch_politicians(132)

        assert len(df) == 1
        # Should correctly identify "Neue Partei" (stripping the suffix)
        assert df.iloc[0]["party"] == "Neue Partei"
        assert mapping[100] == 1


def test_fetch_votes_logic():
    from pathlib import Path

    from src.fetch_data import fetch_votes

    poll_ids = [500]
    mandate_to_politician = {1000: 1}  # mandate_id -> politician_id
    temp_path = Path("test_votes.csv")

    # Realistic vote response structure
    mock_votes = [
        {
            "id": 5000,
            "vote": "yes",
            "mandate": {"id": 1000, "label": "Mandat 1000"},
            "poll": {"id": 500, "label": "Poll 500"},
        },
        {
            "id": 5001,
            "vote": "no",
            "mandate": {"id": 9999, "label": "Unknown Mandate"},
            "poll": {"id": 500, "label": "Poll 500"},
        },
    ]

    with requests_mock.Mocker() as m:
        m.get(
            f"{BASE_URL}/votes",
            json={
                "meta": {"status": "ok"},
                "data": mock_votes,
            },
        )

        try:
            fetch_votes(poll_ids, mandate_to_politician, temp_path, append=False)
            import pandas as pd

            df = pd.read_csv(temp_path)
            # Only the vote with known mandate_id should be recorded
            assert len(df) == 1
            assert df.iloc[0]["politician_id"] == 1
            assert df.iloc[0]["poll_id"] == 500
            assert df.iloc[0]["answer"] == "yes"
        finally:
            if temp_path.exists():
                temp_path.unlink()
