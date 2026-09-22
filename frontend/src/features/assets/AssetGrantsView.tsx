import { useId, useMemo, useState } from "react";
import type {
  AllowedAction,
  Grant,
  GrantSource,
  PrincipalKind,
  SecurableType,
} from "@contracts/types";
import {
  ArrowUpDown,
  Bot,
  CornerDownRight,
  Filter,
  HelpCircle,
  ShieldCheck,
  User,
  Users,
  X,
} from "lucide-react";
import { useAssetGrants } from "@/api/queries";
import { middleTruncate } from "@/lib/fqn";
import { strings } from "@/lib/strings";
import { AssetActionControl } from "./AssetActionControl";
import {
  EmptySuccessView,
  ErrorView,
  IdleView,
  LimitationsView,
  LocalizedSkeleton,
} from "./StateViews";
import { UnknownBadge } from "./UnknownBadge";

export interface AssetGrantsViewProps {
  securableType?: SecurableType | string | null | undefined;
  fullName?: string | null | undefined;
  onRefresh?: (() => void) | undefined;
  className?: string | undefined;
}

type SortField = "principal" | "principal_kind" | "privilege" | "source";
type SortDirection = "asc" | "desc";

const KNOWN_PRIVILEGES = strings.access.privileges as Record<string, string | undefined>;

function PrincipalTypeBadge({ kind }: { kind: PrincipalKind | string | null }) {
  if (kind === "user") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[var(--text-xs)] font-[var(--weight-medium)] bg-[var(--color-neutral-2)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)]">
        <User className="w-3.5 h-3.5 text-[var(--color-icon-muted)] shrink-0" aria-hidden="true" />
        <span>{strings.access.principalKinds.user}</span>
      </span>
    );
  }
  if (kind === "group") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[var(--text-xs)] font-[var(--weight-medium)] bg-[var(--color-neutral-2)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)]">
        <Users className="w-3.5 h-3.5 text-[var(--color-icon-muted)] shrink-0" aria-hidden="true" />
        <span>{strings.access.principalKinds.group}</span>
      </span>
    );
  }
  if (kind === "service_principal") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[var(--text-xs)] font-[var(--weight-medium)] bg-[var(--color-neutral-2)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)]">
        <Bot className="w-3.5 h-3.5 text-[var(--color-icon-muted)] shrink-0" aria-hidden="true" />
        <span>{strings.access.principalKinds.servicePrincipal}</span>
      </span>
    );
  }
  return <UnknownBadge value={kind ?? strings.common.unknown} />;
}

function PrivilegeCell({ code }: { code: string }) {
  const label = KNOWN_PRIVILEGES[code];

  if (label) {
    return (
      <span className="inline-flex items-baseline gap-1.5 flex-wrap">
        <span className="font-[var(--weight-medium)] text-[var(--color-text-primary)]">
          {label}
        </span>
        <span className="text-[var(--color-text-muted)]" aria-hidden="true">
          —
        </span>
        <code className="font-[var(--font-mono)] text-[var(--text-xs)] bg-[var(--color-neutral-1)] text-[var(--color-text-secondary)] px-1.5 py-0.5 rounded border border-[var(--color-border-subtle)]">
          {code}
        </code>
      </span>
    );
  }

  // Unrecognised privilege code: render verbatim with UnknownBadge and never crash
  return <UnknownBadge value={code} />;
}

function GrantSourceBadge({ source }: { source: GrantSource }) {
  if (source.type === "direct") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-control)] text-[var(--text-xs)] font-[var(--weight-medium)] bg-[var(--color-neutral-1)] text-[var(--color-text-primary)] border border-solid border-[var(--color-border-strong)]">
        <ShieldCheck className="w-3.5 h-3.5 text-[var(--color-icon-muted)] shrink-0" aria-hidden="true" />
        <span>{strings.access.sources.direct}</span>
      </span>
    );
  }

  if (source.type === "inherited") {
    const kind = source.securable_type
      ? source.securable_type.toLowerCase()
      : "parent";
    const inheritedText = strings.access.sources.inheritedFrom.replace("{kind}", kind);
    const parentTrunc = source.full_name
      ? middleTruncate(source.full_name, 36, 16)
      : null;

    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-control)] text-[var(--text-xs)] font-[var(--weight-medium)] bg-[var(--color-neutral-1)] text-[var(--color-text-secondary)] border border-dashed border-[var(--color-border-strong)] flex-wrap">
        <CornerDownRight className="w-3.5 h-3.5 text-[var(--color-icon-muted)] shrink-0" aria-hidden="true" />
        <span>{inheritedText}</span>
        {parentTrunc ? (
          <span
            title={parentTrunc.full}
            aria-label={parentTrunc.full}
            className="font-[var(--font-mono)] text-[var(--color-text-primary)] bg-[var(--color-neutral-0)] px-1.5 py-0.5 rounded border border-[var(--color-border-subtle)]"
          >
            {parentTrunc.display}
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-control)] text-[var(--text-xs)] font-[var(--weight-medium)] bg-[var(--color-neutral-1)] text-[var(--color-text-muted)] border border-dotted border-[var(--color-border-strong)]">
      <HelpCircle className="w-3.5 h-3.5 text-[var(--color-icon-muted)] shrink-0" aria-hidden="true" />
      <span>{strings.access.sources.unknown}</span>
    </span>
  );
}

function GrantActionsCell({ actions }: { actions: AllowedAction[] }) {
  if (!actions || actions.length === 0) {
    return (
      <span className="text-[var(--text-xs)] text-[var(--color-text-muted)] italic">
        {strings.access.grantsTable.noActions}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.map((act, idx) => (
        <AssetActionControl key={`${act.action}-${idx}`} action={act} />
      ))}
    </div>
  );
}

function GrantsTableSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label={strings.states.loading}>
      <div className="flex flex-wrap items-center gap-3">
        <LocalizedSkeleton className="h-9 w-64" />
        <LocalizedSkeleton className="h-9 w-36" />
        <LocalizedSkeleton className="h-9 w-36" />
      </div>
      <div className="border border-[var(--color-border-subtle)] rounded-[var(--radius-panel)] p-4 space-y-3 bg-[var(--color-neutral-0)]">
        <LocalizedSkeleton className="h-8 w-full" />
        <LocalizedSkeleton className="h-12 w-full" />
        <LocalizedSkeleton className="h-12 w-full" />
        <LocalizedSkeleton className="h-12 w-full" />
        <LocalizedSkeleton className="h-12 w-full" />
      </div>
    </div>
  );
}

export function AssetGrantsView({
  securableType,
  fullName,
  onRefresh,
  className = "",
}: AssetGrantsViewProps) {
  const principalInputId = useId();
  const privilegeSelectId = useId();
  const sourceSelectId = useId();

  const [principalFilter, setPrincipalFilter] = useState("");
  const [privilegeFilter, setPrivilegeFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"" | "direct" | "inherited" | "unknown">("");
  const [sortField, setSortField] = useState<SortField>("principal");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const grantsQuery = useAssetGrants(securableType, fullName);
  const grantsData = grantsQuery.data?.data;

  const allGrants: Grant[] = useMemo(() => {
    if (!grantsData) return [];
    const direct = grantsData.direct ?? [];
    const inherited = grantsData.inherited ?? [];
    return [...direct, ...inherited];
  }, [grantsData]);

  const distinctPrivileges = useMemo(() => {
    const set = new Set<string>();
    for (const g of allGrants) {
      if (g.privilege) set.add(g.privilege);
    }
    return Array.from(set).sort();
  }, [allGrants]);

  const filteredGrants = useMemo(() => {
    return allGrants.filter((grant) => {
      if (principalFilter.trim()) {
        const q = principalFilter.trim().toLowerCase();
        if (!grant.principal.toLowerCase().includes(q)) {
          return false;
        }
      }
      if (privilegeFilter) {
        if (grant.privilege !== privilegeFilter) {
          return false;
        }
      }
      if (sourceFilter) {
        if (grant.source.type !== sourceFilter) {
          return false;
        }
      }
      return true;
    });
  }, [allGrants, principalFilter, privilegeFilter, sourceFilter]);

  const sortedGrants = useMemo(() => {
    return [...filteredGrants].sort((a, b) => {
      let valA = "";
      let valB = "";
      if (sortField === "principal") {
        valA = a.principal;
        valB = b.principal;
      } else if (sortField === "principal_kind") {
        valA = a.principal_kind ?? "";
        valB = b.principal_kind ?? "";
      } else if (sortField === "privilege") {
        valA = a.privilege;
        valB = b.privilege;
      } else if (sortField === "source") {
        valA = `${a.source.type}-${a.source.full_name ?? ""}`;
        valB = `${b.source.type}-${b.source.full_name ?? ""}`;
      }
      const cmp = valA.localeCompare(valB);
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [filteredGrants, sortField, sortDirection]);

  const hasActiveFilters = Boolean(
    principalFilter.trim() || privilegeFilter || sourceFilter,
  );

  function handleClearFilters() {
    setPrincipalFilter("");
    setPrivilegeFilter("");
    setSourceFilter("");
  }

  function handleHeaderSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  }

  // 1. Idle State
  if (!securableType || !fullName) {
    return <IdleView />;
  }

  // 2. Loading State
  if (grantsQuery.isLoading) {
    return (
      <div className={`space-y-[var(--space-6)] max-w-6xl ${className}`}>
        <GrantsTableSkeleton />
      </div>
    );
  }

  // 3. Error State
  if (grantsQuery.isError) {
    return (
      <div className={`max-w-6xl ${className}`}>
        <ErrorView
          error={grantsQuery.error}
          onRetry={() => {
            grantsQuery.refetch();
            if (onRefresh) onRefresh();
          }}
        />
      </div>
    );
  }

  // 4. Success State — Empty Grants
  if (allGrants.length === 0) {
    return (
      <div className={`max-w-6xl ${className}`}>
        <EmptySuccessView
          message={strings.states.emptyGrants}
          meta={grantsQuery.data?.meta}
        />
      </div>
    );
  }

  return (
    <div className={`space-y-[var(--space-6)] max-w-6xl ${className}`}>
      {/* Filter and summary bar */}
      <div className="p-[var(--space-4)] bg-[var(--color-neutral-0)] border border-[var(--color-border-subtle)] rounded-[var(--radius-panel)] shadow-[var(--shadow-panel)] space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Controls row */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Principal search filter */}
            <div className="flex items-center gap-1.5">
              <label
                htmlFor={principalInputId}
                className="text-[var(--text-xs)] font-[var(--weight-medium)] text-[var(--color-text-secondary)]"
              >
                {strings.access.filters.searchPrincipal}:
              </label>
              <input
                id={principalInputId}
                type="search"
                value={principalFilter}
                onChange={(e) => setPrincipalFilter(e.target.value)}
                placeholder={strings.access.filters.principalPlaceholder}
                className="px-2.5 py-1.5 text-[var(--text-xs)] font-[var(--font-sans)] bg-[var(--color-neutral-0)] text-[var(--color-text-primary)] border border-[var(--color-border-strong)] rounded-[var(--radius-control)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)]"
              />
            </div>

            {/* Privilege dropdown filter */}
            <div className="flex items-center gap-1.5">
              <label
                htmlFor={privilegeSelectId}
                className="text-[var(--text-xs)] font-[var(--weight-medium)] text-[var(--color-text-secondary)]"
              >
                {strings.access.filters.privilegeLabel}:
              </label>
              <select
                id={privilegeSelectId}
                value={privilegeFilter}
                onChange={(e) => setPrivilegeFilter(e.target.value)}
                className="px-2.5 py-1.5 text-[var(--text-xs)] font-[var(--font-sans)] bg-[var(--color-neutral-0)] text-[var(--color-text-primary)] border border-[var(--color-border-strong)] rounded-[var(--radius-control)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)]"
              >
                <option value="">{strings.access.filters.allPrivileges}</option>
                {distinctPrivileges.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            {/* Source dropdown filter */}
            <div className="flex items-center gap-1.5">
              <label
                htmlFor={sourceSelectId}
                className="text-[var(--text-xs)] font-[var(--weight-medium)] text-[var(--color-text-secondary)]"
              >
                {strings.access.filters.sourceLabel}:
              </label>
              <select
                id={sourceSelectId}
                value={sourceFilter}
                onChange={(e) =>
                  setSourceFilter(
                    e.target.value as "" | "direct" | "inherited" | "unknown",
                  )
                }
                className="px-2.5 py-1.5 text-[var(--text-xs)] font-[var(--font-sans)] bg-[var(--color-neutral-0)] text-[var(--color-text-primary)] border border-[var(--color-border-strong)] rounded-[var(--radius-control)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)]"
              >
                <option value="">{strings.access.filters.allSources}</option>
                <option value="direct">{strings.access.sources.direct}</option>
                <option value="inherited">{strings.access.sources.inherited}</option>
                <option value="unknown">{strings.access.sources.unknown}</option>
              </select>
            </div>

            {/* Clear filters button */}
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[var(--text-xs)] font-[var(--weight-medium)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] bg-[var(--color-neutral-1)] hover:bg-[var(--color-neutral-2)] border border-[var(--color-border-subtle)] rounded-[var(--radius-control)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)]"
              >
                <X className="w-3.5 h-3.5 text-[var(--color-icon-muted)]" aria-hidden="true" />
                <span>{strings.access.filters.clearFilters}</span>
              </button>
            ) : null}
          </div>

          {/* Grants count indicator */}
          <div className="text-[var(--text-xs)] text-[var(--color-text-muted)] font-[var(--weight-medium)] shrink-0">
            {hasActiveFilters
              ? strings.access.grantsTable.grantsCount
                  .replace("{filtered}", String(sortedGrants.length))
                  .replace("{total}", String(allGrants.length))
              : strings.access.grantsTable.totalGrants.replace(
                  "{total}",
                  String(allGrants.length),
                )}
          </div>
        </div>

        {/* Client-side notice statement */}
        <div className="flex items-center gap-1 text-[11px] text-[var(--color-text-muted)] italic border-t border-[var(--color-border-subtle)] pt-2">
          <Filter className="w-3 h-3 text-[var(--color-icon-muted)]" aria-hidden="true" />
          <span>{strings.access.filters.clientSideNotice}</span>
        </div>
      </div>

      {/* Semantic Grants Table */}
      {sortedGrants.length === 0 ? (
        <div className="p-[var(--space-8)] text-center border border-[var(--color-border-subtle)] rounded-[var(--radius-panel)] bg-[var(--color-neutral-0)] space-y-3">
          <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)]">
            {strings.access.grantsTable.noMatchingGrants}
          </p>
          <button
            type="button"
            onClick={handleClearFilters}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[var(--text-xs)] font-[var(--weight-medium)] bg-[var(--color-neutral-1)] hover:bg-[var(--color-neutral-2)] text-[var(--color-text-primary)] border border-[var(--color-border-strong)] rounded-[var(--radius-control)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring-color)]"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{strings.access.filters.clearFiltersAndShowAll}</span>
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto border border-[var(--color-border-subtle)] rounded-[var(--radius-panel)] bg-[var(--color-neutral-0)] shadow-[var(--shadow-panel)]">
          <table
            className="w-full text-left border-collapse text-[var(--text-sm)]"
            aria-label={strings.access.grantsTable.title}
          >
            <thead>
              <tr className="border-b border-[var(--color-border-subtle)] bg-[var(--color-neutral-1)] text-[var(--color-text-secondary)] font-[var(--weight-semibold)]">
                {/* 1. Principal header */}
                <th
                  scope="col"
                  aria-sort={
                    sortField === "principal"
                      ? sortDirection === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                  className="px-4 py-3"
                >
                  <button
                    type="button"
                    onClick={() => handleHeaderSort("principal")}
                    className="inline-flex items-center gap-1.5 hover:text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--focus-ring-color)] rounded"
                  >
                    <span>{strings.access.grantsTable.principal}</span>
                    <ArrowUpDown className="w-3 h-3 text-[var(--color-icon-muted)]" aria-hidden="true" />
                    <span className="sr-only">
                      (
                      {sortField === "principal"
                        ? sortDirection === "asc"
                          ? strings.access.grantsTable.sortAsc
                          : strings.access.grantsTable.sortDesc
                        : strings.access.grantsTable.sortNone}
                      )
                    </span>
                  </button>
                </th>

                {/* 2. Principal Type header */}
                <th
                  scope="col"
                  aria-sort={
                    sortField === "principal_kind"
                      ? sortDirection === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                  className="px-4 py-3"
                >
                  <button
                    type="button"
                    onClick={() => handleHeaderSort("principal_kind")}
                    className="inline-flex items-center gap-1.5 hover:text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--focus-ring-color)] rounded"
                  >
                    <span>{strings.access.grantsTable.principalType}</span>
                    <ArrowUpDown className="w-3 h-3 text-[var(--color-icon-muted)]" aria-hidden="true" />
                    <span className="sr-only">
                      (
                      {sortField === "principal_kind"
                        ? sortDirection === "asc"
                          ? strings.access.grantsTable.sortAsc
                          : strings.access.grantsTable.sortDesc
                        : strings.access.grantsTable.sortNone}
                      )
                    </span>
                  </button>
                </th>

                {/* 3. Privilege header */}
                <th
                  scope="col"
                  aria-sort={
                    sortField === "privilege"
                      ? sortDirection === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                  className="px-4 py-3"
                >
                  <button
                    type="button"
                    onClick={() => handleHeaderSort("privilege")}
                    className="inline-flex items-center gap-1.5 hover:text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--focus-ring-color)] rounded"
                  >
                    <span>{strings.access.grantsTable.privilege}</span>
                    <ArrowUpDown className="w-3 h-3 text-[var(--color-icon-muted)]" aria-hidden="true" />
                    <span className="sr-only">
                      (
                      {sortField === "privilege"
                        ? sortDirection === "asc"
                          ? strings.access.grantsTable.sortAsc
                          : strings.access.grantsTable.sortDesc
                        : strings.access.grantsTable.sortNone}
                      )
                    </span>
                  </button>
                </th>

                {/* 4. Source header */}
                <th
                  scope="col"
                  aria-sort={
                    sortField === "source"
                      ? sortDirection === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                  className="px-4 py-3"
                >
                  <button
                    type="button"
                    onClick={() => handleHeaderSort("source")}
                    className="inline-flex items-center gap-1.5 hover:text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--focus-ring-color)] rounded"
                  >
                    <span>{strings.access.grantsTable.source}</span>
                    <ArrowUpDown className="w-3 h-3 text-[var(--color-icon-muted)]" aria-hidden="true" />
                    <span className="sr-only">
                      (
                      {sortField === "source"
                        ? sortDirection === "asc"
                          ? strings.access.grantsTable.sortAsc
                          : strings.access.grantsTable.sortDesc
                        : strings.access.grantsTable.sortNone}
                      )
                    </span>
                  </button>
                </th>

                {/* 5. Actions header */}
                <th scope="col" className="px-4 py-3">
                  <span>{strings.access.grantsTable.actions}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {sortedGrants.map((grant, index) => (
                <tr
                  key={`${grant.principal}-${grant.privilege}-${grant.source.type}-${grant.source.full_name ?? ""}-${index}`}
                  className="hover:bg-[var(--color-neutral-1)]/60 transition-colors"
                >
                  {/* Principal name */}
                  <td className="px-4 py-3 font-[var(--font-mono)] text-[var(--text-xs)] text-[var(--color-text-primary)] font-[var(--weight-semibold)]">
                    {grant.principal}
                  </td>

                  {/* Principal kind */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <PrincipalTypeBadge kind={grant.principal_kind} />
                  </td>

                  {/* Privilege */}
                  <td className="px-4 py-3">
                    <PrivilegeCell code={grant.privilege} />
                  </td>

                  {/* Source */}
                  <td className="px-4 py-3">
                    <GrantSourceBadge source={grant.source} />
                  </td>

                  {/* Allowed Actions */}
                  <td className="px-4 py-3">
                    <GrantActionsCell actions={grant.allowed_actions} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Mandatory Limitation line: renders meta.limitations under the data always */}
      <LimitationsView meta={grantsQuery.data?.meta} />
    </div>
  );
}
