CONTINUE task P1-10. Both product fixes landed correctly: the privilege `<select>` and the other
form controls now have real associated `<label htmlFor>` elements, and `?scenario=` propagation is
wired in `client.ts`, dev-gated, read from `window.location` at request time. Journeys 1 and 2 drive
the product, axe passes on the views it reaches, and vitest and the build are clean.

Four things left. Two are consequences of the scenario mechanism now actually working, which is
progress, and two are type and lint issues in the spec files.

**Rules unchanged: one file at a time, never in parallel, never a shell command.**

## 1. The scenario is global, and that breaks the journey it was added for

```
FAIL  Journey 3
Locator: getByRole('table', { name: 'Grants' })
Error: element(s) not found
```

Journey 3 opens `?scenario=unknown-outcome`, which now propagates to **every** request. In
`src/mocks/handlers.ts`, `handleScenario` runs first on every handler and returns:

```ts
if (scenario === "unknown-outcome") {
  return HttpResponse.json(operationUnknownOutcome, { status: 202 });
}
```

So `GET /assets/TABLE/sales.crm.orders/grants` answers with an Operation payload and HTTP 202. The
grants table never renders, and the journey cannot reach the mutation it is meant to exercise.

This is a design flaw in the scenario mechanism, not in your spec. Fix it in `handlers.ts`.

Scenarios fall into two groups and must be treated differently:

- **Transport-level, meaningful on any endpoint:** `slow`, `forbidden`, `not-configured`,
  `validation`. Keep applying these everywhere.
- **Mutation-lifecycle, meaningful only on the plan and operation endpoints:** `unknown-outcome`,
  `stale`, `expired`, `invalidated`, `duplicate`. A read endpoint must **ignore** these and serve
  its normal payload, otherwise it is impossible to navigate to the screen where the mutation
  happens.

Give `handleScenario` enough information to know which group applies — pass the endpoint kind, or
split it into two helpers and call the right one from each handler. Do not special-case by URL
string matching inside the helper; make it explicit at the call site so a future handler cannot
forget.

## 2. Journey 1 — a name that appears four times inside the dialog

```
strict mode violation:
  getByRole('dialog', { name: 'Grant Privileges' }).getByText('sales.crm.orders')
  resolved to 4 elements
```

The object's fully-qualified name legitimately appears several times in the preview: in the
normalized change, the statement preview, the target row and the impact list. That is correct.

Assert the one you actually mean. Scope to the specific region first — the normalized change, or the
per-target outcome row — then assert the name within it. If what you want to prove is "the preview
names the object being changed", say that precisely by locating the normalized change and asserting
its text. Do not use `.first()` or `.nth()`.

## 3. The spec files break `tsc --noEmit`

```
e2e/grant-privilege.spec.ts(3,18): Cannot find name 'node:path'
e2e/grant-privilege.spec.ts(4,16): Cannot find name 'node:fs'
e2e/grant-privilege.spec.ts(7,13): Cannot find name 'process'
   ... the same in the other two specs
```

`tsconfig.json` includes `e2e`, and `@types/node` is deliberately **not** installed — this is browser
code and pulling Node globals into the same type environment would hide real errors in `src`.

You do not need those imports. Playwright's `page.screenshot({ path })` resolves a relative path
against the working directory and **creates missing parent directories itself**, so drop
`node:path`, `node:fs` and `process.cwd()` entirely and pass a plain relative path such as
`"../screenshots/synthetic-grant-preview-1440.png"`.

Do not add `@types/node`, do not add a second tsconfig, and do not add a dependency.

## 4. `any` in all three specs

```
grant-privilege.spec.ts        12:41 and 28:34   Unexpected any
inherited-grant-source.spec.ts 12:41 and 28:34   Unexpected any
unknown-outcome-reconcile.spec.ts 12:41 and 28:34 Unexpected any
```

Your `captureScreenshots(page: any, ...)` and `runA11yScan(page: any, ...)` helpers. Import the real
type: `import type { Page } from "@playwright/test";` and use `Page`. No eslint-disable.

Since the same two helpers are duplicated across all three specs, move them into a single shared
file under `frontend/e2e/` and import them, so the next fix happens once rather than three times.

## Then

With the scenario scoping fixed, journey 3 will finally run end to end. Confirm it proves all four
of: the outcome-unknown state renders after HTTP 202, Retry is disabled, Check current state is the
only forward action, and the reconciled status replaces the unknown state with execute called
exactly once.

## Scope

`frontend/e2e/**`, `screenshots/**`, and `frontend/src/mocks/handlers.ts` for the scenario scoping,
plus an append to `tasks/STATUS.md` and your row in `tasks/TASK-BOARD.md`. Do not edit
`playwright.config.ts`, `tsconfig.json`, `package.json`, `shared/contracts/`, `backend/`, `scripts/`
or `.ai/`. Add no dependency. Never run git. Do not claim you ran Playwright.
