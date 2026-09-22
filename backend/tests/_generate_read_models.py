"""One-shot local generation from the frozen contract (no network)."""
from pathlib import Path
import yaml

root = Path(__file__).resolve().parents[2]
schemas = yaml.safe_load((root / 'shared/contracts/api-spec.yaml').read_text())['components']['schemas']
names = ['SecurableType','ObjectKind','ManagedStatus','ActionName','TagKind','AttachmentSource','DependencyKind','PrincipalKind','PrincipalScope','PrivilegeCategory','GrantSourceType']
objects = ['AllowedAction','AssetRef','AssetSummary','Tag','RowFilterRef','ColumnMaskRef','Column','AssetDetail','Dependency','Principal','Privilege','GrantSource','Grant','GrantsData']
enum = '"""Frozen contract vocabulary, independent of SDK and wire models."""\nfrom enum import StrEnum\n'
for name in names:
    enum += f'\n\nclass {name}(StrEnum):\n'
    enum += ''.join(f'    {v.upper()} = {v!r}\n' for v in schemas[name]['enum'])
folder = root / 'backend/app/domain'
folder.mkdir(exist_ok=True)
(folder/'__init__.py').write_text('"""Governance domain."""\n')
(folder/'enums.py').write_text(enum)

def flatten(name):
    s = schemas[name]
    props = dict(s.get('properties', {})); required = list(s.get('required', []))
    for p in s.get('allOf', []):
        pp, rr = flatten(p['$ref'].split('/')[-1]) if '$ref' in p else (p['properties'], p['required'])
        props.update(pp); required += rr
    return props, required

def typ(s, domain):
    if '$ref' in s: t = s['$ref'].split('/')[-1]
    elif 'allOf' in s: t = s['allOf'][0]['$ref'].split('/')[-1]
    elif s.get('format') == 'date-time': t = 'datetime' if domain else 'UtcTimestamp'
    elif s['type'] == 'array': t = f"tuple[{typ(s['items'],domain)}, ...]" if domain else f"list[{typ(s['items'],domain)}]"
    elif s['type'] == 'object': t = 'dict[str, str]' if isinstance(s.get('additionalProperties'), dict) else 'dict[str, object]'
    else: t = {'string':'str','boolean':'bool','integer':'int'}[s['type']]
    if s.get('enum') and s['type'] == 'string':
        t = 'Literal[' + ', '.join(repr(x) for x in s['enum'] if x is not None) + ']'
    if s.get('nullable'): t += ' | None'
    return t

imports = 'from app.domain.enums import (' + ', '.join(names) + ')\n'
domain = '"""Frozen domain dataclasses; no SDK or API dependencies."""\nfrom dataclasses import dataclass\nfrom datetime import datetime\nfrom typing import Literal\n' + imports
wire = '\n\n# Phase 1 read DTOs.\n' + imports
for name in objects:
    props, required = flatten(name)
    domain += f'\n\n@dataclass(frozen=True, kw_only=True)\nclass {name}:\n'
    wire += f'\n\nclass {name}(ContractModel):\n'
    for key,s in props.items():
        default = '' if key in required else ' = None'
        domain += f'    {key}: {typ(s,True)}{default}\n'
        wire += f'    {key}: {typ(s,False)}{default}\n'
domain += '\n\n@dataclass(frozen=True)\nclass DependenciesData:\n    known: tuple[Dependency, ...]\n    disclaimer: str\n'
wire += '\n\nclass DependenciesData(ContractModel):\n    known: list[Dependency]\n    disclaimer: str\n'
for name,data,page in [('AssetListResponse','list[AssetSummary]',True),('AssetDetailResponse','AssetDetail',False),('DependenciesResponse','DependenciesData',False),('PrincipalListResponse','list[Principal]',True),('PrivilegeListResponse','list[Privilege]',False),('GrantsResponse','GrantsData',False)]:
    wire += f'\n\nclass {name}(SuccessResponse[{data}]):\n' + ('    page: Page\n' if page else '    pass\n')
# Dependency.source uses the contract's data-source enum without depending on API.
domain = domain.replace('source: DataSource','source: Literal["unity_catalog_api", "account_api", "system_table", "durable_store", "application", "fixture"]')
(folder/'models.py').write_text(domain)
p = root/'backend/app/api/v1/models.py'
p.write_text(p.read_text()+wire)
# Explicit wire allowlists; no SDK object can reach these functions.
mapper = '"""Explicit domain-to-wire mapping."""\nfrom app.domain import models as d\nfrom app.api.v1 import models as w\n'
for name in objects + ['DependenciesData']:
    props = flatten(name)[0] if name != 'DependenciesData' else {'known':{'type':'array','items':{'$ref':'#/Dependency'}},'disclaimer':{'type':'string'}}
    mapper += f'\n\ndef map_{name}(value: d.{name}) -> w.{name}:\n    return w.{name}(\n'
    for key,s in props.items():
        ref = s.get('$ref',s.get('allOf',[{}])[0].get('$ref','')).split('/')[-1]
        item = s.get('items',{}).get('$ref','').split('/')[-1]
        expr = f'value.{key}'
        if ref in objects: expr = f'map_{ref}({expr})' + (f' if value.{key} is not None else None' if s.get('nullable') else '')
        elif s.get('type') == 'array': expr = f'[map_{item}(x) for x in {expr}]' if item in objects else f'list({expr})'
        elif key == 'source' and name == 'Dependency': expr = f'w.DataSource({expr})'
        mapper += f'        {key}={expr},\n'
    mapper += '    )\n'
(root/'backend/app/api/mappers.py').write_text(mapper)
