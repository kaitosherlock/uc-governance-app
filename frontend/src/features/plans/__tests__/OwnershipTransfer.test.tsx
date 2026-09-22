import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { setupServer } from "msw/node";
import { handlers } from "@/mocks/handlers";
import { strings } from "@/lib/strings";
import { PlanFlow } from "../PlanFlow";

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

describe("OwnershipTransfer (PlanFlow P2-06)", () => {
  it("requires typed-name confirmation matching the target name exactly before execution is permitted", async () => {
    const handleSuccess = vi.fn();

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <PlanFlow
            kind="transfer_ownership"
            targets={[
              {
                securable_type: "CATALOG",
                full_name: "sales",
              },
            ]}
            isOpen={true}
            onSuccess={handleSuccess}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Verify Title
    expect(screen.getByText(strings.planFlow.kinds.transfer_ownership)).toBeTruthy();

    // Fill form: new_owner and reason
    const newOwnerInput = screen.getByLabelText(strings.planFlow.form.newOwner);
    fireEvent.change(newOwnerInput, { target: { value: "alice.steward@example.test" } });

    const reasonInput = screen.getByLabelText(strings.planFlow.form.reason);
    fireEvent.change(reasonInput, { target: { value: "Transferring catalog ownership to verified steward" } });

    // Submit form to generate plan preview
    const previewBtn = screen.getByRole("button", { name: strings.planFlow.form.previewButton });
    fireEvent.click(previewBtn);

    // Wait for plan preview to load
    await waitFor(() => {
      expect(screen.getByText(strings.planFlow.preview.normalizedChangesHeading)).toBeTruthy();
    });

    // Verify typed confirmation is required with prompt containing target name
    expect(
      screen.getByText(
        new RegExp(strings.planFlow.confirm.typedPrompt.replace("{name}", "sales")),
      ),
    ).toBeTruthy();

    // Confirm button is initially disabled
    const confirmBtn = screen.getByRole("button", { name: strings.planFlow.confirm.standardButton });
    expect(confirmBtn.hasAttribute("disabled")).toBe(true);

    // Find typed confirmation input
    const typedInput = screen.getByPlaceholderText(strings.planFlow.confirm.typedPlaceholder);

    // 1. Enter partial / incorrect value
    fireEvent.change(typedInput, { target: { value: "sale" } });
    expect(confirmBtn.hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(strings.planFlow.confirm.typedMismatchNotice)).toBeTruthy();

    // 2. Enter exact required value "sales"
    fireEvent.change(typedInput, { target: { value: "sales" } });
    expect(confirmBtn.hasAttribute("disabled")).toBe(false);
    expect(screen.queryByText(strings.planFlow.confirm.typedMismatchNotice)).toBeNull();

    // 3. Execute plan
    fireEvent.click(confirmBtn);

    // Wait for applied outcome
    await waitFor(() => {
      expect(screen.getByText(strings.planFlow.outcome.appliedTitle)).toBeTruthy();
    });

    expect(handleSuccess).toHaveBeenCalledTimes(1);
  });
});
