// eslint.config.js — ESLint 9 flat config for the UC Governance frontend.
//
// Wires typescript-eslint, react-hooks, and jsx-a11y with recommended rules.
// Strict enough that an unlabelled interactive control or a missing list key fails lint.
//
// Note: @eslint/js is NOT imported because it may not be installed as an explicit dependency.
// typescript-eslint's tseslint.config() already pulls in ESLint's recommended rules
// via tseslint.configs.recommended.
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";

export default tseslint.config(
  // Global ignores
  {
    // public/mockServiceWorker.js is generated verbatim by `npx msw init public --save`.
    // It is vendor code, not ours, and editing it to satisfy a linter would be undone by
    // the next regeneration.
    ignores: [
      "dist",
      "node_modules",
      "coverage",
      "playwright-report",
      "test-results",
      "public/mockServiceWorker.js",
    ],
  },

  // TypeScript-ESLint recommended (includes ESLint core recommended rules)
  ...tseslint.configs.recommended,

  // React hooks + jsx-a11y, scoped to TS/TSX files, plugins as object (ESLint 9 flat config form)
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
    },
    rules: {
      // React hooks rules (from eslint-plugin-react-hooks 7.x)
      ...reactHooks.configs.recommended.rules,
      // Accessibility rules (from eslint-plugin-jsx-a11y 6.10.x flat config)
      ...jsxA11y.flatConfigs.recommended.rules,
      // Allow unused vars when prefixed with underscore
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
