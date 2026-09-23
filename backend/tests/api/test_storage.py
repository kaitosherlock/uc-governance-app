"""Storage metadata reads never expose cloud identity material or imply IAM access."""

import json
from types import SimpleNamespace
from typing import cast

from app.adapters.databricks.storage import map_external_location, map_storage_credential
from app.api import mappers
from app.api.v1.models import Actor, ActorKind, AppRole, Executor, Identity
from app.config.settings import Mode, Settings
from app.domain.enums import ActionName
from app.domain.reads import Readers, ReadService
from fastapi.testclient import TestClient


def test_storage_credentials_are_allowlisted_and_disclaim_cloud_iam(client: TestClient) -> None:
    response = client.get("/api/v1/storage-credentials?page_size=1")

    assert response.status_code == 200
    body = response.json()
    assert body["page"]["next_page_token"]
    credential = body["data"][0]
    assert set(credential) == {
        "name",
        "owner",
        "cloud_provider",
        "read_only",
        "isolation_mode",
        "comment",
        "created_at",
        "used_for_managed_storage",
        "allowed_actions",
    }
    assert credential["cloud_provider"] == "aws_iam_role"
    assert {item["action"] for item in credential["allowed_actions"]} == {
        "edit_metadata",
        "delete",
        "validate",
    }
    assert all(item["allowed"] is False for item in credential["allowed_actions"])
    assert all(item["reason_code"] == "NOT_IMPLEMENTED" for item in credential["allowed_actions"])
    assert "outside Unity Catalog and was not checked" in body["meta"]["limitations"][1]
    assert "not observations of effective cloud permissions" in body["meta"]["limitations"][2]


def test_external_locations_are_allowlisted_and_disclaim_cloud_iam(client: TestClient) -> None:
    response = client.get("/api/v1/external-locations")

    assert response.status_code == 200
    body = response.json()
    location = body["data"][0]
    assert set(location) == {
        "name",
        "url",
        "credential_name",
        "owner",
        "read_only",
        "isolation_mode",
        "comment",
        "created_at",
        "allowed_actions",
    }
    assert all(item["allowed"] is False for item in location["allowed_actions"])
    assert "outside Unity Catalog and was not checked" in body["meta"]["limitations"][1]
    assert "not observations of effective cloud permissions" in body["meta"]["limitations"][2]


def test_storage_fixture_forbidden_scenario_returns_documented_error(client: TestClient) -> None:
    response = client.get(
        "/api/v1/storage-credentials", headers={"X-Fixture-Scenario": "forbidden"}
    )

    assert response.status_code == 403
    assert response.json()["success"] is False
    assert response.json()["code"] == "INSUFFICIENT_PRIVILEGES"


def test_sdk_shaped_cloud_identity_extras_never_reach_serialized_response() -> None:
    secret = "definitely-not-for-response"
    credential = map_storage_credential(
        SimpleNamespace(
            name="safe-name",
            owner="safe-owner",
            read_only=False,
            isolation_mode="ISOLATION_MODE_OPEN",
            comment="safe-comment",
            created_at=1_726_000_000_000,
            used_for_managed_storage=True,
            aws_iam_role=SimpleNamespace(role_arn="not-returned"),
            client_secret=secret,
            unknown_credential_blob={"secret": secret},
        )
    )
    location = map_external_location(
        SimpleNamespace(
            name="safe-location",
            url="s3://safe-location/",
            credential_name="safe-name",
            owner="safe-owner",
            read_only=False,
            isolation_mode="ISOLATION_MODE_OPEN",
            comment="safe-comment",
            created_at=1_726_000_000_000,
            encryption_details=SimpleNamespace(access_token=secret),
        )
    )

    serialized = json.dumps(
        {
            "credential": mappers.map_StorageCredential(credential).model_dump(mode="json"),
            "location": mappers.map_ExternalLocation(location).model_dump(mode="json"),
        }
    )

    assert secret not in serialized
    assert "client_secret" not in serialized
    assert "unknown_credential_blob" not in serialized
    assert "encryption_details" not in serialized
    assert credential.cloud_provider == "aws_iam_role"


def test_cloud_provider_uses_only_the_present_sdk_union_member() -> None:
    assert map_storage_credential(
        SimpleNamespace(name="azure", azure_managed_identity=SimpleNamespace())
    ).cloud_provider == "azure_managed_identity"
    assert map_storage_credential(
        SimpleNamespace(name="gcp", databricks_gcp_service_account=SimpleNamespace())
    ).cloud_provider == "gcp_service_account"
    assert map_storage_credential(
        SimpleNamespace(name="other", azure_service_principal=SimpleNamespace())
    ).cloud_provider == "unknown"


def test_storage_actions_use_mode_read_only_in_connected_readonly_mode() -> None:
    identity = Identity(
        actor=Actor(
            id="fixture-admin",
            display="fixture-admin@example.test",
            kind=ActorKind.USER,
            roles=[AppRole.PLATFORM_ADMIN],
            verified_by="fixture",
        ),
        executor=Executor(kind="user", display="fixture-admin@example.test", reason="test"),
    )
    service = ReadService(
        cast(Readers, None),
        identity,
        Settings(
            mode=Mode.CONNECTED_READONLY,
            fixture_actor=None,
            plan_hmac_key="x" * 32,
        ),
    )

    action = service.storage_action(ActionName.VALIDATE)

    assert action.allowed is False
    assert action.reason_code == "MODE_READ_ONLY"
