CONTINUE task P0-05. Your last turn wrote all nine steps and the files are on disk. The orchestrator
ran Gate 3 for you. Two things fail. Nothing else is wrong: `npx eslint .` exits 0, and 28 of 38
tests pass.

**The rules that decide whether this turn survives, unchanged:**
1. Read files one at a time. Never in parallel, never in a batch, and never run a shell command.
   Do not run npm, npx, tsc, eslint, vitest or vite. The orchestrator runs them and reports back.
2. Write only the files listed below.

## Files that already exist, so you never need to look for them

```
frontend/vite.config.ts            frontend/package.json         frontend/tsconfig.json
frontend/tsconfig.node.json        frontend/eslint.config.js     frontend/index.html
frontend/src/main.tsx              frontend/src/index.css        frontend/src/vite-env.d.ts
frontend/src/api/client.ts         frontend/src/api/errors.ts    frontend/src/api/queries.ts
frontend/src/api/__tests__/client.test.ts
frontend/src/api/__tests__/errors.test.ts
frontend/src/app/AppShell.tsx      frontend/src/app/ContextBar.tsx
frontend/src/app/PageHeader.tsx    frontend/src/app/providers.tsx
frontend/src/app/routes.tsx        frontend/src/app/__tests__/ContextBar.test.tsx
frontend/src/design/tokens.css     frontend/src/lib/cn.ts        frontend/src/lib/fqn.ts
frontend/src/lib/strings.ts        frontend/src/mocks/browser.ts frontend/src/mocks/enable.ts
frontend/src/mocks/handlers.ts
```

There is **no** vitest config file anywhere in `frontend/`. That is defect 2.

## Defect 1 — one TypeScript error, `frontend/src/api/client.ts` line 91

Real `npx tsc --noEmit` output:

```
src/api/client.ts(91,33): error TS2379: Argument of type '{ method: "GET" | "POST" | "PATCH" |
"DELETE"; headers: Record<string, string>; body: string | undefined; signal: AbortSignal | undefined; }'
is not assignable to parameter of type 'RequestInit' with 'exactOptionalPropertyTypes: true'.
Consider adding 'undefined' to the types of the target's properties.
  Types of property 'body' are incompatible.
    Type 'string | undefined' is not assignable to type 'BodyInit | null'.
      Type 'undefined' is not assignable to type 'BodyInit | null'.
```

`tsconfig.json` sets `exactOptionalPropertyTypes: true`, which is correct and stays. The object
literal you pass to `fetch` sets `body` and `signal` to `undefined` explicitly; under that flag an
optional property may be absent but may not be present-and-undefined.

Fix it by building the `RequestInit` so the optional keys are **omitted** when there is no value,
rather than set to `undefined`. For example assemble a `const init: RequestInit = { method, headers }`
and then conditionally assign `init.body` and `init.signal` only when each one is defined. Do not
widen the type with `as`, do not add `| undefined` to a DOM type, and do not turn the compiler flag
off.

## Defect 2 — vitest has no DOM environment, which fails 10 of 38 tests

`jsdom@30.1.0` is already in `devDependencies`, so nothing needs installing. But no config selects
it, so vitest runs in the `node` environment. That single gap causes **both** failure groups:

Group A, all 7 tests in `src/app/__tests__/ContextBar.test.tsx`:

```
ReferenceError: document is not defined
 ❯ render node_modules/@testing-library/react/dist/pure.js:265:5
```

Group B, 3 of 5 tests in `src/api/__tests__/client.test.ts`:

```
TypeError: Failed to parse URL from /api/v1/test-202
Caused by: TypeError: Invalid URL
Serialized Error: { code: 'ERR_INVALID_URL', input: '/api/v1/test-202' }
AssertionError: expected TypeError: Failed to parse URL from /api/… to be an instance of ApiError
```

Group B is the same root cause: in the `node` environment there is no document origin, so the
root-relative paths your client builds cannot be resolved into absolute URLs. A jsdom environment
supplies one and both groups pass. Do not change the tests to use absolute URLs and do not change
`client.ts` to prepend an origin — the client building root-relative paths is correct, because in
production the SPA is served from the same origin as the API.

Write **one** new file, `frontend/vitest.config.ts`, that:

- imports `defineConfig` from `vitest/config`;
- applies the React plugin, so `.tsx` test files compile;
- repeats the two path aliases exactly as `vite.config.ts` declares them, `@` → `./src` and
  `@contracts` → `../shared/contracts`, using `fileURLToPath(new URL(..., import.meta.url))`;
- sets `test.environment` to `"jsdom"`;
- sets `test.include` to pick up `src/**/*.{test,spec}.{ts,tsx}`;
- sets `test.exclude` to leave the Playwright directory alone, so `npm run test` never tries to run
  the e2e specs;
- does **not** set `globals: true` — every test file already imports `describe`, `it` and `expect`
  from `vitest`, and leaving globals off keeps that explicit.

Do not edit `vite.config.ts`. A separate `vitest.config.ts` takes precedence for the test run and
leaves the build config untouched.

## What not to touch

Do not edit any other file. Do not edit `shared/contracts/**`, which is frozen at v1.0.0. Do not
change `tsconfig.json`. Do not add a dependency. Do not edit `tasks/TASK-BOARD.md` again — you
already marked P0-05 done, and the orchestrator will correct that row itself if Gate 3 still fails.

## Report

List the files you changed, and say in one sentence what you changed in `client.ts`. Do not claim
any command output; you cannot run commands and the orchestrator will run Gate 3 again.
