import pytest
from app.api.v1.models import CapabilityStatusValue as Status
from app.capabilities.registry import REGISTRY, probe, require_available
from app.config.settings import Settings
from app.errors import NotImplementedYet


def test_only_implemented_capabilities_available() -> None:
    assert {row.capability for row in REGISTRY if row.status == Status.AVAILABLE} == {
        "context.read",
        "identity.read",
        "capabilities.read",
        "assets.read",
        "assets.edit_metadata",
        "grants.read",
        "grants.update",
        "ownership.transfer",
        "principals.search",
        "privileges.read",
        "tags.read",
        "tags.update",
        "tag_policies.read",
            "abac_policies.read",
            "abac_policies.update",
        "filters.read",
        "filters.update",
        "storage_credentials.read",
        "external_locations.read",
            "plans.lifecycle_core",
        "plans.read",
        "operations.read",
        "plans.create",
        "plans.execute",
        "operations.reconcile",
    }
    assert len({row.capability for row in REGISTRY}) == len(REGISTRY)
    assert all(row.domain for row in REGISTRY)


def test_missing_warehouse_downgrades_without_enabling_other_features(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    lineage = next(row for row in REGISTRY if row.capability == "lineage.read")
    assert probe(lineage, Settings()).status == Status.NOT_CONFIGURED
    monkeypatch.setenv("UCGOV_WAREHOUSE_ID", "synthetic-warehouse")
    assert probe(lineage, Settings()).status == Status.NOT_IMPLEMENTED
    with pytest.raises(NotImplementedYet) as exc:
        require_available("lineage.read", Settings())
    assert exc.value.http_status == 501


def test_classification_results_are_reported_unsupported_with_evidence() -> None:
    classification = next(row for row in REGISTRY if row.capability == "classification.read")

    reported = probe(classification, Settings())

    assert reported.status == Status.UNSUPPORTED_IN_ENVIRONMENT
    assert reported.reason is not None
    assert "0.140.0" in reported.reason
    assert "results" in reported.reason


def test_storage_capabilities_match_the_frozen_contract() -> None:
    values = {row.capability: row for row in REGISTRY if row.domain == "7.6"}

    assert values["storage_credentials.read"].status == Status.AVAILABLE
    assert values["external_locations.read"].status == Status.AVAILABLE
    for capability in (
        "storage_credentials.create",
        "storage_credentials.update",
        "storage_credentials.delete",
        "storage_credentials.validate",
        "external_locations.create",
        "external_locations.update",
        "external_locations.delete",
        "external_locations.validate",
        "service_credentials.read",
        "service_credentials.update",
    ):
        reported = probe(values[capability], Settings())
        assert reported.status == Status.NOT_IMPLEMENTED
        assert reported.reason is not None
        assert "frozen contract" in reported.reason
