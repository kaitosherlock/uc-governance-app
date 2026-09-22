PREPENDED BY THE ORCHESTRATOR — read this before the task below.

**Read files one at a time. Never read in parallel or in a batch, and never run a shell command.**
The orchestrator runs every check and sends failures back to this same session.

---

ROLE: Frontend Coder for the Unity Catalog Governance application.

TASK: P1-ERR-frontend — the browse tree throws away every error it is given.

## What happened, observed on the deployed app against a real workspace

A signed-in user opened Data Assets. The catalogs list failed, and the app said:

> Something went wrong. Copy the correlation ID below and contact your administrator to report this
> failure.

The server had actually returned a precise, contract-shaped error:

```json
{"success": false, "code": "INSUFFICIENT_PRIVILEGES",
 "message": "The executing identity cannot read this resource.",
 "correlation_id": "94012433-7f32-45f3-862f-21f49005659d"}
```

and `strings.ts` already contains the right treatment for that code:

```
INSUFFICIENT_PRIVILEGES: { title: "Insufficient privileges",
                           body: "The execution identity lacks required Unity Catalog privileges." }
```

None of it reached the user. Working out what was actually wrong took fifteen minutes of
command-line investigation of a problem the app was already holding the answer to.

## The cause

`src/features/assets/AssetTree.tsx` renders `strings.errors.generic` as a hardcoded literal in
**three** places — at roughly lines 142, 241 and 341, for the objects, schemas and catalogs error
states. It never calls `describeError`.

So every failure in the tree, whatever its cause, is flattened to the same sentence, and the
mapped title, the server's message, `next_steps` and the correlation id are all discarded.

`src/features/assets/StateViews.tsx` already does this correctly — it imports `describeError` and
uses it. The tree simply does not use that component.

This is why it passed Gate 3: the tests assert that *an* error state renders, not that it renders
the **mapped** error. That gap is part of what you are fixing.

## What to change

1. In `AssetTree.tsx`, replace all three hardcoded `strings.errors.generic` blocks with the shared
   error view from `StateViews.tsx`, passing the actual query error. Each must show the mapped
   title, the server's `message`, any `next_steps`, and the correlation id inside a `<details>`,
   with a retry control — these are reads, so retry is allowed.

   If the shared component does not fit inside a narrow tree column, adapt it or add a compact
   variant **in `StateViews.tsx`** so there is still exactly one place that knows how to render an
   error. Do not create a second mapping.

2. Search the rest of `frontend/src/**` for any other place that renders `strings.errors.generic`,
   or any other fixed error sentence, instead of describing the error it was handed. Fix each one
   the same way. `strings.errors.generic` should remain only as `describeError`'s last-resort
   fallback for a value that is not an `ApiError` at all.

3. `next_steps` must be rendered wherever an error is shown. The backend is being changed in
   parallel to populate them for `INSUFFICIENT_PRIVILEGES`, and they are the part that tells the
   user what to actually do. An error view that drops them is the defect you are fixing, one level
   down.

## Tests

Strengthen them so this cannot regress:

- an `ApiError` with code `INSUFFICIENT_PRIVILEGES` renders the **mapped title**, the server's
  message, and the correlation id — and **not** `strings.errors.generic`;
- a non-empty `next_steps` array is rendered;
- the catalogs, schemas and objects error states each map the error rather than showing a fixed
  sentence;
- a thrown value that is not an `ApiError` still falls back to the generic message, so the fallback
  keeps working for genuinely unknown failures.

## Scope

Only `frontend/src/**`, plus an append to `tasks/STATUS.md` and your row in `tasks/TASK-BOARD.md`.
No dependency changes. Never run git. Do not claim you ran any command.

## Report

List every file changed and every place you found that was discarding an error. Say plainly what you
did not finish.
