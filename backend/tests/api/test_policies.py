"""Fixture ABAC policy reads disclose metadata limits without simulating execution."""

from fastapi.testclient import TestClient

POLICY_ID = "fixture-policy-sales-sensitive-rows"


def test_policy_read_renders_scope_predicate_principals_and_function(client: TestClient) -> None:
    response = client.get(f"/api/v1/abac-policies/{POLICY_ID}")
    assert response.status_code == 200
    policy = response.json()["data"]
    assert policy["scope"]["full_name"] == "sales"
    assert policy["when_condition"] == "has_tag_value('sensitivity', 'internal')"
    assert policy["to_principals"] == ["analysts"]
    assert policy["except_principals"] == ["data-eng-owners"]
    assert policy["function_full_name"] == "shared_ref.governance.normalize_id"


def test_impact_is_explicitly_not_databricks_evaluation_and_has_unknowns(
    client: TestClient,
) -> None:
    response = client.get(f"/api/v1/abac-policies/{POLICY_ID}/impact")
    assert response.status_code == 200
    body = response.json()
    assert body["data"]["disclaimer"] == (
        "Potentially affected within your visible scope. Not evaluated by Databricks."
    )
    assert "sales.crm.orders" in {
        item["full_name"] for item in body["data"]["potentially_affected"]
    }
    limitations = body["meta"]["limitations"]
    assert any("not evaluated by databricks" in value.lower() for value in limitations)
    assert any("outside the caller's visible scope" in value for value in limitations)
