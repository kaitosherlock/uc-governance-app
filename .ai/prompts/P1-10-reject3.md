CONTINUE task P1-10. The locator fixes were right and journeys 1 and 2 now drive the product
correctly. **3 of 5 pass.** The two remaining failures are both real gaps in the product, not in your
specs — one accessibility defect and one piece of specified behaviour that was never implemented.

**Rules unchanged: one file at a time, never in parallel, never a shell command.**

## 1. Critical a11y defect — the privilege `<select>` has no accessible name

```
select-name   critical   wcag2a, wcag412, section508
  <select name="privilege" class="w-full px-3 py-2 ...">
  Fix any of the following:
    Element does not have an implicit (wrapped) <label>
    Element does not have an explicit <label>
    aria-label attribute does not exist or is empty
    aria-labelledby ... does not exist
    Element has no title attribute
```

In `PlanFlow.tsx` the privilege dropdown is rendered with no label of any kind. A screen-reader user
tabs onto a control that announces only its current value, with nothing saying what it selects. This
is the form where someone chooses which privilege to grant, so that is not a small omission.

Give it a real `<label>` associated by `htmlFor`/`id`, which is better than `aria-label` because it
also gives sighted users a visible caption and a larger click target. Put the label text in
`strings.ts`.

Then check the rest of that form the same way: every `<select>`, `<input>` and `<textarea>` in
`PlanFlow.tsx` needs a programmatically associated label, not merely a placeholder. A placeholder is
not a label — it disappears on focus and is not reliably announced.

## 2. The `?scenario=` mechanism was specified but never wired

Journey 3 cannot reach the unknown-outcome state:

```
Locator: getByRole('dialog', { name: 'Grant Privileges' }).getByText('Outcome Unknown')
Error: element(s) not found
```

I checked why rather than guessing. `src/mocks/handlers.ts` reads the scenario from the **API
request** URL:

```ts
const url = new URL(request.url);
const scenario = url.searchParams.get("scenario");
```

but **nothing ever puts it there**. `client.ts` does not append it, `queries.ts` does not pass it,
and `enable.ts` does not read it from the page. So every scenario variant — `forbidden`,
`not-configured`, `validation`, `unknown-outcome`, `slow` — is currently unreachable in the running
application. The unit tests never caught this because they override handlers directly with
`server.use(...)` instead of going through the mechanism.

P0-05 specified this behaviour: scenario variants are selected with a `?scenario=` search parameter
in development. Implement it now, because it is the only way to reach these states in a browser, and
the browser review in P1-11 will need it too.

Wire it so that **in development only**, the page's `?scenario=` search parameter is propagated onto
outgoing API requests. Put the propagation in `src/api/client.ts`, since that is the single place
that builds request URLs, and gate it exactly the way `src/mocks/enable.ts` gates the worker — it
must be impossible for a production build to send a scenario parameter. Read the value from
`window.location` at request time rather than caching it, so changing the URL changes the scenario
without a reload.

Then journey 3 can open the app at `?scenario=unknown-outcome` and drive the real 202 path.

## 3. Then confirm journey 3 actually proves its four claims

Once it runs for the first time, verify it asserts all of:

- the outcome-unknown state renders after HTTP **202**;
- **Retry is disabled**;
- **Check current state** is the only forward action;
- the reconciled status replaces the unknown state, and execute was called exactly once.

Strengthen anything that is asserted weakly.

## Scope

`frontend/e2e/**`, `screenshots/**`, and `frontend/src/**` for the two product fixes above, plus an
append to `tasks/STATUS.md` and your row in `tasks/TASK-BOARD.md`. Do not edit
`playwright.config.ts`, `vitest.config.ts`, `package.json`, `shared/contracts/`, `backend/`,
`scripts/` or `.ai/`. Add no dependency. Never run git.

Add a unit test for the scenario propagation: it appends the parameter in dev and **never** in a
production build.

## Report

List every file changed, state which controls in `PlanFlow.tsx` gained labels, and describe exactly
how you gated the scenario propagation so production cannot emit it. Do not claim you ran Playwright.
