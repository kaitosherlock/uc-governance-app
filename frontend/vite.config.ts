// vite.config.ts
//
// NOTE: The production app is served by the FastAPI backend from the dist/ directory.
// There is no SSR and no second process — the FastAPI static mount serves index.html for
// all non-/api routes, so the SPA router handles client-side navigation.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "url";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],

  resolve: {
    alias: {
      // @/* → ./src/*  (mirrors tsconfig.json paths)
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // @contracts/* → ../shared/contracts/*  (immutable API types, outside src/)
      "@contracts": fileURLToPath(new URL("../shared/contracts", import.meta.url)),
    },
  },

  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },

  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
