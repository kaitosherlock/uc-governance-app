CONTINUE task P1-10. The ARIA fix worked: axe is clean everywhere, journey 2 passes end to end, and
**3 of 5 specs pass**. Option A was the right call. Two failures left, both ambiguous locators in
your specs — no product defect this time.

**Rules unchanged: one file at a time, never in parallel, never a shell command.**

## 1. `grant-privilege.spec.ts:71` — "orders" also matches "orders_daily_mv"

```
strict mode violation: getByRole('link', { name: 'orders' }) resolved to 2 elements:
  1) href="/assets/sales/crm/TABLE/orders"
  2) href="/assets/sales/crm/TABLE/orders_daily_mv"
```

Playwright's accessible-name matching is a substring match by default. The fixture schema contains
both a table and a materialized view whose names share a prefix, which is realistic data and should
stay.

Use an exact match: `page.getByRole("link", { name: "orders", exact: true })`.

Do not switch to `.first()` — that would silently pass if the ordering changed and you started
driving the wrong object. Check the rest of that spec for any other name that is a prefix of a
sibling and make those exact too.

## 2. `unknown-outcome-reconcile.spec.ts:70` — two Grant buttons are on screen

```
strict mode violation: getByRole('button', { name: 'Grant' }) resolved to 2 elements
```

The Access tab renders a grant action per row, so `Grant` is genuinely ambiguous at page level. That
is correct UI.

Scope the locator to the row you intend to act on, the same way journey 2 addresses its inherited
grant: find the row by its principal or privilege, then find the Grant button **within** that row —
for example `page.getByRole("row", { name: /.../ }).getByRole("button", { name: ... })`.

Again, no `.first()` and no `.nth()`. The point of these journeys is that they drive a specific,
identifiable thing; an index would make the test pass while proving nothing about which grant was
acted on.

## Then

Once both specs pass, journey 3 will have executed for the first time. Read its assertions back
against the requirement and confirm in your report that it genuinely proves all four things:

- the outcome-unknown state renders after HTTP 202;
- **Retry is disabled**;
- **Check current state** is the only forward action;
- the reconciled status replaces the unknown state, and execute was called exactly once with no
  automatic retry.

If any of those is asserted weakly, strengthen it now.

## Scope, unchanged

`frontend/e2e/**` and `screenshots/**`, plus an append to `tasks/STATUS.md` and your row in
`tasks/TASK-BOARD.md`. Do not edit `playwright.config.ts`, `package.json`, `shared/contracts/`,
`backend/`, `scripts/` or `.ai/`. Add no dependency. Never run git. Do not claim you ran Playwright.
