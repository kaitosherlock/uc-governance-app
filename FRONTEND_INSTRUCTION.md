# FRONTEND_INSTRUCTION.md — for the Frontend Coder (Antigravity)

You own `frontend/**`, `screenshots/**`, `docs/07-design-brief.md`, `docs/browser-review.md`,
`docs/a11y-manual-checks.md`. Read `AGENTS.md`, `docs/00-spec.md` §11–§12, and
`docs/07-design-brief.md` first. On conflict: spec > `shared/contracts/api-spec.yaml` > this file.

## 0. The one rule that ends your turn if you break it

**Read files one at a time. Never read in parallel or in a batch, and never run a shell command.**

This headless session auto-denies the `command` permission. Anything that needs it ends your turn
immediately with nothing written, no matter how much you had planned. Three separate dispatches
have already been lost this way. The triggers observed so far:

- running `ls`, `npx`, `tsc`, `npm`, `eslint`, or any shell command;
- checking whether a file exists;
- reading several files "in parallel" or through a batch tool.

So: open one path, read it, then open the next. If you are unsure whether a file exists, just write
it; overwriting is expected. The orchestrator runs every build, lint, typecheck and test for you and
sends the results back if something fails.

## 1. Tech stack (fixed unless P0-02 overturns it with recorded evidence)

| Concern | Choice |
|---|---|
| Framework | React 19 + TypeScript 5 (strict) + Vite 7, SPA, no SSR |
| Styling | Tailwind CSS v4 with tokens from `docs/07-design-brief.md` in `src/design/tokens.css` |
| Components | shadcn/ui (Radix primitives), copied into `src/components/ui/`, themed by tokens. **No second UI kit, no animation library** |
| Server state | TanStack Query v5 (keys include `actorId`, `workspaceId`, scope; `AbortSignal` passed to fetch) |
| Tables | TanStack Table v8 (+ virtualizer for > 200 rows) |
| Forms | react-hook-form + zod (zod for **form input** validation only; API types come from contracts) |
| Routing | React Router v7, scope in URL: `/assets/:catalog?/:schema?/:kind?/:name?` + `?tab=` |
| Mocks | MSW 2 handlers built from `shared/contracts/examples/*.json`; on in dev and in tests |
| Tests | Vitest + Testing Library; Playwright (+ `@axe-core/playwright`) |
| Lint | eslint (typescript-eslint, jsx-a11y), prettier |

## 2. Contract discipline

- Import every API type from `@contracts/types` (alias → `../shared/contracts/types.ts`). **Never**
  declare an interface that describes an API payload anywhere else. If a type is missing, request a
  contract change via `tasks/STATUS.md`; do not improvise.
- `src/api/client.ts` is the only place that calls `fetch`. It:
  - prefixes `/api/v1`, URL-encodes `full_name` as one segment,
  - parses the envelope, narrows on `success`, throws a typed `ApiError` carrying the
    `ErrorResponse` for `success: false`,
  - forwards `AbortSignal`, adds no auth headers (the platform authenticates),
  - treats HTTP 202 on execute as success with `Operation.status === 'unknown'`.
- MSW handlers in `src/mocks/handlers.ts` return the example JSON verbatim, keyed by `API_PATHS`.
  Scenario variants (forbidden, stale, unknown, not_configured) are selected with a
  `?scenario=` search param in dev and by handler override in tests.
- Unknown enum values from the server must render verbatim with an "Unknown" badge, never crash.

## 3. The four UI states, always

Every data-bearing component handles all four, with **stable layout** (no jumps):

| State | Render |
|---|---|
| `Idle` | Nothing fetched yet (e.g. no scope chosen): a purposeful empty state with the next action |
| `Loading` | Localized skeleton matching the final layout; never a full-page spinner |
| `Error` | The `ErrorResponse` mapped per `shared/contracts/error-codes.md`: message, `next_steps`, correlation id in a `<details>`; retry button for reads only |
| `Success` | Data plus `meta.limitations` rendered under the data; `meta.completeness !== 'complete'` shows a subtle notice |

Empty success is not an error: "No grants visible to the application on this object." plus limitations.

## 4. Mutations = `PlanFlow`

One shared component drives every write:

1. **Form** → `POST /plans` (disabled while pending; duplicate clicks impossible).
2. **Preview** renders `Plan`: normalized changes (description prominent, `statement_preview` in
   Details), `prerequisite_notes`, `inheritance_note`, `impact.known` / `impact.unknown`
   (unknown list is never hidden), identity block ("You are requesting this change. It will be
   executed by the application's service principal `{display}`."), countdown to `expires_at`.
3. **Confirm**: standard button, or typed-name input when `requires_typed_confirmation` (must equal
   `typed_confirmation_value` exactly, case-sensitive).
4. **Execute** → `POST /plans/{id}/execute`. Result panel stays in the page:
   - 200 `applied` → per-target rows with `verified` badge and `summary`
   - 200 `partially_applied` / `failed` → per-target rows, failed ones with `error.message`
   - 202 `unknown` → "Outcome unknown" state, **Check current state** button → `reconcile`; Retry disabled until reconcile finishes
   - 409 → map code: stale/expired/invalidated → "Preview outdated — regenerate" (form values kept); duplicate → fetch and show the existing operation
5. Any edit to principal/privileges/targets after preview collapses the preview and requires a new plan.

No toasts as the only feedback. No Undo. No optimistic updates for mutations.

## 5. Component and data rules

- `allowed_actions` gates controls: `allowed: false` → disabled **and** `reason` visible
  (tooltip + `aria-describedby`), `navigate_to` becomes a link ("View permissions at source").
- Source badges: Direct (solid outline), Inherited from {kind} `{full_name}` (dashed + arrow),
  Unknown (dotted). Icon + text, never color alone.
- Privileges display as `label — CODE` with CODE in monospace, e.g. "Read data — SELECT".
- FQNs: monospace, middle-truncation with full value on hover/focus and a copy button.
- Mode banner (`context.mode_label`) and environment chip are always visible; PROD uses hatched
  border + text.
- Strings: all UI text in `src/lib/strings.ts`. A test fails if a JSX text node contains letters
  that are not from `strings.ts` or from data.
- Query keys: `[actorId, workspaceId, 'grants', securable_type, full_name]` etc. Invalidate
  affected keys after an operation reaches a terminal status.
- Debounce search 300 ms; cancel in-flight on new input via `AbortSignal`.

## 6. Accessibility and responsive (checked before DoD)

- Semantic tables; sortable headers announce sort state; row actions reachable by Tab.
- Panels/dialogs trap focus, restore on close, have `aria-labelledby`; `Esc` never dismisses a
  destructive confirmation.
- Focus ring visible everywhere; contrast ≥ 4.5:1 text / 3:1 UI.
- Works at 375 px (panels become full-width sheets), 1024 px, 1440 px, and 200 % zoom.
- `prefers-reduced-motion` disables all transitions.
- Run `npm run e2e:a11y` (axe) and record remaining manual checks in `docs/a11y-manual-checks.md`.

## 7. Definition of Done (frontend task)

- `npm run lint && npm run typecheck && npm run test && npm run build` green; `tsc --noEmit` has zero errors.
- MSW-backed dev server renders the feature with all four states reachable via `?scenario=`.
- Against the real fixture-mode backend on `:8000`, the same screens render identically (no mock drift).
- Playwright spec for the task's journey passes; screenshots at 1440 and 375 saved as
  `screenshots/synthetic-<screen>-<width>.png`.
- Keyboard-only pass done; axe run has no serious/critical violations.
- `tasks/TASK-BOARD.md` evidence + `tasks/STATUS.md` DONE line.

## 8. Commands

```
cd frontend
npm ci
npm run contract:check     # lint api-spec.yaml + validate examples
npm run dev                # MSW on, http://localhost:5173, proxies /api to :8000 when VITE_USE_MSW=false
npm run lint
npm run typecheck          # tsc --noEmit
npm run test
npm run build
npm run e2e                # needs backend fixture mode on :8000 serving dist/
npm run e2e:a11y
```

## 9. Things you never do

Declare API types outside `shared/contracts`, enable a control whose `allowed` is false, hide
`impact.unknown` or `meta.limitations`, auto-retry a mutation, show "Nobody has access",
"Secure", "Compliant", or "PII protected", use color alone for status, add a UI kit or animation
library, edit `backend/**`, use Git.
