"""Fixture proofs for the first four concrete mutation plan kinds."""

import json
from dataclasses import replace

import pytest
from app.adapters.fixtures.readers import FixtureReaders
from app.api.v1 import models as w
from app.config.settings import Mode, Settings
from app.domain.enums import ActionName, SecurableType, TagKind
from app.domain.models import AllowedAction, Tag
from app.domain.privileges import APPLICABILITY
from app.domain.reads import ReadPolicy
from app.errors import ModeReadOnly, PlanStale, ValidationFailed
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


def policy_changes(**overrides: object) -> dict[str, object]:
    values: dict[str, object] = {
        "name": "filter_sales_internal",
        "policy_type": "row_filter",
        "when_condition": "has_tag_value('sensitivity', 'internal')",
        "to_principals": ["analysts"],
        "except_principals": [],
        "function_full_name": "shared_ref.governance.normalize_id",
        "match_columns": ["id"],
    }
    values.update(overrides)
    return values


def policy_request(kind: w.PlanKind, changes: dict[str, object]) -> w.PlanCreateRequest:
    return w.PlanCreateRequest(
        kind=kind,
        targets=[w.PlanTarget(securable_type=SecurableType.CATALOG, full_name="sales")],
        changes=changes,
        reason="Fixture ABAC policy test",
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


def test_fixture_writes_are_read_back_for_all_registered_kinds() -> None:
    cases = [
        (w.PlanKind.GRANT, {"principal": "auditors", "privileges": ["SELECT"]}, None),
        (w.PlanKind.REVOKE, {"principal": "analysts", "privileges": ["SELECT"]}, None),
        (
            w.PlanKind.TRANSFER_OWNERSHIP,
            {"new_owner": "analysts"},
            "sales.crm.orders",
        ),
        (w.PlanKind.EDIT_METADATA, {"comment": "Updated fixture comment"}, None),
        (
            w.PlanKind.ASSIGN_TAGS,
            {"tags": [{"key": "sensitivity", "value": "public"}]},
            None,
        ),
        (w.PlanKind.REMOVE_TAGS, {"tags": [{"key": "data_domain"}]}, None),
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


def test_policy_signature_and_scope_validation_name_the_reason() -> None:
    with pytest.raises(ValidationFailed) as signature:
        fixture_engine().build(
            policy_request(
                w.PlanKind.CREATE_ABAC_POLICY,
                policy_changes(policy_type="column_mask"),
            ),
            identity(),
        )
    assert signature.value.errors[0].code == "UNSUPPORTED_SIGNATURE"
    assert "column_mask" in signature.value.message

    invalid_scope = w.PlanCreateRequest(
        kind=w.PlanKind.CREATE_ABAC_POLICY,
        targets=[
            w.PlanTarget(securable_type=SecurableType.VOLUME, full_name="sales.crm.raw_exports")
        ],
        changes=policy_changes(),
        reason="Reject unsupported policy scope",
    )
    with pytest.raises(ValidationFailed) as scope:
        fixture_engine().build(invalid_scope, identity())
    assert scope.value.errors[0].code == "UNSUPPORTED_SCOPE"


def test_delete_policy_requires_typed_confirmation_and_discloses_widening() -> None:
    engine = fixture_engine()
    plan = engine.build(
        policy_request(
            w.PlanKind.DELETE_ABAC_POLICY,
            {"policy_id": "fixture-policy-sales-sensitive-rows"},
        ),
        identity(),
    )
    assert plan.requires_typed_confirmation is True
    assert plan.typed_confirmation_value == "sales"
    assert "widen access" in plan.normalized_changes[0].description
    assert any("may widen access" in value for value in plan.impact.known)
    assert plan.impact.unknown
    assert any("not evaluated by databricks" in value.lower() for value in plan.impact.unknown)
    with pytest.raises(ValidationFailed):
        engine.execute(
            plan.id,
            w.PlanExecuteRequest(
                confirmation_token=plan.confirmation_token,
                typed_name="not-the-required-scope",
            ),
            identity(),
            "fixture-correlation",
        )


def test_update_policy_definition_change_after_preview_is_stale() -> None:
    engine = fixture_engine()
    policy_id = "fixture-policy-sales-sensitive-rows"
    current = engine.registry.get(w.PlanKind.UPDATE_ABAC_POLICY).adapter.get_abac_policy(policy_id)  # type: ignore[attr-defined]
    plan = engine.build(
        policy_request(
            w.PlanKind.UPDATE_ABAC_POLICY,
            policy_changes(policy_id=policy_id, name=current.name),
        ),
        identity(),
    )
    adapter = engine.registry.get(w.PlanKind.UPDATE_ABAC_POLICY).adapter  # type: ignore[attr-defined]
    adapter.abac_policies[policy_id] = replace(current, when_condition="has_tag('sensitivity')")
    with pytest.raises(PlanStale):
        engine.execute(
            plan.id,
            w.PlanExecuteRequest(confirmation_token=plan.confirmation_token),
            identity(),
            "fixture-correlation",
        )


def test_all_policy_plan_kinds_write_and_read_back() -> None:
    create_engine = fixture_engine()
    create = create_engine.build(
        policy_request(w.PlanKind.CREATE_ABAC_POLICY, policy_changes(name="new_sales_filter")),
        identity(),
    )
    created = create_engine.execute(
        create.id,
        w.PlanExecuteRequest(confirmation_token=create.confirmation_token),
        identity(),
        "fixture-correlation",
    )
    assert created.targets[0].verified is True

    policy_id = "fixture-policy-sales-sensitive-rows"
    update_engine = fixture_engine()
    current = update_engine.registry.get(w.PlanKind.UPDATE_ABAC_POLICY).adapter.get_abac_policy(  # type: ignore[attr-defined]
        policy_id
    )
    update = update_engine.build(
        policy_request(
            w.PlanKind.UPDATE_ABAC_POLICY,
            policy_changes(policy_id=policy_id, name=current.name, to_principals=["auditors"]),
        ),
        identity(),
    )
    updated = update_engine.execute(
        update.id,
        w.PlanExecuteRequest(confirmation_token=update.confirmation_token),
        identity(),
        "fixture-correlation",
    )
    assert updated.targets[0].verified is True

    delete_engine = fixture_engine()
    delete = delete_engine.build(
        policy_request(w.PlanKind.DELETE_ABAC_POLICY, {"policy_id": policy_id}), identity()
    )
    deleted = delete_engine.execute(
        delete.id,
        w.PlanExecuteRequest(
            confirmation_token=delete.confirmation_token,
            typed_name="sales",
        ),
        identity(),
        "fixture-correlation",
    )
    assert deleted.targets[0].verified is True


def test_policy_statement_preview_json_quotes_crafted_name() -> None:
    name = 'policy"; DROP POLICY safe; --'
    plan = fixture_engine().build(
        policy_request(w.PlanKind.CREATE_ABAC_POLICY, policy_changes(name=name)), identity()
    )
    preview = plan.normalized_changes[0].statement_preview
    assert f"name={json.dumps(name, ensure_ascii=False, separators=(',', ':'))}" in preview
    assert f'name="{name}"' not in preview


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
        w.PlanKind.ASSIGN_TAGS: {"tags": [{"key": "data_domain", "value": "finance"}]},
        w.PlanKind.REMOVE_TAGS: {"tags": [{"key": "data_domain"}]},
        w.PlanKind.CREATE_ABAC_POLICY: policy_changes(),
        w.PlanKind.UPDATE_ABAC_POLICY: policy_changes(
            policy_id="fixture-policy-sales-sensitive-rows"
        ),
        w.PlanKind.DELETE_ABAC_POLICY: {"policy_id": "fixture-policy-sales-sensitive-rows"},
        w.PlanKind.SET_ROW_FILTER: {
            "function_full_name": "shared_ref.governance.normalize_id",
            "input_columns": ["id"],
        },
        w.PlanKind.DROP_ROW_FILTER: {},
        w.PlanKind.SET_COLUMN_MASK: {
            "column": "email",
            "function_full_name": "shared_ref.governance.mask_email",
            "using_columns": [],
        },
        w.PlanKind.DROP_COLUMN_MASK: {"column": "email"},
    }
    for kind, payload in changes.items():
        with pytest.raises(ModeReadOnly):
            engine.build(request(kind, payload), identity())


def filter_request(kind: w.PlanKind, changes: dict[str, object]) -> w.PlanCreateRequest:
    return request(kind, changes, "sales.crm.customers")


def test_filter_and_mask_plan_kinds_write_and_read_back() -> None:
    cases = [
        (
            w.PlanKind.SET_ROW_FILTER,
            {"function_full_name": "shared_ref.governance.normalize_id", "input_columns": ["id"]},
        ),
        (w.PlanKind.DROP_ROW_FILTER, {}),
        (
            w.PlanKind.SET_COLUMN_MASK,
            {
                "column": "email",
                "function_full_name": "shared_ref.governance.mask_email",
                "using_columns": [],
            },
        ),
        (w.PlanKind.DROP_COLUMN_MASK, {"column": "email"}),
    ]
    for kind, changes in cases:
        engine = fixture_engine()
        plan = engine.build(filter_request(kind, changes), identity())
        assert plan.requires_typed_confirmation is True
        operation = engine.execute(
            plan.id,
            w.PlanExecuteRequest(
                confirmation_token=plan.confirmation_token,
                typed_name="sales.crm.customers",
            ),
            identity(),
            "fixture-correlation",
        )
        assert operation.targets[0].verified is True


def test_filter_signature_mismatch_names_argument() -> None:
    with pytest.raises(ValidationFailed) as raised:
        fixture_engine().build(
            filter_request(
                w.PlanKind.SET_ROW_FILTER,
                {"function_full_name": "shared_ref.governance.mask_email", "input_columns": ["id"]},
            ),
            identity(),
        )

    assert raised.value.errors[0].code == "ARGUMENT_TYPE"
    assert "Argument 1 ('id')" in raised.value.message


def test_drop_filter_exposure_preview_and_unknown_audience_are_explicit() -> None:
    plan = fixture_engine().build(filter_request(w.PlanKind.DROP_ROW_FILTER, {}), identity())

    assert plan.requires_typed_confirmation is True
    assert "may become visible" in plan.impact.known[0]
    assert any("cannot enumerate" in item for item in plan.impact.unknown)
    assert any("No query was run" in item for item in plan.impact.unknown)


def test_filter_state_change_after_preview_is_stale() -> None:
    engine = fixture_engine()
    plan = engine.build(
        filter_request(w.PlanKind.DROP_COLUMN_MASK, {"column": "email"}), identity()
    )
    adapter = engine.registry.get(w.PlanKind.DROP_COLUMN_MASK).adapter  # type: ignore[attr-defined]
    adapter.update_column_mask("sales.crm.customers", "email", None, ())

    with pytest.raises(PlanStale):
        engine.execute(
            plan.id,
            w.PlanExecuteRequest(
                confirmation_token=plan.confirmation_token,
                typed_name="sales.crm.customers",
            ),
            identity(),
            "fixture-correlation",
        )


def test_filter_sql_identifier_template_quotes_a_crafted_identifier() -> None:
    adapter = FixtureReaders()
    crafted = 'sales.crm.`customers"; DROP TABLE grants; --`'
    original = adapter.get_asset("TABLE", "sales.crm.customers")
    adapter.assets[("TABLE", crafted)] = replace(
        original, full_name=crafted, row_filter=None
    )
    registry = PlanKindRegistry()
    for handler in register_fixture_plan_kinds(adapter, tuple(APPLICABILITY)):
        registry.register(handler)
    plan = MutationEngine(Settings(mode=Mode.FIXTURE), registry).build(
        request(
            w.PlanKind.SET_ROW_FILTER,
            {"function_full_name": "shared_ref.governance.normalize_id", "input_columns": ["id"]},
            crafted,
        ),
        identity(),
    )

    preview = plan.normalized_changes[0].statement_preview
    assert '`customers"; DROP TABLE grants; --`' in preview
    assert "ALTER TABLE `sales`.`crm`." in preview


def test_system_tag_preview_uses_the_read_policy_refusal() -> None:
    source = ReadPolicy.tag(
        Tag(
            key="system.classification",
            value="identifier",
            kind=TagKind.SYSTEM,
            allowed_actions=(),
        ),
        tuple(
            AllowedAction(action=action, allowed=True)
            for action in (ActionName.ASSIGN_TAG, ActionName.REMOVE_TAG)
        ),
    )
    expected = source.allowed_actions[0].reason
    for kind in (w.PlanKind.ASSIGN_TAGS, w.PlanKind.REMOVE_TAGS):
        with pytest.raises(ValidationFailed) as raised:
            fixture_engine().build(
                request(kind, {"tags": [{"key": "system.classification"}]}), identity()
            )
        assert raised.value.errors[0].code == "SYSTEM_TAG"
        assert raised.value.message == expected


def test_governed_tag_open_and_empty_allowed_values_are_distinct() -> None:
    open_plan = fixture_engine().build(
        request(
            w.PlanKind.ASSIGN_TAGS,
            {"column": "id", "tags": [{"key": "pii", "value": "passport"}]},
        ),
        identity(),
    )
    assert open_plan.normalized_changes[0].description.startswith("Replace")
    with pytest.raises(ValidationFailed) as raised:
        fixture_engine().build(
            request(
                w.PlanKind.ASSIGN_TAGS,
                {"tags": [{"key": "retention", "value": "seven_years"}]},
            ),
            identity(),
        )
    assert "retention" in raised.value.message
    assert "seven_years" in raised.value.message
    assert "[]" in raised.value.message


def test_closed_governed_value_validation_names_key_value_and_permitted_set() -> None:
    with pytest.raises(ValidationFailed) as raised:
        fixture_engine().build(
            request(w.PlanKind.ASSIGN_TAGS, {"tags": [{"key": "sensitivity", "value": "secret"}]}),
            identity(),
        )
    assert "sensitivity" in raised.value.message
    assert "secret" in raised.value.message
    assert "internal" in raised.value.message


def test_tag_noops_overwrites_and_abac_unknowns_are_honest() -> None:
    same = fixture_engine().build(
        request(w.PlanKind.ASSIGN_TAGS, {"tags": [{"key": "sensitivity", "value": "internal"}]}),
        identity(),
    )
    assert same.normalized_changes[0].description.startswith("No change:")
    overwrite = fixture_engine().build(
        request(w.PlanKind.ASSIGN_TAGS, {"tags": [{"key": "sensitivity", "value": "public"}]}),
        identity(),
    )
    assert "Replace" in overwrite.normalized_changes[0].description
    assert "internal" in overwrite.normalized_changes[0].description
    missing = fixture_engine().build(
        request(w.PlanKind.REMOVE_TAGS, {"tags": [{"key": "absent"}]}), identity()
    )
    assert missing.normalized_changes[0].description.startswith("No change:")
    for plan in (overwrite, missing):
        assert "Row filters, column masks or ABAC policies" in plan.impact.unknown[-1]
        assert "not evaluated" in plan.impact.unknown[-1]


def test_tag_statement_preview_json_quotes_crafted_key_and_value() -> None:
    key = 'classification"), DROP TABLE x; --'
    value = 'public"), DROP TABLE x; --'
    plan = fixture_engine().build(
        request(w.PlanKind.ASSIGN_TAGS, {"tags": [{"key": key, "value": value}]}), identity()
    )
    preview = plan.normalized_changes[0].statement_preview
    assert f"tag_key={json.dumps(key, ensure_ascii=False, separators=(',', ':'))}" in preview
    assert f"tag_value={json.dumps(value, ensure_ascii=False, separators=(',', ':'))}" in preview
    assert f'tag_key="{key}"' not in preview
