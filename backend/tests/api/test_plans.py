"""Routes keep unregistered plan kinds unavailable after concrete registration."""

from app.api.v1.models import PlanKind
from app.errors import NotImplementedYet
from fastapi.testclient import TestClient


def unregistered_plan_kinds(client: TestClient) -> list[PlanKind]:
    registry = client.app.state.container.mutation_engine.registry  # type: ignore[attr-defined]
    values: list[PlanKind] = []
    for kind in PlanKind:
        try:
            registry.get(kind)
        except NotImplementedYet:
            values.append(kind)
    return values


def test_registered_plan_kinds_are_available_in_fixture_mode(client: TestClient) -> None:
    payloads = {
        "grant": {"principal": "auditors", "privileges": ["SELECT"]},
        "revoke": {"principal": "analysts", "privileges": ["SELECT"]},
        "transfer_ownership": {"new_owner": "analysts"},
        "edit_metadata": {"comment": "Fixture metadata update"},
        "assign_tags": {"tags": [{"key": "data_domain", "value": "finance"}]},
        "remove_tags": {"tags": [{"key": "data_domain"}]},
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
    kind = unregistered_plan_kinds(client)[0]
    response = client.post(
        "/api/v1/plans",
        json={
            "kind": kind.value,
            "targets": [{"securable_type": "TABLE", "full_name": "sales.crm.orders"}],
            "changes": {"tags": [{"key": "not-used"}]},
            "reason": "Confirm an unregistered kind remains unavailable",
        },
    )

    assert response.status_code == 501
    assert response.json()["code"] == "NOT_IMPLEMENTED"


def test_all_unregistered_plan_kinds_stay_not_implemented(client: TestClient) -> None:
    for kind in unregistered_plan_kinds(client):
        response = client.post(
            "/api/v1/plans",
            json={
                "kind": kind.value,
                "targets": [{"securable_type": "TABLE", "full_name": "sales.crm.orders"}],
                "changes": {"tags": [{"key": "not-used"}]},
                "reason": "Confirm unregistered kinds remain unavailable",
            },
        )
        assert response.status_code == 501, kind.value
        assert response.json()["code"] == "NOT_IMPLEMENTED"
