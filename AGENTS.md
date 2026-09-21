# AGENTS.md — instructions for coding agents (Codex, Antigravity, others)

You are building the **Unity Catalog Governance application** described in `docs/00-spec.md`.
That file is authoritative. This file tells you how to work in this folder. Read both fully before
your first edit, then read `tasks/TASK-BOARD.md` and `tasks/STATUS.md`.

**Then read the file for your role and nothing else's:**

| You are | CLI | Read | You own |
|---|---|---|---|
| Backend Coder | `codex` | `BACKEND_INSTRUCTION.md` | `backend/**`, `app.yaml`, Python manifests, `jobs/**` |
| Frontend Coder | Antigravity (`agy`) | `FRONTEND_INSTRUCTION.md` | `frontend/**`, `screenshots/**` |

The role in your dispatch prompt decides which file you read and which paths you may touch.
Editing outside your declared scope is rejected at review.

**The API contract is immutable.** `shared/contracts/api-spec.yaml` (OpenAPI 3.0.3, v1.0.0) and
`shared/contracts/types.ts` are the single source of truth for every path, payload, enum, and
error code. Neither coding agent edits them. If you believe the contract is wrong, stop and report
it; the orchestrator decides. Validate with:

```bash
uv run --with pyyaml --with jsonschema python scripts/validate_contracts.py
```

## 0. Where you are

- Source root: `C:\Users\admin\Downloads\uc-governance-app\` (this folder). The spec says
  `governance-app/`; that sibling folder is an **unrelated earlier build**. Never read from, copy
  from, or modify `..\governance-app\`.
- Platform target: Databricks Apps (Python 3.11 runtime). Local dev on Windows 11 with PowerShell;
  scripts must have both `.ps1` and `.sh` variants or be `uv`/`npm` scripts.
- There is **no Git**. Do not `git init`, commit, branch, or push. Coordination happens through
  `tasks/STATUS.md` and directory ownership (see §3).

## 1. Hard rules (never break, no exceptions, no "just this once")

1. **No live mutations, no resource creation, no deployment.** Do not run `databricks apps deploy`,
   `databricks sync`, create warehouses/Lakebase/jobs/monitors, or call any SDK method that writes
   to a real workspace. Integration tests are opt-in and disabled by default.
2. **No fake success.** An operation that is not implemented returns 501 `NOT_IMPLEMENTED`. One
   that is unsupported returns `UNSUPPORTED` with a reason. Never a no-op that returns 200.
3. **No secrets anywhere** in code, fixtures, logs, screenshots, docs, or error details.
4. **Fixture mode is explicit** (`UCGOV_MODE=fixture`) and refuses to start when Databricks Apps
   environment variables are present. Connected mode never falls back to fixtures.
5. **Every privileged write goes through the plan lifecycle** in `docs/02-architecture.md` §6.
   No direct "apply" endpoints.
6. **Actor identity comes from the user token** (`current_user.me()`), never from headers alone.
   No fallback from user token to service principal.
7. **All UI text is English** and lives in `frontend/src/lib/strings.ts`. Object names, principal
   names, and privilege identifiers are never translated or reworded.
8. **`databricks` SDK imports only under `backend/app/adapters/`; `psycopg` only under
   `backend/app/persistence/`.** Domain code depends on Protocols.
9. **Don't invent Databricks facts.** Before you mark any capability row `implemented`, confirm the
   SDK method exists on the pinned version by introspecting the installed package and cite the doc
   URL with today's date in `docs/capability-matrix.md`. If you cannot verify, the row stays
   `unknown` and the control stays disabled with an explanation.
10. **Do not install global tools, skills, or change agent configuration.** Project-local
    dependencies only.

## 2. Working loop for every task

1. Claim the task: in `tasks/TASK-BOARD.md` set `Status: in_progress`, `Owner: <you>`, add the date.
   Append one line to `tasks/STATUS.md`.
2. Re-read the spec sections the task cites. Check `docs/02-architecture.md` for contracts you must
   honor. If you need a contract change, edit the doc first and note it in `STATUS.md`.
3. Implement backend and/or frontend **with tests in the same task**. Fixture-mode path first.
4. Run the relevant checks (below). Paste the actual output summary into the task's `Evidence` cell.
5. Update `docs/capability-matrix.md` rows touched by the task.
6. Take screenshots for new screens (1440 px and 375 px) into `screenshots/` with a `synthetic-`
   prefix if fixture mode. Note the paths in the task.
7. Set `Status: done` (or `blocked` with the exact blocker) and append to `STATUS.md`.

Never leave a task `in_progress` at the end of a session without a `STATUS.md` note describing the
partial state and the next concrete step.

## 3. Ownership split (avoid editing the other agent's files)

| Area | Primary owner | The other agent may… |
|---|---|---|
| `shared/contracts/**` | **Orchestrator only** | read constantly; never edit. Request changes via `STATUS.md` |
| `backend/**`, `pyproject.toml`, `uv.lock`, `requirements.txt`, `app.yaml`, `jobs/**`, `docs/capability-matrix.md`, `docs/runbook.md` | **Codex** | read; propose changes via `STATUS.md`; fix a failing test only if it blocks them and they note it |
| `frontend/**`, `docs/07-design-brief.md`, `docs/browser-review.md`, `docs/a11y-manual-checks.md`, `screenshots/**` | **Antigravity** | read; regenerate `frontend/src/api/generated/**` after a contract version bump |
| `.ai/**`, `docs/09-orchestration-playbook.md`, `scripts/dispatch.ps1` | **Orchestrator only** | read |
| `docs/02-architecture.md`, `docs/06-security-model.md`, `tasks/**`, `README.md`, `docs/handoff-report.md` | shared | edit with a `STATUS.md` line naming the section changed |

`shared/contracts/api-spec.yaml` is the handshake, and it already exists. The backend implements
it and proves conformance with `backend/tests/contract/` (path parity, schemathesis, example
validation); the frontend consumes `shared/contracts/types.ts` directly and generates nothing from
a running server. `backend/openapi.json` is an *output* used only for the parity test, never a
source of truth.

If only one agent is active, it owns everything; keep the loop and the file layout the same.

## 4. Commands (targets; create them in Phase 0 if missing)

Backend (from the source root):

```
uv sync --frozen
uv run ruff check backend
uv run mypy backend/app
uv run pytest backend/tests -q
uv run python -m app.tools.export_openapi
$env:UCGOV_MODE="fixture"; $env:UCGOV_FIXTURE_ACTOR="alice.steward"; uv run uvicorn app.main:create_app --factory --app-dir backend --port 8000
```

Frontend (from `frontend/`):

```
npm ci
npm run contract:check
npm run lint
npm run typecheck
npm run test
npm run build
npm run e2e          # expects backend running in fixture mode on :8000 serving dist/
```

Everything at once: `scripts/check_all.ps1` / `scripts/check_all.sh`.

## 5. Definition of done for any task

- Tests added and passing; lint/typecheck clean.
- No new capability row left blank; no enabled control without an `implemented` row.
- Error paths return the documented error envelope; no raw exception text.
- Fixture scenario exists for the happy path and at least one failure path.
- UI: strings in `strings.ts`, keyboard reachable, visible focus, works at 375 px.
- `TASK-BOARD.md` and `STATUS.md` updated with evidence paths.

## 6. When you are unsure

- About a Databricks behavior: mark `unknown`, disable the control, write the question into
  `docs/open-questions.md`, move on.
- About a contract: prefer the stricter reading of the spec (e.g., show "Unknown" rather than a
  computed guess).
- About scope: do the part that is independent of the answer; record the assumption in `STATUS.md`.

Do not stop at plans or mockups. Ship working fixture-mode software with tests for every task you
claim.
