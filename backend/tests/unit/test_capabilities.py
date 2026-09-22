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
