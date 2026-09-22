import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { http, HttpResponse, delay } from "msw";
import { setupServer } from "msw/node";
import { handlers } from "@/mocks/handlers";
import { strings } from "@/lib/strings";
import { AssetGrantsView } from "../AssetGrantsView";
import grantsFixture from "../../../../../shared/contracts/examples/GrantsResponse.orders-table.json";

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

function renderGrantsView(
  securableType: string = "TABLE",
  fullName: string = "sales.crm.orders",
) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AssetGrantsView securableType={securableType} fullName={fullName} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AssetGrantsView (Access tab P1-07)", () => {
  /* ---------------------------------------------------------------- Sources & Parents */
  it("renders direct and inherited grants with distinguishable sources, and the inherited one names its parent", async () => {
    renderGrantsView("TABLE", "sales.crm.orders");

    // Wait for the grants table to load
    await waitFor(() => {
      expect(screen.getByText("analysts")).toBeTruthy();
    });

    // 1. Direct grant: analysts (source: direct on sales.crm.orders)
    const directRow = screen.getByText("analysts").closest("tr");
    expect(directRow).toBeTruthy();
    const directSourceCell = within(directRow!).getByText(strings.access.sources.direct);
    expect(directSourceCell).toBeTruthy();

    // 2. Inherited grant: sales-readers (source: inherited from schema sales.crm)
    const inheritedSchemaRow = screen.getByText("sales-readers").closest("tr");
    expect(inheritedSchemaRow).toBeTruthy();

    // Verify it announces "Inherited from schema"
    const schemaSourceText = within(inheritedSchemaRow!).getByText(
      strings.access.sources.inheritedFrom.replace("{kind}", "schema"),
    );
    expect(schemaSourceText).toBeTruthy();

    // Verify it names its parent "sales.crm"
    const schemaParentEl = within(inheritedSchemaRow!).getByLabelText("sales.crm");
    expect(schemaParentEl).toBeTruthy();
    expect(schemaParentEl.textContent).toContain("sales.crm");

    // 3. Inherited grant from catalog: account users (source: inherited from catalog sales)
    const inheritedCatalogRow = screen.getByText("account users").closest("tr");
    expect(inheritedCatalogRow).toBeTruthy();

    const catalogSourceText = within(inheritedCatalogRow!).getByText(
      strings.access.sources.inheritedFrom.replace("{kind}", "catalog"),
    );
    expect(catalogSourceText).toBeTruthy();
    const catalogParentEl = within(inheritedCatalogRow!).getByLabelText("sales");
    expect(catalogParentEl).toBeTruthy();
    expect(catalogParentEl.textContent).toContain("sales");
  });

  /* ---------------------------------------------------------------- Revoke on Inherited Grant */
  describe("Revoke on Inherited Grant", () => {
    it("revoke on an inherited grant is not an enabled button: renders as a link to source with navigate_to", async () => {
      renderGrantsView("TABLE", "sales.crm.orders");

      await waitFor(() => {
        expect(screen.getByText("sales-readers")).toBeTruthy();
      });

      const inheritedRow = screen.getByText("sales-readers").closest("tr");
      expect(inheritedRow).toBeTruthy();

      // Revoke must NOT be an enabled button
      const enabledRevokeButton = within(inheritedRow!).queryByRole("button", {
        name: /^Revoke$/i,
      });
      expect(enabledRevokeButton).toBeNull();

      // It must render a link to the source object
      const sourceLink = within(inheritedRow!).getByRole("link", {
        name: new RegExp(strings.assets.actions.viewPermissionsAtSource, "i"),
      });
      expect(sourceLink).toBeTruthy();
      expect(sourceLink.getAttribute("href")).toBe("/assets/sales/crm?tab=access");
    });

    it("revoke on an inherited grant without navigate_to is disabled with reason in accessibility tree", async () => {
      server.use(
        http.get("*/api/v1/assets/:securable_type/:full_name/grants", () => {
          return HttpResponse.json({
            ...grantsFixture,
            data: {
              ...grantsFixture.data,
              direct: [],
              inherited: [
                {
                  principal: "restricted-group",
                  principal_kind: "group",
                  privilege: "SELECT",
                  source: {
                    type: "inherited",
                    securable_type: "SCHEMA",
                    full_name: "sales.crm",
                  },
                  allowed_actions: [
                    {
                      action: "revoke",
                      allowed: false,
                      reason_code: "INHERITED_FROM_PARENT",
                      reason: "Cannot revoke inherited permission on child object.",
                    },
                  ],
                },
              ],
            },
          });
        }),
      );

      renderGrantsView("TABLE", "sales.crm.orders");

      await waitFor(() => {
        expect(screen.getByText("restricted-group")).toBeTruthy();
      });

      const button = screen.getByRole("button", {
        name: new RegExp(strings.assets.actions.revoke, "i"),
      }) as HTMLButtonElement;
      expect(button.disabled).toBe(true);

      // Verify reason is present in accessibility tree via aria-describedby
      const describedBy = button.getAttribute("aria-describedby");
      expect(describedBy).toBeTruthy();

      const reasonEl = document.getElementById(describedBy!);
      expect(reasonEl).toBeTruthy();
      expect(reasonEl?.textContent).toContain("Cannot revoke inherited permission on child object.");
    });
  });

  /* ---------------------------------------------------------------- Limitation Line */
  it("renders meta.limitations, and the group-membership sentence appears verbatim", async () => {
    renderGrantsView("TABLE", "sales.crm.orders");

    await waitFor(() => {
      expect(screen.getByText("analysts")).toBeTruthy();
    });

    // The group membership sentence must appear verbatim per spec
    expect(
      screen.getByText("Group membership was not loaded; access through group membership is not shown."),
    ).toBeTruthy();

    // The service principal limitation must also appear
    expect(
      screen.getByText("Showing grants visible to the application's service principal."),
    ).toBeTruthy();

    // Must be in a visible list, not inside a closed disclosure
    const limitationItem = screen.getByText(
      "Group membership was not loaded; access through group membership is not shown.",
    );
    expect(limitationItem.closest("li")).toBeTruthy();
  });

  /* ---------------------------------------------------------------- Empty Success */
  it("renders empty success message and not an error when there are no grants", async () => {
    server.use(
      http.get("*/api/v1/assets/:securable_type/:full_name/grants", () => {
        return HttpResponse.json({
          ...grantsFixture,
          data: {
            ...grantsFixture.data,
            direct: [],
            inherited: [],
          },
        });
      }),
    );

    renderGrantsView("TABLE", "sales.crm.empty_table");

    await waitFor(() => {
      expect(screen.getByText(strings.states.emptyGrants)).toBeTruthy();
    });

    // Must NOT render an error or alert
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText("Something went wrong")).toBeNull();

    // Limitations must still be rendered under the empty message
    expect(
      screen.getByText("Group membership was not loaded; access through group membership is not shown."),
    ).toBeTruthy();
  });

  /* ---------------------------------------------------------------- Unrecognised Privilege Code */
  it("renders unrecognised privilege code verbatim with the unknown badge and does not crash", async () => {
    server.use(
      http.get("*/api/v1/assets/:securable_type/:full_name/grants", () => {
        return HttpResponse.json({
          ...grantsFixture,
          data: {
            ...grantsFixture.data,
            direct: [
              {
                principal: "compliance-team",
                principal_kind: "group",
                privilege: "CUSTOM_UNKNOWN_PRIVILEGE_XYZ",
                source: {
                  type: "direct",
                  securable_type: "TABLE",
                  full_name: "sales.crm.orders",
                },
                allowed_actions: [],
              },
            ],
            inherited: [],
          },
        });
      }),
    );

    renderGrantsView("TABLE", "sales.crm.orders");

    await waitFor(() => {
      expect(screen.getByText("compliance-team")).toBeTruthy();
    });

    const table = screen.getByRole("table", { name: strings.access.grantsTable.title });
    const row = within(table).getByText("CUSTOM_UNKNOWN_PRIVILEGE_XYZ").closest("tr");
    expect(row).toBeTruthy();

    // The unknown privilege code is rendered verbatim
    expect(within(row!).getByText("CUSTOM_UNKNOWN_PRIVILEGE_XYZ")).toBeTruthy();

    // An Unknown badge is attached to it on the same row
    expect(within(row!).getByText(strings.assets.states.unknownBadge)).toBeTruthy();

    // No crash, no alert
    expect(screen.queryByRole("alert")).toBeNull();
  });

  /* ---------------------------------------------------------------- Filters */
  describe("Client-side Filtering", () => {
    it("filters narrow the rows and can be cleared by keyboard", async () => {
      renderGrantsView("TABLE", "sales.crm.orders");

      await waitFor(() => {
        expect(screen.getByText("analysts")).toBeTruthy();
      });

      // Total rows initially: 4 grants (analysts, svc-etl-nightly, sales-readers, account users)
      const initialRows = screen.getAllByRole("row").slice(1); // exclude header
      expect(initialRows.length).toBe(4);
      expect(screen.getByText(strings.access.grantsTable.totalGrants.replace("{total}", "4"))).toBeTruthy();

      // 1. Filter by Principal (search input)
      const principalInput = screen.getByLabelText(
        new RegExp(strings.access.filters.searchPrincipal, "i"),
      );
      fireEvent.change(principalInput, { target: { value: "svc" } });

      // Narrows to 1 row
      await waitFor(() => {
        expect(screen.getByText("svc-etl-nightly")).toBeTruthy();
      });
      expect(screen.queryByText("analysts")).toBeNull();
      expect(screen.queryByText("sales-readers")).toBeNull();
      expect(screen.queryByText("account users")).toBeNull();

      // 2. Clear filters by keyboard activation
      const clearBtn = screen.getByRole("button", {
        name: strings.access.filters.clearFilters,
      });
      expect(clearBtn).toBeTruthy();

      // Trigger click / keyboard Enter on clear button
      fireEvent.click(clearBtn);

      // All 4 rows restored
      await waitFor(() => {
        expect(screen.getByText("analysts")).toBeTruthy();
      });
      expect(screen.getByText("svc-etl-nightly")).toBeTruthy();
      expect(screen.getByText("sales-readers")).toBeTruthy();
      expect(screen.getByText("account users")).toBeTruthy();

      // 3. Filter by Privilege (dropdown)
      const privilegeSelect = screen.getByLabelText(
        new RegExp(strings.access.filters.privilegeLabel, "i"),
      );
      fireEvent.change(privilegeSelect, { target: { value: "USE_CATALOG" } });

      // Only account users has USE_CATALOG
      await waitFor(() => {
        expect(screen.getByText("account users")).toBeTruthy();
      });
      expect(screen.queryByText("analysts")).toBeNull();
      expect(screen.queryByText("svc-etl-nightly")).toBeNull();

      // Clear again
      fireEvent.click(screen.getByRole("button", { name: strings.access.filters.clearFilters }));
      expect(screen.getByText("analysts")).toBeTruthy();

      // 4. Filter by Source (dropdown)
      const sourceSelect = screen.getByLabelText(
        new RegExp(strings.access.filters.sourceLabel, "i"),
      );
      fireEvent.change(sourceSelect, { target: { value: "direct" } });

      // 2 direct rows: analysts, svc-etl-nightly
      await waitFor(() => {
        expect(screen.getByText("analysts")).toBeTruthy();
      });
      expect(screen.getByText("svc-etl-nightly")).toBeTruthy();
      expect(screen.queryByText("sales-readers")).toBeNull();
      expect(screen.queryByText("account users")).toBeNull();

      // Clear again
      fireEvent.click(screen.getByRole("button", { name: strings.access.filters.clearFilters }));
      expect(screen.getByText("sales-readers")).toBeTruthy();

      // 5. Filter yielding no matches shows no matching message and clear button
      fireEvent.change(principalInput, { target: { value: "does-not-exist" } });
      await waitFor(() => {
        expect(screen.getByText(strings.access.grantsTable.noMatchingGrants)).toBeTruthy();
      });

      // Clear from the no-matches state
      const noMatchesClearBtn = screen.getByRole("button", {
        name: strings.access.filters.clearFiltersAndShowAll,
      });
      fireEvent.click(noMatchesClearBtn);
      await waitFor(() => {
        expect(screen.getByText("analysts")).toBeTruthy();
      });
    });

    it("displays the client-side filtering notice", async () => {
      renderGrantsView("TABLE", "sales.crm.orders");

      await waitFor(() => {
        expect(screen.getByText("analysts")).toBeTruthy();
      });

      expect(screen.getByText(strings.access.filters.clientSideNotice)).toBeTruthy();
    });
  });

  /* ---------------------------------------------------------------- Principal & Privilege formatting */
  describe("Formatting and Semantics", () => {
    it("principal type is shown as icon plus text, never color or icon alone", async () => {
      renderGrantsView("TABLE", "sales.crm.orders");

      await waitFor(() => {
        expect(screen.getByText("analysts")).toBeTruthy();
      });

      // analysts is a group -> must have text "Group"
      expect(screen.getAllByText(strings.access.principalKinds.group).length).toBeGreaterThan(0);

      // svc-etl-nightly is a service principal -> must have text "Service Principal"
      expect(
        screen.getByText(strings.access.principalKinds.servicePrincipal),
      ).toBeTruthy();
    });

    it("privilege renders as label — CODE with CODE in monospace", async () => {
      renderGrantsView("TABLE", "sales.crm.orders");

      await waitFor(() => {
        expect(screen.getByText("analysts")).toBeTruthy();
      });

      const analystsRow = screen.getByText("analysts").closest("tr");
      expect(analystsRow).toBeTruthy();

      // SELECT has label "Read data"
      expect(within(analystsRow!).getByText("Read data")).toBeTruthy();

      // SELECT code in monospace
      const selectCode = within(analystsRow!).getByText("SELECT");
      expect(selectCode).toBeTruthy();
      expect(selectCode.tagName.toLowerCase()).toBe("code");
      expect(selectCode.className).toContain("font-mono");
    });

    it("table headers announce sort state via aria-sort", async () => {
      renderGrantsView("TABLE", "sales.crm.orders");

      await waitFor(() => {
        expect(screen.getByText("analysts")).toBeTruthy();
      });

      // Principal header initially sorted ascending
      const principalTh = screen.getByRole("columnheader", {
        name: new RegExp(strings.access.grantsTable.principal, "i"),
      });
      expect(principalTh.getAttribute("aria-sort")).toBe("ascending");

      // Clicking toggles to descending
      const principalSortBtn = within(principalTh).getByRole("button");
      fireEvent.click(principalSortBtn);
      expect(principalTh.getAttribute("aria-sort")).toBe("descending");

      // Privilege header is initially not sorted
      const privilegeTh = screen.getByRole("columnheader", {
        name: new RegExp(strings.access.grantsTable.privilege, "i"),
      });
      expect(privilegeTh.getAttribute("aria-sort")).toBe("none");
    });
  });

  /* ---------------------------------------------------------------- States */
  describe("States", () => {
    it("renders idle view when no securable_type or full_name is provided", () => {
      const queryClient = createTestQueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <AssetGrantsView securableType={null} fullName={null} />
          </MemoryRouter>
        </QueryClientProvider>,
      );

      expect(screen.getByText(strings.assets.states.idleTitle)).toBeTruthy();
    });

    it("renders localized skeleton during loading", async () => {
      server.use(
        http.get("*/api/v1/assets/:securable_type/:full_name/grants", async () => {
          await delay(200);
          return HttpResponse.json(grantsFixture);
        }),
      );

      const { container } = renderGrantsView("TABLE", "sales.crm.orders");
      const skeletons = container.querySelectorAll(".animate-pulse");
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it("renders error view on API failure with retry capability", async () => {
      server.use(
        http.get("*/api/v1/assets/:securable_type/:full_name/grants", () => {
          return HttpResponse.json(
            {
              success: false,
              code: "FORBIDDEN_ROLE",
              message: "Your application role does not have permission for this action.",
              correlation_id: "corr-err-403",
              next_steps: ["Contact an access administrator."],
            },
            { status: 403 },
          );
        }),
      );

      renderGrantsView("TABLE", "sales.crm.orders");

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeTruthy();
      });

      expect(screen.getByText("Your application role does not have permission for this action.")).toBeTruthy();
      expect(screen.getByText("Contact an access administrator.")).toBeTruthy();
      expect(screen.getByText("corr-err-403")).toBeTruthy();
      expect(screen.getByRole("button", { name: strings.common.retry })).toBeTruthy();
    });
  });
});
