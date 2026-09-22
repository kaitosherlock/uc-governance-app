import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { Database, FolderTree, PanelLeftClose, PanelLeftOpen, RefreshCw } from "lucide-react";
import {
  useAsset,
  useCatalogs,
  useSchemaObjects,
  useSchemas,
} from "@/api/queries";
import { PageHeader } from "@/app/PageHeader";
import { strings } from "@/lib/strings";
import { AssetBreadcrumbs } from "./AssetBreadcrumbs";
import { AssetGrantsView } from "./AssetGrantsView";
import { AssetOverview } from "./AssetOverview";
import { AssetSearch } from "./AssetSearch";
import { AssetTree } from "./AssetTree";
import { CatalogSchemasTable } from "./CatalogSchemasTable";
import { SchemaObjectsTable } from "./SchemaObjectsTable";
import { ErrorView, IdleView, LocalizedSkeleton } from "./StateViews";

export function DataAssetsView() {
  const { catalog, schema, objectType, name } = useParams<{
    catalog?: string;
    schema?: string;
    objectType?: string;
    name?: string;
  }>();

  const [searchQuery, setSearchQuery] = useState("");
  const [treeOpenOnMobile, setTreeOpenOnMobile] = useState(false);
  const [searchParams] = useSearchParams();
  const currentTab = searchParams.get("tab");

  // Derive FQN for object if selected
  const objectFullName =
    catalog && schema && name ? `${catalog}.${schema}.${name}` : null;

  // Query for object detail if on object route
  const assetQuery = useAsset(
    objectType,
    objectFullName,
  );

  // Query for schema objects if on schema route
  const schemaObjectsQuery = useSchemaObjects(
    catalog,
    schema,
    searchQuery ? { query: searchQuery } : undefined,
  );

  // Query for catalog schemas if on catalog route
  const schemasQuery = useSchemas(
    catalog,
    searchQuery ? { query: searchQuery } : undefined,
  );

  // Query for catalogs if on root route with search
  const catalogsQuery = useCatalogs(
    searchQuery ? { query: searchQuery } : undefined,
  );

  function handleRefresh() {
    if (objectFullName) {
      assetQuery.refetch();
    } else if (catalog && schema) {
      schemaObjectsQuery.refetch();
    } else if (catalog) {
      schemasQuery.refetch();
    } else {
      catalogsQuery.refetch();
    }
  }

  // Determine current scope title and description
  let pageTitle: string = strings.pages.dataAssets;
  let pageDescription: string = strings.descriptions.dataAssets;

  if (objectFullName && name) {
    pageTitle = name;
    pageDescription = strings.descriptions.assetDetail;
  } else if (catalog && schema) {
    pageTitle = `${catalog}.${schema}`;
    pageDescription = strings.assets.scopeObjectsInSchema.replace("{schema}", schema);
  } else if (catalog) {
    pageTitle = catalog;
    pageDescription = strings.assets.scopeSchemasInCatalog.replace("{catalog}", catalog);
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)]">
      {/* Page Header */}
      <PageHeader title={pageTitle} description={pageDescription}>
        <div className="flex items-center gap-2">
          {/* Mobile tree toggle button */}
          <button
            type="button"
            onClick={() => setTreeOpenOnMobile((prev) => !prev)}
            aria-expanded={treeOpenOnMobile}
            aria-label={treeOpenOnMobile ? strings.assets.treeHide : strings.assets.treeShow}
            className="md:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-control)] text-[var(--text-sm)] font-[var(--weight-medium)] border border-[var(--color-border-strong)] bg-[var(--color-neutral-0)] hover:bg-[var(--color-neutral-1)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)]"
          >
            {treeOpenOnMobile ? (
              <PanelLeftClose className="w-4 h-4 text-[var(--color-icon-muted)]" aria-hidden="true" />
            ) : (
              <PanelLeftOpen className="w-4 h-4 text-[var(--color-icon-muted)]" aria-hidden="true" />
            )}
            <span>{strings.assets.treeNavTitle}</span>
          </button>

          {/* Refresh button */}
          <button
            type="button"
            onClick={handleRefresh}
            aria-label={strings.assets.refreshAriaLabel}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-control)] text-[var(--text-sm)] font-[var(--weight-medium)] border border-[var(--color-border-strong)] bg-[var(--color-neutral-0)] hover:bg-[var(--color-neutral-1)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)]"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[var(--color-icon-muted)]" aria-hidden="true" />
            <span>{strings.assets.refresh}</span>
          </button>
        </div>
      </PageHeader>

      {/* Navigable Breadcrumbs */}
      <AssetBreadcrumbs
        catalog={catalog}
        schema={schema}
        objectType={objectType}
        name={name}
      />

      {/* Main Split Layout: Left Browse Tree + Right Content View */}
      <div className="flex flex-1 flex-col md:flex-row items-stretch">
        {/* Left Rail / Browse Tree */}
        <aside
          className={`w-full md:w-72 lg:w-80 shrink-0 border-r border-[var(--color-border-subtle)] bg-[var(--color-neutral-0)] flex flex-col ${
            treeOpenOnMobile ? "block" : "hidden md:flex"
          }`}
        >
          {/* Search bar pinned at top of tree */}
          <div className="p-3 border-b border-[var(--color-border-subtle)] bg-[var(--color-neutral-1)]/40">
            <AssetSearch
              value={searchQuery}
              onChange={(q) => setSearchQuery(q)}
            />
          </div>

          {/* Tree hierarchy */}
          <div className="flex-1 overflow-y-auto">
            <AssetTree
              currentCatalog={catalog}
              currentSchema={schema}
              currentObjectType={objectType}
              currentName={name}
              searchQuery={searchQuery}
            />
          </div>
        </aside>

        {/* Right Content Pane */}
        <main className="flex-1 min-w-0 bg-[var(--color-neutral-0)] overflow-y-auto">
          {/* 1. Object Detail Route */}
          {objectFullName ? (
            assetQuery.isLoading ? (
              <div className="p-[var(--space-6)] space-y-4">
                <LocalizedSkeleton className="h-8 w-64" />
                <LocalizedSkeleton className="h-4 w-48" />
                <LocalizedSkeleton className="h-40 w-full" />
                <LocalizedSkeleton className="h-48 w-full" />
              </div>
            ) : assetQuery.isError ? (
              <div className="p-[var(--space-6)]">
                <ErrorView
                  error={assetQuery.error}
                  onRetry={() => assetQuery.refetch()}
                />
              </div>
            ) : assetQuery.data?.data ? (
              <AssetOverview
                asset={assetQuery.data.data}
                meta={assetQuery.data.meta}
                onRefresh={() => assetQuery.refetch()}
              />
            ) : null
          ) : /* 2. Schema Route */
          catalog && schema ? (
            currentTab === "access" ? (
              <div className="p-[var(--space-6)] space-y-4">
                <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                  <FolderTree className="w-5 h-5 text-[var(--color-icon-muted)]" aria-hidden="true" />
                  <span className="font-[var(--font-mono)] text-[var(--text-sm)]">
                    {catalog}.{schema}
                  </span>
                </div>
                <div
                  role="tablist"
                  aria-label={strings.access.tabsAriaLabel}
                  className="flex items-center gap-1 border-b border-[var(--color-border-subtle)]"
                >
                  <Link
                    to={`/assets/${encodeURIComponent(catalog)}/${encodeURIComponent(schema)}`}
                    role="tab"
                    aria-selected={false}
                    className="px-4 py-2 text-[var(--text-sm)] font-[var(--weight-medium)] border-b-2 -mb-px border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  >
                    {strings.assets.objectsTitle}
                  </Link>
                  <Link
                    to={`/assets/${encodeURIComponent(catalog)}/${encodeURIComponent(schema)}?tab=access`}
                    role="tab"
                    aria-selected={true}
                    className="px-4 py-2 text-[var(--text-sm)] font-[var(--weight-semibold)] border-b-2 -mb-px border-[var(--color-accent)] text-[var(--color-accent)]"
                  >
                    {strings.assets.tabs.access}
                  </Link>
                </div>
                <AssetGrantsView
                  securableType="SCHEMA"
                  fullName={`${catalog}.${schema}`}
                  onRefresh={() => schemaObjectsQuery.refetch()}
                />
              </div>
            ) : schemaObjectsQuery.isLoading ? (
              <div className="p-[var(--space-6)] space-y-4">
                <LocalizedSkeleton className="h-8 w-48" />
                <LocalizedSkeleton className="h-64 w-full" />
              </div>
            ) : schemaObjectsQuery.isError ? (
              <div className="p-[var(--space-6)]">
                <ErrorView
                  error={schemaObjectsQuery.error}
                  onRetry={() => schemaObjectsQuery.refetch()}
                />
              </div>
            ) : schemaObjectsQuery.data?.data ? (
              <div className="p-[var(--space-6)] space-y-4">
                <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                  <FolderTree className="w-5 h-5 text-[var(--color-icon-muted)]" aria-hidden="true" />
                  <span className="font-[var(--font-mono)] text-[var(--text-sm)]">
                    {catalog}.{schema}
                  </span>
                </div>
                <div
                  role="tablist"
                  aria-label={strings.access.tabsAriaLabel}
                  className="flex items-center gap-1 border-b border-[var(--color-border-subtle)]"
                >
                  <Link
                    to={`/assets/${encodeURIComponent(catalog)}/${encodeURIComponent(schema)}`}
                    role="tab"
                    aria-selected={true}
                    className="px-4 py-2 text-[var(--text-sm)] font-[var(--weight-semibold)] border-b-2 -mb-px border-[var(--color-accent)] text-[var(--color-accent)]"
                  >
                    {strings.assets.objectsTitle}
                  </Link>
                  <Link
                    to={`/assets/${encodeURIComponent(catalog)}/${encodeURIComponent(schema)}?tab=access`}
                    role="tab"
                    aria-selected={false}
                    className="px-4 py-2 text-[var(--text-sm)] font-[var(--weight-medium)] border-b-2 -mb-px border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  >
                    {strings.assets.tabs.access}
                  </Link>
                </div>
                <SchemaObjectsTable
                  catalog={catalog}
                  schema={schema}
                  objects={schemaObjectsQuery.data.data}
                  meta={schemaObjectsQuery.data.meta}
                />
              </div>
            ) : null
          ) : /* 3. Catalog Route */
          catalog ? (
            currentTab === "access" ? (
              <div className="p-[var(--space-6)] space-y-4">
                <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                  <Database className="w-5 h-5 text-[var(--color-icon-muted)]" aria-hidden="true" />
                  <span className="font-[var(--font-mono)] text-[var(--text-sm)]">
                    {catalog}
                  </span>
                </div>
                <div
                  role="tablist"
                  aria-label={strings.access.tabsAriaLabel}
                  className="flex items-center gap-1 border-b border-[var(--color-border-subtle)]"
                >
                  <Link
                    to={`/assets/${encodeURIComponent(catalog)}`}
                    role="tab"
                    aria-selected={false}
                    className="px-4 py-2 text-[var(--text-sm)] font-[var(--weight-medium)] border-b-2 -mb-px border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  >
                    {strings.assets.schemasTitle}
                  </Link>
                  <Link
                    to={`/assets/${encodeURIComponent(catalog)}?tab=access`}
                    role="tab"
                    aria-selected={true}
                    className="px-4 py-2 text-[var(--text-sm)] font-[var(--weight-semibold)] border-b-2 -mb-px border-[var(--color-accent)] text-[var(--color-accent)]"
                  >
                    {strings.assets.tabs.access}
                  </Link>
                </div>
                <AssetGrantsView
                  securableType="CATALOG"
                  fullName={catalog}
                  onRefresh={() => schemasQuery.refetch()}
                />
              </div>
            ) : schemasQuery.isLoading ? (
              <div className="p-[var(--space-6)] space-y-4">
                <LocalizedSkeleton className="h-8 w-48" />
                <LocalizedSkeleton className="h-64 w-full" />
              </div>
            ) : schemasQuery.isError ? (
              <div className="p-[var(--space-6)]">
                <ErrorView
                  error={schemasQuery.error}
                  onRetry={() => schemasQuery.refetch()}
                />
              </div>
            ) : schemasQuery.data?.data ? (
              <div className="p-[var(--space-6)] space-y-4">
                <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                  <Database className="w-5 h-5 text-[var(--color-icon-muted)]" aria-hidden="true" />
                  <span className="font-[var(--font-mono)] text-[var(--text-sm)]">
                    {catalog}
                  </span>
                </div>
                <div
                  role="tablist"
                  aria-label={strings.access.tabsAriaLabel}
                  className="flex items-center gap-1 border-b border-[var(--color-border-subtle)]"
                >
                  <Link
                    to={`/assets/${encodeURIComponent(catalog)}`}
                    role="tab"
                    aria-selected={true}
                    className="px-4 py-2 text-[var(--text-sm)] font-[var(--weight-semibold)] border-b-2 -mb-px border-[var(--color-accent)] text-[var(--color-accent)]"
                  >
                    {strings.assets.schemasTitle}
                  </Link>
                  <Link
                    to={`/assets/${encodeURIComponent(catalog)}?tab=access`}
                    role="tab"
                    aria-selected={false}
                    className="px-4 py-2 text-[var(--text-sm)] font-[var(--weight-medium)] border-b-2 -mb-px border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  >
                    {strings.assets.tabs.access}
                  </Link>
                </div>
                <CatalogSchemasTable
                  catalog={catalog}
                  schemas={schemasQuery.data.data}
                  meta={schemasQuery.data.meta}
                />
              </div>
            ) : null
          ) : /* 4. Root / Idle Route */
          searchQuery && catalogsQuery.data?.data ? (
            <div className="p-[var(--space-6)] space-y-4">
              <h2 className="text-[var(--text-base)] font-[var(--weight-semibold)] text-[var(--color-text-primary)]">
                {strings.assets.searchResultsFor} &quot;{searchQuery}&quot;
              </h2>
              <div className="overflow-x-auto border border-[var(--color-border-subtle)] rounded-[var(--radius-panel)] bg-[var(--color-neutral-0)]">
                <table className="w-full text-left border-collapse text-[var(--text-sm)]">
                  <thead>
                    <tr className="border-b border-[var(--color-border-subtle)] bg-[var(--color-neutral-1)] text-[var(--color-text-secondary)] font-[var(--weight-semibold)]">
                      <th scope="col" className="px-4 py-2.5">{strings.assets.catalogsTitle}</th>
                      <th scope="col" className="px-4 py-2.5">{strings.assets.fields.owner}</th>
                      <th scope="col" className="px-4 py-2.5">{strings.assets.fields.comment}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border-subtle)]">
                    {catalogsQuery.data.data.map((cat) => (
                      <tr key={cat.full_name} className="hover:bg-[var(--color-neutral-1)]/60">
                        <td className="px-4 py-2.5 font-[var(--font-mono)]">
                          <Link
                            to={`/assets/${encodeURIComponent(cat.display_name)}`}
                            className="text-[var(--color-accent)] hover:underline focus:outline-none focus:ring-1 focus:ring-[var(--focus-ring-color)] rounded"
                          >
                            {cat.display_name}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 text-[var(--text-xs)] text-[var(--color-text-secondary)] font-[var(--font-mono)]">
                          {cat.owner || strings.assets.fields.unassignedOwner}
                        </td>
                        <td className="px-4 py-2.5 text-[var(--color-text-secondary)]">
                          {cat.comment || strings.assets.fields.noComment}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="p-[var(--space-6)]">
              <IdleView />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
