CONTINUE task P1-ERR-frontend. tsc, eslint and build are clean, and **81 of 82 tests pass**. One
failure left. I have now instrumented it, so this is evidence rather than a hypothesis — my previous
two notes on it were guesses and both were wrong. Apologies for the runaround.

**Rules unchanged: one file at a time, never in parallel, never a shell command.**

## Your abort guard is correct. The test never aborts anything.

```
FAIL  Search & Cancellation > aborted search request does not render an error
AssertionError: expected <div role="alert" …> to be null
```

I rendered the alert's contents. It says:

```
Internal error
Unhandled Exception
Technical details -> Correlation ID: unknown
[Retry]
```

That is an `ApiError` with code `INTERNAL_ERROR`. It is **not** an abort, so `isAbortError` is right
to let it through, and `ErrorView` is right to render it.

The cause is the test's own setup:

```tsx
http.get("*/api/v1/catalogs", async () => {
  throw new DOMException("The user aborted a request.", "AbortError");
}),
```

Throwing inside an MSW handler does not cancel the request. MSW turns an unhandled throw into an
HTTP **500**, the client parses that as an error envelope, and the UI correctly shows an internal
error. The test simulates a server crash and then asserts that a server crash is invisible — which
would be a bug if it passed.

A real cancellation comes from the **client** side, when the component aborts its own in-flight
request through the `AbortSignal` the query passes down.

## Rewrite the test to exercise the real path

Make it a genuine supersede: have the catalogs or search handler delay long enough to still be in
flight, drive the search input so a second request supersedes the first, and assert that no alert
ever appears. That is the actual user behaviour this protects — someone typing cancels the previous
request on every keystroke, and must never be shown an error for it.

Keep the name and the intent. Do not assert less, do not add an arbitrary sleep as the assertion,
and do not make it pass by loosening the query.

Then add the two cheap unit-level assertions that pin the mechanism, so a regression is caught at
the source rather than only through the UI:

- `client.ts` converts an aborted `AbortSignal` into an `AbortError` — you already have a client
  test file, put it there;
- `ErrorView` renders nothing for an `AbortError` instance, while still rendering normally for an
  `ApiError`.

Together those three say: the client labels cancellations correctly, the view ignores them, and the
search flow produces them.

## Do not change

`isAbortError`, the guard in `ErrorView`, or the client's abort detection. All three are right and
the evidence above is what proves it.

## Then report

Confirm which places that were discarding a mapped error are now fixed, and state explicitly that an
aborted request renders no alert and leaves the previous content in place.

## Scope, unchanged

Only `frontend/src/**`, plus an append to `tasks/STATUS.md` and your row in `tasks/TASK-BOARD.md`.
No dependency changes. Never run git. Do not claim you ran any command.
