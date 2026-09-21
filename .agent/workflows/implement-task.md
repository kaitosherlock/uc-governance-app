---
description: Claim and implement one task from tasks/TASK-BOARD.md end to end
---

1. Open `tasks/TASK-BOARD.md`. Pick the lowest-numbered task whose `Status` is `todo`, whose
   `Owner` is `antigravity` or `either`, and whose `Depends on` tasks are all `done`.
2. Set its `Status` to `in_progress`, `Owner` to `antigravity`, `Started` to today's date.
   Append `YYYY-MM-DD HH:MM antigravity START <TASK-ID> — <one line>` to `tasks/STATUS.md`.
3. Read the spec sections listed in the task's `Spec` column and the contract sections in
   `docs/02-architecture.md` it references.
4. Confirm the contract gate is green: `npm run contract:check` in `frontend/`, or
   `uv run --with pyyaml --with jsonschema python scripts/validate_contracts.py` from the root.
   Types come from `@contracts/types`; nothing is generated from a running server.
5. Implement the task in `frontend/**` with unit tests (Vitest) and, when the task says so, a
   Playwright spec in `frontend/e2e/`.
6. Start the backend in fixture mode if not running:
   `uv run uvicorn app.main:create_app --factory --app-dir backend --port 8000` with
   `UCGOV_MODE=fixture` and `UCGOV_FIXTURE_ACTOR=alice.steward`. Open the app in the browser.
7. Verify by hand: keyboard-only navigation, 375 px and 1440 px widths, long FQN, reduced motion.
   Save screenshots to `screenshots/synthetic-<screen>-<width>.png`.
8. Run `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`. Fix everything.
9. Fill the task's `Evidence` cell with test command summaries and screenshot paths. Set `Status`
   to `done` (or `blocked` with the exact blocker). Append a `DONE`/`BLOCKED` line to `STATUS.md`.
10. Do not claim a second task until step 9 is complete.
