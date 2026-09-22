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
import type { PlanCreateRequest } from "@contracts/types";
import contextFixture from "../../../shared/contracts/examples/ContextResponse.fixture.json";
import errorForbiddenRole from "../../../shared/contracts/examples/ErrorResponse.forbidden-role.json";
import errorNotConfigured from "../../../shared/contracts/examples/ErrorResponse.not-configured.json";
import errorValidationFailed from "../../../shared/contracts/examples/ErrorResponse.validation-failed.json";
import identityFixture from "../../../shared/contracts/examples/IdentityResponse.steward.json";
import operationUnknownOutcome from "../../../shared/contracts/examples/OperationResponse.unknown-outcome.json";
import schemaObjectsFixture from "../../../shared/contracts/examples/AssetListResponse.list-schema-objects.json";
import grantsFixture from "../../../shared/contracts/examples/GrantsResponse.orders-table.json";
import planPreviewFixture from "../../../shared/contracts/examples/PlanResponse.grant-preview.json";

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

const catalogsFixture = {
  success: true,
  data: [
    {
      securable_type: "CATALOG",
      full_name: "sales",
      kind: "catalog",
      display_name: "sales",
      owner: "data-eng-owners",
      comment: "Sales domain data assets including CRM, billing, and orders.",
      updated_at: "2026-09-20T20:00:00Z",
      managed: "managed",
      pipeline_managed: false,
      allowed_actions: [
        { action: "grant", allowed: true },
        { action: "edit_metadata", allowed: true },
      ],
    },
    {
      securable_type: "CATALOG",
      full_name: "analytics",
      kind: "catalog",
      display_name: "analytics",
      owner: "analytics-team",
      comment: "Curated analytics marts and metric tables.",
      updated_at: "2026-09-21T08:00:00Z",
      managed: "managed",
      pipeline_managed: false,
      allowed_actions: [
        { action: "grant", allowed: true },
        { action: "edit_metadata", allowed: false, reason: "Managed externally" },
      ],
    },
    {
      securable_type: "CATALOG",
      full_name: "system",
      kind: "catalog",
      display_name: "system",
      owner: "system",
      comment: "System tables, billing, and audit logs.",
      updated_at: null,
      managed: "not_applicable",
      pipeline_managed: null,
      allowed_actions: [
        { action: "grant", allowed: false, reason: "System catalog access is immutable" },
      ],
    },
  ],
  meta: {
    source: "fixture",
    observed_at: "2026-09-21T09:00:00Z",
    completeness: "complete",
    limitations: [],
    correlation_id: "c0ffee00-0000-4000-8000-000000000010",
  },
  page: { page_size: 50, next_page_token: null },
};

const schemasFixture = {
  success: true,
  data: [
    {
      securable_type: "SCHEMA",
      full_name: "sales.crm",
      kind: "schema",
      display_name: "crm",
      owner: "data-eng-owners",
      comment: "Customer relationship management data and customer profiles.",
      updated_at: "2026-09-20T21:00:00Z",
      managed: "managed",
      pipeline_managed: false,
      allowed_actions: [
        { action: "grant", allowed: true },
        { action: "edit_metadata", allowed: true },
      ],
    },
    {
      securable_type: "SCHEMA",
      full_name: "sales.marketing",
      kind: "schema",
      display_name: "marketing",
      owner: "marketing-lead",
      comment: "Campaigns, leads, and conversion metrics.",
      updated_at: "2026-09-19T14:00:00Z",
      managed: "managed",
      pipeline_managed: false,
      allowed_actions: [
        { action: "grant", allowed: true },
      ],
    },
  ],
  meta: {
    source: "fixture",
    observed_at: "2026-09-21T09:00:00Z",
    scope: { catalog: "sales", schema: null },
    completeness: "complete",
    limitations: [],
    correlation_id: "c0ffee00-0000-4000-8000-000000000011",
  },
  page: { page_size: 50, next_page_token: null },
};

const assetDetailFixture = {
  success: true,
  data: {
    securable_type: "TABLE",
    full_name: "sales.crm.orders",
    kind: "table",
    display_name: "orders",
    owner: "data-eng-owners",
    comment: "One row per customer order. Source: CRM nightly export.",
    updated_at: "2026-09-20T23:10:44Z",
    managed: "managed",
    pipeline_managed: false,
    allowed_actions: [
      { action: "grant", allowed: true },
      { action: "edit_metadata", allowed: true },
      {
        action: "delete",
        allowed: false,
        reason_code: "ROLE_INSUFFICIENT",
        reason: "Only Platform Administrators can delete tables.",
      },
      {
        action: "revoke",
        allowed: false,
        reason_code: "INHERITED_FROM_PARENT",
        reason: "Inherited from parent schema sales.crm",
        navigate_to: "/assets/sales/crm",
      },
    ],
    properties: {
      "delta.autoOptimize.optimizeWrite": "true",
      "delta.enableChangeDataFeed": "true",
    },
    tags: [
      {
        key: "data_tier",
        value: "gold",
        kind: "governed",
        allowed_actions: [{ action: "remove_tag", allowed: true }],
      },
      {
        key: "retention",
        value: "7yr",
        kind: "free_form",
        allowed_actions: [{ action: "remove_tag", allowed: true }],
      },
      {
        key: "sys_lineage_tracked",
        value: "true",
        kind: "system",
        allowed_actions: [
          {
            action: "remove_tag",
            allowed: false,
            reason_code: "SYSTEM_TAG",
            reason: "System tags cannot be removed manually.",
          },
        ],
      },
    ],
    columns: [
      {
        name: "order_id",
        type_text: "string",
        nullable: false,
        comment: "Primary identifier for order event.",
        position: 1,
        tags: [
          {
            key: "primary_key",
            value: "true",
            kind: "governed",
            allowed_actions: [],
          },
        ],
        mask: null,
      },
      {
        name: "customer_id",
        type_text: "string",
        nullable: false,
        comment: "Foreign key to sales.crm.customers.",
        position: 2,
        tags: [],
        mask: {
          column: "customer_id",
          function_full_name: "governance.masks.hash_id",
          using_columns: ["customer_id"],
          attached_via: "direct",
          policy_id: "pol-customer-hash",
        },
      },
      {
        name: "order_date",
        type_text: "timestamp",
        nullable: false,
        comment: "Timestamp order was placed in UTC.",
        position: 3,
        tags: [],
        mask: null,
      },
      {
        name: "total_amount",
        type_text: "decimal(12,2)",
        nullable: false,
        comment: "Final invoice amount in USD.",
        position: 4,
        tags: [],
        mask: null,
      },
      {
        name: "status",
        type_text: "string",
        nullable: true,
        comment: "Order fulfillment status.",
        position: 5,
        tags: [],
        mask: null,
      },
    ],
    row_filter: {
      function_full_name: "governance.policies.region_filter",
      input_columns: ["customer_id"],
      attached_via: "direct",
      policy_id: "pol-region-check",
    },
    view_definition: null,
    storage_location: "dbfs:/user/hive/warehouse/sales.db/crm.db/orders",
    table_type: "MANAGED",
    data_source_format: "DELTA",
    created_at: "2026-01-15T12:00:00Z",
    created_by: "data-eng-lead",
    parent: {
      securable_type: "SCHEMA",
      full_name: "sales.crm",
      kind: "schema",
      display_name: "crm",
    },
    raw: {
      table_id: "tbl-098234-orders",
      metastore_id: "ms-aws-us-west-2",
      table_format: "DELTA",
    },
  },
  meta: {
    source: "fixture",
    observed_at: "2026-09-21T09:00:40Z",
    scope: { catalog: "sales", schema: "crm" },
    completeness: "complete",
    limitations: [
      "Access grants for this object are displayed on the Access tab.",
    ],
    correlation_id: "c0ffee00-0000-4000-8000-000000000012",
  },
};

const dependenciesFixture = {
  success: true,
  data: {
    known: [
      {
        kind: "materialized_view",
        full_name: "sales.crm.orders_daily_mv",
        source: "unity_catalog_api",
        verified: true,
      },
      {
        kind: "view",
        full_name: "analytics.reporting.sales_summary",
        source: "unity_catalog_api",
        verified: false,
      },
    ],
    disclaimer:
      "Missing dependency information is not proof that deletion is safe.",
  },
  meta: {
    source: "fixture",
    observed_at: "2026-09-21T09:00:40Z",
    scope: { catalog: "sales", schema: "crm" },
    completeness: "complete",
    limitations: [],
    correlation_id: "c0ffee00-0000-4000-8000-000000000013",
  },
};

const operationAppliedFixture = {
  success: true,
  data: {
    id: "op-applied-001",
    plan_id: "5f3c9a2e-1b7d-4e0a-9c11-2d6f8a0b1c22",
    kind: "grant",
    status: "applied",
    identity: {
      actor: {
        id: "u-1001",
        display: "alice.steward@example.test",
        kind: "user",
        roles: ["steward", "access_admin"],
        verified_by: "fixture",
      },
      executor: {
        kind: "service_principal",
        display: "uc-governance-app (sp-7f3a…)",
        reason: "The Unity Catalog grants API is not in the user-authorization scope set.",
      },
    },
    started_at: "2026-09-21T09:06:00Z",
    finished_at: "2026-09-21T09:06:05Z",
    atomic: true,
    targets: [
      {
        target: {
          securable_type: "TABLE",
          full_name: "sales.crm.orders",
          kind: "table",
          display_name: "orders",
        },
        status: "applied",
        verified: true,
        verified_at: "2026-09-21T09:06:05Z",
        databricks_request_id: "req-001-abc",
        error: null,
        summary: "Granted SELECT to `marketing-analysts` on sales.crm.orders",
      },
    ],
    reconcile_available: false,
    summary: "Granted SELECT to `marketing-analysts` on sales.crm.orders",
    correlation_id: "c0ffee00-0000-4000-8000-000000000005",
  },
  meta: {
    source: "fixture",
    observed_at: "2026-09-21T09:06:05Z",
    scope: { catalog: "sales", schema: "crm" },
    completeness: "complete",
    limitations: [],
    correlation_id: "c0ffee00-0000-4000-8000-000000000005",
  },
};

const operationPartiallyAppliedFixture = {
  success: true,
  data: {
    id: "op-partial-002",
    plan_id: "5f3c9a2e-1b7d-4e0a-9c11-2d6f8a0b1c22",
    kind: "grant",
    status: "partially_applied",
    identity: {
      actor: {
        id: "u-1001",
        display: "alice.steward@example.test",
        kind: "user",
        roles: ["steward", "access_admin"],
        verified_by: "fixture",
      },
      executor: {
        kind: "service_principal",
        display: "uc-governance-app (sp-7f3a…)",
        reason: "The Unity Catalog grants API is not in the user-authorization scope set.",
      },
    },
    started_at: "2026-09-21T09:06:00Z",
    finished_at: "2026-09-21T09:06:05Z",
    atomic: false,
    targets: [
      {
        target: {
          securable_type: "TABLE",
          full_name: "sales.crm.orders",
          kind: "table",
          display_name: "orders",
        },
        status: "applied",
        verified: true,
        verified_at: "2026-09-21T09:06:05Z",
        databricks_request_id: "req-001-abc",
        error: null,
        summary: "Granted SELECT on sales.crm.orders",
      },
      {
        target: {
          securable_type: "TABLE",
          full_name: "sales.crm.customers",
          kind: "table",
          display_name: "customers",
        },
        status: "failed",
        verified: false,
        verified_at: null,
        databricks_request_id: "req-002-def",
        error: {
          code: "INSUFFICIENT_PRIVILEGES",
          message: "Service principal lacks MANAGE privilege on sales.crm.customers",
        },
        summary: "Failed to grant SELECT on sales.crm.customers",
      },
    ],
    reconcile_available: false,
    summary: "1 target succeeded, 1 target failed.",
    correlation_id: "c0ffee00-0000-4000-8000-000000000005",
  },
  meta: {
    source: "fixture",
    observed_at: "2026-09-21T09:06:05Z",
    scope: { catalog: "sales", schema: "crm" },
    completeness: "partial_visibility",
    limitations: ["Partial grant failure"],
    correlation_id: "c0ffee00-0000-4000-8000-000000000005",
  },
};

const operationFailedFixture = {
  success: true,
  data: {
    id: "op-failed-003",
    plan_id: "5f3c9a2e-1b7d-4e0a-9c11-2d6f8a0b1c22",
    kind: "grant",
    status: "failed",
    identity: {
      actor: {
        id: "u-1001",
        display: "alice.steward@example.test",
        kind: "user",
        roles: ["steward", "access_admin"],
        verified_by: "fixture",
      },
      executor: {
        kind: "service_principal",
        display: "uc-governance-app (sp-7f3a…)",
        reason: "The Unity Catalog grants API is not in the user-authorization scope set.",
      },
    },
    started_at: "2026-09-21T09:06:00Z",
    finished_at: "2026-09-21T09:06:05Z",
    atomic: true,
    targets: [
      {
        target: {
          securable_type: "TABLE",
          full_name: "sales.crm.orders",
          kind: "table",
          display_name: "orders",
        },
        status: "failed",
        verified: false,
        verified_at: null,
        databricks_request_id: "req-003-ghi",
        error: {
          code: "INTERNAL_ERROR",
          message: "Upstream Databricks execution error applying grant.",
        },
        summary: "Failed to apply grant on sales.crm.orders",
      },
    ],
    reconcile_available: false,
    summary: "Failed to apply changes",
    correlation_id: "c0ffee00-0000-4000-8000-000000000005",
  },
  meta: {
    source: "fixture",
    observed_at: "2026-09-21T09:06:05Z",
    scope: { catalog: "sales", schema: "crm" },
    completeness: "unknown",
    limitations: [],
    correlation_id: "c0ffee00-0000-4000-8000-000000000005",
  },
};

const operationDuplicateFixture = {
  success: true,
  data: {
    id: "op-duplicate-123",
    plan_id: "5f3c9a2e-1b7d-4e0a-9c11-2d6f8a0b1c22",
    kind: "grant",
    status: "applied",
    identity: {
      actor: {
        id: "u-1001",
        display: "alice.steward@example.test",
        kind: "user",
        roles: ["steward", "access_admin"],
        verified_by: "fixture",
      },
      executor: {
        kind: "service_principal",
        display: "uc-governance-app (sp-7f3a…)",
        reason: "The Unity Catalog grants API is not in the user-authorization scope set.",
      },
    },
    started_at: "2026-09-21T09:06:00Z",
    finished_at: "2026-09-21T09:06:05Z",
    atomic: true,
    targets: [
      {
        target: {
          securable_type: "TABLE",
          full_name: "sales.crm.orders",
          kind: "table",
          display_name: "orders",
        },
        status: "applied",
        verified: true,
        verified_at: "2026-09-21T09:06:05Z",
        databricks_request_id: "req-dup-001",
        error: null,
        summary: "Already applied for `marketing-analysts` on sales.crm.orders",
      },
    ],
    reconcile_available: false,
    summary: "Existing operation completed.",
    correlation_id: "c0ffee00-0000-4000-8000-000000000006",
  },
  meta: {
    source: "fixture",
    observed_at: "2026-09-21T09:06:05Z",
    scope: { catalog: "sales", schema: "crm" },
    completeness: "complete",
    limitations: [],
    correlation_id: "c0ffee00-0000-4000-8000-000000000006",
  },
};

export const tagsFixture = {
  success: true,
  data: {
    target: {
      securable_type: "TABLE",
      full_name: "sales.crm.orders",
      kind: "table",
      display_name: "orders",
    },
    tags: [
      {
        key: "data_domain",
        value: "finance",
        kind: "free_form",
        allowed_actions: [
          { action: "assign_tag", allowed: true },
          { action: "remove_tag", allowed: true },
        ],
      },
      {
        key: "sensitivity",
        value: "internal",
        kind: "governed",
        allowed_actions: [
          { action: "assign_tag", allowed: true },
          { action: "remove_tag", allowed: true },
        ],
      },
      {
        key: "system.classification",
        value: "orders_table",
        kind: "system",
        allowed_actions: [
          {
            action: "assign_tag",
            allowed: false,
            reason: "System-controlled tags cannot be edited.",
          },
          {
            action: "remove_tag",
            allowed: false,
            reason: "System-controlled tags cannot be edited.",
          },
        ],
      },
    ],
    column_tags: {
      id: [
        {
          key: "pii",
          value: null,
          kind: "governed",
          allowed_actions: [
            { action: "assign_tag", allowed: true },
            { action: "remove_tag", allowed: true },
          ],
        },
      ],
    },
  },
  meta: {
    source: "fixture",
    observed_at: "2026-09-21T09:00:00Z",
    completeness: "complete",
    limitations: [
      "Tags reflect catalog state at observation. Runtime SQL session tags are not shown.",
    ],
    correlation_id: "c0ffee00-0000-4000-8000-000000000031",
  },
};

export const tagPoliciesFixture = {
  success: true,
  data: [
    {
      key: "sensitivity",
      description: "Data confidentiality classification tier",
      allowed_values: ["public", "internal", "confidential", "restricted"],
      allowed_actions: [
        {
          action: "edit",
          allowed: false,
          reason_code: "UNKNOWN",
          reason: "Policy authority could not be determined.",
        },
      ],
    },
    {
      key: "pii",
      description: "Personally identifiable information classification",
      allowed_values: null,
      allowed_actions: [],
    },
    {
      key: "retention",
      description: "Data retention schedule classification",
      allowed_values: [],
      allowed_actions: [],
    },
  ],
  meta: {
    source: "fixture",
    observed_at: "2026-09-21T09:00:00Z",
    completeness: "complete",
    limitations: [],
    correlation_id: "c0ffee00-0000-4000-8000-000000000032",
  },
  page: { page_size: 50, next_page_token: null },
};

export const abacPoliciesFixture = {
  success: true,
  data: [
    {
      id: "fixture-policy-sales-sensitive-rows",
      name: "filter_sales_internal",
      policy_type: "row_filter",
      scope: {
        securable_type: "CATALOG",
        full_name: "sales",
        kind: "catalog",
        display_name: "sales",
      },
      when_condition: "has_tag_value('sensitivity', 'internal')",
      to_principals: ["analysts"],
      except_principals: ["data-eng-owners"],
      function_full_name: "shared_ref.governance.normalize_id",
      match_columns: ["id"],
      owner: "data-eng-owners",
      created_at: "2026-09-20T21:00:00Z",
      updated_at: "2026-09-21T08:00:00Z",
      allowed_actions: [
        { action: "edit", allowed: true },
        { action: "delete", allowed: true },
      ],
    },
  ],
  meta: {
    source: "fixture",
    observed_at: "2026-09-21T09:00:00Z",
    completeness: "complete",
    limitations: [
      "Policy definitions reflect catalog metadata. Effective evaluation depends on SQL compute runtime.",
    ],
    correlation_id: "c0ffee00-0000-4000-8000-000000000033",
  },
  page: { page_size: 50, next_page_token: null },
};

export const abacPolicyImpactFixture = {
  success: true,
  data: {
    disclaimer:
      "Potentially affected within your visible scope. Not evaluated by Databricks.",
    potentially_affected: [
      {
        securable_type: "TABLE",
        full_name: "sales.crm.orders",
        kind: "table",
        display_name: "orders",
        owner: "data-eng-owners",
        comment: "Customer orders transaction table",
        updated_at: "2026-09-20T20:00:00Z",
        managed: "managed",
        pipeline_managed: false,
        allowed_actions: [],
      },
      {
        securable_type: "TABLE",
        full_name: "sales.crm.customers",
        kind: "table",
        display_name: "customers",
        owner: "data-eng-owners",
        comment: "Customer master record table",
        updated_at: "2026-09-20T20:00:00Z",
        managed: "managed",
        pipeline_managed: false,
        allowed_actions: [],
      },
    ],
  },
  meta: {
    source: "fixture",
    observed_at: "2026-09-21T09:00:00Z",
    completeness: "partial_visibility",
    limitations: [
      "Impact was not evaluated by Databricks; this list is an approximation based on metadata.",
      "Objects outside the caller's visible scope are not included.",
    ],
    correlation_id: "c0ffee00-0000-4000-8000-000000000034",
  },
};

export const rowAccessOrdersFixture = {
  success: true,
  data: {
    target: {
      securable_type: "TABLE",
      full_name: "sales.crm.orders",
      kind: "table",
      display_name: "orders",
    },
    row_filter: {
      function_full_name: "shared_ref.governance.normalize_id",
      input_columns: ["id"],
      attached_via: "abac_policy",
      policy_id: "fixture-policy-sales-sensitive-rows",
    },
    column_masks: [],
    allowed_actions: [],
  },
  meta: {
    source: "fixture",
    observed_at: "2026-09-21T09:00:00Z",
    completeness: "complete",
    limitations: [],
    correlation_id: "c0ffee00-0000-4000-8000-000000000035",
  },
};

export const rowAccessCustomersFixture = {
  success: true,
  data: {
    target: {
      securable_type: "TABLE",
      full_name: "sales.crm.customers",
      kind: "table",
      display_name: "customers",
    },
    row_filter: {
      function_full_name: "shared_ref.governance.normalize_id",
      input_columns: ["id"],
      attached_via: "direct",
      policy_id: null,
    },
    column_masks: [
      {
        column: "email",
        function_full_name: "shared_ref.governance.mask_email",
        using_columns: [],
        attached_via: "direct",
        policy_id: null,
      },
    ],
    allowed_actions: [
      { action: "set_row_filter", allowed: true },
      { action: "drop_row_filter", allowed: true },
      { action: "set_column_mask", allowed: true },
      { action: "drop_column_mask", allowed: true },
    ],
  },
  meta: {
    source: "fixture",
    observed_at: "2026-09-21T09:00:00Z",
    completeness: "complete",
    limitations: [],
    correlation_id: "c0ffee00-0000-4000-8000-000000000036",
  },
};

export const functionNormalizeIdFixture = {
  success: true,
  data: {
    full_name: "shared_ref.governance.normalize_id",
    owner: "shared_ref-owners",
    comment: "Normalizes row ID for internal auditing",
    return_type: "BIGINT",
    parameters: [{ name: "id", type_text: "BIGINT", position: 0 }],
    language: "SQL",
    dependents: [
      {
        kind: "downstream_table",
        full_name: "sales.crm.orders",
        source: "unity_catalog_api",
        verified: true,
      },
    ],
    used_as_policy_function: true,
    allowed_actions: [],
  },
  meta: {
    source: "fixture",
    observed_at: "2026-09-21T09:00:00Z",
    completeness: "complete",
    limitations: [],
    correlation_id: "c0ffee00-0000-4000-8000-000000000037",
  },
};

export const functionMaskEmailFixture = {
  success: true,
  data: {
    full_name: "shared_ref.governance.mask_email",
    owner: "shared_ref-owners",
    comment: "Masks customer email addresses according to PII rules",
    return_type: "STRING",
    parameters: [{ name: "email", type_text: "STRING", position: 0 }],
    language: "SQL",
    dependents: [
      {
        kind: "downstream_table",
        full_name: "sales.crm.customers",
        source: "unity_catalog_api",
        verified: true,
      },
    ],
    used_as_policy_function: true,
    allowed_actions: [],
  },
  meta: {
    source: "fixture",
    observed_at: "2026-09-21T09:00:00Z",
    completeness: "complete",
    limitations: [],
    correlation_id: "c0ffee00-0000-4000-8000-000000000038",
  },
};

export type EndpointKind = "read" | "plan" | "execute" | "operation";

export async function handleScenario(
  scenario: string | null,
  endpointKind: EndpointKind,
): Promise<Response | null> {
  // Transport-level scenarios apply to all endpoints
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
  if (scenario === "not-found") {
    return HttpResponse.json(
      {
        success: false,
        code: "NOT_FOUND",
        message: "Not found or not visible to the application.",
        correlation_id: "c0ffee00-0000-4000-8000-000000000099",
        next_steps: ["Verify the asset name and scope."],
      },
      { status: 404 },
    );
  }
  if (scenario === "error") {
    return HttpResponse.json(
      {
        success: false,
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred while querying Unity Catalog.",
        correlation_id: "c0ffee00-0000-4000-8000-000000000088",
        next_steps: ["Retry the request.", "Contact support if the issue persists."],
      },
      { status: 500 },
    );
  }

  // Mutation-lifecycle scenarios: read endpoints ignore these and serve normal payloads
  if (endpointKind === "read") {
    return null;
  }

  // Plan creation & lifecycle scenarios (POST /plans, GET /plans/:id)
  if (endpointKind === "plan") {
    if (scenario === "stale") {
      return HttpResponse.json(
        {
          success: false,
          code: "PLAN_STALE",
          message: "The state changed since this preview was generated.",
          correlation_id: "c0ffee00-0000-4000-8000-000000000041",
          next_steps: ["Regenerate the preview before applying this change."],
        },
        { status: 409 },
      );
    }
    if (scenario === "expired") {
      return HttpResponse.json(
        {
          success: false,
          code: "PLAN_EXPIRED",
          message: "This preview has expired.",
          correlation_id: "c0ffee00-0000-4000-8000-000000000042",
          next_steps: ["Regenerate the preview before applying this change."],
        },
        { status: 409 },
      );
    }
    if (scenario === "invalidated") {
      return HttpResponse.json(
        {
          success: false,
          code: "PLAN_INVALIDATED",
          message: "This preview has been invalidated.",
          correlation_id: "c0ffee00-0000-4000-8000-000000000043",
          next_steps: ["Regenerate the preview."],
        },
        { status: 409 },
      );
    }
    if (scenario === "duplicate") {
      return HttpResponse.json(
        {
          success: false,
          code: "DUPLICATE_SUBMISSION",
          message: "An operation already exists for this preview.",
          correlation_id: "c0ffee00-0000-4000-8000-000000000044",
          next_steps: ["Open the existing operation instead of submitting again."],
          errors: [{ field: "operation_id", code: "DUPLICATE", message: "op-duplicate-123" }],
        },
        { status: 409 },
      );
    }
    return null;
  }

  // Plan execution scenarios (POST /plans/:id/execute)
  if (endpointKind === "execute") {
    if (scenario === "unknown-outcome") {
      return HttpResponse.json(operationUnknownOutcome, { status: 202 });
    }
    if (scenario === "stale") {
      return HttpResponse.json(
        {
          success: false,
          code: "PLAN_STALE",
          message: "The state changed since this preview was generated.",
          correlation_id: "c0ffee00-0000-4000-8000-000000000041",
          next_steps: ["Regenerate the preview before applying this change."],
        },
        { status: 409 },
      );
    }
    if (scenario === "expired") {
      return HttpResponse.json(
        {
          success: false,
          code: "PLAN_EXPIRED",
          message: "This preview has expired.",
          correlation_id: "c0ffee00-0000-4000-8000-000000000042",
          next_steps: ["Regenerate the preview before applying this change."],
        },
        { status: 409 },
      );
    }
    if (scenario === "invalidated") {
      return HttpResponse.json(
        {
          success: false,
          code: "PLAN_INVALIDATED",
          message: "This preview has been invalidated.",
          correlation_id: "c0ffee00-0000-4000-8000-000000000043",
          next_steps: ["Regenerate the preview."],
        },
        { status: 409 },
      );
    }
    if (scenario === "duplicate") {
      return HttpResponse.json(
        {
          success: false,
          code: "DUPLICATE_SUBMISSION",
          message: "An operation already exists for this preview.",
          correlation_id: "c0ffee00-0000-4000-8000-000000000044",
          next_steps: ["Open the existing operation instead of submitting again."],
          errors: [{ field: "operation_id", code: "DUPLICATE", message: "op-duplicate-123" }],
        },
        { status: 409 },
      );
    }
    return null;
  }

  // Operation lifecycle scenarios (GET /operations/:id, POST /operations/:id/reconcile)
  if (endpointKind === "operation") {
    return null;
  }

  return null;
}

export const handlers = [
  http.get("*/api/v1/context", async ({ request }) => {
    const url = new URL(request.url);
    const scenario = url.searchParams.get("scenario");
    const scenarioRes = await handleScenario(scenario, "read");
    if (scenarioRes) return scenarioRes;

    return HttpResponse.json(contextFixture);
  }),

  http.get("*/api/v1/me", async ({ request }) => {
    const url = new URL(request.url);
    const scenario = url.searchParams.get("scenario");
    const scenarioRes = await handleScenario(scenario, "read");
    if (scenarioRes) return scenarioRes;

    return HttpResponse.json(identityFixture);
  }),

  http.get("*/api/v1/capabilities", async ({ request }) => {
    const url = new URL(request.url);
    const scenario = url.searchParams.get("scenario");
    const scenarioRes = await handleScenario(scenario, "read");
    if (scenarioRes) return scenarioRes;

    return HttpResponse.json(capabilitiesFixture);
  }),

  http.get("*/api/v1/catalogs", async ({ request }) => {
    const url = new URL(request.url);
    const scenario = url.searchParams.get("scenario");
    const scenarioRes = await handleScenario(scenario, "read");
    if (scenarioRes) return scenarioRes;

    if (scenario === "empty") {
      return HttpResponse.json({
        ...catalogsFixture,
        data: [],
      });
    }

    const q = url.searchParams.get("query")?.toLowerCase();
    if (q) {
      return HttpResponse.json({
        ...catalogsFixture,
        data: catalogsFixture.data.filter(
          (c) =>
            c.display_name.toLowerCase().includes(q) ||
            c.full_name.toLowerCase().includes(q),
        ),
      });
    }

    return HttpResponse.json(catalogsFixture);
  }),

  http.get("*/api/v1/catalogs/:catalog/schemas", async ({ request, params }) => {
    const url = new URL(request.url);
    const scenario = url.searchParams.get("scenario");
    const scenarioRes = await handleScenario(scenario, "read");
    if (scenarioRes) return scenarioRes;

    if (scenario === "empty") {
      return HttpResponse.json({
        ...schemasFixture,
        data: [],
        meta: {
          ...schemasFixture.meta,
          scope: { catalog: String(params.catalog), schema: null },
        },
      });
    }

    const q = url.searchParams.get("query")?.toLowerCase();
    if (q) {
      return HttpResponse.json({
        ...schemasFixture,
        data: schemasFixture.data.filter(
          (s) =>
            s.display_name.toLowerCase().includes(q) ||
            s.full_name.toLowerCase().includes(q),
        ),
      });
    }

    return HttpResponse.json(schemasFixture);
  }),

  http.get("*/api/v1/schemas/:catalog/:schema/objects", async ({ request }) => {
    const url = new URL(request.url);
    const scenario = url.searchParams.get("scenario");
    const scenarioRes = await handleScenario(scenario, "read");
    if (scenarioRes) return scenarioRes;

    if (scenario === "empty") {
      return HttpResponse.json({
        ...schemaObjectsFixture,
        data: [],
      });
    }

    if (scenario === "partial") {
      return HttpResponse.json({
        ...schemaObjectsFixture,
        meta: {
          ...schemaObjectsFixture.meta,
          completeness: "partial_visibility",
          limitations: ["Only partial metadata available in this scope."],
        },
      });
    }

    const q = url.searchParams.get("query")?.toLowerCase();
    if (q) {
      return HttpResponse.json({
        ...schemaObjectsFixture,
        data: schemaObjectsFixture.data.filter(
          (o) =>
            o.display_name.toLowerCase().includes(q) ||
            o.full_name.toLowerCase().includes(q),
        ),
      });
    }

    return HttpResponse.json(schemaObjectsFixture);
  }),

  http.get("*/api/v1/assets/:securable_type/:full_name/dependencies", async ({ request }) => {
    const url = new URL(request.url);
    const scenario = url.searchParams.get("scenario");
    const scenarioRes = await handleScenario(scenario, "read");
    if (scenarioRes) return scenarioRes;

    if (scenario === "empty") {
      return HttpResponse.json({
        ...dependenciesFixture,
        data: {
          ...dependenciesFixture.data,
          known: [],
        },
      });
    }

    return HttpResponse.json(dependenciesFixture);
  }),

  http.get("*/api/v1/assets/:securable_type/:full_name/grants", async ({ request }) => {
    const url = new URL(request.url);
    const scenario = url.searchParams.get("scenario");
    const scenarioRes = await handleScenario(scenario, "read");
    if (scenarioRes) return scenarioRes;

    if (scenario === "empty") {
      return HttpResponse.json({
        ...grantsFixture,
        data: {
          ...grantsFixture.data,
          direct: [],
          inherited: [],
        },
      });
    }

    if (scenario === "unknown-privilege") {
      return HttpResponse.json({
        ...grantsFixture,
        data: {
          ...grantsFixture.data,
          direct: [
            ...grantsFixture.data.direct,
            {
              principal: "auditors",
              principal_kind: "group",
              privilege: "CUSTOM_UNKNOWN_PRIVILEGE",
              source: {
                type: "direct",
                securable_type: "TABLE",
                full_name: "sales.crm.orders",
              },
              allowed_actions: [],
            },
          ],
        },
      });
    }

    return HttpResponse.json(grantsFixture);
  }),

  http.get("*/api/v1/privileges", async ({ request }) => {
    const url = new URL(request.url);
    const scenario = url.searchParams.get("scenario");
    const scenarioRes = await handleScenario(scenario, "read");
    if (scenarioRes) return scenarioRes;

    return HttpResponse.json({
      success: true,
      data: [
        {
          code: "SELECT",
          label: "Read data",
          description: "Read data on the listed securable types.",
          category: "read",
          securable_types: ["TABLE", "VIEW"],
          prerequisites: ["USE_CATALOG", "USE_SCHEMA"],
        },
        {
          code: "MODIFY",
          label: "Modify data",
          description: "Modify data on the listed securable types.",
          category: "write",
          securable_types: ["TABLE"],
          prerequisites: ["USE_CATALOG", "USE_SCHEMA"],
        },
        {
          code: "USE_CATALOG",
          label: "Use catalog",
          description: "Use this catalog as a parent prerequisite.",
          category: "use",
          securable_types: ["CATALOG"],
          prerequisites: [],
        },
        {
          code: "USE_SCHEMA",
          label: "Use schema",
          description: "Use this schema as a parent prerequisite.",
          category: "use",
          securable_types: ["SCHEMA"],
          prerequisites: ["USE_CATALOG"],
        },
      ],
      meta: {
        source: "fixture",
        observed_at: "2026-09-21T09:00:00Z",
        completeness: "complete",
        limitations: [
          "Privilege codes follow SDK 0.140.0. Applicability is a versioned catalogue; runtime grant authority is not inferred.",
        ],
        correlation_id: "c0ffee00-0000-4000-8000-000000000020",
      },
    });
  }),

  // Tags endpoints (P2-01 / P2-06)
  http.get("*/api/v1/assets/:securable_type/:full_name/tags", async ({ request }) => {
    const url = new URL(request.url);
    const scenario = url.searchParams.get("scenario");
    const scenarioRes = await handleScenario(scenario, "read");
    if (scenarioRes) return scenarioRes;

    return HttpResponse.json(tagsFixture);
  }),

  http.get("*/api/v1/tag-policies", async ({ request }) => {
    const url = new URL(request.url);
    const scenario = url.searchParams.get("scenario");
    const scenarioRes = await handleScenario(scenario, "read");
    if (scenarioRes) return scenarioRes;

    return HttpResponse.json(tagPoliciesFixture);
  }),

  // ABAC policies endpoints (P2-03 / P2-06)
  http.get("*/api/v1/abac-policies", async ({ request }) => {
    const url = new URL(request.url);
    const scenario = url.searchParams.get("scenario");
    const scenarioRes = await handleScenario(scenario, "read");
    if (scenarioRes) return scenarioRes;

    return HttpResponse.json(abacPoliciesFixture);
  }),

  http.get("*/api/v1/abac-policies/:policy_id/impact", async ({ request }) => {
    const url = new URL(request.url);
    const scenario = url.searchParams.get("scenario");
    const scenarioRes = await handleScenario(scenario, "read");
    if (scenarioRes) return scenarioRes;

    return HttpResponse.json(abacPolicyImpactFixture);
  }),

  http.get("*/api/v1/abac-policies/:policy_id", async ({ request, params }) => {
    const url = new URL(request.url);
    const scenario = url.searchParams.get("scenario");
    const scenarioRes = await handleScenario(scenario, "read");
    if (scenarioRes) return scenarioRes;

    const policy =
      abacPoliciesFixture.data.find((p) => p.id === params.policy_id) ||
      abacPoliciesFixture.data[0];

    return HttpResponse.json({
      success: true,
      data: policy,
      meta: abacPoliciesFixture.meta,
    });
  }),

  // Row filters & column masks endpoints (P2-04 / P2-06)
  http.get("*/api/v1/assets/TABLE/:full_name/row-access", async ({ request, params }) => {
    const url = new URL(request.url);
    const scenario = url.searchParams.get("scenario");
    const scenarioRes = await handleScenario(scenario, "read");
    if (scenarioRes) return scenarioRes;

    const fullName = params.full_name as string;
    if (fullName === "sales.crm.customers") {
      return HttpResponse.json(rowAccessCustomersFixture);
    }
    return HttpResponse.json(rowAccessOrdersFixture);
  }),

  http.get("*/api/v1/functions/:full_name", async ({ request, params }) => {
    const url = new URL(request.url);
    const scenario = url.searchParams.get("scenario");
    const scenarioRes = await handleScenario(scenario, "read");
    if (scenarioRes) return scenarioRes;

    const fullName = params.full_name as string;
    if (fullName === "shared_ref.governance.mask_email") {
      return HttpResponse.json(functionMaskEmailFixture);
    }
    return HttpResponse.json(functionNormalizeIdFixture);
  }),

  http.get("*/api/v1/assets/:securable_type/:full_name", async ({ request }) => {
    const url = new URL(request.url);
    const scenario = url.searchParams.get("scenario");
    const scenarioRes = await handleScenario(scenario, "read");
    if (scenarioRes) return scenarioRes;

    if (scenario === "unknown-enum") {
      return HttpResponse.json({
        ...assetDetailFixture,
        data: {
          ...assetDetailFixture.data,
          kind: "custom_tensor_stream",
          managed: "custom_managed_type",
        },
      });
    }

    return HttpResponse.json(assetDetailFixture);
  }),

  // Plans & Operations handlers (P1-08)
  http.post("*/api/v1/plans", async ({ request }) => {
    const url = new URL(request.url);
    const scenario = url.searchParams.get("scenario");
    const scenarioRes = await handleScenario(scenario, "plan");
    if (scenarioRes) return scenarioRes;

    let body: Partial<PlanCreateRequest> = {};
    try {
      body = (await request.json()) as Partial<PlanCreateRequest>;
    } catch {
      // ignore
    }

    if (scenario === "typed-confirmation") {
      return HttpResponse.json(
        {
          ...planPreviewFixture,
          data: {
            ...planPreviewFixture.data,
            requires_typed_confirmation: true,
            typed_confirmation_value: "sales.crm.orders",
          },
        },
        { status: 201 },
      );
    }

    if (body.kind === "transfer_ownership") {
      const targetName = body.targets?.[0]?.full_name || "sales.crm.orders";
      const newOwner = (body.changes as Record<string, unknown> | undefined)?.new_owner as string || "analysts";
      return HttpResponse.json(
        {
          ...planPreviewFixture,
          data: {
            ...planPreviewFixture.data,
            kind: "transfer_ownership",
            targets: body.targets || [
              {
                securable_type: "TABLE",
                full_name: targetName,
                kind: "table",
                display_name: "orders",
              },
            ],
            normalized_changes: [
              {
                target: body.targets?.[0] || {
                  securable_type: "TABLE",
                  full_name: targetName,
                  kind: "table",
                  display_name: "orders",
                },
                description: `Transfer ownership of TABLE ${targetName} to ${newOwner}`,
                statement_preview: `ALTER TABLE \`${targetName.replace(/\./g, "`.`")}\` SET OWNER TO \`${newOwner}\``,
              },
            ],
            requires_typed_confirmation: true,
            typed_confirmation_value: targetName,
          },
        },
        { status: 201 },
      );
    }

    if (body.kind === "drop_row_filter" || body.kind === "drop_column_mask") {
      const targetName = body.targets?.[0]?.full_name || "sales.crm.customers";
      const colName = ((body.changes as Record<string, unknown> | undefined)?.column as string) || "email";
      return HttpResponse.json(
        {
          ...planPreviewFixture,
          data: {
            ...planPreviewFixture.data,
            kind: body.kind,
            targets: body.targets || [
              {
                securable_type: "TABLE",
                full_name: targetName,
                kind: "table",
                display_name: "customers",
              },
            ],
            normalized_changes: [
              {
                target: body.targets?.[0] || {
                  securable_type: "TABLE",
                  full_name: targetName,
                  kind: "table",
                  display_name: "customers",
                },
                description:
                  body.kind === "drop_row_filter"
                    ? `Drop row filter from ${targetName}`
                    : `Drop column mask on column ${colName} from ${targetName}`,
                statement_preview:
                  body.kind === "drop_row_filter"
                    ? `ALTER TABLE \`${targetName.replace(/\./g, "`.`")}\` DROP ROW FILTER`
                    : `ALTER TABLE \`${targetName.replace(/\./g, "`.`")}\` ALTER COLUMN \`${colName}\` DROP MASK`,
              },
            ],
            impact: {
              known: [`Data in ${targetName} may become visible to table readers.`],
              unknown: [
                "Downstream queries and users cannot enumerate without live query execution",
                "No query was run",
              ],
            },
            requires_typed_confirmation: true,
            typed_confirmation_value: targetName,
          },
        },
        { status: 201 },
      );
    }

    if (body.kind === "delete_abac_policy") {
      return HttpResponse.json(
        {
          ...planPreviewFixture,
          data: {
            ...planPreviewFixture.data,
            kind: "delete_abac_policy",
            normalized_changes: [
              {
                target: body.targets?.[0] || {
                  securable_type: "CATALOG",
                  full_name: "sales",
                  kind: "catalog",
                  display_name: "sales",
                },
                description: "Delete ABAC policy filter_sales_internal",
                statement_preview: "DROP POLICY filter_sales_internal",
              },
            ],
            requires_typed_confirmation: true,
            typed_confirmation_value: "sales",
          },
        },
        { status: 201 },
      );
    }

    const responseData = {
      ...planPreviewFixture.data,
      ...(body.kind ? { kind: body.kind } : {}),
      ...(body.targets ? { targets: body.targets } : {}),
    };

    return HttpResponse.json(
      {
        ...planPreviewFixture,
        data: responseData,
      },
      { status: 201 },
    );
  }),

  http.get("*/api/v1/plans/:plan_id", async ({ request, params }) => {
    const url = new URL(request.url);
    const scenario = url.searchParams.get("scenario");
    const scenarioRes = await handleScenario(scenario, "plan");
    if (scenarioRes) return scenarioRes;

    return HttpResponse.json({
      ...planPreviewFixture,
      data: {
        ...planPreviewFixture.data,
        id: params.plan_id as string,
      },
    });
  }),

  http.post("*/api/v1/plans/:plan_id/execute", async ({ request }) => {
    const url = new URL(request.url);
    const scenario = url.searchParams.get("scenario");
    const scenarioRes = await handleScenario(scenario, "execute");
    if (scenarioRes) return scenarioRes;

    if (scenario === "unknown-outcome") {
      return HttpResponse.json(operationUnknownOutcome, { status: 202 });
    }
    if (scenario === "partially-applied") {
      return HttpResponse.json(operationPartiallyAppliedFixture, { status: 200 });
    }
    if (scenario === "failed") {
      return HttpResponse.json(operationFailedFixture, { status: 200 });
    }
    if (scenario === "applied") {
      return HttpResponse.json(operationAppliedFixture, { status: 200 });
    }

    return HttpResponse.json(operationAppliedFixture, { status: 200 });
  }),

  http.get("*/api/v1/operations/:operation_id", async ({ request, params }) => {
    const url = new URL(request.url);
    const scenario = url.searchParams.get("scenario");
    const scenarioRes = await handleScenario(scenario, "operation");
    if (scenarioRes) return scenarioRes;

    if (params.operation_id === "op-duplicate-123" || scenario === "duplicate") {
      return HttpResponse.json(operationDuplicateFixture, { status: 200 });
    }
    if (scenario === "unknown-outcome") {
      return HttpResponse.json(operationUnknownOutcome, { status: 200 });
    }

    return HttpResponse.json(operationAppliedFixture, { status: 200 });
  }),

  http.post("*/api/v1/operations/:operation_id/reconcile", async ({ request }) => {
    const url = new URL(request.url);
    const scenario = url.searchParams.get("scenario");
    const scenarioRes = await handleScenario(scenario, "operation");
    if (scenarioRes) return scenarioRes;

    return HttpResponse.json({
      ...operationAppliedFixture,
      data: {
        ...operationAppliedFixture.data,
        status: "applied",
        summary: "Operation reconciled: SELECT granted on sales.crm.orders",
        reconcile_available: false,
      },
    });
  }),
];
