import { useState } from "react";
import { useSearchParams } from "react-router";
import type {
  AbacPolicy,
  PlanChanges,
  PlanKind,
  SecurableType,
} from "@contracts/types";
import {
  AlertTriangle,
  Edit2,
  Plus,
  Shield,
  Trash2,
} from "lucide-react";
import {
  useAbacPolicies,
  useAbacPolicy,
  useAbacPolicyImpact,
} from "@/api/queries";
import { PlanFlow } from "@/features/plans/PlanFlow";
import { ErrorView, LimitationsView, LocalizedSkeleton } from "@/features/assets/StateViews";
import { PageHeader } from "@/app/PageHeader";
import { strings } from "@/lib/strings";

export function PoliciesView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedPolicyId = searchParams.get("selected");

  const [activePlan, setActivePlan] = useState<{
    kind: PlanKind;
    targets: { securable_type: SecurableType; full_name: string }[];
    initialChanges: PlanChanges;
  } | null>(null);

  const policiesQuery = useAbacPolicies();

  const handleSelectPolicy = (id: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("selected", id);
    setSearchParams(next);
  };

  const handleOpenCreate = () => {
    setActivePlan({
      kind: "create_abac_policy",
      targets: [],
      initialChanges: {},
    });
  };

  const handleOpenEdit = (policy: AbacPolicy) => {
    setActivePlan({
      kind: "update_abac_policy",
      targets: [
        {
          securable_type: policy.scope.securable_type,
          full_name: policy.scope.full_name,
        },
      ],
      initialChanges: {
        policy_id: policy.id,
        name: policy.name,
        policy_type: policy.policy_type,
        when_condition: policy.when_condition,
        to_principals: policy.to_principals,
        except_principals: policy.except_principals,
        function_full_name: policy.function_full_name,
        match_columns: policy.match_columns,
      },
    });
  };

  const handleOpenDelete = (policy: AbacPolicy) => {
    setActivePlan({
      kind: "delete_abac_policy",
      targets: [
        {
          securable_type: policy.scope.securable_type,
          full_name: policy.scope.full_name,
        },
      ],
      initialChanges: {
        policy_id: policy.id,
        name: policy.name,
      },
    });
  };

  const handlePlanSuccess = () => {
    setActivePlan(null);
    policiesQuery.refetch();
  };

  if (policiesQuery.isLoading) {
    return (
      <div className="space-y-4 p-6" data-testid="policies-loading">
        <LocalizedSkeleton className="h-8 w-64" />
        <LocalizedSkeleton className="h-32 w-full" />
        <LocalizedSkeleton className="h-64 w-full" />
      </div>
    );
  }

  if (policiesQuery.isError) {
    return (
      <div className="p-6">
        <ErrorView
          error={policiesQuery.error}
          onRetry={() => policiesQuery.refetch()}
        />
      </div>
    );
  }

  const policiesList = policiesQuery.data?.data || [];
  const activePolicyId = selectedPolicyId || policiesList[0]?.id || null;

  return (
    <div className="space-y-6 text-[var(--color-text-primary)]">
      {/* Header */}
      <PageHeader
        title={strings.policies.pageHeading}
        description={strings.policies.description}
      >
        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[var(--text-xs)] font-[var(--weight-medium)] bg-[var(--color-accent)] text-white rounded-[var(--radius-control)] hover:bg-[var(--color-accent-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)]"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{strings.policies.createPolicyButton}</span>
        </button>
      </PageHeader>

      {/* Main split: Policies list on left, details & impact on right */}
      <div className="px-[var(--space-6)] py-[var(--space-2)] grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Policies Table (5 cols on lg) */}
        <div className="lg:col-span-5 space-y-3">
          <h2 className="text-[var(--text-xs)] font-[var(--weight-semibold)] text-[var(--color-text-muted)] uppercase tracking-wider">
            {strings.policies.tableHeading} ({policiesList.length})
          </h2>

          {policiesList.length === 0 ? (
            <div className="p-4 rounded-[var(--radius-control)] bg-[var(--color-neutral-1)] border border-[var(--color-border-subtle)] text-[var(--text-sm)] text-[var(--color-text-muted)] italic">
              {strings.policies.emptyPolicies}
            </div>
          ) : (
            <div className="border border-[var(--color-border-subtle)] rounded-[var(--radius-control)] bg-[var(--color-neutral-0)] divide-y divide-[var(--color-border-subtle)] overflow-hidden">
              {policiesList.map((policy) => {
                const isSelected = policy.id === activePolicyId;
                return (
                  <div
                    key={policy.id}
                    className={`flex items-start justify-between transition-colors text-[var(--text-xs)] ${
                      isSelected
                        ? "bg-[var(--color-accent-light)]/40 border-l-4 border-l-[var(--color-accent)]"
                        : "hover:bg-[var(--color-neutral-1)]"
                    }`}
                  >
                    <button
                      type="button"
                      aria-current={isSelected ? "true" : undefined}
                      onClick={() => handleSelectPolicy(policy.id)}
                      className="flex-1 p-3 text-left focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)] focus:z-10"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-[var(--weight-semibold)] text-[var(--text-sm)] text-[var(--color-text-primary)]">
                            {policy.name}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-[var(--weight-medium)] uppercase ${
                              policy.policy_type === "row_filter"
                                ? "bg-[var(--color-info-bg)] text-[var(--color-info)] border border-[var(--color-info)]/30"
                                : "bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-[var(--color-warning)]/30"
                            }`}
                          >
                            {policy.policy_type === "row_filter" ? "Row Filter" : "Column Mask"}
                          </span>
                        </div>
                        <div className="text-[11px] text-[var(--color-text-secondary)]">
                          <span>{strings.policies.scopeLabel}: </span>
                          <span className="font-[var(--font-mono)]">{policy.scope.full_name}</span>
                        </div>
                      </div>

                      {/* Condition preview */}
                      <div className="mt-2 text-[11px] font-[var(--font-mono)] bg-[var(--color-neutral-1)] px-2 py-1 rounded text-[var(--color-text-secondary)] truncate">
                        {policy.when_condition}
                      </div>
                    </button>

                    {/* Quick actions (sibling to selection button) */}
                    <div className="flex items-center gap-1 p-3 pl-0 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(policy)}
                        title={strings.policies.editPolicyButton}
                        aria-label={`${strings.policies.editPolicyButton} ${policy.name}`}
                        className="p-1 text-[var(--color-icon-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-neutral-2)] rounded focus:outline-none focus:ring-1 focus:ring-[var(--focus-ring-color)]"
                      >
                        <Edit2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenDelete(policy)}
                        title={strings.policies.deletePolicyButton}
                        aria-label={`${strings.policies.deletePolicyButton} ${policy.name}`}
                        className="p-1 text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] rounded focus:outline-none focus:ring-1 focus:ring-[var(--focus-ring-color)]"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Limitations for policy list */}
          {policiesQuery.data?.meta && (
            <LimitationsView meta={policiesQuery.data.meta} />
          )}
        </div>

        {/* Right Column: Selected Policy Details & Impact Panel (7 cols on lg) */}
        <div className="lg:col-span-7 space-y-6">
          {activePolicyId ? (
            <PolicyDetailPanel
              policyId={activePolicyId}
              onEdit={handleOpenEdit}
              onDelete={handleOpenDelete}
            />
          ) : (
            <div className="p-8 rounded-[var(--radius-control)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-neutral-0)] text-center text-[var(--color-text-muted)] text-[var(--text-sm)]">
              {strings.policies.selectPrompt}
            </div>
          )}
        </div>
      </div>

      {/* PlanFlow Modal */}
      {activePlan && (
        <PlanFlow
          kind={activePlan.kind}
          targets={activePlan.targets}
          initialChanges={activePlan.initialChanges}
          isOpen={true}
          onClose={() => setActivePlan(null)}
          onSuccess={handlePlanSuccess}
        />
      )}
    </div>
  );
}

interface PolicyDetailPanelProps {
  policyId: string;
  onEdit: (policy: AbacPolicy) => void;
  onDelete: (policy: AbacPolicy) => void;
}

function PolicyDetailPanel({ policyId, onEdit, onDelete }: PolicyDetailPanelProps) {
  const policyQuery = useAbacPolicy(policyId);
  const impactQuery = useAbacPolicyImpact(policyId);

  if (policyQuery.isLoading) {
    return (
      <div className="space-y-4 p-4 border border-[var(--color-border-subtle)] rounded-[var(--radius-control)] bg-[var(--color-neutral-0)]">
        <LocalizedSkeleton className="h-6 w-48" />
        <LocalizedSkeleton className="h-20 w-full" />
        <LocalizedSkeleton className="h-32 w-full" />
      </div>
    );
  }

  if (policyQuery.isError) {
    return (
      <ErrorView
        error={policyQuery.error}
        onRetry={() => policyQuery.refetch()}
      />
    );
  }

  const policy = policyQuery.data?.data;
  if (!policy) {
    return (
      <div className="p-4 rounded-[var(--radius-control)] bg-[var(--color-neutral-1)] text-[var(--text-sm)] text-[var(--color-text-muted)]">
        {strings.policies.selectPrompt}
      </div>
    );
  }

  const impactData = impactQuery.data?.data;
  const affectedList = impactData?.potentially_affected || [];

  return (
    <div className="space-y-6">
      {/* Policy Details Card */}
      <div className="p-5 border border-[var(--color-border-subtle)] rounded-[var(--radius-control)] bg-[var(--color-neutral-0)] shadow-sm space-y-4 text-[var(--text-xs)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border-subtle)] pb-3">
          <div>
            <h3 className="text-[var(--text-md)] font-[var(--weight-semibold)] text-[var(--color-text-primary)]">
              {policy.name}
            </h3>
            <span className="text-[11px] font-[var(--font-mono)] text-[var(--color-text-muted)]">
              ID: {policy.id}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onEdit(policy)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-[var(--weight-medium)] border border-[var(--color-border-strong)] rounded-[var(--radius-control)] hover:bg-[var(--color-neutral-1)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)]"
            >
              <Edit2 className="w-3 h-3 text-[var(--color-icon-muted)]" aria-hidden="true" />
              <span>{strings.policies.editPolicyButton}</span>
            </button>
            <button
              type="button"
              onClick={() => onDelete(policy)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-[var(--weight-medium)] border border-[var(--color-danger)]/30 text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] rounded-[var(--radius-control)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)]"
            >
              <Trash2 className="w-3 h-3" aria-hidden="true" />
              <span>{strings.policies.deletePolicyButton}</span>
            </button>
          </div>
        </div>

        {/* Configuration grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <span className="text-[var(--color-text-muted)] block mb-0.5">{strings.policies.typeLabel}:</span>
            <span className="font-[var(--weight-medium)] text-[var(--color-text-primary)] uppercase">
              {policy.policy_type === "row_filter" ? "Row Filter" : "Column Mask"}
            </span>
          </div>
          <div>
            <span className="text-[var(--color-text-muted)] block mb-0.5">{strings.policies.scopeLabel}:</span>
            <span className="font-[var(--font-mono)] font-[var(--weight-medium)] text-[var(--color-text-primary)]">
              {policy.scope.full_name} ({policy.scope.securable_type})
            </span>
          </div>
          <div>
            <span className="text-[var(--color-text-muted)] block mb-0.5">{strings.policies.referencedFunctionLabel}:</span>
            <span className="font-[var(--font-mono)] text-[var(--color-text-primary)]">
              {policy.function_full_name}
            </span>
          </div>
          <div>
            <span className="text-[var(--color-text-muted)] block mb-0.5">{strings.policies.ownerLabel}:</span>
            <span className="font-[var(--font-mono)] text-[var(--color-text-secondary)]">
              {policy.owner || strings.assets.fields.unassignedOwner}
            </span>
          </div>
          {policy.match_columns && policy.match_columns.length > 0 && (
            <div className="sm:col-span-2">
              <span className="text-[var(--color-text-muted)] block mb-0.5">{strings.policies.matchColumnsLabel}:</span>
              <div className="flex flex-wrap gap-1">
                {policy.match_columns.map((c) => (
                  <span
                    key={c}
                    className="font-[var(--font-mono)] bg-[var(--color-neutral-1)] px-1.5 py-0.5 rounded border border-[var(--color-border-subtle)] text-[var(--color-text-primary)]"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Condition Predicate */}
        <div>
          <span className="text-[var(--color-text-muted)] block mb-1">
            {strings.policies.whenConditionLabel}:
          </span>
          <pre className="p-2.5 bg-[var(--color-neutral-1)] border border-[var(--color-border-subtle)] rounded font-[var(--font-mono)] text-[11px] text-[var(--color-text-primary)] overflow-x-auto">
            <code>{policy.when_condition}</code>
          </pre>
        </div>

        {/* Principals Split */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[var(--color-border-subtle)]">
          <div className="space-y-1">
            <span className="text-[var(--color-text-muted)] block">{strings.policies.toPrincipalsLabel}:</span>
            {policy.to_principals && policy.to_principals.length > 0 ? (
              <ul className="list-disc list-inside font-[var(--font-mono)] text-[11px] text-[var(--color-text-primary)] space-y-0.5">
                {policy.to_principals.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            ) : (
              <span className="text-[var(--color-text-muted)] italic">{strings.policies.allPrincipals}</span>
            )}
          </div>
          <div className="space-y-1">
            <span className="text-[var(--color-text-muted)] block">{strings.policies.exceptPrincipalsLabel}:</span>
            {policy.except_principals && policy.except_principals.length > 0 ? (
              <ul className="list-disc list-inside font-[var(--font-mono)] text-[11px] text-[var(--color-text-primary)] space-y-0.5">
                {policy.except_principals.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            ) : (
              <span className="text-[var(--color-text-muted)] italic">{strings.policies.noneSpecified}</span>
            )}
          </div>
        </div>

        {/* Limitations underneath policy details */}
        {policyQuery.data?.meta && (
          <LimitationsView meta={policyQuery.data.meta} />
        )}
      </div>

      {/* Impact Panel: SPEC MANDATED REQUIREMENTS:
          1. Render disclaimer adjacent to list itself (not footnote, not tooltip, not collapsed).
          2. MUST NOT be titled "Effective access" or "Who has access".
      */}
      <section
        className="p-5 border border-[var(--color-border-subtle)] rounded-[var(--radius-control)] bg-[var(--color-neutral-0)] shadow-sm space-y-4 text-[var(--text-xs)]"
        aria-labelledby="policy-impact-heading"
      >
        <div className="space-y-1">
          <h4
            id="policy-impact-heading"
            className="text-[var(--text-sm)] font-[var(--weight-semibold)] text-[var(--color-text-primary)] flex items-center gap-2"
          >
            <Shield className="w-4 h-4 text-[var(--color-accent)]" aria-hidden="true" />
            <span>{strings.policies.impactHeading}</span>
          </h4>
        </div>

        {/* Mandatory adjacent disclaimer: rendered directly above the list */}
        <div
          role="note"
          data-testid="impact-disclaimer"
          className="p-3 bg-[var(--color-warning-bg)] border border-[var(--color-warning)]/30 rounded-[var(--radius-control)] flex items-start gap-2.5 text-[var(--text-xs)] text-[var(--color-text-primary)]"
        >
          <AlertTriangle className="w-4 h-4 text-[var(--color-warning)] shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-0.5">
            <span className="font-[var(--weight-semibold)] text-[var(--color-text-primary)] block">
              {strings.policies.impactDisclaimer}
            </span>
          </div>
        </div>

        {/* Loading impact state */}
        {impactQuery.isLoading && (
          <div className="space-y-2 py-2" data-testid="impact-loading">
            <LocalizedSkeleton className="h-4 w-40" />
            <LocalizedSkeleton className="h-16 w-full" />
          </div>
        )}

        {/* Error impact state */}
        {impactQuery.isError && (
          <ErrorView
            error={impactQuery.error}
            onRetry={() => impactQuery.refetch()}
          />
        )}

        {/* Impact List */}
        {!impactQuery.isLoading && !impactQuery.isError && (
          <div>
            {affectedList.length === 0 ? (
              <div className="p-4 rounded-[var(--radius-control)] bg-[var(--color-neutral-1)] text-[var(--color-text-muted)] italic">
                {strings.policies.emptyImpact}
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-border-subtle)] border border-[var(--color-border-subtle)] rounded-[var(--radius-control)] bg-[var(--color-neutral-0)] overflow-hidden">
                {affectedList.map((asset) => (
                  <div
                    key={asset.full_name}
                    className="p-3 flex flex-wrap items-center justify-between gap-3 text-[var(--text-xs)]"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-[var(--font-mono)] font-[var(--weight-semibold)] text-[var(--color-text-primary)]">
                          {asset.full_name}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-[var(--weight-medium)] bg-[var(--color-neutral-2)] text-[var(--color-text-secondary)] uppercase">
                          {asset.kind}
                        </span>
                      </div>
                      {asset.comment && (
                        <p className="text-[11px] text-[var(--color-text-muted)]">{asset.comment}</p>
                      )}
                    </div>
                    <div className="text-[11px] text-[var(--color-text-secondary)]">
                      <span className="text-[var(--color-text-muted)]">{strings.policies.affectedOwner}: </span>
                      <span className="font-[var(--font-mono)]">{asset.owner || "—"}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Limitations View Underneath Impact Data */}
        {impactQuery.data?.meta && (
          <LimitationsView meta={impactQuery.data.meta} />
        )}
      </section>
    </div>
  );
}
