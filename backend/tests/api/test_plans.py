"""Routes keep unregistered plan kinds unavailable after concrete registration."""

from fastapi.testclient import TestClient


def test_first_four_plan_kinds_are_registered_in_fixture_mode(client: TestClient) -> None:
    payloads = {
        "grant": {"principal": "auditors", "privileges": ["SELECT"]},
        "revoke": {"principal": "analysts", "privileges": ["SELECT"]},
        "transfer_ownership": {"new_owner": "analysts"},
        "edit_metadata": {"comment": "Fixture metadata update"},
    }
    for kind, changes in payloads.items():
        response = client.post(
            "/api/v1/plans",
            json={
                "kind": kind,
                "targets": [{"securable_type": "TABLE", "full_name": "sales.crm.orders"}],
                "changes": changes,
                "reason": "Exercise registered fixture plan kind",
            },
        )
        assert response.status_code == 201
        assert response.json()["data"]["kind"] == kind


def test_remaining_unregistered_plan_kind_returns_not_implemented(client: TestClient) -> None:
    response = client.post(
        "/api/v1/plans",
        json={
            "kind": "assign_tags",
            "targets": [{"securable_type": "TABLE", "full_name": "sales.crm.orders"}],
            "changes": {"tags": [{"key": "classification", "value": "internal"}]},
            "reason": "Update synthetic description",
        },
    )

    assert response.status_code == 501
    assert response.json()["code"] == "NOT_IMPLEMENTED"
