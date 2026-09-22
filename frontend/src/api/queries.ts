/**
 * queries.ts — TanStack Query hooks for context, identity, and capabilities.
 *
 * Query keys include {actorId, workspaceId, scope} as required by architecture §8.
 * Configured with sensible staleTime, retry disabling for 4xx errors,
 * and passes the query's AbortSignal to the API client.
 */
import { useQuery } from "@tanstack/react-query";
import type {
  Capability,
  Context,
  Identity,
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
