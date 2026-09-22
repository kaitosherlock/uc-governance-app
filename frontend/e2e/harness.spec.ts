// harness.spec.ts — proves the e2e harness itself works, nothing about any journey.
//
// ORCHESTRATOR-OWNED. Keep this file small. Its only job is to separate "the harness is
// broken" from "the journey is wrong" when a P1-10 spec fails, so that a failing run points
// at one of those two and not at both at once.
import { test, expect } from "@playwright/test";

test("the app shell boots with MSW serving the contract examples", async ({ page }) => {
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));

  await page.goto("/");

  // The shell renders an h1 on every route, so its presence proves React mounted rather
  // than that any particular data arrived.
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // The context bar is fed by GET /api/v1/context through the MSW worker. If the worker
  // failed to register, that request falls through to the dev server's /api proxy, which
  // has no backend behind it, and this assertion is what catches it.
  const contextResponse = await page.waitForResponse(
    (response) => response.url().includes("/api/v1/context"),
    { timeout: 15_000 },
  );
  expect(contextResponse.status()).toBe(200);

  expect(failures).toEqual([]);
});

test("the clock can be pinned into the frozen fixture's plan window", async ({ page }) => {
  // shared/contracts/examples/PlanResponse.grant-preview.json is valid from 09:05:30Z to
  // 09:15:30Z on 2026-09-21 and those timestamps are FROZEN. Against a real clock every
  // preview built from it is already expired, PlanFlow correctly refuses to execute an
  // expired plan, and the whole grant journey becomes untestable. Pinning the clock into
  // that window is the fix; relaxing the expiry check would not be.
  await page.clock.install({ time: new Date("2026-09-21T09:06:00Z") });
  await page.goto("/");

  const now = await page.evaluate(() => Date.now());
  expect(now).toBeGreaterThanOrEqual(Date.parse("2026-09-21T09:05:30Z"));
  expect(now).toBeLessThan(Date.parse("2026-09-21T09:15:30Z"));

  // The clock must still tick, or a countdown renders frozen and proves nothing.
  await page.clock.fastForward(1000);
  const later = await page.evaluate(() => Date.now());
  expect(later).toBeGreaterThan(now);
});
