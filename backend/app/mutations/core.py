"""Generic mutation lifecycle. Plan-kind handlers are registered by later feature slices."""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Literal, Protocol
from uuid import uuid4

from app.api.v1 import models as w
from app.authz.roles import Target, decide
from app.config.settings import Settings
from app.domain.names import parts
from app.errors import (
    AppError,
    DuplicateSubmission,
    ForbiddenRole,
    NotFound,
    NotImplementedYet,
    PlanExpired,
    PlanInvalidated,
    PlanStale,
    PlanTampered,
)

logger = logging.getLogger(__name__)


def now_utc() -> datetime:
    return datetime.now(UTC)


def canonical(value: object) -> bytes:
    """Stable bytes for hashes and HMACs; this never serializes a secret."""
    return json.dumps(
        value, sort_keys=True, separators=(",", ":"), ensure_ascii=False
    ).encode("utf-8")


def state_hash(value: object) -> str:
    return hashlib.sha256(canonical(value)).hexdigest()


@dataclass(frozen=True)
class Preview:
    targets: tuple[w.AssetRef, ...]
    normalized_changes: tuple[w.NormalizedChange, ...]
    observed_states: tuple[object, ...]
    impact: w.Impact
    prerequisite_notes: tuple[str, ...] = ()
    inheritance_note: str | None = None
    requires_typed_confirmation: bool = False
    typed_confirmation_value: str | None = None


@dataclass(frozen=True)
class MutationWriteResult:
    status: Literal["applied", "failed", "unknown"]
    summary: str
    request_id: str | None = None
    error_code: w.ErrorCode | None = None
    error_message: str | None = None


class PlanKindHandler(Protocol):
    """A kind adapter is responsible for all target-specific SDK reads and writes."""

    kind: w.PlanKind

    def preview(self, request: w.PlanCreateRequest) -> Preview: ...

    def observe(self, target: w.AssetRef) -> object: ...

    def apply(self, target: w.AssetRef, changes: dict[str, object]) -> MutationWriteResult: ...

    def verify(self, target: w.AssetRef, changes: dict[str, object]) -> bool | None: ...


class PlanKindRegistry:
    def __init__(self) -> None:
        self._handlers: dict[w.PlanKind, PlanKindHandler] = {}

    def register(self, handler: PlanKindHandler) -> None:
        self._handlers[handler.kind] = handler

    def get(self, kind: w.PlanKind) -> PlanKindHandler:
        handler = self._handlers.get(kind)
        if handler is None:
            raise NotImplementedYet(
                f"Plan kind '{kind.value}' is not implemented in this version."
            )
        return handler


@dataclass(frozen=True)
class StoredPlan:
    plan: w.Plan
    changes: dict[str, object]
    observed_states: tuple[object, ...]


class OperationStore(Protocol):
    def save_plan(self, value: StoredPlan) -> None: ...

    def get_plan(self, plan_id: str) -> StoredPlan | None: ...

    def update_plan(self, value: StoredPlan) -> None: ...

    def save_operation(self, operation: w.Operation) -> None: ...

    def get_operation(self, operation_id: str) -> w.Operation | None: ...

    def find_operation_for_plan(self, plan_id: str) -> w.Operation | None: ...


class InMemoryOperationStore:
    """Fixture/test storage only. It is deliberately empty after an app restart."""

    def __init__(self) -> None:
        self._plans: dict[str, StoredPlan] = {}
        self._operations: dict[str, w.Operation] = {}
        self._operation_by_plan: dict[str, str] = {}

    def save_plan(self, value: StoredPlan) -> None:
        self._plans[str(value.plan.id)] = value

    def get_plan(self, plan_id: str) -> StoredPlan | None:
        return self._plans.get(str(plan_id))

    def update_plan(self, value: StoredPlan) -> None:
        self._plans[str(value.plan.id)] = value

    def save_operation(self, operation: w.Operation) -> None:
        self._operations[str(operation.id)] = operation
        self._operation_by_plan[str(operation.plan_id)] = str(operation.id)

    def get_operation(self, operation_id: str) -> w.Operation | None:
        return self._operations.get(str(operation_id))

    def find_operation_for_plan(self, plan_id: str) -> w.Operation | None:
        operation_id = self._operation_by_plan.get(str(plan_id))
        return self._operations.get(operation_id) if operation_id else None


class MutationEngine:
    def __init__(
        self,
        settings: Settings,
        registry: PlanKindRegistry | None = None,
        store: OperationStore | None = None,
    ) -> None:
        self.settings = settings
        self.registry = registry or PlanKindRegistry()
        self.store = store or InMemoryOperationStore()

    def _audit(self, boundary: str, **details: object) -> None:
        # Do not log changes, state snapshots, confirmation tokens, or exception text.
        logger.info(
            "Mutation lifecycle boundary", extra={"details": {"boundary": boundary, **details}}
        )

    def _authorize(
        self, identity: w.Identity, kind: w.PlanKind, targets: list[w.PlanTarget]
    ) -> None:
        for plan_target in targets:
            catalog = parts(plan_target.full_name)[0]
            decision = decide(
                identity,
                kind.value,
                Target(catalog=catalog),
                managed_catalogs=self.settings.managed_catalogs,
                mode=self.settings.mode,
            )
            if not decision.allowed:
                raise ForbiddenRole(decision.reason)

    def _binding(self, plan: w.Plan) -> dict[str, object]:
        value = plan.model_dump(mode="json")
        value.pop("confirmation_token", None)
        # Status may evolve as the server processes the operation; it is not client input.
        value.pop("status", None)
        value.pop("invalidated_by", None)
        return value

    def _sign(self, plan: w.Plan) -> str:
        secret = self.settings.plan_hmac_key.get_secret_value().encode("utf-8")
        return hmac.new(secret, canonical(self._binding(plan)), hashlib.sha256).hexdigest()

    def _verify_token(self, plan: w.Plan, supplied: str) -> None:
        expected = self._sign(plan)
        if not hmac.compare_digest(expected, supplied):
            self._audit("plan_tampered", plan_id=plan.id)
            raise PlanTampered()

    def build(self, request: w.PlanCreateRequest, identity: w.Identity) -> w.Plan:
        handler = self.registry.get(request.kind)
        self._authorize(identity, request.kind, request.targets)
        preview = handler.preview(request)
        if len(preview.targets) != len(request.targets) or len(preview.observed_states) != len(
            request.targets
        ):
            raise ValueError("Plan kind handler returned an incomplete preview.")
        observed_hash = state_hash(list(preview.observed_states))
        created_at = now_utc()
        draft = w.Plan(
            id=uuid4(),
            kind=request.kind,
            status=w.PlanStatus.PREVIEWED,
            identity=identity,
            workspace_id=self.settings.workspace_id,
            environment_label=self.settings.environment_label,
            targets=list(preview.targets),
            normalized_changes=list(preview.normalized_changes),
            observed_state_hash=observed_hash,
            impact=preview.impact,
            prerequisite_notes=list(preview.prerequisite_notes),
            inheritance_note=preview.inheritance_note,
            requires_typed_confirmation=preview.requires_typed_confirmation,
            typed_confirmation_value=preview.typed_confirmation_value,
            atomic=len(preview.targets) == 1,
            expires_at=created_at + timedelta(seconds=self.settings.plan_ttl_seconds),
            confirmation_token="",
            created_at=created_at,
            invalidated_by=None,
            access_request_id=request.access_request_id,
        )
        plan = draft.model_copy(update={"confirmation_token": self._sign(draft)})
        self.store.save_plan(
            StoredPlan(
                plan=plan, changes=dict(request.changes), observed_states=preview.observed_states
            )
        )
        self._audit("previewed", plan_id=plan.id, actor_id=identity.actor.id)
        return plan

    def get_plan(self, plan_id: str, identity: w.Identity) -> w.Plan:
        stored = self.store.get_plan(plan_id)
        if stored is None:
            raise NotFound()
        self._ensure_actor(stored.plan.identity, identity)
        self._authorize(identity, stored.plan.kind, [
            w.PlanTarget(securable_type=target.securable_type, full_name=target.full_name)
            for target in stored.plan.targets
        ])
        return stored.plan

    def _ensure_actor(self, owner: w.Identity, actor: w.Identity) -> None:
        if owner.actor.id != actor.actor.id:
            raise ForbiddenRole("Only the actor who created this plan may use it.")

    def _stored(self, plan_id: str, identity: w.Identity, token: str) -> StoredPlan:
        stored = self.store.get_plan(plan_id)
        if stored is None:
            raise NotFound()
        self._ensure_actor(stored.plan.identity, identity)
        self._verify_token(stored.plan, token)
        if stored.plan.status == w.PlanStatus.INVALIDATED:
            raise PlanInvalidated()
        if now_utc() >= stored.plan.expires_at:
            self.store.update_plan(
                StoredPlan(
                    plan=stored.plan.model_copy(update={"status": w.PlanStatus.EXPIRED}),
                    changes=stored.changes,
                    observed_states=stored.observed_states,
                )
            )
            self._audit("expired", plan_id=plan_id)
            raise PlanExpired(next_steps=["Regenerate the preview before applying this change."])
        return stored

    def execute(
        self,
        plan_id: str,
        request: w.PlanExecuteRequest,
        identity: w.Identity,
        correlation_id: str,
    ) -> w.Operation:
        stored = self._stored(plan_id, identity, request.confirmation_token)
        plan = stored.plan
        if plan.requires_typed_confirmation and request.typed_name != plan.typed_confirmation_value:
            from app.errors import ValidationFailed

            raise ValidationFailed("The typed confirmation does not match the required value.")
        duplicate = self.store.find_operation_for_plan(str(plan.id))
        if duplicate is not None:
            self._audit("duplicate_submission", plan_id=plan.id, operation_id=duplicate.id)
            raise DuplicateSubmission(
                next_steps=["Open the existing operation instead of submitting again."]
            )
        plan_targets = [
            w.PlanTarget(securable_type=target.securable_type, full_name=target.full_name)
            for target in plan.targets
        ]
        self._authorize(identity, plan.kind, plan_targets)
        handler = self.registry.get(plan.kind)
        current_states = tuple(handler.observe(target) for target in plan.targets)
        if state_hash(list(current_states)) != plan.observed_state_hash:
            self.store.update_plan(
                StoredPlan(
                    plan=plan.model_copy(update={"status": w.PlanStatus.STALE}),
                    changes=stored.changes,
                    observed_states=stored.observed_states,
                )
            )
            self._audit("stale", plan_id=plan.id)
            raise PlanStale(next_steps=["Regenerate the preview before applying this change."])
        self._audit("revalidated", plan_id=plan.id, actor_id=identity.actor.id)
        outcomes: list[w.TargetOutcome] = []
        for target in plan.targets:
            outcomes.append(self._apply_one(handler, target, stored.changes))
        status = self._operation_status(outcomes)
        operation = w.Operation(
            id=uuid4(),
            plan_id=plan.id,
            kind=plan.kind,
            status=status,
            identity=identity,
            started_at=now_utc(),
            finished_at=now_utc(),
            atomic=plan.atomic,
            targets=outcomes,
            reconcile_available=status == w.OperationStatus.UNKNOWN,
            summary=self._summary(status, outcomes),
            correlation_id=correlation_id,
        )
        self.store.save_operation(operation)
        self.store.update_plan(
            StoredPlan(
                plan=plan.model_copy(update={"status": w.PlanStatus(status.value)}),
                changes=stored.changes,
                observed_states=stored.observed_states,
            )
        )
        self._audit("executed", plan_id=plan.id, operation_id=operation.id, status=status.value)
        return operation

    def _apply_one(
        self, handler: PlanKindHandler, target: w.AssetRef, changes: dict[str, object]
    ) -> w.TargetOutcome:
        try:
            result = handler.apply(target, changes)
        except AppError as exc:
            if exc.code == w.ErrorCode.UPSTREAM_UNAVAILABLE:
                return w.TargetOutcome(
                    target=target,
                    status=w.TargetOutcomeStatus.UNKNOWN,
                    verified=False,
                    verified_at=None,
                    databricks_request_id=None,
                    error=w.TargetOutcomeError(
                        code=w.ErrorCode.OUTCOME_UNKNOWN,
                        message="The mutation result could not be determined.",
                    ),
                    summary="The target outcome is unknown. Reconcile before retrying.",
                )
            return w.TargetOutcome(
                target=target,
                status=w.TargetOutcomeStatus.FAILED,
                verified=False,
                verified_at=None,
                databricks_request_id=None,
                error=w.TargetOutcomeError(code=exc.code, message=exc.message),
                summary="The target change was rejected before it could be applied.",
            )
        except Exception:
            logger.warning("Mutation adapter returned an ambiguous result", exc_info=True)
            result = MutationWriteResult(
                status="unknown",
                summary="The target outcome is unknown. Reconcile before retrying.",
                error_code=w.ErrorCode.OUTCOME_UNKNOWN,
                error_message="The mutation result could not be determined.",
            )
        if result.status == "unknown":
            return w.TargetOutcome(
                target=target,
                status=w.TargetOutcomeStatus.UNKNOWN,
                verified=False,
                verified_at=None,
                databricks_request_id=result.request_id,
                error=w.TargetOutcomeError(
                    code=w.ErrorCode.OUTCOME_UNKNOWN,
                    message="The mutation result could not be determined.",
                ),
                summary=result.summary,
            )
        if result.status == "failed":
            return w.TargetOutcome(
                target=target,
                status=w.TargetOutcomeStatus.FAILED,
                verified=False,
                verified_at=None,
                databricks_request_id=result.request_id,
                error=w.TargetOutcomeError(
                    code=result.error_code or w.ErrorCode.INTERNAL_ERROR,
                    message=result.error_message or "The target change was not applied.",
                ),
                summary=result.summary,
            )
        try:
            verified = handler.verify(target, changes)
        except AppError:
            verified = None
        except Exception:
            logger.warning("Mutation verification read-back failed", exc_info=True)
            verified = None
        return w.TargetOutcome(
            target=target,
            status=w.TargetOutcomeStatus.APPLIED,
            verified=verified is True,
            verified_at=now_utc() if verified is True else None,
            databricks_request_id=result.request_id,
            error=None,
            summary=(
                result.summary
                if verified is True
                else result.summary + " Read-back verification was not available for this target."
            ),
        )

    @staticmethod
    def _operation_status(outcomes: list[w.TargetOutcome]) -> w.OperationStatus:
        statuses = {outcome.status for outcome in outcomes}
        if w.TargetOutcomeStatus.UNKNOWN in statuses:
            return w.OperationStatus.UNKNOWN
        applied = sum(outcome.status == w.TargetOutcomeStatus.APPLIED for outcome in outcomes)
        if applied == len(outcomes):
            return w.OperationStatus.APPLIED
        if applied:
            return w.OperationStatus.PARTIALLY_APPLIED
        return w.OperationStatus.FAILED

    @staticmethod
    def _summary(status: w.OperationStatus, outcomes: list[w.TargetOutcome]) -> str:
        if status == w.OperationStatus.UNKNOWN:
            return "One or more target outcomes are unknown. Reconcile before retrying."
        if status == w.OperationStatus.PARTIALLY_APPLIED:
            return "Some targets were applied; review each target outcome."
        if status == w.OperationStatus.APPLIED:
            return "All target changes were applied."
        return "No target changes were applied."

    def get_operation(self, operation_id: str, identity: w.Identity) -> w.Operation:
        operation = self.store.get_operation(operation_id)
        if operation is None:
            raise NotFound()
        self._ensure_actor(operation.identity, identity)
        return operation

    def reconcile(self, operation_id: str, identity: w.Identity) -> w.Operation:
        operation = self.get_operation(operation_id, identity)
        if operation.status != w.OperationStatus.UNKNOWN:
            return operation
        stored = self.store.get_plan(str(operation.plan_id))
        if stored is None:
            raise NotFound()
        handler = self.registry.get(operation.kind)
        outcomes: list[w.TargetOutcome] = []
        for outcome in operation.targets:
            if outcome.status != w.TargetOutcomeStatus.UNKNOWN:
                outcomes.append(outcome)
                continue
            verified = handler.verify(outcome.target, stored.changes)
            if verified is True:
                outcomes.append(
                    outcome.model_copy(
                        update={
                            "status": w.TargetOutcomeStatus.APPLIED,
                            "verified": True,
                            "verified_at": now_utc(),
                            "error": None,
                            "summary": (
                                "The target change was verified by reconciliation read-back."
                            ),
                        }
                    )
                )
            elif verified is False:
                outcomes.append(
                    outcome.model_copy(
                        update={
                            "status": w.TargetOutcomeStatus.FAILED,
                            "summary": "Reconciliation read-back did not find the target change.",
                        }
                    )
                )
            else:
                outcomes.append(outcome)
        status = self._operation_status(outcomes)
        result = operation.model_copy(
            update={
                "status": status,
                "targets": outcomes,
                "finished_at": now_utc() if status != w.OperationStatus.UNKNOWN else None,
                "reconcile_available": status == w.OperationStatus.UNKNOWN,
                "summary": self._summary(status, outcomes),
            }
        )
        self.store.save_operation(result)
        self._audit("reconciled", operation_id=operation.id, status=status.value)
        return result
