import { useMemo, useState } from "react";
import { Link } from "react-router";
import type { AssetSummary } from "@contracts/types";
import {
  ChevronDown,
  ChevronRight,
  Database,
  FileText,
  FolderTree,
  Table as TableIcon,
} from "lucide-react";
import { useCatalogs, useSchemaObjects, useSchemas } from "@/api/queries";
import { isAbortError } from "@/api/errors";
import { strings } from "@/lib/strings";
import { ErrorView, LocalizedSkeleton } from "./StateViews";
import { UnknownBadge } from "./UnknownBadge";

interface AssetTreeProps {
  currentCatalog?: string | undefined;
  currentSchema?: string | undefined;
  currentObjectType?: string | undefined;
  currentName?: string | undefined;
  searchQuery?: string | undefined;
}

const KNOWN_OBJECT_KINDS = new Set<string>([
  "table",
  "view",
  "materialized_view",
  "streaming_table",
  "volume",
  "function",
  "registered_model",
  "model_version",
]);

function SchemaObjectNode({
  catalog,
  schema,
  object,
  isActive,
}: {
  catalog: string;
  schema: string;
  object: AssetSummary;
  isActive: boolean;
}) {
  const isKindKnown = KNOWN_OBJECT_KINDS.has(object.kind);
  const targetUrl = `/assets/${encodeURIComponent(catalog)}/${encodeURIComponent(schema)}/${encodeURIComponent(object.securable_type)}/${encodeURIComponent(object.display_name)}`;

  return (
    <li className="pl-6 py-0.5">
      <Link
        to={targetUrl}
        aria-current={isActive ? "page" : undefined}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-[var(--radius-control)] text-[var(--text-xs)] font-[var(--font-mono)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)] ${
          isActive
            ? "bg-[var(--color-accent-light)] text-[var(--color-accent)] font-[var(--weight-semibold)] border border-[var(--color-accent)]/20"
            : "text-[var(--color-text-secondary)] hover:bg-[var(--color-neutral-2)] hover:text-[var(--color-text-primary)]"
        }`}
      >
        {object.kind === "volume" ? (
          <FileText className="w-3.5 h-3.5 text-[var(--color-icon-muted)] shrink-0" aria-hidden="true" />
        ) : (
          <TableIcon className="w-3.5 h-3.5 text-[var(--color-icon-muted)] shrink-0" aria-hidden="true" />
        )}
        <span className="truncate">{object.display_name}</span>
        {!isKindKnown ? <UnknownBadge value={object.kind} className="ml-auto scale-90" /> : null}
      </Link>
    </li>
  );
}

function SchemaNode({
  catalog,
  schema,
  currentSchema,
  currentObjectType,
  currentName,
  isExpanded,
  onToggleExpand,
}: {
  catalog: string;
  schema: AssetSummary;
  currentSchema?: string | undefined;
  currentObjectType?: string | undefined;
  currentName?: string | undefined;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const isSchemaActive = currentSchema === schema.display_name && !currentName;
  const objectsQuery = useSchemaObjects(catalog, schema.display_name, {
    enabled: isExpanded,
  });

  const targetUrl = `/assets/${encodeURIComponent(catalog)}/${encodeURIComponent(schema.display_name)}`;

  return (
    <li className="space-y-0.5">
      <div
        className={`flex items-center gap-1 px-1.5 py-1 rounded-[var(--radius-control)] text-[var(--text-sm)] transition-colors ${
          isSchemaActive
            ? "bg-[var(--color-accent-light)] text-[var(--color-accent)] font-[var(--weight-semibold)]"
            : "text-[var(--color-text-primary)] hover:bg-[var(--color-neutral-2)]"
        }`}
      >
        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={isExpanded}
          aria-label={
            isExpanded
              ? strings.assets.collapseSchemaAria.replace("{name}", schema.display_name)
              : strings.assets.expandSchemaAria.replace("{name}", schema.display_name)
          }
          className="p-0.5 text-[var(--color-icon-muted)] hover:text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--focus-ring-color)] rounded"
        >
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
          )}
        </button>

        <Link
          to={targetUrl}
          aria-current={isSchemaActive ? "page" : undefined}
          className="flex items-center gap-1.5 flex-1 min-w-0 font-[var(--font-mono)] text-[var(--text-xs)] focus:outline-none focus:ring-1 focus:ring-[var(--focus-ring-color)] rounded px-1"
        >
          <FolderTree className="w-3.5 h-3.5 text-[var(--color-icon-muted)] shrink-0" aria-hidden="true" />
          <span className="truncate">{schema.display_name}</span>
        </Link>
      </div>

      {isExpanded ? (
        <ul className="space-y-0.5">
          {objectsQuery.isLoading ? (
            <li className="pl-6 py-1">
              <LocalizedSkeleton className="h-4 w-28" />
            </li>
          ) : objectsQuery.isError && !isAbortError(objectsQuery.error) ? (
            <li className="pl-6 py-1">
              <ErrorView
                error={objectsQuery.error}
                onRetry={() => objectsQuery.refetch()}
                compact
              />
            </li>
          ) : objectsQuery.data?.data && objectsQuery.data.data.length > 0 ? (
            objectsQuery.data.data.map((obj) => (
              <SchemaObjectNode
                key={obj.full_name}
                catalog={catalog}
                schema={schema.display_name}
                object={obj}
                isActive={
                  currentSchema === schema.display_name &&
                  currentObjectType === obj.securable_type &&
                  currentName === obj.display_name
                }
              />
            ))
          ) : (
            <li className="pl-6 py-1 text-[11px] text-[var(--color-text-muted)] italic">
              {strings.assets.states.emptyObjects}
            </li>
          )}
        </ul>
      ) : null}
    </li>
  );
}

function CatalogNode({
  catalog,
  currentCatalog,
  currentSchema,
  currentObjectType,
  currentName,
  isExpanded,
  onToggleExpand,
  expandedSchemas,
  onToggleSchemaExpand,
}: {
  catalog: AssetSummary;
  currentCatalog?: string | undefined;
  currentSchema?: string | undefined;
  currentObjectType?: string | undefined;
  currentName?: string | undefined;
  isExpanded: boolean;
  onToggleExpand: () => void;
  expandedSchemas: Set<string>;
  onToggleSchemaExpand: (schemaFullName: string) => void;
}) {
  const isCatalogActive = currentCatalog === catalog.display_name && !currentSchema;
  const schemasQuery = useSchemas(catalog.display_name, {
    enabled: isExpanded,
  });
  const targetUrl = `/assets/${encodeURIComponent(catalog.display_name)}`;

  return (
    <li className="space-y-0.5">
      <div
        className={`flex items-center gap-1 px-1.5 py-1.5 rounded-[var(--radius-control)] text-[var(--text-sm)] transition-colors ${
          isCatalogActive
            ? "bg-[var(--color-accent-light)] text-[var(--color-accent)] font-[var(--weight-semibold)]"
            : "text-[var(--color-text-primary)] hover:bg-[var(--color-neutral-2)]"
        }`}
      >
        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={isExpanded}
          aria-label={
            isExpanded
              ? strings.assets.collapseCatalogAria.replace("{name}", catalog.display_name)
              : strings.assets.expandCatalogAria.replace("{name}", catalog.display_name)
          }
          className="p-0.5 text-[var(--color-icon-muted)] hover:text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--focus-ring-color)] rounded"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" aria-hidden="true" />
          ) : (
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          )}
        </button>

        <Link
          to={targetUrl}
          aria-current={isCatalogActive ? "page" : undefined}
          className="flex items-center gap-1.5 flex-1 min-w-0 font-[var(--font-mono)] font-[var(--weight-medium)] text-[var(--text-sm)] focus:outline-none focus:ring-1 focus:ring-[var(--focus-ring-color)] rounded px-1"
        >
          <Database className="w-4 h-4 text-[var(--color-icon-muted)] shrink-0" aria-hidden="true" />
          <span className="truncate">{catalog.display_name}</span>
        </Link>
      </div>

      {isExpanded ? (
        <ul className="pl-4 space-y-0.5">
          {schemasQuery.isLoading ? (
            <li className="py-1">
              <LocalizedSkeleton className="h-4 w-32" />
            </li>
          ) : schemasQuery.isError && !isAbortError(schemasQuery.error) ? (
            <li className="py-1">
              <ErrorView
                error={schemasQuery.error}
                onRetry={() => schemasQuery.refetch()}
                compact
              />
            </li>
          ) : schemasQuery.data?.data && schemasQuery.data.data.length > 0 ? (
            schemasQuery.data.data.map((s) => (
              <SchemaNode
                key={s.full_name}
                catalog={catalog.display_name}
                schema={s}
                currentSchema={currentCatalog === catalog.display_name ? currentSchema : undefined}
                currentObjectType={currentObjectType}
                currentName={currentName}
                isExpanded={expandedSchemas.has(s.full_name)}
                onToggleExpand={() => onToggleSchemaExpand(s.full_name)}
              />
            ))
          ) : (
            <li className="py-1 text-[11px] text-[var(--color-text-muted)] italic">
              {strings.assets.states.emptySchemas}
            </li>
          )}
        </ul>
      ) : null}
    </li>
  );
}

export function AssetTree({
  currentCatalog,
  currentSchema,
  currentObjectType,
  currentName,
  searchQuery,
}: AssetTreeProps) {
  const [userExpandedCatalogs, setUserExpandedCatalogs] = useState<Set<string>>(new Set());
  const [userExpandedSchemas, setUserExpandedSchemas] = useState<Set<string>>(new Set());

  const catalogsQuery = useCatalogs(
    searchQuery ? { query: searchQuery } : undefined,
  );

  // Derive expanded sets during render: user expansions + URL current scope
  const expandedCatalogs = useMemo(
    () => (currentCatalog ? new Set([...userExpandedCatalogs, currentCatalog]) : userExpandedCatalogs),
    [userExpandedCatalogs, currentCatalog],
  );

  const currentSchemaKey = currentCatalog && currentSchema ? `${currentCatalog}.${currentSchema}` : null;
  const expandedSchemas = useMemo(
    () => (currentSchemaKey ? new Set([...userExpandedSchemas, currentSchemaKey]) : userExpandedSchemas),
    [userExpandedSchemas, currentSchemaKey],
  );

  function handleToggleCatalog(catalogName: string) {
    setUserExpandedCatalogs((prev) => {
      const next = new Set(prev);
      if (expandedCatalogs.has(catalogName)) {
        next.delete(catalogName);
      } else {
        next.add(catalogName);
      }
      return next;
    });
  }

  function handleToggleSchema(schemaFullName: string) {
    setUserExpandedSchemas((prev) => {
      const next = new Set(prev);
      if (expandedSchemas.has(schemaFullName)) {
        next.delete(schemaFullName);
      } else {
        next.add(schemaFullName);
      }
      return next;
    });
  }

  return (
    <nav
      aria-label={strings.assets.treeAriaLabel}
      className="p-[var(--space-3)] overflow-y-auto text-[var(--text-sm)]"
    >
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--color-border-subtle)]">
        <span className="text-[var(--text-xs)] font-[var(--weight-semibold)] text-[var(--color-text-muted)] uppercase tracking-wider">
          {strings.assets.catalogsTitle}
        </span>
        {catalogsQuery.data?.data ? (
          <span className="text-[11px] text-[var(--color-text-muted)] font-[var(--font-mono)]">
            {catalogsQuery.data.data.length}
          </span>
        ) : null}
      </div>

      {catalogsQuery.isLoading ? (
        <div className="space-y-2 py-1">
          <LocalizedSkeleton className="h-6 w-full" />
          <LocalizedSkeleton className="h-6 w-5/6" />
          <LocalizedSkeleton className="h-6 w-4/6" />
        </div>
      ) : catalogsQuery.isError && !isAbortError(catalogsQuery.error) ? (
        <div className="py-1">
          <ErrorView
            error={catalogsQuery.error}
            onRetry={() => catalogsQuery.refetch()}
            compact
          />
        </div>
      ) : catalogsQuery.data?.data && catalogsQuery.data.data.length > 0 ? (
        <ul className="space-y-1">
          {catalogsQuery.data.data.map((cat) => (
            <CatalogNode
              key={cat.full_name}
              catalog={cat}
              currentCatalog={currentCatalog}
              currentSchema={currentSchema}
              currentObjectType={currentObjectType}
              currentName={currentName}
              isExpanded={expandedCatalogs.has(cat.display_name)}
              onToggleExpand={() => handleToggleCatalog(cat.display_name)}
              expandedSchemas={expandedSchemas}
              onToggleSchemaExpand={handleToggleSchema}
            />
          ))}
        </ul>
      ) : catalogsQuery.isFetching ? (
        <div className="space-y-2 py-1">
          <LocalizedSkeleton className="h-6 w-full" />
          <LocalizedSkeleton className="h-6 w-5/6" />
          <LocalizedSkeleton className="h-6 w-4/6" />
        </div>
      ) : (
        <p className="text-[var(--text-xs)] text-[var(--color-text-muted)] italic py-2">
          {strings.assets.states.emptyCatalogs}
        </p>
      )}
    </nav>
  );
}
