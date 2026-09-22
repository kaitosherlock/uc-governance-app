/**
 * client.test.ts — Unit tests for typed API client.
 *
 * Tests:
 * - success: false body throws ApiError with the right code.
 * - HTTP 202 yields an Operation with status unknown and does not throw.
 * - An aborted request raises AbortError.
 * - full_name is encoded as one segment.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse, delay } from "msw";
import type { Operation, ErrorResponse } from "@contracts/types";
import { apiGet, apiPost, buildUrl } from "../client";
import { ApiError, AbortError } from "../errors";

const server = setupServer(
  http.get("*/api/v1/test-error", () => {
    const errorBody: ErrorResponse = {
      success: false,
      code: "FORBIDDEN_ROLE",
      message: "Your role (Viewer) cannot perform this action.",
      correlation_id: "corr-err-123",
      next_steps: ["Ask an access administrator"],
    };
    return HttpResponse.json(errorBody, { status: 403 });
  }),

  http.post("*/api/v1/test-202", () => {
    const opBody = {
      success: true,
      data: {
        id: "op-unknown-1",
        plan_id: "plan-1",
        kind: "grant" as const,
        status: "unknown" as const,
        identity: {
          actor: {
            id: "u-1",
            display: "alice",
            kind: "user" as const,
            roles: ["steward" as const],
            verified_by: "fixture" as const,
          },
          executor: {
            kind: "service_principal" as const,
            display: "app-sp",
            reason: "Grants API",
          },
        },
        started_at: "2026-09-21T09:00:00Z",
        finished_at: null,
        atomic: true,
        targets: [],
        reconcile_available: true,
        summary: "Outcome unknown",
        correlation_id: "corr-202",
      },
      meta: {
        source: "fixture" as const,
        observed_at: "2026-09-21T09:00:00Z",
        completeness: "unknown" as const,
        limitations: ["Outcome pending"],
        correlation_id: "corr-202",
      },
    };
    return HttpResponse.json(opBody, { status: 202 });
  }),

  http.get("*/api/v1/test-slow", async () => {
    await delay(500);
    return HttpResponse.json({ success: true, data: "done" });
  }),

  http.get("*/api/v1/assets/:securable_type/:full_name", ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: {
        securable_type: params["securable_type"],
        full_name: params["full_name"],
      },
      meta: {
        source: "fixture",
        observed_at: "2026-09-21T09:00:00Z",
        completeness: "complete",
        limitations: [],
        correlation_id: "corr-fn",
      },
    });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("apiClient", () => {
  it("throws ApiError with the right code when success is false", async () => {
    try {
      await apiGet("/test-error");
      expect.fail("Expected apiGet to throw ApiError");
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.code).toBe("FORBIDDEN_ROLE");
      expect(apiErr.correlationId).toBe("corr-err-123");
      expect(apiErr.status).toBe(403);
      expect(apiErr.response.message).toContain("Viewer");
    }
  });

  it("yields an Operation with status unknown on HTTP 202 and does not throw", async () => {
    const result = await apiPost<Operation>("/test-202", {});
    expect(result.success).toBe(true);
    expect(result.data.status).toBe("unknown");
    expect(result.data.id).toBe("op-unknown-1");
  });

  it("converts an aborted AbortSignal into an AbortError", async () => {
    const controller = new AbortController();
    const promise = apiGet("/test-slow", { signal: controller.signal });
    controller.abort();

    await expect(promise).rejects.toBeInstanceOf(AbortError);
  });

  it("encodes full_name as a single URL path segment", () => {
    const url = buildUrl("/assets/{securable_type}/{full_name}", {
      securable_type: "TABLE",
      full_name: "sales.crm.orders",
    });
    expect(url).toBe("/api/v1/assets/TABLE/sales.crm.orders");

    // Special characters/slashes in full_name stay as one segment via encoding
    const encodedUrl = buildUrl("/assets/{securable_type}/{full_name}", {
      securable_type: "TABLE",
      full_name: "a/b/c",
    });
    expect(encodedUrl).toBe("/api/v1/assets/TABLE/a%2Fb%2Fc");
  });

  it("successfully fetches an asset with full_name via encoded path", async () => {
    const result = await apiGet<{ securable_type: string; full_name: string }>(
      "/assets/{securable_type}/{full_name}",
      {
        params: {
          securable_type: "TABLE",
          full_name: "sales.crm.orders",
        },
      },
    );
    expect(result.success).toBe(true);
    expect(result.data.full_name).toBe("sales.crm.orders");
  });
});
