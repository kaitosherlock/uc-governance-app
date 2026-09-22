/**
 * queries.ts — TanStack Query hooks for context, identity, and capabilities.
 *
 * Query keys include {actorId, workspaceId, scope} as required by architecture §8.
 * Configured with sensible staleTime, retry disabling for 4xx errors,
 * and passes the query's AbortSignal to the API client.
 */
import { useQuery } from "@tanstack/react-query";
import type {
  AssetDetail,
  AssetSummary,
  Capability,
  Context,
  DependenciesData,
  GrantsData,
  Identity,
  ObjectKind,
  PagedResponse,
  Privilege,
  SecurableType,
  SuccessResponse,
} from "@contracts/types";
import { API_PATHS } from "@contracts/types";
import { apiGet } from "./client";
import { isClientError } from "./errors";

const DEFAULT_STALE_TIME = 5 * 60 * 1000; // 5 minutes

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
  return useQuery<SuccessResponse<Context>, unknown>({
    queryKey: ["context", { actorId: null, workspaceId: null, scope: null }],
    queryFn: ({ signal }) => apiGet<Context>(API_PATHS.context, { signal }),
    staleTime: DEFAULT_STALE_TIME,
    retry(failureCount, error) {
      if (isClientError(error)) return false;
      return failureCount < 3;
    },
  });
}

/** Alias for useAppContext to satisfy useContext name in prompt and tests. */
export const useContext = useAppContext;

/** Hook to fetch actor identity and executor. */
export function useMe() {
  return useQuery<SuccessResponse<Identity>, unknown>({
    queryKey: ["me", { actorId: null, workspaceId: null, scope: null }],
    queryFn: ({ signal }) => apiGet<Identity>(API_PATHS.me, { signal }),
    staleTime: DEFAULT_STALE_TIME,
    retry(failureCount, error) {
      if (isClientError(error)) return false;
      return failureCount < 3;
    },
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
    retry(failureCount, error) {
      if (isClientError(error)) return false;
      return failureCount < 3;
    },
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
    retry(failureCount, error) {
      if (isClientError(error)) return false;
      return failureCount < 3;
    },
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
    retry(failureCount, error) {
      if (isClientError(error)) return false;
      return failureCount < 3;
    },
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
    retry(failureCount, error) {
      if (isClientError(error)) return false;
      return failureCount < 3;
    },
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
    retry(failureCount, error) {
      if (isClientError(error)) return false;
      return failureCount < 3;
    },
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
    retry(failureCount, error) {
      if (isClientError(error)) return false;
      return failureCount < 3;
    },
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
    retry(failureCount, error) {
      if (isClientError(error)) return false;
      return failureCount < 3;
    },
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
    retry(failureCount, error) {
      if (isClientError(error)) return false;
      return failureCount < 3;
    },
  });
}

