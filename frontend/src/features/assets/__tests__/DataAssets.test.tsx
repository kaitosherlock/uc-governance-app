import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { http, HttpResponse, delay } from "msw";
import { setupServer } from "msw/node";
import { handlers } from "@/mocks/handlers";
import { strings } from "@/lib/strings";
import { DataAssetsView } from "../DataAssetsView";
import { AssetActionControl } from "../AssetActionControl";
import { UnknownBadge } from "../UnknownBadge";
import { AssetSearch } from "../AssetSearch";
import { ErrorView } from "../StateViews";
import { ApiError, AbortError } from "@/api/errors";

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

function renderDataAssets(initialRoute = "/assets") {
  const queryClient = createTestQueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/assets" element={<DataAssetsView />}>
            <Route path=":catalog" element={<DataAssetsView />}>
              <Route path=":schema" element={<DataAssetsView />}>
                <Route path=":objectType/:name" element={<DataAssetsView />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Data Assets UI (P1-06)", () => {
  /* ---------------------------------------------------------------- Four States */
  describe("Four UI States", () => {
    it("1. Idle state: renders purposeful empty state when no scope is chosen", async () => {
      renderDataAssets("/assets");

      expect(
        screen.getByText(strings.assets.states.idleTitle),
      ).toBeTruthy();
      expect(
        screen.getByText(strings.assets.states.idleDescription),
      ).toBeTruthy();
    });

    it("2. Loading state: renders localized skeleton during pending fetch without full-page spinner", async () => {
      server.use(
        http.get("*/api/v1/assets/:securable_type/:full_name", async () => {
          await delay(200);
          return HttpResponse.json({
            success: true,
            data: {
              securable_type: "TABLE",
              full_name: "sales.crm.orders",
              kind: "table",
              display_name: "orders",
              owner: "data-eng",
              comment: "Test table",
              updated_at: null,
              managed: "managed",
              pipeline_managed: false,
              allowed_actions: [],
              properties: {},
              tags: [],
              columns: [],
              row_filter: null,
              view_definition: null,
              storage_location: null,
              table_type: "MANAGED",
              data_source_format: "DELTA",
              created_at: null,
              created_by: null,
              parent: null,
              raw: {},
            },
            meta: {
              source: "fixture",
              observed_at: "2026-09-21T09:00:00Z",
              completeness: "complete",
              limitations: [],
              correlation_id: "corr-1",
            },
          });
        }),
      );

      const { container } = renderDataAssets("/assets/sales/crm/TABLE/orders");

      // Verify localized skeleton elements exist
      const skeletons = container.querySelectorAll(".animate-pulse");
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it("3. Error state: renders ErrorResponse mapped with next_steps and correlation ID", async () => {
      server.use(
        http.get("*/api/v1/assets/:securable_type/:full_name", () => {
          return HttpResponse.json(
            {
              success: false,
              code: "INSUFFICIENT_PRIVILEGES",
              message: "The execution identity lacks required Unity Catalog privileges.",
              correlation_id: "corr-fail-999",
              next_steps: ["Ask your administrator for UC SELECT privilege"],
            },
            { status: 403 },
          );
        }),
      );

      renderDataAssets("/assets/sales/crm/TABLE/orders");

      await waitFor(() => {
        expect(
          screen.getByRole("alert"),
        ).toBeTruthy();
      });

      expect(
        screen.getByText(strings.errorCodes.INSUFFICIENT_PRIVILEGES.title),
      ).toBeTruthy();
      expect(
        screen.getByText("The execution identity lacks required Unity Catalog privileges."),
      ).toBeTruthy();
      expect(
        screen.getByText("Ask your administrator for UC SELECT privilege"),
      ).toBeTruthy();
      expect(
        screen.getByText("corr-fail-999"),
      ).toBeTruthy();
      expect(
        screen.getByRole("button", { name: strings.common.retry }),
      ).toBeTruthy();
      expect(screen.queryByText(strings.errors.generic)).toBeNull();
    });

    it("4. Success state: renders asset overview and meta.limitations under the data", async () => {
      renderDataAssets("/assets/sales/crm/TABLE/orders");

      await waitFor(() => {
        expect(screen.getByLabelText("sales.crm.orders")).toBeTruthy();
      });

      // Data is present
      expect(screen.getByText("data-eng-owners")).toBeTruthy();
      expect(screen.getByText("One row per customer order. Source: CRM nightly export.")).toBeTruthy();

      // Limitations from meta are rendered under the data
      expect(
        screen.getByText("Access grants for this object are displayed on the Access tab."),
      ).toBeTruthy();
    });
  });

  /* ---------------------------------------------------------------- Empty Success */
  describe("Empty Success Handling", () => {
    it("renders exact empty-success message and not an error when list is empty", async () => {
      server.use(
        http.get("*/api/v1/schemas/:catalog/:schema/objects", () => {
          return HttpResponse.json({
            success: true,
            data: [],
            meta: {
              source: "fixture",
              observed_at: "2026-09-21T09:00:00Z",
              completeness: "complete",
              limitations: ["No objects visible."],
              correlation_id: "corr-empty-1",
            },
            page: { page_size: 50, next_page_token: null },
          });
        }),
      );

      renderDataAssets("/assets/sales/empty_schema");

      await waitFor(() => {
        expect(
          screen.getByText("No objects visible to the application in this schema."),
        ).toBeTruthy();
      });

      // Crucial requirement: empty success is NOT an error
      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.queryByText("Something went wrong")).toBeNull();
      // Limitations still rendered
      expect(screen.getByText("No objects visible.")).toBeTruthy();
    });
  });

  /* ---------------------------------------------------------------- allowed_actions */
  describe("Allowed Actions Gating", () => {
    it("action with allowed: false is disabled and its reason is in the accessibility tree", () => {
      render(
        <AssetActionControl
          action={{
            action: "delete",
            allowed: false,
            reason_code: "ROLE_INSUFFICIENT",
            reason: "Only Platform Administrators can delete tables.",
          }}
        />,
      );

      const button = screen.getByRole("button", { name: /Delete/i }) as HTMLButtonElement;
      expect(button.disabled).toBe(true);

      // Check aria-describedby connects to reason
      const describedBy = button.getAttribute("aria-describedby");
      expect(describedBy).toBeTruthy();

      const reasonEl = document.getElementById(describedBy!);
      expect(reasonEl).toBeTruthy();
      expect(reasonEl?.textContent).toContain("Only Platform Administrators can delete tables.");
    });

    it("action with navigate_to renders as a link to the source", () => {
      render(
        <MemoryRouter>
          <AssetActionControl
            action={{
              action: "revoke",
              allowed: false,
              reason_code: "INHERITED_FROM_PARENT",
              reason: "Inherited from parent schema sales.crm",
              navigate_to: "/assets/sales/crm",
            }}
          />
        </MemoryRouter>,
      );

      const link = screen.getByRole("link", { name: /View permissions at source/i });
      expect(link).toBeTruthy();
      expect(link.getAttribute("href")).toBe("/assets/sales/crm");
    });
  });

  /* ---------------------------------------------------------------- Unknown Enum */
  describe("Unknown Enum Values", () => {
    it("renders unknown enum values verbatim with an Unknown badge without crashing", () => {
      render(<UnknownBadge value="custom_unrecognized_kind" />);

      expect(screen.getByText("custom_unrecognized_kind")).toBeTruthy();
      expect(screen.getByText(strings.assets.states.unknownBadge)).toBeTruthy();
    });

    it("renders asset with unknown kind enum from server safely", async () => {
      server.use(
        http.get("*/api/v1/assets/:securable_type/:full_name", () => {
          return HttpResponse.json({
            success: true,
            data: {
              securable_type: "TABLE",
              full_name: "sales.crm.orders",
              kind: "stream_pipeline_custom",
              display_name: "orders",
              owner: "data-eng",
              comment: "Test table",
              updated_at: null,
              managed: "managed",
              pipeline_managed: false,
              allowed_actions: [],
              properties: {},
              tags: [],
              columns: [],
              row_filter: null,
              view_definition: null,
              storage_location: null,
              table_type: "MANAGED",
              data_source_format: "DELTA",
              created_at: null,
              created_by: null,
              parent: null,
              raw: {},
            },
            meta: {
              source: "fixture",
              observed_at: "2026-09-21T09:00:00Z",
              completeness: "complete",
              limitations: [],
              correlation_id: "corr-1",
            },
          });
        }),
      );

      renderDataAssets("/assets/sales/crm/TABLE/orders");

      await waitFor(() => {
        expect(screen.getByText("stream_pipeline_custom")).toBeTruthy();
      });
      expect(screen.getAllByText(strings.assets.states.unknownBadge).length).toBeGreaterThan(0);
    });
  });

  /* ---------------------------------------------------------------- Search Debounce and Cancel */
  describe("Search & Cancellation", () => {
    it("debounces search input by 300ms", async () => {
      let latestQuery = "";
      render(
        <AssetSearch
          value=""
          onChange={(q) => {
            latestQuery = q;
          }}
        />,
      );

      const input = screen.getByRole("searchbox");

      fireEvent.change(input, { target: { value: "cust" } });

      // Immediate check: debounce not yet elapsed
      expect(latestQuery).toBe("");

      // Wait for debounce timer
      await waitFor(
        () => {
          expect(latestQuery).toBe("cust");
        },
        { timeout: 500 },
      );
    });

    it("aborted search request does not render an error", async () => {
      server.use(
        http.get("*/api/v1/catalogs", async ({ request }) => {
          const url = new URL(request.url);
          const q = url.searchParams.get("query");
          if (q === "cust") {
            // Keep first search request in-flight long enough to be superseded
            await delay(600);
          }
          return HttpResponse.json({
            success: true,
            data: [
              {
                securable_type: "CATALOG",
                full_name: q ? `catalog_${q}` : "sales",
                kind: "catalog",
                display_name: q ? `catalog_${q}` : "sales",
                owner: "data-eng",
                comment: "Catalog",
              },
            ],
            meta: {
              source: "fixture",
              observed_at: "2026-09-21T09:00:00Z",
              completeness: "complete",
              limitations: [],
              correlation_id: "corr-search",
            },
          });
        }),
      );

      renderDataAssets("/assets");

      const searchInput = screen.getByRole("searchbox");

      // Type initial search query
      fireEvent.change(searchInput, { target: { value: "cust" } });

      // Advance past debounce (300ms) to trigger first in-flight fetch
      await act(async () => {
        await new Promise((r) => setTimeout(r, 350));
      });

      // While the first request is in-flight, type second search query to supersede it
      fireEvent.change(searchInput, { target: { value: "customer" } });

      // Advance past second debounce (300ms) and allow superseding query to complete
      await act(async () => {
        await new Promise((r) => setTimeout(r, 450));
      });

      // The superseding result must render and no error alert must ever appear
      const treeNav = screen.getByLabelText(strings.assets.treeAriaLabel);
      await waitFor(() => {
        expect(within(treeNav).getByText("catalog_customer")).toBeTruthy();
      });
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  /* ---------------------------------------------------------------- Breadcrumbs and Copy */
  describe("Breadcrumbs & Copy FQN", () => {
    it("renders navigable breadcrumbs reflecting the current hierarchy", async () => {
      renderDataAssets("/assets/sales/crm/TABLE/orders");

      let breadcrumbNav!: HTMLElement;
      await waitFor(() => {
        breadcrumbNav = screen.getByLabelText(strings.assets.breadcrumbAriaLabel);
        expect(breadcrumbNav).toBeTruthy();
      });

      expect(
        within(breadcrumbNav).getByRole("link", { name: strings.assets.breadcrumbRoot }).getAttribute("href"),
      ).toBe("/assets");
      expect(
        within(breadcrumbNav).getByRole("link", { name: "sales" }).getAttribute("href"),
      ).toBe("/assets/sales");
      expect(
        within(breadcrumbNav).getByRole("link", { name: "crm" }).getAttribute("href"),
      ).toBe("/assets/sales/crm");
      expect(within(breadcrumbNav).getByText("orders")).toBeTruthy();
    });

    it("copies FQN to clipboard on click", async () => {
      let copiedText = "";
      Object.assign(navigator, {
        clipboard: {
          writeText: async (text: string) => {
            copiedText = text;
          },
        },
      });

      renderDataAssets("/assets/sales/crm/TABLE/orders");

      await waitFor(() => {
        expect(screen.getByRole("button", { name: strings.assets.copyFqn })).toBeTruthy();
      });

      const copyBtn = screen.getByRole("button", { name: strings.assets.copyFqn });
      fireEvent.click(copyBtn);

      await waitFor(() => {
        expect(copiedText).toBe("sales.crm.orders");
      });
    });
  });

  /* ---------------------------------------------------------------- Browse Tree Error Handling (P1-ERR-frontend) */
  describe("Browse Tree Error Handling (P1-ERR-frontend)", () => {
    it("catalogs tree error renders mapped title, server message, next_steps, correlation ID, and NOT strings.errors.generic", async () => {
      server.use(
        http.get("*/api/v1/catalogs", () => {
          return HttpResponse.json(
            {
              success: false,
              code: "INSUFFICIENT_PRIVILEGES",
              message: "The executing identity cannot read this resource.",
              correlation_id: "94012433-7f32-45f3-862f-21f49005659d",
              next_steps: ["Ask your administrator for UC catalog browse privilege"],
            },
            { status: 403 },
          );
        }),
      );

      renderDataAssets("/assets");

      const treeNav = screen.getByLabelText(strings.assets.treeAriaLabel);

      await waitFor(() => {
        expect(within(treeNav).getByRole("alert")).toBeTruthy();
      });

      // Mapped title, NOT raw code and NOT generic string
      expect(
        within(treeNav).getByText(strings.errorCodes.INSUFFICIENT_PRIVILEGES.title),
      ).toBeTruthy();

      // Server message
      expect(
        within(treeNav).getByText("The executing identity cannot read this resource."),
      ).toBeTruthy();

      // Next steps
      expect(
        within(treeNav).getByText("Ask your administrator for UC catalog browse privilege"),
      ).toBeTruthy();

      // Correlation ID inside details
      expect(
        within(treeNav).getByText("94012433-7f32-45f3-862f-21f49005659d"),
      ).toBeTruthy();

      // Retry button is present
      expect(
        within(treeNav).getByRole("button", { name: strings.common.retry }),
      ).toBeTruthy();

      // strings.errors.generic is NOT rendered
      expect(within(treeNav).queryByText(strings.errors.generic)).toBeNull();
      expect(screen.queryByText(strings.errors.generic)).toBeNull();
    });

    it("schemas tree error renders mapped title, server message, next_steps, correlation ID, and NOT strings.errors.generic", async () => {
      server.use(
        http.get("*/api/v1/catalogs/:catalog/schemas", () => {
          return HttpResponse.json(
            {
              success: false,
              code: "FORBIDDEN_SCOPE",
              message: "Catalog sales is outside your assigned governance scope.",
              correlation_id: "corr-schema-scope-77",
              next_steps: ["Request access to catalog sales from your data steward."],
            },
            { status: 403 },
          );
        }),
      );

      renderDataAssets("/assets/sales");

      const treeNav = screen.getByLabelText(strings.assets.treeAriaLabel);

      await waitFor(() => {
        expect(within(treeNav).getByRole("alert")).toBeTruthy();
      });

      expect(
        within(treeNav).getByText(strings.errorCodes.FORBIDDEN_SCOPE.title),
      ).toBeTruthy();
      expect(
        within(treeNav).getByText("Catalog sales is outside your assigned governance scope."),
      ).toBeTruthy();
      expect(
        within(treeNav).getByText("Request access to catalog sales from your data steward."),
      ).toBeTruthy();
      expect(
        within(treeNav).getByText("corr-schema-scope-77"),
      ).toBeTruthy();
      expect(
        within(treeNav).getByRole("button", { name: strings.common.retry }),
      ).toBeTruthy();
      expect(within(treeNav).queryByText(strings.errors.generic)).toBeNull();
    });

    it("objects tree error renders mapped title, server message, next_steps, correlation ID, and NOT strings.errors.generic", async () => {
      server.use(
        http.get("*/api/v1/schemas/:catalog/:schema/objects", () => {
          return HttpResponse.json(
            {
              success: false,
              code: "INSUFFICIENT_PRIVILEGES",
              message: "The executing identity lacks USE_SCHEMA privilege on sales.crm.",
              correlation_id: "corr-objects-perm-88",
              next_steps: ["Contact access admin for USE_SCHEMA privilege."],
            },
            { status: 403 },
          );
        }),
      );

      renderDataAssets("/assets/sales/crm");

      const treeNav = screen.getByLabelText(strings.assets.treeAriaLabel);

      await waitFor(() => {
        expect(within(treeNav).getByRole("alert")).toBeTruthy();
      });

      expect(
        within(treeNav).getByText(strings.errorCodes.INSUFFICIENT_PRIVILEGES.title),
      ).toBeTruthy();
      expect(
        within(treeNav).getByText("The executing identity lacks USE_SCHEMA privilege on sales.crm."),
      ).toBeTruthy();
      expect(
        within(treeNav).getByText("Contact access admin for USE_SCHEMA privilege."),
      ).toBeTruthy();
      expect(
        within(treeNav).getByText("corr-objects-perm-88"),
      ).toBeTruthy();
      expect(
        within(treeNav).getByRole("button", { name: strings.common.retry }),
      ).toBeTruthy();
      expect(within(treeNav).queryByText(strings.errors.generic)).toBeNull();
    });

    it("a thrown value that is not an ApiError falls back to generic message and unknown title", async () => {
      server.use(
        http.get("*/api/v1/catalogs", () => {
          return HttpResponse.error();
        }),
      );

      renderDataAssets("/assets");

      const treeNav = screen.getByLabelText(strings.assets.treeAriaLabel);

      await waitFor(
        () => {
          expect(within(treeNav).getByRole("alert")).toBeTruthy();
        },
        { timeout: 3000 },
      );

      // Falls back to generic message
      expect(
        within(treeNav).getByText(strings.errors.generic),
      ).toBeTruthy();

      // Title falls back to Unknown
      expect(
        within(treeNav).getByText(strings.common.unknown),
      ).toBeTruthy();

      // Retry control still available
      expect(
        within(treeNav).getByRole("button", { name: strings.common.retry }),
      ).toBeTruthy();
    });

    it("ErrorView component renders compact and standard variants with all details", () => {
      const nonApiError = new Error("Plain network glitch");
      const { rerender } = render(
        <ErrorView error={nonApiError} onRetry={() => {}} compact />,
      );

      expect(screen.getByText(strings.common.unknown)).toBeTruthy();
      expect(screen.getByText(strings.errors.generic)).toBeTruthy();
      expect(screen.getByRole("button", { name: strings.common.retry })).toBeTruthy();

      rerender(
        <ErrorView
          error={
            new ApiError(
              {
                success: false,
                code: "INSUFFICIENT_PRIVILEGES",
                message: "Custom permission message",
                correlation_id: "corr-direct-check",
                next_steps: ["Direct step 1", "Direct step 2"],
              },
              403,
            )
          }
          compact
        />,
      );

      expect(screen.getByText(strings.errorCodes.INSUFFICIENT_PRIVILEGES.title)).toBeTruthy();
      expect(screen.getByText("Custom permission message")).toBeTruthy();
      expect(screen.getByText("Direct step 1")).toBeTruthy();
      expect(screen.getByText("Direct step 2")).toBeTruthy();
      expect(screen.getByText("corr-direct-check")).toBeTruthy();

      // An aborted request must never render an error or alert
      rerender(
        <ErrorView
          error={new DOMException("The user aborted a request.", "AbortError")}
          compact
        />,
      );
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("ErrorView renders nothing for an AbortError instance, while still rendering normally for an ApiError", () => {
      const apiErr = new ApiError(
        {
          success: false,
          code: "INSUFFICIENT_PRIVILEGES",
          message: "Action forbidden",
          correlation_id: "corr-err-1",
        },
        403,
      );
      const { rerender } = render(<ErrorView error={apiErr} compact />);
      expect(screen.getByRole("alert")).toBeTruthy();
      expect(screen.getByText(strings.errorCodes.INSUFFICIENT_PRIVILEGES.title)).toBeTruthy();

      rerender(<ErrorView error={new AbortError()} compact />);
      expect(screen.queryByRole("alert")).toBeNull();

      rerender(<ErrorView error={new DOMException("The user aborted a request.", "AbortError")} compact />);
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });
});
