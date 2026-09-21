CONTINUE task P0-04. You stopped after reading the specification because you tried to list a
directory, and any attempt to run a command ends your turn immediately in this headless session.

**The single most important rule: never invoke a tool that runs a shell command.** That includes
directory listing, `ls`, `find`, `cat`, `tsc`, `npm`, and file-existence checks. Every such attempt
is auto-denied and your turn ends with nothing written. Use only the file read and file write
tools. If you need a file's contents, read it by exact path. If you are unsure whether a file
exists, just write it; overwriting is fine and expected.

Here is the complete inventory of `frontend/`, so you never need to explore:

```
frontend/.gitignore            exists, leave it alone
frontend/package.json          exists, do not edit
frontend/package-lock.json     exists, do not edit
frontend/tsconfig.json         exists, do not edit
frontend/tsconfig.node.json    exists, do not edit
frontend/vite.config.ts        exists, do not edit
frontend/node_modules/         installed, ignore
frontend/src/                  DOES NOT EXIST YET, you create everything in it
frontend/index.html            DOES NOT EXIST YET, you create it
frontend/eslint.config.js      DOES NOT EXIST YET, you create it
```

Relevant settings already in place, so you can write code that compiles without checking:
- `tsconfig.json` has `paths` with `@/*` to `./src/*` and `@contracts/*` to `../shared/contracts/*`,
  and no `baseUrl`. `verbatimModuleSyntax` is on, so use `import type` for type-only imports.
  `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are on, so index access yields
  `T | undefined` and optional properties may not be assigned `undefined` explicitly.
- `vite.config.ts` already registers `@vitejs/plugin-react` and `@tailwindcss/vite` and the same
  two aliases, and proxies `/api` to `http://localhost:8000`.
- Installed and importable: react 19.3.0, react-dom 19.3.0, react-router 8.4.0, tailwindcss 4.3.3,
  lucide-react 1.47.0, clsx 2.1.1, tailwind-merge 3.7.0. Plus dev-only: typescript 6.0.3,
  eslint 9.39.5, typescript-eslint 8.70.0, eslint-plugin-react-hooks 7.1.1,
  eslint-plugin-jsx-a11y 6.10.2, vitest 5.0.1, @testing-library/react 16.3.3, jsdom 30.1.0,
  msw 2.15.0, @playwright/test 1.63.0, @axe-core/playwright 4.13.0.
- **Not installed, so do not import them:** shadcn/ui, any `@radix-ui/*` package, `@types/node`,
  `@tanstack/react-query` is installed but is NOT part of this task.

Now write every file listed in the original P0-04 instructions, which you have already read. To
restate the deliverables so you do not need to re-read anything:

1. `frontend/src/design/tokens.css` — the token system from docs/07 section 4.
2. `frontend/src/index.css` — Tailwind import plus tokens, base background and text colour.
3. `frontend/src/lib/strings.ts` — every user-visible English string, grouped by area.
4. `frontend/src/lib/cn.ts` — clsx plus tailwind-merge helper.
5. `frontend/src/lib/fqn.ts` — fully-qualified-name helpers including middle truncation and
   single-segment URL encoding.
6. `frontend/src/app/routes.tsx` — React Router 8 data routes, scope in the URL as
   `/assets/:catalog?/:schema?/:objectType?/:name?` plus a `tab` search parameter, and the routes
   `/access`, `/policies`, `/activity`, `/platform`, plus a not-found route. Placeholders must say
   plainly that the feature is not implemented yet and must not fake data.
7. `frontend/src/app/AppShell.tsx` — skip link, `<header>`, `<nav>` with `aria-current="page"`,
   `<main id="main">`, left rail collapsing to icons below 1024px, no horizontal overflow at 375px.
8. `frontend/src/app/ContextBar.tsx` — presentational only, props
   `{ context: Context | null; identity: Identity | null; loading: boolean }`, types imported from
   `@contracts/types`. Mode badge with an icon per mode, environment chip where production is
   marked by text and a hatched border rather than colour alone, workspace host, managed scope,
   and actor and executor as clearly separate items. Loading skeleton of the same dimensions.
9. `frontend/src/app/providers.tsx` — router setup only, no TanStack Query in this task.
10. `frontend/src/main.tsx` and `frontend/index.html` — title "Unity Catalog Governance",
    `<html lang="en">`.
11. `frontend/eslint.config.js` — flat config for eslint 9 with typescript-eslint, react-hooks and
    jsx-a11y, ignoring `dist` and `node_modules`.

Accessibility is acceptance criteria: semantic landmarks, keyboard reachability, a visible focus
ring from the token, no hover-only information, text contrast at least 4.5 to 1.

Write the files now, in one go, without running anything. Then report the list of files you wrote
and anything you were unsure about. Finally append one line to tasks/STATUS.md and update your row
in tasks/TASK-BOARD.md.
