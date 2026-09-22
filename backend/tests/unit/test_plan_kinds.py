"""Fixture proofs for the first four concrete mutation plan kinds."""

import json
from dataclasses import replace

import pytest
from app.adapters.fixtures.readers import FixtureReaders
from app.api.v1 import models as w
from app.config.settings import Mode, Settings
from app.domain.enums import SecurableType
from app.domain.privileges import APPLICABILITY
from app.errors import ModeReadOnly, ValidationFailed
from app.mutations.core import MutationEngine, PlanKindRegistry
from app.mutations.plan_kinds import (
    register_connected_readonly_plan_kinds,
    register_fixture_plan_kinds,
)


def identity() -> w.Identity:
    return w.Identity(
        actor=w.Actor(
            id="u-test",
            display="test.admin",
            kind="user",
            roles=[w.AppRole.PLATFORM_ADMIN],
            verified_by="fixture",
        ),
        executor=w.Executor(kind="service_principal", display="synthetic", reason="fixture only"),
    )


def fixture_engine() -> MutationEngine:
    adapter = FixtureReaders()
    registry = PlanKindRegistry()
    for handler in register_fixture_plan_kinds(adapter, tuple(APPLICABILITY)):
        registry.register(handler)
    return MutationEngine(Settings(mode=Mode.FIXTURE), registry)


def request(
    kind: w.PlanKind, changes: dict[str, object], name: str = "sales.crm.orders"
) -> w.PlanCreateRequest:
    return w.PlanCreateRequest(
        kind=kind,
        targets=[w.PlanTarget(securable_type=SecurableType.TABLE, full_name=name)],
        changes=changes,
        reason="Fixture plan-kind test",
    )


def test_invalid_privilege_names_the_privilege_and_securable_type() -> None:
    with pytest.raises(ValidationFailed) as raised:
        fixture_engine().build(
            request(w.PlanKind.GRANT, {"principal": "analysts", "privileges": ["USE_SCHEMA"]}),
            identity(),
        )

    assert "USE_SCHEMA" in raised.value.message
    assert "TABLE" in raised.value.message


def test_workspace_local_group_is_refused_for_grants() -> None:
    with pytest.raises(ValidationFailed) as raised:
        fixture_engine().build(
            request(
                w.PlanKind.GRANT,
                {"principal": "local-project-team", "privileges": ["SELECT"]},
            ),
            identity(),
        )

    assert raised.value.errors[0].code == "NOT_UC_ELIGIBLE"
    assert "workspace-local" in raised.value.message


def test_inherited_revoke_has_source_reason_code_and_route() -> None:
    with pytest.raises(ValidationFailed) as raised:
        fixture_engine().build(
            request(
                w.PlanKind.REVOKE,
                {"principal": "sales-readers", "privileges": ["SELECT"]},
            ),
            identity(),
        )

    assert raised.value.errors[0].code == "INHERITED_FROM_PARENT"
    assert "/assets/sales/crm?tab=access" in raised.value.message


@pytest.mark.parametrize(
    ("kind", "changes"),
    [
        (w.PlanKind.GRANT, {"principal": "analysts", "privileges": ["SELECT"]}),
        (w.PlanKind.REVOKE, {"principal": "analysts", "privileges": ["MODIFY"]}),
    ],
)
def test_direct_grant_no_ops_are_previewed_not_counted_as_changes(
    kind: w.PlanKind, changes: dict[str, object]
) -> None:
    plan = fixture_engine().build(request(kind, changes), identity())

    assert len(plan.normalized_changes) == 1
    assert plan.normalized_changes[0].description.startswith("No change:")
    assert plan.normalized_changes[0].statement_preview.startswith("No request")


def test_ownership_transfer_requires_target_name_confirmation() -> None:
    plan = fixture_engine().build(
        request(w.PlanKind.TRANSFER_OWNERSHIP, {"new_owner": "analysts"}), identity()
    )

    assert plan.requires_typed_confirmation is True
    assert plan.typed_confirmation_value == "sales.crm.orders"
    assert "will lose ownership" in plan.impact.known[0]


def test_fixture_writes_are_read_back_for_all_four_kinds() -> None:
    cases = [
        (w.PlanKind.GRANT, {"principal": "auditors", "privileges": ["SELECT"]}, None),
        (w.PlanKind.REVOKE, {"principal": "analysts", "privileges": ["SELECT"]}, None),
        (
            w.PlanKind.TRANSFER_OWNERSHIP,
            {"new_owner": "analysts"},
            "sales.crm.orders",
        ),
        (w.PlanKind.EDIT_METADATA, {"comment": "Updated fixture comment"}, None),
    ]
    for kind, changes, typed_name in cases:
        engine = fixture_engine()
        plan = engine.build(request(kind, changes), identity())
        operation = engine.execute(
            plan.id,
            w.PlanExecuteRequest(
                confirmation_token=plan.confirmation_token,
                typed_name=typed_name,
            ),
            identity(),
            "fixture-correlation",
        )
        assert operation.targets[0].verified is True


def test_statement_preview_json_quotes_a_crafted_identifier() -> None:
    adapter = FixtureReaders()
    crafted = 'sales.crm.`orders"; DROP TABLE grants; --`'
    original = adapter.get_asset("TABLE", "sales.crm.orders")
    adapter.assets[("TABLE", crafted)] = replace(original, full_name=crafted)
    registry = PlanKindRegistry()
    for handler in register_fixture_plan_kinds(adapter, tuple(APPLICABILITY)):
        registry.register(handler)
    plan = MutationEngine(Settings(mode=Mode.FIXTURE), registry).build(
        request(w.PlanKind.GRANT, {"principal": "analysts", "privileges": ["SELECT"]}, crafted),
        identity(),
    )

    preview = plan.normalized_changes[0].statement_preview
    assert f"full_name={json.dumps(crafted, ensure_ascii=False, separators=(',', ':'))}" in preview
    assert 'full_name="sales.crm.`orders"; DROP' not in preview


def test_missing_use_prerequisites_and_unknown_impact_are_disclosed() -> None:
    plan = fixture_engine().build(
        request(w.PlanKind.GRANT, {"principal": "auditors", "privileges": ["SELECT"]}),
        identity(),
    )

    assert "USE_CATALOG" in plan.prerequisite_notes[0]
    assert "USE_SCHEMA" in plan.prerequisite_notes[0]
    assert plan.impact.unknown


def test_readonly_mode_rejects_each_registered_kind_before_any_write(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("UCGOV_FIXTURE_ACTOR")
    registry = PlanKindRegistry()
    for handler in register_connected_readonly_plan_kinds():
        registry.register(handler)
    engine = MutationEngine(
        Settings(
            mode=Mode.CONNECTED_READONLY,
            plan_hmac_key="x" * 32,
        ),
        registry,
    )

    changes = {
        w.PlanKind.GRANT: {"principal": "analysts", "privileges": ["SELECT"]},
        w.PlanKind.REVOKE: {"principal": "analysts", "privileges": ["SELECT"]},
        w.PlanKind.TRANSFER_OWNERSHIP: {"new_owner": "analysts"},
        w.PlanKind.EDIT_METADATA: {"comment": "Read-only attempt"},
    }
    for kind, payload in changes.items():
        with pytest.raises(ModeReadOnly):
            engine.build(request(kind, payload), identity())
