# 09 — Orchestration playbook

How the orchestrator (Claude, Lead Systems Architect) drives the two CLI coding agents. The
orchestrator writes no bulk implementation code; it scopes work, selects models, dispatches,
verifies, and rejects.

## 1. Roles

| Actor | Tool | Owns | Never |
|---|---|---|---|
| Orchestrator | this session | contracts, gates, reviews, `.ai/HANDOVER.md`, task board | writing feature code in bulk |
| Backend Coder | **`codex`** CLI — currently BLOCKED | `backend/**`, `app.yaml`, Python manifests, `jobs/**`, capability matrix, runbook | touching `frontend/**` or the contract |
| Frontend Coder | Antigravity CLI, installed as **`agy`** | `frontend/**`, screenshots, design brief, browser/a11y review | touching `backend/**` or the contract |

**Note on the backend CLI.** The backend role stays on `codex` by the user's explicit decision of
2026-09-21; rerouting it to `agy` was considered and **declined**. As of that date `codex` is not
installed on this machine and its account is out of tokens, so the backend lane cannot be
dispatched. `scripts/dispatch.ps1` refuses it while `.ai/agents.json` says `status: BLOCKED`.
The frontend lane runs independently in the meantime; work is sequenced so frontend progress
against MSW mocks does not depend on backend code existing.

Contract changes are the orchestrator's decision alone. An agent that needs one stops and reports.

## 2. Model selection policy

Tiers, not hard-coded names, because the installed CLIs decide what exists. Bindings live in
`.ai/agents.json` and were read from `agy models` on 2026-09-21.

| Tier | Use for | Frontend model (`agy`) | Backend model (`codex`) | Effort |
|---|---|---|---|---|
| `tier_reasoning` | Architecture, mutation lifecycle and state machine, authorization and identity logic, SDK adapter design, ABAC/lineage algorithms, security-sensitive code | `claude-opus-4-6-thinking` (alt `gemini-3.1-pro-high`) | unbound | high |
| `tier_standard` | Standard endpoints, CRUD, UI components, styling, routing, forms, tables | `claude-sonnet-4-6` | unbound | medium |
| `tier_utility` | Unit tests from an existing spec, fixtures and mocks, schema translation, doc tables, mechanical refactors | `gemini-3.8-flash-medium` | unbound | low |

Backend model ids stay **unbound** until `codex` is installed and reports its own list. Binding
them from memory would put fabricated model names into the pipeline.

Full model list reported by `agy models` on 2026-09-21: `gemini-3.8-flash-{high,medium,low}`,
`gemini-3.7-flash-{high,medium,low}`, `gemini-3.6-flash-{high,medium,low}`,
`gemini-3.1-pro-{high,low}`, `claude-sonnet-4-6`, `claude-opus-4-6-thinking`, `gpt-oss-120b-medium`.

Rules:
- Declare the agent, tier, model, and effort **before** every dispatch, in the message and in
  `.ai/HANDOVER.md`.
- Anything under `backend/app/auth/`, `authz/`, `mutations/`, or `adapters/sql/` is `tier_reasoning`
  regardless of how small it looks.
- Never downgrade a task that failed review; escalate a tier or split the task instead.
- The original brief named `claude-3-7-sonnet`, `o3-mini-high`, `gpt-4o`, `claude-3-5-haiku`. The
  installed CLI offers none of them. Tiers above supersede those names.

## 2b. Verified agent capabilities, and who runs what

Probed on this machine on 2026-09-21. These limits change the division of labour, so they are
binding until re-probed.

| Capability | Backend (`codex`) | Frontend (`agy`) |
|---|---|---|
| Write files in the project | yes | yes, with `--mode accept-edits` |
| Run shell commands | yes | **no**, headless auto-denies the `command` permission |
| Network access | **no** | not reachable, since it cannot run commands |
| Session resume | `codex exec resume <id>` | `agy --conversation <id>` |
| Reports token usage | in transcript | in the JSON result |

Notes on the two blocks:

- **Codex has no usable network.** Without `sandbox_workspace_write.network_access=true` a request
  fails to connect. With it, the host is reachable but PowerShell's own HTTP client fails TLS, so
  package resolution still does not work. The flag is therefore not enabled by default.
- **Agy cannot run commands in headless mode.** Its error names an allow-rule under
  `permissions.allow` in a `settings.json`, but no such file location took effect: a project
  `.agent/settings.json`, a project `.agy/settings.json`, and a user `~/.agy/settings.json` were
  each tried, with several rule spellings, and all were still auto-denied. The documented
  alternative, `--dangerously-skip-permissions`, is on the forbidden list because it auto-approves
  every tool. This is an open item; see `docs/open-questions.md`.

**Consequence.** Agents author source files. The **orchestrator** runs every package manager and
verification command, which it was already doing as Gates 2 and 3. Concretely, the orchestrator
owns `uv lock`, `uv sync`, `npm install`, `tsc --noEmit`, `pytest`, `ruff`, `mypy`, `vite build`,
and Playwright, and it resolves dependency versions and hands exact pins to the agents in the
dispatch prompt. Agents are told explicitly not to attempt those commands and not to claim they
did.

## 3. Gates

The pipeline never advances past a failing gate.

### Gate 1 — Contract enforcement (must pass before any dispatch)

```bash
uv run --with pyyaml --with jsonschema python scripts/validate_contracts.py
```

Must print `OK: 15 checks passed`. Optional second opinion, needs network:

```bash
npx --yes @redocly/cli@latest lint shared/contracts/api-spec.yaml
```

Must report 0 errors. `info-license-strict` is an accepted warning.

The contract is **immutable** for both agents. A change requires: orchestrator approval, an edit to
`api-spec.yaml` *and* `types.ts` *and* an example, a re-run of Gate 1, a `CONTRACT` line in
`tasks/STATUS.md`, and a note in `.ai/HANDOVER.md`. Additive only inside v1.

### Gate 2 — Backend iteration

After each backend dispatch the orchestrator runs and reads:

```bash
uv run ruff check backend
uv run mypy backend/app
uv run pytest backend/tests -q
uv run pytest backend/tests/contract -q
```

Then inspects the generated files for: pydantic validation on every request, `authz.decide` on
every mutation path, adapter-layer exception translation (no SDK exception escaping), explicit
field allowlists in DTO mappers, bounded pagination and SQL limits, honest `meta` and
`allowed_actions`. No task is complete without passing tests.

### Gate 3 — Frontend iteration

```bash
npm --prefix frontend run lint
npm --prefix frontend run typecheck     # tsc --noEmit, zero errors
npm --prefix frontend run test
npm --prefix frontend run build
```

Then inspects: types imported from `@contracts/types` only, all four UI states present
(Idle, Loading, Error, Success), error rendering matched to `shared/contracts/error-codes.md`,
`allowed_actions` gating with visible reasons, `meta.limitations` rendered, no toast-only feedback,
keyboard reachability, 375 px layout.

### Gate 4 — Deep integration review (orchestrator only)

Read the actual diff of both layers and check:

1. **Payload parity** — every field the UI reads exists in the contract and in the backend response.
2. **Security** — no secret in any response, log, fixture, or bundle; no SQL string concatenation;
   no SSRF-reachable host field; no user-token to service-principal fallback; no trust in
   `X-Forwarded-*` alone; authorization rechecked server-side on every mutation.
3. **Race conditions** — stale plan, duplicate submit, concurrent modification, ambiguous timeout
   all handled; no auto-retry of a mutation; no auto-replay after restart.
4. **Honesty** — nothing reports success that did not execute; unknown stays unknown.

A failed review is a **rejection**: the orchestrator writes corrective instructions back to the
same agent, it does not patch the code itself.

## 4. Dispatch format

Every dispatch is one task from `tasks/TASK-BOARD.md`, scoped to one agent, with the prompt
built from this template:

```
ROLE: <Backend|Frontend> Coder for the Unity Catalog Governance app.
READ FIRST (in order): AGENTS.md, <BACKEND|FRONTEND>_INSTRUCTION.md, docs/02-architecture.md,
  shared/contracts/api-spec.yaml (immutable), shared/contracts/types.ts.
TASK: <ID> — <one sentence>.
SCOPE: only these paths: <paths>. Do not edit any other file.
CONTRACT: immutable. If you believe it must change, stop and report; do not edit it.
ACCEPTANCE: <the task's DoD bullets from the instruction file>.
VERIFY BEFORE YOU FINISH: <exact commands>.
REPORT: files changed, commands run with their output summary, anything you could not do.
FORBIDDEN: git, deploy, live Databricks calls, creating cloud resources, reading ..\governance-app\,
  fake success paths, secrets in code or fixtures.
```

Concrete invocation (frontend, present tooling):

```bash
agy --print --model claude-sonnet-4-6 --effort medium --output-format json \
    --add-dir C:\Users\admin\Downloads\uc-governance-app --mode accept-edits \
    --prompt "<the block above>"
```

`scripts/dispatch.ps1` wraps this, reads `.ai/agents.json`, writes a transcript to `.ai/logs/`, and
refuses to run an agent whose status is not `READY`.

`--dangerously-skip-permissions` is forbidden. The orchestrator reviews diffs; it does not
auto-approve them.

## 5. Handover protocol

`.ai/HANDOVER.md` is updated after **every** completed step or dispatch batch. The orchestrator
stops pre-emptively and produces a clean handover after roughly 4 to 5 major dispatch rounds, or
when context is around 80 percent consumed, whichever comes first. The file's structure is fixed:
timestamp, current phase, active task, completed milestones, in-progress and blockers, next
immediate actions, agent configuration log.

A resume begins by reading `.ai/HANDOVER.md`, then the last 30 lines of `tasks/STATUS.md`, then
re-running Gate 1.

## 6. Current blockers to dispatching

| # | Item | Status | Note |
|---|---|---|---|
| 1 | `codex` CLI not installed, and its account is out of tokens (both confirmed 2026-09-21) | **BLOCKING the backend lane** | User requires codex; substitution declined. Install it, restore quota, fill `.ai/agents.json`, dry run, then dispatch |
| 2 | Antigravity ships as `agy`, and `CLAUDE.md` disables the `agy-right-hand` *skill* | **Assumed approved** | The user asked for CLI orchestration; `start project` is read as approval to drive the binary directly on the frontend lane |
| 3 | Deployment questions in `docs/open-questions.md` (cloud, warehouse, Lakebase, account SP, sandbox) | Open | Not needed for Phase 0. Q1 and Q3 change Phase 2 and Phase 4 scope |

## 7. Token exhaustion and resume

An agent running out of tokens mid-task is a **deferral, not a failure**. The machinery:

1. `dispatch.ps1` captures the agent's session id and writes a durable run record to
   `.ai/state/runs/<TaskId>.json`.
2. If the run exits non-zero **and** its output matches a pattern in
   `agents.json → quota_detection.patterns`, the record becomes `quota_exhausted`, the lane's
   `quota.state` flips to `exhausted`, and the script exits **75**, meaning EX_TEMPFAIL.
   The matched pattern is stored as `quota_pattern` so the list can be tightened from evidence.
3. While a lane is `exhausted`, further dispatches to it exit 75 immediately without burning a
   call. The other lane keeps working.
4. `resume.ps1` lists the queue, sends a one-word probe to test whether quota is back, and on
   success re-runs Gate 1 and **resumes the same session** with `codex exec resume <id>` or
   `agy --conversation <id>`. The continuation prompt tells the agent to check what it already
   wrote and finish only what is missing. Attempt count increments; nothing restarts from scratch.
5. If quota is gone again, the queue is left pending and nothing is lost.

Detection deliberately requires a non-zero exit, because this application implements a
`RATE_LIMITED` error code and tests HTTP 429. A successful run mentioning those words must never be
mistaken for exhaustion. If a CLI ever reports exhaustion in unfamiliar wording, set that lane's
`quota.state` to `exhausted` by hand and add the real wording from `.ai/logs/` afterwards.

Commands:

```powershell
./scripts/resume.ps1 -Status            # show the queue, probe nothing
./scripts/resume.ps1 -Agent backend     # probe that lane and continue its pending task
./scripts/resume.ps1                    # probe both lanes and resume everything pending
```

Verified on 2026-09-21 by simulating an exhausted lane: dispatch deferred with exit 75, the queue
listed the task with its session id, and the resume dry run targeted the right session.

## 8. Working with one lane blocked

While the backend lane is blocked, the frontend lane proceeds against the contract and MSW mocks.
This is safe because the frontend never generates types from a running server: it imports
`shared/contracts/types.ts`, and its mocks come from `shared/contracts/examples/`. Sequence
P0-02 (npm half) → P0-04 → P0-05 → P0-10, then Phase 1 UI tasks whose data shapes are already
frozen. The orchestrator does **not** write backend code to fill the gap; doing so would hide the
blocker and break the ownership model.
