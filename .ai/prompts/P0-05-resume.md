CONTINUE task P0-05. Your last two turns both ended early: the first tried a parallel file read,
the second ran out of tokens partway through writing.

**Two rules that decide whether this turn survives:**
1. Read files one at a time. Never in parallel, never in a batch, never a shell command.
2. Write `frontend/src/lib/strings.ts` FIRST, before any file that imports from it. Your previous
   turn wrote `frontend/src/api/errors.ts` referencing `strings.errorCodes`, which does not exist,
   so the typecheck broke. That file has been moved out of the build to keep the tree green and is
   preserved at `.ai/state/partial/P0-05.errors.ts.partial`. Read it, reuse what is good, and write
   it back to `frontend/src/api/errors.ts` only after the strings it needs exist.

Write in this order so the tree is never broken partway:
1. `frontend/src/lib/strings.ts` — add an `errorCodes` group with one entry per `ErrorCode`, each
   with a short `title` and a `body`, plus any other strings you need. All 21 codes must be present.
2. `frontend/src/api/errors.ts` — `ApiError` and `describeError`.
3. `frontend/src/api/client.ts` — the only `fetch` in the app.
4. `frontend/src/api/queries.ts` — `useContext`, `useMe`, `useCapabilities`.
5. `frontend/src/mocks/handlers.ts`, `browser.ts`, `enable.ts`.
6. `frontend/src/app/providers.tsx` — add `QueryClientProvider`, keep the router.
7. `frontend/src/main.tsx` — call the MSW enabler before render.
8. `frontend/src/app/AppShell.tsx` — replace the hardcoded
   `context={null} identity={null} loading={false}` with the real hooks.
9. The three test files.

If you run low on capacity, stop after a numbered step rather than mid-file, and say which step you
reached. A green tree with fewer files is worth more than a broken tree with more.

Everything else in `.ai/prompts/P0-05.md` and `.ai/prompts/P0-05-continue.md` still applies,
including the inlined contract facts, so you do not need to re-read the contract.
