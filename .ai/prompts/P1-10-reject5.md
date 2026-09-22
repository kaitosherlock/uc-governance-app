CONTINUE task P1-10. The scenario scoping worked — journey 3 now reaches the Outcome Unknown state,
which it never could before. tsc, eslint, vitest and the build are all clean, and journeys 1 and 2
drive the product with axe passing. **3 of 5 specs pass.** Two assertion problems left, both in the
specs.

**Rules unchanged: one file at a time, never in parallel, never a shell command.**

## 1. The "no toast" check is matching a legitimate live region

```
FAIL  Journey 1
expect(locator).toHaveCount(expected) failed
Locator: locator('[role=\'status\'], .toast, [data-sonner-toaster]')
```

`role="status"` is **not** a toast. The only element in the app using it is the completeness notice
in `StateViews.tsx`, which tells the user the data they are looking at may be incomplete. That
notice is one of the things this application exists to show, and a test that demands it be absent is
asserting the opposite of the requirement.

For the record: no toast library is installed at all — there is no `sonner`, no toast dependency of
any kind — so a toast cannot appear.

Fix the assertion to mean what the requirement means. `FRONTEND_INSTRUCTION.md` says *no toasts as
the only feedback*; the point is that the outcome is **in the page and stays there**. So:

- drop `[role='status']` from that selector entirely;
- keep the check that no transient toast container exists, if you want it;
- and assert the substantive thing instead: after execution, the result region is visible, and it is
  **still** visible after a short wait, proving it persists rather than auto-dismissing.

That last assertion is the one that actually protects the behaviour.

## 2. Journey 3 — "Outcome Unknown" appears three times

```
strict mode violation:
  getByRole('dialog', { name: 'Grant Privileges' }).getByText('Outcome Unknown')
  resolved to 3 elements
```

The string appears in more than one place in the outcome region — a heading, a status line, and
likely an aria-label. All legitimate.

Address the heading specifically: `getByRole("heading", { name: strings.planFlow.outcome.unknownTitle })`,
or scope to the outcome region by its "Execution Outcome" heading and assert within it. No
`.first()`, no `.nth()`.

## Then confirm journey 3 end to end

This will be the first run where it completes. Verify it proves all four:

- the outcome-unknown state renders after HTTP **202**;
- **Retry is disabled**;
- **Check current state** is the only forward action;
- the reconciled status replaces the unknown state, and execute was called **exactly once** with no
  automatic retry.

If any is asserted weakly, strengthen it now.

## Scope

`frontend/e2e/**` and `screenshots/**`, plus an append to `tasks/STATUS.md` and your row in
`tasks/TASK-BOARD.md`. Do not edit `frontend/src/**` this round — the product is correct here, the
assertions are not. Do not edit `playwright.config.ts`, `tsconfig.json`, `package.json`,
`shared/contracts/`, `backend/`, `scripts/` or `.ai/`. Never run git. Do not claim you ran Playwright.
