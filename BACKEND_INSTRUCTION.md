# BACKEND_INSTRUCTION.md — for the Backend Coder (`codex` CLI)

> **Verified environment facts, 2026-09-21.** Probed on this machine; do not assume otherwise.
>
> - **`python` is NOT on your PATH.** Bare `python ...` fails with CommandNotFoundException.
>   Always run Python through `uv`: `uv run python ...`, `uv run pytest ...`, `uv run ruff ...`.
> - **`uv` IS available** and reports 0.11.26.
> - You **can** write files under the project root and you **can** run shell commands.
> - This folder is **not** a Git repository and must not become one.
> - If a command needs network access and it is refused, say so plainly in your report rather than
>   inventing offline substitutes or pinning versions you could not verify.

You own `backend/**`, `app.yaml`, Python manifests, `jobs/**`, `docs/capability-matrix.md`,
`docs/runbook.md`. Read `AGENTS.md` (project-wide rules) and `docs/00-spec.md` first. This file
adds the backend-specific rules. On conflict: spec > `shared/contracts/api-spec.yaml` > this file.

## 1. Tech stack (fixed unless P0-02 overturns it with recorded evidence)

| Concern | Choice |
|---|---|
| Runtime | Python 3.11 (Databricks Apps default) |
| Web | FastAPI + uvicorn, single process, serves `/api/v1/*` and `frontend/dist` |
| Validation | pydantic v2 models that mirror `shared/contracts/api-spec.yaml` names 1:1 |
| Databricks | `databricks-sdk==0.140.0` (pin exactly; bump only via P0-02 process). Imported **only** in `backend/app/adapters/databricks/` and `backend/app/adapters/sql/` |
| SQL | SDK Statement Execution API, controlled templates only, parameters bound, identifiers validated + backtick-quoted |
| Durable store | Lakebase Postgres via `psycopg` 3, imported **only** in `backend/app/persistence/`; plain SQL migrations, never auto-applied |
| Tooling | `uv`, `ruff`, `mypy --strict` on `backend/app`, `pytest`, `httpx`, `schemathesis` |
| Logging | structured JSON to stdout with redaction filter; correlation id on every line |

No ORM (the schema is small and SQL must be reviewable). No Celery/Redis/queues. No background
threads that must survive restarts (use the Lakeflow job artifact in `jobs/`).

## 2. Layering (enforced by an import-linter test)

```
api/ (routers, DTO mapping, error mapping)   → may import domain/, authz/, auth/, capabilities/
domain/ (services per governance domain)    → may import adapters/*Protocols, mutations/, audit/
mutations/ (plan builder, executor, verifier)→ may import adapters/*Protocols, persistence/Protocols
adapters/databricks, adapters/sql            → the ONLY modules importing `databricks`
adapters/fixtures                            → in-memory implementations of the same Protocols
persistence/                                 → the ONLY module importing `psycopg`
auth/, authz/, capabilities/, config/, audit/ → leaf modules
```

Every adapter exposes a `typing.Protocol`. Services receive adapters via a `Container` built once
in `main.py` according to `UCGOV_MODE`. Tests build the container with fixture adapters.

## 3. Core principles

1. **Contract first.** Every router response model is a pydantic class whose JSON matches
   `api-spec.yaml` exactly (names, nullability, enums). Run `uv run pytest backend/tests/contract`
   before claiming any endpoint done. It (a) diffs FastAPI's generated OpenAPI paths/operations
   against the YAML, (b) runs schemathesis against the fixture-mode app, (c) validates every
   `shared/contracts/examples/*.json` against the matching pydantic model.
2. **Validate before you touch anything.** Request bodies are parsed by pydantic; business rules
   (privilege valid for securable type, principal eligible, tag not system, reason length) run in
   the domain service and raise `ValidationError(errors=[FieldError...])` → HTTP 400 with
   `errors[]`. Never rely on the frontend for validation.
3. **Errors are typed.** Raise subclasses of `AppError(code, message, next_steps, http_status)`.
   One exception handler maps them to `ErrorResponse`. Unknown exceptions → `INTERNAL_ERROR` with a
   generic message; the traceback goes to the log with the correlation id, never to the client.
   SDK exceptions are translated in the adapter layer: 401/403 → `INSUFFICIENT_PRIVILEGES`,
   404 → `NOT_FOUND`, 429 → `RATE_LIMITED`, 5xx/timeouts → `UPSTREAM_UNAVAILABLE`. Never re-raise
   SDK exceptions past the adapter boundary.
4. **Identity.** `auth/actor.py` resolves the actor per request as described in
   `docs/06-security-model.md` §1. The request-scoped `Identity` object is passed explicitly to
   every service call; nothing reads headers outside `auth/`.
5. **Authorization on every mutation, twice.** `POST /plans` and `POST /plans/{id}/execute` both
   call `authz.decide(identity, action, target)`. Read endpoints call it once. The decision object
   carries the reason code used for `allowed_actions`.
6. **Plans are server-owned.** HMAC-SHA256 with `UCGOV_PLAN_HMAC_KEY`; canonical JSON
   (sorted keys, no whitespace). Any mismatch → `PLAN_TAMPERED`. TTL → `PLAN_EXPIRED`. Re-read
   state and compare hash → `PLAN_STALE`. Idempotency key is the plan id.
7. **Deltas only.** `grants.update` sends `PermissionsChange(add=[...])` or `remove=[...]` for one
   principal. Never compute and send a full ACL.
8. **Verify by read-back.** After each target's SDK call, re-read the affected state and set
   `verified=true` only when the change is observed. Timeout after send → `unknown`, no retry.
9. **No secrets out.** DTO mappers are explicit field allowlists. A test asserts no field named
   like `*token*`, `*secret*`, `*password*`, `*credential*` (except `credential_name`) appears in
   any response model.
10. **Bounded everything.** Page sizes ≤ 200; SQL templates carry `row_limit`; lineage depth ≤ 5,
    nodes ≤ 500; audit window ≤ 31 days; statement `wait_timeout` ≤ 50s.
11. **Capabilities are computed, not assumed.** `capabilities/registry.py` declares each capability
    with implementation status; `capabilities/probe.py` checks runtime requirements per identity.
    A 403 from a probe yields `insufficient_permissions`, never `unsupported_in_environment`.
12. **Fixture mode is a first-class implementation**, not a stub: fixture adapters mutate an
    in-memory store so previews, executes, read-backs, and activity history behave realistically.
    Scenario switches live in `fixtures_data/scenarios.py` and are selected via
    `X-Fixture-Scenario` header **only when `UCGOV_MODE=fixture`** (ignored otherwise).

## 4. Endpoint implementation checklist (repeat for every path in the contract)

- [ ] pydantic request/response models named exactly as the YAML schemas
- [ ] router function with `response_model`, explicit `responses={...}` for every documented status
- [ ] domain service method with business validation and `authz.decide`
- [ ] adapter method(s) with SDK/SQL call, bounded, translating exceptions
- [ ] fixture adapter method with at least success + one failure scenario
- [ ] `Meta` populated honestly (`source`, `observed_at`, `completeness`, `limitations`)
- [ ] `allowed_actions` computed from the authz decision and object state
- [ ] tests: happy path, each documented error status, viewer-403 for mutations, fixture scenarios
- [ ] capability row updated in `docs/capability-matrix.md` with SDK method confirmed by
      introspection (`python -c "import inspect, databricks.sdk as s; ..."`), doc link, date

## 5. Test suite layout and what each proves

| Path | Proves | Evidence type |
|---|---|---|
| `tests/unit/` | domain rules, plan HMAC/TTL/hash, redaction, SQL identifier validation, SSRF host rules, privilege catalogue | mocked |
| `tests/contract/test_openapi_parity.py` | every path/method/status in `api-spec.yaml` exists in the app and vice versa | mocked |
| `tests/contract/test_schemathesis.py` | responses conform to schemas under generated inputs (fixture mode) | mocked |
| `tests/contract/test_examples_validate.py` | each `shared/contracts/examples/*.json` parses into its pydantic model | mocked |
| `tests/contract/test_sdk_shapes.py` | every SDK method/param/DTO field the adapters use exists on the pinned SDK | real package, no network |
| `tests/api/` | authz per route, identity spoofing, plan lifecycle, degraded modes, duplicate/unknown/reconcile | mocked |
| `tests/integration/` (`-m live`, disabled) | read-only calls against an authorized sandbox | live — never in this engagement |

## 6. Definition of Done (backend task)

- `uv run ruff check backend && uv run mypy backend/app && uv run pytest backend/tests -q` all green.
- `uv run pytest backend/tests/contract -q` green with zero schema warnings.
- `uv run python -m app.tools.export_openapi` regenerates `backend/openapi.json` with no diff
  against `shared/contracts/api-spec.yaml` paths (the parity test enforces this).
- No endpoint returns 200 for a failure; no `NotImplementedError` leaks; no `TODO` returning fake data.
- Capability matrix rows for the touched operations are filled, dated, and honest.
- `tasks/TASK-BOARD.md` evidence cell has the command summaries; `tasks/STATUS.md` has DONE line.
- If the contract had to change: `api-spec.yaml` + `types.ts` + example updated, `CONTRACT` line
  in `STATUS.md`, additive only.

## 7. Commands

```
uv sync --frozen
uv run ruff check backend
uv run mypy backend/app
uv run pytest backend/tests -q
uv run pytest backend/tests/contract -q
uv run python -m app.tools.export_openapi
$env:UCGOV_MODE="fixture"; $env:UCGOV_FIXTURE_ACTOR="alice.steward"; uv run uvicorn app.main:create_app --factory --app-dir backend --port 8000
```

## 8. Things you never do

Call a real workspace, create resources, run migrations automatically, read `..\governance-app\`,
return raw SDK objects, concatenate identifiers into SQL, fall back from user token to SP, retry a
mutation automatically, mark a capability implemented without introspection evidence, use Git.
