import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

export async function captureScreenshots(page: Page, screenName: string): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({
    path: `../screenshots/synthetic-${screenName}-1440.png`,
  });

  await page.setViewportSize({ width: 375, height: 667 });
  await page.screenshot({
    path: `../screenshots/synthetic-${screenName}-375.png`,
  });

  await page.setViewportSize({ width: 1440, height: 900 });
}

export async function runA11yScan(page: Page, contextName: string): Promise<void> {
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
