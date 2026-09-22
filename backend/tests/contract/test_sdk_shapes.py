"""Mocked contract tests against real installed SDK shapes; NOT live evidence.

No clients are constructed and no service methods are called. Runtime adapters do
not exist yet: these literal expectations guard the planned calls recorded by
P0-08, including future plan-mediated writes. Secret-returning operations excluded
by application policy are deliberately not adapter call targets. Account services
use the ``account.`` prefix. Add an operation with one tuple below.
"""

import inspect
from typing import get_type_hints

import pytest
from app.tools.introspect_sdk import dto_fields, service_class
from databricks.sdk import AccountClient, WorkspaceClient

SDK_OPERATIONS: list[tuple[str, str, tuple[str, ...]]] = [
    ("catalogs", "create", ("name", "connection_name", "options")),
    ("catalogs", "delete", ("name", "force")),
    ("catalogs", "get", ("name", "include_browse")),
    ("catalogs", "list", ("max_results", "page_token")),
    ("catalogs", "update", ("name", "comment", "owner", "properties")),
    ("schemas", "create", ("name", "catalog_name")),
    ("schemas", "delete", ("full_name", "force")),
    ("schemas", "get", ("full_name", "include_browse")),
    ("schemas", "list", ("catalog_name", "max_results", "page_token")),
    ("schemas", "update", ("full_name", "comment", "owner", "properties")),
    (
        "tables",
        "create",
        (
            "name",
            "catalog_name",
            "schema_name",
            "table_type",
            "data_source_format",
            "storage_location",
        ),
    ),
    ("tables", "delete", ("full_name",)),
    ("tables", "get", ("full_name", "include_browse")),
    ("tables", "list", ("catalog_name", "schema_name", "max_results", "page_token")),
    ("tables", "update", ("full_name", "owner")),
    ("grants", "get", ("securable_type", "full_name")),
    (
        "grants",
        "get_effective",
        ("securable_type", "full_name", "max_results", "page_token", "principal"),
    ),
    ("grants", "update", ("securable_type", "full_name", "changes")),
    ("volumes", "create", ("catalog_name", "schema_name", "name", "volume_type")),
    ("volumes", "delete", ("name",)),
    ("volumes", "list", ("catalog_name", "schema_name", "max_results", "page_token")),
    ("volumes", "read", ("name",)),
    ("volumes", "update", ("name", "comment", "owner")),
    ("functions", "create", ("function_info",)),
    ("functions", "delete", ("name", "force")),
    ("functions", "get", ("name", "include_browse")),
    ("functions", "list", ("catalog_name", "schema_name", "max_results", "page_token")),
    ("functions", "update", ("name", "owner")),
    ("registered_models", "create", ("catalog_name", "comment", "name", "schema_name")),
    ("registered_models", "delete", ("full_name",)),
    ("registered_models", "get", ("full_name", "include_browse")),
    ("registered_models", "list", ("catalog_name", "max_results", "page_token", "schema_name")),
    ("registered_models", "set_alias", ("full_name", "alias", "version_num")),
    ("registered_models", "update", ("full_name", "comment", "owner")),
    ("model_versions", "delete", ("full_name", "version")),
    ("model_versions", "get", ("full_name", "version", "include_browse")),
    ("model_versions", "list", ("full_name", "max_results", "page_token")),
    ("model_versions", "update", ("full_name", "version", "comment")),
    ("metastores", "current", ()),
    ("metastores", "get", ("id",)),
    ("metastores", "list", ("max_results", "page_token")),
    ("metastores", "summary", ()),
    ("metastores", "update", ("id", "owner")),
    ("storage_credentials", "create", ("name",)),
    ("storage_credentials", "delete", ("name", "force")),
    ("storage_credentials", "get", ("name",)),
    ("storage_credentials", "list", ("max_results", "page_token")),
    ("storage_credentials", "update", ("name", "comment", "owner")),
    ("storage_credentials", "validate", ("external_location_name", "storage_credential_name")),
    ("external_locations", "create", ("name", "url", "credential_name")),
    ("external_locations", "delete", ("name", "force")),
    ("external_locations", "get", ("name", "include_browse")),
    ("external_locations", "list", ("max_results", "page_token")),
    ("external_locations", "update", ("name", "comment", "owner")),
    ("connections", "create", ("name", "connection_type", "options")),
    ("connections", "delete", ("name",)),
    ("connections", "get", ("name",)),
    ("connections", "list", ("max_results", "page_token")),
    ("connections", "update", ("name", "options", "owner")),
    ("shares", "create", ("name",)),
    ("shares", "delete", ("name",)),
    ("shares", "get", ("name",)),
    ("shares", "list_shares", ("max_results", "page_token")),
    ("shares", "share_permissions", ("name",)),
    ("shares", "update", ("name", "comment", "owner", "updates")),
    ("shares", "update_permissions", ("name", "changes")),
    ("recipients", "create", ("name", "authentication_type")),
    ("recipients", "delete", ("name",)),
    ("recipients", "get", ("name",)),
    ("recipients", "list", ("max_results", "page_token")),
    ("recipients", "share_permissions", ("name",)),
    ("recipients", "update", ("name", "comment", "owner")),
    ("providers", "create", ("name", "authentication_type")),
    ("providers", "delete", ("name",)),
    ("providers", "get", ("name",)),
    ("providers", "list", ("max_results", "page_token")),
    ("providers", "list_shares", ("name", "max_results", "page_token")),
    ("providers", "update", ("name", "comment", "owner")),
    (
        "workspace_bindings",
        "get_bindings",
        ("securable_type", "securable_name", "max_results", "page_token"),
    ),
    (
        "workspace_bindings",
        "update_bindings",
        ("securable_type", "securable_name", "add", "remove"),
    ),
    ("quality_monitors", "create", ("table_name", "output_schema_name", "assets_dir")),
    ("quality_monitors", "delete", ("table_name",)),
    ("quality_monitors", "get", ("table_name",)),
    ("quality_monitors", "get_refresh", ("table_name", "refresh_id")),
    ("quality_monitors", "list_refreshes", ("table_name",)),
    ("quality_monitors", "run_refresh", ("table_name",)),
    ("quality_monitors", "update", ("table_name", "output_schema_name")),
    ("serving_endpoints", "get", ("name",)),
    ("serving_endpoints", "get_permissions", ("serving_endpoint_id",)),
    ("serving_endpoints", "list", ()),
    ("statement_execution", "cancel_execution", ("statement_id",)),
    (
        "statement_execution",
        "execute_statement",
        ("statement", "warehouse_id", "on_wait_timeout", "parameters", "row_limit", "wait_timeout"),
    ),
    ("statement_execution", "get_statement", ("statement_id",)),
    ("statement_execution", "get_statement_result_chunk_n", ("statement_id", "chunk_index")),
    ("users", "get", ("id",)),
    ("users", "list", ("count", "filter", "start_index")),
    ("groups", "get", ("id",)),
    ("groups", "list", ("count", "filter", "start_index")),
    ("service_principals", "get", ("id",)),
    ("service_principals", "list", ("count", "filter", "start_index")),
    ("current_user", "me", ()),
    ("entity_tag_assignments", "create", ("tag_assignment",)),
    ("entity_tag_assignments", "delete", ("entity_type", "entity_name", "tag_key")),
    ("entity_tag_assignments", "get", ("entity_type", "entity_name", "tag_key")),
    ("entity_tag_assignments", "list", ("entity_type", "entity_name", "max_results", "page_token")),
    (
        "entity_tag_assignments",
        "update",
        ("entity_type", "entity_name", "tag_key", "tag_assignment", "update_mask"),
    ),
    ("tag_policies", "create_tag_policy", ("tag_policy",)),
    ("tag_policies", "delete_tag_policy", ("tag_key",)),
    ("tag_policies", "get_tag_policy", ("tag_key",)),
    ("tag_policies", "list_tag_policies", ()),
    ("tag_policies", "update_tag_policy", ("tag_key", "tag_policy", "update_mask")),
    ("policies", "create_policy", ("policy_info",)),
    ("policies", "delete_policy", ("on_securable_type", "on_securable_fullname", "name")),
    ("policies", "get_policy", ("on_securable_type", "on_securable_fullname", "name")),
    (
        "policies",
        "list_policies",
        (
            "on_securable_type",
            "on_securable_fullname",
            "include_inherited",
            "max_results",
            "page_token",
        ),
    ),
    (
        "policies",
        "update_policy",
        ("on_securable_type", "on_securable_fullname", "name", "policy_info"),
    ),
    ("rfa", "batch_create_access_requests", ()),
    ("rfa", "get_access_request_destinations", ("securable_type", "full_name")),
    ("rfa", "update_access_request_destinations", ("access_request_destinations", "update_mask")),
    (
        "external_lineage",
        "create_external_lineage_relationship",
        ("external_lineage_relationship",),
    ),
    (
        "external_lineage",
        "delete_external_lineage_relationship",
        ("external_lineage_relationship",),
    ),
    (
        "external_lineage",
        "list_external_lineage_relationships",
        ("object_info", "lineage_direction"),
    ),
    (
        "external_lineage",
        "update_external_lineage_relationship",
        ("external_lineage_relationship", "update_mask"),
    ),
    ("external_metadata", "create_external_metadata", ("external_metadata",)),
    ("external_metadata", "delete_external_metadata", ("name",)),
    ("external_metadata", "get_external_metadata", ("name",)),
    ("external_metadata", "list_external_metadata", ()),
    ("external_metadata", "update_external_metadata", ("name", "external_metadata", "update_mask")),
    ("clean_rooms", "get", ("name",)),
    ("clean_rooms", "list", ("page_size", "page_token")),
    ("credentials", "create_credential", ("name", "comment", "purpose")),
    ("credentials", "delete_credential", ("name_arg",)),
    ("credentials", "get_credential", ("name_arg",)),
    ("credentials", "list_credentials", ("max_results", "page_token", "purpose")),
    ("credentials", "update_credential", ("name_arg", "comment", "owner")),
    ("credentials", "validate_credential", ("credential_name", "purpose")),
    ("resource_quotas", "get_quota", ("parent_securable_type", "parent_full_name", "quota_name")),
    ("resource_quotas", "list_quotas", ()),
    ("data_classification", "create_catalog_config", ("parent", "catalog_config")),
    ("data_classification", "delete_catalog_config", ("name",)),
    ("data_classification", "get_catalog_config", ("name",)),
    ("data_classification", "update_catalog_config", ("name", "catalog_config", "update_mask")),
    ("data_quality", "get_monitor", ("object_type", "object_id")),
    ("data_quality", "get_refresh", ("object_type", "object_id", "refresh_id")),
    ("data_quality", "list_monitor", ()),
    ("data_quality", "list_refresh", ("object_type", "object_id")),
    ("consumer_listings", "get", ("id",)),
    ("consumer_listings", "list", ("page_size", "page_token")),
    ("account.metastores", "create", ()),
    ("account.metastores", "delete", ("metastore_id", "force")),
    ("account.metastores", "get", ("metastore_id",)),
    ("account.metastores", "list", ()),
    ("account.metastores", "update", ("metastore_id",)),
    ("account.metastore_assignments", "create", ("workspace_id", "metastore_id")),
    ("account.metastore_assignments", "delete", ("workspace_id", "metastore_id")),
    ("account.metastore_assignments", "get", ("workspace_id",)),
    ("account.metastore_assignments", "list", ("metastore_id",)),
    ("account.metastore_assignments", "update", ("workspace_id", "metastore_id")),
    ("account.users", "get", ("id",)),
    ("account.users", "list", ("count", "filter", "start_index")),
    ("account.groups", "get", ("id",)),
    ("account.groups", "list", ("count", "filter", "start_index")),
    ("account.service_principals", "get", ("id",)),
    ("account.service_principals", "list", ("count", "filter", "start_index")),
]

# Fields the planned allowlisted mappers actually need, including nested DTOs.
DTO_FIELDS = {
    ("tables", "get"): {
        "databricks.sdk.service.catalog.TableInfo": (
            "full_name",
            "owner",
            "comment",
            "properties",
            "table_type",
            "pipeline_id",
            "row_filter",
            "columns",
            "view_definition",
            "view_dependencies",
        ),
        "databricks.sdk.service.catalog.ColumnInfo": ("name", "comment", "mask", "type_name"),
    },
    ("grants", "get_effective"): {
        "databricks.sdk.service.catalog.EffectivePrivilege": (
            "privilege",
            "inherited_from_name",
            "inherited_from_type",
        ),
    },
    ("groups", "get"): {"databricks.sdk.service.iam.Group": ("id", "members", "display_name")},
    ("current_user", "me"): {"databricks.sdk.service.iam.User": ("id", "user_name", "groups")},
    ("serving_endpoints", "get"): {
        "databricks.sdk.service.serving.ServingEndpointDetailed": ("name", "ai_gateway"),
    },
}


@pytest.mark.parametrize(
    ("service", "method", "required_params"),
    SDK_OPERATIONS,
    ids=[f"{service}.{method}" for service, method, _ in SDK_OPERATIONS],
)
def test_sdk_operation_shape(
    service: str,
    method: str,
    required_params: tuple[str, ...],
) -> None:
    client = AccountClient if service.startswith("account.") else WorkspaceClient
    name = service.removeprefix("account.")
    assert inspect.getattr_static(client, name, None) is not None, service
    cls = service_class(client, name)
    assert cls is not None, service
    operation = inspect.getattr_static(cls, method, None)
    assert callable(operation), f"{service}.{method} missing"
    parameters = inspect.signature(operation).parameters
    assert set(required_params) <= set(parameters), (
        f"{service}.{method} lost parameters: {set(required_params) - set(parameters)}"
    )
    expected = DTO_FIELDS.get((service, method), {})
    if expected:
        fields = dto_fields(get_type_hints(operation).get("return"))
        for dto, required_fields in expected.items():
            assert dto in fields, dto
            assert set(required_fields) <= set(fields[dto]), dto
