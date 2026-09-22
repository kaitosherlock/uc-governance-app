import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { delay, http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { handlers, abacPoliciesFixture, abacPolicyImpactFixture } from "@/mocks/handlers";
import { strings } from "@/lib/strings";
import { PoliciesView } from "../PoliciesView";

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

function renderPoliciesView(initialEntry: string = "/policies") {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <PoliciesView />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("PoliciesView (ABAC Policies P2-06)", () => {
  it("renders ABAC policies list, inspects scope, condition, principals, and referenced function", async () => {
    renderPoliciesView();
    const policy = abacPoliciesFixture.data[0]!;

    // Wait for list to load
    await waitFor(() => {
      expect(screen.getByText(policy.name)).toBeTruthy();
    });

    // Check policy details in right panel
    expect(
      screen.getByText(`${policy.scope.full_name} (${policy.scope.securable_type})`),
    ).toBeTruthy();
    expect(screen.getByText(policy.function_full_name)).toBeTruthy();
    expect(screen.getByText(policy.when_condition)).toBeTruthy();
    policy.to_principals.forEach((p) => {
      expect(screen.getByText(p)).toBeTruthy();
    });
    policy.except_principals.forEach((p) => {
      expect(screen.getByText(p)).toBeTruthy();
    });
  });

  it("impact panel renders disclaimer adjacent to list and is NOT titled 'Effective access' or 'Who has access'", async () => {
    renderPoliciesView();
    const policy = abacPoliciesFixture.data[0]!;

    await waitFor(() => {
      expect(screen.getByText(policy.name)).toBeTruthy();
    });

    // Verify Title is NOT "Effective access" or "Who has access"
    expect(screen.queryByText(/Effective access/i)).toBeNull();
    expect(screen.queryByText(/Who has access/i)).toBeNull();
    expect(screen.queryByText(/Simulated result/i)).toBeNull();

    // Title matches approximation heading
    expect(screen.getByText(strings.policies.impactHeading)).toBeTruthy();

    // Verify Disclaimer is rendered in an adjacent, uncollapsed container
    const disclaimer = screen.getByTestId("impact-disclaimer");
    expect(disclaimer).toBeTruthy();
    expect(
      within(disclaimer).getByText(strings.policies.impactDisclaimer),
    ).toBeTruthy();

    // Check potentially affected assets listed
    abacPolicyImpactFixture.data.potentially_affected.forEach((asset) => {
      expect(screen.getByText(asset.full_name)).toBeTruthy();
    });
  });

  it("supports creating an ABAC policy through PlanFlow", async () => {
    renderPoliciesView();
    const policy = abacPoliciesFixture.data[0]!;

    await waitFor(() => {
      expect(screen.getByText(policy.name)).toBeTruthy();
    });

    // Click "Create ABAC Policy"
    const createBtn = screen.getByRole("button", {
      name: strings.policies.createPolicyButton,
    });
    fireEvent.click(createBtn);

    // PlanFlow dialog opens
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText(strings.planFlow.kinds.create_abac_policy)).toBeTruthy();

    // Fill form inputs
    const nameInput = screen.getByLabelText(strings.planFlow.form.policyName);
    fireEvent.change(nameInput, { target: { value: "filter_us_rows" } });

    const conditionInput = screen.getByLabelText(strings.planFlow.form.whenCondition);
    fireEvent.change(conditionInput, { target: { value: "has_tag('us_only')" } });

    const functionInput = screen.getByLabelText(strings.planFlow.form.functionFullName);
    fireEvent.change(functionInput, { target: { value: "security.filters.us_filter" } });

    const reasonInput = screen.getByLabelText(strings.planFlow.form.reason);
    fireEvent.change(reasonInput, { target: { value: "Creating compliance filter for US operations" } });

    // Preview change
    const previewBtn = screen.getByRole("button", { name: strings.planFlow.form.previewButton });
    fireEvent.click(previewBtn);

    await waitFor(() => {
      expect(screen.getByText(strings.planFlow.preview.normalizedChangesHeading)).toBeTruthy();
    });
  });

  it("renders all 4 states: loading skeleton, error with retry, empty, success with limitations", async () => {
    // 1. Loading state
    server.use(
      http.get("*/api/v1/abac-policies", async () => {
        await delay(100);
        return HttpResponse.json({ success: true, data: [], page: { page_size: 50, next_page_token: null } });
      }),
    );
    const { unmount: unmountLoading } = renderPoliciesView();
    expect(screen.getByTestId("policies-loading")).toBeTruthy();
    unmountLoading();

    // 2. Error state with retry
    server.use(
      http.get("*/api/v1/abac-policies", () => {
        return HttpResponse.json(
          {
            success: false,
            code: "INTERNAL_ERROR",
            message: "Failed to load policies",
            correlation_id: "err-abac-001",
          },
          { status: 500 },
        );
      }),
    );
    const { unmount: unmountError } = renderPoliciesView();
    await waitFor(() => {
      expect(screen.getByText(/Failed to load policies/)).toBeTruthy();
    });
    expect(screen.getByText(strings.common.retry)).toBeTruthy();
    unmountError();

    // 3. Empty state
    server.use(
      http.get("*/api/v1/abac-policies", () => {
        return HttpResponse.json({
          success: true,
          data: [],
          meta: { source: "fixture", observed_at: "2026-09-21T09:00:00Z", completeness: "complete", limitations: [], correlation_id: "c0ffee" },
          page: { page_size: 50, next_page_token: null },
        });
      }),
    );
    const { unmount: unmountEmpty } = renderPoliciesView();
    await waitFor(() => {
      expect(screen.getByText(strings.policies.emptyPolicies)).toBeTruthy();
    });
    unmountEmpty();

    // 4. Success state with limitations
    server.resetHandlers();
    renderPoliciesView();
    const policy = abacPoliciesFixture.data[0]!;
    await waitFor(() => {
      expect(screen.getByText(policy.name)).toBeTruthy();
    });
    expect(screen.getByText(/ABAC policies reflect catalog metadata/)).toBeTruthy();
  });
});
