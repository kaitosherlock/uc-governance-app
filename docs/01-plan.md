# 01 — Implementation plan

Derived from spec §13 (sequence) and §14–§16 (acceptance/deliverables). Each phase lists exit
criteria that a reviewer can check without reading code. Task-level breakdown with owners is in
`tasks/TASK-BOARD.md`.

## Guiding rules for every phase

1. Backend slice + UI integration + tests land together. No phase is "backend only".
2. Every governance operation appears in `docs/capability-matrix.md` with an honest status before
   its UI control is enabled.
3. Fixture mode must exercise the phase's workflow end-to-end before connected-mode code is written.
4. No Git, no deploy, no live mutation, no resource creation. Ever, in this project.
5. Screenshots of new screens (desktop 1440 px and narrow 375 px) go to `screenshots/` with a
   `synthetic-` filename prefix when taken in fixture mode.

## Phase 0 — Foundations (both agents, ~1 day)

**Goal:** finalize the stack, lock the contracts, make `uv run` and `npm run dev` work.

| # | Work | Owner |
|---|---|---|
| P0-01 | Re-verify `04-databricks-apps-constraints.md` "not verified" items; fill limitations/timeouts | Codex |
| P0-02 | Finalize `03-technology-decision.md`; pin versions; create `pyproject.toml`, `uv.lock`, `requirements.txt`, `package.json`, `package-lock.json` | Codex (py) / Antigravity (npm) |
| P0-03 | Scaffold backend: settings, `UCGOV_MODE` guard, `/me`, `/context`, `/capabilities`, error envelope, correlation id middleware, redaction logger | Codex |
| P0-04 | Scaffold frontend: Vite + React + TS + Tailwind v4 + shadcn init, token system from `07-design-brief.md`, `ContextBar`, app shell, router with scope URL | Antigravity |
| P0-05 | Typed fetch client over `@contracts/types` plus MSW handlers from `shared/contracts/examples/` | Antigravity |
| P0-06 | Fixture dataset v1: 3 catalogs, ~12 schemas, ~60 objects of mixed types, 25 principals (users, account groups, one workspace-local group, 3 SPs), direct + inherited grants, tags, one ABAC policy, one row filter, one column mask, one share, one connection | Codex |
| P0-07 | Playwright + pytest + ruff + mypy + eslint configured; `make check`/`npm run check` scripts | both |

**Exit:** app starts in fixture mode; banner reads "Demo — synthetic data"; `/capabilities` lists
every domain with `not_implemented`; tests and lint pass; screenshots of empty shell exist.

## Phase 1 — Asset discovery, metadata, grants explanation, plan/apply core (~3 days)

| # | Work | Owner |
|---|---|---|
| P1-01 | SDK adapters: catalogs, schemas, tables, volumes, functions, registered models, model versions (list/get, paginated). Contract tests against pinned SDK types | Codex |
| P1-02 | Grants adapter: `get` (direct) + `get_effective` (inherited with source) + `update` (deltas only). Privilege catalogue by securable type, sourced from SDK enum + docs, in `backend/app/domain/privileges.py` | Codex |
| P1-03 | Principals adapter: SCIM users/groups/SPs search; workspace-local group detection; UC eligibility | Codex |
| P1-04 | Mutation core: plan builder, HMAC, TTL, stale check, executor, verifier (read-back), operation store (in-memory in fixture; Lakebase repo interface defined) | Codex |
| P1-05 | Grant/revoke/ownership-transfer plan kinds; USE_CATALOG/USE_SCHEMA prerequisite explanation; inherited-revoke refusal with `navigate_to` | Codex |
| P1-06 | UI: Data Assets browse/search (debounced, cancellable), breadcrumbs, asset overview (name/type/owner/description prominent; JSON in `<details>`), copy-FQN, refresh | Antigravity |
| P1-07 | UI: Access table (principal, kind, privilege label + code, source badge, actions), filters, empty/visibility-limited states | Antigravity |
| P1-08 | UI: `PlanFlow` — choose principal & privileges → preview → apply → result-in-page; stale-plan and unknown-outcome states | Antigravity |
| P1-09 | Fixture scenarios: success, partial success (batch), forbidden, stale plan, missing config, unknown outcome | Codex |
| P1-10 | Tests: authz per route, spoofing, plan lifecycle, direct/inherited rendering, E2E "find table → understand access → preview grant" | both |

**Exit:** acceptance criteria 1–6 demonstrable in fixture mode; capability matrix rows for §7.1–7.2
filled; screenshots of browse, access table, preview, forbidden, unknown outcome.

## Phase 2 — Tags, governed tags, classification, ABAC, filters/masks, ownership (~3 days)

| # | Work | Owner |
|---|---|---|
| P2-01 | Tag read/assign/remove via verified SDK surface (entity tag assignments) or SQL `ALTER … SET TAGS` templates; system-tag restrictions; governed tags via tag-policies API if present in pinned SDK | Codex |
| P2-02 | Data Classification: read config/status/results only if a documented SDK/API surface exists; otherwise matrix row = `unsupported`/`not_implemented` with reason. Never trigger scans | Codex |
| P2-03 | ABAC policies: list/get/create/update/delete via SDK policies API if present; validation of scope/predicates/functions; impact = assets in visible scope carrying matching tags, labeled "potentially affected, not evaluated" | Codex |
| P2-04 | Row filters & column masks: read from table metadata; set/drop via SQL templates; function dependency lookup; exposure warning on removal | Codex |
| P2-05 | Dynamic views: read definition; edit only via explicit full-definition replace with diff preview | Codex |
| P2-06 | UI: Tags tab, Policies section (list/detail/edit with preview), Filters & masks panel, ownership transfer flow | Antigravity |
| P2-07 | Tests: tag/policy/filter validation, ABAC preview labeling, SQL identifier safety | both |

**Exit:** §7.3–7.5 rows honest; no control enabled for an operation with status ≠ `implemented`.

## Phase 3 — Storage, bindings, federation, sharing (~2–3 days)

| # | Work | Owner |
|---|---|---|
| P3-01 | Storage credentials, service credentials, external locations: list/get (allowlisted fields), create/update/delete plans, native `validate` where SDK offers it, IAM-vs-UC explanation | Codex |
| P3-02 | Workspace bindings: read; update plan with "access that may be disrupted" preview (visible dependents only, rest unknown) | Codex |
| P3-03 | Connections & foreign catalogs: list/get without options that hold secrets; per-connector capability table; SSRF validation on host fields | Codex |
| P3-04 | Shares/recipients/providers: list/get/update plans; sharing-mode explanation; recipient token operations `unsupported` by policy with admin alternative text | Codex |
| P3-05 | UI: "Platform" area for storage/federation/sharing with typed-name confirmation for deletes/unbinds | Antigravity |
| P3-06 | Tests: SSRF, secret allowlists, unbind preview | both |

## Phase 4 — Lineage, audit, findings, quality, AI assets (~3 days)

| # | Work | Owner |
|---|---|---|
| P4-01 | Lineage via `system.access.table_lineage`/`column_lineage` SQL templates (bounded depth/nodes/window) and, if a documented SDK lineage surface exists in the pinned SDK, that too. Coverage/latency statement in `meta` | Codex |
| P4-02 | Databricks audit via `system.access.audit` template with bounded filters; app activity from Lakebase; correlation status `verified/partial/unavailable` | Codex |
| P4-03 | Findings engine: rules for missing owner/description, broad grants (`account users`, `ALL_PRIVILEGES`), external sharing, sensitive tags without masks, policy coverage; read-only signals | Codex |
| P4-04 | Quality monitors: read config/status/refresh history; create/refresh only as plans that show compute cost; no auto-create | Codex |
| P4-05 | Models/versions/functions: metadata, grants, tags; serving endpoints as "related service" | Codex |
| P4-06 | UI: Lineage graph (add `@xyflow/react` now), Activity (two clearly separated tabs), Findings, Quality tab, AI assets | Antigravity |

## Phase 5 — Requests, approvals, reviews, persistence, scheduler (~3 days)

| # | Work | Owner |
|---|---|---|
| P5-01 | Verify native RFA API surface in pinned SDK; matrix row says exactly which of destination-config / submit / approve / execute it supports | Codex |
| P5-02 | Lakebase repository: `migrations/0001_init.sql` (plans, operations, approvals, reviews, activity, scheduled_revocations); psycopg pool; OAuth credential refresh; never run at startup | Codex |
| P5-03 | App-owned request → approval → apply pipeline reusing plan core; SoD; approver scope check; statuses Approved/Applying/Applied/Failed/Unknown | Codex |
| P5-04 | Access reviews: scope snapshot, decisions, evidence, execution results | Codex |
| P5-05 | Time-bound access: `jobs/expiry_reconciler/` source + job definition YAML (not deployed); overlap-preserving revocation logic with tests | Codex |
| P5-06 | UI: Requests inbox, approval detail with authority explanation, reviews | Antigravity |
| P5-07 | Degraded behavior: without Lakebase these features show `not_configured` with next steps | both |

## Phase 6 — Hardening, browser review, deployment prep, handoff (~2 days)

| # | Work | Owner |
|---|---|---|
| P6-01 | `app.yaml` final; `.env.example`; README with exact commands; runbook (`docs/runbook.md`) | Codex |
| P6-02 | Full browser review at 1440/1024/375 px, keyboard-only pass, reduced motion, zoom 200%, long names; fix findings | Antigravity |
| P6-03 | Accessibility audit with `web-design-guidelines` skill + axe run; document remaining manual checks | Antigravity |
| P6-04 | Final test run; store outputs in `docs/test-results/`; capability matrix final pass | both |
| P6-05 | `docs/handoff-report.md` per spec §16 | both |

## Timeline summary

| Phase | Effort | Parallelism |
|---|---|---|
| 0 | 1 day | both agents, then unblock |
| 1 | 3 days | backend leads by ~½ day, UI follows the OpenAPI contract |
| 2–4 | 8–9 days | fully parallel per domain |
| 5 | 3 days | backend-heavy |
| 6 | 2 days | UI-heavy |

Total ≈ 17–18 agent-days if serialized; ≈ 10–11 calendar days with two agents.

## Definition of done (project)

All nine acceptance criteria in spec §14 met in fixture mode with evidence; connected mode
implemented against the pinned SDK with contract tests; every §7 domain has a matrix row with
implementation status and a *separate* live-verification status of "not live-verified" (because no
sandbox is authorized in this engagement) unless the user later authorizes one.
