CONTINUE task P1-07. Nearly done. The orchestrator re-ran Gate 3:

- `npx tsc --noEmit` — clean.
- `npx eslint .` — **clean**. Both the memoization fix and the two distinct button names landed.
- `npx vite build` — succeeds.
- `npx vitest run` — **64 of 65 pass**. One test left.

**Rules unchanged: one file at a time, never in parallel, never a shell command.**

## The one failure

```
FAIL  renders unrecognised privilege code verbatim with the unknown badge and does not crash
TestingLibraryElementError: Found multiple elements with the text: Unknown
  src/features/assets/__tests__/AssetGrantsView.test.tsx:262
```

Your component is correct. This is the same scoping mistake as last round, one line further down.

Line 259 correctly scopes the privilege code to the table:

```tsx
expect(within(table).getByText("CUSTOM_UNKNOWN_PRIVILEGE_XYZ")).toBeTruthy();
```

but line 262 then falls back to the whole document:

```tsx
expect(screen.getByText(strings.assets.states.unknownBadge)).toBeTruthy();
```

`"Unknown"` is also the label of the **Unknown** option in the source filter `<select>`, which is
correct UI and must stay. So the query matches twice.

Scope it to the table, the same way, and tighten it while you are there: the assertion is that the
unknown badge sits **on the row carrying the unrecognised privilege**, not merely that the word
appears somewhere in the table. Find that row and assert within it, for example with
`within(table).getByRole("row", { name: /CUSTOM_UNKNOWN_PRIVILEGE_XYZ/ })` and then a `within` on
that row.

Do not use `getAllByText(...)[0]`, do not remove "Unknown" from the filter options, and keep the
remaining assertions in that test unchanged.

## Then report

State which P1-07 requirements are complete and which are not — the five columns, principal type as
icon plus text, privilege as `label — CODE` with the code in monospace, the three source treatments
each icon plus text, `allowed_actions` gating with `reason` visible and `navigate_to` as a link,
keyboard-clearable filters, the four states, and `meta.limitations` rendered under the table, never
collapsed, with the group-membership sentence verbatim.

## Scope, unchanged

Only `frontend/src/**`, plus an append to `tasks/STATUS.md` and your row in `tasks/TASK-BOARD.md`.
No dependency changes. Never run git. Do not claim you ran any command.
