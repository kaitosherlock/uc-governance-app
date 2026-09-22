"""Frozen contract vocabulary, independent of SDK and wire models."""
from enum import StrEnum


class SecurableType(StrEnum):
    METASTORE = 'METASTORE'
    CATALOG = 'CATALOG'
    SCHEMA = 'SCHEMA'
    TABLE = 'TABLE'
    VOLUME = 'VOLUME'
    FUNCTION = 'FUNCTION'
    REGISTERED_MODEL = 'REGISTERED_MODEL'
    STORAGE_CREDENTIAL = 'STORAGE_CREDENTIAL'
    CREDENTIAL = 'CREDENTIAL'
    EXTERNAL_LOCATION = 'EXTERNAL_LOCATION'
    CONNECTION = 'CONNECTION'
    SHARE = 'SHARE'
    RECIPIENT = 'RECIPIENT'
    PROVIDER = 'PROVIDER'


class ObjectKind(StrEnum):
    METASTORE = 'metastore'
    CATALOG = 'catalog'
    SCHEMA = 'schema'
    TABLE = 'table'
    VIEW = 'view'
    MATERIALIZED_VIEW = 'materialized_view'
    STREAMING_TABLE = 'streaming_table'
    VOLUME = 'volume'
    FUNCTION = 'function'
    REGISTERED_MODEL = 'registered_model'
    MODEL_VERSION = 'model_version'


class ManagedStatus(StrEnum):
    MANAGED = 'managed'
    EXTERNAL = 'external'
    NOT_APPLICABLE = 'not_applicable'
    UNKNOWN = 'unknown'


class ActionName(StrEnum):
    GRANT = 'grant'
    REVOKE = 'revoke'
    TRANSFER_OWNERSHIP = 'transfer_ownership'
    EDIT_METADATA = 'edit_metadata'
    DELETE = 'delete'
    ASSIGN_TAG = 'assign_tag'
    REMOVE_TAG = 'remove_tag'
    SET_ROW_FILTER = 'set_row_filter'
    DROP_ROW_FILTER = 'drop_row_filter'
    SET_COLUMN_MASK = 'set_column_mask'
    DROP_COLUMN_MASK = 'drop_column_mask'
    REPLACE_VIEW_DEFINITION = 'replace_view_definition'
    UPDATE_BINDING = 'update_binding'
    VALIDATE = 'validate'
    CREATE_QUALITY_MONITOR = 'create_quality_monitor'
    REFRESH_QUALITY_MONITOR = 'refresh_quality_monitor'
    REQUEST_ACCESS = 'request_access'


class TagKind(StrEnum):
    FREE_FORM = 'free_form'
    GOVERNED = 'governed'
    SYSTEM = 'system'


class AttachmentSource(StrEnum):
    DIRECT = 'direct'
    ABAC_POLICY = 'abac_policy'
    UNKNOWN = 'unknown'


class DependencyKind(StrEnum):
    VIEW = 'view'
    MATERIALIZED_VIEW = 'materialized_view'
    STREAMING_TABLE = 'streaming_table'
    DOWNSTREAM_TABLE = 'downstream_table'
    FOREIGN_CATALOG = 'foreign_catalog'
    SHARE = 'share'
    POLICY_FUNCTION = 'policy_function'
    QUALITY_MONITOR = 'quality_monitor'
    MODEL_VERSION = 'model_version'
    UNKNOWN = 'unknown'


class PrincipalKind(StrEnum):
    USER = 'user'
    GROUP = 'group'
    SERVICE_PRINCIPAL = 'service_principal'


class PrincipalScope(StrEnum):
    ACCOUNT = 'account'
    WORKSPACE_LOCAL = 'workspace_local'
    UNKNOWN = 'unknown'


class PrivilegeCategory(StrEnum):
    BROWSE = 'browse'
    USE = 'use'
    READ = 'read'
    WRITE = 'write'
    CREATE = 'create'
    MANAGE = 'manage'
    ALL = 'all'
    OBJECT_SPECIFIC = 'object_specific'


class GrantSourceType(StrEnum):
    DIRECT = 'direct'
    INHERITED = 'inherited'
    UNKNOWN = 'unknown'
