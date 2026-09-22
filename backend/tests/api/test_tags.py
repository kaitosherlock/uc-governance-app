"""Fixture endpoints for object/column tags and governed tag policies."""

from types import SimpleNamespace

from app.adapters.databricks.tags import _tag
from app.domain.enums import TagKind
from fastapi.testclient import TestClient


def test_tags_separate_object_and_nonempty_column_keys(client: TestClient) -> None:
    response = client.get("/api/v1/assets/TABLE/sales.crm.orders/tags")
    assert response.status_code == 200
    data = response.json()["data"]
    assert {tag["key"] for tag in data["tags"]} >= {"data_domain", "sensitivity"}
    assert set(data["column_tags"]) == {"id"}
    assert "email" not in data["column_tags"]


def test_non_tabular_tags_have_an_empty_column_map(client: TestClient) -> None:
    response = client.get("/api/v1/assets/FUNCTION/shared_ref.governance.normalize_id/tags")
    assert response.status_code == 200
    assert response.json()["data"]["column_tags"] == {}


def test_connected_adapter_keeps_governed_tag_kind() -> None:
    assert (
        _tag(
            SimpleNamespace(
                tag_key="sensitivity",
                tag_value="internal",
                source_type="GOVERNED",
            )
        ).kind
        == TagKind.GOVERNED
    )


def test_system_tag_read_action_uses_existing_reason(client: TestClient) -> None:
    response = client.get("/api/v1/assets/TABLE/sales.crm.orders/tags")
    tag = next(item for item in response.json()["data"]["tags"] if item["kind"] == "system")
    assert {action["action"] for action in tag["allowed_actions"]} == {
        "assign_tag",
        "remove_tag",
    }
    assert all(action["allowed"] is False for action in tag["allowed_actions"])
    assert all(
        action["reason"] == "System-controlled tags cannot be edited."
        for action in tag["allowed_actions"]
    )


def test_tag_policies_preserve_open_and_empty_sets_and_refuse_unknown_authority(
    client: TestClient,
) -> None:
    response = client.get("/api/v1/tag-policies?page_size=2")
    assert response.status_code == 200
    first = response.json()
    token = first["page"]["next_page_token"]
    assert token
    second = client.get(f"/api/v1/tag-policies?page_size=2&page_token={token}")
    values = {item["key"]: item for item in first["data"] + second.json()["data"]}
    assert values["pii"]["allowed_values"] is None
    assert values["retention"]["allowed_values"] == []
    action = values["sensitivity"]["allowed_actions"][0]
    assert action["allowed"] is False
    assert action["reason_code"] == "UNKNOWN"
    assert "could not be determined" in action["reason"]
