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

test("Journey 1: find table, read access, preview grant, apply, and verify @a11y", async ({ page }) => {
  // Pin clock into the frozen fixture window
  await page.clock.install({ time: new Date("2026-09-21T09:06:00Z") });

  // 1. Start at home / browse view
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // Capture Data Assets browse view screenshots
  await captureScreenshots(page, "browse");

  // Accessibility check on browse view
  await runA11yScan(page, "Data Assets browse view");

  // 2. Browse to sales.crm.orders via catalog tree
  const expandSales = page.getByRole("button", {
    name: strings.assets.expandCatalogAria.replace("{name}", "sales"),
  });
  await expect(expandSales).toBeVisible();
  await expandSales.click();

  const expandCrm = page.getByRole("button", {
    name: strings.assets.expandSchemaAria.replace("{name}", "crm"),
  });
  await expect(expandCrm).toBeVisible();
  await expandCrm.click();

  const ordersLink = page.getByRole("link", { name: "orders", exact: true });
  await expect(ordersLink).toBeVisible();
  await ordersLink.click();

  // Assert navigation to orders table detail
  await expect(page).toHaveURL(/.*\/assets\/sales\/crm\/TABLE\/orders/);
  await expect(page.getByRole("heading", { level: 1, name: "orders" })).toBeVisible();

  // 3. Open Access tab and read access
  const accessTab = page.getByRole("tab", { name: strings.assets.tabs.access });
  await expect(accessTab).toBeVisible();
  await accessTab.click();
  await expect(accessTab).toHaveAttribute("aria-selected", "true");

  const grantsTable = page.getByRole("table", { name: strings.access.grantsTable.title });
  await expect(grantsTable).toBeVisible();

  // Capture Access tab screenshots
  await captureScreenshots(page, "access-tab");

  // Accessibility check on Access tab with grants rendered
  await runA11yScan(page, "Access tab with grants rendered");

  // 4. Start a grant through the action control in the Access view
  const grantActionBtn = page
    .getByText(/\d+.*grants/)
    .locator("..")
    .getByRole("button", { name: strings.assets.actions.grant });
  await expect(grantActionBtn).toBeVisible();
  await grantActionBtn.click();

  // Assert PlanFlow dialog opens
  const dialog = page.getByRole("dialog", { name: strings.planFlow.kinds.grant });
  await expect(dialog).toBeVisible();

  // 5. Fill the form
  const principalInput = dialog.getByPlaceholder(strings.planFlow.form.principalPlaceholder);
  await principalInput.fill("marketing-analysts");

  const reasonInput = dialog.getByPlaceholder(strings.planFlow.form.reasonPlaceholder);
  await reasonInput.fill("Grant SELECT to marketing analysts for reporting");

  const previewBtn = dialog.getByRole("button", { name: strings.planFlow.form.previewButton });
  await expect(previewBtn).toBeVisible();
  await previewBtn.click();

  // 6. Check the preview shows:
  // - Normalized change with description prominent
  const normalizedDesc = dialog.getByText("Grant SELECT to `marketing-analysts`");
  await expect(normalizedDesc).toBeVisible();

  // - statement_preview only inside Details
  const statementPreview = dialog.getByText(/grants\.update/);
  await expect(statementPreview).toBeHidden();

  // Open Details to view statement preview
  const statementSummary = dialog.getByText(strings.planFlow.preview.statementPreviewSummary);
  await statementSummary.click();
  await expect(statementPreview).toBeVisible();

  // - impact.unknown visible without interaction
  await expect(dialog.getByText(strings.planFlow.preview.impactUnknownHeading)).toBeVisible();
  await expect(
    dialog.getByText("Whether `marketing-analysts` already has SELECT through another group.")
  ).toBeVisible();

  // - Identity block naming the executing service principal
  await expect(dialog.getByText(strings.planFlow.preview.identityHeading)).toBeVisible();
  await expect(
    dialog.getByText(
      strings.planFlow.preview.identitySentence.replace(
        "{display}",
        "uc-governance-app (sp-7f3a…)"
      )
    )
  ).toBeVisible();

  // Accessibility check on PlanFlow preview with confirmation step open
  await runA11yScan(page, "PlanFlow preview with confirmation step open");

  // Capture PlanFlow preview screenshots
  await captureScreenshots(page, "grant-preview");

  // 7. Confirm and execute
  const confirmBtn = dialog.getByRole("button", { name: strings.planFlow.confirm.standardButton });
  await expect(confirmBtn).toBeVisible();
  await confirmBtn.click();

  // 8. Assert result panel appears IN THE PAGE under "Execution Outcome" heading
  const outcomeHeading = dialog.getByRole("heading", {
    level: 3,
    name: strings.planFlow.outcome.heading,
  });
  await expect(outcomeHeading).toBeVisible();

  // Per-target row
  await expect(dialog.getByText("sales.crm.orders")).toBeVisible();

  // Verified badge
  await expect(dialog.getByText(strings.planFlow.outcome.verifiedBadge)).toBeVisible();

  // Outcome title
  await expect(dialog.getByText(strings.planFlow.outcome.appliedTitle)).toBeVisible();

  // 9. Assert no toast is the only feedback and no Undo is offered
  const toastElements = page.locator("[role='status'], .toast, [data-sonner-toaster]");
  await expect(toastElements).toHaveCount(0);

  const undoBtn = page.getByRole("button", { name: /undo/i });
  await expect(undoBtn).toHaveCount(0);
  const undoLink = page.getByRole("link", { name: /undo/i });
  await expect(undoLink).toHaveCount(0);

  // Capture Execution Outcome screenshots
  await captureScreenshots(page, "grant-outcome");
});
