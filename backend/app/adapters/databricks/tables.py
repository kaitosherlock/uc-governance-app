"""Table types and policy references mapped from allowlisted SDK fields."""
from dataclasses import replace
from typing import TYPE_CHECKING

from app.adapters.databricks.common import CursorStore, base_asset, boundary, enum_field, items_field, text_field
from app.domain.enums import AttachmentSource, ManagedStatus, ObjectKind, SecurableType
from app.domain.models import AssetDetail, AssetSummary, Column, ColumnMaskRef, RowFilterRef
from app.errors import NotImplementedYet, UpstreamUnavailable

if TYPE_CHECKING:
    from databricks.sdk.service.catalog import TablesAPI


@boundary
def map_table(value: object) -> AssetDetail:
    table_type = enum_field(value, 'table_type')
    kinds = {'MANAGED': ObjectKind.TABLE, 'EXTERNAL': ObjectKind.TABLE,
             'MANAGED_SHALLOW_CLONE': ObjectKind.TABLE, 'EXTERNAL_SHALLOW_CLONE': ObjectKind.TABLE,
             'FOREIGN': ObjectKind.TABLE, 'VIEW': ObjectKind.VIEW,
             'MATERIALIZED_VIEW': ObjectKind.MATERIALIZED_VIEW, 'STREAMING_TABLE': ObjectKind.STREAMING_TABLE}
    if table_type not in kinds:
        raise NotImplementedYet('This SDK table type cannot be represented by the current object-kind catalogue.')
    asset = base_asset(value, SecurableType.TABLE, kinds[table_type])
    managed = ManagedStatus.UNKNOWN
    if table_type in ('MANAGED', 'MANAGED_SHALLOW_CLONE'):
        managed = ManagedStatus.MANAGED
    elif table_type in ('EXTERNAL', 'EXTERNAL_SHALLOW_CLONE'):
        managed = ManagedStatus.EXTERNAL
    elif table_type == 'VIEW':
        managed = ManagedStatus.NOT_APPLICABLE
    columns: list[Column] = []
    for item in items_field(value, 'columns'):
        name, type_text = text_field(item, 'name'), text_field(item, 'type_text')
        position = getattr(item, 'position', None)
        if name is None or type_text is None or not isinstance(position, int):
            raise UpstreamUnavailable('Databricks returned incomplete column metadata.')
        mask = getattr(item, 'mask', None)
        function = text_field(mask, 'function_name')
        nullable = getattr(item, 'nullable', None)
        columns.append(Column(name=name, type_text=type_text,
            nullable=nullable if isinstance(nullable, bool) else None,
            comment=text_field(item, 'comment'), position=position, tags=(),
            mask=ColumnMaskRef(column=name, function_full_name=function,
                using_columns=tuple(x for x in items_field(mask, 'using_column_names') if isinstance(x, str)),
                attached_via=AttachmentSource.UNKNOWN) if function else None))
    row = getattr(value, 'row_filter', None)
    function = text_field(row, 'function_name')
    # No arbitrary properties, credential locations, definitions or raw payloads.
    props = getattr(value, 'properties', None)
    safe_props: dict[str, str] = {}
    if isinstance(props, dict):
        for key in ('delta.enableChangeDataFeed', 'delta.enableDeletionVectors', 'delta.minReaderVersion', 'delta.minWriterVersion'):
            prop = props.get(key)
            if isinstance(prop, str) and prop in ('true', 'false', '1', '2', '3', '4', '5', '6', '7'):
                safe_props[key] = prop
    return replace(asset, table_type=table_type, managed=managed,
        pipeline_managed=True if text_field(value, 'pipeline_id') else None,
        data_source_format=enum_field(value, 'data_source_format'), properties=safe_props,
        columns=tuple(columns), row_filter=RowFilterRef(function_full_name=function,
            input_columns=tuple(x for x in items_field(row, 'input_column_names') if isinstance(x, str)),
            attached_via=AttachmentSource.UNKNOWN) if function else None)


class TablesAdapter:
    def __init__(self, api: 'TablesAPI', cursors: CursorStore, identity_key: str) -> None:
        self.api, self.cursors, self.identity_key = api, cursors, identity_key

    @boundary
    def list_objects(self, catalog: str, schema: str, page_size: int, page_token: str | None) -> tuple[list[AssetSummary], str | None]:
        values, token = self.cursors.page(lambda: self.api.list(catalog_name=catalog, schema_name=schema, max_results=min(200, max(1, page_size)), omit_columns=True, omit_properties=True), f'{self.identity_key}:tables:{catalog}:{schema}', page_size, page_token)
        return [map_table(v) for v in values], token

    @boundary
    def get_asset(self, securable_type: str, full_name: str) -> AssetDetail:
        return map_table(self.api.get(full_name=full_name))
