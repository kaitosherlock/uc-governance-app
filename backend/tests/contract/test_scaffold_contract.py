"""P0-03 slice conformance; full API parity remains the separate P0-09 task."""

import json
from pathlib import Path

import pytest
import yaml
from app.api.v1 import models
from fastapi.testclient import TestClient
from jsonschema import Draft4Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[3]
CONTRACT = yaml.safe_load((ROOT / "shared/contracts/api-spec.yaml").read_text(encoding="utf-8"))
SCHEMAS = CONTRACT["components"]["schemas"]


def json_schema(value):
    """Translate OAS 3 nullable to JSON Schema for the installed validator."""
    if isinstance(value, list):
        return [json_schema(item) for item in value]
    if not isinstance(value, dict):
        return value
    result = {key: json_schema(item) for key, item in value.items() if key != "nullable"}
    if value.get("nullable") and "type" in result:
        result["type"] = [result["type"], "null"]
    return result


def validate_contract(instance, name: str) -> None:
    schema = json_schema({
        "$ref": f"#/components/schemas/{name}", "components": CONTRACT["components"],
    })
    Draft4Validator(schema, format_checker=FormatChecker()).validate(instance)


@pytest.mark.parametrize(("path", "schema"), [
    ("context", "ContextResponse"), ("me", "IdentityResponse"),
    ("capabilities", "CapabilitiesResponse"), ("missing", "ErrorResponse"),
])
def test_endpoint_response_matches_frozen_schema(
    client: TestClient, path: str, schema: str,
) -> None:
    validate_contract(client.get(f"/api/v1/{path}").json(), schema)


@pytest.mark.parametrize("name", [
    "ErrorCode", "DataSource", "Completeness", "AppMode", "AppRole", "ActorKind",
    "CapabilityStatusValue",
])
def test_enum_parity(name: str) -> None:
    assert {member.value for member in getattr(models, name)} == set(SCHEMAS[name]["enum"])


@pytest.mark.parametrize("name", [
    "Meta", "Page", "FieldError", "ErrorResponse", "Context", "ContextResponse", "Actor",
    "Executor", "Identity", "IdentityResponse", "Capability", "CapabilitiesResponse",
])
def test_model_field_and_required_parity(name: str) -> None:
    actual = getattr(models, name).model_json_schema(by_alias=True)
    assert set(actual["properties"]) == set(SCHEMAS[name]["properties"])
    assert set(actual["required"]) == set(SCHEMAS[name]["required"])


@pytest.mark.parametrize("filename", [
    "ContextResponse.fixture.json", "IdentityResponse.steward.json",
    "ErrorResponse.forbidden-role.json", "ErrorResponse.not-configured.json",
    "ErrorResponse.validation-failed.json",
])
def test_frozen_examples_round_trip(filename: str) -> None:
    example = ROOT / "shared/contracts/examples" / filename
    instance = json.loads(example.read_text(encoding="utf-8"))
    model = getattr(models, filename.split(".")[0])
    parsed = model.model_validate(instance)
    result = parsed.model_dump(mode="json", by_alias=True, exclude_unset=True)
    assert result == instance
    validate_contract(result, model.__name__)


def test_utc_serialization_and_nullable_required_fields() -> None:
    meta = models.Meta(
        source=models.DataSource.APPLICATION, observed_at="2026-09-21T17:00:00+07:00",
        completeness=models.Completeness.COMPLETE, limitations=[], correlation_id="synthetic-id",
    )
    assert meta.model_dump(mode="json")["observed_at"] == "2026-09-21T10:00:00Z"
    assert models.Page(page_size=50, next_page_token=None).model_dump()["next_page_token"] is None
