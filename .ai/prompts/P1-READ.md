ROLE: Backend Coder for the Unity Catalog Governance application.

READ FIRST from the project root C:\Users\admin\Downloads\uc-governance-app:
1. AGENTS.md and BACKEND_INSTRUCTION.md
2. docs/02-architecture.md sections 2, 4, 7
3. docs/06-security-model.md sections 2, 3, 5
4. `shared/contracts/api-spec.yaml` — the paths and schemas you must match exactly:
   `/catalogs`, `/catalogs/{catalog}/schemas`, `/schemas/{catalog}/{schema}/objects`,
   `/assets/{securable_type}/{full_name}`, `/assets/{securable_type}/{full_name}/dependencies`,
   `/assets/{securable_type}/{full_name}/grants`, `/privileges`, `/principals/search`
   and the schemas AssetRef, AssetSummary, AssetDetail, Column, Tag, RowFilterRef, ColumnMaskRef,
   Dependency, DependenciesResponse, Principal, Privilege, Grant, GrantSource, GrantsData,
   AllowedAction, Meta, Page.
5. `shared/contracts/examples/AssetListResponse.list-schema-objects.json` and
   `GrantsResponse.orders-table.json` — your output must be shaped exactly like these.

TASK: the Phase 1 read path. Tasks P1-01, P1-02 and P1-03 together, because they share the adapter
pattern and the DTO mappers. Also the fixture adapters from P0-06 so every endpoint works offline.

ENVIRONMENT, verified
- `python` is NOT on PATH. Use `uv run --frozen ...` for everything.
- You have **no network** and no Databricks credentials. You cannot call a real workspace, and you
  must not try. Correctness is proven by the fixture adapters and by contract tests.
- `databricks-sdk==0.140.0` is installed. Every service attribute you need exists; it was probed.
- Never run git.

SCOPE. Create or edit only under `backend/app/**` and `backend/tests/**`, plus append to
tasks/STATUS.md and update your rows in tasks/TASK-BOARD.md.

THE CONTRACT IS FROZEN. Match `shared/contracts/api-spec.yaml` exactly: snake_case, the same enum
values, the same required fields, timestamps as ISO 8601 UTC ending in Z. If you believe the
contract is wrong, STOP and say so. Do not edit it.

## 1. Adapter Protocols, `backend/app/adapters/protocols.py`

Define `typing.Protocol` interfaces so the domain layer never imports the SDK:
`CatalogReader`, `SchemaReader`, `ObjectReader`, `AssetReader`, `GrantReader`, `GrantWriter`,
`PrincipalReader`, `DependencyReader`. Each method takes plain types and returns the domain models
from step 2. Pagination is `(items, next_page_token)`.

## 2. Domain models, `backend/app/domain/models.py`

Frozen dataclasses mirroring the contract schemas. These are what services pass around. The
pydantic models in `backend/app/api/v1/` stay the wire representation; keep the two separate and
map between them in `backend/app/api/`.

## 3. SDK adapters, `backend/app/adapters/databricks/`

One module per area: `catalogs.py`, `schemas.py`, `tables.py`, `volumes.py`, `functions.py`,
`models.py`, `grants.py`, `principals.py`, `dependencies.py`.

Rules that are not negotiable:
- This is the **only** place `databricks` may be imported, alongside `adapters/sql/`.
- **Explicit field allowlists** in every DTO mapper. Never `vars(obj)`, never `obj.as_dict()`
  wholesale. A test will assert no field whose name suggests a secret appears in any response.
- Translate every SDK exception at this boundary and let nothing escape:
  401 and 403 to `INSUFFICIENT_PRIVILEGES`, 404 to `NOT_FOUND`, 429 to `RATE_LIMITED`,
  5xx and timeouts to `UPSTREAM_UNAVAILABLE`. Capture the Databricks request id when the exception
  exposes one and put it in the error details. Never surface raw SDK text.
- Bound every listing: `max_results` capped at 200, and honour `page_token`.
- `table_type` from the SDK decides the `ObjectKind`: table, view, materialized_view or
  streaming_table. Do not guess from the name.
- Set `pipeline_managed` from the SDK field that indicates pipeline ownership, and `managed` from
  the managed versus external distinction. If the SDK does not expose it for that object type, the
  value is `unknown`, not a guess.

## 4. Grants and the privilege catalogue

- `grants.py` exposes direct grants and effective grants. The effective call reports where each
  privilege comes from; map that into `GrantSource` with `type` direct, inherited or unknown, and
  the parent securable type and full name when inherited.
- `backend/app/domain/privileges.py`: the privilege catalogue built from the SDK's `Privilege` enum,
  grouped per securable type, each entry carrying `code`, a plain-English `label`, a `description`,
  a `category`, and `prerequisites`. For example SELECT on a table is
  `label="Read data"`, `prerequisites=["USE_CATALOG","USE_SCHEMA"]`.
  Do not hand-pick a short list; derive the codes from the enum so the catalogue cannot drift.
  Distinguish BROWSE, USE_CATALOG, USE_SCHEMA, MANAGE, ALL_PRIVILEGES and object-specific
  privileges correctly. ALL_PRIVILEGES is **not** every administrative privilege; say so in the
  description.
- Do not implement grant or revoke writes in this task. `GrantWriter` is defined but only the
  fixture implementation exists. The plan lifecycle is the next task.

## 5. Principals

`principals.py` searches users, groups and service principals through SCIM. Mark each result's
`scope` as account, workspace_local or unknown, and set `uc_eligible` false for workspace-local
groups. If SCIM cannot be read, raise `INSUFFICIENT_PRIVILEGES`; never return a fabricated
directory.

## 6. Fixture adapters and dataset

`backend/app/adapters/fixtures/` implements every Protocol against an in-memory dataset in
`backend/app/fixtures_data/`. The dataset must be coherent and rich enough to exercise the UI:

- 3 catalogs: `sales`, `hr`, `shared_ref`, with plausible owners and comments.
- About 12 schemas and about 60 objects spread across tables, views, one materialized view, one
  streaming table, volumes, functions and one registered model with two versions.
- One pipeline-managed materialized view that must refuse metadata edits.
- 25 principals: users, account groups, one workspace-local group that is not UC eligible, and 3
  service principals.
- Grants that produce all three sources: direct on the object, inherited from the schema, and
  inherited from the catalog. Include a broad grant to `account users` so the findings rules have
  something real to flag later.
- One table carrying a row filter and one carrying a column mask, and tags including a governed tag
  and a system tag that must refuse edits.
- `group_membership_loaded` is **false** in the fixture, so the limitation line is exercised.

Use only synthetic names and the domain `example.test`. No real hostnames, emails or tokens.

## 7. Wire the endpoints

Implement the eight read paths listed at the top, in `backend/app/api/v1/`. Every response carries
a populated `meta` with `source` fixture or unity_catalog_api, `observed_at`, `scope`,
`completeness`, and a `limitations` list that is honest. When group membership is not loaded, the
grants response must include the limitation sentence
"Group membership was not loaded; access through group membership is not shown."

`allowed_actions` on every asset and grant comes from `authz.decide` plus object state. An
inherited grant must carry `revoke` with `allowed: false`, `reason_code: INHERITED_FROM_PARENT` and
a `navigate_to` pointing at the parent's access route. Never allow revoking an inherited privilege
on the child.

Update `capabilities/registry.py` so the operations you actually implemented move from
`not_implemented` to `available`, and nothing else moves.

## 8. Tests

Add under `backend/tests/`:
- `unit/test_privileges.py`: the catalogue covers every securable type, and ALL_PRIVILEGES is not
  treated as administrative.
- `unit/test_grants_explain.py`: direct versus inherited classification, and the limitation line
  appears when membership is not loaded.
- `unit/test_mappers.py`: no field whose name matches token, secret, password or credential, other
  than `credential_name`, appears in any mapped DTO.
- `unit/test_exception_translation.py`: each upstream status maps to the right error code.
- `api/test_assets.py` and `api/test_grants.py`: the eight endpoints return the exact envelope,
  pagination works, a viewer can read, and a target outside `UCGOV_MANAGED_CATALOGS` returns
  `FORBIDDEN_SCOPE`.
- `contract/test_examples_validate.py`: `shared/contracts/examples/AssetListResponse.*.json` and
  `GrantsResponse.*.json` each parse into the matching pydantic model.

## VERIFY and paste real output
- `uv run --frozen ruff check backend`
- `uv run --frozen mypy backend/app`
- `uv run --frozen pytest backend/tests -q`
- Start it and prove one endpoint end to end:
  set `UCGOV_MODE=fixture` and `UCGOV_FIXTURE_ACTOR=alice.steward`, run
  `uv run --frozen uvicorn app.main:create_app --factory --app-dir backend --port 8130`,
  then fetch `/api/v1/schemas/sales/crm/objects` and `/api/v1/assets/TABLE/sales.crm.orders/grants`
  and paste both bodies. Stop the server afterwards.

## REPORT
Every file created, the real command output, which capability rows moved to `available`, and
anything you could not do.

FORBIDDEN
- No network, no installs, no git, no real Databricks calls, no client construction outside a
  lazily created adapter that is never constructed in fixture mode.
- Do not edit shared/contracts, frontend/, pyproject.toml, docs/ other than your task board rows,
  or .ai/.
- No endpoint that returns success without doing its work. Unimplemented stays 501.
- Do not invent SDK method names. If a method you expected is absent, report it.
