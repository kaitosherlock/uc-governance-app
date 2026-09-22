CONTINUE task P0-05. Your last turn fixed both defects correctly. The orchestrator re-ran Gate 3:

- `npx tsc --noEmit` — exit 0, clean.
- `npx eslint .` — exit 0, clean.
- `npx vitest run` — **37 of 38 pass**. One test fails. That is the only thing left.

**The rules that decide whether this turn survives, unchanged:**
1. Read files one at a time. Never in parallel, never in a batch, and never run a shell command.
   Do not run npm, npx, tsc, eslint, vitest or vite. The orchestrator runs them and reports back.
2. Change only the two files named below.

## The one failure

```
TestingLibraryElementError: Found multiple elements with the text: alice.steward@example.com
 ❯ src/app/__tests__/ContextBar.test.tsx:78:28
     78|     const actorEl = screen.getByText("alice.steward@example.com");
```

This is a real defect in your test, and it points at a real accessibility gap in the component.

`ContextBar.tsx` renders the actor as an outer `<span>` containing an `aria-hidden` `User` icon and
an inner `<span className="truncate max-w-40">` holding `identity.actor.display`. Testing Library's
`getByText` matches **any** element whose normalized text content equals the string. The icon
contributes no text, so the outer span and the inner span both normalize to exactly
`alice.steward@example.com`. Two matches, so `getByText` throws. The executor pair has the same
shape and will fail the same way the moment the actor line is fixed.

Do **not** paper over this with `getAllByText(...)[0]` or a brittle CSS `selector` option.

## Fix it properly, in two files

### 1. `frontend/src/app/ContextBar.tsx`

The actor and executor are currently two bare strings sitting next to each other with decorative,
`aria-hidden` icons. A screen reader reads "alice.steward@example.com uc-governance-app-sp" with
nothing to say which is the person and which is the service principal that actually executes the
work. That distinction is a core requirement of this application, so it must be in the accessible
name, not only in the icon.

Give each of the two outer spans an accessible label:

- the actor span gets an accessible name meaning "signed in as", wrapping `identity.actor.display`;
- the executor span gets an accessible name meaning "actions run as", wrapping
  `identity.executor.display`.

Use `aria-label` on the outer span. Put both label strings in `frontend/src/lib/strings.ts` under
the existing `strings.context` group — no user-facing or assistive-technology-facing text may be
hardcoded in a component. Keep the visible layout exactly as it is; this adds an accessible name,
it does not change what is drawn. Do not translate, reword or truncate the principal names
themselves: object and principal names are never reworded.

Note that once an outer span carries `aria-label`, its accessible name replaces its text content,
so the ambiguity that broke the test disappears at the source.

### 2. `frontend/src/app/__tests__/ContextBar.test.tsx`

Rewrite only the test at line ~68, "renders actor and executor as separate elements", to query by
the accessible label instead of by raw text — `screen.getByLabelText(...)` with the two new label
strings imported from `strings`, not retyped as literals. Keep the existing assertions that both
elements exist and that they are not the same element, and additionally assert that each element
contains the right display value, so the test still proves the actor and the executor are not
swapped. Leave the other six tests in the file alone; they pass.

## What not to touch

Do not edit any other file. Do not edit `frontend/vitest.config.ts` or `frontend/src/api/client.ts`
— both are now correct. Do not edit `shared/contracts/**`, frozen at v1.0.0. Do not add a
dependency. Do not edit `tasks/TASK-BOARD.md` or `tasks/STATUS.md`; the orchestrator owns those rows
until Gate 3 is green.

## Report

Name the files you changed and the two label strings you added. Do not claim any command output;
you cannot run commands, and the orchestrator will re-run Gate 3.
