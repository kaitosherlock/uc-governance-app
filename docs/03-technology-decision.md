# 03 — Technology decision (RATIFIED 2026-09-21)

Status: **ratified by task P0-02.** Versions below were resolved against PyPI and the npm registry
on 2026-09-21, written into `pyproject.toml` and `frontend/package.json` as exact pins, and proven
by a real install: `uv lock` resolved 70 packages, `uv sync --frozen` succeeded, `npm install`
added 420 packages, and `tsc --noEmit` exits clean. Lockfiles `uv.lock`, `requirements.txt`, and
`frontend/package-lock.json` are committed to the source root.

Two predictions in the provisional draft were wrong and are corrected below: the current majors are
Vite 8, React Router 8, TanStack Table 9, and zod 4, not the 7/7/8/3 the draft assumed. Two pins
also had to move down from "latest" because of real peer conflicts; see §1b.

## 1. Decision summary, as installed

| Layer | Choice | Installed pin |
|---|---|---|
| Backend runtime | **Python 3.11** (Databricks Apps default) | `requires-python = ">=3.11,<3.12"`, resolved on 3.11.15 |
| Databricks integration | **`databricks-sdk`**, official | 0.140.0 |
| Web framework | **FastAPI** + `uvicorn[standard]`, single process serving API and built SPA | 0.141.1 / 0.53.0 |
| Validation, settings | `pydantic`, `pydantic-settings` | 2.13.5 / 2.15.0 |
| Durable store driver | `psycopg[binary]`, isolated to `backend/app/persistence/` | 3.3.6 |
| Backend tooling | `uv`, `ruff`, `mypy`, `pytest`, `pytest-asyncio`, `schemathesis`, `httpx` | 0.11.26 / 0.16.8 / 2.3.1 / 9.1.1 / 1.4.0 / 4.27.5 / 0.28.1 |
| Frontend | **React 19 + TypeScript + Vite**, SPA, no SSR | react 19.3.0, vite 8.3.0, typescript 6.0.3 |
| Styling | **Tailwind CSS v4** with the Vite plugin | 4.3.3 |
| Component foundation | **shadcn/ui** on Radix, copied into the repo in P0-04 | added in P0-04 |
| Data layer | TanStack Query, TanStack Table | 5.103.2 / 9.2.4 |
| Forms | react-hook-form + zod | 7.88.0 / 4.6.5 |
| Routing | React Router | 8.4.0 |
| Lint | eslint + typescript-eslint + react-hooks + jsx-a11y | 9.39.5 / 8.70.0 / 7.1.1 / 6.10.2 |
| Test | vitest, Testing Library, jsdom, msw, Playwright, axe | 5.0.1 / 16.3.3 / 30.1.0 / 2.15.0 / 1.63.0 / 4.13.0 |
| Lineage graph | Add only when P4 lineage work starts; candidate `@xyflow/react` | not added |

## 1b. Two pins deliberately below latest, with reasons

| Package | Latest | Installed | Why |
|---|---|---|---|
| `eslint` | 10.11.0 | **9.39.5** | `eslint-plugin-jsx-a11y@6.10.2` declares a peer range of eslint ^3 through ^9, so eslint 10 makes the tree unresolvable. Accessibility linting is required by `docs/07-design-brief.md`, so eslint moved down rather than dropping the plugin. Trade-off: npm warns that eslint 9 is no longer supported. Revisit when jsx-a11y supports eslint 10. |
| `typescript` | 7.0.2 | **6.0.3** | `typescript-eslint@8.70.0` declares a peer range of typescript >=4.8.4 <6.1.0, so TypeScript 7 is rejected. 6.0.3 is the highest version inside that range. |

Consequence recorded during Gate 3: TypeScript 6 deprecates `baseUrl`, so `frontend/tsconfig.json`
declares `paths` without it. Paths resolve relative to the declaring file, which is
forward-compatible with TypeScript 7. `ignoreDeprecations` was deliberately not used.

Architecture shape: **one Databricks App, one process.** FastAPI serves `/api/v1/*` and the
prebuilt Vite `dist/` at `/`. No SSR, no second service, no Node process in production.

## 2. Why this fits (evidence-linked)

### Backend: Python + databricks-sdk

- **Official provenance and coverage.** `databricks-sdk` is published by Databricks
  ([PyPI](https://pypi.org/project/databricks-sdk/), read-only mirror of the internal repo), and it
  is the SDK whose `WorkspaceClient`/`AccountClient` surfaces cover Unity Catalog grants, catalogs,
  schemas, tables, volumes, functions, models, storage/service credentials, external locations,
  workspace bindings, connections, shares/recipients/providers, metastores (workspace and account),
  SCIM users/groups/service principals, quality monitors, and SQL Statement Execution. Spec §4
  requires an official SDK; §3 says to assess SDK gaps before picking the language. No other
  language has an official SDK with comparable UC coverage today.
- **Runtime fit.** Python 3.11 is the default Apps runtime; `uv` is preinstalled and recommended
  ([system-env](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/system-env)).
- **Auth fit.** `WorkspaceClient()` reads `DATABRICKS_HOST`/`CLIENT_ID`/`CLIENT_SECRET`
  automatically; a per-request `WorkspaceClient(host=..., token=<x-forwarded-access-token>)` gives
  user-scoped calls. `AccountClient` is a separate, explicitly configured client (spec §8).
- **FastAPI over Flask/Django:** typed request/response models via pydantic map directly to the
  spec's contract requirements (stable error codes, `allowed_actions`, per-target outcomes) and
  generate OpenAPI for the frontend contract. Async request handling allows cancellation-friendly,
  bounded SDK/SQL calls. Django's ORM/admin are unnecessary weight; Flask needs several add-ons to
  reach parity.
- **Rejected: Node.js backend.** `@databricks/appkit` is official but is an *app framework*, not a
  governance SDK; there is no GA official TypeScript SDK with UC governance coverage equal to the
  Python SDK. Choosing Node would exclude or force hand-rolled REST for most of §7. Spec §3 warns
  against assuming an npm package is official/equivalent by name.

### Frontend: React 19 + TypeScript + Vite + shadcn/ui + Tailwind v4

- **Community evidence (dated, biased):** State of JS 2025 (collected late 2025, published 2026;
  11,952 happiness respondents) shows usage rankings unchanged year-over-year with React first,
  Vue second, Angular third, Svelte fifth, Solid eighth; Solid has the highest satisfaction for five
  years running at ~10% usage
  ([source](https://2025.stateofjs.com/en-US/libraries/front-end-frameworks/)). Bias: self-selected,
  English-heavy, JS-enthusiast sample; usage ≠ quality. It is used here only to judge *ecosystem
  depth and maintenance risk*, not visual quality.
- **Ecosystem for this app's needs.** The spec demands dense, accessible data tables, complex
  forms, dialogs with correct focus management, and long-path layouts. The React ecosystem has the
  most mature accessible primitives (Radix, used by shadcn/ui), the most mature headless table
  (TanStack Table v8 with virtualization), and first-class Playwright/Testing Library support.
  Vue (PrimeVue/Nuxt UI) and Svelte (Melt/bits-ui) are credible; they were not chosen because
  their headless-accessible + headless-table combination is younger and because both Antigravity
  and Codex agents in this project have stronger React/TS priors, reducing defect rate.
- **shadcn/ui, not a themed kit.** Components are copied into the repo and owned locally, which
  lets the design brief (`07-design-brief.md`) define a governance-specific token system rather
  than inheriting a SaaS look. Spec §11.1 requires a coherent token system; §3 forbids competing
  design systems. One system only.
- **Vite SPA, no Next.js.** Spec §3: no SSR or extra process without a concrete need. There is
  none: the app is authenticated, internal, and served by FastAPI. Vite gives fast local dev and a
  static `dist/` that Python serves.
- **Rejected: Streamlit.** Permitted by spec only if it meets the same UX bar. Streamlit cannot
  deliver route-preserving breadcrumbs, dialog focus management, keyboard-navigable dense tables,
  stale-plan invalidation UX, and WCAG 2.2 AA-targeted custom components without fighting the
  framework. Also, the sibling `../governance-app` folder is already a Streamlit attempt; this
  project deliberately does not repeat it.
- **Rejected: Angular.** Strong a11y (CDK) and forms, but heavier ceremony and less agent
  familiarity; no capability it uniquely provides here.
- **Rejected: Solid / Svelte.** Highest satisfaction, smaller a11y-primitive and table ecosystems;
  fewer battle-tested patterns for the specific components this app needs.

### Visual suitability check (required by spec §3.6)

Popularity does not decide visual quality. The finalizing agent must render at least the following
with the chosen stack in fixture mode and judge them in the browser before ratifying:
1. The access table with 200+ rows, long fully-qualified names, and source badges.
2. The grant preview panel with actor/execution-identity block.
3. A destructive confirmation dialog (type-the-name) at 375 px width.
If these look generic or break, fix the token system first; only switch frameworks if the
component foundation is the cause.

## 3. Dependency pinning rules

- Python: `pyproject.toml` with exact pins (`==`) and a `uv.lock`; also generate
  `requirements.txt` from the lock because Databricks Apps reads requirements files.
- Node: `package.json` with exact versions (no `^`), `package-lock.json` committed to the folder.
- Record final versions in the table in §1 with the date checked.
- Preview dependencies: none planned. Any preview SDK surface used for a governance domain must be
  flagged in `capability-matrix.md`, not hidden here.

## 4. Evidence log

| Date | Source | What was confirmed |
|---|---|---|
| 2026-09-21 | https://docs.databricks.com/aws/en/dev-tools/databricks-apps/system-env | Python 3.11, Node 22.16, uv 0.10.2, 2 vCPU/6 GB, env vars |
| 2026-09-21 | https://docs.databricks.com/aws/en/dev-tools/databricks-apps/app-runtime | app.yaml schema, array command, default commands |
| 2026-09-21 | https://docs.databricks.com/aws/en/dev-tools/databricks-apps/auth | SP identity, `x-forwarded-access-token`, scope list |
| 2026-09-21 | https://docs.databricks.com/aws/en/dev-tools/databricks-apps/http-headers | identity headers, local-simulation note |
| 2026-09-21 | https://docs.databricks.com/aws/en/dev-tools/databricks-apps/resources | 13 resource types incl. Lakebase, SQL warehouse, Secret |
| 2026-09-21 | https://docs.databricks.com/aws/en/dev-tools/databricks-apps/lakebase | PG* env vars, SP role with CONNECT/CREATE |
| 2026-09-21 | https://docs.databricks.com/aws/en/dev-tools/databricks-apps/best-practices | SP vs user auth guidance, secrets via valueFrom, stdout logging |
| 2026-09-21 | https://developers.databricks.com/docs/apps/development | AppKit (Node) workflow, `databricks apps validate/deploy`, port binding |
| 2026-09-21 | https://pypi.org/project/databricks-sdk/ | 0.140.0 on 2026-09-19, Python 3.10–3.13 |
| 2026-09-21 | https://2025.stateofjs.com/en-US/libraries/front-end-frameworks/ | usage order, satisfaction note, respondent count |
| (to add) | npm/PyPI pages for React, Vite, Tailwind, shadcn, TanStack, FastAPI, psycopg | exact versions at install |
