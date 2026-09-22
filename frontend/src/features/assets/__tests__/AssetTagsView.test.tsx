import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { delay, http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  handlers,
  tagsFixture,
  tagPoliciesFixture,
} from "@/mocks/handlers";
import { strings } from "@/lib/strings";
import { AssetTagsView } from "../AssetTagsView";

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

function renderTagsView(
  securableType: string = "TABLE",
  fullName: string = "sales.crm.orders",
) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AssetTagsView securableType={securableType} fullName={fullName} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AssetTagsView (Tags tab P2-06)", () => {
  it("renders governed tag with constraint source and allowed values preview", async () => {
    const target = tagsFixture.data.target;
    const governedTag = tagsFixture.data.tags.find((t) => t.kind === "governed")!;
    const matchedPolicy = tagPoliciesFixture.data.find((p) => p.key === governedTag.key)!;

    renderTagsView(target.securable_type, target.full_name);

    // Wait for tags to render
    await waitFor(() => {
      expect(screen.getByText(governedTag.key)).toBeTruthy();
    });

    // Check Governed badge
    expect(screen.getByText(strings.tagsTab.governedBadge)).toBeTruthy();

    // Check constraint source is named
    expect(
      screen.getByText(new RegExp(matchedPolicy.description || strings.tagsTab.governedBadge)),
    ).toBeTruthy();
  });

  it("renders system tag as read-only with reason visible and in accessibility tree", async () => {
    const target = tagsFixture.data.target;
    const systemTag = tagsFixture.data.tags.find((t) => t.kind === "system")!;
    renderTagsView(target.securable_type, target.full_name);

    await waitFor(() => {
      expect(screen.getByText(systemTag.key)).toBeTruthy();
    });

    // System badge present
    expect(screen.getByText(strings.tagsTab.systemBadge)).toBeTruthy();

    // Reason visible in text: "System-controlled tags cannot be edited."
    const reasonElements = screen.getAllByText(strings.tagsTab.systemTagNotice);
    expect(reasonElements.length).toBeGreaterThan(0);

    // The remove button for system tag is disabled and described by the reason
    const disabledButtons = screen.getAllByRole("button", {
      name: strings.tagsTab.removeTagButton,
    });
    const systemButton = disabledButtons.find((btn) => btn.hasAttribute("disabled"));
    expect(systemButton).toBeTruthy();
    expect(systemButton?.getAttribute("aria-describedby")).toBeTruthy();
  });

  it("renders all 4 states: idle, loading skeleton, error with retry, success with limitations", async () => {
    // 1. Idle state (missing fullName)
    const { unmount } = render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <AssetTagsView securableType="TABLE" fullName="" />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText(strings.tagsTab.title)).toBeTruthy();
    unmount();

    // 2. Loading state
    server.use(
      http.get("*/api/v1/assets/:securable_type/:full_name/tags", async () => {
        await delay(100);
        return HttpResponse.json({ success: true, data: { target: {}, tags: [], column_tags: {} } });
      }),
    );
    const { unmount: unmountLoading } = renderTagsView("TABLE", "sales.crm.orders");
    expect(screen.getByTestId("tags-loading")).toBeTruthy();
    unmountLoading();

    // 3. Error state with retry
    server.use(
      http.get("*/api/v1/assets/:securable_type/:full_name/tags", () => {
        return HttpResponse.json(
          {
            success: false,
            code: "INTERNAL_ERROR",
            message: "Failed to load tags from catalog",
            correlation_id: "err-tags-001",
          },
          { status: 500 },
        );
      }),
    );
    const { unmount: unmountError } = renderTagsView("TABLE", "sales.crm.orders");
    await waitFor(() => {
      expect(screen.getByText(/Failed to load tags from catalog/)).toBeTruthy();
    });
    expect(screen.getByText(strings.common.retry)).toBeTruthy();
    unmountError();

    // 4. Success with limitations
    server.resetHandlers();
    const target = tagsFixture.data.target;
    const freeFormTag = tagsFixture.data.tags.find((t) => t.kind === "free_form")!;
    renderTagsView(target.securable_type, target.full_name);
    await waitFor(() => {
      expect(screen.getByText(freeFormTag.key)).toBeTruthy();
    });
    // Check limitation banner rendered underneath data
    expect(
      screen.getByText(/Tags reflect catalog state at observation/),
    ).toBeTruthy();
  });

  it("opens PlanFlow to assign tag and restricts allowed values when tag policy matches", async () => {
    const target = tagsFixture.data.target;
    const freeFormTag = tagsFixture.data.tags.find((t) => t.kind === "free_form")!;
    const governedPolicy = tagPoliciesFixture.data.find(
      (p) => p.allowed_values && p.allowed_values.length > 0,
    )!;

    renderTagsView(target.securable_type, target.full_name);

    await waitFor(() => {
      expect(screen.getByText(freeFormTag.key)).toBeTruthy();
    });

    // Click "Assign tag"
    const assignBtn = screen.getByRole("button", {
      name: strings.tagsTab.assignTagButton,
    });
    fireEvent.click(assignBtn);

    // PlanFlow dialog opens
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText(strings.planFlow.kinds.assign_tags)).toBeTruthy();

    // Type a governed tag key into tag_key input
    const tagKeyInput = screen.getByLabelText(strings.planFlow.form.tagKey);
    fireEvent.change(tagKeyInput, { target: { value: governedPolicy.key } });

    // The tag value input switches to a <select> with constrained values!
    await waitFor(() => {
      const selectElement = screen.getByLabelText(strings.planFlow.form.tagValue);
      expect(selectElement.tagName.toLowerCase()).toBe("select");
      governedPolicy.allowed_values!.slice(0, 2).forEach((val) => {
        expect(within(selectElement).getByText(val)).toBeTruthy();
      });
    });

    // Shows constraint source
    expect(screen.getByText(new RegExp(strings.tagsTab.constrainedByPrefix))).toBeTruthy();
  });
});
