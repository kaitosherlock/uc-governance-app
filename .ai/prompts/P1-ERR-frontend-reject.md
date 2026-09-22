CONTINUE task P1-ERR-frontend. The mapping work landed: eslint is clean, the build is clean, and
**80 of 82 tests pass**. Two type errors and two test failures remain.

**Rules unchanged: one file at a time, never in parallel, never a shell command.**

## A. Two type errors, one pattern, in `PlanFlow.tsx`

```
src/features/plans/PlanFlow.tsx(278,28) and (335,28): error TS2345
  Type '{ ... nextSteps: string[] | undefined }' is not assignable to
       '{ ... nextSteps?: string[] | null }' with 'exactOptionalPropertyTypes: true'.
  Type 'undefined' is not assignable to type 'string[] | null'.
```

You widened `conflictError` to carry `nextSteps`, but you pass `undefined` where the state's type
says `string[] | null`. Under `exactOptionalPropertyTypes` those are different things. Normalize at
the call site, `nextSteps: desc.nextSteps ?? null`, or widen the state type to accept `undefined` —
pick one and apply it at both 278 and 335. Do not weaken the tsconfig.

## B. `ErrorView component renders compact and standard variants with all details`

```
TestingLibraryElementError: Unable to find an element with the text: Insufficient privileges
```

This is a test bug and the component is right. The test builds a **plain object** shaped like an
`ApiError`:

```tsx
error={{ name: "ApiError", status: 403, code: "INSUFFICIENT_PRIVILEGES", response: {...} }}
```

`describeError` narrows with `error instanceof ApiError`, and a plain object literal is not an
instance, so it falls through to the generic branch — which is exactly the behaviour you want it to
have.

Construct a real one instead: `new ApiError(responseObject, 403)`, importing `ApiError` from
`@/api/errors`. Then the mapped title "Insufficient privileges", the server message, the next steps
and the correlation id all render, and the assertions stand as written.

## C. `a thrown value that is not an ApiError falls back to generic message and unknown title`

```
TestingLibraryElementError: Unable to find role="alert"
  (queried within screen.getByLabelText(strings.assets.treeAriaLabel))
```

I am **not** certain of the cause here, so investigate rather than assume. What I ruled out: the
test's QueryClient already sets `retry: false`, so this is not retry backoff.

The strongest remaining hypothesis is a DOM containment problem, not a rendering one: the test
queries `within(treeNav)`, where `treeNav` is the element labelled `strings.assets.treeAriaLabel`.
If the catalogs error block renders as a **sibling** of that element rather than inside it, the
error is on the page but outside the scope being searched. Read `AssetTree.tsx` and check where the
catalogs error state sits relative to the labelled nav.

If the error genuinely renders outside the nav, decide which is correct and say which you chose:
either move the error inside the nav it describes, which is better because the error explains why
that navigation is empty, or scope the test to wherever it legitimately lives. Do not simply drop
the `within(...)` and search the whole document; that would hide the same class of bug next time.

If the cause turns out to be something else entirely, fix that and say so in your report.

## Then report

List every file changed, and state plainly which places you found that were discarding a mapped
error and are now fixed, including any beyond `AssetTree.tsx`.

## Scope, unchanged

Only `frontend/src/**`, plus an append to `tasks/STATUS.md` and your row in `tasks/TASK-BOARD.md`.
No dependency changes. Never run git. Do not claim you ran any command.
