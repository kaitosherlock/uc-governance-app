CONTINUE task P2-06. Good progress: **9 failures down to 3**, 91 passing up to **97**. `tsc`,
`eslint`, `vite build`, all 5 Playwright e2e specs and every backend gate are green. Your Class B
and Class C fixes landed correctly, and I verified by reading the file that the impact-panel test
still carries every assertion it started with — you added a click and waits, you removed nothing.
That was the right move.

Three left. Two are one bug, and the third is a trap that has already cost this project time.

**Rules unchanged: one file at a time, never in parallel, never a shell command.**

## 1. The policy-row query matches three buttons, not one (2 failures)

```
PoliciesView.test.tsx  renders ABAC policies list, ...        Found multiple elements with the role "button" and name `/filter_sales_internal/`
PoliciesView.test.tsx  impact panel renders disclaimer ...    Found multiple elements with the role "button" and name `/filter_sales_internal/`
```

Both come from the selection click you added:

```js
const policyBtn = screen.getByRole("button", { name: new RegExp(policy.name) });
```

`PoliciesView.tsx` renders **three** buttons per row that all contain the policy name. The row
button's accessible name begins with it, and the two sibling quick actions carry explicit labels
(lines 199 and 208):

```jsx
aria-label={`${strings.policies.editPolicyButton} ${policy.name}`}
aria-label={`${strings.policies.deletePolicyButton} ${policy.name}`}
```

An unanchored `RegExp(policy.name)` is a substring match, so it hits all three.

Pick the row button by something that actually distinguishes it. The row button is the one carrying
`aria-current`, so `getByRole("button", { current: true })` scoped to the list says what you mean.
An accessible name anchored at the start — `new RegExp(\`^${policy.name}\`)` — also works, because
the quick actions' names begin with their verb. Either is fine. No `.first()`, no `.nth()`, no test
ids, and do not change the `aria-label`s: naming the policy in the Edit and Delete labels is what
tells a screen reader user *which* policy the icon button acts on, and dropping it to make a test
pass would remove real information from the UI.

While you are in that file, check whether the click is needed at all. If the first policy is already
selected on load, keep the click anyway — it proves selection works — but make sure the assertions
that follow are the ones that matter.

## 2. The plan is expired before the test can confirm it (1 failure)

```
OwnershipTransfer.test.tsx:91
AssertionError: expected true to be false
  expect(confirmBtn.hasAttribute("disabled")).toBe(false)
```

This is **not** a typed-confirmation bug — your `{value}` fix was right, and the prompt assertion
above it now passes. The button is disabled for a different reason.

`handlers.ts:1452` builds the `transfer_ownership` plan by spreading `planPreviewFixture.data`, which
is the frozen contract example `shared/contracts/examples/PlanResponse.grant-preview.json`. That
example carries fixed timestamps:

```
"created_at": "2026-09-21T09:05:30Z",
"expires_at": "2026-09-21T09:15:30Z"
```

Today is past that window, so `PlanFlow.tsx:328` computes `isExpired === true`, and
`PlanFlow.tsx:1434` reads:

```jsx
disabled={isExecuting || isExpired || isTypedConfirmDisabled}
```

The confirm button can never enable, whatever is typed. The assertion is correct and the component is
correct; the test is running outside the fixture's own validity window.

**Pin the clock into that window**, the same way the Playwright suite already does — `e2e/harness.spec.ts`
exists specifically to prove the browser clock must be pinned into `09:05:30Z–09:15:30Z` or every
preview is pre-expired. Do the unit-test equivalent in this spec: set the system time to a moment
inside the window, for example `2026-09-21T09:06:00Z`, before rendering, and restore real time
afterwards. If you use Vitest fake timers, enable them so they still advance
(`vi.useFakeTimers({ shouldAdvanceTime: true, now: ... })`), because PlanFlow runs a countdown and
`waitFor` will otherwise hang.

Do **not** change `expires_at` in the frozen contract example, and do not remove the `isExpired`
term from the disabled expression. A preview that can still be executed after it has expired is the
defect this whole plan lifecycle exists to prevent.

Then check every other spec that reaches a plan preview for the same latent problem. Any test that
asserts on execution, expiry countdown or the confirm button is living on the same borrowed time and
will start failing on a day nobody changed any code.

## Report

Name the two files you changed and the approach you took for each. State explicitly whether you kept
the selection click in `PoliciesView.test.tsx` and why, and list any other spec you pinned the clock
in.

## Scope, unchanged

Only `frontend/src/**`, plus an append to `tasks/STATUS.md` and your row in `tasks/TASK-BOARD.md`.
Do not edit `shared/contracts/`, `frontend/e2e/**`, `playwright.config.ts`, `tsconfig.json`,
`package.json`, `backend/`, `scripts/` or `.ai/`. Add no dependency. Never run git. Do not claim you
ran any command.
