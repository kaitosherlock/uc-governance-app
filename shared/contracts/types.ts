/**
 * SHARED CONTRACT TYPES — mirror of shared/contracts/api-spec.yaml (v1.0.0).
 *
 * Rules
 * - api-spec.yaml is canonical. This file is the hand-maintained TypeScript mirror so the
 *   Frontend Coder can import types on day one. Change both files in the same edit, or the
 *   `npm run contract:check` script (see shared/contracts/README.md) fails.
 * - Backend (Python) does NOT import this file; it mirrors the same names in pydantic models and
 *   is checked against api-spec.yaml by schemathesis + a path-parity test.
 * - Never redeclare these shapes elsewhere. Frontend feature code imports from
 *   `@contracts/types` (path alias to this file).
 * - snake_case field names are intentional: they match the wire format exactly.
 */

// ---------------------------------------------------------------- envelope

export type ErrorCode =
  | 'VALIDATION_FAILED'
  | 'UNAUTHENTICATED'
  | 'IDENTITY_MISMATCH'
  | 'FORBIDDEN_ROLE'
  | 'FORBIDDEN_SCOPE'
  | 'MODE_READ_ONLY'
  | 'INSUFFICIENT_PRIVILEGES'
  | 'SOD_VIOLATION'
  | 'NOT_FOUND'
  | 'PLAN_STALE'
  | 'PLAN_EXPIRED'
  | 'PLAN_TAMPERED'
  | 'PLAN_INVALIDATED'
  | 'DUPLICATE_SUBMISSION'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'NOT_IMPLEMENTED'
  | 'UNSUPPORTED'
  | 'NOT_CONFIGURED'
  | 'UPSTREAM_UNAVAILABLE'
  | 'OUTCOME_UNKNOWN';

/** HTTP status the backend uses for each code. Frontend uses this only for tests. */
export const ERROR_HTTP_STATUS: Record<Exclude<ErrorCode, 'OUTCOME_UNKNOWN'>, number> = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  IDENTITY_MISMATCH: 401,
  FORBIDDEN_ROLE: 403,
  FORBIDDEN_SCOPE: 403,
  MODE_READ_ONLY: 403,
  INSUFFICIENT_PRIVILEGES: 403,
  SOD_VIOLATION: 403,
  NOT_FOUND: 404,
  PLAN_STALE: 409,
  PLAN_EXPIRED: 409,
  PLAN_TAMPERED: 409,
  PLAN_INVALIDATED: 409,
  DUPLICATE_SUBMISSION: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  UNSUPPORTED: 501,
  NOT_CONFIGURED: 503,
  UPSTREAM_UNAVAILABLE: 503,
};

export interface FieldError {
  field: string;
  code: string;
  message: string;
}

export interface ErrorResponse {
  success: false;
  code: ErrorCode;
  message: string;
  correlation_id: string;
  next_steps?: string[];
  errors?: FieldError[];
}

export type DataSource =
  | 'unity_catalog_api'
  | 'account_api'
  | 'system_table'
  | 'durable_store'
  | 'application'
  | 'fixture';

export type Completeness = 'complete' | 'truncated' | 'partial_visibility' | 'unknown';

export interface Meta {
  source: DataSource;
  /** ISO 8601 UTC */
  observed_at: string;
  scope?: { catalog: string | null; schema: string | null } | null;
  completeness: Completeness;
  limitations: string[];
  correlation_id: string;
}

export interface Page {
  page_size: number;
  next_page_token: string | null;
}

export interface SuccessResponse<T> {
  success: true;
  data: T;
  meta: Meta;
}

export interface PagedResponse<T> extends SuccessResponse<T[]> {
  page: Page;
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;
export type ApiPagedResponse<T> = PagedResponse<T> | ErrorResponse;

// ---------------------------------------------------------------- context & identity

export type AppMode = 'fixture' | 'connected_readonly' | 'connected';
export type ModeLabel = 'Demo — synthetic data' | 'Read-only' | 'Editing enabled';

export interface Context {
  mode: AppMode;
  mode_label: ModeLabel;
  environment_label: string;
  workspace_host: string;
  workspace_id: string | null;
  managed_catalogs: string[];
  support_contact: string | null;
  bootstrap_allowlist_active: boolean;
  warehouse_configured: boolean;
  durable_store_configured: boolean;
  account_client_configured: boolean;
}

export type AppRole = 'viewer' | 'steward' | 'access_admin' | 'auditor' | 'platform_admin';
export type ActorKind = 'user' | 'service_principal';

export interface Actor {
  id: string;
  display: string;
  kind: ActorKind;
  roles: AppRole[];
  verified_by: 'user_token' | 'cli_profile' | 'fixture';
}

export interface Executor {
  kind: 'service_principal' | 'user' | 'account_service_principal';
  display: string;
  reason: string;
}

export interface Identity {
  actor: Actor;
  executor: Executor;
}

export type CapabilityStatusValue =
  | 'available'
  | 'not_configured'
  | 'insufficient_permissions'
  | 'unsupported_in_environment'
  | 'not_implemented'
  | 'temporarily_unavailable'
  | 'unknown';

export type CapabilityRequirement =
  | 'sql_warehouse'
  | 'durable_store'
  | 'account_client'
  | 'user_token_scope';

export interface Capability {
  capability: string;
  domain: string;
  status: CapabilityStatusValue;
  reason: string | null;
  requires: CapabilityRequirement[];
  checked_at: string;
}

// ---------------------------------------------------------------- assets

export type SecurableType =
  | 'METASTORE'
  | 'CATALOG'
  | 'SCHEMA'
  | 'TABLE'
  | 'VOLUME'
  | 'FUNCTION'
  | 'REGISTERED_MODEL'
  | 'STORAGE_CREDENTIAL'
  | 'CREDENTIAL'
  | 'EXTERNAL_LOCATION'
  | 'CONNECTION'
  | 'SHARE'
  | 'RECIPIENT'
  | 'PROVIDER';

export type ObjectKind =
  | 'metastore'
  | 'catalog'
  | 'schema'
  | 'table'
  | 'view'
  | 'materialized_view'
  | 'streaming_table'
  | 'volume'
  | 'function'
  | 'registered_model'
  | 'model_version';

export type ManagedStatus = 'managed' | 'external' | 'not_applicable' | 'unknown';

export type ActionName =
  | 'grant'
  | 'revoke'
  | 'transfer_ownership'
  | 'edit_metadata'
  | 'delete'
  | 'assign_tag'
  | 'remove_tag'
  | 'set_row_filter'
  | 'drop_row_filter'
  | 'set_column_mask'
  | 'drop_column_mask'
  | 'replace_view_definition'
  | 'update_binding'
  | 'validate'
  | 'create_quality_monitor'
  | 'refresh_quality_monitor'
  | 'request_access';

export type ActionReasonCode =
  | 'INHERITED_FROM_PARENT'
  | 'ROLE_INSUFFICIENT'
  | 'MODE_READ_ONLY'
  | 'NOT_IMPLEMENTED'
  | 'NOT_CONFIGURED'
  | 'UNSUPPORTED_FOR_TYPE'
  | 'PIPELINE_MANAGED'
  | 'SYSTEM_TAG'
  | 'OUT_OF_SCOPE'
  | 'INSUFFICIENT_PRIVILEGES'
  | 'UNKNOWN';

export interface AllowedAction {
  action: ActionName;
  allowed: boolean;
  reason_code?: ActionReasonCode | null;
  reason?: string | null;
  navigate_to?: string | null;
}

export interface AssetRef {
  securable_type: SecurableType;
  full_name: string;
  kind: ObjectKind;
  display_name: string;
}

export interface AssetSummary extends AssetRef {
  owner: string | null;
  comment: string | null;
  updated_at: string | null;
  managed: ManagedStatus;
  pipeline_managed: boolean | null;
  allowed_actions: AllowedAction[];
}

export type TagKind = 'free_form' | 'governed' | 'system';

export interface Tag {
  key: string;
  value: string | null;
  kind: TagKind;
  allowed_actions: AllowedAction[];
}

export type AttachmentSource = 'direct' | 'abac_policy' | 'unknown';

export interface RowFilterRef {
  function_full_name: string;
  input_columns: string[];
  attached_via: AttachmentSource;
  policy_id?: string | null;
}

export interface ColumnMaskRef {
  column: string;
  function_full_name: string;
  using_columns: string[];
  attached_via: AttachmentSource;
  policy_id?: string | null;
}

export interface Column {
  name: string;
  type_text: string;
  nullable: boolean | null;
  comment: string | null;
  position: number;
  tags: Tag[];
  mask: ColumnMaskRef | null;
}

export interface AssetDetail extends AssetSummary {
  properties: Record<string, string>;
  tags: Tag[];
  columns: Column[];
  row_filter: RowFilterRef | null;
  view_definition: string | null;
  storage_location: string | null;
  table_type: string | null;
  data_source_format: string | null;
  created_at: string | null;
  created_by: string | null;
  parent: AssetRef | null;
  raw: Record<string, unknown>;
}

export type DependencyKind =
  | 'view'
  | 'materialized_view'
  | 'streaming_table'
  | 'downstream_table'
  | 'foreign_catalog'
  | 'share'
  | 'policy_function'
  | 'quality_monitor'
  | 'model_version'
  | 'unknown';

export interface Dependency {
  kind: DependencyKind;
  full_name: string;
  source: DataSource;
  verified: boolean;
}

export interface DependenciesData {
  known: Dependency[];
  disclaimer: string;
}

// ---------------------------------------------------------------- principals

export type PrincipalKind = 'user' | 'group' | 'service_principal';
export type PrincipalScope = 'account' | 'workspace_local' | 'unknown';

export interface Principal {
  name: string;
  display: string;
  kind: PrincipalKind;
  scope: PrincipalScope;
  uc_eligible: boolean;
  id: string | null;
}

// ---------------------------------------------------------------- grants

export type PrivilegeCategory =
  | 'browse'
  | 'use'
  | 'read'
  | 'write'
  | 'create'
  | 'manage'
  | 'all'
  | 'object_specific';

export interface Privilege {
  code: string;
  label: string;
  description: string;
  category: PrivilegeCategory;
  securable_types: SecurableType[];
  prerequisites: string[];
}

export type GrantSourceType = 'direct' | 'inherited' | 'unknown';

export interface GrantSource {
  type: GrantSourceType;
  securable_type: SecurableType | null;
  full_name: string | null;
}

export interface Grant {
  principal: string;
  principal_kind: PrincipalKind | null;
  privilege: string;
  source: GrantSource;
  allowed_actions: AllowedAction[];
}

export interface GrantsData {
  target: AssetRef;
  owner: string | null;
  direct: Grant[];
  inherited: Grant[];
  group_membership_loaded: boolean;
}

// ---------------------------------------------------------------- tags

export interface TagsData {
  target: AssetRef;
  tags: Tag[];
  column_tags: Record<string, Tag[]>;
}

export interface TagPolicy {
  key: string;
  description: string | null;
  allowed_values: string[] | null;
  allowed_actions: AllowedAction[];
}

// ---------------------------------------------------------------- plans & operations

export type PlanKind =
  | 'grant'
  | 'revoke'
  | 'transfer_ownership'
  | 'edit_metadata'
  | 'assign_tags'
  | 'remove_tags'
  | 'set_row_filter'
  | 'drop_row_filter'
  | 'set_column_mask'
  | 'drop_column_mask'
  | 'replace_view_definition'
  | 'delete_asset'
  | 'update_binding'
  | 'create_abac_policy'
  | 'update_abac_policy'
  | 'delete_abac_policy'
  | 'update_share_permissions'
  | 'update_recipient'
  | 'create_quality_monitor'
  | 'refresh_quality_monitor'
  | 'apply_access_request';

export interface GrantChanges {
  principal: string;
  privileges: string[];
}
export interface OwnershipChanges {
  new_owner: string;
}
export interface MetadataChanges {
  comment?: string | null;
  properties?: Record<string, string>;
  column_comments?: Record<string, string | null>;
}
export interface TagChanges {
  column?: string | null;
  tags: { key: string; value?: string | null }[];
}
export interface RowFilterChanges {
  function_full_name: string;
  input_columns: string[];
}
export interface ColumnMaskChanges {
  column: string;
  function_full_name: string;
  using_columns: string[];
}
export interface DropChanges {
  column?: string | null;
}
export interface ViewDefinitionChanges {
  definition: string;
  expected_current_definition_hash: string;
}
export type GenericChanges = Record<string, unknown>;

export type PlanChanges =
  | GrantChanges
  | OwnershipChanges
  | MetadataChanges
  | TagChanges
  | RowFilterChanges
  | ColumnMaskChanges
  | DropChanges
  | ViewDefinitionChanges
  | GenericChanges;

export interface PlanTargetInput {
  securable_type: SecurableType;
  full_name: string;
}

export interface PlanCreateRequest {
  kind: PlanKind;
  targets: PlanTargetInput[];
  changes: PlanChanges;
  /** 3..200 chars */
  reason: string;
  access_request_id?: string | null;
}

export type PlanStatus =
  | 'previewed'
  | 'confirmed'
  | 'revalidating'
  | 'executing'
  | 'applied'
  | 'partially_applied'
  | 'failed'
  | 'unknown'
  | 'expired'
  | 'stale'
  | 'invalidated';

export interface NormalizedChange {
  target: AssetRef;
  description: string;
  statement_preview: string;
}

export interface Impact {
  known: string[];
  unknown: string[];
}

export interface Plan {
  id: string;
  kind: PlanKind;
  status: PlanStatus;
  identity: Identity;
  workspace_id: string | null;
  environment_label: string;
  targets: AssetRef[];
  normalized_changes: NormalizedChange[];
  observed_state_hash: string;
  impact: Impact;
  prerequisite_notes: string[];
  inheritance_note: string | null;
  requires_typed_confirmation: boolean;
  typed_confirmation_value: string | null;
  atomic: boolean;
  expires_at: string;
  confirmation_token: string;
  created_at: string;
  invalidated_by: string | null;
  access_request_id: string | null;
}

export interface PlanExecuteRequest {
  confirmation_token: string;
  typed_name?: string | null;
}

export type OperationStatus = 'executing' | 'applied' | 'partially_applied' | 'failed' | 'unknown';
export type TargetOutcomeStatus = 'pending' | 'applied' | 'failed' | 'unknown' | 'skipped';

export interface TargetOutcome {
  target: AssetRef;
  status: TargetOutcomeStatus;
  verified: boolean;
  verified_at: string | null;
  databricks_request_id: string | null;
  error: { code: ErrorCode; message: string } | null;
  summary: string;
}

export interface Operation {
  id: string;
  plan_id: string;
  kind: PlanKind;
  status: OperationStatus;
  identity: Identity;
  started_at: string;
  finished_at: string | null;
  atomic: boolean;
  targets: TargetOutcome[];
  reconcile_available: boolean;
  summary: string;
  correlation_id: string;
}

// ---------------------------------------------------------------- policies

export type AbacPolicyType = 'row_filter' | 'column_mask';

export interface AbacPolicy {
  id: string;
  name: string;
  policy_type: AbacPolicyType;
  scope: AssetRef;
  when_condition: string;
  to_principals: string[];
  except_principals: string[];
  function_full_name: string;
  match_columns: string[];
  owner: string | null;
  created_at: string | null;
  updated_at: string | null;
  allowed_actions: AllowedAction[];
}

export interface PolicyImpactData {
  potentially_affected: AssetSummary[];
  disclaimer: string;
}

// ---------------------------------------------------------------- filters / functions

export interface RowAccessData {
  target: AssetRef;
  row_filter: RowFilterRef | null;
  column_masks: ColumnMaskRef[];
  allowed_actions: AllowedAction[];
}

export interface FunctionParameter {
  name: string;
  type_text: string;
  position: number;
}

export interface FunctionDetail {
  full_name: string;
  owner: string | null;
  comment: string | null;
  return_type: string | null;
  parameters: FunctionParameter[];
  language: string | null;
  dependents: Dependency[];
  used_as_policy_function: boolean | null;
  allowed_actions: AllowedAction[];
}

// ---------------------------------------------------------------- storage

export type IsolationMode = 'ISOLATION_MODE_OPEN' | 'ISOLATION_MODE_ISOLATED';

export interface StorageCredential {
  name: string;
  owner: string | null;
  cloud_provider: string | null;
  read_only: boolean | null;
  isolation_mode: IsolationMode | null;
  comment: string | null;
  created_at: string | null;
  used_for_managed_storage: boolean | null;
  allowed_actions: AllowedAction[];
}

export interface ExternalLocation {
  name: string;
  url: string;
  credential_name: string | null;
  owner: string | null;
  read_only: boolean | null;
  isolation_mode: IsolationMode | null;
  comment: string | null;
  created_at: string | null;
  allowed_actions: AllowedAction[];
}

export interface WorkspaceBinding {
  workspace_id: string;
  binding_type: 'BINDING_TYPE_READ_WRITE' | 'BINDING_TYPE_READ_ONLY';
}

export interface WorkspaceBindingData {
  target: AssetRef;
  isolation_mode: IsolationMode;
  bindings: WorkspaceBinding[];
  current_workspace_bound: boolean | null;
  allowed_actions: AllowedAction[];
}

// ---------------------------------------------------------------- federation

export interface Connection {
  name: string;
  connection_type: string;
  owner: string | null;
  read_only: boolean | null;
  comment: string | null;
  options_nonsecret: Record<string, string>;
  foreign_catalogs: string[];
  created_at: string | null;
  allowed_actions: AllowedAction[];
}

// ---------------------------------------------------------------- sharing

export interface SharedObject {
  full_name: string;
  data_object_type: string;
  shared_as: string | null;
  has_row_filter_or_mask: boolean | null;
}

export type ExternalExposure = 'confirmed_external' | 'internal_only' | 'unknown';

export interface Share {
  name: string;
  owner: string | null;
  comment: string | null;
  objects: SharedObject[];
  recipients: string[];
  external_exposure: ExternalExposure;
  created_at: string | null;
  allowed_actions: AllowedAction[];
}

export interface Recipient {
  name: string;
  authentication_type: 'TOKEN' | 'DATABRICKS' | 'unknown';
  owner: string | null;
  activated: boolean | null;
  comment: string | null;
  created_at: string | null;
  secrets_note: string;
  allowed_actions: AllowedAction[];
}

// ---------------------------------------------------------------- lineage

export type LineageDirection = 'upstream' | 'downstream' | 'both';

export interface LineageNode {
  id: string;
  ref: AssetRef | null;
  visible: boolean;
  depth: number;
}

export interface LineageEdge {
  from: string;
  to: string;
  last_seen_at: string | null;
  via: string | null;
}

export interface LineageData {
  root: AssetRef;
  direction: LineageDirection;
  depth: number;
  nodes: LineageNode[];
  edges: LineageEdge[];
  truncated: boolean;
  window_start: string;
  window_end: string;
  coverage_note: string;
}

// ---------------------------------------------------------------- activity

export type AuditOutcome = 'success' | 'failure' | 'unknown';

export interface AuditEvent {
  event_time: string;
  actor: string | null;
  execution_identity: string | null;
  service: string;
  action: string;
  target_full_name: string | null;
  outcome: AuditOutcome;
  request_id: string | null;
  source_table: string;
}

export type AuditCorrelation = 'verified' | 'partial' | 'unavailable';

export interface AppActivityEvent {
  id: string;
  at: string;
  actor: string;
  executor: string;
  action: string;
  target: AssetRef | null;
  plan_id: string | null;
  operation_id: string | null;
  outcome: OperationStatus | null;
  correlation_id: string;
  databricks_request_id: string | null;
  audit_correlation: AuditCorrelation;
}

export type FindingRule =
  | 'missing_owner'
  | 'missing_description'
  | 'broad_grant'
  | 'external_share'
  | 'sensitive_tag_without_mask'
  | 'policy_coverage_gap';

export type FindingSeverity = 'info' | 'low' | 'medium' | 'high';

export interface Finding {
  id: string;
  rule: FindingRule;
  severity: FindingSeverity;
  asset: AssetRef;
  summary: string;
  evidence: string[];
  observed_at: string;
  disclaimer: string;
}

// ---------------------------------------------------------------- quality

export interface QualityRefresh {
  refresh_id: string;
  state: string;
  start_time: string | null;
  end_time: string | null;
  trigger: string | null;
}

export interface QualityMonitor {
  table_full_name: string;
  status: string;
  monitor_type: 'snapshot' | 'time_series' | 'inference' | null;
  output_schema_name: string | null;
  latest_refresh: QualityRefresh | null;
  refreshes: QualityRefresh[];
  compute_note: string;
  allowed_actions: AllowedAction[];
}

// ---------------------------------------------------------------- ai assets

export interface ModelVersion {
  model_full_name: string;
  version: number;
  status: string | null;
  owner: string | null;
  comment: string | null;
  created_at: string | null;
  aliases: string[];
  allowed_actions: AllowedAction[];
}

export interface ServingEndpoint {
  name: string;
  state: string | null;
  served_models: string[];
  related_service_note: string;
}

// ---------------------------------------------------------------- access requests

export type AccessRequestStatus =
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'applying'
  | 'applied'
  | 'failed'
  | 'unknown'
  | 'expired'
  | 'cancelled';

export type WorkflowOwner = 'application' | 'databricks_native';

export interface AccessRequestCreate {
  beneficiary: string;
  target: PlanTargetInput;
  privileges: string[];
  reason: string;
  requested_until?: string | null;
}

export type AccessRequestActionName = 'approve' | 'reject' | 'cancel' | 'apply' | 'view_operation';

export interface AccessRequestAllowedAction {
  action: AccessRequestActionName;
  allowed: boolean;
  reason_code?: string | null;
  reason?: string | null;
}

export interface AccessRequest {
  id: string;
  workflow_owner: WorkflowOwner;
  requester: string;
  beneficiary: Principal;
  target: AssetRef;
  privileges: string[];
  reason: string;
  status: AccessRequestStatus;
  approver: string | null;
  decided_at: string | null;
  decision_comment: string | null;
  requested_until: string | null;
  plan_id: string | null;
  operation_id: string | null;
  created_at: string;
  updated_at: string;
  allowed_actions: AccessRequestAllowedAction[];
}

export interface AccessDecision {
  decision: 'approve' | 'reject';
  comment?: string | null;
}

// ---------------------------------------------------------------- admin

export interface Metastore {
  id: string;
  name: string;
  region: string | null;
  cloud: string | null;
  owner: string | null;
  assigned_workspace_ids: string[];
  created_at: string | null;
}

// ---------------------------------------------------------------- endpoint map (compile-time documentation)

/**
 * Paths relative to /api/v1. Kept here so the frontend api layer and MSW handlers share one list.
 * Path params are in {braces}; full_name must be URL-encoded as one segment.
 */
export const API_PATHS = {
  context: '/context',
  me: '/me',
  capabilities: '/capabilities',
  catalogs: '/catalogs',
  schemas: '/catalogs/{catalog}/schemas',
  schemaObjects: '/schemas/{catalog}/{schema}/objects',
  asset: '/assets/{securable_type}/{full_name}',
  assetDependencies: '/assets/{securable_type}/{full_name}/dependencies',
  assetGrants: '/assets/{securable_type}/{full_name}/grants',
  assetTags: '/assets/{securable_type}/{full_name}/tags',
  principalsSearch: '/principals/search',
  privileges: '/privileges',
  tagPolicies: '/tag-policies',
  plans: '/plans',
  plan: '/plans/{plan_id}',
  planExecute: '/plans/{plan_id}/execute',
  operation: '/operations/{operation_id}',
  operationReconcile: '/operations/{operation_id}/reconcile',
  abacPolicies: '/abac-policies',
  abacPolicy: '/abac-policies/{policy_id}',
  abacPolicyImpact: '/abac-policies/{policy_id}/impact',
  rowAccess: '/assets/TABLE/{full_name}/row-access',
  function: '/functions/{full_name}',
  storageCredentials: '/storage-credentials',
  externalLocations: '/external-locations',
  bindings: '/bindings/{securable_type}/{full_name}',
  connections: '/connections',
  shares: '/shares',
  recipients: '/recipients',
  tableLineage: '/lineage/TABLE/{full_name}',
  activityApp: '/activity/app',
  activityDatabricksAudit: '/activity/databricks-audit',
  findings: '/findings',
  qualityMonitor: '/quality/monitors/{full_name}',
  modelVersions: '/models/{full_name}/versions',
  servingEndpoints: '/serving-endpoints',
  accessRequests: '/access-requests',
  accessRequest: '/access-requests/{request_id}',
  accessRequestDecision: '/access-requests/{request_id}/decision',
  adminMetastores: '/admin/metastores',
} as const;

export type ApiPathKey = keyof typeof API_PATHS;
