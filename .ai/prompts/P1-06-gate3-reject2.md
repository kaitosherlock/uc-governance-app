CONTINUE task P1-06. Almost there. The orchestrator re-ran Gate 3 outside your sandbox:

- `npx tsc --noEmit` — clean.
- `npx eslint .` — **clean**. All six errors are gone; the accessible-name and derive-instead-of-sync
  fixes were right.
- `npx vite build` — succeeds.
- `npx vitest run` — **50 of 51 pass**. One test fails.

**Rules unchanged: one file at a time, never in parallel, never a shell command.**

## The one failure

```
FAIL  Data Assets UI (P1-06) > Four UI States >
      4. Success state: renders asset overview and meta.limitations under the data
TestingLibraryElementError: Unable to find a label with the text of: sales.crm.orders
  at src/features/assets/__tests__/DataAssets.test.tsx:161
```

**Your component is correct. The test races it.** Do not change `AssetOverview.tsx`.

`AssetOverview.tsx` line 154 already sets `aria-label={fqnTrunc.full}`, so the accessible name is
exactly `sales.crm.orders`. The problem is when the assertion runs.

The test waits on this:

```tsx
await waitFor(() => {
  expect(screen.getByRole("heading", { name: "orders" })).toBeTruthy();
});
expect(screen.getByLabelText("sales.crm.orders")).toBeTruthy();   // line 161, runs too early
```

That heading is **not** produced by the fetched asset. `DataAssetsView` computes
`pageTitle = name` straight from the URL parameter, and `PageHeader` renders it as the `h1`
immediately, before any request settles. So the `waitFor` is satisfied on the first render.
Meanwhile `AssetOverview` is mounted only when `assetQuery.data?.data` is present, which happens
later, so line 161 queries a document that does not contain it yet.

**Fix the test by waiting for something that only exists once the asset data has arrived.** Put the
`getByLabelText("sales.crm.orders")` assertion inside the `waitFor` and drop the heading from it, or
use `await screen.findByLabelText("sales.crm.orders")` as the wait. Then keep the remaining
assertions — owner, comment, and the `meta.limitations` line — exactly as they are, running after
that wait.

Do not weaken any assertion, do not add an arbitrary timeout, and do not assert on the URL-derived
heading as a proxy for data having loaded; that is precisely what made this test pass falsely on
timing rather than on content.

## Then finish your report

In your report, state which of the original P1-06 requirements are now complete and which are not,
specifically: the four states on every data-bearing component, `meta.limitations` rendered under the
data and never hidden, the `meta.completeness` notice, empty success reading as empty success,
`allowed_actions` with `allowed: false` rendered disabled with its `reason` in the accessibility
tree, the `?scenario=` MSW variants reaching every state, and the debounced cancellable search.

## Scope, unchanged

Only `frontend/src/**`, plus an append to `tasks/STATUS.md` and your row in `tasks/TASK-BOARD.md`.
No dependency changes. Never run git. Do not claim you ran any command.
