CONTINUE task P2-06. This supersedes the previous rejection. The two build errors it listed are
**already fixed** — `src/mocks/fixtures.ts` now uses `edit_metadata` and the unused `AssetSummary`
import is gone. Do not touch those again.

Current state, measured: `tsc` clean, `eslint` clean, `vite build` clean, Playwright e2e **5 of 5
pass**, backend gates all green. The only failing gate is `vitest`: **9 failed, 91 passed**. Every
one of the nine is in a test file you wrote, and none of them is a product defect. Three classes.

**Rules unchanged: one file at a time, never in parallel, never a shell command.**

## Class A — the ABAC detail inspector needs a policy to be selected (2 failures)

```
PoliciesView.test.tsx:53  Unable to find an element with the text: sales (CATALOG)
PoliciesView.test.tsx    Unable to find an element with the text: Potentially Affected Assets (Approximation)
```

Both tests render `PoliciesView`, `await waitFor` the policy **name** in the list, and then assert
on the right-hand inspector. But `PoliciesView.tsx:344` renders
`{policy.scope.full_name} ({policy.scope.securable_type})` inside the **detail panel**, and the
list row at line 184 renders only the full name. The detail panel and the impact panel are not in
the DOM until a policy is selected, so both assertions run against a screen that legitimately does
not show them yet.

Fix the tests, not the component. Select the policy the way a person would — the rows are native
`<button>` elements with `aria-current`, so click the one named `policy.name` — then `waitFor` the
inspector and the impact query to resolve before asserting.

**The impact-panel test must not be weakened.** It asserts that the disclaimer renders adjacent to
the list and that the panel is *not* titled "Effective access", "Who has access" or "Simulated
result". That is the guarantee that this application never implies Databricks evaluated a policy.
Keep every one of those claims exactly as written, including the `impact-disclaimer` container and
the `potentially_affected` list. You are adding a click, not removing an assertion.

## Class B — assertions typed from memory instead of read from the source (3 failures)

```
PoliciesView.test.tsx:191          Unable to find: /ABAC policies reflect catalog metadata/
AssetRowAccessView.test.tsx:174    Unable to find: /Row filters and column masks reflect table metadata/
OwnershipTransfer.test.tsx:73      Unable to find: /Type {value} exactly to confirm this change:/
```

1. `PoliciesView.test.tsx:191` — pure drift. `abacPoliciesFixture.meta.limitations[0]` is
   `"Policy definitions reflect catalog metadata. Effective evaluation depends on SQL compute
   runtime."` Assert `abacPoliciesFixture.meta.limitations[0]`, never a retyped regex.

2. `AssetRowAccessView.test.tsx:174` — this one is different and needs a judgement call.
   `rowAccessOrdersFixture.meta.limitations` is `[]`, so **no banner can render** and no rewrite of
   the query will make it appear. The test's own name promises "success with limitations". Resolve
   it by giving `rowAccessOrdersFixture` a truthful limitation that a real metadata read would carry
   and asserting `meta.limitations[0]`, or by driving the state from a fixture that already has one.
   Do **not** make the view synthesise a limitation the API did not send — a completeness notice the
   server did not issue is a false statement about the data.

3. `OwnershipTransfer.test.tsx:73` — two bugs in one line:
   ```js
   new RegExp(strings.planFlow.confirm.typedPrompt.replace("{name}", "sales"))
   ```
   The placeholder in `strings.planFlow.confirm.typedPrompt` (strings.ts:545) is **`{value}`**, not
   `{name}`, so the `.replace` is a no-op and the unsubstituted template goes into the regex — where
   `{` and `}` are regex syntax besides. And `PlanFlow.tsx:1398` substitutes
   `plan.typed_confirmation_value`, not the literal `"sales"`.

   Build the expected text exactly as the component does: take `typedPrompt`, `.replace("{value}",
   <the plan fixture's typed_confirmation_value>)`, and match that plain string. No `new RegExp`.

Sweep every test you wrote for both patterns while you are in there: any assertion that retypes a
value a fixture or `strings.ts` already defines, and any assertion that matches an unsubstituted
`{placeholder}`.

## Class C — ambiguous queries against correct UI (4 failures)

```
Found multiple elements with the role "button" and name "Assign tag"   AssetTagsView.test.tsx:167
Found multiple elements with the text: Governed                        AssetTagsView.test.tsx
Found multiple elements with the text: Create ABAC Policy              PoliciesView.test.tsx
Found multiple elements with the text: Drop Row Filter                 AssetRowAccessView.test.tsx
```

All four are the UI being right: an action button appears once per row, and a label appears both on
the trigger and inside the dialog it opens. Scope each query to the region, row or dialog you
actually mean, with `within(...)` on a landmark, a `role="row"`, or the `role="dialog"`. No
`.first()`, no `.nth()`, no test ids.

## Report

List every file changed and every line changed in it. Confirm explicitly that (a) no assertion was
deleted or relaxed in the impact-panel test, (b) no test hard-codes a value that a fixture or
`strings.ts` also defines, and (c) no test matches an unsubstituted `{placeholder}`.

## Scope, unchanged

Only `frontend/src/**`, plus an append to `tasks/STATUS.md` and your row in `tasks/TASK-BOARD.md`.
Do not edit `frontend/e2e/**`, `playwright.config.ts`, `tsconfig.json`, `package.json`,
`shared/contracts/`, `backend/`, `scripts/` or `.ai/`. Add no dependency. Never run git. Do not claim
you ran any command.
