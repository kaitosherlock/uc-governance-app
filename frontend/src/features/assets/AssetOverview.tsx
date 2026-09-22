import { useState } from "react";
import { useSearchParams } from "react-router";
import type { AssetDetail, Meta } from "@contracts/types";
import {
  Check,
  Code2,
  Copy,
  Database,
  FileCode2,
  Layers,
  RefreshCw,
  Tag as TagIcon,
  User,
} from "lucide-react";
import { useAssetDependencies } from "@/api/queries";
import { middleTruncate } from "@/lib/fqn";
import { strings } from "@/lib/strings";
import { AssetActionControl } from "./AssetActionControl";
import { AssetColumnsTable } from "./AssetColumnsTable";
import { AssetDependenciesView } from "./AssetDependenciesView";
import { AssetGrantsView } from "./AssetGrantsView";
import { AssetRowAccessView } from "./AssetRowAccessView";
import { AssetTagsView } from "./AssetTagsView";
import { ErrorView, LimitationsView, LocalizedSkeleton } from "./StateViews";
import { UnknownBadge } from "./UnknownBadge";
import { PlanFlow } from "@/features/plans/PlanFlow";

interface AssetOverviewProps {
  asset: AssetDetail;
  meta?: Meta | undefined;
  onRefresh?: (() => void) | undefined;
}

const KNOWN_SECURABLE_TYPES = new Set<string>([
  "METASTORE",
  "CATALOG",
  "SCHEMA",
  "TABLE",
  "VOLUME",
  "FUNCTION",
  "REGISTERED_MODEL",
  "STORAGE_CREDENTIAL",
  "CREDENTIAL",
  "EXTERNAL_LOCATION",
  "CONNECTION",
  "SHARE",
  "RECIPIENT",
  "PROVIDER",
]);

const KNOWN_OBJECT_KINDS = new Set<string>([
  "metastore",
  "catalog",
  "schema",
  "table",
  "view",
  "materialized_view",
  "streaming_table",
  "volume",
  "function",
  "registered_model",
  "model_version",
]);

export function AssetOverview({ asset, meta, onRefresh }: AssetOverviewProps) {
  const [copiedFqn, setCopiedFqn] = useState(false);
  const [copiedLocation, setCopiedLocation] = useState(false);
  const [isTransferOwnershipOpen, setIsTransferOwnershipOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "overview";

  function handleTabChange(tabKey: string) {
    const next = new URLSearchParams(searchParams);
    if (tabKey === "overview") {
      next.delete("tab");
    } else {
      next.set("tab", tabKey);
    }
    setSearchParams(next);
  }

  // Fetch dependencies for this asset
  const dependenciesQuery = useAssetDependencies(asset.securable_type, asset.full_name);

  const fqnTrunc = middleTruncate(asset.full_name, 48, 20);
  const locationTrunc = asset.storage_location
    ? middleTruncate(asset.storage_location, 50, 22)
    : null;

  async function handleCopyFqn() {
    try {
      await navigator.clipboard.writeText(asset.full_name);
      setCopiedFqn(true);
      setTimeout(() => setCopiedFqn(false), 2000);
    } catch {
      // Ignore clipboard write failure
    }
  }

  async function handleCopyLocation() {
    if (!asset.storage_location) return;
    try {
      await navigator.clipboard.writeText(asset.storage_location);
      setCopiedLocation(true);
      setTimeout(() => setCopiedLocation(false), 2000);
    } catch {
      // Ignore clipboard write failure
    }
  }

  const isSecurableTypeKnown = KNOWN_SECURABLE_TYPES.has(asset.securable_type);
  const isKindKnown = KNOWN_OBJECT_KINDS.has(asset.kind);

  return (
    <div className="space-y-[var(--space-6)] px-[var(--space-6)] py-[var(--space-5)] max-w-6xl">
      {/* Header card with identity and actions */}
      <div className="p-[var(--space-5)] bg-[var(--color-neutral-0)] border border-[var(--color-border-subtle)] rounded-[var(--radius-panel)] shadow-[var(--shadow-panel)]">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-[var(--space-4)]">
          <div className="min-w-0 space-y-2">
            {/* Badges row */}
            <div className="flex items-center flex-wrap gap-2">
              {isSecurableTypeKnown ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-[var(--weight-semibold)] font-[var(--font-mono)] bg-[var(--color-accent-light)] text-[var(--color-accent)] border border-[var(--color-accent)]/20">
                  {asset.securable_type}
                </span>
              ) : (
                <UnknownBadge value={asset.securable_type} />
              )}

              {isKindKnown ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-[var(--weight-medium)] bg-[var(--color-neutral-2)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)]">
                  <Database className="w-3 h-3 text-[var(--color-icon-muted)]" aria-hidden="true" />
                  <span>{asset.kind}</span>
                </span>
              ) : (
                <UnknownBadge value={asset.kind} />
              )}

              {asset.managed !== "not_applicable" ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-[var(--weight-medium)] bg-[var(--color-neutral-1)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)]">
                  {asset.managed}
                </span>
              ) : null}

              {asset.pipeline_managed !== null && asset.pipeline_managed !== undefined ? (
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-[var(--weight-medium)] ${
                    asset.pipeline_managed
                      ? "bg-[var(--color-info-bg)] text-[var(--color-info)] border border-[var(--color-info)]/30"
                      : "bg-[var(--color-neutral-1)] text-[var(--color-text-muted)] border border-[var(--color-border-subtle)]"
                  }`}
                >
                  {asset.pipeline_managed
                    ? strings.assets.fields.pipelineManagedTrue
                    : strings.assets.fields.pipelineManagedFalse}
                </span>
              ) : null}
            </div>

            {/* Title / display name */}
            <h2 className="text-[var(--text-xl)] font-[var(--weight-semibold)] text-[var(--color-text-primary)] leading-[var(--leading-snug)]">
              {asset.display_name}
            </h2>

            {/* FQN with middle-truncation and copy button */}
            <div className="flex items-center gap-2 pt-1 text-[var(--text-sm)]">
              <span className="text-[var(--color-text-muted)] text-[var(--text-xs)] uppercase tracking-wider font-[var(--weight-medium)]">
                FQN:
              </span>
              <span
                title={fqnTrunc.full}
                aria-label={fqnTrunc.full}
                className="font-[var(--font-mono)] text-[var(--color-text-secondary)] bg-[var(--color-neutral-1)] px-2 py-0.5 rounded border border-[var(--color-border-subtle)]"
              >
                {fqnTrunc.display}
              </span>
              <button
                type="button"
                onClick={handleCopyFqn}
                aria-label={strings.assets.copyFqn}
                title={copiedFqn ? strings.assets.copiedFqn : strings.assets.copyFqn}
                className="inline-flex items-center gap-1 text-[var(--text-xs)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)] rounded px-1.5 py-0.5 border border-[var(--color-border-subtle)]"
              >
                {copiedFqn ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[var(--color-success)]" aria-hidden="true" />
                    <span className="text-[var(--color-success)] font-[var(--weight-medium)]">
                      {strings.common.copied}
                    </span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[var(--color-icon-muted)]" aria-hidden="true" />
                    <span>{strings.common.copyToClipboard}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Refresh action */}
          {onRefresh ? (
            <div className="shrink-0 flex items-center gap-2">
              <button
                type="button"
                onClick={onRefresh}
                aria-label={strings.assets.refreshAriaLabel}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-control)] text-[var(--text-sm)] font-[var(--weight-medium)] border border-[var(--color-border-strong)] bg-[var(--color-neutral-0)] hover:bg-[var(--color-neutral-1)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)]"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[var(--color-icon-muted)]" aria-hidden="true" />
                <span>{strings.assets.refresh}</span>
              </button>
            </div>
          ) : null}
        </div>

        {/* Description / Comment */}
        <div className="mt-[var(--space-4)] pt-[var(--space-3)] border-t border-[var(--color-border-subtle)]">
          <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)] max-w-[80ch]">
            {asset.comment || (
              <span className="italic text-[var(--color-text-muted)]">
                {strings.assets.fields.noComment}
              </span>
            )}
          </p>
        </div>

        {/* Key metadata grid */}
        <div className="mt-[var(--space-4)] grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-[var(--space-3)] pt-[var(--space-3)] border-t border-[var(--color-border-subtle)] text-[var(--text-xs)]">
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[var(--color-text-muted)] uppercase tracking-wider font-[var(--weight-medium)] flex items-center gap-1">
                <User className="w-3 h-3 text-[var(--color-icon-muted)]" aria-hidden="true" />
                {strings.assets.fields.owner}
              </span>
              <button
                type="button"
                onClick={() => setIsTransferOwnershipOpen(true)}
                className="text-[11px] font-[var(--weight-medium)] text-[var(--color-accent)] hover:underline focus:outline-none"
              >
                {strings.ownership.transferAction}
              </button>
            </div>
            <span className="font-[var(--font-mono)] text-[var(--color-text-primary)] font-[var(--weight-medium)] block">
              {asset.owner || strings.assets.fields.unassignedOwner}
            </span>
          </div>

          {asset.table_type ? (
            <div className="space-y-1">
              <span className="text-[var(--color-text-muted)] uppercase tracking-wider font-[var(--weight-medium)]">
                {strings.assets.fields.tableType}
              </span>
              <span className="font-[var(--font-mono)] text-[var(--color-text-primary)] block">
                {asset.table_type}
              </span>
            </div>
          ) : null}

          {asset.data_source_format ? (
            <div className="space-y-1">
              <span className="text-[var(--color-text-muted)] uppercase tracking-wider font-[var(--weight-medium)]">
                {strings.assets.fields.dataSourceFormat}
              </span>
              <span className="font-[var(--font-mono)] text-[var(--color-text-primary)] block">
                {asset.data_source_format}
              </span>
            </div>
          ) : null}

          {asset.created_at ? (
            <div className="space-y-1">
              <span className="text-[var(--color-text-muted)] uppercase tracking-wider font-[var(--weight-medium)]">
                {strings.assets.fields.createdAt}
              </span>
              <span className="font-[var(--font-mono)] text-[var(--color-text-secondary)] block">
                {asset.created_at}
              </span>
            </div>
          ) : null}

          {asset.updated_at ? (
            <div className="space-y-1">
              <span className="text-[var(--color-text-muted)] uppercase tracking-wider font-[var(--weight-medium)]">
                {strings.assets.fields.updatedAt}
              </span>
              <span className="font-[var(--font-mono)] text-[var(--color-text-secondary)] block">
                {asset.updated_at}
              </span>
            </div>
          ) : null}

          {asset.created_by ? (
            <div className="space-y-1">
              <span className="text-[var(--color-text-muted)] uppercase tracking-wider font-[var(--weight-medium)]">
                {strings.assets.fields.createdBy}
              </span>
              <span className="font-[var(--font-mono)] text-[var(--color-text-secondary)] block">
                {asset.created_by}
              </span>
            </div>
          ) : null}
        </div>

        {/* Storage location */}
        {asset.storage_location && locationTrunc ? (
          <div className="mt-[var(--space-3)] pt-[var(--space-3)] border-t border-[var(--color-border-subtle)] text-[var(--text-xs)] flex items-center gap-2">
            <span className="text-[var(--color-text-muted)] uppercase tracking-wider font-[var(--weight-medium)] shrink-0">
              {strings.assets.fields.storageLocation}:
            </span>
            <span
              title={locationTrunc.full}
              aria-label={locationTrunc.full}
              className="font-[var(--font-mono)] text-[var(--color-text-secondary)] bg-[var(--color-neutral-1)] px-2 py-0.5 rounded border border-[var(--color-border-subtle)]"
            >
              {locationTrunc.display}
            </span>
            <button
              type="button"
              onClick={handleCopyLocation}
              aria-label={strings.assets.copyLocation}
              className="p-1 text-[var(--color-icon-muted)] hover:text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--focus-ring-color)] rounded"
            >
              {copiedLocation ? (
                <Check className="w-3.5 h-3.5 text-[var(--color-success)]" aria-hidden="true" />
              ) : (
                <Copy className="w-3.5 h-3.5" aria-hidden="true" />
              )}
            </button>
          </div>
        ) : null}

        {/* Allowed actions bar */}
        {asset.allowed_actions && asset.allowed_actions.length > 0 ? (
          <div className="mt-[var(--space-4)] pt-[var(--space-3)] border-t border-[var(--color-border-subtle)]">
            <span className="text-[var(--text-xs)] font-[var(--weight-semibold)] text-[var(--color-text-muted)] uppercase tracking-wider block mb-2">
              {strings.assets.actionsHeading}
            </span>
            <div className="flex flex-wrap items-start gap-2">
              {asset.allowed_actions.map((act) => (
                <AssetActionControl
                  key={act.action}
                  action={act}
                  onExecute={(actionName) => {
                    if (actionName === "transfer_ownership") {
                      setIsTransferOwnershipOpen(true);
                    }
                  }}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Tabs strip */}
      <div
        role="tablist"
        aria-label={strings.access.tabsAriaLabel}
        className="flex items-center gap-1 border-b border-[var(--color-border-subtle)]"
      >
        <button
          role="tab"
          type="button"
          aria-selected={currentTab === "overview"}
          onClick={() => handleTabChange("overview")}
          className={`px-4 py-2 text-[var(--text-sm)] font-[var(--weight-medium)] border-b-2 -mb-px transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)] ${
            currentTab === "overview"
              ? "border-[var(--color-accent)] text-[var(--color-accent)] font-[var(--weight-semibold)]"
              : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          }`}
        >
          {strings.assets.tabs.overview}
        </button>
        <button
          role="tab"
          type="button"
          aria-selected={currentTab === "access"}
          onClick={() => handleTabChange("access")}
          className={`px-4 py-2 text-[var(--text-sm)] font-[var(--weight-medium)] border-b-2 -mb-px transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)] ${
            currentTab === "access"
              ? "border-[var(--color-accent)] text-[var(--color-accent)] font-[var(--weight-semibold)]"
              : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          }`}
        >
          {strings.assets.tabs.access}
        </button>
        <button
          role="tab"
          type="button"
          aria-selected={currentTab === "tags"}
          onClick={() => handleTabChange("tags")}
          className={`px-4 py-2 text-[var(--text-sm)] font-[var(--weight-medium)] border-b-2 -mb-px transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)] ${
            currentTab === "tags"
              ? "border-[var(--color-accent)] text-[var(--color-accent)] font-[var(--weight-semibold)]"
              : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          }`}
        >
          {strings.assets.tabs.tags}
        </button>
        {asset.securable_type === "TABLE" && (
          <button
            role="tab"
            type="button"
            aria-selected={currentTab === "filters"}
            onClick={() => handleTabChange("filters")}
            className={`px-4 py-2 text-[var(--text-sm)] font-[var(--weight-medium)] border-b-2 -mb-px transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)] ${
              currentTab === "filters"
                ? "border-[var(--color-accent)] text-[var(--color-accent)] font-[var(--weight-semibold)]"
                : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            {strings.assets.tabs.filters}
          </button>
        )}
      </div>

      {currentTab === "access" ? (
        <AssetGrantsView
          securableType={asset.securable_type}
          fullName={asset.full_name}
          onRefresh={onRefresh}
        />
      ) : currentTab === "tags" ? (
        <AssetTagsView
          securableType={asset.securable_type}
          fullName={asset.full_name}
          onRefresh={onRefresh}
        />
      ) : currentTab === "filters" ? (
        <AssetRowAccessView
          fullName={asset.full_name}
          onRefresh={onRefresh}
        />
      ) : (
        <>
          {/* Tags section */}
          <div className="p-[var(--space-5)] bg-[var(--color-neutral-0)] border border-[var(--color-border-subtle)] rounded-[var(--radius-panel)] shadow-[var(--shadow-panel)] space-y-3">
            <div className="flex items-center gap-2">
              <TagIcon className="w-4 h-4 text-[var(--color-icon-muted)]" aria-hidden="true" />
              <h3 className="text-[var(--text-md)] font-[var(--weight-semibold)] text-[var(--color-text-primary)]">
                {strings.assets.tags.title}
              </h3>
              <span className="text-[var(--text-xs)] text-[var(--color-text-muted)]">
                ({asset.tags.length})
              </span>
            </div>

            {asset.tags.length === 0 ? (
              <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)] italic">
                {strings.assets.tags.empty}
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {asset.tags.map((tag) => (
                  <div
                    key={tag.key}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-control)] border text-[var(--text-xs)] font-[var(--font-mono)] bg-[var(--color-neutral-1)] border-[var(--color-border-subtle)]"
                  >
                    <span className="font-[var(--weight-semibold)] text-[var(--color-text-primary)]">
                      {tag.key}
                    </span>
                    {tag.value ? (
                      <span className="text-[var(--color-text-secondary)]">={tag.value}</span>
                    ) : null}
                    <span
                      className={`text-[10px] px-1 py-[1px] rounded font-sans uppercase font-[var(--weight-medium)] ${
                        tag.kind === "governed"
                          ? "bg-[var(--color-accent-light)] text-[var(--color-accent)] font-semibold"
                          : tag.kind === "system"
                            ? "bg-[var(--color-neutral-3)] text-[var(--color-text-muted)]"
                            : "bg-[var(--color-neutral-2)] text-[var(--color-text-secondary)]"
                      }`}
                    >
                      {tag.kind}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Columns table */}
          <div className="p-[var(--space-5)] bg-[var(--color-neutral-0)] border border-[var(--color-border-subtle)] rounded-[var(--radius-panel)] shadow-[var(--shadow-panel)] space-y-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[var(--color-icon-muted)]" aria-hidden="true" />
              <h3 className="text-[var(--text-md)] font-[var(--weight-semibold)] text-[var(--color-text-primary)]">
                {strings.assets.columnsTable.title}
              </h3>
              <span className="text-[var(--text-xs)] text-[var(--color-text-muted)]">
                ({asset.columns.length})
              </span>
            </div>
            <AssetColumnsTable columns={asset.columns} />
          </div>

          {/* Dependencies Section */}
          <div className="p-[var(--space-5)] bg-[var(--color-neutral-0)] border border-[var(--color-border-subtle)] rounded-[var(--radius-panel)] shadow-[var(--shadow-panel)]">
            {dependenciesQuery.isLoading ? (
              <div className="space-y-3">
                <LocalizedSkeleton className="h-6 w-48" />
                <LocalizedSkeleton className="h-24 w-full" />
              </div>
            ) : dependenciesQuery.isError ? (
              <ErrorView
                error={dependenciesQuery.error}
                onRetry={() => dependenciesQuery.refetch()}
              />
            ) : dependenciesQuery.data?.data ? (
              <AssetDependenciesView dependencies={dependenciesQuery.data.data} />
            ) : null}
          </div>

          {/* View Definition if present */}
          {asset.view_definition ? (
            <div className="p-[var(--space-5)] bg-[var(--color-neutral-0)] border border-[var(--color-border-subtle)] rounded-[var(--radius-panel)] shadow-[var(--shadow-panel)] space-y-2">
              <h3 className="text-[var(--text-md)] font-[var(--weight-semibold)] text-[var(--color-text-primary)] flex items-center gap-2">
                <FileCode2 className="w-4 h-4 text-[var(--color-icon-muted)]" aria-hidden="true" />
                {strings.assets.fields.viewDefinition}
              </h3>
              <pre className="p-3 bg-[var(--color-neutral-1)] border border-[var(--color-border-subtle)] rounded font-[var(--font-mono)] text-[var(--text-xs)] text-[var(--color-text-primary)] overflow-x-auto">
                <code>{asset.view_definition}</code>
              </pre>
            </div>
          ) : null}

          {/* Raw JSON technical details */}
          {asset.raw && Object.keys(asset.raw).length > 0 ? (
            <details className="p-[var(--space-4)] bg-[var(--color-neutral-1)] border border-[var(--color-border-subtle)] rounded-[var(--radius-panel)] text-[var(--text-xs)] text-[var(--color-text-secondary)]">
              <summary className="cursor-pointer font-[var(--weight-medium)] text-[var(--color-text-primary)] flex items-center gap-1.5 hover:underline focus:outline-none">
                <Code2 className="w-3.5 h-3.5 text-[var(--color-icon-muted)]" aria-hidden="true" />
                <span>{strings.assets.states.detailsHeading}</span>
              </summary>
              <pre className="mt-3 p-3 bg-[var(--color-neutral-0)] border border-[var(--color-border-subtle)] rounded font-[var(--font-mono)] text-[11px] text-[var(--color-text-primary)] overflow-x-auto max-h-80">
                <code>{JSON.stringify(asset.raw, null, 2)}</code>
              </pre>
            </details>
          ) : null}

          {/* Meta limitations and completeness notice */}
          <LimitationsView meta={meta} />
        </>
      )}

      {/* Ownership transfer PlanFlow modal */}
      {isTransferOwnershipOpen && (
        <PlanFlow
          kind="transfer_ownership"
          targets={[
            {
              securable_type: asset.securable_type,
              full_name: asset.full_name,
            },
          ]}
          initialChanges={{
            new_owner: "",
          }}
          isOpen={true}
          onClose={() => setIsTransferOwnershipOpen(false)}
          onSuccess={() => {
            setIsTransferOwnershipOpen(false);
            if (onRefresh) onRefresh();
          }}
        />
      )}
    </div>
  );
}
