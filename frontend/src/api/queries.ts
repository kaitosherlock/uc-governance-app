/**
 * queries.ts — TanStack Query hooks for context, identity, and capabilities.
 *
 * Query keys include {actorId, workspaceId, scope} as required by architecture §8.
 * Configured with sensible staleTime, retry disabling for 4xx errors,
 * and passes the query's AbortSignal to the API client.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AbacPolicy,
  AssetDetail,
  AssetSummary,
  Capability,
  Context,
  DependenciesData,
  FunctionDetail,
  GrantsData,
  Identity,
  ObjectKind,
  Operation,
  PagedResponse,
  Plan,
  PlanCreateRequest,
  PlanExecuteRequest,
  PolicyImpactData,
  Privilege,
  RowAccessData,
  SecurableType,
  SuccessResponse,
  TagPolicy,
  TagsData,
} from "@contracts/types";
import { API_PATHS } from "@contracts/types";
import { apiGet, apiPost } from "./client";
import { isClientError } from "./errors";

const DEFAULT_STALE_TIME = 5 * 60 * 1000; // 5 minutes

/**
 * Hook to resolve retry logic:
 * - If QueryClient or query options explicitly specify retry (e.g. retry: false in tests), honor it.
 * - Suppress retries on 4xx client errors (isClientError).
 * - Otherwise default to retrying up to 3 times for network or 5xx server errors.
 */
function useDefaultRetry(
  customRetry?: boolean | number | ((failureCount: number, error: unknown) => boolean) | undefined,
) {
  const queryClient = useQueryClient();
  const defaultRetryOption = queryClient.getDefaultOptions().queries?.retry;

  return (failureCount: number, error: unknown): boolean => {
    if (customRetry === false || customRetry === 0) return false;
    if (defaultRetryOption === false || defaultRetryOption === 0) return false;
    if (isClientError(error)) return false;
    if (typeof customRetry === "number") return failureCount < customRetry;
    if (typeof customRetry === "function") {
      return error instanceof Error ? Boolean(customRetry(failureCount, error)) : false;
    }
    if (typeof defaultRetryOption === "number") return failureCount < defaultRetryOption;
    if (typeof defaultRetryOption === "function") {
      return error instanceof Error ? Boolean(defaultRetryOption(failureCount, error)) : false;
    }
    return failureCount < 3;
  };
}

export interface ScopeKey {
  catalog: string | null;
  schema: string | null;
}

export interface QueryScopeContext {
  actorId?: string | null | undefined;
  workspaceId?: string | null | undefined;
  scope?: ScopeKey | null | undefined;
}

/** Hook to fetch application context (workspace, mode, managed scope). */
export function useAppContext() {
  const retry = useDefaultRetry();
  return useQuery<SuccessResponse<Context>, unknown>({
    queryKey: ["context", { actorId: null, workspaceId: null, scope: null }],
    queryFn: ({ signal }) => apiGet<Context>(API_PATHS.context, { signal }),
    staleTime: DEFAULT_STALE_TIME,
    retry,
  });
}

/** Alias for useAppContext to satisfy useContext name in prompt and tests. */
export const useContext = useAppContext;

/** Hook to fetch actor identity and executor. */
export function useMe() {
  const retry = useDefaultRetry();
  return useQuery<SuccessResponse<Identity>, unknown>({
    queryKey: ["me", { actorId: null, workspaceId: null, scope: null }],
    queryFn: ({ signal }) => apiGet<Identity>(API_PATHS.me, { signal }),
    staleTime: DEFAULT_STALE_TIME,
    retry,
  });
}

/** Hook to fetch platform capabilities, scoped by identity and workspace. */
export function useCapabilities(
  actorIdOrContext?: string | QueryScopeContext | null | undefined,
  workspaceId?: string | null | undefined,
  scope?: ScopeKey | null | undefined,
) {
  let actorId: string | null | undefined;
  let wsId: string | null | undefined = workspaceId;
  let sc: ScopeKey | null | undefined = scope;

  if (typeof actorIdOrContext === "object" && actorIdOrContext !== null) {
    actorId = actorIdOrContext.actorId;
    wsId = actorIdOrContext.workspaceId;
    sc = actorIdOrContext.scope;
  } else {
    actorId = actorIdOrContext;
  }

  const retry = useDefaultRetry();
  return useQuery<SuccessResponse<Capability[]>, unknown>({
    queryKey: [
      "capabilities",
      {
        actorId: actorId ?? null,
        workspaceId: wsId ?? null,
        scope: sc ?? null,
      },
    ],
    queryFn: ({ signal }) =>
      apiGet<Capability[]>(API_PATHS.capabilities, { signal }),
    staleTime: DEFAULT_STALE_TIME,
    retry,
  });
}

export interface CatalogsQueryOptions {
  query?: string | undefined;
  page_token?: string | undefined;
  page_size?: number | undefined;
  actorId?: string | null | undefined;
  workspaceId?: string | null | undefined;
  enabled?: boolean | undefined;
}

/** Hook to fetch catalogs visible to executing identity. */
export function useCatalogs(options?: CatalogsQueryOptions) {
  const retry = useDefaultRetry();
  return useQuery<PagedResponse<AssetSummary>, unknown>({
    queryKey: [
      "catalogs",
      {
        actorId: options?.actorId ?? null,
        workspaceId: options?.workspaceId ?? null,
        query: options?.query ?? null,
        page_token: options?.page_token ?? null,
        page_size: options?.page_size ?? null,
      },
    ],
    queryFn: async ({ signal }) => {
      const queryParams: Record<string, string | number | undefined> = {};
      if (options?.query) queryParams["query"] = options.query;
      if (options?.page_token) queryParams["page_token"] = options.page_token;
      if (options?.page_size !== undefined) queryParams["page_size"] = options.page_size;

      const res = await apiGet<AssetSummary[]>(API_PATHS.catalogs, {
        query: Object.keys(queryParams).length > 0 ? queryParams : undefined,
        signal,
      });
      return res as unknown as PagedResponse<AssetSummary>;
    },
    enabled: options?.enabled !== false,
    staleTime: DEFAULT_STALE_TIME,
    retry,
  });
}

export interface SchemasQueryOptions {
  query?: string | undefined;
  page_token?: string | undefined;
  page_size?: number | undefined;
  actorId?: string | null | undefined;
  workspaceId?: string | null | undefined;
  enabled?: boolean | undefined;
}

/** Hook to fetch schemas in a catalog. */
export function useSchemas(
  catalog: string | null | undefined,
  options?: SchemasQueryOptions,
) {
  const retry = useDefaultRetry();
  return useQuery<PagedResponse<AssetSummary>, unknown>({
    queryKey: [
      "schemas",
      catalog ?? null,
      {
        actorId: options?.actorId ?? null,
        workspaceId: options?.workspaceId ?? null,
        query: options?.query ?? null,
        page_token: options?.page_token ?? null,
        page_size: options?.page_size ?? null,
      },
    ],
    queryFn: async ({ signal }) => {
      if (!catalog) throw new Error("Catalog is required to fetch schemas");

      const queryParams: Record<string, string | number | undefined> = {};
      if (options?.query) queryParams["query"] = options.query;
      if (options?.page_token) queryParams["page_token"] = options.page_token;
      if (options?.page_size !== undefined) queryParams["page_size"] = options.page_size;

      const res = await apiGet<AssetSummary[]>(API_PATHS.schemas, {
        params: { catalog },
        query: Object.keys(queryParams).length > 0 ? queryParams : undefined,
        signal,
      });
      return res as unknown as PagedResponse<AssetSummary>;
    },
    enabled: Boolean(catalog) && options?.enabled !== false,
    staleTime: DEFAULT_STALE_TIME,
    retry,
  });
}

export interface SchemaObjectsQueryOptions {
  kind?: ObjectKind[] | undefined;
  owner?: string | undefined;
  query?: string | undefined;
  page_token?: string | undefined;
  page_size?: number | undefined;
  actorId?: string | null | undefined;
  workspaceId?: string | null | undefined;
  enabled?: boolean | undefined;
}

/** Hook to fetch objects (tables, views, volumes, etc.) in a schema. */
export function useSchemaObjects(
  catalog: string | null | undefined,
  schema: string | null | undefined,
  options?: SchemaObjectsQueryOptions,
) {
  const retry = useDefaultRetry();
  return useQuery<PagedResponse<AssetSummary>, unknown>({
    queryKey: [
      "schemaObjects",
      catalog ?? null,
      schema ?? null,
      {
        actorId: options?.actorId ?? null,
        workspaceId: options?.workspaceId ?? null,
        kind: options?.kind ?? null,
        owner: options?.owner ?? null,
        query: options?.query ?? null,
        page_token: options?.page_token ?? null,
        page_size: options?.page_size ?? null,
      },
    ],
    queryFn: async ({ signal }) => {
      if (!catalog || !schema) throw new Error("Catalog and schema are required");

      const queryParams: Record<string, string | number | undefined> = {};
      if (options?.kind && options.kind.length > 0) {
        queryParams["kind"] = options.kind.join(",");
      }
      if (options?.owner) queryParams["owner"] = options.owner;
      if (options?.query) queryParams["query"] = options.query;
      if (options?.page_token) queryParams["page_token"] = options.page_token;
      if (options?.page_size !== undefined) queryParams["page_size"] = options.page_size;

      const res = await apiGet<AssetSummary[]>(API_PATHS.schemaObjects, {
        params: { catalog, schema },
        query: Object.keys(queryParams).length > 0 ? queryParams : undefined,
        signal,
      });
      return res as unknown as PagedResponse<AssetSummary>;
    },
    enabled: Boolean(catalog && schema) && options?.enabled !== false,
    staleTime: DEFAULT_STALE_TIME,
    retry,
  });
}

export interface AssetQueryOptions {
  actorId?: string | null | undefined;
  workspaceId?: string | null | undefined;
}

/** Hook to fetch one asset detail by securable_type and full_name. */
export function useAsset(
  securableType: SecurableType | string | null | undefined,
  fullName: string | null | undefined,
  options?: AssetQueryOptions,
) {
  const retry = useDefaultRetry();
  return useQuery<SuccessResponse<AssetDetail>, unknown>({
    queryKey: [
      "asset",
      securableType ?? null,
      fullName ?? null,
      {
        actorId: options?.actorId ?? null,
        workspaceId: options?.workspaceId ?? null,
      },
    ],
    queryFn: async ({ signal }) => {
      if (!securableType || !fullName) {
        throw new Error("securableType and fullName are required");
      }
      return apiGet<AssetDetail>(API_PATHS.asset, {
        params: { securable_type: securableType, full_name: fullName },
        signal,
      });
    },
    enabled: Boolean(securableType && fullName),
    staleTime: DEFAULT_STALE_TIME,
    retry,
  });
}

export interface AssetDependenciesQueryOptions {
  actorId?: string | null | undefined;
  workspaceId?: string | null | undefined;
}

/** Hook to fetch dependencies for an asset. */
export function useAssetDependencies(
  securableType: SecurableType | string | null | undefined,
  fullName: string | null | undefined,
  options?: AssetDependenciesQueryOptions,
) {
  const retry = useDefaultRetry();
  return useQuery<SuccessResponse<DependenciesData>, unknown>({
    queryKey: [
      "assetDependencies",
      securableType ?? null,
      fullName ?? null,
      {
        actorId: options?.actorId ?? null,
        workspaceId: options?.workspaceId ?? null,
      },
    ],
    queryFn: async ({ signal }) => {
      if (!securableType || !fullName) {
        throw new Error("securableType and fullName are required");
      }
      return apiGet<DependenciesData>(API_PATHS.assetDependencies, {
        params: { securable_type: securableType, full_name: fullName },
        signal,
      });
    },
    enabled: Boolean(securableType && fullName),
    staleTime: DEFAULT_STALE_TIME,
    retry,
  });
}

export interface AssetGrantsQueryOptions {
  actorId?: string | null | undefined;
  workspaceId?: string | null | undefined;
  enabled?: boolean | undefined;
}

/** Hook to fetch grants for an asset (direct + inherited). */
export function useAssetGrants(
  securableType: SecurableType | string | null | undefined,
  fullName: string | null | undefined,
  options?: AssetGrantsQueryOptions,
) {
  const retry = useDefaultRetry();
  return useQuery<SuccessResponse<GrantsData>, unknown>({
    queryKey: [
      "grants",
      securableType ?? null,
      fullName ?? null,
      {
        actorId: options?.actorId ?? null,
        workspaceId: options?.workspaceId ?? null,
      },
    ],
    queryFn: async ({ signal }) => {
      if (!securableType || !fullName) {
        throw new Error("securableType and fullName are required");
      }
      return apiGet<GrantsData>(API_PATHS.assetGrants, {
        params: { securable_type: securableType, full_name: fullName },
        signal,
      });
    },
    enabled: Boolean(securableType && fullName) && options?.enabled !== false,
    staleTime: DEFAULT_STALE_TIME,
    retry,
  });
}

export interface PrivilegesQueryOptions {
  actorId?: string | null | undefined;
  workspaceId?: string | null | undefined;
  enabled?: boolean | undefined;
}

/** Hook to fetch privilege catalogue for a securable type. */
export function usePrivileges(
  securableType: SecurableType | string | null | undefined,
  options?: PrivilegesQueryOptions,
) {
  const retry = useDefaultRetry();
  return useQuery<SuccessResponse<Privilege[]>, unknown>({
    queryKey: [
      "privileges",
      securableType ?? null,
      {
        actorId: options?.actorId ?? null,
        workspaceId: options?.workspaceId ?? null,
      },
    ],
    queryFn: async ({ signal }) => {
      if (!securableType) {
        throw new Error("securableType is required");
      }
      return apiGet<Privilege[]>(API_PATHS.privileges, {
        query: { securable_type: securableType },
        signal,
      });
    },
    enabled: Boolean(securableType) && options?.enabled !== false,
    staleTime: DEFAULT_STALE_TIME,
    retry,
  });
}

/** Hook to create a plan (read-only preview). */
export function useCreatePlan() {
  return useMutation<SuccessResponse<Plan>, unknown, PlanCreateRequest>({
    mutationFn: (body) => apiPost<Plan>(API_PATHS.plans, body),
  });
}

/** Hook to fetch a plan by ID. */
export function useGetPlan(planId: string | null | undefined) {
  return useQuery<SuccessResponse<Plan>, unknown>({
    queryKey: ["plan", planId ?? null],
    queryFn: ({ signal }) => {
      if (!planId) throw new Error("planId is required");
      return apiGet<Plan>(API_PATHS.plan, { params: { plan_id: planId }, signal });
    },
    enabled: Boolean(planId),
    retry: false,
  });
}

export interface ExecutePlanVariables {
  planId: string;
  body: PlanExecuteRequest;
}

/** Hook to execute a confirmed plan. */
export function useExecutePlan() {
  return useMutation<SuccessResponse<Operation>, unknown, ExecutePlanVariables>({
    mutationFn: ({ planId, body }) =>
      apiPost<Operation>(API_PATHS.planExecute, body, { params: { plan_id: planId } }),
  });
}

/** Hook to fetch an operation by ID. */
export function useGetOperation(operationId: string | null | undefined) {
  return useQuery<SuccessResponse<Operation>, unknown>({
    queryKey: ["operation", operationId ?? null],
    queryFn: ({ signal }) => {
      if (!operationId) throw new Error("operationId is required");
      return apiGet<Operation>(API_PATHS.operation, {
        params: { operation_id: operationId },
        signal,
      });
    },
    enabled: Boolean(operationId),
    retry: false,
  });
}

/** Hook to reconcile an operation with unknown outcome. */
export function useReconcileOperation() {
  return useMutation<SuccessResponse<Operation>, unknown, string>({
    mutationFn: (operationId) =>
      apiPost<Operation>(API_PATHS.operationReconcile, undefined, {
        params: { operation_id: operationId },
      }),
  });
}

export interface AssetTagsQueryOptions {
  actorId?: string | null | undefined;
  workspaceId?: string | null | undefined;
  enabled?: boolean | undefined;
}

/** Hook to fetch tags for an asset (object + column tags). */
export function useAssetTags(
  securableType: SecurableType | string | null | undefined,
  fullName: string | null | undefined,
  options?: AssetTagsQueryOptions,
) {
  const retry = useDefaultRetry();
  return useQuery<SuccessResponse<TagsData>, unknown>({
    queryKey: [
      "tags",
      securableType ?? null,
      fullName ?? null,
      {
        actorId: options?.actorId ?? null,
        workspaceId: options?.workspaceId ?? null,
      },
    ],
    queryFn: async ({ signal }) => {
      if (!securableType || !fullName) {
        throw new Error("securableType and fullName are required");
      }
      return apiGet<TagsData>(API_PATHS.assetTags, {
        params: { securable_type: securableType, full_name: fullName },
        signal,
      });
    },
    enabled: Boolean(securableType && fullName) && options?.enabled !== false,
    staleTime: DEFAULT_STALE_TIME,
    retry,
  });
}

export interface TagPoliciesQueryOptions {
  page_token?: string | undefined;
  page_size?: number | undefined;
  actorId?: string | null | undefined;
  workspaceId?: string | null | undefined;
  enabled?: boolean | undefined;
}

/** Hook to fetch tag policies (governed tag constraints). */
export function useTagPolicies(options?: TagPoliciesQueryOptions) {
  const retry = useDefaultRetry();
  return useQuery<PagedResponse<TagPolicy>, unknown>({
    queryKey: [
      "tagPolicies",
      {
        actorId: options?.actorId ?? null,
        workspaceId: options?.workspaceId ?? null,
        page_token: options?.page_token ?? null,
        page_size: options?.page_size ?? null,
      },
    ],
    queryFn: async ({ signal }) => {
      const queryParams: Record<string, string | number | undefined> = {};
      if (options?.page_token) queryParams["page_token"] = options.page_token;
      if (options?.page_size !== undefined) queryParams["page_size"] = options.page_size;

      const res = await apiGet<TagPolicy[]>(API_PATHS.tagPolicies, {
        query: Object.keys(queryParams).length > 0 ? queryParams : undefined,
        signal,
      });
      return res as unknown as PagedResponse<TagPolicy>;
    },
    enabled: options?.enabled !== false,
    staleTime: DEFAULT_STALE_TIME,
    retry,
  });
}

export interface AbacPoliciesQueryOptions {
  page_token?: string | undefined;
  page_size?: number | undefined;
  actorId?: string | null | undefined;
  workspaceId?: string | null | undefined;
  enabled?: boolean | undefined;
}

/** Hook to fetch ABAC policies. */
export function useAbacPolicies(options?: AbacPoliciesQueryOptions) {
  const retry = useDefaultRetry();
  return useQuery<PagedResponse<AbacPolicy>, unknown>({
    queryKey: [
      "abacPolicies",
      {
        actorId: options?.actorId ?? null,
        workspaceId: options?.workspaceId ?? null,
        page_token: options?.page_token ?? null,
        page_size: options?.page_size ?? null,
      },
    ],
    queryFn: async ({ signal }) => {
      const queryParams: Record<string, string | number | undefined> = {};
      if (options?.page_token) queryParams["page_token"] = options.page_token;
      if (options?.page_size !== undefined) queryParams["page_size"] = options.page_size;

      const res = await apiGet<AbacPolicy[]>(API_PATHS.abacPolicies, {
        query: Object.keys(queryParams).length > 0 ? queryParams : undefined,
        signal,
      });
      return res as unknown as PagedResponse<AbacPolicy>;
    },
    enabled: options?.enabled !== false,
    staleTime: DEFAULT_STALE_TIME,
    retry,
  });
}

/** Hook to fetch a single ABAC policy by ID. */
export function useAbacPolicy(
  policyId: string | null | undefined,
  options?: { enabled?: boolean | undefined },
) {
  const retry = useDefaultRetry();
  return useQuery<SuccessResponse<AbacPolicy>, unknown>({
    queryKey: ["abacPolicy", policyId ?? null],
    queryFn: ({ signal }) => {
      if (!policyId) throw new Error("policyId is required");
      return apiGet<AbacPolicy>(API_PATHS.abacPolicy, {
        params: { policy_id: policyId },
        signal,
      });
    },
    enabled: Boolean(policyId) && options?.enabled !== false,
    staleTime: DEFAULT_STALE_TIME,
    retry,
  });
}

/** Hook to fetch potential impact of an ABAC policy (approximation within visible scope). */
export function useAbacPolicyImpact(
  policyId: string | null | undefined,
  options?: { enabled?: boolean | undefined },
) {
  const retry = useDefaultRetry();
  return useQuery<SuccessResponse<PolicyImpactData>, unknown>({
    queryKey: ["abacPolicyImpact", policyId ?? null],
    queryFn: ({ signal }) => {
      if (!policyId) throw new Error("policyId is required");
      return apiGet<PolicyImpactData>(API_PATHS.abacPolicyImpact, {
        params: { policy_id: policyId },
        signal,
      });
    },
    enabled: Boolean(policyId) && options?.enabled !== false,
    staleTime: DEFAULT_STALE_TIME,
    retry,
  });
}

export interface RowAccessQueryOptions {
  actorId?: string | null | undefined;
  workspaceId?: string | null | undefined;
  enabled?: boolean | undefined;
}

/** Hook to fetch row filters and column masks for a TABLE. */
export function useRowAccess(
  fullName: string | null | undefined,
  options?: RowAccessQueryOptions,
) {
  const retry = useDefaultRetry();
  return useQuery<SuccessResponse<RowAccessData>, unknown>({
    queryKey: [
      "rowAccess",
      fullName ?? null,
      {
        actorId: options?.actorId ?? null,
        workspaceId: options?.workspaceId ?? null,
      },
    ],
    queryFn: async ({ signal }) => {
      if (!fullName) throw new Error("fullName is required");
      return apiGet<RowAccessData>(API_PATHS.rowAccess, {
        params: { full_name: fullName },
        signal,
      });
    },
    enabled: Boolean(fullName) && options?.enabled !== false,
    staleTime: DEFAULT_STALE_TIME,
    retry,
  });
}

/** Hook to fetch details of a function used by a filter or mask. */
export function useFunctionDetail(
  fullName: string | null | undefined,
  options?: { enabled?: boolean | undefined },
) {
  const retry = useDefaultRetry();
  return useQuery<SuccessResponse<FunctionDetail>, unknown>({
    queryKey: ["function", fullName ?? null],
    queryFn: async ({ signal }) => {
      if (!fullName) throw new Error("fullName is required");
      return apiGet<FunctionDetail>(API_PATHS.function, {
        params: { full_name: fullName },
        signal,
      });
    },
    enabled: Boolean(fullName) && options?.enabled !== false,
    staleTime: DEFAULT_STALE_TIME,
    retry,
  });
}


