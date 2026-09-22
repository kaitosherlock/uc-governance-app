import type { DependenciesData } from "@contracts/types";
import { AlertCircle, CheckCircle2, Copy, FileCode2 } from "lucide-react";
import { middleTruncate } from "@/lib/fqn";
import { strings } from "@/lib/strings";
import { UnknownBadge } from "./UnknownBadge";

interface AssetDependenciesViewProps {
  dependencies: DependenciesData;
}

const KNOWN_DEPENDENCY_KINDS = new Set([
  "view",
  "materialized_view",
  "streaming_table",
  "downstream_table",
  "foreign_catalog",
  "share",
  "policy_function",
  "quality_monitor",
  "model_version",
  "unknown",
]);

export function AssetDependenciesView({ dependencies }: AssetDependenciesViewProps) {
  const { known, disclaimer } = dependencies;

  async function handleCopy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Ignore clipboard write failure
    }
  }

  return (
    <div className="space-y-[var(--space-3)]">
      <div className="flex items-center justify-between">
        <h3 className="text-[var(--text-md)] font-[var(--weight-semibold)] text-[var(--color-text-primary)]">
          {strings.assets.dependencies.title}
        </h3>
        <span className="text-[var(--text-xs)] text-[var(--color-text-muted)]">
          {known.length === 1
            ? strings.assets.itemCount
            : strings.assets.itemsCount.replace("{count}", String(known.length))}
        </span>
      </div>

      {known.length === 0 ? (
        <div className="p-[var(--space-4)] text-[var(--text-sm)] text-[var(--color-text-secondary)] italic border border-[var(--color-border-subtle)] rounded-[var(--radius-panel)] bg-[var(--color-neutral-0)]">
          {strings.assets.dependencies.empty}
        </div>
      ) : (
        <div className="overflow-x-auto border border-[var(--color-border-subtle)] rounded-[var(--radius-panel)] bg-[var(--color-neutral-0)]">
          <table className="w-full text-left border-collapse text-[var(--text-sm)]">
            <caption className="sr-only">{strings.assets.dependencies.title}</caption>
            <thead>
              <tr className="border-b border-[var(--color-border-subtle)] bg-[var(--color-neutral-1)] text-[var(--color-text-secondary)] font-[var(--weight-semibold)]">
                <th scope="col" className="px-3 py-2.5 w-32">
                  {strings.assets.dependencies.kind}
                </th>
                <th scope="col" className="px-3 py-2.5">
                  {strings.assets.dependencies.name}
                </th>
                <th scope="col" className="px-3 py-2.5 w-36">
                  {strings.assets.dependencies.source}
                </th>
                <th scope="col" className="px-3 py-2.5 w-28">
                  {strings.assets.dependencies.verified}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {known.map((dep, idx) => {
                const isKnownKind = KNOWN_DEPENDENCY_KINDS.has(dep.kind);
                const trunc = middleTruncate(dep.full_name, 40, 16);

                return (
                  <tr key={`${dep.full_name}-${idx}`} className="hover:bg-[var(--color-neutral-1)]/60">
                    <td className="px-3 py-2 text-[var(--color-text-secondary)]">
                      {isKnownKind ? (
                        <span className="inline-flex items-center gap-1 text-[var(--text-xs)] font-[var(--weight-medium)] px-2 py-0.5 rounded bg-[var(--color-neutral-2)] border border-[var(--color-border-subtle)]">
                          <FileCode2 className="w-3 h-3 text-[var(--color-icon-muted)]" aria-hidden="true" />
                          <span>{dep.kind}</span>
                        </span>
                      ) : (
                        <UnknownBadge value={dep.kind} />
                      )}
                    </td>
                    <td className="px-3 py-2 font-[var(--font-mono)] text-[var(--color-text-primary)]">
                      <div className="flex items-center gap-1.5 group">
                        <span
                          title={trunc.full}
                          aria-label={trunc.full}
                          className="rounded px-0.5"
                        >
                          {trunc.display}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(dep.full_name)}
                          aria-label={`${strings.common.copyToClipboard} ${dep.full_name}`}
                          className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-0.5 text-[var(--color-icon-muted)] hover:text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--focus-ring-color)] rounded"
                        >
                          <Copy className="w-3 h-3" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-[var(--text-xs)] text-[var(--color-text-muted)] font-[var(--font-mono)]">
                      {dep.source}
                    </td>
                    <td className="px-3 py-2">
                      {dep.verified ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-[var(--weight-medium)] text-[var(--color-success)] bg-[var(--color-success-bg)] px-1.5 py-0.5 rounded">
                          <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                          <span>{strings.assets.dependencies.verifiedTrue}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-[var(--weight-medium)] text-[var(--color-warning)] bg-[var(--color-warning-bg)] px-1.5 py-0.5 rounded">
                          <AlertCircle className="w-3 h-3" aria-hidden="true" />
                          <span>{strings.assets.dependencies.verifiedFalse}</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Mandatory disclaimer rendered under dependencies */}
      {disclaimer ? (
        <p className="text-[var(--text-xs)] text-[var(--color-text-muted)] italic flex items-center gap-1.5 mt-1">
          <AlertCircle className="w-3.5 h-3.5 text-[var(--color-icon-muted)] shrink-0" aria-hidden="true" />
          <span>{disclaimer}</span>
        </p>
      ) : null}
    </div>
  );
}
