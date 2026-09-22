CONTINUE task P1-06. Your last turn ended on a **network error**, not on anything you did wrong:
`agent executor error: proto: unexpected EOF`, marked retryable. Your work survived. Thirteen files
landed under `frontend/src/features/assets/` plus edits to `queries.ts`, `routes.tsx`, `strings.ts`
and `mocks/handlers.ts`.

**The same rules still apply: read one file at a time, never in parallel or in a batch, and never
run a shell command.** No `npx`, `tsc`, `npm`, `eslint`, `vitest`, `vite`, and no file-existence
check. The orchestrator ran the typecheck for you and the exact errors are below.

`npx tsc --noEmit` reports **21 errors in exactly two files**. Nothing else is wrong. Fix only these.

## 1. `src/app/routes.tsx` — 15 errors, all the same cause

```
src/app/routes.tsx(32,26): error TS2552: Cannot find name 'strings'.
src/app/routes.tsx(32,71): error TS2552: Cannot find name 'strings'.
src/app/routes.tsx(33,33): error TS2552: Cannot find name 'strings'.
... the same at lines 41, 42, 50, 51, 59, 60, 68, 69
```

When you added `import { DataAssetsView } from "@/features/assets/DataAssetsView";` the existing
`strings` import was dropped. The file still uses `strings.pages.*`, `strings.descriptions.*` and
`strings.unavailable.*` throughout. Restore the import:

```ts
import { strings } from "@/lib/strings";
```

Do not change anything else in that file, and do not inline the strings to work around it — every
user-visible string must keep coming from `strings.ts`.

## 2. `src/features/assets/DataAssetsView.tsx` — 6 errors, one cause

```
DataAssetsView.tsx(76,5): error TS2322: Type 'string' is not assignable to type '"Data Assets"'.
DataAssetsView.tsx(77,5): error TS2322: Type '"View ownership, access grants, ..."' is not
    assignable to type '"Browse catalogs, schemas, and tables to see who can access them."'.
DataAssetsView.tsx(79,5),(80,5),(82,5),(83,5): the same shape.
```

`strings.ts` is declared `as const`, so

```ts
let pageTitle = strings.pages.dataAssets;          // inferred as the literal "Data Assets"
let pageDescription = strings.descriptions.dataAssets;
```

infer **literal** types, and every later reassignment to a different string is rejected. Widen the
two declarations explicitly:

```ts
let pageTitle: string = strings.pages.dataAssets;
let pageDescription: string = strings.descriptions.dataAssets;
```

Keep the reassignment logic exactly as you wrote it — the scope-dependent title and description are
correct behaviour. Do not add `as string` casts at each assignment, and do not remove `as const`
from `strings.ts`: that const assertion is what lets the string-literal test catch hardcoded copy.

## Then finish the task

Those two fixes make the tree compile. After them, check your own work against the original P1-06
requirements and complete anything you did not reach, in particular:

- all four states (idle, loading, error, success) on every data-bearing component, with stable
  layout;
- `meta.limitations` rendered under the data and never hidden, and a notice when
  `meta.completeness` is not `complete`;
- empty success reading as empty success, not as an error;
- `allowed_actions` with `allowed: false` rendering disabled **and** showing `reason`, with
  `navigate_to` becoming a link;
- the MSW `?scenario=` variants still reaching every state;
- the tests listed in the original prompt under `src/**/__tests__/`.

Say in your report which of these you have actually done and which you have not. An accurate partial
report is worth more than a complete-sounding claim.

## Scope, unchanged

Only `frontend/src/**`, plus an append to `tasks/STATUS.md` and your own row in
`tasks/TASK-BOARD.md`. Do not add, remove or change a dependency. Never run git.
