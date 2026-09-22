CONTINUE task P1-10. The three journeys are written and they **run** — the harness, the selectors
and the flows are right. Two things to fix, and the second is the more interesting one: your axe
scan found a real accessibility defect in the product on its very first run.

**Rules unchanged: one file at a time, never in parallel, never a shell command.**

## 1. A JSON import that Node cannot load

```
TypeError: Module ".../shared/contracts/examples/OperationResponse.unknown-outcome.json"
  needs an import attribute of "type: json"
  at e2e/unknown-outcome-reconcile.spec.ts
```

Vitest runs through Vite, which transforms JSON imports for you. Playwright runs the spec in **Node**,
where a JSON import needs an explicit attribute:

```ts
import operationUnknownOutcome from "../../shared/contracts/examples/OperationResponse.unknown-outcome.json" with { type: "json" };
```

That spec never loaded, so journey 3 has not run at all yet. Fix the import and expect to find
further issues in it once it executes.

## 2. A real ARIA defect in `AssetTree.tsx` — 1 critical, 3 serious

Both journeys that scanned the browse view failed axe:

```
aria-required-children  critical  "Certain ARIA roles must contain particular children"
  <ul class="space-y-1" role="tree">

listitem                serious   "<li> elements must be contained in a <ul> or <ol>"
  <li class="space-y-0.5">   (x3)
```

`AssetTree.tsx` declares `role="tree"` on the outer `<ul>` and `role="group"` on the nested ones,
but the `<li>` children carry no role. The `tree` role requires `treeitem` children, and because the
`<ul>` has been given an explicit role, its `<li>` children lose their implicit list semantics —
which is the second violation. So the markup currently promises a tree and delivers neither a tree
nor a list.

**Decide deliberately between two fixes, and say which you chose and why.**

**Option A, drop the ARIA tree.** Remove `role="tree"` and `role="group"`, leaving a semantic nested
`<ul>`/`<li>` of links. Both violations disappear and the navigation keeps working exactly as it
does today.

**Option B, implement the tree properly.** Add `role="treeitem"` to every `<li>`, keep
`role="group"` on the nested lists, and add the keyboard model the role promises: arrow keys to move
and expand or collapse, Home and End, and a roving `tabindex` so the tree is a single tab stop.

**I recommend Option A**, and the reason matters more than the recommendation. Declaring
`role="tree"` tells a screen-reader user that arrow-key navigation is available. This component does
not implement it. A false promise is worse than no promise: the user is told to use a keyboard model
that will not respond. Option B is legitimate but it is a substantially larger piece of work, and
P1-10 is a testing task — if you think the tree pattern is genuinely right for this view, say so and
I will schedule it as its own task rather than have you improvise it here.

Whichever you choose, do **not** silence axe, do not lower the severity threshold, and do not add
the rule to an exclusion list. The scan found a true defect; that is what it is for.

## Then

Re-check that your specs still address elements by role and accessible name after the markup change.
If removing `role="tree"` changes how a node is addressed, update the selector to the new accessible
role rather than falling back to a CSS selector or a test id.

Journey 3 has never executed. Once the import is fixed, read it back carefully against the
requirement: the outcome-unknown state renders, **Retry is disabled**, **Check current state** is the
only forward action, and the reconciled status replaces the unknown state.

## Scope, unchanged

`frontend/e2e/**` and `screenshots/**`, plus `frontend/src/features/assets/AssetTree.tsx` for the
ARIA fix, an append to `tasks/STATUS.md`, and your row in `tasks/TASK-BOARD.md`. Do not edit
`playwright.config.ts`, `vitest.config.ts`, `package.json`, `shared/contracts/`, `backend/`,
`scripts/` or `.ai/`. Add no dependency. Never run git.

## Report

State which option you chose for the tree and why, list every file changed, and name any axe
violation you are deliberately accepting together with the reason. Do not claim you ran Playwright.
