# 02 — Architecture and contracts

This document is the shared contract between the backend owner (Codex) and the frontend owner
(Antigravity). Changes to anything in §3–§6 must be made here first, then in code, and announced in
`tasks/STATUS.md`.

## 1. Shape

```
Browser (React SPA)  ──HTTPS──▶  Databricks Apps proxy  ──▶  FastAPI (single process)
                                   adds x-forwarded-* headers      │
                                                                    ├─ /            static dist/
                                                                    ├─ /api/v1/*    JSON API
                                                                    │
                                                    ┌───────────────┼──────────────────┐
                                                    ▼               ▼                  ▼
                                          databricks-sdk      SQL Statement       Lakebase (psycopg)
                                          Workspace/Account   Execution API       app workflow state
```

One deployable, one process. Fixture mode replaces the three right-hand dependencies with
in-memory adapters behind the same interfaces.

## 2. Folder layout (source root `uc-governance-app/`)

```
uc-governance-app/
  app.yaml                       Databricks Apps manifest (array command, env with valueFrom)
  pyproject.toml  uv.lock  requirements.txt
  .env.example                   safe example config, no secrets
  backend/
    app/
      main.py                    FastAPI factory; mounts /api/v1 and static dist
      config/                    Settings (pydantic-settings), Mode enum, env validation
      auth/                      actor resolution, token handling, local-auth strategy
      authz/                     roles, policy table, scope checks, decision objects
      capabilities/              capability registry + runtime availability probes
      adapters/                  SDK/SQL/persistence adapters (the ONLY place SDK is imported)
        databricks/              one module per SDK area (grants.py, catalogs.py, ...)
        sql/                     statement execution, templates, identifier quoting
        fixtures/                in-memory implementations of the same Protocols
      domain/                    services per governance domain (assets, grants, tags, ...)
      mutations/                 plan builder, plan store, executor, verifier, state machine
      persistence/               Lakebase repository + migrations/ (SQL files)
      audit/                     app activity log writer, correlation ids, redaction
      api/                       routers, DTOs, error mapping (no business logic)
      fixtures_data/             synthetic datasets for Demo mode
    tests/
      unit/  contract/  api/  integration/ (opt-in, sandbox only)
  frontend/
    package.json  package-lock.json  vite.config.ts  tsconfig.json
    src/
      app/                       router, providers, layout shell
      design/                    tokens.css, typography, density utilities
      components/ui/             shadcn-owned primitives
      features/                  assets/ access/ tags/ policies/ filters/ storage/ federation/
                                 sharing/ lineage/ activity/ quality/ requests/ admin/
      api/                       generated client types from OpenAPI + fetch wrapper
      lib/                       formatting, fqn helpers, status vocab
    e2e/                         Playwright specs
  jobs/
    expiry_reconciler/           Lakeflow job source for time-bound access cleanup (artifact only)
  docs/                          this folder
  tasks/                         task board, status log, handoff protocol
  screenshots/                   labeled "synthetic" when from fixture mode
```

Rule: `databricks` (the SDK) is imported **only** under `backend/app/adapters/databricks/` and
`backend/app/adapters/sql/`. `psycopg` is imported **only** under `backend/app/persistence/`.
Domain services depend on `Protocol` interfaces, never on SDK types.

## 3. Modes and configuration

`UCGOV_MODE` is required and has three values. Startup fails if it is missing or invalid.

| Mode | Data | Actor | Mutations | Label in UI |
|---|---|---|---|---|
| `fixture` | in-memory synthetic | fixture identity chosen from a fixed list via `UCGOV_FIXTURE_ACTOR` | applied to fixture state only | **Demo — synthetic data** (persistent banner) |
| `connected_readonly` | live SDK | real token/SP | all mutation endpoints return 403 `MODE_READ_ONLY` | **Read-only** |
| `connected` | live SDK | real | allowed per policy | **Editing enabled** |

Guards:
- `fixture` mode refuses to start if `DATABRICKS_CLIENT_ID` **or** `DATABRICKS_APP_PORT` is present
  (i.e., appears to be running inside Databricks Apps). This is the anti-bypass rule from spec §12.
- Connected modes never construct fixture adapters. A failing SDK call surfaces as an error DTO.
- Optional resources: `UCGOV_WAREHOUSE_ID`, `PGHOST…` (Lakebase), `UCGOV_ACCOUNT_ID` +
  account SP secret (Account API). Missing → capability state `not_configured`.

Key env vars (full list in `.env.example`): `UCGOV_MODE`, `UCGOV_ENVIRONMENT_LABEL` (DEV/UAT/PROD,
free text, never inferred), `UCGOV_MANAGED_CATALOGS` (comma list; empty = all visible),
`UCGOV_ROLE_GROUPS` (role→account group map), `UCGOV_PLAN_TTL_SECONDS` (default 600),
`UCGOV_SUPPORT_CONTACT`, `UCGOV_SOD_ENABLED`.

## 4. Cross-cutting response contracts

> **Canonical source:** `shared/contracts/api-spec.yaml` (OpenAPI 3.0.3, v1.0.0) and its mirror
> `shared/contracts/types.ts`. Sections 4 to 7 below are the *rationale and summary*. Where the
> wording here differs from the YAML, **the YAML wins** and this document gets corrected. Field
> names, enums, and error codes are frozen there; see `shared/contracts/README.md` for the change
> process and `scripts/validate_contracts.py` for the enforcement.

### 4.1 Envelope for reads

```json
{
  "data": ...,
  "meta": {
    "source": "unity_catalog_api | system_table | lakebase | fixture",
    "observed_at": "2026-09-21T09:12:33Z",
    "scope": {"catalog": "sales", "schema": null},
    "completeness": "complete | truncated | partial_visibility | unknown",
    "limitations": ["Group membership not loaded; inherited-through-group access not shown."],
    "correlation_id": "uuid"
  },
  "page": {"next_page_token": "…", "page_size": 50}
}
```

### 4.2 Error object (never HTTP 200)

```json
{
  "error": {
    "code": "FORBIDDEN_ROLE | FORBIDDEN_SCOPE | NOT_CONFIGURED | NOT_FOUND | RATE_LIMITED |
             UPSTREAM_UNAVAILABLE | PLAN_STALE | PLAN_EXPIRED | PLAN_TAMPERED | DUPLICATE_SUBMISSION |
             VALIDATION_FAILED | UNSUPPORTED | NOT_IMPLEMENTED | MODE_READ_ONLY | OUTCOME_UNKNOWN",
    "message": "Safe English sentence.",
    "next_steps": ["Ask the catalog owner for MANAGE on sales.crm."],
    "correlation_id": "uuid",
    "details": {}          // never raw SDK exception text, never tokens
  }
}
```

HTTP mapping: 400 validation, 401 unauthenticated, 403 authz/mode, 404, 409 plan/duplicate
conflicts, 429, 501 not implemented, 502/503 upstream, **202 + status `unknown`** for ambiguous
outcome after submission.

### 4.3 `allowed_actions`

Every asset/grant/policy DTO carries:

```json
"allowed_actions": [
  {"action": "grant", "allowed": true},
  {"action": "revoke", "allowed": false, "reason_code": "INHERITED_FROM_PARENT",
   "reason": "This privilege is inherited from catalog sales. Revoke it at the source.",
   "navigate_to": "/assets/catalog/sales/access"}
]
```

UI hint only. Every mutation endpoint re-runs authorization.

### 4.4 Capability status

```json
{"capability": "grants.update", "status": "available | not_configured | insufficient_permissions |
  unsupported_in_environment | not_implemented | temporarily_unavailable | unknown",
 "reason": "…", "requires": ["sql_warehouse"], "checked_at": "…"}
```

`GET /api/v1/capabilities` returns all; the frontend gates navigation and controls from it.
`unsupported_in_environment` may be returned only when backed by an explicit evidence string.

## 5. Identity contract

```json
"identity": {
  "actor": {"id": "…", "display": "jane@corp.com", "kind": "user", "roles": ["steward"],
            "verified_by": "user_token | fixture"},
  "executor": {"kind": "service_principal | user", "display": "uc-governance-app SP (…)",
               "reason": "Grants API is not in the user-authorization scope set."}
}
```

Returned by `GET /api/v1/me` and embedded in every plan and operation record.

## 6. Mutation lifecycle API (all privileged writes)

```
POST /api/v1/plans                { kind, target, changes, reason }        → 201 Plan (preview)
GET  /api/v1/plans/{id}                                                    → Plan
POST /api/v1/plans/{id}/execute   { confirmation_token, typed_name? }      → 200 Operation | 202 unknown
GET  /api/v1/operations/{id}                                               → Operation (per-target outcomes)
POST /api/v1/operations/{id}/reconcile                                     → Operation (read-back)
```

Plan fields: `id`, `kind`, `actor`, `executor`, `workspace_id`, `environment_label`, `targets[]`,
`normalized_changes[]`, `observed_state_hash`, `impact` (`{known: [...], unknown: [...]}`),
`requires_typed_confirmation`, `expires_at`, `confirmation_token` (HMAC over all of the above,
server key), `status`.

State machine (Plan): `previewed → confirmed → revalidating → executing → {applied | partially_applied |
failed | unknown}`; also `expired`, `stale` (observed state changed), `invalidated` (superseded).
Operation per-target: `pending | applied | failed | unknown`, each with `verified: bool`
(read-back succeeded) and `databricks_request_id` when available.

Rules encoded in `backend/app/mutations/`:
- Any change to target/changes/principal creates a **new** plan; old one → `invalidated`.
- `execute` recomputes the HMAC, checks TTL, re-reads current state and compares to
  `observed_state_hash`, re-runs authz. Any failure → 409 with the specific code.
- Idempotency key = plan id; a second `execute` on the same plan returns the existing operation
  (409 `DUPLICATE_SUBMISSION` if still executing).
- Timeout after the SDK call was sent → operation `unknown`, never auto-retried; `reconcile`
  reads back and may flip to `applied`/`failed`.
- Multi-target plans execute sequentially, non-atomically, and report each target.
- Without Lakebase configured in connected mode: plans still work for **single-target, immediately
  verifiable** grants (state is re-read, not stored), but approvals, access reviews, time-bound
  access, and multi-target batches are `not_configured`.

## 7. Read API surface (v1, contract-first)

Routers and the domain they serve; the OpenAPI file generated from FastAPI is the frontend's
source of types. The frontend imports them from `shared/contracts/types.ts` via the
`@contracts/*` path alias; nothing is generated from a running server.

| Router | Endpoints (GET unless noted) |
|---|---|
| `me`, `capabilities`, `context` | `/me`, `/capabilities`, `/context` (workspace, env label, mode, managed scope) |
| `assets` | `/catalogs`, `/catalogs/{c}/schemas`, `/schemas/{c.s}/objects?type=…&q=…`, `/assets/{securable_type}/{fqn}`, `/assets/{…}/dependencies`, PATCH `/assets/{…}/metadata` via plan |
| `principals` | `/principals/search?q=&kind=` (SCIM users/groups/SPs; marks workspace-local groups) |
| `grants` | `/assets/{…}/grants` (direct + effective with source), `/privileges?securable_type=` (catalogue) |
| `tags` | `/assets/{…}/tags`, `/tag-policies` (governed tags), classification status |
| `policies` | `/abac-policies`, `/abac-policies/{id}`, impact preview |
| `filters` | `/assets/{…}/row-filter`, `/column-masks`, `/functions/{fqn}` |
| `storage` | `/storage-credentials`, `/service-credentials`, `/external-locations`, `/bindings/{securable}` |
| `federation` | `/connections`, `/connections/{name}/foreign-catalogs` |
| `sharing` | `/shares`, `/recipients`, `/providers` (no tokens ever) |
| `lineage` | `/lineage/table/{fqn}?direction=&depth=&limit=` (needs warehouse) |
| `activity` | `/activity/app` (Lakebase), `/activity/databricks-audit` (system.access.audit, warehouse) |
| `findings` | `/findings?rules=` |
| `quality` | `/quality/monitors/{fqn}`, refresh history |
| `ai-assets` | `/models`, `/models/{fqn}/versions`, serving endpoints (related service, labeled) |
| `requests` | `/access-requests` (app-owned unless native RFA verified), approvals, reviews |
| `admin` | `/admin/metastores` (Account API, separately configured client) |

## 8. Frontend architecture

- Route-level scope in the URL: `/assets/:catalog?/:schema?/:objectType?/:name?` with tabs
  `overview | access | tags | lineage | quality` preserved as query state. Breadcrumbs derive from
  the URL, so back navigation restores scope and safe filters.
- TanStack Query keys include `{actorId, workspaceId, scope}` so caches are identity-scoped.
  `AbortSignal` from Query cancels stale searches; search inputs debounce 300 ms.
- A global `ContextBar` renders mode badge (text + icon, not color alone), environment label,
  workspace, actor, executor.
- All mutation UIs go through one `PlanFlow` component: form → `POST /plans` → preview panel →
  confirm (typed-name when `requires_typed_confirmation`) → result panel that stays on page.
- No toasts as the only feedback. No `Undo`.
- Strings live in `src/lib/strings.ts` (English), one place, to satisfy the "English authored UI" test.
