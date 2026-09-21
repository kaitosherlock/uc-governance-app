# 06 — Security model: authentication, roles, execution identity, plan integrity

Binding for all agents. Deviations require an entry in `tasks/STATUS.md` and an update here.

## 1. Authentication (who is the actor)

| Mode | How the actor is established | What is rejected |
|---|---|---|
| `connected*` inside Databricks Apps | Read `x-forwarded-access-token`; call `current_user.me()` with a user-scoped `WorkspaceClient`; the returned user is the actor. Compare with `X-Forwarded-Email`/`X-Forwarded-User`; mismatch → 401 `IDENTITY_MISMATCH` (logged). `X-Request-Id` becomes inbound correlation id | Missing token → 401. No fallback to SP identity for *identifying* the actor. Never trust headers alone |
| `connected*` on a developer laptop | `UCGOV_LOCAL_AUTH=cli_profile`: the developer's own Databricks CLI profile provides the token; the same `me()` check runs. Headers are not read | Any attempt to set a fixture actor while in a connected mode → startup error |
| `fixture` | `UCGOV_FIXTURE_ACTOR` selects one of the synthetic identities shipped with the fixtures | Startup refused if Databricks Apps env vars are present (see `02-architecture.md` §3) |

Sessions: the app is stateless per request; the platform authenticates the browser. The backend
sets `SameSite=Strict` for any cookie it issues (none planned), enforces same-origin on mutating
requests via `Origin`/`Sec-Fetch-Site` checks, and rejects cross-site `POST`. CORS is disabled
(same origin only) except in local dev where the Vite dev origin is explicitly allowed.

## 2. Application roles (do not create UC privileges)

Role resolution order: (1) `UCGOV_ROLE_GROUPS` mapping account-group → role, resolved through the
SP's SCIM read of the actor's groups; (2) if SCIM is not readable, roles are `viewer` only and the
capability `authz.group_resolution` reports `insufficient_permissions`. An email allowlist
(`UCGOV_BOOTSTRAP_ADMINS`) may grant `platform_admin` **only** in `connected_readonly`/dev and is
reported in `/context` as "bootstrap allowlist active"; it is not the production model.

| Role | May request | Never |
|---|---|---|
| **Viewer** | All read endpoints within managed scope | Any `POST /plans`, execute, approve |
| **Steward** | Metadata edits (descriptions, properties, tags), ownership transfer *plans*, findings review | Grants/revokes, storage/federation/sharing writes |
| **Access Administrator** | Grant/revoke/ownership plans, approvals for their scope, access reviews | Storage credentials, bindings, connections, shares, metastore admin |
| **Auditor** | All reads + Databricks audit + app activity + exports (redacted) | Any write |
| **Platform Administrator** | Everything above + storage/federation/sharing/bindings/policy writes + `admin/*` | Bypass typed confirmation, bypass SoD |

Scope: every request is checked against `UCGOV_MANAGED_CATALOGS` and, for user-scoped reads,
against what the user token can see. A target outside managed scope → 403 `FORBIDDEN_SCOPE`
regardless of role.

## 3. Execution identity matrix

| Operation class | Executor | Why | Server-side prerequisite check before execute |
|---|---|---|---|
| List/read catalogs, schemas, tables, connections; current user | **User token** (scopes `catalog.*`, `iam.current-user:read`) | In the documented user-authorization scope set; applies UC visibility of the actual user | Token present |
| SQL-backed reads (lineage/audit system tables, tag reads via `information_schema`) | **User token** with `sql` scope when configured; else SP | Prefer user; SP only if the deployment explicitly sets `UCGOV_SQL_EXECUTOR=sp` and the UI shows it | Warehouse configured; scope granted |
| Grants read/update, ownership, tags write, ABAC policies, filters/masks, storage, federation, sharing, bindings, quality monitors, models | **App service principal** | Not in the user-auth scope list (verified 2026-09-21) | Role + scope check; then a **probe** that the SP itself holds the needed privilege (e.g. `MANAGE` on target) so failures are `insufficient_permissions`, not surprises |
| Metastore assignment, account groups | **Separately configured Account client** (`UCGOV_ACCOUNT_*` from Secret resource) | App SP is not assumed to be account admin | Account client configured |
| Lakebase read/write | App SP via OAuth DB credential | Documented app resource | `PGHOST` etc. present |

Displayed in plain English on every preview: *"You are requesting this change. It will be executed
by the application's service principal `<name>`."*

**No silent fallback:** a user-token call that fails with 401/403 returns that error. It never
retries as the SP.

## 4. Preventing escalation

- Targets are canonicalized server-side from `securable_type + fqn`; the client cannot pass an
  object id that resolves elsewhere.
- Principal names in grant plans are validated against SCIM lookup (or, when SCIM is unreadable,
  syntactically validated and flagged `unverified_principal` in the preview).
- Privilege names are validated against the privilege catalogue for the securable type.
- Workspace id in the plan must equal the workspace the app runs in.
- Plan `confirmation_token` is an HMAC-SHA256 over the canonical plan JSON using a server key
  (`UCGOV_PLAN_HMAC_KEY` from a Secret resource; random per-process key in fixture mode). Any field
  change → 409 `PLAN_TAMPERED`.
- Approvals: approver must hold Access Administrator role **and** the target must be within the
  approver's configured scope; requester ≠ approver when `UCGOV_SOD_ENABLED=true`; beneficiary ≠
  approver always.

## 5. Secret handling

- Never return: tokens, client secrets, storage credential payloads, recipient activation links or
  bearer tokens, connection options containing passwords, Lakebase passwords.
- Adapter DTO mappers use explicit allowlists of fields, never `dict(sdk_obj)`.
- A redaction filter on the logger drops values matching known secret env var names and any
  `Bearer …` pattern.
- Error `details` never include upstream response bodies; they include the Databricks request id
  when the SDK exposes it.
- Fixtures contain no real hostnames, emails, or tokens; synthetic domain `example.test`.

## 6. SQL safety

- Only templates in `backend/app/adapters/sql/templates/` may execute. Each template declares the
  identifiers it needs; identifiers are validated against `^[A-Za-z0-9_]+$` (or the UC-documented
  quoting rules) and backtick-quoted; values are passed as statement parameters.
- Hard limits: `wait_timeout` ≤ 50 s, `row_limit` per template, `byte_limit`, then poll/cancel via
  the SDK's statement execution API. Cancellation is reported as "cancel requested", not as rollback.
- No endpoint accepts free-form SQL.

## 7. SSRF and connection targets

Connection/external-location host fields are validated against the documented connector host rules
(scheme, port ranges, no link-local/loopback/metadata IPs). The backend never fetches
client-supplied URLs.

## 8. Tests that must exist (map to spec §14)

`tests/api/test_authz.py` (viewer 403 on every mutation route, scope 403), `test_identity.py`
(header spoof rejected, no SP fallback, fixture refused under Apps env), `test_plans.py` (stale,
expired, tampered, duplicate, unknown outcome, reconcile), `test_redaction.py`, `test_sql_safety.py`,
`test_ssrf.py`, `test_sod.py`. See `08-testing-and-acceptance.md`.
