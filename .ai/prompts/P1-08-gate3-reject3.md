CONTINUE task P1-08. **All 77 tests pass**, tsc is clean and the build is clean. One eslint error
left, and it is one line.

**Rules unchanged: one file at a time, never in parallel, never a shell command.**

```
src/features/plans/PlanFlow.tsx  866:11  error
  The element section has an implicit role of region. Defining this explicitly is redundant
  and should be avoided   jsx-a11y/no-redundant-roles
```

You added `role="region"` to a `<section>` that already carries `aria-labelledby`. A `<section>` with
an accessible name **already has** the `region` role implicitly, so the attribute adds nothing.

Remove `role="region"` from that element. Keep the `<section>`, keep its `aria-labelledby`, and keep
the "Execution Outcome" heading it points at.

Nothing else changes, and no test should need editing: `getByRole("region", { name: ... })` keeps
matching, because the implicit role is what it was matching all along.

Do not add an eslint-disable.

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
