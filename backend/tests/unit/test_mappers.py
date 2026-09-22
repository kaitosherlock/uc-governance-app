"""The mapper boundary never admits secret-like SDK fields to a wire DTO."""

import re
from types import SimpleNamespace

import pytest
from app.adapters.databricks.catalogs import map_catalog
from app.adapters.databricks.functions import map_function
from app.adapters.databricks.models import map_registered_model
from app.adapters.databricks.schemas import map_schema
from app.adapters.databricks.tables import map_table
from app.adapters.databricks.volumes import map_volume
from app.api.mappers import map_AssetDetail


def assert_safe_keys(value: object) -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            assert key == "credential_name" or not re.search(
                r"token|secret|password|credential",
                key,
                re.IGNORECASE,
            )
            assert_safe_keys(child)
    elif isinstance(value, list):
        for child in value:
            assert_safe_keys(child)


@pytest.mark.parametrize(
    "mapper",
    [map_catalog, map_schema, map_table, map_volume, map_function, map_registered_model],
)
def test_sdk_mapping_uses_an_explicit_allowlist(mapper: object) -> None:
    value = SimpleNamespace(
        name="orders",
        full_name="sales.crm.orders",
        table_type="MANAGED",
        owner="synthetic-owner",
        password="DO-NOT-RETURN",
        token="DO-NOT-RETURN",
        client_secret="DO-NOT-RETURN",
        credentials={"nested": "DO-NOT-RETURN"},
        properties={"password": "DO-NOT-RETURN", "arbitrary": "DO-NOT-RETURN"},
        options={"password": "DO-NOT-RETURN"},
    )
    mapped = mapper(value)  # type: ignore[operator]
    body = map_AssetDetail(mapped).model_dump(mode="json")
    assert_safe_keys(body)
    assert "DO-NOT-RETURN" not in str(body)


@pytest.mark.parametrize(
    ("table_type", "kind"),
    [
        ("MANAGED", "table"),
        ("EXTERNAL", "table"),
        ("VIEW", "view"),
        ("MATERIALIZED_VIEW", "materialized_view"),
        ("STREAMING_TABLE", "streaming_table"),
    ],
)
def test_table_kind_comes_only_from_sdk_table_type(table_type: str, kind: str) -> None:
    result = map_table(
        SimpleNamespace(
            name="misleading_view_name",
            full_name="sales.crm.misleading_view_name",
            table_type=table_type,
            pipeline_id="synthetic-pipeline",
        ),
    )
    assert result.kind == kind
    assert result.pipeline_managed is True


def test_missing_management_evidence_stays_unknown() -> None:
    result = map_table(
        SimpleNamespace(
            name="orders", full_name="sales.crm.orders", table_type="MATERIALIZED_VIEW"
        ),
    )
    assert result.managed == "unknown"
    assert result.pipeline_managed is None
