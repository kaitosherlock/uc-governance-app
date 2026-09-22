import { useMemo, useState } from "react";
import { Link } from "react-router";
import type { AssetSummary, Meta } from "@contracts/types";
import { Database, FileText } from "lucide-react";
import { strings } from "@/lib/strings";
import { AssetActionControl } from "./AssetActionControl";
import { EmptySuccessView, LimitationsView } from "./StateViews";
import { UnknownBadge } from "./UnknownBadge";

interface SchemaObjectsTableProps {
  catalog: string;
  schema: string;
  objects: AssetSummary[];
  meta?: Meta | undefined;
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

export function SchemaObjectsTable({
  catalog,
  schema,
  objects,
  meta,
}: SchemaObjectsTableProps) {
  const [kindFilter, setKindFilter] = useState<string>("all");

  const filteredObjects = useMemo(() => {
    if (kindFilter === "all") return objects;
    return objects.filter((o) => {
      if (kindFilter === "tables") {
        return o.kind === "table" || o.kind === "materialized_view" || o.kind === "streaming_table";
      }
      if (kindFilter === "views") {
        return o.kind === "view";
      }
      if (kindFilter === "volumes") {
        return o.kind === "volume";
      }
      if (kindFilter === "functions") {
        return o.kind === "function";
      }
      if (kindFilter === "models") {
        return o.kind === "registered_model" || o.kind === "model_version";
      }
      return o.kind === kindFilter;
    });
  }, [objects, kindFilter]);

  if (objects.length === 0) {
    return (
      <EmptySuccessView
        message={strings.assets.states.emptyObjects}
        meta={meta}
      />
    );
  }

  return (
    <div className="space-y-[var(--space-4)]">
      {/* Kind filter pills */}
      <div className="flex items-center gap-1.5 flex-wrap text-[var(--text-xs)]">
        <span className="text-[var(--color-text-muted)] font-[var(--weight-medium)] mr-1">
          {strings.assets.filterByKind}
        </span>
        {[
          { id: "all", label: strings.assets.allKinds },
          { id: "tables", label: strings.assets.tablesKind },
          { id: "views", label: strings.assets.viewsKind },
          { id: "volumes", label: strings.assets.volumesKind },
          { id: "functions", label: strings.assets.functionsKind },
          { id: "models", label: strings.assets.modelsKind },
        ].map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => setKindFilter(filter.id)}
            className={`px-2.5 py-1 rounded-[var(--radius-control)] border transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)] ${
              kindFilter === filter.id
                ? "bg-[var(--color-accent)] text-white border-[var(--color-accent)] font-[var(--weight-medium)]"
                : "bg-[var(--color-neutral-0)] text-[var(--color-text-secondary)] border-[var(--color-border-subtle)] hover:bg-[var(--color-neutral-1)]"
            }`}
          >
            {filter.label}
          </button>
        ))}
        <span className="ml-auto text-[var(--color-text-muted)]">
          {strings.assets.objectsCount
            .replace("{filtered}", String(filteredObjects.length))
            .replace("{total}", String(objects.length))}
        </span>
      </div>

      {/* Objects Table */}
      <div className="overflow-x-auto border border-[var(--color-border-subtle)] rounded-[var(--radius-panel)] bg-[var(--color-neutral-0)] shadow-[var(--shadow-panel)]">
        <table className="w-full text-left border-collapse text-[var(--text-sm)]">
          <caption className="sr-only">
            {strings.assets.objectsTitle} in {catalog}.{schema}
          </caption>
          <thead>
            <tr className="border-b border-[var(--color-border-subtle)] bg-[var(--color-neutral-1)] text-[var(--color-text-secondary)] font-[var(--weight-semibold)]">
              <th scope="col" className="px-4 py-2.5 min-w-[180px]">
                {strings.assets.objectsTitle}
              </th>
              <th scope="col" className="px-4 py-2.5 w-36">
                {strings.assets.fields.kind}
              </th>
              <th scope="col" className="px-4 py-2.5 w-40">
                {strings.assets.fields.owner}
              </th>
              <th scope="col" className="px-4 py-2.5">
                {strings.assets.fields.comment}
              </th>
              <th scope="col" className="px-4 py-2.5 w-44">
                {strings.assets.actionsHeading}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border-subtle)]">
            {filteredObjects.map((obj) => {
              const isKindKnown = KNOWN_OBJECT_KINDS.has(obj.kind);
              const objectUrl = `/assets/${encodeURIComponent(catalog)}/${encodeURIComponent(schema)}/${encodeURIComponent(obj.securable_type)}/${encodeURIComponent(obj.display_name)}`;

              return (
                <tr
                  key={obj.full_name}
                  className="hover:bg-[var(--color-neutral-1)]/60 transition-colors"
                >
                  <td className="px-4 py-2.5 font-[var(--font-mono)] font-[var(--weight-medium)]">
                    <Link
                      to={objectUrl}
                      className="inline-flex items-center gap-1.5 text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)] rounded"
                    >
                      {obj.kind === "volume" ? (
                        <FileText className="w-4 h-4 text-[var(--color-icon-muted)]" aria-hidden="true" />
                      ) : (
                        <Database className="w-4 h-4 text-[var(--color-icon-muted)]" aria-hidden="true" />
                      )}
                      <span>{obj.display_name}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-[var(--text-xs)]">
                    {isKindKnown ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-[var(--color-neutral-2)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)]">
                        {obj.kind}
                      </span>
                    ) : (
                      <UnknownBadge value={obj.kind} />
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-[var(--font-mono)] text-[var(--text-xs)] text-[var(--color-text-secondary)]">
                    {obj.owner || strings.assets.fields.unassignedOwner}
                  </td>
                  <td className="px-4 py-2.5 text-[var(--text-sm)] text-[var(--color-text-secondary)] max-w-sm truncate">
                    {obj.comment || (
                      <span className="italic text-[var(--color-text-muted)]">
                        {strings.assets.fields.noComment}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {obj.allowed_actions && obj.allowed_actions.length > 0 ? (
                      <div className="flex items-center gap-1">
                        {obj.allowed_actions.map((act) => (
                          <AssetActionControl key={act.action} action={act} />
                        ))}
                      </div>
                    ) : (
                      <span className="text-[var(--color-text-muted)] text-[12px]">
                        {strings.common.notApplicable}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <LimitationsView meta={meta} />
    </div>
  );
}
