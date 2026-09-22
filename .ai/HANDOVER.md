# ORCHESTRATION HANDOVER STATE

- **Timestamp**: 2026-09-22T15:05:00+07:00
- **Current Phase**: Phase 1 read path COMPLETE and Gate 2 verified. P0-02, P0-03, P0-04, P0-06, P0-08, P1-01, P1-02, P1-03 all done. P0-05 is the only task in flight.
- **Active Task**: P0-05 frontend, in_progress with UNVERIFIED edits in the working tree, uncommitted. Backend lane out of quota again after landing its work.
- **Deployed**: https://uc-governance-7474654536971820.aws.databricksapps.com (workspace dbc-76001947-638a, mode connected_readonly, RUNNING).
- **Published**: https://github.com/kaitosherlock/uc-governance-app (public).

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

### The one thing to do first on resume

`P0-05` has rejection-round-2 edits sitting UNCOMMITTED and UNVERIFIED in `frontend/`. Run Gate 3
before anything else, then commit if green:

```
cd frontend
npx tsc --noEmit
npx eslint .
npx vitest run
npx vite build
```

Last measured state, after rejection round 1: `tsc` exit 0, `eslint` exit 0, vitest **37 of 38**.
The single failure was `TestingLibraryElementError: Found multiple elements with the text:
alice.steward@example.com` at `ContextBar.test.tsx:78`, because the outer span and the inner span
both normalise to the same text. Round 2 fixed that at the source rather than papering over it: the
actor and executor spans now carry `aria-label`s (7 in the file, up from 5) with the strings in
`strings.ts`, and the test queries by `getByLabelText`. That also closed a genuine accessibility
gap — a screen reader previously read two bare principal names with no way to tell the person from
the service principal. **Verify it; do not assume it.**

If Gate 3 is green, commit `frontend/` and `tasks/`, mark P0-05 done, and push.
If it is not, write the next rejection to `.ai/prompts/P0-05-gate3-reject3.md` and dispatch with
`-Tier tier_utility -Continue`.

### What passed its gates this session

- **Gate 1**: `OK: 15 checks passed`, run three times.
- **Gate 2 PASS**: ruff `All checks passed` (was 227 errors), mypy `Success: no issues found in 52
  source files` (was 4 errors, including the P0-08 `introspect_sdk.py:149` SimplePath vs Path),
  pytest **342 passed** (was 308). Committed and pushed as `362c49f`.
- **Gate 2 live proof**, run by the orchestrator rather than asserted: fixture mode returns 200 with
  the contract envelope; `allowed_actions` are honest, with grant, edit_metadata and
  transfer_ownership all `NOT_IMPLEMENTED` because the plan lifecycle does not exist yet; the grants
  endpoint reports `group_membership_loaded: false` with the exact required limitation sentence and
  refuses revoke on every inherited grant with `INHERITED_FROM_PARENT` plus a `navigate_to`.
- **Fixture dataset** counted from the built readers: 3 catalogs, 12 schemas, 60 objects across all
  required kinds, 25 principals with exactly 1 workspace-local group that is not UC eligible.

### Quota state, both lanes

| Lane | Model | State |
|---|---|---|
| backend, codex | `gpt-5.6-terra` | **exhausted**, hit at the END of the run after the work had landed. Session `01a0c746` preserved, P1-READ record is `quota_exhausted`. Gate 2 nevertheless passes on the code it wrote, so nothing is outstanding but the quota itself |
| frontend, agy | `gemini-3.1-pro-high` / `gemini-3.8-flash-high` | **exhausted**, resets about 4h20m from 07:45 UTC |
| frontend, agy | `gemini-3.8-flash-medium` | had quota as of 07:53 UTC and carried both rejection rounds |

**Quota on the agy lane is PER MODEL.** This was proven, not guessed: flash-medium answered READY
while pro-high returned RESOURCE_EXHAUSTED in the same minute. Probe the model you intend to use.

### Three harness defects found and fixed, my own code

1. `Build-Invocation` rendered an empty `{lastmsg}` as a dangling `--output-last-message`, so every
   codex quota probe exited 2 before reaching the API. The first backend resume reported "probe
   failed", which reads like a quota problem and was not one.
2. `resume.ps1` probed with the `tier_utility` model but resumed at the task's own tier, so the
   per-model quota above made the probe lie and the resume burn a call. It now probes the highest
   tier actually pending on that lane.
3. `resume.ps1` ignored `.ai/prompts/<TaskId>-resume.md` and sent a generic continuation whose step
   4 told the agent to re-run the verification commands — precisely what ends an agy turn with
   nothing written. Per-task resume prompts now win, and the run record stores the model actually
   used rather than one cached before a model switch.

### Still open

- 39 tasks remain todo. Next by priority: **P1-04 and P1-05** the mutation plan lifecycle, then
  P0-07, P0-09, P0-10, then P1-06 and P1-07 the asset and access UI, then Phase 2.
- `P0-01` is still todo and unrelated to the above.
- The deployed app at https://uc-governance-7474654536971820.aws.databricksapps.com is running the
  PREVIOUS build. The Phase 1 read path is committed but **not deployed**.

## 2b. SCHEDULED CONTINUATION

A persisted one-shot task `uc-governance-resume` fires at **2026-09-22T14:34:00+07:00**, two minutes
after codex's stated reset of 2:32 PM. It re-enters this work with a self-contained prompt, because
scheduled runs start with no memory of this session. It resumes the backend first, then probes the
frontend, then continues down the task board. Managed from the Scheduled section of the sidebar.

## 3. NEXT IMMEDIATE ACTIONS (RESUME PROMPT)

1. Confirm Gate 1: `uv run --no-project --with pyyaml --with jsonschema python scripts/validate_contracts.py` must print `OK: 15 checks passed`.
2. Dispatch **P0-05** at `tier_standard`, frontend. The prompt is already written at `.ai/prompts/P0-05.md`. Before dispatching, prepend the agy file inventory the way `.ai/prompts/P0-04-continue.md` does, listing what exists under `frontend/src`, otherwise the agent will try to explore and lose its turn.
3. Gate 3, then Gate 4. Expect at least one rejection round; that is normal and cheap through `-Continue`.
4. Dispatch **P0-06** at `tier_standard`, backend: the fixture dataset and the fixture adapters implementing the same Protocols as the future SDK adapters, plus the scenario switches.
5. Dispatch **P0-08** at `tier_reasoning`, backend: copy `docs/05-capability-matrix-starter.md` to `docs/capability-matrix.md`, then introspect the installed `databricks-sdk` 0.140.0 to confirm or deny every candidate method, filling `unknown` with confirmed names or `unsupported`. This unblocks all of Phase 1.
6. Then P0-07, P0-09, P0-10, then Phase 1 per `tasks/TASK-BOARD.md`.
7. Update this file after every dispatch batch.

```powershell
./scripts/dispatch.ps1 -Agent backend  -Tier tier_reasoning -TaskId P0-03 -PromptFile .ai/prompts/P0-03.md
./scripts/dispatch.ps1 -Agent frontend -Tier tier_standard  -TaskId P0-04 -PromptFile .ai/prompts/P0-04.md
./scripts/dispatch.ps1 -Agent frontend -Tier tier_utility   -TaskId P0-04 -PromptFile .ai/prompts/P0-04-fix.md -Continue
./scripts/resume.ps1 -Status
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
