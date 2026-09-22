"""Allowlisted schema SDK reads, with bounded continuation."""
from typing import TYPE_CHECKING
from app.adapters.databricks.common import CursorStore, base_asset, boundary
from app.domain.enums import ObjectKind, SecurableType
from app.domain.models import AssetDetail, AssetSummary
if TYPE_CHECKING:
    from databricks.sdk.service.catalog import SchemasAPI


@boundary
def map_schema(value: object) -> AssetDetail:
    return base_asset(value, SecurableType.SCHEMA, ObjectKind.SCHEMA)


class SchemasAdapter:
    def __init__(self, api: 'SchemasAPI', cursors: CursorStore, identity_key: str) -> None:
        self.api, self.cursors, self.identity_key = api, cursors, identity_key

    @boundary
    def list_schemas(self, catalog: str, page_size: int, page_token: str | None) -> tuple[list[AssetSummary], str | None]:
        values, token = self.cursors.page(lambda: self.api.list(catalog_name=catalog, max_results=min(200, max(1, page_size))), f'{self.identity_key}:schemas:{catalog}', page_size, page_token)
        return [map_schema(v) for v in values], token

    @boundary
    def get_asset(self, securable_type: str, full_name: str) -> AssetDetail:
        return map_schema(self.api.get(full_name=full_name))
