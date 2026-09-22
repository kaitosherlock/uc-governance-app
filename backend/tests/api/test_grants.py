"""The remaining Phase 1 read routes."""

from fastapi.testclient import TestClient


def test_grants_envelope_and_inherited_revoke_refusal(client: TestClient) -> None:
    response = client.get("/api/v1/assets/TABLE/sales.crm.orders/grants")
    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"success", "data", "meta"}
    assert body["data"]["group_membership_loaded"] is False
    for grant in body["data"]["inherited"]:
        action = grant["allowed_actions"][0]
        assert action["action"] == "revoke"
        assert action["allowed"] is False
        assert action["reason_code"] == "INHERITED_FROM_PARENT"
        assert action["navigate_to"].endswith("?tab=access")


def test_grant_filters_and_privilege_catalogue(client: TestClient) -> None:
    grants = client.get(
        "/api/v1/assets/TABLE/sales.crm.orders/grants?principal=analysts&source=direct"
    )
    assert grants.status_code == 200
    assert [grant["principal"] for grant in grants.json()["data"]["direct"]] == ["analysts"]
    privileges = client.get("/api/v1/privileges?securable_type=TABLE")
    assert privileges.status_code == 200
    values = {value["code"]: value for value in privileges.json()["data"]}
    assert values["SELECT"]["prerequisites"] == ["USE_CATALOG", "USE_SCHEMA"]
    assert values["ALL_PRIVILEGES"]["category"] == "all"
    assert "not every administrative privilege" in values["ALL_PRIVILEGES"]["description"]


def test_principal_search_marks_workspace_local_groups(client: TestClient) -> None:
    response = client.get("/api/v1/principals/search?q=local")
    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"success", "data", "meta", "page"}
    local = body["data"][0]
    assert local["scope"] == "workspace_local"
    assert local["uc_eligible"] is False


def test_fixture_failure_scenarios_never_return_success(client: TestClient) -> None:
    for scenario, status, code in [
        ("forbidden", 403, "INSUFFICIENT_PRIVILEGES"),
        ("not_configured", 503, "NOT_CONFIGURED"),
        ("unknown", 503, "UPSTREAM_UNAVAILABLE"),
        ("rate_limited", 429, "RATE_LIMITED"),
        ("stale", 409, "PLAN_STALE"),
    ]:
        response = client.get("/api/v1/catalogs", headers={"X-Fixture-Scenario": scenario})
        assert response.status_code == status
        assert response.json()["success"] is False
        assert response.json()["code"] == code
