"""One-shot boilerplate generation; SDK names verified against installed source."""
from pathlib import Path

folder = Path(__file__).resolve().parents[1] / 'app/adapters/databricks'
for module, cls, api, kind, method, get_method, get_arg in [
    ('catalogs','CatalogsAdapter','CatalogsAPI','catalog','list_catalogs','get','name'),
    ('schemas','SchemasAdapter','SchemasAPI','schema','list_schemas','get','full_name'),
    ('volumes','VolumesAdapter','VolumesAPI','volume','list_objects','read','name'),
    ('functions','FunctionsAdapter','FunctionsAPI','function','list_objects','get','name'),
    ('models','ModelsAdapter','RegisteredModelsAPI','registered_model','list_objects','get','full_name'),
]:
    args = '' if kind == 'catalog' else 'catalog: str, ' if kind == 'schema' else 'catalog: str, schema: str, '
    kwargs = '' if kind == 'catalog' else 'catalog_name=catalog, ' if kind == 'schema' else 'catalog_name=catalog, schema_name=schema, '
    key = '' if kind == 'catalog' else ':{catalog}' if kind == 'schema' else ':{catalog}:{schema}'
    source = f'''"""Allowlisted {kind} SDK reads, with bounded continuation."""
from typing import TYPE_CHECKING
from app.adapters.databricks.common import CursorStore, base_asset, boundary
from app.domain.enums import ObjectKind, SecurableType
from app.domain.models import AssetDetail, AssetSummary
if TYPE_CHECKING:
    from databricks.sdk.service.catalog import {api}


@boundary
def map_{kind}(value: object) -> AssetDetail:
    return base_asset(value, SecurableType.{kind.upper()}, ObjectKind.{kind.upper()})


class {cls}:
    def __init__(self, api: '{api}', cursors: CursorStore, identity_key: str) -> None:
        self.api, self.cursors, self.identity_key = api, cursors, identity_key

    @boundary
    def {method}(self, {args}page_size: int, page_token: str | None) -> tuple[list[AssetSummary], str | None]:
        values, token = self.cursors.page(lambda: self.api.list({kwargs}max_results=min(200, max(1, page_size))), f'{{self.identity_key}}:{module}{key}', page_size, page_token)
        return [map_{kind}(v) for v in values], token

    @boundary
    def get_asset(self, securable_type: str, full_name: str) -> AssetDetail:
        return map_{kind}(self.api.{get_method}({get_arg}=full_name))
'''
    if kind == 'volume':
        source = source.replace('from typing import', 'from dataclasses import replace\nfrom typing import')
        source = source.replace('CursorStore, base_asset, boundary', 'CursorStore, base_asset, boundary, enum_field')
        source = source.replace('ObjectKind, SecurableType','ManagedStatus, ObjectKind, SecurableType')
        source = source.replace('    return base_asset(value, SecurableType.VOLUME, ObjectKind.VOLUME)', '''    asset = base_asset(value, SecurableType.VOLUME, ObjectKind.VOLUME)
    status = {'MANAGED': ManagedStatus.MANAGED, 'EXTERNAL': ManagedStatus.EXTERNAL}.get(enum_field(value, 'volume_type') or '', ManagedStatus.UNKNOWN)
    return replace(asset, managed=status)''')
    (folder/f'{module}.py').write_text(source)
