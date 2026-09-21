# 04 — Databricks Apps platform constraints (verified 2026-09-21)

Facts below were read from official Databricks documentation on **2026-09-21** (AWS doc set unless
noted). Implementing agents must re-verify anything they depend on and update the date column.
Anything marked **UNVERIFIED** was not confirmed today and must be checked before relying on it.

## 1. Runtime

| Item | Verified value | Source |
|---|---|---|
| OS | Ubuntu 22.04 LTS | [system-env](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/system-env) |
| Python | 3.11 in a dedicated virtual environment; other versions possible via `uv` | same |
| Node.js | 22.16; deps via `npm` or `pnpm` from `package.json`; no Node libraries preinstalled | same |
| `uv` | 0.10.2 preinstalled; recommended for Python dependency management | same, [best-practices](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/best-practices) |
| Compute | default up to 2 vCPU and 6 GB memory per app | system-env |
| Billing | per hour of compute while running, based on provisioned capacity | [overview](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/) |
| Clouds | AWS, Azure, GCP, SAP listed in the doc switcher | overview |
| Framework list named in overview | Python: Streamlit, Dash, Gradio. Node.js: React, Angular, Svelte, Express | overview |

**Implication:** the platform provides *either* a Python runtime *or* a Node runtime per app.
There is no documented "run `npm run build` then start Python" build phase. A Python backend that
serves a compiled JavaScript frontend must ship the **prebuilt `dist/`** as part of the synced
source. Building must happen locally or in the developer's CI before `databricks sync` /
`databricks apps deploy`. Document this in the runbook and README.

## 2. Process and configuration (`app.yaml`)

| Item | Verified value |
|---|---|
| Top-level keys | `command` (sequence) and `env` (list of `{name, value}` or `{name, valueFrom}`) |
| Shell | Command is **not** run in a shell. Array syntax only. External env vars are not visible, except `DATABRICKS_APP_PORT` which is substituted into the command at runtime |
| Default command | Python: `python <first .py file>`; Node: `npm run start` |
| Port | App must bind `0.0.0.0` on `DATABRICKS_APP_PORT` |
| Logging | Log to stdout/stderr; the platform captures them |
| Startup | Keep init lightweight; avoid blocking work at startup |
| Documented examples | Streamlit `['streamlit','run','app.py']`; Flask via `gunicorn app:app -w 4` |

Source: [app-runtime](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/app-runtime),
[developers.databricks.com/docs/apps/development](https://developers.databricks.com/docs/apps/development).

**Implication:** one process. A FastAPI app started by `uvicorn` (single worker, or `gunicorn` with
uvicorn workers) that serves both `/api/*` and the static frontend satisfies the spec's
"no multiple production processes without concrete need" rule.

## 3. Environment variables injected by the platform

| Variable | Meaning |
|---|---|
| `DATABRICKS_APP_PORT` | Port the app must listen on |
| `DATABRICKS_HOST` | Workspace URL the app belongs to |
| `DATABRICKS_CLIENT_ID` | OAuth client ID of the app's dedicated service principal |
| `DATABRICKS_CLIENT_SECRET` | OAuth secret of that service principal |

The `databricks-sdk` `WorkspaceClient()` picks these up automatically (OAuth M2M). Never log them.

## 4. Identity and authorization

| Item | Verified value | Source |
|---|---|---|
| App identity | Each app has a **dedicated service principal**, auto-provisioned. Permissions evaluated independently of the user; the app can only access resources explicitly granted to the SP | [auth](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/auth) |
| User authorization (on-behalf-of) | Databricks forwards the user's access token in header `x-forwarded-access-token`; the app uses it to call APIs as the user. UC row filters / column masks then apply to the user | auth |
| Scopes selectable for user authorization | API scopes: `ai-gateway`, `apps`, `files`, `genie`, `model-serving`, `postgres`, `sql`, `vector-search`, `sql:restricted-query`. SDK scopes: `catalog.catalogs`, `catalog.connections`, `catalog.schemas`, `catalog.tables`, `workspace.workspace`. Defaults when none selected: `iam.access-control:read`, `iam.current-user:read` | auth |
| Best-practice guidance | Use the SP when access is the same for all users; enable user authorization only in workspaces with trusted app authors and peer-reviewed code; least privilege | best-practices |
| Identity headers | `X-Forwarded-Host`, `X-Forwarded-Preferred-Username` (IdP username), `X-Forwarded-User` (IdP user identifier), `X-Forwarded-Email` (IdP email), `X-Real-Ip`, `X-Request-Id`. Only present inside Databricks Apps; must be simulated locally | [http-headers](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/http-headers) |
| Trust statement | The docs do **not** state a trust/spoofing model for these headers. | — |

**Implications for this app (binding decisions, see `06-security-model.md`):**

1. **Actor identity must be established from the user token, not from headers alone.** In connected
   mode the backend calls `current_user.me()` with the `x-forwarded-access-token` and treats *that*
   as the authenticated actor. `X-Forwarded-Email`/`-User` are used only as display hints and must
   agree with the token identity; a mismatch is an error, not a fallback.
2. **Scope gap:** the user-authorization scope list does **not** include grants, volumes, functions,
   models, external locations, credentials, shares, policies, tags, or Account APIs. Therefore
   user-scoped operations are realistically limited to: reading catalogs/schemas/tables/connections,
   SQL execution (`sql`, `sql:restricted-query`), and reading the current user. **Everything else
   executes as the app service principal** with explicit server-side authorization. The UI must say
   so. Record per-operation execution identity in the capability matrix.
3. Never fall back from a failed user-token call to the SP.
4. `X-Request-Id` should be captured as the inbound correlation ID and echoed in responses/logs.

## 5. App resources (declared in the app, injected via `valueFrom`)

13 resource types verified: Databricks app, Genie space, **Lakebase database** (keys `postgres`/`database`,
permission "Can connect and create"), Lakeflow job, MLflow experiment, Model serving endpoint,
**Secret** (Can read/write/manage), **SQL warehouse** (Can use / Can manage), UC connection,
UC table (Select/Modify), UC function (Can execute), UC volume (read / read-write), AI Search index.

Source: [resources](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/resources).

**Implications:**
- SQL warehouse is an optional resource → `UCGOV_WAREHOUSE_ID` from `valueFrom: sql-warehouse`.
  Modules that need SQL (lineage/audit system tables, tags via SQL, row filters/masks via SQL,
  dynamic views) must degrade to "Not configured" without it.
- Lakebase is the documented durable store for app workflow state (see §6).
- Secrets for optional account-level clients come from the Secret resource, never from plain `value`.

## 6. Lakebase (durable workflow storage)

| Item | Verified value | Source |
|---|---|---|
| What | Fully managed Postgres integrated into Databricks | [oltp](https://docs.databricks.com/aws/en/oltp/) |
| App integration | Adding a database resource creates a Postgres role named after the app SP's client ID, with `CONNECT` and `CREATE` on the selected database. Connection details exposed via `valueFrom`: `PGHOST`, `PGDATABASE`, `PGUSER`, `PGPORT`, `PGSSLMODE`, `PGAPPNAME` | [lakebase](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/lakebase) |
| Password / token | **UNVERIFIED today.** Lakebase uses OAuth tokens as the Postgres password; the exact SDK call to mint a database credential and its lifetime must be confirmed against the pinned SDK (candidate: `WorkspaceClient.database.generate_database_credential`). Do not hard-code. |
| Postgres version, regions, pricing | Not read today; check region availability before requesting provisioning |
| Local dev | AppKit docs mention `databricks_superuser` role needed locally for Lakebase-backed apps; for this project local development uses **in-memory fixture store** and an optional local PostgreSQL if a developer wants to test migrations |

**Decision for the plan:** Lakebase Postgres is the durable store. Driver: `psycopg` 3 (pure
Postgres driver, isolated in `backend/app/persistence/`, unrelated to governance APIs). Migrations:
plain, numbered SQL files applied by an explicit `migrate` command that is never run at app startup.
No Lakebase instance is to be created by agents.

## 7. Local development and deployment tooling

- Official CLI flow: `databricks apps validate` (build + typecheck + lint for AppKit projects),
  `databricks sync` / `databricks apps deploy`. Databricks Asset Bundles can also define apps.
- AppKit (`@databricks/appkit`) is the official **Node.js** app framework. It does not give the
  backend an official governance SDK in TypeScript with the coverage of `databricks-sdk` (Python).
- `databricks-sdk` (Python) latest: **0.140.0, released 2026-09-19**, Python 3.10–3.13, published by
  Databricks (read-only mirror of internal repo). Source: [PyPI](https://pypi.org/project/databricks-sdk/).

## 8. Not verified today (must be checked by implementing agents)

- Request timeout / idle-shutdown / max upload size limits page returned 404 at the AWS URL tried.
  Search the current docs for "Databricks Apps limitations" and record findings.
- WebSocket / SSE support (affects long-running operation streaming; plan uses polling to be safe).
- Whether Apps egress to arbitrary hosts is restricted (affects nothing here; the app only calls its
  own workspace/account hosts and Lakebase).
- Exact GA/Preview status of: ABAC policies API, governed tags / tag policies API, entity tag
  assignments API, Request-for-Access (RFA) API, Data Classification API, Lakehouse/Quality
  Monitoring API, external lineage API. Record each in `capability-matrix.md` with a date.
