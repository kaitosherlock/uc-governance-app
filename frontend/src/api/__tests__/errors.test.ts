/**
 * errors.test.ts — Unit tests for error mappings and describeError.
 *
 * Verifies:
 * - Every single ErrorCode maps to a non-empty title and body in describeError().
 * - Unknown codes fall back gracefully and do not throw.
 * - AbortError and generic errors are described appropriately.
 */
import { describe, it, expect } from "vitest";
import type { ErrorCode, ErrorResponse } from "@contracts/types";
import { describeError, ApiError, AbortError, isClientError } from "../errors";

const ALL_ERROR_CODES: ErrorCode[] = [
  "VALIDATION_FAILED",
  "UNAUTHENTICATED",
  "IDENTITY_MISMATCH",
  "FORBIDDEN_ROLE",
  "FORBIDDEN_SCOPE",
  "MODE_READ_ONLY",
  "INSUFFICIENT_PRIVILEGES",
  "SOD_VIOLATION",
  "NOT_FOUND",
  "PLAN_STALE",
  "PLAN_EXPIRED",
  "PLAN_TAMPERED",
  "PLAN_INVALIDATED",
  "DUPLICATE_SUBMISSION",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
  "NOT_IMPLEMENTED",
  "UNSUPPORTED",
  "NOT_CONFIGURED",
  "UPSTREAM_UNAVAILABLE",
  "OUTCOME_UNKNOWN",
];

describe("describeError", () => {
  it("contains all 21 ErrorCode values in the test suite", () => {
    expect(ALL_ERROR_CODES).toHaveLength(21);
  });

  it.each(ALL_ERROR_CODES)(
    "maps %s to a non-empty human-readable title and body",
    (code) => {
      const response: ErrorResponse = {
        success: false,
        code,
        message: `Backend message for ${code}`,
        correlation_id: `corr-${code}`,
        next_steps: ["Step 1", "Step 2"],
      };

      const apiError = new ApiError(response, 400);
      const desc = describeError(apiError);

      // Title must be present, non-empty, and mapped to English (not raw code)
      expect(desc.title).toBeTruthy();
      expect(desc.title).not.toBe(code);

      // Body should reflect server message
      expect(desc.body).toBe(`Backend message for ${code}`);

      // Next steps and correlation ID should be preserved
      expect(desc.nextSteps).toEqual(["Step 1", "Step 2"]);
      expect(desc.correlationId).toBe(`corr-${code}`);
    },
  );

  it("handles unknown error codes without crashing", () => {
    const response = {
      success: false as const,
      code: "UNKNOWN_FUTURE_CODE" as unknown as ErrorCode,
      message: "Future error message",
      correlation_id: "corr-unknown",
    };

    const apiError = new ApiError(response, 500);
    const desc = describeError(apiError);

    expect(desc.title).toBe("UNKNOWN_FUTURE_CODE");
    expect(desc.body).toBe("Future error message");
    expect(desc.correlationId).toBe("corr-unknown");
  });

  it("describes AbortError gracefully", () => {
    const abortError = new AbortError();
    const desc = describeError(abortError);

    expect(desc.title).toBeTruthy();
    expect(desc.body).toBeTruthy();
    expect(desc.correlationId).toBeNull();
  });

  it("describes generic unknown errors gracefully", () => {
    const genericError = new Error("Something broke");
    const desc = describeError(genericError);

    expect(desc.title).toBeTruthy();
    expect(desc.body).toBeTruthy();
    expect(desc.correlationId).toBeNull();
  });

  it("correctly identifies 4xx errors via isClientError", () => {
    const err400 = new ApiError(
      { success: false, code: "VALIDATION_FAILED", message: "m", correlation_id: "c" },
      400,
    );
    const err403 = new ApiError(
      { success: false, code: "FORBIDDEN_ROLE", message: "m", correlation_id: "c" },
      403,
    );
    const err500 = new ApiError(
      { success: false, code: "INTERNAL_ERROR", message: "m", correlation_id: "c" },
      500,
    );

    expect(isClientError(err400)).toBe(true);
    expect(isClientError(err403)).toBe(true);
    expect(isClientError(err500)).toBe(false);
    expect(isClientError(new Error("standard"))).toBe(false);
  });
});
