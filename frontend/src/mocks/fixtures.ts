/**
 * fixtures.ts — Mock fixtures for Phase 2 governance endpoints.
 *
 * Single source of truth for mock data consumed by MSW handlers and unit tests.
 */
import type {
  AbacPolicy,
  FunctionDetail,
  PolicyImpactData,
  RowAccessData,
  SuccessResponse,
  PagedResponse,
  TagPolicy,
  TagsData,
} from "@contracts/types";

export const tagsFixture: SuccessResponse<TagsData> = {
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

export const tagPoliciesFixture: PagedResponse<TagPolicy> = {
  success: true,
  data: [
    {
      key: "sensitivity",
      description: "Data confidentiality classification tier",
      allowed_values: ["public", "internal", "confidential", "restricted"],
      allowed_actions: [
        {
          action: "edit_metadata",
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

export const abacPoliciesFixture: PagedResponse<AbacPolicy> = {
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
        { action: "edit_metadata", allowed: true },
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

export const abacPolicyImpactFixture: SuccessResponse<PolicyImpactData> = {
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

export const rowAccessOrdersFixture: SuccessResponse<RowAccessData> = {
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

export const rowAccessCustomersFixture: SuccessResponse<RowAccessData> = {
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

export const functionNormalizeIdFixture: SuccessResponse<FunctionDetail> = {
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

export const functionMaskEmailFixture: SuccessResponse<FunctionDetail> = {
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
