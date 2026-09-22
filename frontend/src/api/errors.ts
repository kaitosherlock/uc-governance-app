/**
 * errors.ts — Typed API error classes and error description helper.
 *
 * ApiError carries the full ErrorResponse envelope so any consumer can
 * inspect code, correlation_id, next_steps, and field errors.
 * AbortError wraps a fetch cancellation via AbortSignal.
 * describeError() maps any thrown value to a UI-ready description.
 */
import type { ErrorCode, ErrorResponse } from "@contracts/types";
import { strings } from "@/lib/strings";

/** Thrown when the API returns success: false. */
export class ApiError extends Error {
  readonly response: ErrorResponse;
  readonly status: number;

  constructor(response: ErrorResponse, status: number) {
    super(response.message);
    this.name = "ApiError";
    this.response = response;
    this.status = status;
  }

  get code(): ErrorCode {
    return this.response.code;
  }

  get correlationId(): string {
    return this.response.correlation_id;
  }
}

/** Thrown when a request is cancelled via AbortSignal. */
export class AbortError extends Error {
  constructor() {
    super("Request was aborted");
    this.name = "AbortError";
  }
}

/** A UI-ready description of an error. */
export interface ErrorDescription {
  title: string;
  body: string;
  nextSteps: string[];
  correlationId: string | null;
}

/**
 * Look up error code strings from the strings file.
 * Falls back to the raw code for unknown values so the UI never crashes.
 */
function getCodeStrings(code: string): { title: string; body: string } {
  const map: Record<string, { readonly title: string; readonly body: string } | undefined> =
    strings.errorCodes;
  const entry = map[code];
  if (entry) {
    return { title: entry.title, body: entry.body };
  }
  // Unknown code — render verbatim
  return { title: code, body: code };
}

/**
 * Maps any thrown value to a UI-ready error description.
 *
 * - ApiError: title from strings.ts error code mapping, body from server message.
 * - AbortError: generic cancellation message.
 * - Anything else: generic failure with no correlation ID.
 */
export function describeError(error: unknown): ErrorDescription {
  if (error instanceof ApiError) {
    const codeStrings = getCodeStrings(error.code);
    return {
      title: codeStrings.title,
      body: error.response.message,
      nextSteps: error.response.next_steps ? [...error.response.next_steps] : [],
      correlationId: error.response.correlation_id,
    };
  }

  if (error instanceof AbortError) {
    return {
      title: strings.common.cancel,
      body: strings.errors.networkError,
      nextSteps: [],
      correlationId: null,
    };
  }

  return {
    title: strings.common.unknown,
    body: strings.errors.generic,
    nextSteps: [],
    correlationId: null,
  };
}

/** True when the error is a 4xx ApiError — callers should not retry. */
export function isClientError(error: unknown): boolean {
  return error instanceof ApiError && error.status >= 400 && error.status < 500;
}
