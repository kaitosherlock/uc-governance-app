CONTINUE task P1-ERR-frontend. The abort test now exercises the real supersede path, which was the
hard part and it is right. **82 of 83 pass**, eslint and build clean. Two one-line fixes left.

**Rules unchanged: one file at a time, never in parallel, never a shell command.**

## 1. `AbortError` takes no constructor argument

```
src/features/assets/__tests__/DataAssets.test.tsx(687,49): error TS2554:
  Expected 0 arguments, but got 1.
```

`src/api/errors.ts` declares:

```ts
export class AbortError extends Error {
  constructor() { super("Request was aborted"); this.name = "AbortError"; }
}
```

Line 687 calls `new AbortError("The user aborted a request.")`. Change it to `new AbortError()`.
Do not add a parameter to the class — nothing needs a custom cancellation message, and the fixed one
is clearer.

## 2. Scope the final assertion in the abort test

```
FAIL  aborted search request does not render an error
TestingLibraryElementError: Found multiple elements with the text: catalog_customer
```

At the end of that test:

```tsx
await waitFor(() => {
  expect(screen.getByText("catalog_customer")).toBeTruthy();
});
```

`catalog_customer` legitimately appears more than once — the superseding result is rendered in more
than one place in the view. The assertion's purpose is that the superseding result **arrived**, not
that it is unique, so scope it to the tree navigation, the way other tests in this file do:

```tsx
const treeNav = screen.getByLabelText(strings.assets.treeAriaLabel);
await waitFor(() => {
  expect(within(treeNav).getByText("catalog_customer")).toBeTruthy();
});
```

Keep `expect(screen.queryByRole("alert")).toBeNull()` document-wide and unchanged — that one **must**
stay unscoped, because the whole point is that no alert appears anywhere.

## Then report

Confirm every place that was discarding a mapped error is now fixed, and state that an aborted
request renders no alert and leaves the previous content in place.

## Scope, unchanged

Only `frontend/src/**`, plus an append to `tasks/STATUS.md` and your row in `tasks/TASK-BOARD.md`.
No dependency changes. Never run git. Do not claim you ran any command.
