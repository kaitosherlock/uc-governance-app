# ORCHESTRATION HANDOVER STATE

- **Timestamp**: 2026-09-22T15:15:00+07:00
- **Current Phase**: Phase 1 — the read spine is complete and verified. Eight read endpoints, the typed API client, the query layer and the MSW mocks all land and pass their gates. The mutation core is in flight.
- **Active Task**: P1-04, mutation core, backend lane, codex at `tier_reasoning`.
- **Deployed**: https://uc-governance-7474654536971820.aws.databricksapps.com (workspace dbc-76001947-638a, mode connected_readonly, RUNNING, redeployed 2026-09-22 15:02 with the Phase 1 read spine).
- **Published**: https://github.com/kaitosherlock/uc-governance-app (public, `main`).
- **Gates**: all eight pass. `./scripts/check_all.sh` reports `All 8 checks passed`.

## 1. COMPLETED MILESTONES

### Contract, Gate 1

- [x] **Contract frozen at v1.0.0** and immutable to both agents: `shared/contracts/api-spec.yaml`, 40 paths, 41 operations, 128 schemas, 21 error codes, plus `types.ts`, 9 examples, `error-codes.md`.
- [x] `scripts/validate_contracts.py`: 15 checks, offline. Redocly: 0 errors, 1 accepted warning. Evidence: `docs/test-results/contract-validation.txt`.
- [x] Gate 1 runs before every dispatch and before every resume. It uses `uv run --no-project`, because the project's own 3.11 pin would otherwise drag orchestrator tooling into the app's interpreter.

### Both agent lanes live and proven

- [x] `codex` at `C:\Users\admin\AppData\Local\Programs\OpenAI\Codex\bin\codex.exe`, logged in via ChatGPT, default model `gpt-6-astra`, tiers by `model_reasoning_effort`.
- [x] Antigravity is the binary **`agy`**; tiers by model id, `--effort` must not be passed.
- [x] **Verified limits that shape the workflow:** codex can run shell commands but has **no network**; agy can edit files but **cannot run shell commands** in headless mode. Therefore the **orchestrator runs every package manager and verification command** and supplies exact version pins inside the dispatch prompt. See `docs/09-orchestration-playbook.md` section 2b, and `docs/open-questions.md` Q11 and Q12.
- [x] Seven harness defects found and fixed by running the thing, not by assuming: PowerShell 5.1 turning CLI stderr into a terminating error, `--config key="value"` splitting at the `=`, `agy --print` swallowing the next flag, `agy` rejecting `--effort`, BOM-laden run records, an unenforced timeout, and two concurrent dispatches clobbering `agents.json`.

### Token-exhaustion resume, the specific requirement

- [x] Every run writes `.ai/state/runs/<TaskId>.json` with its session id, attempt count, and history.
- [x] Exhaustion is a **deferral, not a failure**: status `quota_exhausted`, lane quota flipped, exit **75**, matched pattern stored for later tightening. Detection requires a non-zero exit so that this app's own `RATE_LIMITED` code and 429 tests cannot trigger a false positive.
- [x] A lane marked exhausted short-circuits further dispatches with exit 75 and no wasted call; the other lane keeps working.
- [x] `scripts/resume.ps1` probes whether quota returned, re-runs Gate 1, and continues the **same session** so work is not restarted. Verified against a simulated exhaustion.
- [x] `scripts/dispatch.ps1 -Continue` sends a gate rejection back into the same session. **Used for real**: the frontend's TypeScript defect was fixed as attempt 2 of session `4edfab10`.

### P0-02, dependency manifests, DONE and verified

- [x] Backend authored `pyproject.toml` and `.env.example`. It correctly refused to invent versions when the network was unreachable, which is exactly the instructed behaviour.
- [x] Frontend authored `package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `.gitignore`.
- [x] **Gate 2 PASS**: `uv lock` resolved 70 packages, `uv sync --frozen` succeeded, imports of fastapi, pydantic, databricks.sdk, psycopg and httpx all work, ruff 0.16.8, mypy 2.3.1 and pytest 9.1.1 present, `requirements.txt` exported with hashes. This first required repairing uv's broken managed Python 3.11 install.
- [x] **Gate 3 PASS**: `npm install` added 420 packages, `package-lock.json` written, `npx tsc --noEmit` exits clean.
- [x] **Gate 4 PASS**: no scope violations, no `.git`, no literal secrets in `.env.example`, every npm pin exact.
- [x] `docs/03-technology-decision.md` ratified with real installed versions and the reasons for two deliberate downgrades.

### P0-03 backend scaffold and P0-04 frontend scaffold, DONE and verified

- [x] Backend: 23 modules under `backend/app`, 10 test files. Settings with the fixture-mode
      production guard, typed error envelope, correlation middleware, redaction logging, actor
      resolution behind a Protocol, authz role table, a 57-entry capability registry, the three
      context endpoints, the static mount, and the OpenAPI exporter.
- [x] Frontend: 13 files. Design tokens, `strings.ts`, FQN helpers, scope-aware router, AppShell
      with a skip link and a collapsing rail, presentational ContextBar, flat ESLint config.
      shadcn and Radix were deliberately deferred to P1 rather than adding unused dependencies.
- [x] **Gate 2 clean** on attempt 3: ruff `All checks passed`, mypy `no issues found in 24 source
      files`, pytest **137 passed**.
- [x] **Gate 3 clean** on attempt 4: `tsc --noEmit` clean, `eslint .` clean, `vite build` 1961
      modules producing 357.76 kB of JavaScript, 112.73 kB gzipped.
- [x] **The full stack runs.** Backend started in fixture mode on port 8123 and served the built
      frontend at `/` with HTTP 200. All three API endpoints returned the exact contract envelope.
- [x] **Security behaviour proven by execution, not by assertion:** an inbound `X-Request-Id` is
      echoed into `meta.correlation_id`; an unknown path returns 404 with `NOT_FOUND` and never
      HTTP 200; a cross-site POST is refused with 403; fixture mode refuses to start when
      `DATABRICKS_APP_PORT` or `DATABRICKS_CLIENT_ID` is present; a missing `UCGOV_MODE` fails
      validation.
- [x] **Honest coverage:** `/capabilities` reports 57 capabilities as 43 `not_implemented`,
      11 `not_configured` and only 3 `available`.
- [x] **Contract parity:** 3 of 40 paths implemented, all three present in the frozen contract,
      none invented outside it.
- [x] Two further CLI facts learned and recorded: `codex exec resume` rejects `--sandbox`, `--cd`
      and `--color`, which are inherited from the original session; and agy ends its turn the
      instant any tool needs the denied `command` permission, so its prompts must carry the file
      inventory instead of letting it explore.
- [x] Orchestrator hygiene fixes: removed a stray `backend/tests/.uv-cache` that contained a nested
      `.git`, moved the agent's verification dump into `docs/test-results/`, and added a root
      `.gitignore` so `databricks sync` cannot upload `.venv`, `node_modules`, `dist` or caches.

## 2. IN-PROGRESS / CURRENT BLOCKER

**In flight:** `P1-04`, the mutation core, on the backend lane. It is the single highest-value task
left: P1-05, P2-01, P2-03, P2-04, every P3 task, P4-04 and P5-02 all depend on it. Prompt at
`.ai/prompts/P1-04.md`.

**Resume queue: empty.** `P1-READ` and `P0-05` were both finished by their agents and verified by
the orchestrator, so their run records were moved from `quota_exhausted` to `completed`. Nothing is
waiting to be continued.

**Quota:** the backend lane is OK, confirmed by a live probe at 08:02Z that returned a real answer.
The frontend lane is exhausted; agy reported "Resets in 4h22m" at 07:52Z, so roughly **12:14Z,
19:14 local**. Probe before use; `scripts/resume.ps1` does that automatically and costs nothing when
the lane is still dry.

### Open defect, found by live verification and not yet fixed

**Connected mode rejects every real user with `IDENTITY_MISMATCH`.** `backend/app/auth/actor.py`
compares `X-Forwarded-User` against `current_user.me().id`. Those are different identifier spaces:
`docs/04-databricks-apps-constraints.md` line 64 records that the header carries the **IdP** user
identifier, while the SCIM id is the **Databricks** user id, so the comparison can essentially never
succeed. Evidence: in a browser session the platform had already authenticated, the SPA shell loaded
but `GET /api/v1/context` returned 401 with that code. The email cross-check is sound and must stay;
only the identifier comparison is wrong. Fix prompt is written at `.ai/prompts/P1-01-FIX.md` and is
queued behind P1-04 on the backend lane.

The frontend behaved correctly throughout that failure: it rendered the mapped error with
`next_steps` and the correlation id in a `<details>`, and refused to fabricate a context.

### Three more harness defects of my own, found and fixed earlier today

- `Build-Invocation` rendered `{lastmsg}` as an empty string when no last-message file was passed,
  leaving `--output-last-message` dangling; codex then exited 2 before reaching the API, so every
  backend quota probe died in a way that *looked* like a quota problem.
- `resume.ps1` probed with the `tier_utility` model but resumed at the task's own tier. agy quota is
  **per model**: `gemini-3.8-flash-medium` answered READY while `gemini-3.1-pro-high` was still
  exhausted, so the probe said "quota is back" and the real resume burned a call and failed.
- `resume.ps1` ignored `.ai/prompts/<TaskId>-resume.md` and sent a generic continuation whose step 4
  told the agent to re-run the verification commands — on the agy lane, precisely the action that
  ends the turn with nothing written.

### A misdiagnosis of my own, corrected

Gate 3 rejection 2 for P0-05 told the agent that a duplicate-match test failure came from an
outer/inner span text ambiguity. It did not. `vitest.config.ts` sets `globals: false`, so
`@testing-library/react` cannot register its automatic cleanup and every `render()` accumulated in
one document until a query matched one element per preceding test. The agent cannot run tests and so
could never have found this; it implemented my wrong diagnosis faithfully. Fixed with
`frontend/vitest.setup.ts` plus a `setupFiles` entry. The accessibility work the agent did in
response is kept on its own merit: actor and executor now carry accessible names saying which is the
person and which is the executing service principal.

## 2b. CONCURRENCY

A scheduled resume session fired at 14:34 and was still running when the user resumed interactively.
Two orchestrators driving the same lanes would double-spend the binding resource and could send two
prompts into one agent session, so the scheduled session was stopped **after** its in-flight
dispatch completed rather than mid-write. Everything it landed is kept. Do not run a scheduled
continuation and an interactive session against this repo at the same time.

## 3. NEXT IMMEDIATE ACTIONS

1. When P1-04 returns, run `./scripts/check_all.sh`. Send any failure back into the same session
   with `./scripts/dispatch.ps1 -Agent backend -Tier tier_reasoning -TaskId P1-04 -PromptFile <reject> -Continue`.
2. Dispatch **P1-01-FIX** on the backend lane, prompt already written. Then redeploy and re-verify
   in a real browser session, which is the only place that defect reproduces.
3. Dispatch **P1-05** (plan kinds: grant, revoke, transfer ownership, edit metadata) on the backend
   lane at `tier_reasoning`. It plugs into the registry P1-04 defines.
4. When the frontend lane's quota returns, dispatch **P1-06** at `tier_standard`; the prompt is
   written at `.ai/prompts/P1-06.md` and already carries the file inventory and the no-shell rule.
   Then P1-07, the Access tab.
5. P0-07 is half done. `scripts/check_all.ps1` and `.sh` exist and run all eight gates; what is still
   missing is `frontend/playwright.config.ts` and an `e2e/` directory, so the e2e and axe gates
   cannot run. That half is frontend-lane work.
6. Update this file after every dispatch batch.

```powershell
./scripts/dispatch.ps1 -Agent backend  -Tier tier_reasoning -TaskId P1-04      -PromptFile .ai/prompts/P1-04.md
./scripts/dispatch.ps1 -Agent backend  -Tier tier_reasoning -TaskId P1-01-FIX  -PromptFile .ai/prompts/P1-01-FIX.md
./scripts/dispatch.ps1 -Agent frontend -Tier tier_standard  -TaskId P1-06      -PromptFile .ai/prompts/P1-06.md
./scripts/resume.ps1 -Status
./scripts/check_all.sh
```

## 4. AGENT CONFIGURATION LOG

| Agent | CLI | Status | Model by tier | Quota |
|---|---|---|---|---|
| Backend Coder | `codex` | quota resets 14:32 local | `gpt-5.6-terra` at effort high / medium / low |
| Frontend Coder | `agy` | exhausted later than codex; probe before use | `gemini-3.1-pro-high` / `gemini-3.8-flash-high` / `gemini-3.8-flash-medium` |

Dispatch history: 2 smoke runs per lane, 3 backend dispatches, 4 frontend dispatches including one
`-Continue` rejection. Observed cost: roughly 6k to 15k tokens per codex run, roughly 20k to 45k per
agy run because it loads more project context. No run has yet hit a quota limit, so the exhaustion
path has been proven by simulation rather than by a live event; the pattern list in
`.ai/agents.json` should be tightened the first time a real one occurs.

Sandbox: codex runs `--sandbox workspace-write`, agy runs `--mode accept-edits`. Forbidden on both:
`--dangerously-bypass-approvals-and-sandbox`, `--dangerously-bypass-hook-trust`,
`--dangerously-skip-permissions`. `Build-Invocation` throws if a template contains one.
