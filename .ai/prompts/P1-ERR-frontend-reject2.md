CONTINUE task P1-ERR-frontend. **81 of 82 pass**, eslint and build are clean. One type error and one
test failure, and the test failure is a real regression introduced by this task.

**Rules unchanged: one file at a time, never in parallel, never a shell command.**

## A. The regression — an aborted request now renders as an error

```
FAIL  aborted search request does not render an error
AssertionError: expected <div role="alert" …> to be null
```

This is the exact thing `FRONTEND_INSTRUCTION.md` forbids: *an aborted request is not an error and
must never render as one.* It regressed because this task's whole point was to stop discarding
errors — and `AbortError` got swept along with the real ones.

A user typing in the search box cancels the in-flight request on every keystroke. If each
cancellation paints an alert, the interface accuses the user of a failure they caused by typing
normally. That is worse than the generic-message bug you just fixed.

`describeError` currently returns a description for `AbortError` (title `strings.common.cancel`,
body `strings.errors.networkError`), so any caller that renders whatever `describeError` returns
will show an alert.

Fix it in **one shared place**, not at each call site. Either:

- have the shared error view return `null` when the error is an `AbortError`, so no consumer can
  render one by accident; or
- export a small predicate from `src/api/errors.ts`, for example `isAbortError(error)`, and have the
  shared error view short-circuit on it.

Pick one, apply it once, and make sure every consumer goes through it. Do **not** fix this by
changing the test, and do not remove `AbortError` handling from `describeError` — a caller that
genuinely wants to describe a cancellation should still be able to.

While you are there: a cancelled request should leave the previous content or the loading state in
place, not an empty panel. Check that the search path does that.

## B. One type error

```
src/api/queries.ts(52,99): error TS2345:
  Argument of type 'unknown' is not assignable to parameter of type 'Error'.
```

Line 52 passes `error`, typed `unknown` in your retry helper, into a TanStack retry callback whose
signature declares `Error`. Narrow it properly rather than casting blindly: check
`error instanceof Error` before delegating, and decide what the helper should do when it is not an
`Error` at all — returning `false` (do not retry something we cannot identify) is the honest choice
for a mutation-safe client, but state which you chose and why in your report.

Do not weaken the tsconfig and do not use `as any`.

## Then report

List every file changed, and confirm which places that were discarding a mapped error are now fixed.
State explicitly that an aborted request renders no alert and leaves the prior content in place.

## Scope, unchanged

Only `frontend/src/**`, plus an append to `tasks/STATUS.md` and your row in `tasks/TASK-BOARD.md`.
No dependency changes. Never run git. Do not claim you ran any command.
