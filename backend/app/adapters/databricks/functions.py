"""Allowlisted function SDK reads, with bounded continuation."""

from typing import TYPE_CHECKING

from app.adapters.databricks.common import CursorStore, base_asset, boundary, enum_field, text_field
from app.domain.enums import DependencyKind, ObjectKind, SecurableType
from app.domain.models import (
    AssetDetail,
    AssetSummary,
    Dependency,
    FunctionDetail,
    FunctionParameter,
)

if TYPE_CHECKING:
    from databricks.sdk.service.catalog import FunctionsAPI


@boundary
def map_function(value: object) -> AssetDetail:
    return base_asset(value, SecurableType.FUNCTION, ObjectKind.FUNCTION)


def _dependencies(value: object) -> tuple[Dependency, ...]:
    raw = getattr(getattr(value, "routine_dependencies", None), "dependencies", None)
    if not isinstance(raw, list):
        return ()
    result: list[Dependency] = []
    for item in raw:
        function = text_field(getattr(item, "function", None), "function_full_name")
        table = text_field(getattr(item, "table", None), "table_full_name")
        if function:
            result.append(
                Dependency(
                    kind=DependencyKind.POLICY_FUNCTION,
                    full_name=function,
                    source="unity_catalog_api",
                    verified=True,
                )
            )
        elif table:
            result.append(
                Dependency(
                    kind=DependencyKind.DOWNSTREAM_TABLE,
                    full_name=table,
                    source="unity_catalog_api",
                    verified=True,
                )
            )
    return tuple(result)


@boundary
def map_function_detail(value: object) -> FunctionDetail:
    raw_parameters = getattr(getattr(value, "input_params", None), "parameters", None)
    parameters: tuple[FunctionParameter, ...] = ()
    if isinstance(raw_parameters, list):
        parameters = tuple(
            FunctionParameter(
                name=text_field(item, "name") or "Unavailable",
                type_text=text_field(item, "type_text") or "Unavailable",
                position=getattr(item, "position", -1)
                if isinstance(getattr(item, "position", None), int)
                else -1,
            )
            for item in raw_parameters
        )
    return FunctionDetail(
        full_name=text_field(value, "full_name") or "Unavailable",
        owner=text_field(value, "owner"),
        comment=text_field(value, "comment"),
        return_type=text_field(value, "full_data_type") or enum_field(value, "data_type"),
        parameters=parameters,
        language=enum_field(value, "external_language"),
        dependents=_dependencies(value),
        used_as_policy_function=None,
        allowed_actions=(),
    )


class FunctionsAdapter:
    def __init__(self, api: "FunctionsAPI", cursors: CursorStore, identity_key: str) -> None:
        self.api, self.cursors, self.identity_key = api, cursors, identity_key

    @boundary
    def list_objects(
        self, catalog: str, schema: str, page_size: int, page_token: str | None
    ) -> tuple[list[AssetSummary], str | None]:
        values, token = self.cursors.page(
            lambda: self.api.list(
                catalog_name=catalog, schema_name=schema, max_results=min(200, max(1, page_size))
            ),
            f"{self.identity_key}:functions:{catalog}:{schema}",
            page_size,
            page_token,
        )
        return [map_function(v) for v in values], token

    @boundary
    def get_asset(self, securable_type: str, full_name: str) -> AssetDetail:
        return map_function(self.api.get(name=full_name))

    @boundary
    def get_function(self, full_name: str) -> FunctionDetail:
        return map_function_detail(self.api.get(name=full_name, include_browse=True))
