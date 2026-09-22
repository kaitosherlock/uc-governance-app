import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { delay, http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  handlers,
  rowAccessOrdersFixture,
  rowAccessCustomersFixture,
} from "@/mocks/handlers";
import { strings } from "@/lib/strings";
import { AssetRowAccessView } from "../AssetRowAccessView";

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => server.close());

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
}

function renderRowAccessView(fullName: string = "sales.crm.orders") {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AssetRowAccessView fullName={fullName} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AssetRowAccessView (Filters & Masks tab P2-06)", () => {
  it("renders ABAC-derived filter with policy link and notice that it cannot be edited or dropped directly", async () => {
    // sales.crm.orders has ABAC-derived row filter from rowAccessOrdersFixture
    const ordersData = rowAccessOrdersFixture.data;
    renderRowAccessView(ordersData.target.full_name);

    await waitFor(() => {
      expect(screen.getByText(ordersData.row_filter!.function_full_name)).toBeTruthy();
    });

    // ABAC Badge
    expect(screen.getAllByText(strings.rowAccess.abacBadge).length).toBeGreaterThan(0);

    // Non-editable notice rendered
    expect(screen.getAllByText(strings.rowAccess.abacNotice).length).toBeGreaterThan(0);

    // Policy link rendered
    const policyLinks = screen.getAllByRole("link", {
      name: new RegExp(strings.rowAccess.viewPolicyLink.replace("{name}", ".*")),
    });
    expect(policyLinks.length).toBeGreaterThan(0);
    expect(policyLinks[0]?.getAttribute("href")).toContain(
      `/policies?selected=${encodeURIComponent(ordersData.row_filter!.policy_id!)}`,
    );

    // Drop button must NOT be present for ABAC-derived filter
    expect(screen.queryByRole("button", { name: strings.rowAccess.dropRowFilterButton })).toBeNull();
  });

  it("renders direct filter and drop preview shows what may become visible, unenumerable audience, and no-query-was-run note", async () => {
    // sales.crm.customers has direct row filter from rowAccessCustomersFixture
    const customersData = rowAccessCustomersFixture.data;
    renderRowAccessView(customersData.target.full_name);

    await waitFor(() => {
      expect(screen.getByText(customersData.row_filter!.function_full_name)).toBeTruthy();
    });

    // Direct Badge
    expect(screen.getAllByText(strings.rowAccess.directBadge).length).toBeGreaterThan(0);

    // Drop Row Filter button is present
    const dropBtn = screen.getByRole("button", {
      name: strings.rowAccess.dropRowFilterButton,
    });
    expect(dropBtn).toBeTruthy();
    fireEvent.click(dropBtn);

    // PlanFlow dialog opens for drop_row_filter
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText(strings.planFlow.kinds.drop_row_filter)).toBeTruthy();

    // Fill reason and click "Preview change"
    const reasonInput = screen.getByLabelText(strings.planFlow.form.reason);
    fireEvent.change(reasonInput, { target: { value: "Decommissioning regional filter for unified sales access" } });

    const previewBtn = screen.getByRole("button", { name: strings.planFlow.form.previewButton });
    fireEvent.click(previewBtn);

    // Wait for plan preview to load
    await waitFor(() => {
      expect(screen.getByText(strings.planFlow.preview.impactKnownHeading)).toBeTruthy();
    });

    // Known impact: Data may become visible
    expect(
      screen.getByText(new RegExp(`Data in ${customersData.target.full_name.replace(/\./g, "\\.")} may become visible`)),
    ).toBeTruthy();

    // Unknown impact section (SPEC REQUIREMENT: never collapsed/hidden)
    const unknownSection = screen.getByTestId("impact-unknown");
    expect(unknownSection).toBeTruthy();
    expect(within(unknownSection).getByText(/Downstream queries and users cannot enumerate without live query execution/)).toBeTruthy();
    expect(within(unknownSection).getByText(/No query was run/)).toBeTruthy();
  });

  it("renders all 4 states: idle, loading skeleton, error with retry, success with limitations", async () => {
    // 1. Idle state (empty fullName)
    const { unmount: unmountIdle } = render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <AssetRowAccessView fullName="" />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText(strings.rowAccess.title)).toBeTruthy();
    unmountIdle();

    // 2. Loading state
    server.use(
      http.get("*/api/v1/assets/TABLE/:full_name/row-access", async () => {
        await delay(100);
        return HttpResponse.json({ success: true, data: { target: {}, row_filter: null, column_masks: [], allowed_actions: [] } });
      }),
    );
    const { unmount: unmountLoading } = renderRowAccessView("sales.crm.orders");
    expect(screen.getByTestId("row-access-loading")).toBeTruthy();
    unmountLoading();

    // 3. Error state with retry
    server.use(
      http.get("*/api/v1/assets/TABLE/:full_name/row-access", () => {
        return HttpResponse.json(
          {
            success: false,
            code: "INTERNAL_ERROR",
            message: "Failed to load row access configuration",
            correlation_id: "err-ra-001",
          },
          { status: 500 },
        );
      }),
    );
    const { unmount: unmountError } = renderRowAccessView("sales.crm.orders");
    await waitFor(() => {
      expect(screen.getByText(/Failed to load row access configuration/)).toBeTruthy();
    });
    expect(screen.getByText(strings.common.retry)).toBeTruthy();
    unmountError();

    // 4. Success state with limitations
    server.resetHandlers();
    const ordersData = rowAccessOrdersFixture.data;
    renderRowAccessView(ordersData.target.full_name);
    await waitFor(() => {
      expect(screen.getByText(ordersData.row_filter!.function_full_name)).toBeTruthy();
    });
    // Check limitation banner rendered underneath data
    expect(
      screen.getByText(/Row filters and column masks reflect table metadata/),
    ).toBeTruthy();
  });
});
