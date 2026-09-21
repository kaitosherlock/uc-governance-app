ROLE: Frontend Coder for the Unity Catalog Governance application.

READ FIRST, from the project root C:\Users\admin\Downloads\uc-governance-app:
1. AGENTS.md
2. FRONTEND_INSTRUCTION.md
3. docs/07-design-brief.md section 4

TASK: P0-02 frontend half. Author the Node manifest and TypeScript and Vite configuration. Do not
build any UI.

IMPORTANT, READ THIS FIRST
Your headless session cannot run shell commands; the permission is auto-denied. Do not try to run
npm, npx, node, or tsc, and do not report that you ran them. Write files only. Every version you
need is supplied below and was verified against the npm registry by the orchestrator on
2026-09-21. The orchestrator runs `npm install` and `tsc --noEmit` as its verification gate and
generates package-lock.json.

SCOPE. Create or edit only these files:
- frontend/package.json
- frontend/tsconfig.json
- frontend/tsconfig.node.json
- frontend/vite.config.ts
- frontend/.gitignore

Do not create package-lock.json; the orchestrator generates it. Do not create any component,
page, CSS, or test file; that is P0-04 and later. Do not touch backend/, shared/, scripts/, .ai/,
or any document.

EXACT VERSIONS, use verbatim with no caret and no tilde

dependencies:
  react 19.3.0
  react-dom 19.3.0
  react-router 8.4.0
  @tanstack/react-query 5.103.2
  @tanstack/react-table 9.2.4
  react-hook-form 7.88.0
  zod 4.6.5
  clsx 2.1.1
  tailwind-merge 3.7.0
  lucide-react 1.47.0

devDependencies:
  typescript 7.0.2
  vite 8.3.0
  @vitejs/plugin-react 6.1.1
  tailwindcss 4.3.3
  @tailwindcss/vite 4.3.3
  eslint 10.11.0
  typescript-eslint 8.70.0
  eslint-plugin-react-hooks 7.1.1
  eslint-plugin-jsx-a11y 6.10.2
  vitest 5.0.1
  @testing-library/react 16.3.3
  @testing-library/user-event 14.6.7
  jsdom 30.1.0
  msw 2.15.0
  @playwright/test 1.63.0
  @axe-core/playwright 4.13.0
  @types/react 19.3.0
  @types/react-dom 19.3.0

WHAT TO PRODUCE

1. frontend/package.json
   - "name": "uc-governance-frontend", "private": true, "type": "module", "version": "0.1.0"
   - dependencies and devDependencies exactly as listed, exact versions, alphabetically ordered.
   - scripts:
       "dev": "vite"
       "build": "tsc --noEmit && vite build"
       "preview": "vite preview"
       "lint": "eslint ."
       "typecheck": "tsc --noEmit"
       "test": "vitest run"
       "test:watch": "vitest"
       "e2e": "playwright test"
       "e2e:a11y": "playwright test --grep @a11y"
       "contract:check": "uv run --no-project --with pyyaml --with jsonschema python ../scripts/validate_contracts.py"
   - No "engines" field invented from guesswork; if you add one, base it only on Node 22, which is
     the Databricks Apps runtime recorded in docs/04.

2. frontend/tsconfig.json
   - strict true, noUncheckedIndexedAccess true, noImplicitOverride true,
     exactOptionalPropertyTypes true, verbatimModuleSyntax true, isolatedModules true,
     moduleResolution "bundler", module "ESNext", target "ES2022", lib DOM plus DOM.Iterable plus
     ES2022, jsx "react-jsx", skipLibCheck true, noEmit true, resolveJsonModule true.
   - "paths": { "@/*": ["./src/*"], "@contracts/*": ["../shared/contracts/*"] } with
     "baseUrl": "." so that `import type { Plan } from "@contracts/types"` resolves.
   - "include": ["src", "e2e"]. Reference tsconfig.node.json.
   - Note in a comment that shared/contracts/types.ts lives outside src on purpose and is the
     single source of API types.

3. frontend/tsconfig.node.json
   - For vite.config.ts and other Node-side files: module "ESNext",
     moduleResolution "bundler", types ["node"], strict true, noEmit true,
     "include": ["vite.config.ts"].
   - Do NOT add @types/node to package.json; it is not in the approved list. If you believe it is
     required for this file to typecheck, say so in your report and leave "types" out rather than
     adding an unapproved dependency.

4. frontend/vite.config.ts
   - Plugins: @vitejs/plugin-react and @tailwindcss/vite.
   - resolve.alias for "@" to ./src and "@contracts" to ../shared/contracts, using
     fileURLToPath(new URL(...)) so it works on Windows.
   - server.port 5173, and server.proxy sending "/api" to "http://localhost:8000" with
     changeOrigin true.
   - build.outDir "dist", build.sourcemap true.
   - A comment stating that the production app is served by the FastAPI backend from this dist
     directory, so there is no SSR and no second process.

5. frontend/.gitignore
   node_modules, dist, coverage, playwright-report, test-results, .vite

VERIFY
You cannot run commands. Verify by reading each file back and confirming: every version matches
this prompt exactly, the JSON parses as valid JSON by inspection, and the two path aliases appear
in both tsconfig.json and vite.config.ts with matching targets.

REPORT
- Every file you created.
- Confirmation that versions match this prompt exactly, or any place they do not.
- Whether you believe @types/node is needed, without adding it.
- Anything you could not do, stated plainly.

FORBIDDEN
- Do not run npm, npx, node, tsc, or any shell command, and do not claim you did.
- No git commands. No UI code. No CSS.
- Do not read or modify C:\Users\admin\Downloads\governance-app, a different project.
- Do not edit shared/contracts; the contract is frozen and owned by the orchestrator.
- Do not add any dependency that is not in the list above.
- Do not invent a version number.
