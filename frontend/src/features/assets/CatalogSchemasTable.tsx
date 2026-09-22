import { Link } from "react-router";
import type { AssetSummary, Meta } from "@contracts/types";
import { FolderTree } from "lucide-react";
import { strings } from "@/lib/strings";
import { EmptySuccessView, LimitationsView } from "./StateViews";

interface CatalogSchemasTableProps {
  catalog: string;
  schemas: AssetSummary[];
  meta?: Meta | undefined;
}

export function CatalogSchemasTable({
  catalog,
  schemas,
  meta,
}: CatalogSchemasTableProps) {
  if (schemas.length === 0) {
    return (
      <EmptySuccessView
        message={strings.assets.states.emptySchemas}
        meta={meta}
      />
    );
  }

  return (
    <div className="space-y-[var(--space-4)]">
      <div className="overflow-x-auto border border-[var(--color-border-subtle)] rounded-[var(--radius-panel)] bg-[var(--color-neutral-0)] shadow-[var(--shadow-panel)]">
        <table className="w-full text-left border-collapse text-[var(--text-sm)]">
          <caption className="sr-only">
            {strings.assets.schemasTitle} in {catalog}
          </caption>
          <thead>
            <tr className="border-b border-[var(--color-border-subtle)] bg-[var(--color-neutral-1)] text-[var(--color-text-secondary)] font-[var(--weight-semibold)]">
              <th scope="col" className="px-4 py-2.5 min-w-[180px]">
                {strings.assets.schemasTitle}
              </th>
              <th scope="col" className="px-4 py-2.5 w-40">
                {strings.assets.fields.owner}
              </th>
              <th scope="col" className="px-4 py-2.5 w-32">
                {strings.assets.fields.managed}
              </th>
              <th scope="col" className="px-4 py-2.5">
                {strings.assets.fields.comment}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border-subtle)]">
            {schemas.map((s) => (
              <tr
                key={s.full_name}
                className="hover:bg-[var(--color-neutral-1)]/60 transition-colors"
              >
                <td className="px-4 py-2.5 font-[var(--font-mono)] font-[var(--weight-medium)]">
                  <Link
                    to={`/assets/${encodeURIComponent(catalog)}/${encodeURIComponent(s.display_name)}`}
                    className="inline-flex items-center gap-1.5 text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)] rounded"
                  >
                    <FolderTree className="w-4 h-4 text-[var(--color-icon-muted)]" aria-hidden="true" />
                    <span>{s.display_name}</span>
                  </Link>
                </td>
                <td className="px-4 py-2.5 font-[var(--font-mono)] text-[var(--text-xs)] text-[var(--color-text-secondary)]">
                  {s.owner || strings.assets.fields.unassignedOwner}
                </td>
                <td className="px-4 py-2.5 text-[var(--text-xs)] text-[var(--color-text-muted)]">
                  {s.managed}
                </td>
                <td className="px-4 py-2.5 text-[var(--text-sm)] text-[var(--color-text-secondary)] max-w-md truncate">
                  {s.comment || (
                    <span className="italic text-[var(--color-text-muted)]">
                      {strings.assets.fields.noComment}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <LimitationsView meta={meta} />
    </div>
  );
}
