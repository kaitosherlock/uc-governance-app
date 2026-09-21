# 08 — Testing plan and acceptance evidence

Maps spec §14 to concrete test files and evidence artifacts. "Mocked" and "live" are always
reported separately; no mocked test may be described as verifying Databricks integration.

## 1. Test layers

| Layer | Tool | Location | Runs in |
|---|---|---|---|
| Backend unit | pytest | `backend/tests/unit/` | CI-free local, fixture adapters |
| SDK contract | pytest + `inspect` against installed `databricks-sdk` | `backend/tests/contract/` | local; asserts method names, parameter names, and DTO field names exist on the pinned SDK |
| API | pytest + `httpx.AsyncClient` over the FastAPI app in fixture mode | `backend/tests/api/` | local |
| Frontend unit | Vitest + Testing Library | `frontend/src/**/*.test.tsx` | local |
| E2E | Playwright against `uvicorn` in fixture mode serving built `dist/` | `frontend/e2e/` | local |
| Integration (opt-in) | pytest markers `-m live`, env `UCGOV_LIVE_SANDBOX=1` + explicit workspace id allowlist | `backend/tests/integration/` | **never run in this engagement** unless the user authorizes a sandbox; read-only tests only unless separately authorized |

## 2. Required test matrix

| Spec §14 item | Test(s) | Evidence file |
|---|---|---|
| Object-level authz, scope, principal validation | `api/test_authz.py::test_scope_outside_managed_catalogs_403`, `unit/test_principals.py` | `docs/test-results/pytest.txt` |
| Viewer denial on direct mutation calls | `api/test_authz.py::test_viewer_all_mutation_routes_403` (parametrized over every POST/PATCH/DELETE route discovered from the app's router table) | same |
| No identity fallback/spoofing/escalation | `api/test_identity.py`: spoofed `X-Forwarded-Email` without token → 401; token/header mismatch → 401; user 403 does not become SP call; fixture mode refuses to start with `DATABRICKS_APP_PORT` set | same |
| Direct vs inherited, ownership, incomplete groups | `unit/test_grants_explain.py`; fixture includes a group whose members are unreadable → limitation string present | same |
| Tag/policy/filter/mask validation | `unit/test_tags.py`, `test_policies.py`, `test_filters.py` (system tag rejected, invalid predicate, unsupported column type) | same |
| SQL injection, SSRF, secret redaction, origin | `unit/test_sql_safety.py` (identifier fuzz), `unit/test_ssrf.py` (loopback/link-local/metadata IPs), `unit/test_redaction.py`, `api/test_origin.py` (cross-site POST 403) | same |
| Pagination, throttling, identity-scoped cache, visibility | `api/test_pagination.py`, `unit/test_cache_keys.py`, `unit/test_ratelimit_mapping.py` (429 → `RATE_LIMITED`) | same |
| Stale/expired/tampered plans, concurrency, duplicate, replay | `api/test_plans.py` (each a separate test; tampered = mutate one byte of plan JSON) | same |
| Partial success, ambiguous timeout, reconcile, restart | `api/test_operations.py` with fixture scenario switches; restart test asserts no auto-replay | same |
| Approval authority, SoD | `api/test_requests.py` | same |
| Read-only/degraded | `api/test_degraded.py` (no warehouse, no Lakebase, read-only mode) | same |
| SDK adapter contracts | `contract/test_sdk_shapes.py` | `docs/test-results/contract.txt` |
| UI journeys | Playwright: `search-select.spec.ts`, `breadcrumbs.spec.ts`, `grant-preview-apply.spec.ts`, `revoke-inherited.spec.ts`, `errors-unknown.spec.ts` | `docs/test-results/playwright/` + `screenshots/` |
| English UI, keyboard, responsive, a11y | `strings.test.ts` (no non-ASCII letters outside identifiers; all UI strings from `strings.ts`), Playwright keyboard-only spec, viewport matrix, `@axe-core/playwright` run | `docs/test-results/axe.json`, `docs/a11y-manual-checks.md` |
| Install, typecheck, lint, build, start | `scripts/check_all.(ps1|sh)` → `uv sync --frozen`, `ruff`, `mypy`, `pytest`, `npm ci`, `tsc --noEmit`, `eslint`, `vite build`, start + `/api/v1/context` smoke | `docs/test-results/check_all.txt` |

## 3. Acceptance criteria evidence (spec §14 list)

| # | Criterion | Evidence required |
|---|---|---|
| 1 | New user finds a table, understands sources, completes grant preview without code | Playwright `grant-preview-apply.spec.ts` + screenshots `synthetic-access-table-1440.png`, `synthetic-grant-preview-1440.png` |
| 2 | Direct vs inherited distinguishable | screenshot + unit test on source labels |
| 3 | Actor vs executor distinguishable | screenshot of preview identity block + `/me` API test |
| 4 | Viewer cannot mutate via API | `test_viewer_all_mutation_routes_403` |
| 5 | Stale/duplicate cannot silently apply | `test_plans.py` |
| 6 | Real/fixture/read-only/unsupported/unknown explicit | `/capabilities` test + screenshots of each mode banner |
| 7 | Runs locally, documented deploy path | `check_all` output + `app.yaml` + runbook |
| 8 | Visual review desktop + narrow, no critical failures | `docs/browser-review.md` with dated findings and fixes |
| 9 | Every domain has honest status | `docs/capability-matrix.md` complete, no blank Impl cells |

## 4. Reporting rules

- Paste real command output into `docs/test-results/*.txt`; include failures verbatim if any remain.
- Label every screenshot from fixture mode with the `synthetic-` prefix and a visible Demo banner.
- The handoff report states: "No live Databricks workspace was contacted during this build."
  unless that changes with explicit authorization, in which case record workspace id, identity used,
  date, and which tests ran.
