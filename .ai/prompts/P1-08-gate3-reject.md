CONTINUE task P1-08. `vite build` succeeds and **68 of 74 tests pass**. There are four things to
fix, and two of them are mistakes in the dispatch prompt I gave you, not in your work.

**Rules unchanged: one file at a time, never in parallel, never a shell command.**

## A. The six test failures have ONE cause, and your component is right

Five tests fail because the execute result never appears, and the sixth fails a disabled-state
assertion. All six trace to the same line in `PlanFlow.tsx`:

```tsx
if (!plan || isExecuting || isExpired) return;
```

The frozen fixture `shared/contracts/examples/PlanResponse.grant-preview.json` carries

```json
"observed_at": "2026-09-21T09:05:30Z",
"expires_at":  "2026-09-21T09:15:30Z"
```

and today is **2026-09-22**. Every plan built from that fixture is already expired, so `isExpired`
is true, `handleExecute` returns immediately, nothing is ever sent, and no result panel renders.
The confirm control is likewise disabled, which is the "expected true to be false" failure.

**Refusing to execute an expired plan is correct and must not change.** Do not relax that guard, do
not special-case tests, and do not edit the fixture — it is part of the frozen contract.

Fix the **tests**: pin the clock to the fixture's own timeline. In that test file, before rendering,
use vitest's fake timers to set the system time to just after `observed_at` and before
`expires_at` — for example `2026-09-21T09:06:00Z` — and restore real timers afterwards. Then the
plan is live and the flow runs as designed. Your countdown-to-`expires_at` will also be exercised
properly, which it currently never is.

Note this is a trap for every future test that uses a time-bearing fixture verbatim, so put a short
comment in the test file saying why the clock is pinned.

## B. Type error on the execute request

```
src/features/plans/PlanFlow.tsx(301,9): error TS2375:
  Type '{ confirmation_token: string; typed_name: string | undefined; }' is not assignable to
  type 'PlanExecuteRequest' with 'exactOptionalPropertyTypes: true'.
  Type 'undefined' is not assignable to type 'string | null'.
```

The contract declares `typed_name` as `string | null`, not optional-undefined. So send `null`:

```tsx
typed_name: plan.requires_typed_confirmation ? typedConfirmationValue : null,
```

## C. `any` in the mocks

```
src/mocks/handlers.ts  949:15  error  Unexpected any  @typescript-eslint/no-explicit-any
```

`let body: any = {};` — type it from the contract instead, `PlanCreateRequest` or `unknown` with a
narrowing check. Do not add an eslint-disable.

## D. My prompt named error codes that do not exist — use the contract

This is my error and you partly caught it already: you wrote
`(err.code as string) === "DUPLICATE_OPERATION"`, which is a cast around a code the contract does
not define. Remove that cast and follow `shared/contracts/error-codes.md`, which is authoritative:

| Code | Meaning | Required treatment |
|---|---|---|
| `PLAN_STALE` | observed state moved | "Preview outdated — regenerate", keep form values |
| `PLAN_EXPIRED` | past `expires_at` | "Preview outdated — regenerate", keep form values |
| `PLAN_INVALIDATED` | **superseded by a newer plan** | "A newer preview replaced this one" |
| `PLAN_TAMPERED` | **HMAC mismatch** | generic conflict **plus correlation id**, and log it |
| `DUPLICATE_SUBMISSION` | execute called while an operation for this plan is running | show the existing operation |

Two corrections to what I told you:

1. I said `PLAN_INVALIDATED` should render "Preview outdated — regenerate". It should not. It means a
   newer preview replaced this one, which is a different situation and deserves its own wording.
2. `PLAN_TAMPERED` must **not** be presented as a routine "regenerate". An HMAC mismatch means the
   plan came back altered. Show the generic conflict message with the correlation id so it can be
   investigated, and do not invite the user to simply try again as though nothing happened.

`DUPLICATE_SUBMISSION` is the only duplicate code; delete the `DUPLICATE_OPERATION` branch.

Put the new strings in `strings.ts`, and make sure `errors.ts` / `describeError` covers all five
codes so none falls through to a generic message.

## Then

In your report, confirm which P1-08 requirements are complete, in particular: `impact.unknown`
visible without interaction, `statement_preview` only inside Details with `description` prominent,
the identity block naming the executing service principal, typed confirmation exact and
case-sensitive, 202 rendering the unknown-outcome state with Retry disabled until reconcile returns,
`partially_applied` never presented as success, editing a field after preview collapsing the
preview, and `Esc` not dismissing a destructive confirmation.

## Scope, unchanged

Only `frontend/src/**`, plus an append to `tasks/STATUS.md` and your row in `tasks/TASK-BOARD.md`.
No dependency changes. Never run git. Do not claim you ran any command.
