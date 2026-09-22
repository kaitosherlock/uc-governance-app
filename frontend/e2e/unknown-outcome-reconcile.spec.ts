import { test, expect } from "@playwright/test";
import { strings } from "@/lib/strings";
import { captureScreenshots, runA11yScan } from "./helpers";

test("Journey 3: unknown outcome is reconciled, not retried @a11y", async ({ page }) => {
  // Pin clock into the frozen fixture window
  await page.clock.install({ time: new Date("2026-09-21T09:06:00Z") });

  // Count execution requests to verify mutation is never automatically retried
  let executeRequestCount = 0;
  page.on("request", (req) => {
    if (req.url().includes("/plans/") && req.url().includes("/execute")) {
      executeRequestCount++;
    }
  });

  // 1. Navigate to orders access tab with scenario=unknown-outcome
  await page.goto("/assets/sales/crm/TABLE/orders?tab=access&scenario=unknown-outcome");
  await expect(page.getByRole("heading", { level: 1, name: "orders" })).toBeVisible();

  const grantsTable = page.getByRole("table", { name: strings.access.grantsTable.title });
  await expect(grantsTable).toBeVisible();

  // 2. Open grant dialog through the action control in the Access view
  const grantActionBtn = page
    .getByText(/\d+.*grants/)
    .locator("..")
    .getByRole("button", { name: strings.assets.actions.grant });
  await expect(grantActionBtn).toBeVisible();
  await grantActionBtn.click();

  const dialog = page.getByRole("dialog", { name: strings.planFlow.kinds.grant });
  await expect(dialog).toBeVisible();

  // 3. Fill form and generate preview
  await dialog.getByPlaceholder(strings.planFlow.form.principalPlaceholder).fill("marketing-analysts");
  await dialog.getByPlaceholder(strings.planFlow.form.reasonPlaceholder).fill("Granting read access with unknown timeout scenario");

  const previewBtn = dialog.getByRole("button", { name: strings.planFlow.form.previewButton });
  await expect(previewBtn).toBeVisible();
  await previewBtn.click();

  // 4. Confirm execution
  const confirmBtn = dialog.getByRole("button", { name: strings.planFlow.confirm.standardButton });
  await expect(confirmBtn).toBeVisible();
  await confirmBtn.click();

  // 5. Assert the outcome-unknown state renders
  const outcomeHeading = dialog.getByRole("heading", {
    level: 3,
    name: strings.planFlow.outcome.heading,
  });
  await expect(outcomeHeading).toBeVisible();

  const unknownHeading = dialog.getByRole("heading", {
    name: strings.planFlow.outcome.unknownTitle,
  });
  await expect(unknownHeading).toBeVisible();

  const unknownSummary = dialog.getByText(strings.planFlow.outcome.unknownSummary);
  await expect(unknownSummary).toBeVisible();

  // 6. Assert Retry is disabled
  const retryBtn = dialog.getByRole("button", { name: strings.planFlow.outcome.retry });
  await expect(retryBtn).toBeVisible();
  await expect(retryBtn).toBeDisabled();

  // 7. Assert Check current state is the only forward action
  const checkStateBtn = dialog.getByRole("button", {
    name: strings.planFlow.outcome.checkCurrentState,
  });
  await expect(checkStateBtn).toBeVisible();
  await expect(checkStateBtn).toBeEnabled();

  // Capture screenshots of unknown outcome
  await captureScreenshots(page, "unknown-outcome");

  // Run a11y check on unknown outcome state
  await runA11yScan(page, "Unknown outcome state in PlanFlow");

  // 8. Click "Check current state" (reconciliation)
  await checkStateBtn.click();

  // 9. Assert the reconciled status replaces the unknown state
  const appliedHeading = dialog.getByRole("heading", {
    name: strings.planFlow.outcome.appliedTitle,
  });
  await expect(appliedHeading).toBeVisible();

  // Reconciled summary text
  await expect(dialog.getByText(/Operation reconciled/)).toBeVisible();

  // Unknown state elements are no longer present
  await expect(dialog.getByRole("heading", { name: strings.planFlow.outcome.unknownTitle })).toHaveCount(0);
  await expect(checkStateBtn).toHaveCount(0);

  // 10. Assert the mutation was never retried automatically
  expect(executeRequestCount).toBe(1);

  // Capture screenshots of reconciled state
  await captureScreenshots(page, "reconciled-outcome");
});
