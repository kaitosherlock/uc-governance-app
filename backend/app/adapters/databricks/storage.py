"""Secret-safe storage credential and external location metadata reads."""

from typing import TYPE_CHECKING, Literal

from app.adapters.databricks.common import CursorStore, boundary, enum_field, text_field, timestamp
from app.domain.models import ExternalLocation, StorageCredential

if TYPE_CHECKING:
    from databricks.sdk.service.catalog import ExternalLocationsAPI, StorageCredentialsAPI


IsolationMode = Literal["ISOLATION_MODE_OPEN", "ISOLATION_MODE_ISOLATED"]
CloudProvider = Literal[
    "aws_iam_role", "azure_managed_identity", "gcp_service_account", "unknown"
]


def _optional_bool(value: object, name: str) -> bool | None:
    result = getattr(value, name, None)
    return result if isinstance(result, bool) else None


def _isolation_mode(value: object) -> IsolationMode | None:
    raw = enum_field(value, "isolation_mode")
    if raw == "ISOLATION_MODE_OPEN":
        return "ISOLATION_MODE_OPEN"
    if raw == "ISOLATION_MODE_ISOLATED":
        return "ISOLATION_MODE_ISOLATED"
    return None


def _cloud_provider(value: object) -> CloudProvider:
    # These are the only three contract-defined discriminators.  We intentionally do not
    # expose, inspect, or infer any nested identity values such as ARNs or client IDs.
    if getattr(value, "aws_iam_role", None) is not None:
        return "aws_iam_role"
    if getattr(value, "azure_managed_identity", None) is not None:
        return "azure_managed_identity"
    if getattr(value, "databricks_gcp_service_account", None) is not None:
        return "gcp_service_account"
    return "unknown"


def map_storage_credential(value: object) -> StorageCredential:
    """Map exactly the contract allowlist; nested cloud credential objects are never copied."""
    name = text_field(value, "name")
    if not name:
        raise ValueError("Databricks returned a storage credential without a name.")
    return StorageCredential(
        name=name,
        owner=text_field(value, "owner"),
        cloud_provider=_cloud_provider(value),
        read_only=_optional_bool(value, "read_only"),
        isolation_mode=_isolation_mode(value),
        comment=text_field(value, "comment"),
        created_at=timestamp(value, "created_at"),
        used_for_managed_storage=_optional_bool(value, "used_for_managed_storage"),
        allowed_actions=(),
    )


def map_external_location(value: object) -> ExternalLocation:
    """Map exactly the contract allowlist; event queues and encryption details are excluded."""
    name = text_field(value, "name")
    url = text_field(value, "url")
    if not name or not url:
        raise ValueError("Databricks returned an external location without a name or URL.")
    return ExternalLocation(
        name=name,
        url=url,
        credential_name=text_field(value, "credential_name"),
        owner=text_field(value, "owner"),
        read_only=_optional_bool(value, "read_only"),
        isolation_mode=_isolation_mode(value),
        comment=text_field(value, "comment"),
        created_at=timestamp(value, "created_at"),
        allowed_actions=(),
    )


class StorageAdapter:
    def __init__(
        self,
        storage_credentials: "StorageCredentialsAPI",
        external_locations: "ExternalLocationsAPI",
        cursors: CursorStore,
        cursor_key: str,
    ) -> None:
        self.storage_credentials = storage_credentials
        self.external_locations = external_locations
        self.cursors = cursors
        self.cursor_key = cursor_key

    @boundary
    def list_storage_credentials(
        self, page_size: int, page_token: str | None
    ) -> tuple[list[StorageCredential], str | None]:
        values, token = self.cursors.page(
            lambda: iter(
                self.storage_credentials.list(
                    max_results=page_size,
                    page_token=None,
                )
            ),
            f"{self.cursor_key}:storage-credentials",
            page_size,
            page_token,
        )
        return [map_storage_credential(value) for value in values], token

    @boundary
    def list_external_locations(
        self, page_size: int, page_token: str | None
    ) -> tuple[list[ExternalLocation], str | None]:
        values, token = self.cursors.page(
            lambda: iter(
                self.external_locations.list(
                    max_results=page_size,
                    page_token=None,
                )
            ),
            f"{self.cursor_key}:external-locations",
            page_size,
            page_token,
        )
        return [map_external_location(value) for value in values], token
