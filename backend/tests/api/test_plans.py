"""Routes accurately refuse plan kinds until their handlers are registered."""

from fastapi.testclient import TestClient


def test_unregistered_plan_kind_returns_not_implemented(client: TestClient) -> None:
    response = client.post(
        "/api/v1/plans",
        json={
            "kind": "edit_metadata",
            "targets": [{"securable_type": "TABLE", "full_name": "sales.crm.orders"}],
            "changes": {"comment": "New description"},
            "reason": "Update synthetic description",
        },
    )

    assert response.status_code == 501
    assert response.json()["code"] == "NOT_IMPLEMENTED"
