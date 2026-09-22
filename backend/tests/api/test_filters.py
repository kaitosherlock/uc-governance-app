"""Fixture coverage for filter/mask metadata without querying real data."""

from fastapi.testclient import TestClient


def test_row_access_returns_direct_filter_mask_and_function_metadata(client: TestClient) -> None:
    controls = client.get("/api/v1/assets/TABLE/sales.crm.customers/row-access")

    assert controls.status_code == 200
    data = controls.json()["data"]
    assert data["row_filter"] == {
        "function_full_name": "shared_ref.governance.normalize_id",
        "input_columns": ["id"],
        "attached_via": "direct",
        "policy_id": None,
    }
    assert data["column_masks"] == [
        {
            "column": "email",
            "function_full_name": "shared_ref.governance.mask_email",
            "using_columns": [],
            "attached_via": "direct",
            "policy_id": None,
        }
    ]
    function = client.get("/api/v1/functions/shared_ref.governance.mask_email")
    assert function.status_code == 200
    detail = function.json()["data"]
    assert detail["owner"] == "shared_ref-owners"
    assert detail["parameters"] == [{"name": "email", "type_text": "STRING", "position": 0}]
    assert detail["dependents"][0]["full_name"] == "sales.crm.customers"


def test_abac_derived_control_points_to_policy(client: TestClient) -> None:
    response = client.get("/api/v1/assets/TABLE/sales.crm.orders/row-access")

    assert response.status_code == 200
    row_filter = response.json()["data"]["row_filter"]
    assert row_filter["attached_via"] == "abac_policy"
    assert row_filter["policy_id"] == "fixture-policy-sales-sensitive-rows"
