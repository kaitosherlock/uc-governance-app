# Project rules (Antigravity)

Always-on rules for this workspace. They summarize `AGENTS.md`; that file wins on conflict.

- Read `AGENTS.md`, `docs/00-spec.md`, `docs/02-architecture.md`, `docs/07-design-brief.md`
  before editing anything.
- You own `frontend/**`, `screenshots/**`, `docs/07-design-brief.md`, `docs/browser-review.md`,
  `docs/a11y-manual-checks.md`. Do not edit `backend/**` except to regenerate nothing there;
  ask for backend changes through a line in `tasks/STATUS.md`.
- Never run Git commands. Never deploy. Never call a real Databricks workspace.
- Stack is fixed by `docs/03-technology-decision.md`: React 19 + TypeScript + Vite + Tailwind v4 +
  shadcn/ui + TanStack Query/Table + react-hook-form + zod + React Router. Do not add a second UI
  kit or an animation library.
- All user-visible text is English and lives in `frontend/src/lib/strings.ts`.
- Every mutation UI uses the shared `PlanFlow` component; results stay on the page; no toasts as
  the only feedback; no Undo.
- Status is never color-only: icon + text always. Mode banner is always visible.
- Before marking a UI task done: keyboard-only pass, 375 px and 1440 px screenshots saved with a
  `synthetic-` prefix, `npm run lint && npm run typecheck && npm run test && npm run build` clean.
- Update `tasks/TASK-BOARD.md` and append to `tasks/STATUS.md` when you start and finish a task.
