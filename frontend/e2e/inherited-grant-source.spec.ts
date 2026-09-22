import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import fs from "node:fs";
import { strings } from "@/lib/strings";

const cwd = process.cwd();
const SCREENSHOTS_DIR = cwd.endsWith("frontend")
  ? path.resolve(cwd, "../screenshots")
  : path.resolve(cwd, "screenshots");

async function captureScreenshots(page: any, screenName: string) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, `synthetic-${screenName}-1440.png`),
  });

  await page.setViewportSize({ width: 375, height: 667 });
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, `synthetic-${screenName}-375.png`),
  });

  await page.setViewportSize({ width: 1440, height: 900 });
}

async function runA11yScan(page: any, contextName: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const seriousOrCritical = results.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious"
  );

  expect(
    seriousOrCritical,
    `Accessibility violations (${seriousOrCritical.length}) in ${contextName}: ${JSON.stringify(seriousOrCritical, null, 2)}`
  ).toEqual([]);
}

test("Journey 2: revoking an inherited grant sends user to source @a11y", async ({ page }) => {
  // Pin clock into the frozen fixture window
  await page.clock.install({ time: new Date("2026-09-21T09:06:00Z") });

  // 1. Navigate directly to orders table Access tab
  await page.goto("/assets/sales/crm/TABLE/orders?tab=access");
  await expect(page.getByRole("heading", { level: 1, name: "orders" })).toBeVisible();

  const grantsTable = page.getByRole("table", { name: strings.access.grantsTable.title });
  await expect(grantsTable).toBeVisible();

  // 2. Find grant whose source is inherited (e.g. sales-readers inherited from schema sales.crm)
  const inheritedRow = page.getByRole("row").filter({ hasText: "sales-readers" });
  await expect(inheritedRow).toBeVisible();

  // Verify source badge indicates inherited from schema
  const expectedInheritedText = strings.access.sources.inheritedFrom.replace("{kind}", "schema");
  await expect(inheritedRow.getByText(expectedInheritedText)).toBeVisible();

  // 3. Assert revoke control is NOT an enabled button:
  // It is not an enabled button (either disabled button or a link to the source)
  const revokeButton = inheritedRow.getByRole("button", { name: strings.assets.actions.revoke });
  await expect(revokeButton).toHaveCount(0);

  // Assert it IS a link to the object where the grant actually lives
  const sourceLink = inheritedRow.getByRole("link", {
    name: strings.assets.actions.viewPermissionsAtSource,
  });
  await expect(sourceLink).toBeVisible();
  await expect(sourceLink).toHaveAttribute("href", "/assets/sales/crm?tab=access");

  // Capture screenshot of inherited grant row with link
  await captureScreenshots(page, "inherited-grant");

  // Run a11y check on inherited grant view
  await runA11yScan(page, "Inherited grant row on table access view");

  // 4. Follow the link to the parent object
  await sourceLink.click();

  // 5. Assert the app navigates to the parent object's access view
  await expect(page).toHaveURL(/.*\/assets\/sales\/crm\?tab=access/);
  await expect(page.getByRole("heading", { level: 1, name: "sales.crm" })).toBeVisible();

  const parentAccessTab = page.getByRole("tab", { name: strings.assets.tabs.access });
  await expect(parentAccessTab).toBeVisible();
  await expect(parentAccessTab).toHaveAttribute("aria-selected", "true");

  const parentGrantsTable = page.getByRole("table", { name: strings.access.grantsTable.title });
  await expect(parentGrantsTable).toBeVisible();

  // Capture screenshot of parent object's access view
  await captureScreenshots(page, "parent-source");
});
