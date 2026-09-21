GATE 3 REJECTION for task P0-02, frontend half. Fix exactly these items, change nothing else.

Your files were reviewed and the toolchain was installed and typechecked by the orchestrator. Two
dependency versions I gave you were wrong and I corrected them in frontend/package.json myself,
because resolving a dependency conflict is an orchestrator decision. Do not change them back:

- eslint is now 9.39.5, not 10.11.0. Reason: eslint-plugin-jsx-a11y@6.10.2 declares a peer range of
  eslint ^3 through ^9, so eslint 10 made the dependency tree unresolvable. Accessibility linting
  is required by docs/07-design-brief.md, so eslint was downgraded rather than dropping the plugin.
- typescript is now 6.0.3, not 7.0.2. Reason: typescript-eslint@8.70.0 declares a peer range of
  typescript >=4.8.4 <6.1.0, so TypeScript 7 was rejected.

`npm install` then succeeded, 420 packages, and frontend/package-lock.json now exists. Do not
create, edit, or delete package-lock.json.

THE ONE DEFECT TO FIX

`npx tsc --noEmit` reports exactly one error:

```
tsconfig.json(34,5): error TS5101: Option 'baseUrl' is deprecated and will stop functioning in
TypeScript 7.0. Specify compilerOption '"ignoreDeprecations": "6.0"' to silence this error.
```

Fix it the forward-compatible way: **remove `baseUrl` entirely** from frontend/tsconfig.json and
keep the `paths` mapping. Since TypeScript 4.1, `paths` entries resolve relative to the file that
declares them, so `baseUrl` is unnecessary. Do **not** add `ignoreDeprecations`, because that only
delays the same failure to TypeScript 7.

After removing it, the mapping must still be exactly:

```
"paths": {
  "@/*": ["./src/*"],
  "@contracts/*": ["../shared/contracts/*"]
}
```

SCOPE. Edit only frontend/tsconfig.json. Do not touch any other file, including package.json,
package-lock.json, vite.config.ts, tsconfig.node.json, or anything under shared/, backend/, docs/,
scripts/ or .ai/.

VERIFY
You cannot run commands, so do not claim you ran tsc. Verify by reading the file back and
confirming that `baseUrl` no longer appears anywhere in it and that both path aliases are intact
and unchanged.

REPORT
- The exact lines you removed.
- Confirmation that `baseUrl` appears nowhere in frontend/tsconfig.json.
- Confirmation that you changed no other file.

Then update tasks/TASK-BOARD.md row P0-02 evidence and append one line to tasks/STATUS.md, as
AGENTS.md section 2 requires.
