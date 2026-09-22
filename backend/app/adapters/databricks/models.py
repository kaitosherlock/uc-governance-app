"""Allowlisted registered_model SDK reads, with bounded continuation."""
from typing import TYPE_CHECKING
from app.adapters.databricks.common import CursorStore, base_asset, boundary
from app.domain.enums import ObjectKind, SecurableType
from app.domain.models import AssetDetail, AssetSummary
if TYPE_CHECKING:
    from databricks.sdk.service.catalog import RegisteredModelsAPI


@boundary
def map_registered_model(value: object) -> AssetDetail:
    return base_asset(value, SecurableType.REGISTERED_MODEL, ObjectKind.REGISTERED_MODEL)


class ModelsAdapter:
    def __init__(self, api: 'RegisteredModelsAPI', cursors: CursorStore, identity_key: str) -> None:
        self.api, self.cursors, self.identity_key = api, cursors, identity_key

    @boundary
    def list_objects(self, catalog: str, schema: str, page_size: int, page_token: str | None) -> tuple[list[AssetSummary], str | None]:
        values, token = self.cursors.page(lambda: self.api.list(catalog_name=catalog, schema_name=schema, max_results=min(200, max(1, page_size))), f'{self.identity_key}:models:{catalog}:{schema}', page_size, page_token)
        return [map_registered_model(v) for v in values], token

    @boundary
    def get_asset(self, securable_type: str, full_name: str) -> AssetDetail:
        return map_registered_model(self.api.get(full_name=full_name))
