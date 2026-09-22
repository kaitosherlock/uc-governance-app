import { test, expect } from "@playwright/test";
import { strings } from "@/lib/strings";
import { captureScreenshots, runA11yScan } from "./helpers";

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
  const targetsSection = dialog
    .getByRole("heading", {
      level: 4,
      name: strings.planFlow.outcome.targetsHeading,
    })
    .locator("..");
  await expect(targetsSection.getByText("sales.crm.orders", { exact: true })).toBeVisible();

  // Verified badge
  await expect(dialog.getByText(strings.planFlow.outcome.verifiedBadge)).toBeVisible();

  // 9. Assert outcome persists in-page (no transient toast auto-dismiss) and no Undo is offered
  const toastContainers = page.locator(".toast, [data-sonner-toaster]");
  await expect(toastContainers).toHaveCount(0);

  // Outcome panel persists in-page rather than auto-dismissing
  await page.waitForTimeout(1000);
  await expect(outcomeHeading).toBeVisible();
  await expect(dialog.getByRole("heading", { name: strings.planFlow.outcome.appliedTitle })).toBeVisible();

  const undoBtn = page.getByRole("button", { name: /undo/i });
  await expect(undoBtn).toHaveCount(0);
  const undoLink = page.getByRole("link", { name: /undo/i });
  await expect(undoLink).toHaveCount(0);

  // Capture Execution Outcome screenshots
  await captureScreenshots(page, "grant-outcome");
});

