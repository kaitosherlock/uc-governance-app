CONTINUE task P2-06. All four areas landed — tags, policies, row access and ownership transfer —
and the production build succeeds. Everything else fails, but from a small number of causes.

**Rules unchanged: one file at a time, never in parallel, never a shell command.**

## 1. Six string keys are referenced and were never added — this is the root cause

```
Property 'systemTagNotice'     does not exist
Property 'columnHeading'       does not exist   (did you mean 'columnTagsHeading'?)
Property 'constrainedByPrefix' does not exist
Property 'allowedValuesCount'  does not exist
Property 'deleteConfirmPrompt' does not exist
Property 'dropConfirmPrompt'   does not exist
```

referenced from `AssetTagsView.tsx`, `PlanFlow.tsx`, and `AssetTagsView.test.tsx`.

`strings.ts` is declared `as const`, so a missing key is a type error rather than a silent
`undefined` — that is the const assertion doing its job. **Ten of the eleven failing tests fail
because of this**, not because the components are wrong: the views cannot render when the strings
they read do not exist.

Add all six to `strings.ts` with real user-facing text. For `columnHeading`, decide whether you meant
the existing `columnTagsHeading` and use that instead of adding a near-duplicate — two keys with
almost the same name is how copy drifts apart later.

Fix these **first**. Then re-read the failing tests before changing anything else, because most of
them should pass once the strings exist.

## 2. One unsound cast

```
src/features/plans/PlanFlow.tsx(817,30): error TS2352:
  Conversion of type 'TagPolicy' to type 'Record<string, unknown>' may be a mistake
```

Do not silence this with `as unknown as`. `TagPolicy` is a contract type; read the field you actually
need from it directly, or narrow properly. If you are reaching for `Record<string, unknown>` because
the shape varies, say so in your report and describe what you needed — that would be a contract
question, not a casting one.

## 3. Three real accessibility defects in `PoliciesView.tsx`

```
153:19  aria-selected is not supported by the role button          jsx-a11y/role-supports-aria-props
194:23  Visible, non-interactive elements with click handlers
        must have at least one keyboard listener                   jsx-a11y/click-events-have-key-events
194:23  Avoid non-native interactive elements                       jsx-a11y/no-static-element-interactions
```

The policy list is built from `<div>` elements with `onClick` and `cursor-pointer`. A keyboard user
cannot select a policy at all — there is nothing to tab to and nothing to press. That is not a lint
technicality, it is the list being unusable without a mouse.

Use a native `<button>` for each policy row. It is focusable, it fires on Enter and Space, and it
announces as a control without any ARIA at all. Then:

- drop `aria-selected`, which `button` does not support, and express the current selection with
  `aria-current="true"` instead;
- keep the visual treatment exactly as it is — this is a semantics change, not a design change;
- the nested "quick actions" `<div onClick={stopPropagation}>` must not wrap interactive children
  inside another interactive element. Restructure so the row button and the action buttons are
  **siblings**, not nested, because a button inside a button is invalid and behaves
  unpredictably for assistive technology.

Do not silence any of these rules, and do not add `role="button"` to a `<div>` as a shortcut — that
takes on the whole keyboard contract manually, which is what went wrong with `role="tree"` earlier
in this project.

## 4. Then the tests

Once 1 to 3 are done, work through whatever still fails. Pay particular attention to the two tests
that encode requirements rather than mechanics:

- **the impact panel test** — the disclaimer must be adjacent to the list, and the panel must not be
  titled "Effective access" or "Who has access". The backend refuses to imply Databricks evaluated
  anything; a careless heading in the UI would undo that.
- **the drop-filter preview test** — it must show what may become visible, the audience that could
  not be enumerated, and the note that no query was run. All three, none collapsed by default.

## Scope, unchanged

Only `frontend/src/**`, plus an append to `tasks/STATUS.md` and your row in `tasks/TASK-BOARD.md`.
Do not edit `frontend/e2e/**`, `playwright.config.ts`, `tsconfig.json`, `package.json`,
`shared/contracts/`, `backend/`, `scripts/` or `.ai/`. Add no dependency. Never run git.

## Report

List every file changed, every string key added, and state how you restructured the policy rows. Do
not claim you ran any command.
