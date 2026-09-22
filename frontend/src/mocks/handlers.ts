/**
 * handlers.ts — Mock Service Worker handlers for UC Governance application.
 *
 * Returns example payloads verbatim from shared/contracts/examples/.
 * Supports ?scenario= parameter:
 * - forbidden: 403 (ErrorResponse.forbidden-role.json)
 * - not-configured: 503 (ErrorResponse.not-configured.json)
 * - validation: 400 (ErrorResponse.validation-failed.json)
 * - unknown-outcome: 202 (OperationResponse.unknown-outcome.json)
 * - slow: 2 second delay
 */
import { delay, http, HttpResponse } from "msw";
import contextFixture from "../../../shared/contracts/examples/ContextResponse.fixture.json";
import errorForbiddenRole from "../../../shared/contracts/examples/ErrorResponse.forbidden-role.json";
import errorNotConfigured from "../../../shared/contracts/examples/ErrorResponse.not-configured.json";
import errorValidationFailed from "../../../shared/contracts/examples/ErrorResponse.validation-failed.json";
import identityFixture from "../../../shared/contracts/examples/IdentityResponse.steward.json";
import operationUnknownOutcome from "../../../shared/contracts/examples/OperationResponse.unknown-outcome.json";

const capabilitiesFixture = {
  success: true,
  data: [
    {
      capability: "securable_grants",
      domain: "access",
      status: "available",
      reason: null,
      requires: ["user_token_scope"],
      checked_at: "2026-09-21T09:00:00Z",
    },
    {
      capability: "abac_policies",
      domain: "policies",
      status: "available",
      reason: null,
      requires: ["sql_warehouse"],
      checked_at: "2026-09-21T09:00:00Z",
    },
    {
      capability: "table_lineage",
      domain: "lineage",
      status: "not_configured",
      reason: "SQL warehouse is not running",
      requires: ["sql_warehouse"],
      checked_at: "2026-09-21T09:00:00Z",
    },
  ],
  meta: {
    source: "fixture",
    observed_at: "2026-09-21T09:00:00Z",
    completeness: "complete",
    limitations: [],
    correlation_id: "c0ffee00-0000-4000-8000-000000000001",
  },
};

async function handleScenario(
  scenario: string | null,
): Promise<Response | null> {
  if (scenario === "slow") {
    await delay(2000);
    return null;
  }
  if (scenario === "forbidden") {
    return HttpResponse.json(errorForbiddenRole, { status: 403 });
  }
  if (scenario === "not-configured") {
    return HttpResponse.json(errorNotConfigured, { status: 503 });
  }
  if (scenario === "validation") {
    return HttpResponse.json(errorValidationFailed, { status: 400 });
  }
  if (scenario === "unknown-outcome") {
    return HttpResponse.json(operationUnknownOutcome, { status: 202 });
  }
  return null;
}

export const handlers = [
  http.get("*/api/v1/context", async ({ request }) => {
    const url = new URL(request.url);
    const scenario = url.searchParams.get("scenario");
    const scenarioRes = await handleScenario(scenario);
    if (scenarioRes) return scenarioRes;

    return HttpResponse.json(contextFixture);
  }),

  http.get("*/api/v1/me", async ({ request }) => {
    const url = new URL(request.url);
    const scenario = url.searchParams.get("scenario");
    const scenarioRes = await handleScenario(scenario);
    if (scenarioRes) return scenarioRes;

    return HttpResponse.json(identityFixture);
  }),

  http.get("*/api/v1/capabilities", async ({ request }) => {
    const url = new URL(request.url);
    const scenario = url.searchParams.get("scenario");
    const scenarioRes = await handleScenario(scenario);
    if (scenarioRes) return scenarioRes;

    return HttpResponse.json(capabilitiesFixture);
  }),
];
