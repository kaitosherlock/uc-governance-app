# 05 — Capability matrix STARTER

This is the seed for the deliverable `docs/capability-matrix.md`. The implementing agent copies it
to that filename in Phase 0 and keeps it current. **Every SDK method name below is a candidate from
memory and must be confirmed against the pinned `databricks-sdk` by inspecting the installed package
(`python -c "from databricks.sdk import WorkspaceClient; help(WorkspaceClient.grants)"`) before the
row is marked anything other than `unknown`.** Record the confirmation date.

Column legend:
- **API:** WS = Workspace API, ACC = Account API, SQL = Statement Execution with template, SYS = system table via SQL.
- **Exec:** U = user token, SP = app service principal, ACC-SP = separately configured account client.
- **Impl:** `implemented | read_only | unsupported | blocked | not_implemented`.
- **Live:** always `not live-verified` until an authorized sandbox run is recorded with date and workspace id.

## 7.1 Assets and metadata

| Operation | Securables | Candidate SDK / mechanism | API | Exec | Privileges needed | GA/Preview | Impl | Requires | Doc link (verify) | Live |
|---|---|---|---|---|---|---|---|---|---|---|
| List/get catalogs | catalog | `w.catalogs.list/get` | WS | U (scope `catalog.catalogs`) | visibility | GA | not_implemented | — | docs UC catalogs | not live-verified |
| List/get schemas | schema | `w.schemas.list/get` | WS | U (`catalog.schemas`) | USE_CATALOG or BROWSE | GA | not_implemented | — | | |
| List/get tables, views, MVs, streaming tables | table | `w.tables.list/get` (`table_type` distinguishes) | WS | U (`catalog.tables`) | USE_SCHEMA + SELECT or BROWSE | GA | not_implemented | — | | |
| List/get volumes | volume | `w.volumes.list/read` | WS | SP (not in user scope list) | USE_SCHEMA | GA | not_implemented | — | | |
| List/get functions | function | `w.functions.list/get` | WS | SP | USE_SCHEMA | GA | not_implemented | — | | |
| List/get registered models & versions | model | `w.registered_models.*`, `w.model_versions.*` | WS | SP | USE_SCHEMA | GA | not_implemented | — | | |
| Metastore summary | metastore | `w.metastores.current/summary` | WS | SP | any | GA | not_implemented | — | | |
| Edit description/comment | catalog, schema, table, volume, function, model | `w.<area>.update(comment=…)`; column comments via SQL `ALTER TABLE … ALTER COLUMN … COMMENT` | WS / SQL | SP | owner or MANAGE (per docs) | GA | not_implemented | warehouse for column comments | | |
| Edit properties | catalog, schema | `update(properties=…)` | WS | SP | owner/MANAGE | GA | not_implemented | | | |
| Transfer ownership | all | `update(owner=…)` | WS | SP | owner or MANAGE + metastore rules | GA | not_implemented | | | |
| Create/delete catalog, schema, volume | those | `create/delete` (never `force=True` by default) | WS | SP | CREATE_* on parent | GA | not_implemented | | | |
| Delete table | table | `w.tables.delete` | WS | SP | owner/MANAGE | GA | not_implemented | dependency check first | | |
| Restore dropped table (UNDROP) | table | SQL `UNDROP TABLE` template | SQL | SP | per docs | verify | unknown | warehouse | | |
| Pipeline-managed detection | table | `TableInfo.pipeline_id` / `table_type` | WS | U/SP | — | GA | not_implemented | | | |
| Metastore assignment | metastore↔workspace | `a.metastore_assignments.*`, `a.metastores.*` | ACC | ACC-SP | account admin | GA | not_implemented | `UCGOV_ACCOUNT_*` | | |

## 7.2 Privileges, ownership, access explanation

| Operation | Securables | Candidate SDK | API | Exec | Privileges | GA | Impl | Requires | Doc | Live |
|---|---|---|---|---|---|---|---|---|---|---|
| Direct grants | all securable types | `w.grants.get(securable_type, full_name)` | WS | SP | owner/MANAGE or visibility per docs | GA | not_implemented | | | |
| Effective (inherited) grants with source | same | `w.grants.get_effective` → `inherited_from_type/name` | WS | SP | same | GA | not_implemented | | | |
| Grant / revoke deltas | same | `w.grants.update(changes=[PermissionsChange(add=[…], remove=[…])])` | WS | SP | owner or MANAGE (+ grant option semantics per docs) | GA | not_implemented | plan core | | |
| Privilege catalogue | per securable type | `databricks.sdk.service.catalog.Privilege` enum + docs matrix | — | — | — | — | not_implemented | | UC privileges doc | |
| Principal search (users/groups/SPs) | — | `w.users.list(filter=…)`, `w.groups.list`, `w.service_principals.list` (workspace SCIM); account-level `a.groups` via ACC | WS/ACC | SP / ACC-SP | SCIM read | GA | not_implemented | | | |
| Workspace-local group detection | — | group `meta.resourceType` / account vs workspace listing diff — **verify** | WS | SP | | | unknown | | | |
| Group membership for explanation | — | `w.groups.get(id).members` (only if readable) | WS | SP | | GA | not_implemented | disclose gap otherwise | | |

## 7.3 Tags, governed tags, classification

| Operation | Candidate mechanism | API | Exec | Impl | Notes |
|---|---|---|---|---|---|
| Read tags on object/column | `w.entity_tag_assignments.list` (verify presence) or SYS `system.information_schema.*_tags` | WS / SYS | SP / U | unknown | Prefer SDK if present |
| Assign/remove tag | `w.entity_tag_assignments.create/delete` (verify) or SQL `ALTER … SET TAGS / UNSET TAGS` | WS / SQL | SP | unknown | System tags (`system.*`) rejected server-side |
| Governed tags (tag policies, allowed values) | `w.tag_policies.*` (verify) | WS | SP | unknown | Preview status to record |
| Tag privileges (ASSIGN/apply) | via `w.grants` on securable type `TAG_POLICY`? — **verify** | WS | SP | unknown | |
| Data Classification config/status/results | **verify** whether any SDK/API surface exists; if none → `unsupported` with reason | — | — | unknown | Never trigger scans |

## 7.4 ABAC policies

| Operation | Candidate mechanism | Impl | Notes |
|---|---|---|---|
| List/get/create/update/delete policies | `w.policies.*` in `catalog` service (verify name and GA/Preview) or SQL `CREATE POLICY` templates | unknown | Show scope, predicates, principals, functions |
| Impact preview | app-side: assets in visible scope matching tag predicates | not_implemented | Label "potentially affected — not evaluated by Databricks" |

## 7.5 Row filters, column masks, dynamic views

| Operation | Mechanism | Impl | Notes |
|---|---|---|---|
| Read filter/mask | `TableInfo.row_filter`, `ColumnInfo.mask` | not_implemented | SDK |
| Set/drop filter/mask | SQL `ALTER TABLE … SET/DROP ROW FILTER`, `ALTER COLUMN … SET/DROP MASK` | not_implemented | warehouse; exposure warning |
| Function details/dependencies | `w.functions.get`; dependents via SYS `information_schema.*` — verify | unknown | |
| Dynamic view definition | `TableInfo.view_definition`; replace via SQL `CREATE OR REPLACE VIEW` with full text | not_implemented | diff preview mandatory |

## 7.6 Storage, credentials, bindings

| Operation | Candidate SDK | Impl | Notes |
|---|---|---|---|
| Storage credentials list/get/create/update/delete/validate | `w.storage_credentials.*`, `validate` | not_implemented | allowlisted fields only |
| Service credentials | `w.credentials.*` (verify) | unknown | |
| External locations | `w.external_locations.*` | not_implemented | |
| Workspace bindings | `w.workspace_bindings.get_bindings/update_bindings` | not_implemented | unbind preview |

## 7.7 Federation

| Operation | Candidate SDK | Impl | Notes |
|---|---|---|---|
| Connections list/get/create/update/delete | `w.connections.*` | not_implemented | strip `options` secrets; SSRF validation |
| Foreign catalogs for a connection | `w.catalogs.list` filtered by `connection_name` | not_implemented | |

## 7.8 Sharing

| Operation | Candidate SDK | Impl | Notes |
|---|---|---|---|
| Shares, share permissions, shared objects | `w.shares.*`, `update_permissions` | not_implemented | |
| Recipients | `w.recipients.*` (never `rotate_token`; token fields stripped) | not_implemented | admin alternative text |
| Providers | `w.providers.*` | not_implemented | |
| Clean Rooms / Marketplace metadata | `w.clean_rooms.*` (verify), marketplace APIs | unknown | related-module label |

## 7.9 Lineage

| Operation | Mechanism | Impl | Notes |
|---|---|---|---|
| Table/column lineage | SYS `system.access.table_lineage`, `column_lineage` templates, bounded | not_implemented | warehouse; state window/latency |
| Lineage REST API via SDK | verify presence of a lineage service in pinned SDK; else omit | unknown | |
| External lineage/metadata | `w.external_lineage.*`, `w.external_metadata.*` (verify) | unknown | |

## 7.10 Audit and findings

| Operation | Mechanism | Impl | Notes |
|---|---|---|---|
| Databricks audit | SYS `system.access.audit` bounded template | not_implemented | warehouse |
| App activity | Lakebase `app_activity` | not_implemented | Lakebase |
| Findings rules | app-side over cached reads | not_implemented | signals only |

## 7.11 Quality and AI assets

| Operation | Candidate SDK | Impl | Notes |
|---|---|---|---|
| Quality monitors get/refresh history | `w.quality_monitors.get/list_refreshes` | not_implemented | |
| Create/refresh monitor | `w.quality_monitors.create/run_refresh` as plan with cost notice | not_implemented | never auto |
| Model serving endpoints (related) | `w.serving_endpoints.list/get` | not_implemented | labeled related service |
| AI Gateway config | `w.serving_endpoints.get(...).ai_gateway` | not_implemented | read only |

## 7.12 Access requests

| Operation | Candidate SDK | Impl | Notes |
|---|---|---|---|
| Native RFA destinations | `w.rfa.*` (verify exact methods) | unknown | record which steps API covers |
| App-owned requests/approvals/reviews | Lakebase | not_implemented | labeled application-owned |
| Time-bound access | Lakebase + Lakeflow job artifact | not_implemented | scheduler not deployed |

## Runtime availability (separate from Impl)

`GET /api/v1/capabilities` computes at request time: `available`, `not_configured` (e.g. no
warehouse), `insufficient_permissions` (probe failed with 403), `unsupported_in_environment`
(only with evidence string), `not_implemented`, `temporarily_unavailable` (5xx/timeout),
`unknown`. Do not cache probes across identities.
