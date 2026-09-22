"""Fixture read paths, pagination, scope and ordinary viewer visibility."""

from fastapi.testclient import TestClient


def test_catalog_schema_and_object_lists_have_exact_envelopes(client: TestClient) -> None:
    for path in (
        "/api/v1/catalogs",
        "/api/v1/catalogs/sales/schemas",
        "/api/v1/schemas/sales/crm/objects",
    ):
        response = client.get(path)
        assert response.status_code == 200
        body = response.json()
        assert set(body) == {"success", "data", "meta", "page"}
        assert body["success"] is True
        assert body["meta"]["source"] == "fixture"
        assert body["meta"]["observed_at"].endswith("Z")
        assert set(body["page"]) == {"page_size", "next_page_token"}


def test_list_pagination_preserves_a_bounded_cursor(client: TestClient) -> None:
    first = client.get("/api/v1/schemas/sales/crm/objects?page_size=2")
    assert first.status_code == 200
    token = first.json()["page"]["next_page_token"]
    assert token
    second = client.get(f"/api/v1/schemas/sales/crm/objects?page_size=2&page_token={token}")
    assert second.status_code == 200
    first_names = {asset["full_name"] for asset in first.json()["data"]}
    second_names = {asset["full_name"] for asset in second.json()["data"]}
    assert first_names.isdisjoint(second_names)
    assert client.get("/api/v1/schemas/sales/crm/objects?page_token=wrong").status_code == 400


def test_asset_detail_and_dependencies_have_exact_envelopes(client: TestClient) -> None:
    detail = client.get("/api/v1/assets/TABLE/sales.crm.orders")
    assert detail.status_code == 200
    assert set(detail.json()) == {"success", "data", "meta"}
    assert (
        detail.json()["data"]["row_filter"]["function_full_name"]
        == "shared_ref.governance.normalize_id"
    )
    dependencies = client.get("/api/v1/assets/TABLE/sales.crm.orders/dependencies")
    assert dependencies.status_code == 200
    assert set(dependencies.json()) == {"success", "data", "meta"}
    assert dependencies.json()["data"]["known"][0]["full_name"] == "sales.crm.orders_daily_mv"


def test_viewer_can_read_fixture_assets(monkeypatch, app: object) -> None:
    monkeypatch.setenv("UCGOV_FIXTURE_ACTOR", "victor.viewer")
    from app import main

    viewer = main.create_app()
    with TestClient(viewer) as client:
        assert client.get("/api/v1/assets/TABLE/sales.crm.orders").status_code == 200


def test_managed_catalog_scope_is_enforced(monkeypatch) -> None:
    monkeypatch.setenv("UCGOV_MANAGED_CATALOGS", "sales")
    from app import main

    app = main.create_app()
    with TestClient(app) as client:
        response = client.get("/api/v1/assets/TABLE/hr.people.records")
    assert response.status_code == 403
    assert response.json()["code"] == "FORBIDDEN_SCOPE"
