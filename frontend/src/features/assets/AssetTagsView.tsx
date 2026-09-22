import { useId, useMemo, useState } from "react";
import type { PlanChanges, PlanKind, SecurableType, Tag } from "@contracts/types";
import { Lock, Plus, ShieldCheck, Tag as TagIcon, Trash2 } from "lucide-react";
import { useAssetTags, useTagPolicies } from "@/api/queries";
import { PlanFlow } from "@/features/plans/PlanFlow";
import { strings } from "@/lib/strings";
import { ErrorView, IdleView, LimitationsView, LocalizedSkeleton } from "./StateViews";

export interface AssetTagsViewProps {
  securableType: string;
  fullName: string;
  onRefresh?: (() => void) | undefined;
}

export function AssetTagsView({
  securableType,
  fullName,
  onRefresh,
}: AssetTagsViewProps) {
  const [activePlan, setActivePlan] = useState<{
    kind: PlanKind;
    initialChanges: PlanChanges;
  } | null>(null);

  const tagsQuery = useAssetTags(securableType, fullName);
  const tagPoliciesQuery = useTagPolicies();

  const tagPoliciesList = tagPoliciesQuery.data ? tagPoliciesQuery.data.data : null;
  const tagPoliciesMap = useMemo(() => {
    const map = new Map<string, { description: string | null; allowed_values: string[] | null; source?: string }>();
    if (tagPoliciesList) {
      for (const policy of tagPoliciesList) {
        map.set(policy.key.toLowerCase(), {
          description: policy.description,
          allowed_values: policy.allowed_values,
          source: policy.description || "governed tag policy",
        });
      }
    }
    return map;
  }, [tagPoliciesList]);

  if (!fullName || !securableType) {
    return (
      <IdleView
        title={strings.tagsTab.title}
        description={strings.tagsTab.description}
      />
    );
  }

  if (tagsQuery.isLoading) {
    return (
      <div className="space-y-4 py-4" data-testid="tags-loading">
        <LocalizedSkeleton className="h-8 w-48" />
        <LocalizedSkeleton className="h-24 w-full" />
        <LocalizedSkeleton className="h-24 w-full" />
      </div>
    );
  }

  if (tagsQuery.isError) {
    return (
      <ErrorView
        error={tagsQuery.error}
        onRetry={() => tagsQuery.refetch()}
      />
    );
  }

  const tagsData = tagsQuery.data?.data;
  const objectTags = tagsData?.tags || [];
  const columnTagsMap = tagsData?.column_tags || {};
  const columnEntries = Object.entries(columnTagsMap);

  const handleOpenAssign = (column?: string) => {
    setActivePlan({
      kind: "assign_tags",
      initialChanges: column ? { column } : {},
    });
  };

  const handleOpenRemove = (tagKey: string, column?: string) => {
    setActivePlan({
      kind: "remove_tags",
      initialChanges: {
        column: column ?? null,
        tags: [{ key: tagKey, value: null }],
      },
    });
  };

  const handlePlanSuccess = () => {
    setActivePlan(null);
    tagsQuery.refetch();
    if (onRefresh) onRefresh();
  };

  return (
    <div className="space-y-6 text-[var(--color-text-primary)]">
      {/* Header with Assign Action */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--color-border-subtle)] pb-4">
        <div>
          <h2 className="text-[var(--text-md)] font-[var(--weight-semibold)] text-[var(--color-text-primary)]">
            {strings.tagsTab.title}
          </h2>
          <p className="text-[var(--text-xs)] text-[var(--color-text-secondary)] mt-0.5">
            {strings.tagsTab.description}
          </p>
        </div>
        <button
          type="button"
          onClick={() => handleOpenAssign()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[var(--text-xs)] font-[var(--weight-medium)] bg-[var(--color-accent)] text-white rounded-[var(--radius-control)] hover:bg-[var(--color-accent-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)]"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{strings.tagsTab.assignTagButton}</span>
        </button>
      </div>

      {/* Object Tags Section */}
      <section className="space-y-3" aria-labelledby="object-tags-heading">
        <h3
          id="object-tags-heading"
          className="text-[var(--text-xs)] font-[var(--weight-semibold)] text-[var(--color-text-muted)] uppercase tracking-wider"
        >
          {strings.tagsTab.objectTagsHeading}
        </h3>

        {objectTags.length === 0 ? (
          <div className="p-4 rounded-[var(--radius-control)] bg-[var(--color-neutral-1)] border border-[var(--color-border-subtle)] text-[var(--text-sm)] text-[var(--color-text-muted)] italic">
            {strings.tagsTab.emptyObjectTags}
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border-subtle)] border border-[var(--color-border-subtle)] rounded-[var(--radius-control)] bg-[var(--color-neutral-0)]">
            {objectTags.map((tag) => (
              <TagRow
                key={tag.key}
                tag={tag}
                policy={tagPoliciesMap.get(tag.key.toLowerCase())}
                onRemove={() => handleOpenRemove(tag.key)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Column Tags Section */}
      <section className="space-y-3" aria-labelledby="column-tags-heading">
        <h3
          id="column-tags-heading"
          className="text-[var(--text-xs)] font-[var(--weight-semibold)] text-[var(--color-text-muted)] uppercase tracking-wider"
        >
          {strings.tagsTab.columnTagsHeading}
        </h3>

        {columnEntries.length === 0 ? (
          <div className="p-4 rounded-[var(--radius-control)] bg-[var(--color-neutral-1)] border border-[var(--color-border-subtle)] text-[var(--text-sm)] text-[var(--color-text-muted)] italic">
            {strings.tagsTab.emptyColumnTags}
          </div>
        ) : (
          <div className="space-y-4">
            {columnEntries.map(([columnName, colTags]) => (
              <div
                key={columnName}
                className="border border-[var(--color-border-subtle)] rounded-[var(--radius-control)] bg-[var(--color-neutral-0)] overflow-hidden"
              >
                <div className="flex items-center justify-between gap-2 p-2.5 bg-[var(--color-neutral-1)] border-b border-[var(--color-border-subtle)]">
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--text-xs)] font-[var(--weight-medium)] text-[var(--color-text-secondary)]">
                      {strings.tagsTab.columnTagsHeading}:
                    </span>
                    <span className="font-[var(--font-mono)] font-[var(--weight-semibold)] text-[var(--text-xs)] text-[var(--color-text-primary)]">
                      {columnName}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenAssign(columnName)}
                    className="inline-flex items-center gap-1 text-[11px] font-[var(--weight-medium)] text-[var(--color-accent)] hover:underline focus:outline-none focus:ring-1 focus:ring-[var(--focus-ring-color)] rounded px-1.5 py-0.5"
                  >
                    <Plus className="w-3 h-3" aria-hidden="true" />
                    <span>{strings.tagsTab.assignTagButton}</span>
                  </button>
                </div>
                <div className="divide-y divide-[var(--color-border-subtle)]">
                  {colTags.map((tag) => (
                    <TagRow
                      key={`${columnName}-${tag.key}`}
                      tag={tag}
                      column={columnName}
                      policy={tagPoliciesMap.get(tag.key.toLowerCase())}
                      onRemove={() => handleOpenRemove(tag.key, columnName)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Limitations View Underneath Data */}
      {tagsQuery.data?.meta && (
        <LimitationsView meta={tagsQuery.data.meta} />
      )}

      {/* PlanFlow Modal */}
      {activePlan && (
        <PlanFlow
          kind={activePlan.kind}
          targets={[
            {
              securable_type: securableType as SecurableType,
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

interface TagRowProps {
  tag: Tag;
  column?: string | undefined;
  policy?: { description: string | null; allowed_values: string[] | null; source?: string } | undefined;
  onRemove: () => void;
}

function TagRow({ tag, column, policy, onRemove }: TagRowProps) {
  const reasonId = useId();
  const isSystem = tag.kind === "system";
  const isGoverned = tag.kind === "governed";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3 text-[var(--text-xs)]">
      <div className="space-y-1 min-w-[200px]">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-[var(--font-mono)] font-[var(--weight-semibold)] text-[var(--color-text-primary)]">
            {tag.key}
          </span>
          {tag.value !== null && tag.value !== undefined ? (
            <>
              <span className="text-[var(--color-text-muted)]">=</span>
              <span className="font-[var(--font-mono)] bg-[var(--color-neutral-1)] px-1.5 py-0.5 rounded border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)]">
                {tag.value}
              </span>
            </>
          ) : (
            <span className="text-[var(--color-text-muted)] italic">(no value)</span>
          )}

          {/* Kind Badge */}
          {isSystem ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-[var(--weight-medium)] bg-[var(--color-neutral-2)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)]">
              <Lock className="w-2.5 h-2.5" aria-hidden="true" />
              <span>{strings.tagsTab.systemBadge}</span>
            </span>
          ) : isGoverned ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-[var(--weight-medium)] bg-[var(--color-info-bg)] text-[var(--color-info)] border border-[var(--color-info)]/30">
              <ShieldCheck className="w-2.5 h-2.5" aria-hidden="true" />
              <span>{strings.tagsTab.governedBadge}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-[var(--weight-medium)] bg-[var(--color-neutral-1)] text-[var(--color-text-muted)] border border-[var(--color-border-subtle)]">
              <TagIcon className="w-2.5 h-2.5" aria-hidden="true" />
              <span>{strings.tagsTab.freeFormBadge}</span>
            </span>
          )}
        </div>

        {/* Governed tag details */}
        {isGoverned && policy && (
          <div className="text-[11px] text-[var(--color-text-secondary)]">
            <span className="text-[var(--color-text-muted)]">{strings.tagsTab.constrainedByPrefix} </span>
            <span className="font-[var(--font-mono)] text-[var(--color-text-primary)]">
              {policy.source || "policy"}
            </span>
            {policy.allowed_values && policy.allowed_values.length > 0 && (
              <span className="ml-1 text-[var(--color-text-muted)]">
                ({strings.tagsTab.allowedValuesCount.replace("{count}", String(policy.allowed_values.length))}:{" "}
                {policy.allowed_values.join(", ")})
              </span>
            )}
          </div>
        )}

        {/* System tag notice in accessibility tree & visibly */}
        {isSystem && (
          <p
            id={reasonId}
            className="text-[11px] text-[var(--color-text-muted)] italic flex items-center gap-1"
          >
            <span>{strings.tagsTab.systemTagNotice}</span>
          </p>
        )}
      </div>

      {/* Remove Action */}
      <div>
        {isSystem ? (
          <button
            type="button"
            disabled={true}
            aria-describedby={reasonId}
            title={strings.tagsTab.systemTagNotice}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-[var(--weight-medium)] text-[var(--color-text-muted)] bg-[var(--color-neutral-1)] border border-[var(--color-border-subtle)] rounded-[var(--radius-control)] cursor-not-allowed opacity-60"
          >
            <Lock className="w-3 h-3" aria-hidden="true" />
            <span>{strings.tagsTab.removeTagButton}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`${strings.tagsTab.removeTagButton} ${tag.key}${column ? ` on ${column}` : ""}`}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-[var(--weight-medium)] text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] border border-[var(--color-danger)]/30 rounded-[var(--radius-control)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)]"
          >
            <Trash2 className="w-3 h-3" aria-hidden="true" />
            <span>{strings.tagsTab.removeTagButton}</span>
          </button>
        )}
      </div>
    </div>
  );
}
