GATE 3 REJECTION for task P0-04. Two defects. Fix exactly these and change nothing else.

All twelve files you were asked to write exist. These are configuration defects, not design
defects.

**Reminder that matters more than anything else here: never invoke a tool that runs a shell
command.** No `ls`, no `tsc`, no `npx`, no `eslint`, no file-existence check. Every attempt is
auto-denied and ends your turn with nothing written. Read files by exact path and write them. The
orchestrator runs the verification commands.

DEFECT 1, TypeScript, two errors from one cause

```
tsconfig.json(40,18): error TS6306: Referenced project 'frontend/tsconfig.node.json' must have
                      setting "composite": true.
tsconfig.json(40,18): error TS6310: Referenced project 'frontend/tsconfig.node.json' may not
                      disable emit.
```

`frontend/tsconfig.json` lists `tsconfig.node.json` in a `references` array. TypeScript project
references require the referenced project to set `"composite": true` and to not set
`"noEmit": true`, and we deliberately want `noEmit` everywhere because Vite does the building.

Fix it by **removing the `references` array from `frontend/tsconfig.json` entirely.** The node-side
config stands alone: it has its own `include` of `vite.config.ts` and is applied directly, so the
reference buys nothing and only creates this conflict. Do not add `composite: true` and do not
remove `noEmit` from `tsconfig.node.json`.

Everything else in `frontend/tsconfig.json` must stay exactly as it is, in particular the `paths`
mapping with `@/*` and `@contracts/*`, and the continued absence of `baseUrl`.

DEFECT 2, ESLint flat config uses the old eslintrc plugin form

`frontend/eslint.config.js` contains:

```js
{
    "plugins": ["react-hooks"]
}
```

ESLint 9 flat config requires `plugins` to be an **object mapping a name to the imported plugin
module**, not an array of strings. Rewrite the file as a proper flat config. The shape you need:

```js
import js from "@eslint/js";                 // only if that package is installed; if not, omit it
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "coverage", "playwright-report", "test-results"] },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks, "jsx-a11y": jsxA11y },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
    },
  },
);
```

Adapt it to the real exports of the installed versions: `typescript-eslint` 8.70.0,
`eslint-plugin-react-hooks` 7.1.1, `eslint-plugin-jsx-a11y` 6.10.2, `eslint` 9.39.5.
**`@eslint/js` may not be installed**, so do not import it unless you are confident; the config
must work without it. Import nothing that is not already a dependency.

Keep the intent from the original task: strict enough that an unlabelled interactive control or a
missing list key fails lint.

VERIFY by reading both files back. Confirm `frontend/tsconfig.json` no longer contains
`references`, and that `frontend/eslint.config.js` passes `plugins` as an object and imports only
installed packages.

SCOPE. Edit only `frontend/tsconfig.json` and `frontend/eslint.config.js`. Touch nothing else, in
particular not `package.json`, `package-lock.json`, `tsconfig.node.json`, or anything under
`src/`, `shared/`, `backend/`, `docs/`, `scripts/` or `.ai/`.

REPORT the exact changes per file and anything you were unsure about. Then append one line to
`tasks/STATUS.md` and update your row in `tasks/TASK-BOARD.md`.
