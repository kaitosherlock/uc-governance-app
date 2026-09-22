// playwright.config.ts — end-to-end harness for the UC Governance frontend.
//
// ORCHESTRATOR-OWNED. This is test harness and build configuration, not product code.
//
// The app under test is the Vite dev server with MSW running in the browser. That is a
// deliberate choice, not a shortcut:
//
//   * src/mocks/enable.ts starts the MSW worker only when import.meta.env.DEV is true and
//     VITE_USE_MSW is not "false", so a production build CANNOT serve mocked data. Running
//     e2e against `vite preview` would therefore hit a real backend, which no gate can
//     depend on.
//   * The MSW handlers are built from shared/contracts/examples/, so an e2e run exercises
//     the same frozen contract payloads the unit tests use. A journey that passes here
//     passed against the contract, not against a hand-written stub.
//   * No Python process is required, so this gate runs anywhere the other seven do.
//
// The dev server also proxies /api to localhost:8000. The service worker intercepts first,
// so that proxy never fires for a handled route. An UNHANDLED /api request falls through to
// the proxy and fails with a connection error — if a spec dies that way, the cause is a
// missing MSW handler, not a broken backend.
import { defineConfig, devices } from "@playwright/test";

const PORT = 5173;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts/,

  // A journey that only passes sometimes is a journey that documents nothing.
  // Fail the run rather than retry it green.
  retries: 0,
  forbidOnly: !!process.env.CI,
  workers: 1,

  timeout: 30_000,
  expect: { timeout: 10_000 },

  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  outputDir: "test-results",

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },

  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],

  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
