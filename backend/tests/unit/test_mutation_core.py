"""Plan lifecycle safety rules, using only a controllable in-memory adapter."""

from datetime import timedelta

import pytest
from app.api.v1 import models as w
from app.config.settings import Mode, Settings
from app.domain.enums import ObjectKind, SecurableType
from app.errors import DuplicateSubmission, PlanExpired, PlanStale, PlanTampered
from app.mutations.core import (
    MutationEngine,
    MutationWriteResult,
    PlanKindRegistry,
    Preview,
)


class FixturePlanHandler:
    kind = w.PlanKind.GRANT

    def __init__(self, states: dict[str, str], results: dict[str, str] | None = None) -> None:
        self.states = states
        self.results = results or {}
        self.writes = 0
        self.reconcile_values: dict[str, bool | None] = {}

    def _asset(self, full_name: str) -> w.AssetRef:
        return w.AssetRef(
            securable_type=SecurableType.TABLE,
            full_name=full_name,
            kind=ObjectKind.TABLE,
            display_name=full_name.rsplit(".", maxsplit=1)[-1],
        )

    def preview(self, request: w.PlanCreateRequest) -> Preview:
        targets = tuple(self._asset(value.full_name) for value in request.targets)
        return Preview(
            targets=targets,
            normalized_changes=tuple(
                w.NormalizedChange(
                    target=target,
                    description="Synthetic direct change",
                    statement_preview="fixture delta",
                )
                for target in targets
            ),
            observed_states=tuple(self.states[target.full_name] for target in targets),
            impact=w.Impact(known=[], unknown=["Synthetic impact is not calculated."]),
        )

    def observe(self, target: w.AssetRef) -> object:
        return self.states[target.full_name]

    def apply(self, target: w.AssetRef, changes: dict[str, object]) -> MutationWriteResult:
        self.writes += 1
        result = self.results.get(target.full_name, "applied")
        if result == "unknown":
            return MutationWriteResult(status="unknown", summary="Synthetic timeout after send.")
        if result == "failed":
            return MutationWriteResult(status="failed", summary="Synthetic rejection.")
        self.states[target.full_name] = "changed"
        return MutationWriteResult(status="applied", summary="Synthetic mutation accepted.")

    def verify(self, target: w.AssetRef, changes: dict[str, object]) -> bool | None:
        return self.reconcile_values.get(
            target.full_name, self.states[target.full_name] == "changed"
        )


def identity() -> w.Identity:
    return w.Identity(
        actor=w.Actor(
            id="u-test",
            display="test.admin",
            kind="user",
            roles=[w.AppRole.ACCESS_ADMIN],
            verified_by="fixture",
        ),
        executor=w.Executor(
            kind="service_principal", display="synthetic", reason="fixture only"
        ),
    )


def engine_with(
    states: dict[str, str], results: dict[str, str] | None = None
) -> tuple[MutationEngine, FixturePlanHandler]:
    handler = FixturePlanHandler(states, results)
    registry = PlanKindRegistry()
    registry.register(handler)
    return MutationEngine(Settings(mode=Mode.FIXTURE), registry), handler


def request(*names: str) -> w.PlanCreateRequest:
    return w.PlanCreateRequest(
        kind=w.PlanKind.GRANT,
        targets=[
            w.PlanTarget(securable_type=SecurableType.TABLE, full_name=name) for name in names
        ],
        changes={"principal": "analysts", "privileges": ["SELECT"]},
        reason="Synthetic test change",
    )


def test_tampered_confirmation_token_is_rejected() -> None:
    engine, handler = engine_with({"sales.crm.orders": "before"})
    plan = engine.build(request("sales.crm.orders"), identity())

    with pytest.raises(PlanTampered):
        engine.execute(
            plan.id, w.PlanExecuteRequest(confirmation_token="0" * 64), identity(), "cid"
        )

    assert handler.writes == 0


def test_preview_never_calls_a_write_path() -> None:
    engine, handler = engine_with({"sales.crm.orders": "before"})

    engine.build(request("sales.crm.orders"), identity())

    assert handler.writes == 0


def test_expired_plan_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    engine, handler = engine_with({"sales.crm.orders": "before"})
    plan = engine.build(request("sales.crm.orders"), identity())
    import app.mutations.core as core

    monkeypatch.setattr(core, "now_utc", lambda: plan.expires_at + timedelta(seconds=1))
    with pytest.raises(PlanExpired):
        engine.execute(
            plan.id,
            w.PlanExecuteRequest(confirmation_token=plan.confirmation_token),
            identity(),
            "cid",
        )

    assert handler.writes == 0


def test_state_changed_after_preview_is_stale() -> None:
    engine, handler = engine_with({"sales.crm.orders": "before"})
    plan = engine.build(request("sales.crm.orders"), identity())
    handler.states["sales.crm.orders"] = "concurrent-change"

    with pytest.raises(PlanStale) as raised:
        engine.execute(
            plan.id,
            w.PlanExecuteRequest(confirmation_token=plan.confirmation_token),
            identity(),
            "cid",
        )

    assert "Regenerate the preview" in raised.value.next_steps[0]
    assert handler.writes == 0


def test_partial_multi_target_execution_has_individual_outcomes() -> None:
    engine, _ = engine_with(
        {"sales.crm.orders": "before", "sales.crm.customers": "before"},
        {"sales.crm.customers": "failed"},
    )
    plan = engine.build(request("sales.crm.orders", "sales.crm.customers"), identity())
    operation = engine.execute(
        plan.id, w.PlanExecuteRequest(confirmation_token=plan.confirmation_token), identity(), "cid"
    )

    assert operation.status == w.OperationStatus.PARTIALLY_APPLIED
    assert [outcome.status for outcome in operation.targets] == [
        w.TargetOutcomeStatus.APPLIED,
        w.TargetOutcomeStatus.FAILED,
    ]


def test_ambiguous_execution_is_unknown_not_failed() -> None:
    engine, _ = engine_with({"sales.crm.orders": "before"}, {"sales.crm.orders": "unknown"})
    plan = engine.build(request("sales.crm.orders"), identity())
    operation = engine.execute(
        plan.id, w.PlanExecuteRequest(confirmation_token=plan.confirmation_token), identity(), "cid"
    )

    assert operation.status == w.OperationStatus.UNKNOWN
    assert operation.targets[0].status == w.TargetOutcomeStatus.UNKNOWN
    assert operation.reconcile_available is True


def test_reconcile_resolves_an_unknown_without_replaying_the_write() -> None:
    engine, handler = engine_with({"sales.crm.orders": "before"}, {"sales.crm.orders": "unknown"})
    plan = engine.build(request("sales.crm.orders"), identity())
    operation = engine.execute(
        plan.id, w.PlanExecuteRequest(confirmation_token=plan.confirmation_token), identity(), "cid"
    )
    handler.reconcile_values["sales.crm.orders"] = True

    reconciled = engine.reconcile(operation.id, identity())
    assert reconciled.status == w.OperationStatus.APPLIED
    assert reconciled.targets[0].verified is True
    assert handler.writes == 1


def test_duplicate_execution_never_replays_the_mutation() -> None:
    engine, handler = engine_with({"sales.crm.orders": "before"})
    plan = engine.build(request("sales.crm.orders"), identity())
    execute_request = w.PlanExecuteRequest(confirmation_token=plan.confirmation_token)
    engine.execute(plan.id, execute_request, identity(), "cid")

    with pytest.raises(DuplicateSubmission):
        engine.execute(plan.id, execute_request, identity(), "cid")

    assert handler.writes == 1
