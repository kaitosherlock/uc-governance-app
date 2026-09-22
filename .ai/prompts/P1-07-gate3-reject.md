CONTINUE task P1-07. `tsc --noEmit` is clean, `vite build` succeeds, and **61 of 65 tests pass**.
Two eslint errors and four test failures remain. The orchestrator ran all of it; you cannot.

**Rules unchanged: one file at a time, never in parallel, never a shell command.**

I diagnosed each failure rather than just pasting it, because three of the four are the **test**
querying wrongly while your component is right, and two are genuine defects. Treat them differently.

## A. Real defect — memoization the React Compiler cannot preserve

```
src/features/assets/AssetGrantsView.tsx  195:38  error  Compilation Skipped:
    Existing memoization could not be preserved
```

Line 198 is `}, [grantsQuery.data?.data]);`. An optional chain inside a dependency array is a new
expression on every render as far as the compiler is concerned, so it bails out of optimizing the
component. Hoist it:

```tsx
const grantsData = grantsQuery.data?.data;
const allGrants: Grant[] = useMemo(() => {
  if (!grantsData) return [];
  return [...(grantsData.direct ?? []), ...(grantsData.inherited ?? [])];
}, [grantsData]);
```

Check your other `useMemo` and `useCallback` dependency arrays in this file for the same shape and
fix them the same way. Do not add an eslint-disable.

## B. Real defect — two buttons with the same accessible name

```
TestingLibraryElementError: Found multiple elements with the role "button"
    and name "Clear filters"
```

This one is not the test's fault. You render `strings.access.filters.clearFilters` twice: once in
the filter bar at line ~395, and once in the no-results empty state at line ~432. When filters
exclude every row, **both are on screen at once**, and a screen-reader user hearing "Clear filters,
button" twice has no way to tell them apart.

Give them distinct accessible names. The filter-bar one can stay "Clear filters"; the empty-state
one should say what it does from there, something like "Clear filters and show all grants". Put both
strings in `strings.ts`. Then the test can address each unambiguously.

## C. Three tests querying the wrong element — your components are correct

**1. `expected '' to contain 'border-solid'`**

Your badges are right: line 99 uses `border-solid`, line 116 `border-dashed`, line 133
`border-dotted`, exactly as the task asked. The test picked up an element with no className, so it
was not looking at the badge.

Do **not** fix this by hunting for the badge element to assert its Tailwind classes. Asserting on
class names tests the stylesheet, not the behaviour, and it will break on any refactor. The
requirement is that a user can **tell the sources apart** — and specifically that this never depends
on colour alone. Assert what a user perceives: that the direct row's source cell has the accessible
text for Direct, and that the inherited row's names its parent object. Keep the visual
solid/dashed/dotted distinction in the component; just stop asserting on it by class.

**2. `Found multiple elements with the text: CUSTOM_UNKNOWN_PRIVILEGE_XYZ`**
**3. `expected 'option' to be 'code'`**

Same cause. The privilege code appears both in the table cell and as an `<option>` in the privilege
filter `<select>`, so a document-wide query matches both, and in test 3 the `<option>` is found
first — which is why it asserts `option` where you expected `code`.

Scope both queries to the table:

```tsx
const table = screen.getByRole("table", { name: /.../ });
within(table).getByText("CUSTOM_UNKNOWN_PRIVILEGE_XYZ");
```

Do not use `getAllByText(...)[0]`, and do not remove the codes from the filter options — having them
there is correct.

## Then

Confirm in your report which P1-07 requirements are complete: the five columns, principal type as
icon **plus** text, privilege as `label — CODE` with the code in monospace, the three source
treatments each with icon plus text, `allowed_actions` gating with `reason` visible and
`navigate_to` becoming a link, filters that clear by keyboard, the four states, and —
non-negotiable — `meta.limitations` rendered under the table, never collapsed, with the
group-membership sentence appearing verbatim.

## Scope, unchanged

Only `frontend/src/**`, plus an append to `tasks/STATUS.md` and your row in `tasks/TASK-BOARD.md`.
No dependency changes. Never run git. Do not claim you ran any command.
