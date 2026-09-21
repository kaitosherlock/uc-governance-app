# Unity Catalog Governance App — planning and agent workspace

This folder is the **source root** for a greenfield Unity Catalog Governance application that will
run on Databricks Apps. It currently contains the plan, contracts, and agent instructions; the
application code is to be built here by coding agents (Antigravity and Codex) following
`AGENTS.md`.

> **Why not `governance-app/`?** The brief names that folder, but
> `C:\Users\admin\Downloads\governance-app` already holds an unrelated, earlier Streamlit build
> with its own Git history. Per the brief's own rule, it is preserved untouched and this project
> lives in `uc-governance-app/` instead.

## Start here

| Read in this order | Purpose |
|---|---|
| `AGENTS.md` | How agents work here: hard rules, loop, ownership, commands, definition of done |
| `BACKEND_INSTRUCTION.md` | Backend Coder only: stack, layering, principles, endpoint checklist, DoD |
| `FRONTEND_INSTRUCTION.md` | Frontend Coder only: contract discipline, four UI states, PlanFlow, DoD |
| `shared/contracts/` | **The locked API and data contract.** `api-spec.yaml` is canonical; `types.ts` mirrors it; `examples/` feed the mocks; `error-codes.md` maps codes to UI treatment |
| `.ai/HANDOVER.md` | Orchestration checkpoint: phase, milestones, blockers, next actions |
| `docs/09-orchestration-playbook.md` | Gates, model-tier policy, dispatch format |
| `docs/00-spec.md` | The authoritative brief, verbatim |
| `docs/01-plan.md` | Phases 0–6, exit criteria, timeline |
| `docs/02-architecture.md` | Folder layout, modes, response/error/identity/plan contracts, API surface |
| `docs/03-technology-decision.md` | Provisional stack with dated evidence; finalized in P0-02 |
| `docs/04-databricks-apps-constraints.md` | Verified platform facts (2026-09-21) and open items |
| `docs/05-capability-matrix-starter.md` | Seed for `docs/capability-matrix.md` |
| `docs/06-security-model.md` | Auth, roles, execution identity, plan integrity, secret and SQL safety |
| `docs/07-design-brief.md` | Product brief, IA, flows, tokens, a11y and copy rules |
| `docs/08-testing-and-acceptance.md` | Test matrix and evidence per acceptance criterion |
| `tasks/TASK-BOARD.md` | Claimable tasks with owners, dependencies, evidence cells |
| `tasks/STATUS.md` | Append-only coordination log |
| `tasks/HANDOFF-PROTOCOL.md` | How two agents share one folder without Git |

Agent-specific entry points: `AGENTS.md` (Codex and generic), `GEMINI.md` + `.agent/rules/` +
`.agent/workflows/implement-task.md` (Antigravity).

## Planned stack (provisional)

Python 3.11 + FastAPI + `databricks-sdk` 0.140.0 backend serving a prebuilt React 19 + TypeScript
+ Vite + Tailwind v4 + shadcn/ui frontend from one process; Lakebase Postgres via `psycopg` for
durable workflow state; `uv` for Python, `npm` for Node. See `docs/03` for why and what was
rejected.

## Contract gate (works now)

```bash
uv run --with pyyaml --with jsonschema python scripts/validate_contracts.py
```

15 checks, no network, no Databricks. Last run: OK. Redocly reports 0 errors.

## Planned run commands (available after Phase 0)

Fixture mode (no Databricks account needed):

```powershell
$env:UCGOV_MODE = "fixture"; $env:UCGOV_FIXTURE_ACTOR = "alice.steward"
uv run uvicorn app.main:create_app --factory --app-dir backend --port 8000
```

```bash
cd frontend && npm ci && npm run dev
```

Checks: `scripts/check_all.ps1` (Windows) or `scripts/check_all.sh`.

## What this project never does

No Git, no deployment, no live Databricks mutations, no resource creation, no secrets in files,
no fake success responses, no reading or editing `..\governance-app\`.
