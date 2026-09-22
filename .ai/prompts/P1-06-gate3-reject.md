CONTINUE task P1-06. Good progress: `tsc --noEmit` is clean, `vite build` succeeds with 2025
modules, and **49 of 51 tests pass**. Six eslint errors and two test failures remain, and they are
related, so fix them together.

**Rules unchanged: read one file at a time, never in parallel or in a batch, never run a shell
command.** The orchestrator ran everything below.

## A. Four `jsx-a11y` errors — and my original instruction caused them

```
src/features/assets/AssetBreadcrumbs.tsx      81:15   tabIndex should only be declared on interactive elements
src/features/assets/AssetDependenciesView.tsx 91:50   same
src/features/assets/AssetOverview.tsx        153:17   same
src/features/assets/AssetOverview.tsx        285:15   same
```

You wrote, reasonably:

```tsx
<span title={nameTrunc.full} tabIndex={0} aria-current="page" className="...">
  {nameTrunc.display}
</span>
```

because I asked for the full name to be available "on hover AND on keyboard focus". That instruction
pushed you into a bad pattern and I am correcting it. Two things are wrong with it:

1. A focusable element that does nothing is a trap for keyboard users: they tab onto it and there is
   no action to take.
2. `title` is not reliably announced by screen readers at all, so the full name was never actually
   available to assistive technology — only to a sighted mouse user.

**Do this instead.** The full name belongs in the accessible name, not behind a focus stop:

- Keep the visible middle-truncated text.
- Keep `title={full}` — it is a genuine convenience for sighted mouse users, and harmless.
- **Remove `tabIndex={0}`** from every one of those four spans.
- Give the element the complete value for assistive technology, either with `aria-label={full}` on
  the span, or with a visually hidden sibling carrying the full string. Pick one and use it
  consistently across all four sites.
- Where a copy button already sits next to the name, that button is the interactive element; its
  accessible name should say what it copies, including the full value.

Net effect: a screen reader reads the whole name without needing to focus anything, and keyboard
users only stop on things they can actually use.

## B. Two `react-hooks/set-state-in-effect` errors

```
src/features/assets/AssetSearch.tsx  17:5
src/features/assets/AssetTree.tsx   284:7
```

Do **not** silence these with an eslint-disable. Both are the "derive it instead" case.

**`AssetSearch.tsx`** currently mirrors a prop into state:

```tsx
const [internalValue, setInternalValue] = useState(value);
useEffect(() => { setInternalValue(value); }, [value]);
```

That renders once with the stale value and then again with the new one. Remove that effect. Keep the
second effect, the 300 ms debounce, which is a correct use of an effect because it talks to a timer.
To reset the box when the scope genuinely changes, let the parent remount it with a `key` tied to
the scope, or track the previous prop in a ref and adjust during render. Do not reintroduce a
prop-to-state sync effect.

**`AssetTree.tsx`** expands the current catalog inside an effect. Derive it during render instead —
the set of expanded catalogs is the user's explicit expansions **plus** the catalog currently in the
URL, which is a computation, not a synchronization. Something in the shape of

```tsx
const expanded = useMemo(
  () => (currentCatalog ? new Set([...userExpanded, currentCatalog]) : userExpanded),
  [userExpanded, currentCatalog],
);
```

keeping `userExpanded` as the only state you actually set, from the toggle handler.

## C. Two failing tests

```
FAIL  Four UI States > 4. Success state: renders asset overview and meta.limitations under the data
      Unable to find an element with the text: sales.crm.orders

FAIL  Breadcrumbs & Copy FQN > renders navigable breadcrumbs reflecting the current hierarchy
      Found multiple elements with the text: orders
```

The first fails because the name is middle-truncated, so no DOM text node equals
`sales.crm.orders`. Once part A gives the element an accessible name carrying the full value, query
it by that accessible name — `getByLabelText`, or `getByRole(..., { name })` — rather than by its
visible text. That makes the test assert the thing that actually matters: that the complete name
reaches assistive technology.

The second fails because `orders` appears in more than one place. Scope the query to the breadcrumb
landmark, for example `within(screen.getByRole("navigation", { name: ... }))`, instead of searching
the whole document. Do not reach for `getAllByText(...)[0]`.

Keep every existing assertion in both tests; the point is to query correctly, not to assert less.

## Then

Say in your report which of the original P1-06 requirements you have now completed and which you
have not — particularly the four states on every data-bearing component, `meta.limitations` always
rendered under the data, empty success reading as empty success, and `allowed_actions` with
`allowed: false` rendering disabled with its `reason` visible.

## Scope, unchanged

Only `frontend/src/**`, plus an append to `tasks/STATUS.md` and your own row in
`tasks/TASK-BOARD.md`. No dependency changes. Never run git. Do not claim you ran any command.
