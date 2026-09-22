import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse, delay } from "msw";
import { setupServer } from "msw/node";
import { handlers } from "@/mocks/handlers";
import { strings } from "@/lib/strings";
import { PlanFlow } from "../PlanFlow";
import planPreviewFixture from "../../../../../shared/contracts/examples/PlanResponse.grant-preview.json";
import operationUnknownFixture from "../../../../../shared/contracts/examples/OperationResponse.unknown-outcome.json";

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));

beforeEach(() => {
  // Pin system time to the fixture's timeline (between observed_at 2026-09-21T09:05:30Z and expires_at 2026-09-21T09:15:30Z).
  // This is essential for time-bearing fixtures to prevent plan preview from being treated as expired.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-21T09:06:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
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
      mutations: {
        retry: false,
      },
    },
  });
}

function renderPlanFlow(props: Partial<Parameters<typeof PlanFlow>[0]> = {}) {
  const queryClient = createTestQueryClient();
  const defaultProps = {
    kind: "grant" as const,
    targets: [
      {
        securable_type: "TABLE" as const,
        full_name: "sales.crm.orders",
      },
    ],
    initialChanges: {
      principal: "marketing-analysts",
      privileges: ["SELECT"],
    },
    isOpen: true,
    ...props,
  };

  return render(
    <QueryClientProvider client={queryClient}>
      <PlanFlow {...defaultProps} />
    </QueryClientProvider>,
  );
}

describe("PlanFlow (Mutation lifecycle P1-08)", () => {
  /* ---------------------------------------------------------------- Test 1 */
  it("preview renders description prominently and statement_preview only inside Details", async () => {
    renderPlanFlow();

    // Fill in reason (at least 3 characters)
    const reasonInput = screen.getByPlaceholderText(strings.planFlow.form.reasonPlaceholder);
    fireEvent.change(reasonInput, { target: { value: "Grant read access for marketing reports" } });

    // Click Preview change
    const previewBtn = screen.getByRole("button", { name: strings.planFlow.form.previewButton });
    fireEvent.click(previewBtn);

    // Wait for preview to render
    await waitFor(() => {
      expect(screen.getByText("Grant SELECT to `marketing-analysts`")).toBeTruthy();
    });

    const descriptionEl = screen.getByText("Grant SELECT to `marketing-analysts`");
    expect(descriptionEl.className).toContain("font-");

    // statement_preview must ONLY be inside <details>
    const detailsEl = screen.getByText(strings.planFlow.preview.statementPreviewSummary).closest("details");
    expect(detailsEl).toBeTruthy();

    const preEl = within(detailsEl!).getByText(/grants\.update\(securable_type=TABLE/);
    expect(preEl).toBeTruthy();
    expect(preEl.tagName.toLowerCase()).toBe("pre");
  });

  /* ---------------------------------------------------------------- Test 2 */
  it("impact.unknown is visible without any interaction", async () => {
    renderPlanFlow();

    const reasonInput = screen.getByPlaceholderText(strings.planFlow.form.reasonPlaceholder);
    fireEvent.change(reasonInput, { target: { value: "Compliance audit" } });

    fireEvent.click(screen.getByRole("button", { name: strings.planFlow.form.previewButton }));

    // Wait for unknown impact to be visible directly without any click or disclosure
    await waitFor(() => {
      expect(
        screen.getByText("Whether `marketing-analysts` already has SELECT through another group."),
      ).toBeTruthy();
    });

    expect(
      screen.getByText("Number of members in `marketing-analysts` (membership not loaded)."),
    ).toBeTruthy();

    // Verify it is inside the impact-unknown section
    const unknownSection = screen.getByTestId("impact-unknown");
    expect(unknownSection).toBeTruthy();
  });

  /* ---------------------------------------------------------------- Test 3 */
  it("typed confirmation keeps the control disabled until the exact value is typed, and rejects a case-mismatch", async () => {
    server.use(
      http.post("*/api/v1/plans", () => {
        return HttpResponse.json(
          {
            ...planPreviewFixture,
            data: {
              ...planPreviewFixture.data,
              requires_typed_confirmation: true,
              typed_confirmation_value: "sales.crm.orders",
            },
          },
          { status: 201 },
        );
      }),
    );

    renderPlanFlow();

    const reasonInput = screen.getByPlaceholderText(strings.planFlow.form.reasonPlaceholder);
    fireEvent.change(reasonInput, { target: { value: "Ownership transfer requiring typed confirmation" } });

    fireEvent.click(screen.getByRole("button", { name: strings.planFlow.form.previewButton }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(strings.planFlow.confirm.typedPlaceholder)).toBeTruthy();
    });

    const confirmBtn = screen.getByRole("button", {
      name: strings.planFlow.confirm.standardButton,
    }) as HTMLButtonElement;

    // Disabled initially
    expect(confirmBtn.disabled).toBe(true);

    const typedInput = screen.getByPlaceholderText(strings.planFlow.confirm.typedPlaceholder);

    // Type case mismatch: "sales.CRM.orders"
    fireEvent.change(typedInput, { target: { value: "sales.CRM.orders" } });
    expect(confirmBtn.disabled).toBe(true);

    // Type partial value
    fireEvent.change(typedInput, { target: { value: "sales.crm.order" } });
    expect(confirmBtn.disabled).toBe(true);

    // Type exact case-sensitive match
    fireEvent.change(typedInput, { target: { value: "sales.crm.orders" } });
    expect(confirmBtn.disabled).toBe(false);
  });

  /* ---------------------------------------------------------------- Test 4 */
  it("202 renders the unknown-outcome state, Retry is disabled, and Check current state calls reconcile", async () => {
    let reconcileCalled = false;

    server.use(
      http.post("*/api/v1/plans/:plan_id/execute", () => {
        // Return 202 Unknown outcome per spec
        return HttpResponse.json(operationUnknownFixture, { status: 202 });
      }),
      http.post("*/api/v1/operations/:operation_id/reconcile", () => {
        reconcileCalled = true;
        return HttpResponse.json({
          ...operationUnknownFixture,
          data: {
            ...operationUnknownFixture.data,
            status: "applied",
            summary: "Reconciled: grant was applied successfully.",
            reconcile_available: false,
          },
        });
      }),
    );

    renderPlanFlow();

    const reasonInput = screen.getByPlaceholderText(strings.planFlow.form.reasonPlaceholder);
    fireEvent.change(reasonInput, { target: { value: "Execute ambiguous mutation" } });
    fireEvent.click(screen.getByRole("button", { name: strings.planFlow.form.previewButton }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: strings.planFlow.confirm.standardButton })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: strings.planFlow.confirm.standardButton }));

    // 202 renders the Outcome Unknown state
    await waitFor(() => {
      expect(screen.getByText(strings.planFlow.outcome.unknownTitle)).toBeTruthy();
    });

    expect(screen.getByText(strings.planFlow.outcome.unknownSummary)).toBeTruthy();

    // Retry must be DISABLED
    const retryBtn = screen.getByRole("button", { name: strings.planFlow.outcome.retry }) as HTMLButtonElement;
    expect(retryBtn.disabled).toBe(true);

    // Check current state button calls reconcile
    const checkStateBtn = screen.getByRole("button", { name: strings.planFlow.outcome.checkCurrentState });
    expect(checkStateBtn).toBeTruthy();

    fireEvent.click(checkStateBtn);

    await waitFor(() => {
      expect(reconcileCalled).toBe(true);
      expect(screen.getByText("Reconciled: grant was applied successfully.")).toBeTruthy();
    });
  });

  /* ---------------------------------------------------------------- Test 5 */
  it("a stale 409 shows the regenerate message and preserves form values", async () => {
    server.use(
      http.post("*/api/v1/plans/:plan_id/execute", () => {
        return HttpResponse.json(
          {
            success: false,
            code: "PLAN_STALE",
            message: "The observed state changed since this preview was generated.",
            correlation_id: "corr-stale-001",
            next_steps: ["Regenerate the preview before applying."],
          },
          { status: 409 },
        );
      }),
    );

    renderPlanFlow();

    const reasonInput = screen.getByPlaceholderText(strings.planFlow.form.reasonPlaceholder) as HTMLTextAreaElement;
    fireEvent.change(reasonInput, { target: { value: "Preserved reason string across 409" } });

    const principalInput = screen.getByPlaceholderText(strings.planFlow.form.principalPlaceholder) as HTMLInputElement;
    fireEvent.change(principalInput, { target: { value: "analysts-preserved" } });

    fireEvent.click(screen.getByRole("button", { name: strings.planFlow.form.previewButton }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: strings.planFlow.confirm.standardButton })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: strings.planFlow.confirm.standardButton }));

    // 409 shows regenerate message
    await waitFor(() => {
      expect(screen.getByText(strings.planFlow.conflict.previewOutdated)).toBeTruthy();
    });

    expect(screen.getByRole("button", { name: strings.planFlow.conflict.regenerateButton })).toBeTruthy();

    // Form values must be preserved!
    expect(reasonInput.value).toBe("Preserved reason string across 409");
    expect(principalInput.value).toBe("analysts-preserved");
  });

  /* ---------------------------------------------------------------- Test 6 */
  it("a duplicate 409 shows the existing operation and does not execute twice", async () => {
    let executeAttempts = 0;
    let getOperationCalled = false;

    server.use(
      http.post("*/api/v1/plans/:plan_id/execute", () => {
        executeAttempts += 1;
        return HttpResponse.json(
          {
            success: false,
            code: "DUPLICATE_SUBMISSION",
            message: "An operation already exists for this preview.",
            correlation_id: "corr-dup-001",
            next_steps: ["Open the existing operation."],
            errors: [{ field: "operation_id", code: "DUPLICATE", message: "op-duplicate-123" }],
          },
          { status: 409 },
        );
      }),
      http.get("*/api/v1/operations/:operation_id", () => {
        getOperationCalled = true;
        return HttpResponse.json({
          success: true,
          data: {
            id: "op-duplicate-123",
            plan_id: "5f3c9a2e-1b7d-4e0a-9c11-2d6f8a0b1c22",
            kind: "grant",
            status: "applied",
            identity: {
              actor: { id: "u-1", display: "alice", kind: "user", roles: ["steward"], verified_by: "fixture" },
              executor: { kind: "service_principal", display: "uc-gov-sp", reason: "Grants API" },
            },
            started_at: "2026-09-21T09:00:00Z",
            finished_at: "2026-09-21T09:00:05Z",
            atomic: true,
            targets: [
              {
                target: { securable_type: "TABLE", full_name: "sales.crm.orders", kind: "table", display_name: "orders" },
                status: "applied",
                verified: true,
                verified_at: "2026-09-21T09:00:05Z",
                databricks_request_id: "req-dup-1",
                error: null,
                summary: "Already applied for `marketing-analysts` on sales.crm.orders",
              },
            ],
            reconcile_available: false,
            summary: "Existing operation completed.",
            correlation_id: "corr-dup-001",
          },
          meta: {
            source: "fixture",
            observed_at: "2026-09-21T09:00:05Z",
            completeness: "complete",
            limitations: [],
            correlation_id: "corr-dup-001",
          },
        });
      }),
    );

    renderPlanFlow();

    const reasonInput = screen.getByPlaceholderText(strings.planFlow.form.reasonPlaceholder);
    fireEvent.change(reasonInput, { target: { value: "Duplicate submission check" } });

    fireEvent.click(screen.getByRole("button", { name: strings.planFlow.form.previewButton }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: strings.planFlow.confirm.standardButton })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: strings.planFlow.confirm.standardButton }));

    // Shows the existing operation
    await waitFor(() => {
      expect(screen.getByText("Already applied for `marketing-analysts` on sales.crm.orders")).toBeTruthy();
    });

    expect(getOperationCalled).toBe(true);
    // Did NOT execute twice
    expect(executeAttempts).toBe(1);
  });

  /* ---------------------------------------------------------------- Test 7 */
  it("partially_applied shows per-target outcomes and is not presented as success", async () => {
    server.use(
      http.post("*/api/v1/plans/:plan_id/execute", () => {
        return HttpResponse.json(
          {
            success: true,
            data: {
              id: "op-partial-001",
              plan_id: "5f3c9a2e-1b7d-4e0a-9c11-2d6f8a0b1c22",
              kind: "grant",
              status: "partially_applied",
              identity: {
                actor: { id: "u-1", display: "alice", kind: "user", roles: ["steward"], verified_by: "fixture" },
                executor: { kind: "service_principal", display: "uc-gov-sp", reason: "Grants API" },
              },
              started_at: "2026-09-21T09:00:00Z",
              finished_at: "2026-09-21T09:00:05Z",
              atomic: false,
              targets: [
                {
                  target: { securable_type: "TABLE", full_name: "sales.crm.orders", kind: "table", display_name: "orders" },
                  status: "applied",
                  verified: true,
                  verified_at: "2026-09-21T09:00:05Z",
                  databricks_request_id: "req-1",
                  error: null,
                  summary: "Granted SELECT on sales.crm.orders",
                },
                {
                  target: { securable_type: "TABLE", full_name: "sales.crm.customers", kind: "table", display_name: "customers" },
                  status: "failed",
                  verified: false,
                  verified_at: null,
                  databricks_request_id: "req-2",
                  error: {
                    code: "INSUFFICIENT_PRIVILEGES",
                    message: "Service principal lacks MANAGE privilege on sales.crm.customers",
                  },
                  summary: "Failed to grant SELECT on sales.crm.customers",
                },
              ],
              reconcile_available: false,
              summary: "1 of 2 targets succeeded.",
              correlation_id: "corr-partial-001",
            },
            meta: {
              source: "fixture",
              observed_at: "2026-09-21T09:00:05Z",
              completeness: "partial_visibility",
              limitations: [],
              correlation_id: "corr-partial-001",
            },
          },
          { status: 200 },
        );
      }),
    );

    renderPlanFlow();

    const reasonInput = screen.getByPlaceholderText(strings.planFlow.form.reasonPlaceholder);
    fireEvent.change(reasonInput, { target: { value: "Multi-table grant" } });

    fireEvent.click(screen.getByRole("button", { name: strings.planFlow.form.previewButton }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: strings.planFlow.confirm.standardButton })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: strings.planFlow.confirm.standardButton }));

    // Partially applied title is shown
    await waitFor(() => {
      expect(screen.getByText(strings.planFlow.outcome.partialTitle)).toBeTruthy();
    });

    // Pure success title must NOT be shown
    expect(screen.queryByText(strings.planFlow.outcome.appliedTitle)).toBeNull();

    // Per-target outcomes are shown inside the outcome region
    const outcomeRegion = screen.getByRole("region", {
      name: strings.planFlow.outcome.heading,
    });
    expect(within(outcomeRegion).getByText("sales.crm.orders")).toBeTruthy();
    expect(within(outcomeRegion).getByText("Granted SELECT on sales.crm.orders")).toBeTruthy();

    expect(within(outcomeRegion).getByText("sales.crm.customers")).toBeTruthy();
    expect(
      within(outcomeRegion).getByText(
        "Service principal lacks MANAGE privilege on sales.crm.customers",
      ),
    ).toBeTruthy();
  });

  /* ---------------------------------------------------------------- Test 8 */
  it("editing a field after preview collapses the preview", async () => {
    renderPlanFlow();

    const reasonInput = screen.getByPlaceholderText(strings.planFlow.form.reasonPlaceholder);
    fireEvent.change(reasonInput, { target: { value: "Initial reason string" } });

    const principalInput = screen.getByPlaceholderText(strings.planFlow.form.principalPlaceholder);
    fireEvent.change(principalInput, { target: { value: "initial-principal" } });

    fireEvent.click(screen.getByRole("button", { name: strings.planFlow.form.previewButton }));

    // Preview is visible
    await waitFor(() => {
      expect(screen.getByText(strings.planFlow.preview.normalizedChangesHeading)).toBeTruthy();
    });

    // Edit principal input
    fireEvent.change(principalInput, { target: { value: "edited-principal" } });

    // Preview collapses immediately per spec
    await waitFor(() => {
      expect(screen.queryByText(strings.planFlow.preview.normalizedChangesHeading)).toBeNull();
    });

    // Preview button is restored
    expect(screen.getByRole("button", { name: strings.planFlow.form.previewButton })).toBeTruthy();
  });

  /* ---------------------------------------------------------------- Test 9 */
  it("the execute button cannot be double-submitted", async () => {
    let executeCalls = 0;

    server.use(
      http.post("*/api/v1/plans/:plan_id/execute", async () => {
        executeCalls += 1;
        await delay(100);
        return HttpResponse.json(operationUnknownFixture, { status: 200 });
      }),
    );

    renderPlanFlow();

    const reasonInput = screen.getByPlaceholderText(strings.planFlow.form.reasonPlaceholder);
    fireEvent.change(reasonInput, { target: { value: "Prevent double submission" } });

    fireEvent.click(screen.getByRole("button", { name: strings.planFlow.form.previewButton }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: strings.planFlow.confirm.standardButton })).toBeTruthy();
    });

    const confirmBtn = screen.getByRole("button", {
      name: strings.planFlow.confirm.standardButton,
    }) as HTMLButtonElement;

    // First click triggers execute
    fireEvent.click(confirmBtn);

    // Immediately disabled while in flight
    expect(confirmBtn.disabled).toBe(true);

    // Second click attempted during in-flight request
    fireEvent.click(confirmBtn);

    // Wait for the request to complete
    await waitFor(() => {
      expect(screen.getByText(strings.planFlow.outcome.heading)).toBeTruthy();
    });

    // Exactly one call was dispatched
    expect(executeCalls).toBe(1);
  });

  /* ---------------------------------------------------------------- Test 10 */
  it("PLAN_TAMPERED shows verification failed with correlation ID and does NOT show regenerate button", async () => {
    server.use(
      http.post("*/api/v1/plans/:plan_id/execute", () => {
        return HttpResponse.json(
          {
            success: false,
            code: "PLAN_TAMPERED",
            message: "Plan cryptographic signature verification failed.",
            correlation_id: "corr-tampered-999",
            next_steps: ["Contact security administrator."],
          },
          { status: 409 },
        );
      }),
    );

    renderPlanFlow();

    const reasonInput = screen.getByPlaceholderText(strings.planFlow.form.reasonPlaceholder);
    fireEvent.change(reasonInput, { target: { value: "Tampered test reason" } });
    fireEvent.click(screen.getByRole("button", { name: strings.planFlow.form.previewButton }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: strings.planFlow.confirm.standardButton })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: strings.planFlow.confirm.standardButton }));

    await waitFor(() => {
      expect(screen.getByText(strings.planFlow.conflict.planTampered)).toBeTruthy();
    });

    expect(screen.getByText(strings.planFlow.conflict.planTamperedMessage)).toBeTruthy();
    expect(screen.getByText(/corr-tampered-999/)).toBeTruthy();

    // Regenerate preview button must NOT be present for tampered plan
    expect(screen.queryByRole("button", { name: strings.planFlow.conflict.regenerateButton })).toBeNull();
  });

  /* ---------------------------------------------------------------- Test 11 */
  it("PLAN_INVALIDATED shows superseded preview message and allows regenerate", async () => {
    server.use(
      http.post("*/api/v1/plans/:plan_id/execute", () => {
        return HttpResponse.json(
          {
            success: false,
            code: "PLAN_INVALIDATED",
            message: "A newer preview has replaced this plan.",
            correlation_id: "corr-inval-001",
            next_steps: ["Regenerate preview."],
          },
          { status: 409 },
        );
      }),
    );

    renderPlanFlow();

    const reasonInput = screen.getByPlaceholderText(strings.planFlow.form.reasonPlaceholder);
    fireEvent.change(reasonInput, { target: { value: "Invalidated test reason" } });
    fireEvent.click(screen.getByRole("button", { name: strings.planFlow.form.previewButton }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: strings.planFlow.confirm.standardButton })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: strings.planFlow.confirm.standardButton }));

    await waitFor(() => {
      expect(screen.getByText(strings.planFlow.conflict.planInvalidated)).toBeTruthy();
    });

    expect(screen.getByText(strings.planFlow.conflict.planInvalidatedMessage)).toBeTruthy();
    expect(screen.getByRole("button", { name: strings.planFlow.conflict.regenerateButton })).toBeTruthy();
  });

  /* ---------------------------------------------------------------- Test 12 */
  it("Escape key does not dismiss destructive confirmation, but dismisses standard preview", async () => {
    let closed = false;
    const onClose = () => {
      closed = true;
    };

    // 1. Destructive preview (requires_typed_confirmation: true)
    server.use(
      http.post("*/api/v1/plans", () => {
        return HttpResponse.json(
          {
            ...planPreviewFixture,
            data: {
              ...planPreviewFixture.data,
              requires_typed_confirmation: true,
              typed_confirmation_value: "sales.crm.orders",
            },
          },
          { status: 201 },
        );
      }),
    );

    const { unmount } = renderPlanFlow({ onClose });

    const reasonInput = screen.getByPlaceholderText(strings.planFlow.form.reasonPlaceholder);
    fireEvent.change(reasonInput, { target: { value: "Destructive change" } });
    fireEvent.click(screen.getByRole("button", { name: strings.planFlow.form.previewButton }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(strings.planFlow.confirm.typedPlaceholder)).toBeTruthy();
    });

    // Press Escape during destructive confirmation
    fireEvent.keyDown(window, { key: "Escape" });
    // Must NOT have closed!
    expect(closed).toBe(false);

    unmount();

    // 2. Standard preview (non-destructive)
    server.resetHandlers();
    renderPlanFlow({ onClose });

    const reasonInput2 = screen.getByPlaceholderText(strings.planFlow.form.reasonPlaceholder);
    fireEvent.change(reasonInput2, { target: { value: "Standard change" } });
    fireEvent.click(screen.getByRole("button", { name: strings.planFlow.form.previewButton }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: strings.planFlow.confirm.standardButton })).toBeTruthy();
    });

    // Press Escape during standard preview
    fireEvent.keyDown(window, { key: "Escape" });
    // MUST have closed!
    expect(closed).toBe(true);
  });
});
