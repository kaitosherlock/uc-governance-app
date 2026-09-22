import json
from pathlib import Path

from app.domain.enums import PrivilegeCategory, SecurableType
from app.domain.privileges import catalogue

CODES = json.loads((Path(__file__).parents[2] / 'app/fixtures_data/privilege_codes.json').read_text())


def test_all_enum_codes_retained_and_unknown_codes_not_offered() -> None:
    result = catalogue([*CODES, 'FUTURE_UNKNOWN'])
    assert {p.code for p in result} == set(CODES) | {'FUTURE_UNKNOWN'}
    assert next(p for p in result if p.code == 'FUTURE_UNKNOWN').securable_types == ()
    assert all(p.code != 'FUTURE_UNKNOWN' for p in catalogue([*CODES, 'FUTURE_UNKNOWN'], 'TABLE'))


def test_catalogue_covers_every_contract_securable_type() -> None:
    for stype in SecurableType:
        values = catalogue(CODES, stype)
        assert values, stype
        assert all(stype in p.securable_types for p in values)


def test_all_privileges_is_not_administrative_or_expanded() -> None:
    values = {p.code: p for p in catalogue(CODES, 'TABLE')}
    assert values['ALL_PRIVILEGES'].category == PrivilegeCategory.ALL
    assert 'not every administrative privilege' in values['ALL_PRIVILEGES'].description
    assert 'does not include MANAGE' in values['ALL_PRIVILEGES'].description
    assert values['MANAGE'].category == PrivilegeCategory.MANAGE
    assert values['SELECT'].label == 'Read data'
    assert values['SELECT'].prerequisites == ('USE_CATALOG', 'USE_SCHEMA')
    assert 'USE_CATALOG' not in values and 'BROWSE' not in values


def test_fixture_enum_snapshot_matches_pinned_sdk() -> None:
    from databricks.sdk.service.catalog import Privilege

    assert set(CODES) == {p.value for p in Privilege}
