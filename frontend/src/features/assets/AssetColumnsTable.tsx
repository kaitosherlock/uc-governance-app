import { useId, useMemo, useState } from "react";
import type { Column } from "@contracts/types";
import { ArrowDown, ArrowUp, ArrowUpDown, Check, Copy, Shield } from "lucide-react";
import { strings } from "@/lib/strings";

interface AssetColumnsTableProps {
  columns: Column[];
}

type SortField = "position" | "name" | "type_text";
type SortDirection = "asc" | "desc";

export function AssetColumnsTable({ columns }: AssetColumnsTableProps) {
  const [sortField, setSortField] = useState<SortField>("position");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [copiedColumn, setCopiedColumn] = useState<string | null>(null);
  const tableId = useId();

  const sortedColumns = useMemo(() => {
    const list = [...columns];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === "position") {
        cmp = a.position - b.position;
      } else if (sortField === "name") {
        cmp = a.name.localeCompare(b.name);
      } else if (sortField === "type_text") {
        cmp = a.type_text.localeCompare(b.type_text);
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return list;
  }, [columns, sortField, sortDirection]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  }

  async function handleCopy(name: string) {
    try {
      await navigator.clipboard.writeText(name);
      setCopiedColumn(name);
      setTimeout(() => setCopiedColumn(null), 2000);
    } catch {
      // Ignore clipboard write failure
    }
  }

  if (columns.length === 0) {
    return (
      <div className="p-[var(--space-4)] text-[var(--text-sm)] text-[var(--color-text-secondary)] italic border border-[var(--color-border-subtle)] rounded-[var(--radius-panel)] bg-[var(--color-neutral-0)]">
        {strings.assets.columnsTable.emptyColumns}
      </div>
    );
  }

  function getAriaSort(field: SortField): "ascending" | "descending" | "none" {
    if (sortField !== field) return "none";
    return sortDirection === "asc" ? "ascending" : "descending";
  }

  return (
    <div className="overflow-x-auto border border-[var(--color-border-subtle)] rounded-[var(--radius-panel)] bg-[var(--color-neutral-0)]">
      <table className="w-full text-left border-collapse text-[var(--text-sm)]" id={tableId}>
        <caption className="sr-only">{strings.assets.columnsTable.title}</caption>
        <thead>
          <tr className="border-b border-[var(--color-border-subtle)] bg-[var(--color-neutral-1)] text-[var(--color-text-secondary)] font-[var(--weight-semibold)]">
            <th
              scope="col"
              aria-sort={getAriaSort("position")}
              className="px-3 py-2.5 w-16"
            >
              <button
                type="button"
                onClick={() => handleSort("position")}
                className="flex items-center gap-1 hover:text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)] rounded"
              >
                <span>{strings.assets.columnsTable.position}</span>
                {sortField === "position" ? (
                  sortDirection === "asc" ? (
                    <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
                  ) : (
                    <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
                  )
                ) : (
                  <ArrowUpDown className="w-3 h-3 text-[var(--color-icon-muted)]" aria-hidden="true" />
                )}
              </button>
            </th>
            <th
              scope="col"
              aria-sort={getAriaSort("name")}
              className="px-3 py-2.5 min-w-[140px]"
            >
              <button
                type="button"
                onClick={() => handleSort("name")}
                className="flex items-center gap-1 hover:text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)] rounded"
              >
                <span>{strings.assets.columnsTable.name}</span>
                {sortField === "name" ? (
                  sortDirection === "asc" ? (
                    <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
                  ) : (
                    <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
                  )
                ) : (
                  <ArrowUpDown className="w-3 h-3 text-[var(--color-icon-muted)]" aria-hidden="true" />
                )}
              </button>
            </th>
            <th
              scope="col"
              aria-sort={getAriaSort("type_text")}
              className="px-3 py-2.5 min-w-[120px]"
            >
              <button
                type="button"
                onClick={() => handleSort("type_text")}
                className="flex items-center gap-1 hover:text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)] rounded"
              >
                <span>{strings.assets.columnsTable.type}</span>
                {sortField === "type_text" ? (
                  sortDirection === "asc" ? (
                    <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
                  ) : (
                    <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
                  )
                ) : (
                  <ArrowUpDown className="w-3 h-3 text-[var(--color-icon-muted)]" aria-hidden="true" />
                )}
              </button>
            </th>
            <th scope="col" className="px-3 py-2.5 w-24">
              {strings.assets.columnsTable.nullable}
            </th>
            <th scope="col" className="px-3 py-2.5 min-w-[120px]">
              {strings.assets.columnsTable.mask}
            </th>
            <th scope="col" className="px-3 py-2.5 min-w-[140px]">
              {strings.assets.columnsTable.tags}
            </th>
            <th scope="col" className="px-3 py-2.5">
              {strings.assets.columnsTable.comment}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border-subtle)]">
          {sortedColumns.map((col) => {
            const isCopied = copiedColumn === col.name;
            return (
              <tr
                key={col.name}
                className="hover:bg-[var(--color-neutral-1)]/60 transition-colors"
              >
                <td className="px-3 py-2 font-[var(--font-mono)] text-[var(--color-text-muted)]">
                  {col.position}
                </td>
                <td className="px-3 py-2 font-[var(--font-mono)] font-[var(--weight-medium)] text-[var(--color-text-primary)]">
                  <div className="flex items-center gap-1.5 group">
                    <span>{col.name}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(col.name)}
                      aria-label={`${strings.common.copyToClipboard} ${col.name}`}
                      title={isCopied ? strings.common.copied : strings.common.copyToClipboard}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-0.5 text-[var(--color-icon-muted)] hover:text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--focus-ring-color)] rounded"
                    >
                      {isCopied ? (
                        <Check className="w-3 h-3 text-[var(--color-success)]" aria-hidden="true" />
                      ) : (
                        <Copy className="w-3 h-3" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </td>
                <td className="px-3 py-2 font-[var(--font-mono)] text-[var(--color-text-secondary)]">
                  {col.type_text}
                </td>
                <td className="px-3 py-2 text-[var(--color-text-secondary)]">
                  {col.nullable === true ? "YES" : col.nullable === false ? "NO" : strings.common.unknown}
                </td>
                <td className="px-3 py-2">
                  {col.mask ? (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-[var(--font-mono)] bg-[var(--color-info-bg)] text-[var(--color-info)] border border-[var(--color-info)]/30"
                      title={`Mask function: ${col.mask.function_full_name}`}
                    >
                      <Shield className="w-3 h-3" aria-hidden="true" />
                      <span>{col.mask.function_full_name.split(".").pop()}</span>
                    </span>
                  ) : (
                    <span className="text-[var(--color-text-muted)] text-[12px]">
                      {strings.common.notApplicable}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {col.tags && col.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {col.tags.map((tag) => (
                        <span
                          key={tag.key}
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-[var(--font-mono)] bg-[var(--color-neutral-2)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)]"
                          title={`${tag.key}${tag.value ? `=${tag.value}` : ""} (${tag.kind})`}
                        >
                          <span>{tag.key}</span>
                          {tag.value ? <span className="opacity-75">={tag.value}</span> : null}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[var(--color-text-muted)] text-[12px]">
                      {strings.common.notApplicable}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-[var(--color-text-secondary)] max-w-xs truncate">
                  {col.comment || (
                    <span className="text-[var(--color-text-muted)] italic">
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
  );
}
