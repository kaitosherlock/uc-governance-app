/**
 * routes.tsx — React Router 8 route definitions for the UC Governance app.
 *
 * Scope lives in the URL as specified in docs/02-architecture.md §8:
 * /assets/:catalog?/:schema?/:objectType?/:name? with a `tab` search parameter.
 *
 * Every route renders a PageHeader (h1 + purpose description) and a
 * PlaceholderContent (body text saying what is available now vs. missing).
 * The two text slots always come from different keys in strings.ts.
 */
import { createBrowserRouter } from "react-router";
import type { RouteObject } from "react-router";
import { AppShell } from "./AppShell";
import { PageHeader } from "./PageHeader";
import { strings } from "@/lib/strings";
import { DataAssetsView } from "@/features/assets/DataAssetsView";
import { PoliciesView } from "@/features/policies/PoliciesView";

/* ---------- Page components ---------- */

function PlaceholderContent({ text }: { text: string }) {
  return (
    <div className="px-[var(--space-6)] py-[var(--space-5)]">
      <p className="text-[var(--text-base)] text-[var(--color-text-secondary)] max-w-[70ch]">
        {text}
      </p>
    </div>
  );
}

function AccessManagementPage() {
  return (
    <>
      <PageHeader title={strings.pages.accessManagement} description={strings.descriptions.accessManagement} />
      <PlaceholderContent text={strings.unavailable.accessManagement} />
    </>
  );
}

function PoliciesPage() {
  return <PoliciesView />;
}

function ActivityPage() {
  return (
    <>
      <PageHeader title={strings.pages.activity} description={strings.descriptions.activity} />
      <PlaceholderContent text={strings.unavailable.activity} />
    </>
  );
}

function PlatformPage() {
  return (
    <>
      <PageHeader title={strings.pages.platform} description={strings.descriptions.platform} />
      <PlaceholderContent text={strings.unavailable.platform} />
    </>
  );
}

function NotFoundPage() {
  return (
    <>
      <PageHeader title={strings.pages.notFound} description={strings.descriptions.notFound} />
      <PlaceholderContent text={strings.unavailable.notFound} />
    </>
  );
}

/* ---------- Route definitions ---------- */

const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      /* Data Assets — default route */
      {
        index: true,
        element: <DataAssetsView />,
      },
      {
        path: "assets",
        children: [
          {
            index: true,
            element: <DataAssetsView />,
          },
          {
            path: ":catalog",
            children: [
              {
                index: true,
                element: <DataAssetsView />,
              },
              {
                path: ":schema",
                children: [
                  {
                    index: true,
                    element: <DataAssetsView />,
                  },
                  {
                    path: ":objectType",
                    children: [
                      {
                        index: true,
                        element: <DataAssetsView />,
                      },
                      {
                        path: ":name",
                        element: <DataAssetsView />,
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      /* Access Management */
      {
        path: "access",
        element: <AccessManagementPage />,
      },
      /* Policies */
      {
        path: "policies",
        element: <PoliciesPage />,
      },
      /* Activity */
      {
        path: "activity",
        element: <ActivityPage />,
      },
      /* Platform */
      {
        path: "platform",
        element: <PlatformPage />,
      },
      /* Catch-all not-found */
      {
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
