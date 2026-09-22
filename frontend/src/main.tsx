/**
 * main.tsx — Vite React entry point.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppProviders } from "./app/providers";
import { enableMocking } from "./mocks/enable";
import "./index.css";

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("Root element #root not found in the document.");
}

enableMocking().then(() => {
  createRoot(rootEl).render(
    <StrictMode>
      <AppProviders />
    </StrictMode>,
  );
});
