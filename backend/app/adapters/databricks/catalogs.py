"""Allowlisted catalog SDK reads, with bounded continuation."""
from typing import TYPE_CHECKING
from app.adapters.databricks.common import CursorStore, base_asset, boundary
from app.domain.enums import ObjectKind, SecurableType
from app.domain.models import AssetDetail, AssetSummary
if TYPE_CHECKING:
    from databricks.sdk.service.catalog import CatalogsAPI


@boundary
def map_catalog(value: object) -> AssetDetail:
    return base_asset(value, SecurableType.CATALOG, ObjectKind.CATALOG)


class CatalogsAdapter:
    def __init__(self, api: 'CatalogsAPI', cursors: CursorStore, identity_key: str) -> None:
        self.api, self.cursors, self.identity_key = api, cursors, identity_key

    @boundary
    def list_catalogs(self, page_size: int, page_token: str | None) -> tuple[list[AssetSummary], str | None]:
        values, token = self.cursors.page(lambda: self.api.list(max_results=min(200, max(1, page_size))), f'{self.identity_key}:catalogs', page_size, page_token)
        return [map_catalog(v) for v in values], token

    @boundary
    def get_asset(self, securable_type: str, full_name: str) -> AssetDetail:
        return map_catalog(self.api.get(name=full_name))
