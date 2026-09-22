CONTINUE task P2-06. Big step forward: **tsc, eslint, the production build and the end-to-end suite
all pass.** The string keys, the cast and the three accessibility defects in `PoliciesView` are
fixed, and the policy rows are now real buttons. Ten unit tests still fail, and they share **one**
cause.

**Rules unchanged: one file at a time, never in parallel, never a shell command.**

## The single cause: your tests assert values your mocks never return

```
Unable to find an element with the text: security.filters.filter_customer_region
Unable to find an element with the text: sales.crm.filter_orders_region
Unable to find an element with the text: filter_customer_region        (x4, policies)
```

The views render correctly — the DOM shows "Row Filters & Column Masks", the "Row Filter" heading
and the panels underneath. What is missing is the data, because the test expects one set of names
and `src/mocks/handlers.ts` serves another. For example `rowAccessCustomersFixture` carries

```
function_full_name: "shared_ref.governance.normalize_id"
```

while `AssetRowAccessView.test.tsx` asserts `security.filters.filter_customer_region`. Neither is
wrong in itself; they were simply written independently and never reconciled.

## Fix it so it cannot drift again

Do **not** fix this by retyping the correct literal into each test. That is the same mistake one
level down — the next edit to a fixture desynchronizes them again, silently.

Instead:

1. Treat the mock fixtures in `src/mocks/handlers.ts` as the single source of truth for what the API
   returns. If any of them is unrealistic, fix the **fixture** first and say so in your report.
2. **Export** the fixture objects from a module the tests can import — either from `handlers.ts` or
   a small `src/mocks/fixtures.ts` beside it, whichever keeps `handlers.ts` readable.
3. Have the tests **derive** their expectations from the imported fixture rather than hard-coding
   strings: assert against `rowAccessCustomersFixture.data.row_filter.function_full_name` and so on.

Then a fixture change updates every assertion automatically, and a test can only fail when the
component is actually wrong — which is the point of the test.

This is the same discipline already used elsewhere in this project: the contract examples are
imported verbatim rather than retyped, and `strings.ts` values are imported rather than duplicated
into assertions.

## Keep these assertions exactly as they are

Two tests encode requirements, not mechanics. Change only how they locate data, never what they
claim:

- the impact panel test — the disclaimer must be adjacent to the list, and the panel must not be
  titled "Effective access" or "Who has access";
- the drop-filter preview test — it must show what may become visible, the audience that could not
  be enumerated, **and** the note that no query was run, none of them collapsed by default.

## Report

List every file changed, say whether you adjusted any fixture and why, and confirm that no test
still hard-codes a value that a fixture also defines.

## Scope, unchanged

Only `frontend/src/**`, plus an append to `tasks/STATUS.md` and your row in `tasks/TASK-BOARD.md`.
Do not edit `frontend/e2e/**`, `playwright.config.ts`, `tsconfig.json`, `package.json`,
`shared/contracts/`, `backend/`, `scripts/` or `.ai/`. Add no dependency. Never run git. Do not claim
you ran any command.
