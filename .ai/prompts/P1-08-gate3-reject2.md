CONTINUE task P1-08. Good progress: `tsc --noEmit` clean, `eslint .` clean, `vite build` clean, and
**75 of 77 tests pass**. The clock pinning fixed the whole expiry cascade. Two failures left, one a
real gap in the component and one a scoping mistake in a test.

**Rules unchanged: one file at a time, never in parallel, never a shell command.**

## 1. A real gap — the result region has no heading

```
FAIL  the execute button cannot be double-submitted
TestingLibraryElementError: Unable to find an element with the text: Execution Outcome
  at src/features/plans/__tests__/PlanFlow.test.tsx:519
```

`strings.planFlow.outcome.heading` is `"Execution Outcome"`. It exists in `strings.ts` and is
referenced by **nothing except that test** — `PlanFlow.tsx` renders `appliedTitle`, `partialTitle`,
`failedTitle` and `unknownTitle`, but never the section heading above them.

The test is right and the component is missing something. Add it: render
`strings.planFlow.outcome.heading` as the heading of the result region, at an appropriate level
below the dialog's own `h2`, and point the region at it with `aria-labelledby`.

This matters beyond the test. The whole design of this step is that the result **stays in the page**
instead of appearing as a toast, so a keyboard or screen-reader user needs a heading they can
navigate to in order to find out what happened. Right now the outcome is an unlabelled region.

Keep the per-status titles exactly as they are underneath it.

## 2. A scoping mistake in the test — the component is right

```
FAIL  partially_applied shows per-target outcomes and is not presented as success
TestingLibraryElementError: Found multiple elements with the text: sales.crm.orders
```

`sales.crm.orders` legitimately appears more than once: in the preview's normalized changes and
again in the per-target outcome rows. Both are correct.

Scope the assertion to the outcome region — which, after fix 1, you can address by its heading, for
example `within(screen.getByRole("region", { name: strings.planFlow.outcome.heading }))`. Assert
there that the target row is present and carries its failure message, and keep the existing
assertion that the result is **not** presented as success.

Do not use `getAllByText(...)[0]`.

## Then report

Confirm which P1-08 requirements are complete: `impact.unknown` visible without interaction,
`statement_preview` only inside Details with `description` prominent, the identity block naming the
executing service principal, typed confirmation exact and case-sensitive, 202 rendering the
unknown-outcome state with Retry disabled until reconcile returns, `partially_applied` never
presented as success, editing a field after preview collapsing the preview, `Esc` not dismissing a
destructive confirmation, and the five contract error codes each mapped to their own treatment.

## Scope, unchanged

Only `frontend/src/**`, plus an append to `tasks/STATUS.md` and your row in `tasks/TASK-BOARD.md`.
No dependency changes. Never run git. Do not claim you ran any command.
