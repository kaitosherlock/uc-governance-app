CONTINUE task P2-06. The fixture module is the right shape and the end-to-end suite passes on its
own (5 of 5). Five things left: two build errors and three classes of test problem.

**Rules unchanged: one file at a time, never in parallel, never a shell command.**

## 1. The frozen types caught an invented action name

```
src/mocks/fixtures.ts(98,11):  error TS2322: Type '"edit"' is not assignable to type 'ActionName'
src/mocks/fixtures.ts(150,11): error TS2322: Type '"edit"' is not assignable to type 'ActionName'
```

`ActionName` in the contract is a closed set: `grant`, `revoke`, `transfer_ownership`,
`edit_metadata`, `delete`, `assign_tag`, `remove_tag`, `set_row_filter`, `drop_row_filter`,
`set_column_mask`, `drop_column_mask`, `replace_view_definition`.

There is no `edit`. You almost certainly mean `edit_metadata`. Use the contract value — a fixture
that returns an action the API cannot return would let a component pass tests against data the real
server never sends.

## 2. An unused import

```
src/mocks/fixtures.ts 8:3  'AssetSummary' is defined but never used
```

Remove it.

## 3. Tests still hard-coding strings that a fixture or `strings.ts` already defines

```
Unable to find: /ABAC policies reflect catalog metadata/
Unable to find: /Row filters and column masks reflect table metadata/
Unable to find: /Type {value} exactly to confirm this change:/
```

The first two are `meta.limitations` values. The fixture actually says:

```
"Policy definitions reflect catalog metadata. Effective evaluation depends on SQL compute runtime."
```

so the assertion was written from memory rather than from the fixture. This is exactly the drift the
last round was meant to end: import the fixture and assert
`fixtures.<name>.meta.limitations[0]`, never a retyped regex.

The third is a **template placeholder**. `strings` holds `"Type {value} exactly to confirm this
change:"` and the component substitutes `{value}` before rendering, so the literal never appears in
the DOM. Build the expected string the same way the component does — take the string from `strings`
and apply the same `.replace("{value}", ...)` — rather than matching the unsubstituted template.

Sweep the rest of your tests for both patterns while you are in there.

## 4. Four ambiguous queries

```
Found multiple elements with the role "button" and name "Assign tag"
Found multiple elements with the text: Create ABAC Policy
Found multiple elements with the text: Drop Row Filter
Found multiple elements with the text: Governed
```

All four are correct UI — an action appears per row, and a label appears both on a trigger and in
the dialog it opens. Scope each query to the region or row you mean, using `within(...)` on a
landmark, a `role="row"`, or the dialog. No `.first()`, no `.nth()`, no test ids.

## 5. The impact panel test

```
Unable to find an element with the text: Potentially Affected Assets (Approximation)
```

Both the component and the test read `strings.policies.impactHeading`, so this is **not** a string
mismatch — the panel simply is not on screen when the assertion runs. Work out why: most likely the
impact query only runs once a policy is selected, and the test asserts before selecting one or
before the query resolves. Drive the selection the way a user would, then wait for the panel.

Do not weaken this test. It is one of the two that encode a requirement rather than a mechanic: the
disclaimer must be adjacent to the list, and the panel must not be titled "Effective access" or "Who
has access". Keep both claims exactly as written.

## Report

List every file changed, and confirm that no test hard-codes a value that a fixture or `strings.ts`
also defines, and that no test matches an unsubstituted `{placeholder}`.

## Scope, unchanged

Only `frontend/src/**`, plus an append to `tasks/STATUS.md` and your row in `tasks/TASK-BOARD.md`.
Do not edit `frontend/e2e/**`, `playwright.config.ts`, `tsconfig.json`, `package.json`,
`shared/contracts/`, `backend/`, `scripts/` or `.ai/`. Add no dependency. Never run git. Do not claim
you ran any command.
