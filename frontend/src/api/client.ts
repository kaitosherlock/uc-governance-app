/**
 * client.ts — Typed API client for Unity Catalog Governance application.
 *
 * The ONLY place in the application that calls fetch.
 * - Prefixes every path with /api/v1 and fills API_PATHS placeholders.
 * - URL-encodes full_name as a single path segment.
 * - Parses the JSON envelope and narrows on the success discriminant.
 * - On success: false throws ApiError carrying the ErrorResponse.
 * - Treats HTTP 202 as a success with Operation payload (status: unknown).
 * - Forwards AbortSignal and turns cancellations into AbortError.
 * - Sends no authentication header (browser/platform handles it).
 * - Never retries a mutation.
 */
import type { ErrorResponse, SuccessResponse } from "@contracts/types";
import { AbortError, ApiError } from "./errors";

const API_PREFIX = "/api/v1";

export interface RequestOptions {
  params?: Record<string, string> | undefined;
  query?: Record<string, string | number | boolean | undefined> | undefined;
  signal?: AbortSignal | undefined;
  headers?: Record<string, string> | undefined;
}

/**
 * Resolves the ?scenario= search parameter from the current page URL in development only.
 * In a production build, import.meta.env.DEV is false and this returns undefined.
 */
export function getActiveDevScenario(isDev: boolean = import.meta.env.DEV): string | undefined {
  if (!isDev) {
    return undefined;
  }
  if (typeof window !== "undefined" && window.location?.search) {
    const scenario = new URLSearchParams(window.location.search).get("scenario");
    return scenario || undefined;
  }
  return undefined;
}

/**
 * Builds the full URL including /api/v1 prefix, resolved path parameters, and query string.
 * Path parameters like {full_name} are URL-encoded as a single segment.
 * In development only, ?scenario= from the current page URL is automatically forwarded.
 */
export function buildUrl(
  pathTemplate: string,
  params?: Record<string, string> | undefined,
  query?: Record<string, string | number | boolean | undefined> | undefined,
  isDev: boolean = import.meta.env.DEV,
): string {
  // Replace path parameters like {full_name}, {catalog}, etc.
  let resolved = pathTemplate.replace(/\{([^}]+)\}/g, (_, key: string) => {
    const value = params?.[key];
    if (value === undefined) {
      return `{${key}}`;
    }
    return encodeURIComponent(value);
  });

  // Ensure leading slash
  if (!resolved.startsWith("/")) {
    resolved = `/${resolved}`;
  }

  // Prefix with /api/v1 if not already present
  const fullPath = resolved.startsWith(API_PREFIX)
    ? resolved
    : `${API_PREFIX}${resolved}`;

  const searchParams = new URLSearchParams();

  // In development only, propagate ?scenario= from the current page URL if not already explicitly specified
  const devScenario = getActiveDevScenario(isDev);
  if (devScenario && query?.["scenario"] === undefined) {
    searchParams.set("scenario", devScenario);
  }

  // Append query string if present
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) {
        searchParams.set(k, String(v));
      }
    }
  }

  const qs = searchParams.toString();
  if (qs) {
    return `${fullPath}?${qs}`;
  }

  return fullPath;
}

/** Internal generic request dispatcher. */
async function request<T>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  pathTemplate: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<SuccessResponse<T>> {
  const url = buildUrl(pathTemplate, options?.params, options?.query);

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options?.headers ?? {}),
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const init: RequestInit = {
    method,
    headers,
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  if (options?.signal !== undefined) {
    init.signal = options.signal;
  }

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (err: unknown) {
    if (
      options?.signal?.aborted ||
      (err instanceof DOMException && err.name === "AbortError") ||
      (err instanceof Error && err.name === "AbortError")
    ) {
      throw new AbortError();
    }
    throw err;
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    // Failed to parse JSON response body
    if (response.ok) {
      throw new Error(`Unexpected non-JSON response from ${url}`);
    }
    const fallback: ErrorResponse = {
      success: false,
      code: "INTERNAL_ERROR",
      message: response.statusText || "Request failed",
      correlation_id: response.headers.get("x-correlation-id") ?? "unknown",
    };
    throw new ApiError(fallback, response.status);
  }

  // Treats HTTP 202 as a success whose payload is an Operation with status unknown
  if (response.status === 202) {
    return json as SuccessResponse<T>;
  }

  const envelope = json as { success?: boolean };
  if (envelope?.success === false) {
    throw new ApiError(json as ErrorResponse, response.status);
  }

  if (!response.ok) {
    const fallback: ErrorResponse = {
      success: false,
      code: "INTERNAL_ERROR",
      message: response.statusText || `HTTP ${response.status}`,
      correlation_id: response.headers.get("x-correlation-id") ?? "unknown",
    };
    throw new ApiError(fallback, response.status);
  }

  return json as SuccessResponse<T>;
}

export function apiGet<T>(
  path: string,
  options?: RequestOptions,
): Promise<SuccessResponse<T>> {
  return request<T>("GET", path, undefined, options);
}

export function apiPost<T>(
  path: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<SuccessResponse<T>> {
  return request<T>("POST", path, body, options);
}

export function apiPatch<T>(
  path: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<SuccessResponse<T>> {
  return request<T>("PATCH", path, body, options);
}

export function apiDelete<T>(
  path: string,
  options?: RequestOptions,
): Promise<SuccessResponse<T>> {
  return request<T>("DELETE", path, undefined, options);
}

export const apiClient = {
  get: apiGet,
  post: apiPost,
  patch: apiPatch,
  delete: apiDelete,
  buildUrl,
};
