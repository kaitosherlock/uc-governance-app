/**
 * ContextBar.test.tsx — Unit tests for ContextBar component.
 *
 * Verifies:
 * - Renders the three mode labels correctly.
 * - Renders actor and executor as separate elements.
 * - Renders loading state.
 * - Renders error state with correlation ID in details.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Context, Identity, ModeLabel } from "@contracts/types";
import { ContextBar } from "../ContextBar";
import { strings } from "@/lib/strings";

function makeContext(modeLabel: ModeLabel): Context {
  return {
    mode: modeLabel === "Demo — synthetic data" ? "fixture" : modeLabel === "Read-only" ? "connected_readonly" : "connected",
    mode_label: modeLabel,
    environment_label: "staging",
    workspace_host: "adb-123456.7.azuredatabricks.net",
    workspace_id: "ws-123",
    managed_catalogs: ["analytics", "marketing"],
    support_contact: "admin@example.com",
    bootstrap_allowlist_active: false,
    warehouse_configured: true,
    durable_store_configured: true,
    account_client_configured: true,
  };
}

const mockIdentity: Identity = {
  actor: {
    id: "u-1001",
    display: "alice.steward@example.com",
    kind: "user",
    roles: ["steward"],
    verified_by: "fixture",
  },
  executor: {
    kind: "service_principal",
    display: "uc-governance-app-sp",
    reason: "Unity Catalog service principal execution",
  },
};

describe("ContextBar", () => {
  const modeLabels: ModeLabel[] = [
    "Demo — synthetic data",
    "Read-only",
    "Editing enabled",
  ];

  it.each(modeLabels)("renders mode label: %s", (modeLabel) => {
    const ctx = makeContext(modeLabel);
    render(
      <ContextBar
        context={ctx}
        identity={mockIdentity}
        loading={false}
      />,
    );

    const modeEl = screen.getByText(modeLabel);
    expect(modeEl).toBeTruthy();
  });

  it("renders actor and executor as separate elements", () => {
    const ctx = makeContext("Demo — synthetic data");
    render(
      <ContextBar
        context={ctx}
        identity={mockIdentity}
        loading={false}
      />,
    );

    const actorLabel = strings.context.actorAriaLabel.replace(
      "{name}",
      mockIdentity.actor.display,
    );
    const executorLabel = strings.context.executorAriaLabel.replace(
      "{name}",
      mockIdentity.executor.display,
    );

    const actorEl = screen.getByLabelText(actorLabel);
    const executorEl = screen.getByLabelText(executorLabel);

    expect(actorEl).toBeTruthy();
    expect(executorEl).toBeTruthy();
    expect(actorEl).not.toBe(executorEl);
    expect(actorEl.textContent).toContain(mockIdentity.actor.display);
    expect(executorEl.textContent).toContain(mockIdentity.executor.display);
  });

  it("renders loading state with accessible label", () => {
    render(
      <ContextBar
        context={null}
        identity={null}
        loading={true}
      />,
    );

    const skeletonBanner = screen.getByRole("banner", {
      name: strings.context.barLoadingLabel,
    });
    expect(skeletonBanner).toBeTruthy();
  });

  it("renders error state with mapped title, body, and correlation ID", () => {
    const errorDesc = {
      title: "Forbidden role",
      body: "Your application role does not have permission.",
      nextSteps: ["Contact admin"],
      correlationId: "corr-test-error-456",
    };

    render(
      <ContextBar
        context={null}
        identity={null}
        loading={false}
        error={errorDesc}
      />,
    );

    expect(screen.getByText("Forbidden role:")).toBeTruthy();
    expect(
      screen.getByText("Your application role does not have permission."),
    ).toBeTruthy();
    expect(screen.getByText(/corr-test-error-456/)).toBeTruthy();
    expect(screen.getByText(/Contact admin/)).toBeTruthy();
  });

  it("renders limitations when present", () => {
    const ctx = makeContext("Demo — synthetic data");
    render(
      <ContextBar
        context={ctx}
        identity={mockIdentity}
        loading={false}
        limitations={["No read-back performed", "Approvals unavailable"]}
      />,
    );

    expect(screen.getByText(/No read-back performed/)).toBeTruthy();
  });
});
