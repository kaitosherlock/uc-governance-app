"""Versioned applicability policy over every code supplied by the SDK boundary.

Unknown/new and legacy codes remain catalogued but are not offered for a target
until their applicability is established. ALL_PRIVILEGES is never expanded.
"""
from collections.abc import Iterable

from app.domain.enums import PrivilegeCategory, SecurableType
from app.domain.models import Privilege

CHILDREN = ('CATALOG', 'SCHEMA', 'TABLE')
SCHEMA_OBJECTS = ('TABLE', 'VOLUME', 'FUNCTION', 'REGISTERED_MODEL')
APPLICABILITY: dict[str, tuple[str, ...]] = {
    'ALL_PRIVILEGES': ('CATALOG', 'SCHEMA', *SCHEMA_OBJECTS, 'STORAGE_CREDENTIAL', 'CREDENTIAL', 'EXTERNAL_LOCATION', 'CONNECTION'),
    'BROWSE': ('CATALOG',), 'USE_CATALOG': ('CATALOG',), 'USE_SCHEMA': ('SCHEMA',),
    'MANAGE': ('CATALOG', 'SCHEMA', *SCHEMA_OBJECTS, 'STORAGE_CREDENTIAL', 'CREDENTIAL', 'EXTERNAL_LOCATION', 'CONNECTION'),
    'APPLY_TAG': ('CATALOG', 'SCHEMA', *SCHEMA_OBJECTS),
    'SELECT': CHILDREN, 'MODIFY': CHILDREN,
    'EXECUTE': ('CATALOG', 'SCHEMA', 'FUNCTION', 'REGISTERED_MODEL', 'CREDENTIAL'),
    'READ_VOLUME': ('CATALOG', 'SCHEMA', 'VOLUME'), 'WRITE_VOLUME': ('CATALOG', 'SCHEMA', 'VOLUME'),
    'CREATE_CATALOG': ('METASTORE',), 'CREATE_CONNECTION': ('METASTORE',),
    'CREATE_CLEAN_ROOM': ('METASTORE',), 'CREATE_EXTERNAL_LOCATION': ('METASTORE', 'STORAGE_CREDENTIAL'),
    'CREATE_EXTERNAL_TABLE': ('EXTERNAL_LOCATION', 'STORAGE_CREDENTIAL'),
    'CREATE_EXTERNAL_VOLUME': ('EXTERNAL_LOCATION',), 'CREATE_FOREIGN_CATALOG': ('CONNECTION',),
    'CREATE_FOREIGN_SECURABLE': ('CONNECTION',),
    'CREATE_FUNCTION': ('CATALOG', 'SCHEMA'), 'CREATE_MANAGED_STORAGE': ('EXTERNAL_LOCATION',),
    'CREATE_MATERIALIZED_VIEW': ('CATALOG', 'SCHEMA'), 'CREATE_MODEL': ('CATALOG', 'SCHEMA'),
    'CREATE_PROVIDER': ('METASTORE',), 'CREATE_RECIPIENT': ('METASTORE',),
    'CREATE_SCHEMA': ('CATALOG',), 'CREATE_SERVICE_CREDENTIAL': ('METASTORE',),
    'CREATE_SHARE': ('METASTORE',), 'CREATE_STORAGE_CREDENTIAL': ('METASTORE',),
    'CREATE_TABLE': ('CATALOG', 'SCHEMA'), 'CREATE_VIEW': ('CATALOG', 'SCHEMA'),
    'CREATE_VOLUME': ('CATALOG', 'SCHEMA'),
    'EXTERNAL_USE_LOCATION': ('EXTERNAL_LOCATION',), 'EXTERNAL_USE_SCHEMA': ('SCHEMA',),
    'MANAGE_ALLOWLIST': ('METASTORE',),
    'READ_FILES': ('EXTERNAL_LOCATION', 'STORAGE_CREDENTIAL'),
    'WRITE_FILES': ('EXTERNAL_LOCATION', 'STORAGE_CREDENTIAL'),
    'READ_METADATA': ('METASTORE',), 'REFRESH': CHILDREN,
    'SET_SHARE_PERMISSION': ('METASTORE', 'SHARE'),
    'USE_CONNECTION': ('CONNECTION',), 'USE_MARKETPLACE_ASSETS': ('METASTORE',),
    'USE_PROVIDER': ('METASTORE', 'PROVIDER'), 'USE_RECIPIENT': ('METASTORE', 'RECIPIENT'),
    'USE_SHARE': ('METASTORE', 'SHARE'),
}
LABELS = {'SELECT': 'Read data', 'BROWSE': 'Discover metadata', 'USE_CATALOG': 'Use catalog',
          'USE_SCHEMA': 'Use schema', 'MANAGE': 'Manage permissions', 'ALL_PRIVILEGES': 'All applicable privileges',
          'MODIFY': 'Modify data', 'EXECUTE': 'Execute function or model'}
DESCRIPTIONS = {
    'ALL_PRIVILEGES': 'All applicable privileges evaluated by Unity Catalog at use time. This is not every administrative privilege: it does not include MANAGE, EXTERNAL_USE_SCHEMA, or EXTERNAL_USE_LOCATION.',
    'MANAGE': 'Manage permissions on the securable; this does not itself grant access to its data.',
    'BROWSE': 'Discover catalog metadata without granting access to the underlying data.',
    'USE_CATALOG': 'Use this catalog as a parent prerequisite; this alone does not grant data access.',
    'USE_SCHEMA': 'Use this schema as a parent prerequisite; USE_CATALOG is also needed.',
}


def catalogue(codes: Iterable[str], securable_type: str | None = None) -> tuple[Privilege, ...]:
    values: list[Privilege] = []
    for code in sorted(set(codes)):
        targets = APPLICABILITY.get(code, ())
        if securable_type is not None and securable_type not in targets:
            continue
        category = PrivilegeCategory.OBJECT_SPECIFIC
        if code == 'ALL_PRIVILEGES':
            category = PrivilegeCategory.ALL
        elif code == 'BROWSE':
            category = PrivilegeCategory.BROWSE
        elif code.startswith('USE_'):
            category = PrivilegeCategory.USE
        elif code.startswith('CREATE_'):
            category = PrivilegeCategory.CREATE
        elif code.startswith('MANAGE') or code == 'SET_SHARE_PERMISSION':
            category = PrivilegeCategory.MANAGE
        elif code == 'SELECT' or code.startswith('READ_'):
            category = PrivilegeCategory.READ
        elif code == 'MODIFY' or code.startswith('WRITE_'):
            category = PrivilegeCategory.WRITE
        prerequisites: tuple[str, ...] = ()
        if securable_type in SCHEMA_OBJECTS:
            prerequisites = ('USE_CATALOG', 'USE_SCHEMA')
        elif securable_type == 'SCHEMA':
            prerequisites = ('USE_CATALOG',)
        label = LABELS.get(code, code.replace('_', ' ').capitalize())
        description = DESCRIPTIONS.get(code, f'{label} on the listed securable types.')
        if not targets:
            description = 'SDK privilege code retained for completeness. Applicability to this API is unverified; it is not offered for grants.'
        values.append(Privilege(code=code, label=label, description=description, category=category,
            securable_types=tuple(SecurableType(t) for t in targets), prerequisites=prerequisites))
    return tuple(values)
