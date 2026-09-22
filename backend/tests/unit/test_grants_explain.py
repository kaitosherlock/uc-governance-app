from types import SimpleNamespace

from app.adapters.databricks.grants import map_grants, map_source
from app.domain.enums import GrantSourceType
from app.domain.reads import MEMBERSHIP_LIMITATION


def test_sdk_effective_sources_are_classified_without_guessing() -> None:
    direct = map_source(SimpleNamespace(), 'TABLE', 'sales.crm.orders')
    inherited = map_source(SimpleNamespace(inherited_from_type='SCHEMA', inherited_from_name='sales.crm'), 'TABLE', 'sales.crm.orders')
    unknown = map_source(SimpleNamespace(inherited_from_type='SCHEMA'), 'TABLE', 'sales.crm.orders')
    assert direct.type == GrantSourceType.DIRECT
    assert inherited.type == GrantSourceType.INHERITED
    assert inherited.full_name == 'sales.crm'
    assert unknown.type == GrantSourceType.UNKNOWN


def test_direct_and_effective_sdk_privileges_map_to_exact_codes() -> None:
    direct = SimpleNamespace(privilege_assignments=[SimpleNamespace(principal='analysts', privileges=['SELECT'])])
    effective = SimpleNamespace(privilege_assignments=[SimpleNamespace(principal='analysts', privileges=[SimpleNamespace(privilege='SELECT', inherited_from_type='CATALOG', inherited_from_name='sales')])])
    assert map_grants(direct, 'TABLE', 'sales.crm.orders', False)[0].privilege == 'SELECT'
    assert map_grants(effective, 'TABLE', 'sales.crm.orders', True)[0].source.full_name == 'sales'


def test_fixture_grants_disclose_membership_and_parent_routes(client) -> None:
    body = client.get('/api/v1/assets/TABLE/sales.crm.orders/grants').json()
    assert MEMBERSHIP_LIMITATION in body['meta']['limitations']
    assert body['data']['group_membership_loaded'] is False
    inherited = body['data']['inherited']
    assert {g['source']['securable_type'] for g in inherited} == {'CATALOG', 'SCHEMA'}
    assert {g['allowed_actions'][0]['navigate_to'] for g in inherited} == {'/assets/sales?tab=access', '/assets/sales/crm?tab=access'}
    assert all(g['allowed_actions'][0]['allowed'] is False for g in inherited)
    assert all(g['allowed_actions'][0]['reason_code'] == 'INHERITED_FROM_PARENT' for g in inherited)
