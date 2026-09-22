import { useState } from "react";
import { Link } from "react-router";
import type {
  ColumnMaskRef,
  PlanChanges,
  PlanKind,
  RowFilterRef,
} from "@contracts/types";
import { AlertCircle, ExternalLink, Filter, Plus, Shield, Trash2 } from "lucide-react";
import { useFunctionDetail, useRowAccess } from "@/api/queries";
import { PlanFlow } from "@/features/plans/PlanFlow";
import { strings } from "@/lib/strings";
import { ErrorView, IdleView, LimitationsView, LocalizedSkeleton } from "./StateViews";

export interface AssetRowAccessViewProps {
  fullName: string;
  onRefresh?: (() => void) | undefined;
}

export function AssetRowAccessView({
  fullName,
  onRefresh,
}: AssetRowAccessViewProps) {
  const [activePlan, setActivePlan] = useState<{
    kind: PlanKind;
    initialChanges: PlanChanges;
  } | null>(null);

  const rowAccessQuery = useRowAccess(fullName);

  if (!fullName) {
    return (
      <IdleView
        title={strings.rowAccess.title}
        description={strings.rowAccess.description}
      />
    );
  }

  if (rowAccessQuery.isLoading) {
    return (
      <div className="space-y-4 py-4" data-testid="row-access-loading">
        <LocalizedSkeleton className="h-8 w-48" />
        <LocalizedSkeleton className="h-28 w-full" />
        <LocalizedSkeleton className="h-28 w-full" />
      </div>
    );
  }

  if (rowAccessQuery.isError) {
    return (
      <ErrorView
        error={rowAccessQuery.error}
        onRetry={() => rowAccessQuery.refetch()}
      />
    );
  }

  const accessData = rowAccessQuery.data?.data;
  const rowFilter = accessData?.row_filter ?? null;
  const columnMasks = accessData?.column_masks ?? [];

  const handleOpenSetFilter = () => {
    setActivePlan({
      kind: "set_row_filter",
      initialChanges: {},
    });
  };

  const handleOpenDropFilter = () => {
    setActivePlan({
      kind: "drop_row_filter",
      initialChanges: {},
    });
  };

  const handleOpenSetMask = (column?: string) => {
    setActivePlan({
      kind: "set_column_mask",
      initialChanges: column ? { mask_column: column } : {},
    });
  };

  const handleOpenDropMask = (column: string) => {
    setActivePlan({
      kind: "drop_column_mask",
      initialChanges: { column },
    });
  };

  const handlePlanSuccess = () => {
    setActivePlan(null);
    rowAccessQuery.refetch();
    if (onRefresh) onRefresh();
  };

  return (
    <div className="space-y-8 text-[var(--color-text-primary)]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--color-border-subtle)] pb-4">
        <div>
          <h2 className="text-[var(--text-md)] font-[var(--weight-semibold)] text-[var(--color-text-primary)]">
            {strings.rowAccess.panelHeading}
          </h2>
          <p className="text-[var(--text-xs)] text-[var(--color-text-secondary)] mt-0.5">
            {strings.rowAccess.description}
          </p>
        </div>
      </div>

      {/* Row Filter Section */}
      <section className="space-y-3" aria-labelledby="row-filter-heading">
        <div className="flex items-center justify-between gap-2">
          <h3
            id="row-filter-heading"
            className="text-[var(--text-xs)] font-[var(--weight-semibold)] text-[var(--color-text-muted)] uppercase tracking-wider"
          >
            {strings.rowAccess.rowFilterHeading}
          </h3>
          {!rowFilter && (
            <button
              type="button"
              onClick={handleOpenSetFilter}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[var(--text-xs)] font-[var(--weight-medium)] bg-[var(--color-accent)] text-white rounded-[var(--radius-control)] hover:bg-[var(--color-accent-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)]"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{strings.rowAccess.setRowFilterButton}</span>
            </button>
          )}
        </div>

        {rowFilter ? (
          <RowFilterCard
            rowFilter={rowFilter}
            onDrop={handleOpenDropFilter}
          />
        ) : (
          <div className="p-4 rounded-[var(--radius-control)] bg-[var(--color-neutral-1)] border border-[var(--color-border-subtle)] text-[var(--text-sm)] text-[var(--color-text-muted)] italic">
            {strings.rowAccess.emptyRowFilter}
          </div>
        )}
      </section>

      {/* Column Masks Section */}
      <section className="space-y-3" aria-labelledby="column-masks-heading">
        <div className="flex items-center justify-between gap-2">
          <h3
            id="column-masks-heading"
            className="text-[var(--text-xs)] font-[var(--weight-semibold)] text-[var(--color-text-muted)] uppercase tracking-wider"
          >
            {strings.rowAccess.columnMasksHeading}
          </h3>
          <button
            type="button"
            onClick={() => handleOpenSetMask()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[var(--text-xs)] font-[var(--weight-medium)] bg-[var(--color-accent)] text-white rounded-[var(--radius-control)] hover:bg-[var(--color-accent-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)]"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{strings.rowAccess.setColumnMaskButton}</span>
          </button>
        </div>

        {columnMasks.length === 0 ? (
          <div className="p-4 rounded-[var(--radius-control)] bg-[var(--color-neutral-1)] border border-[var(--color-border-subtle)] text-[var(--text-sm)] text-[var(--color-text-muted)] italic">
            {strings.rowAccess.emptyColumnMasks}
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border-subtle)] border border-[var(--color-border-subtle)] rounded-[var(--radius-control)] bg-[var(--color-neutral-0)]">
            {columnMasks.map((mask) => (
              <ColumnMaskRow
                key={mask.column}
                mask={mask}
                onDrop={() => handleOpenDropMask(mask.column)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Limitations View Underneath Data */}
      {rowAccessQuery.data?.meta && (
        <LimitationsView meta={rowAccessQuery.data.meta} />
      )}

      {/* PlanFlow Modal */}
      {activePlan && (
        <PlanFlow
          kind={activePlan.kind}
          targets={[
            {
              securable_type: "TABLE",
              full_name: fullName,
            },
          ]}
          initialChanges={activePlan.initialChanges}
          isOpen={true}
          onClose={() => setActivePlan(null)}
          onSuccess={handlePlanSuccess}
        />
      )}
    </div>
  );
}

interface RowFilterCardProps {
  rowFilter: RowFilterRef;
  onDrop: () => void;
}

function RowFilterCard({ rowFilter, onDrop }: RowFilterCardProps) {
  const isAbac = rowFilter.attached_via === "abac_policy";
  const functionQuery = useFunctionDetail(rowFilter.function_full_name);
  const fn = functionQuery.data?.data;

  return (
    <div className="p-4 rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-neutral-0)] space-y-3 text-[var(--text-xs)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[var(--color-accent)]" aria-hidden="true" />
          <span className="font-[var(--weight-semibold)] text-[var(--text-sm)] text-[var(--color-text-primary)]">
            {rowFilter.function_full_name}
          </span>
          {isAbac ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-[var(--weight-medium)] bg-[var(--color-info-bg)] text-[var(--color-info)] border border-[var(--color-info)]/30">
              <Shield className="w-3 h-3" aria-hidden="true" />
              <span>{strings.rowAccess.abacBadge}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-[var(--weight-medium)] bg-[var(--color-neutral-1)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)]">
              <span>{strings.rowAccess.directBadge}</span>
            </span>
          )}
        </div>

        {/* Action button */}
        {isAbac ? (
          <div className="flex items-center gap-2">
            <Link
              to={`/policies?selected=${encodeURIComponent(rowFilter.policy_id || "")}`}
              className="inline-flex items-center gap-1 text-[11px] font-[var(--weight-medium)] text-[var(--color-accent)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)] rounded px-2 py-1"
            >
              <span>{strings.rowAccess.viewPolicyLink.replace("{name}", rowFilter.policy_id || "policy")}</span>
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <button
            type="button"
            onClick={onDrop}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-[var(--weight-medium)] text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] border border-[var(--color-danger)]/30 rounded-[var(--radius-control)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)]"
          >
            <Trash2 className="w-3 h-3" aria-hidden="true" />
            <span>{strings.rowAccess.dropRowFilterButton}</span>
          </button>
        )}
      </div>

      {/* ABAC Notice */}
      {isAbac && (
        <div className="p-2.5 bg-[var(--color-info-bg)] border border-[var(--color-info)]/30 rounded text-[11px] text-[var(--color-text-secondary)] flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-[var(--color-info)] shrink-0 mt-0.5" aria-hidden="true" />
          <span>{strings.rowAccess.abacNotice}</span>
        </div>
      )}

      {/* Input Columns */}
      <div className="flex items-center gap-2 text-[var(--text-xs)]">
        <span className="font-[var(--weight-medium)] text-[var(--color-text-secondary)]">
          {strings.rowAccess.inputColumnsLabel}:
        </span>
        <div className="flex flex-wrap gap-1">
          {rowFilter.input_columns.map((col) => (
            <span
              key={col}
              className="font-[var(--font-mono)] bg-[var(--color-neutral-1)] px-1.5 py-0.5 rounded border border-[var(--color-border-subtle)] text-[var(--color-text-primary)]"
            >
              {col}
            </span>
          ))}
        </div>
      </div>

      {/* Function Details (parameters, return type, owner) */}
      {fn && (
        <div className="pt-2 border-t border-[var(--color-border-subtle)] grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-[var(--color-text-secondary)]">
          <div>
            <span className="text-[var(--color-text-muted)] block">{strings.rowAccess.functionOwnerLabel}:</span>
            <span className="font-[var(--font-mono)] text-[var(--color-text-primary)]">{fn.owner || "—"}</span>
          </div>
          <div>
            <span className="text-[var(--color-text-muted)] block">{strings.rowAccess.returnTypeLabel}:</span>
            <span className="font-[var(--font-mono)] text-[var(--color-text-primary)]">{fn.return_type || "BOOLEAN"}</span>
          </div>
          <div>
            <span className="text-[var(--color-text-muted)] block">{strings.rowAccess.functionParamsLabel}:</span>
            <span className="font-[var(--font-mono)] text-[var(--color-text-primary)]">
              {fn.parameters.map((p) => `${p.name}: ${p.type_text}`).join(", ") || "—"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

interface ColumnMaskRowProps {
  mask: ColumnMaskRef;
  onDrop: () => void;
}

function ColumnMaskRow({ mask, onDrop }: ColumnMaskRowProps) {
  const isAbac = mask.attached_via === "abac_policy";
  const functionQuery = useFunctionDetail(mask.function_full_name);
  const fn = functionQuery.data?.data;

  return (
    <div className="p-3 text-[var(--text-xs)] space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-[var(--weight-semibold)] text-[var(--color-text-muted)] uppercase tracking-wider text-[11px]">
            {strings.rowAccess.columnLabel}:
          </span>
          <span className="font-[var(--font-mono)] font-[var(--weight-semibold)] text-[var(--color-text-primary)]">
            {mask.column}
          </span>
          <span className="text-[var(--color-text-muted)]">→</span>
          <span className="font-[var(--font-mono)] text-[var(--color-text-secondary)]">
            {mask.function_full_name}
          </span>

          {isAbac ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-[var(--weight-medium)] bg-[var(--color-info-bg)] text-[var(--color-info)] border border-[var(--color-info)]/30">
              <Shield className="w-2.5 h-2.5" aria-hidden="true" />
              <span>{strings.rowAccess.abacBadge}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-[var(--weight-medium)] bg-[var(--color-neutral-1)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)]">
              <span>{strings.rowAccess.directBadge}</span>
            </span>
          )}
        </div>

        {/* Action */}
        {isAbac ? (
          <Link
            to={`/policies?selected=${encodeURIComponent(mask.policy_id || "")}`}
            className="inline-flex items-center gap-1 text-[11px] font-[var(--weight-medium)] text-[var(--color-accent)] hover:underline focus:outline-none focus:ring-1 focus:ring-[var(--focus-ring-color)] rounded px-1.5 py-0.5"
          >
            <span>{strings.rowAccess.viewPolicyLink.replace("{name}", mask.policy_id || "policy")}</span>
            <ExternalLink className="w-3 h-3" aria-hidden="true" />
          </Link>
        ) : (
          <button
            type="button"
            onClick={onDrop}
            aria-label={strings.rowAccess.dropMaskAria.replace("{column}", mask.column)}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-[var(--weight-medium)] text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] border border-[var(--color-danger)]/30 rounded-[var(--radius-control)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)]"
          >
            <Trash2 className="w-3 h-3" aria-hidden="true" />
            <span>{strings.rowAccess.dropColumnMaskButton}</span>
          </button>
        )}
      </div>

      {/* ABAC Notice */}
      {isAbac && (
        <p className="text-[11px] text-[var(--color-text-muted)] italic">
          {strings.rowAccess.abacNotice}
        </p>
      )}

      {/* Using Columns */}
      {mask.using_columns && mask.using_columns.length > 0 && (
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="text-[var(--color-text-muted)]">{strings.rowAccess.usingColumnsLabel}:</span>
          <span className="font-[var(--font-mono)] text-[var(--color-text-secondary)]">
            {mask.using_columns.join(", ")}
          </span>
        </div>
      )}

      {/* Function Detail Preview */}
      {fn && (
        <div className="flex flex-wrap gap-4 text-[11px] text-[var(--color-text-muted)] pt-1 border-t border-[var(--color-border-subtle)]">
          <span>
            {strings.rowAccess.functionOwnerLabel}: <strong className="font-normal font-[var(--font-mono)] text-[var(--color-text-secondary)]">{fn.owner || "—"}</strong>
          </span>
          <span>
            {strings.rowAccess.returnTypeLabel}: <strong className="font-normal font-[var(--font-mono)] text-[var(--color-text-secondary)]">{fn.return_type || "—"}</strong>
          </span>
        </div>
      )}
    </div>
  );
}
