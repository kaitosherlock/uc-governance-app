"""Allowlisted volume SDK reads, with bounded continuation."""
from dataclasses import replace
from typing import TYPE_CHECKING
from app.adapters.databricks.common import CursorStore, base_asset, boundary, enum_field
from app.domain.enums import ManagedStatus, ObjectKind, SecurableType
from app.domain.models import AssetDetail, AssetSummary
if TYPE_CHECKING:
    from databricks.sdk.service.catalog import VolumesAPI


@boundary
def map_volume(value: object) -> AssetDetail:
    asset = base_asset(value, SecurableType.VOLUME, ObjectKind.VOLUME)
    status = {'MANAGED': ManagedStatus.MANAGED, 'EXTERNAL': ManagedStatus.EXTERNAL}.get(enum_field(value, 'volume_type') or '', ManagedStatus.UNKNOWN)
    return replace(asset, managed=status)


class VolumesAdapter:
    def __init__(self, api: 'VolumesAPI', cursors: CursorStore, identity_key: str) -> None:
        self.api, self.cursors, self.identity_key = api, cursors, identity_key

    @boundary
    def list_objects(self, catalog: str, schema: str, page_size: int, page_token: str | None) -> tuple[list[AssetSummary], str | None]:
        values, token = self.cursors.page(lambda: self.api.list(catalog_name=catalog, schema_name=schema, max_results=min(200, max(1, page_size))), f'{self.identity_key}:volumes:{catalog}:{schema}', page_size, page_token)
        return [map_volume(v) for v in values], token

    @boundary
    def get_asset(self, securable_type: str, full_name: str) -> AssetDetail:
        return map_volume(self.api.read(name=full_name))
