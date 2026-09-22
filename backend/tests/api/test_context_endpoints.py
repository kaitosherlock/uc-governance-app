from datetime import datetime
from uuid import UUID

import pytest
from fastapi.testclient import TestClient


@pytest.mark.parametrize("path", ["context", "me", "capabilities"])
def test_context_endpoints(client: TestClient, path: str) -> None:
    response = client.get(f"/api/v1/{path}", headers={"X-Request-Id": "synthetic-request-id"})
    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"success", "data", "meta"}
    assert body["success"] is True
    assert set(body["meta"]) == {
        "source",
        "observed_at",
        "scope",
        "completeness",
        "limitations",
        "correlation_id",
    }
    assert body["meta"]["source"] == "fixture"
    assert body["meta"]["correlation_id"] == "synthetic-request-id"
    assert response.headers["X-Request-Id"] == "synthetic-request-id"
    assert body["meta"]["observed_at"].endswith("Z")
    assert datetime.fromisoformat(body["meta"]["observed_at"]).utcoffset().total_seconds() == 0


def test_context_configuration_and_identity(client: TestClient) -> None:
    context = client.get("/api/v1/context").json()["data"]
    assert context["mode"] == "fixture"
    assert context["mode_label"] == "Demo — synthetic data"
    assert context["workspace_host"] == "https://demo.example.test"
    assert context["workspace_id"] is None
    assert not context["warehouse_configured"]
    assert not context["durable_store_configured"]
    assert not context["account_client_configured"]
    actor = client.get("/api/v1/me").json()["data"]["actor"]
    assert actor["display"] == "alice.steward@example.test"
    assert actor["verified_by"] == "fixture"


def test_capabilities_reports_classification_results_unsupported(client: TestClient) -> None:
    capabilities = client.get("/api/v1/capabilities").json()["data"]
    classification = next(row for row in capabilities if row["capability"] == "classification.read")

    assert classification["status"] == "unsupported_in_environment"
    assert "0.140.0" in classification["reason"]
    assert "results" in classification["reason"]


def test_generated_request_id_is_uuid4(client: TestClient) -> None:
    response = client.get("/api/v1/context")
    request_id = response.json()["meta"]["correlation_id"]
    assert UUID(request_id).version == 4
    assert response.headers["X-Request-Id"] == request_id


def test_request_ids_do_not_leak_between_requests(client: TestClient) -> None:
    client.get("/api/v1/me", headers={"X-Request-Id": "first-request"})
    second = client.get("/api/v1/me")
    assert second.json()["meta"]["correlation_id"] != "first-request"
