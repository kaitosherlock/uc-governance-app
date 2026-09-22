"""Frozen list and grant examples parse through the matching v1 DTOs."""

import json
from pathlib import Path

import pytest
from app.api.v1.models import AssetListResponse, GrantsResponse

ROOT = Path(__file__).resolve().parents[3]


@pytest.mark.parametrize(
    ("filename", "model"),
    [
        ("AssetListResponse.list-schema-objects.json", AssetListResponse),
        ("GrantsResponse.orders-table.json", GrantsResponse),
    ],
)
def test_examples_parse_and_round_trip_exactly(filename: str, model: object) -> None:
    body = json.loads((ROOT / "shared/contracts/examples" / filename).read_text(encoding="utf-8"))
    parsed = model.model_validate(body)  # type: ignore[union-attr]
    assert parsed.model_dump(mode="json", by_alias=True, exclude_unset=True) == body
