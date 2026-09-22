// vitest.config.ts — Vitest configuration for UC Governance frontend.
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "url";

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      // @/* → ./src/*  (mirrors tsconfig.json paths)
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // @contracts/* → ../shared/contracts/*  (immutable API types, outside src/)
      "@contracts": fileURLToPath(new URL("../shared/contracts", import.meta.url)),
    },
  },

  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**", "dist/**"],
  },
});
