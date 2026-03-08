import pytest
import requests
import requests_mock

import src.fetch_data
from src.fetch_data import BASE_URL, fetch_all_v2


def test_fetch_all_v2_pagination():
    endpoint = "test-endpoint"
    full_url = f"{BASE_URL}/{endpoint}"

    # Mock two pages of data
    with requests_mock.Mocker() as m:
        m.get(
            full_url,
            [
                {
                    "json": {"data": [{"id": 1}, {"id": 2}], "meta": {}},
                    "status_code": 200,
                },
                {"json": {"data": [{"id": 3}], "meta": {}}, "status_code": 200},
            ],
        )

        # We need to monkeypatch PAGE_SIZE or just ensure the logic works
        # based on the length of returned data
        # Use type: ignore because PAGE_SIZE is likely typed as a constant 100
        src.fetch_data.PAGE_SIZE = 2  # type: ignore[assignment]

        result = fetch_all_v2(endpoint)

        assert len(result) == 3  # noqa: S101
        assert result[0]["id"] == 1  # noqa: S101
        assert result[2]["id"] == 3  # noqa: S101
        assert m.call_count == 2  # noqa: S101


def test_fetch_all_v2_error():
    endpoint = "error-endpoint"
    full_url = f"{BASE_URL}/{endpoint}"

    with requests_mock.Mocker() as m:
        m.get(full_url, status_code=500)

        with pytest.raises(requests.HTTPError):
            fetch_all_v2(endpoint)


def test_fetch_politicians_party_logic():
    from src.fetch_data import fetch_politicians

    # Mock data for one politician with multiple fraction memberships
    mock_mandates = [
        {
            "id": 100,
            "politician": {"id": 1, "label": "Max Mustermann"},
            "fraction_membership": [
                {
                    "fraction": {"label": "Old Party (2000-2020)"},
                    "end_date": "2020-01-01",
                },
                {
                    "fraction": {"label": "Current Party"},
                    "end_date": None,  # Still active
                },
            ],
        }
    ]

    with requests_mock.Mocker() as m:
        m.get(f"{BASE_URL}/candidacies-mandates", json={"data": mock_mandates})

        df, mapping = fetch_politicians(132)

        assert len(df) == 1  # noqa: S101
        assert df.iloc[0]["party"] == "Current Party"  # noqa: S101
        assert mapping[100] == 1  # noqa: S101
