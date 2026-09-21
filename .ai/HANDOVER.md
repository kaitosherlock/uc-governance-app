# ORCHESTRATION HANDOVER STATE

- **Timestamp**: 2026-09-21T17:10:00Z
- **Current Phase**: Phase 0 — Foundations. P0-02, P0-03 and P0-04 complete and verified. The application runs.
- **Active Task**: none in flight. Next is P0-05 (API client and mocks), then P0-06 (fixtures) and P0-08 (capability matrix).

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

Nothing in flight. No blocker to the next dispatch.

Open items that do not block Phase 0:

- **Q11**, agy cannot be granted the `command` permission. Tried `.agent/settings.json`, `.agy/settings.json`, `~/.agy/settings.json` with several rule spellings; all still auto-denied. `--dangerously-skip-permissions` is refused as too broad. Workaround in place: the orchestrator runs frontend commands.
- **Q12**, codex has no usable network. `sandbox_workspace_write.network_access=true` makes the host reachable but PowerShell's HTTP client then fails TLS. Workaround in place: the orchestrator resolves versions and supplies pins.
- **Environment note**: uv's managed Python 3.11 cannot create its minor-version symlink on this machine, probably a privilege issue. The interpreter itself is installed and usable, so `uv lock` and `uv sync` work. Do not "fix" this by widening `requires-python`; production is 3.11.
- **eslint 9 is flagged unsupported by npm.** Kept deliberately so that jsx-a11y accessibility linting survives. Revisit when jsx-a11y supports eslint 10.
- Deployment questions Q1 to Q8 remain open and change Phase 2 and Phase 4 scope, not Phase 0.

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
| Backend Coder | `codex` | READY | `gpt-6-astra` at effort high / medium / low | ok |
| Frontend Coder | `agy` | READY | `claude-opus-4-6-thinking` / `claude-sonnet-4-6` / `gemini-3.8-flash-medium` | ok |

Dispatch history: 2 smoke runs per lane, 3 backend dispatches, 4 frontend dispatches including one
`-Continue` rejection. Observed cost: roughly 6k to 15k tokens per codex run, roughly 20k to 45k per
agy run because it loads more project context. No run has yet hit a quota limit, so the exhaustion
path has been proven by simulation rather than by a live event; the pattern list in
`.ai/agents.json` should be tightened the first time a real one occurs.

Sandbox: codex runs `--sandbox workspace-write`, agy runs `--mode accept-edits`. Forbidden on both:
`--dangerously-bypass-approvals-and-sandbox`, `--dangerously-bypass-hook-trust`,
`--dangerously-skip-permissions`. `Build-Invocation` throws if a template contains one.
