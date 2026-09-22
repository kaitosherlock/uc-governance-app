"""Adversarial HTTP tests for the frozen v1 security boundary.

The manifest is deliberately complete: adding a contract route requires an explicit
authorization expectation here before this test can pass.
"""

from datetime import datetime, timedelta
from unittest.mock import AsyncMock, Mock

import pytest
from app import main
from app.api.v1 import models as w
from app.auth.protocols import ResolvedUser
from app.config.settings import Mode, Settings
from app.errors import UpstreamUnavailable
from app.mutations.core import MutationWriteResult, StoredPlan
from fastapi.testclient import TestClient

READ_CALLS: dict[str, tuple[str, str]] = {
    "getContext": ("GET", "/api/v1/context"),
    "getMe": ("GET", "/api/v1/me"),
    "listCapabilities": ("GET", "/api/v1/capabilities"),
    "listCatalogs": ("GET", "/api/v1/catalogs"),
    "listSchemas": ("GET", "/api/v1/catalogs/sales/schemas"),
    "listSchemaObjects": ("GET", "/api/v1/schemas/sales/crm/objects"),
    "getAsset": ("GET", "/api/v1/assets/TABLE/sales.crm.orders"),
    "getAssetDependencies": ("GET", "/api/v1/assets/TABLE/sales.crm.orders/dependencies"),
    "getGrants": ("GET", "/api/v1/assets/TABLE/sales.crm.orders/grants"),
    "listPrivileges": ("GET", "/api/v1/privileges?securable_type=TABLE"),
    "searchPrincipals": ("GET", "/api/v1/principals/search?q=an"),
}

MUTATION_OPERATIONS = {
    "createPlan",
    "getPlan",
    "executePlan",
    "getOperation",
    "reconcileOperation",
}
ALL_OPERATIONS = set(READ_CALLS) | MUTATION_OPERATIONS
ACTORS = ("victor.viewer", "alice.steward", "audrey.auditor", "pat.platform")


def plan_body(*, target: str = "sales.crm.orders") -> dict[str, object]:
    return {
        "kind": "grant",
        "targets": [{"securable_type": "TABLE", "full_name": target}],
        "changes": {"principal": "auditors", "privileges": ["SELECT"]},
        "reason": "Adversarial API lifecycle test",
    }


def fixture_app(monkeypatch: pytest.MonkeyPatch, actor: str = "alice.steward"):
    monkeypatch.setenv("UCGOV_FIXTURE_ACTOR", actor)
    return main.create_app()


def create_plan(client: TestClient) -> dict[str, object]:
    response = client.post("/api/v1/plans", json=plan_body())
    assert response.status_code == 201, response.text
    return response.json()["data"]


def execute(client: TestClient, plan: dict[str, object]) -> object:
    return client.post(
        f"/api/v1/plans/{plan['id']}/execute",
        json={"confirmation_token": plan["confirmation_token"]},
    )


def route_operations(app: object) -> set[str]:
    schema = app.openapi()  # type: ignore[attr-defined]
    return {
        operation["operationId"]
        for path, methods in schema["paths"].items()
        if path.startswith("/api/v1/")
        for operation in methods.values()
    }


def test_route_manifest_requires_a_decision_for_every_v1_route(app: object) -> None:
    """Routes are checked as a table, not a hand-picked list of examples."""
    assert route_operations(app) == ALL_OPERATIONS


def test_me_keeps_fixture_actor_and_executor_distinct(client: TestClient) -> None:
    identity = client.get("/api/v1/me").json()["data"]
    assert identity["actor"]["kind"] == "user"
    assert identity["executor"]["kind"] == "service_principal"
    assert identity["actor"]["display"] != identity["executor"]["display"]


@pytest.mark.parametrize("actor", ACTORS)
def test_each_role_can_use_every_exposed_read_route(
    monkeypatch: pytest.MonkeyPatch, actor: str
) -> None:
    app = fixture_app(monkeypatch, actor)
    with TestClient(app) as client:
        for operation_id, (method, path) in READ_CALLS.items():
            response = client.request(method, path)
            assert response.status_code == 200, (
                f"{actor} unexpectedly denied {operation_id}: {response.text}"
            )


@pytest.mark.parametrize(
    ("actor", "expected_status", "expected_code"),
    [
        ("victor.viewer", 403, "FORBIDDEN_ROLE"),
        ("alice.steward", 201, None),
        ("audrey.auditor", 403, "FORBIDDEN_ROLE"),
        ("pat.platform", 201, None),
    ],
)
def test_plan_creation_role_boundary(
    monkeypatch: pytest.MonkeyPatch,
    actor: str,
    expected_status: int,
    expected_code: str | None,
) -> None:
    app = fixture_app(monkeypatch, actor)
    with TestClient(app) as client:
        response = client.post("/api/v1/plans", json=plan_body())
    assert response.status_code == expected_status
    if expected_code:
        assert response.json()["code"] == expected_code


def test_plan_scope_denial_is_not_misreported_as_a_role_denial(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("UCGOV_MANAGED_CATALOGS", "sales")
    app = fixture_app(monkeypatch, "pat.platform")
    with TestClient(app) as client:
        response = client.post("/api/v1/plans", json=plan_body(target="hr.people.records"))
    assert response.status_code == 403
    assert response.json()["code"] == "FORBIDDEN_SCOPE"


def test_reader_cannot_execute_a_plan_even_when_it_is_bound_to_the_reader(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app = fixture_app(monkeypatch, "victor.viewer")
    engine = app.state.container.mutation_engine
    handler = engine.registry.get(w.PlanKind.GRANT)
    plan = engine.build(w.PlanCreateRequest(**plan_body()), w.Identity(
        actor=w.Actor(
            id="u-1002", display="victor.viewer@example.test", kind="user",
            roles=[w.AppRole.ACCESS_ADMIN], verified_by="fixture"
        ),
        executor=w.Executor(kind="service_principal", display="synthetic", reason="fixture"),
    ))
    writes = Mock(wraps=handler.apply)
    monkeypatch.setattr(handler, "apply", writes)
    with TestClient(app) as client:
        response = execute(client, plan.model_dump(mode="json"))
    assert response.status_code == 403
    assert response.json()["code"] == "FORBIDDEN_ROLE"
    writes.assert_not_called()


def test_plan_actor_binding_blocks_a_different_privileged_actor(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app = fixture_app(monkeypatch)
    with TestClient(app) as client:
        plan = create_plan(client)
        app.state.settings.fixture_actor = "pat.platform"
        response = execute(client, plan)
    assert response.status_code == 403
    assert response.json()["code"] == "FORBIDDEN_ROLE"


@pytest.mark.parametrize(
    ("body", "status", "code"),
    [
        ({"confirmation_token": "0" * 64}, 409, "PLAN_TAMPERED"),
        ({"confirmation_token": "short"}, 409, "PLAN_TAMPERED"),
        ({}, 400, "VALIDATION_FAILED"),
    ],
)
def test_confirmation_token_cannot_be_replaced_truncated_or_omitted(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    body: dict[str, str],
    status: int,
    code: str,
) -> None:
    plan = create_plan(client)
    handler = client.app.state.container.mutation_engine.registry.get(w.PlanKind.GRANT)  # type: ignore[attr-defined]
    writes = Mock(wraps=handler.apply)
    monkeypatch.setattr(handler, "apply", writes)
    response = client.post(f"/api/v1/plans/{plan['id']}/execute", json=body)
    assert response.status_code == status
    assert response.json()["code"] == code
    writes.assert_not_called()


def test_expired_stale_and_invalidated_plans_have_distinct_contract_errors(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    import app.mutations.core as core

    engine = client.app.state.container.mutation_engine  # type: ignore[attr-defined]
    expired = create_plan(client)
    original_now = core.now_utc
    monkeypatch.setattr(
        core,
        "now_utc",
        lambda: datetime.fromisoformat(expired["expires_at"]) + timedelta(seconds=1),
    )
    response = execute(client, expired)
    assert (response.status_code, response.json()["code"]) == (409, "PLAN_EXPIRED")

    monkeypatch.setattr(core, "now_utc", original_now)
    stale = create_plan(client)
    handler = engine.registry.get(w.PlanKind.GRANT)
    original_observe = handler.observe
    monkeypatch.setattr(handler, "observe", lambda target: {"changed": target.full_name})
    response = execute(client, stale)
    assert (response.status_code, response.json()["code"]) == (409, "PLAN_STALE")

    monkeypatch.setattr(handler, "observe", original_observe)
    invalidated = create_plan(client)
    stored = engine.store.get_plan(invalidated["id"])
    assert stored is not None
    engine.store.update_plan(
        StoredPlan(
            plan=stored.plan.model_copy(update={"status": w.PlanStatus.INVALIDATED}),
            changes=stored.changes,
            observed_states=stored.observed_states,
        )
    )
    response = execute(client, invalidated)
    assert (response.status_code, response.json()["code"]) == (409, "PLAN_INVALIDATED")


def test_duplicate_execution_returns_existing_operation_without_a_second_write(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    plan = create_plan(client)
    handler = client.app.state.container.mutation_engine.registry.get(w.PlanKind.GRANT)  # type: ignore[attr-defined]
    writes = Mock(wraps=handler.apply)
    monkeypatch.setattr(handler, "apply", writes)
    assert execute(client, plan).status_code == 200
    duplicate = execute(client, plan)
    assert duplicate.status_code == 409
    assert duplicate.json()["code"] == "DUPLICATE_SUBMISSION"
    assert "existing operation" in duplicate.json()["next_steps"][0].lower()
    assert writes.call_count == 1


def test_unknown_is_the_only_202_and_reconcile_does_not_replay_write(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    plan = create_plan(client)
    handler = client.app.state.container.mutation_engine.registry.get(w.PlanKind.GRANT)  # type: ignore[attr-defined]
    writes = Mock()
    original_apply = handler.apply
    def ambiguous_apply(target: object, changes: object) -> MutationWriteResult:
        writes(target, changes)
        return MutationWriteResult(status="unknown", summary="Synthetic ambiguous submission.")

    monkeypatch.setattr(handler, "apply", ambiguous_apply)
    monkeypatch.setattr(handler, "verify", lambda target, changes: True)
    unknown = execute(client, plan)
    assert unknown.status_code == 202
    operation = unknown.json()["data"]
    assert operation["status"] == "unknown"
    assert writes.call_count == 1
    reconciled = client.post(f"/api/v1/operations/{operation['id']}/reconcile")
    assert reconciled.status_code == 200
    assert reconciled.json()["data"]["status"] == "applied"
    assert writes.call_count == 1

    monkeypatch.setattr(handler, "apply", original_apply)
    ordinary = client.post("/api/v1/plans", json=plan_body())
    ordinary_plan = ordinary.json()["data"]
    assert ordinary.status_code == 201
    assert execute(client, ordinary_plan).status_code == 200


def test_connected_identity_rejects_spoofing_service_principals_and_leaks_no_values(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    monkeypatch.setenv("UCGOV_MODE", "connected")
    monkeypatch.delenv("UCGOV_FIXTURE_ACTOR")
    app = main.create_app()
    resolver = AsyncMock()
    resolver.resolve.return_value = ResolvedUser(
        actor=w.Actor(
            id="a", display="Actor A", kind="user", roles=[w.AppRole.VIEWER],
            verified_by="user_token"
        ),
        email="actor-a@example.test",
        external_id="idp-a",
    )
    app.state.identity_resolver = resolver
    token = "synthetic-secret-token-value"
    with TestClient(app) as client:
        mismatch = client.get(
            "/api/v1/me",
            headers={
                "x-forwarded-access-token": token,
                "x-forwarded-email": "actor-b@example.test",
            },
        )
    assert (mismatch.status_code, mismatch.json()["code"]) == (401, "IDENTITY_MISMATCH")
    captured = caplog.text + mismatch.text
    for value in (token, "actor-a@example.test", "actor-b@example.test", "idp-a"):
        assert value not in captured

    resolver.resolve.return_value = ResolvedUser(
        actor=w.Actor(
            id="sp",
            display="Synthetic SP",
            kind="service_principal",
            roles=[w.AppRole.PLATFORM_ADMIN],
            verified_by="user_token"
        ),
        email=None,
        external_id=None,
    )
    with TestClient(app) as client:
        service_principal = client.get("/api/v1/me", headers={"x-forwarded-access-token": token})
    assert (service_principal.status_code, service_principal.json()["code"]) == (
        401,
        "UNAUTHENTICATED",
    )


def test_connected_missing_token_is_unauthenticated_for_every_route(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("UCGOV_MODE", "connected")
    monkeypatch.delenv("UCGOV_FIXTURE_ACTOR")
    app = main.create_app()
    with TestClient(app) as client:
        for _, (method, path) in READ_CALLS.items():
            response = client.request(method, path)
            assert (response.status_code, response.json()["code"]) == (401, "UNAUTHENTICATED")
        response = client.post("/api/v1/plans", json=plan_body())
        assert (response.status_code, response.json()["code"]) == (401, "UNAUTHENTICATED")


def test_readonly_rejects_mutations_before_handler_or_adapter_access(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    engine = client.app.state.container.mutation_engine  # type: ignore[attr-defined]
    handler = engine.registry.get(w.PlanKind.GRANT)
    preview = Mock(wraps=handler.preview)
    monkeypatch.setattr(handler, "preview", preview)
    monkeypatch.delenv("UCGOV_FIXTURE_ACTOR")
    engine.settings = Settings(
        mode=Mode.CONNECTED_READONLY,
        fixture_actor=None,
        plan_hmac_key="x" * 32,
    )
    response = client.post("/api/v1/plans", json=plan_body())
    assert (response.status_code, response.json()["code"]) == (403, "MODE_READ_ONLY")
    preview.assert_not_called()


def test_readonly_reconcile_is_rejected_before_readback(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    engine = client.app.state.container.mutation_engine  # type: ignore[attr-defined]
    handler = engine.registry.get(w.PlanKind.GRANT)
    plan = create_plan(client)
    monkeypatch.setattr(
        handler,
        "apply",
        lambda target, changes: MutationWriteResult(status="unknown", summary="Synthetic timeout."),
    )
    unknown = execute(client, plan)
    operation_id = unknown.json()["data"]["id"]
    verify = Mock(wraps=handler.verify)
    monkeypatch.setattr(handler, "verify", verify)
    monkeypatch.delenv("UCGOV_FIXTURE_ACTOR")
    engine.settings = Settings(
        mode=Mode.CONNECTED_READONLY,
        fixture_actor=None,
        plan_hmac_key="x" * 32,
    )
    response = client.post(f"/api/v1/operations/{operation_id}/reconcile")
    assert (response.status_code, response.json()["code"]) == (403, "MODE_READ_ONLY")
    verify.assert_not_called()


def test_missing_lakebase_is_reported_without_breaking_independent_context(
    client: TestClient,
) -> None:
    capabilities = client.get("/api/v1/capabilities")
    activity = next(
        row for row in capabilities.json()["data"] if row["capability"] == "activity.app"
    )
    assert activity["status"] == "not_configured"
    assert "durable_store" in activity["reason"]
    assert client.get("/api/v1/context").status_code == 200


def test_upstream_error_is_mapped_to_an_envelope_without_internal_details(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    readers = client.app.state.container.fixture_readers  # type: ignore[attr-defined]
    assert readers is not None
    monkeypatch.setattr(
        readers.catalogs,
        "list_catalogs",
        lambda page_size, page_token: (_ for _ in ()).throw(UpstreamUnavailable()),
    )
    response = client.get("/api/v1/catalogs")
    assert (response.status_code, response.json()["code"]) == (503, "UPSTREAM_UNAVAILABLE")
    assert response.json()["message"] == "A required service is temporarily unavailable."
