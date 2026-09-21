#!/usr/bin/env python
"""Validate the locked contract in shared/contracts/.

Run:
    uv run --with pyyaml --with jsonschema scripts/validate_contracts.py

Checks
  1. api-spec.yaml parses and every $ref resolves.
  2. Every example file is named <SchemaName>.<scenario>.json where <SchemaName> is an exact key of
     components.schemas, and the payload validates against that schema.
  3. Every operation documents a response schema for each declared status, and every 4xx/5xx
     response points at ErrorResponse.
  4. Enum parity between api-spec.yaml and types.ts for the enums listed in ENUM_PARITY.
  5. Every ErrorCode in the spec appears in error-codes.md and vice versa.

Exit code 0 only when every check passes. No network access, no Databricks calls.
"""

from __future__ import annotations

import json
import pathlib
import re
import sys
from typing import Any

import yaml
from jsonschema import Draft7Validator

ROOT = pathlib.Path(__file__).resolve().parents[1]
CONTRACTS = ROOT / "shared" / "contracts"
SPEC_PATH = CONTRACTS / "api-spec.yaml"
TYPES_PATH = CONTRACTS / "types.ts"
ERROR_DOC_PATH = CONTRACTS / "error-codes.md"
EXAMPLES_DIR = CONTRACTS / "examples"

# YAML enum name -> TypeScript type alias name in types.ts
ENUM_PARITY: dict[str, str] = {
    "ErrorCode": "ErrorCode",
    "DataSource": "DataSource",
    "Completeness": "Completeness",
    "AppMode": "AppMode",
    "AppRole": "AppRole",
    "ActorKind": "ActorKind",
    "CapabilityStatusValue": "CapabilityStatusValue",
    "SecurableType": "SecurableType",
    "ObjectKind": "ObjectKind",
    "ManagedStatus": "ManagedStatus",
    "ActionName": "ActionName",
    "TagKind": "TagKind",
    "AttachmentSource": "AttachmentSource",
    "PrincipalKind": "PrincipalKind",
    "PrincipalScope": "PrincipalScope",
    "PrivilegeCategory": "PrivilegeCategory",
    "GrantSourceType": "GrantSourceType",
    "PlanKind": "PlanKind",
    "PlanStatus": "PlanStatus",
    "OperationStatus": "OperationStatus",
    "TargetOutcomeStatus": "TargetOutcomeStatus",
    "DependencyKind": "DependencyKind",
    "AbacPolicyType": "AbacPolicyType",
    "LineageDirection": "LineageDirection",
    "AuditOutcome": "AuditOutcome",
    "AuditCorrelation": "AuditCorrelation",
    "FindingRule": "FindingRule",
    "FindingSeverity": "FindingSeverity",
    "AccessRequestStatus": "AccessRequestStatus",
    "WorkflowOwner": "WorkflowOwner",
}

failures: list[str] = []
checks_run = 0


def fail(msg: str) -> None:
    failures.append(msg)


def ok(msg: str) -> None:
    global checks_run
    checks_run += 1
    print(f"  PASS  {msg}")


# --------------------------------------------------------------------------- 1. load

def load_spec() -> dict[str, Any]:
    with SPEC_PATH.open(encoding="utf-8") as fh:
        spec = yaml.safe_load(fh)
    for key in ("openapi", "info", "paths", "components"):
        if key not in spec:
            fail(f"api-spec.yaml is missing top-level key '{key}'")
    return spec


def collect_refs(node: Any, acc: list[str]) -> None:
    if isinstance(node, dict):
        for key, value in node.items():
            if key == "$ref" and isinstance(value, str):
                acc.append(value)
            else:
                collect_refs(value, acc)
    elif isinstance(node, list):
        for item in node:
            collect_refs(item, acc)


def check_refs(spec: dict[str, Any]) -> None:
    refs: list[str] = []
    collect_refs(spec, refs)
    bad = []
    for ref in sorted(set(refs)):
        if not ref.startswith("#/"):
            bad.append(f"{ref} (only local refs are allowed)")
            continue
        node: Any = spec
        for part in ref.removeprefix("#/").split("/"):
            if not isinstance(node, dict) or part not in node:
                bad.append(ref)
                break
            node = node[part]
    if bad:
        fail(f"unresolved $ref(s): {', '.join(bad)}")
    else:
        ok(f"all {len(set(refs))} $ref targets resolve")


# ------------------------------------------------- 2. openapi 3.0 -> json schema

def to_json_schema(node: Any) -> Any:
    """Translate the OpenAPI 3.0 dialect into something Draft7Validator accepts."""
    if isinstance(node, list):
        return [to_json_schema(item) for item in node]
    if not isinstance(node, dict):
        return node

    out: dict[str, Any] = {}
    nullable = bool(node.get("nullable"))
    for key, value in node.items():
        if key == "nullable":
            continue
        if key == "$ref" and isinstance(value, str):
            out["$ref"] = value.replace("#/components/schemas/", "#/definitions/")
            continue
        if key == "example":
            continue
        out[key] = to_json_schema(value)

    if nullable:
        composed = any(k in out for k in ("allOf", "anyOf", "oneOf", "$ref"))
        if composed:
            # `type` beside a composition keyword is decorative in OpenAPI 3.0 and would make a
            # literal null fail the composition. Wrap instead.
            inner = {k: out.pop(k) for k in list(out) if k not in ("description", "type")}
            out.pop("type", None)
            out["anyOf"] = [inner, {"type": "null"}]
        elif "type" in out:
            types = out["type"] if isinstance(out["type"], list) else [out["type"]]
            if "null" not in types:
                out["type"] = [*types, "null"]
        elif "enum" in out:
            if None not in out["enum"]:
                out["enum"] = [*out["enum"], None]
        else:
            inner = {k: out.pop(k) for k in list(out) if k not in ("description",)}
            out["anyOf"] = [inner, {"type": "null"}]

    return out


def build_definitions(spec: dict[str, Any]) -> dict[str, Any]:
    return {name: to_json_schema(schema) for name, schema in spec["components"]["schemas"].items()}


# ------------------------------------------- 2b. structural traps YAML hides

# OpenAPI 3.0 Schema Object keywords. Anything else inside a schema position means a typo or, more
# often, an unquoted flow-mapping value containing a comma that YAML split into extra keys.
SCHEMA_KEYWORDS = {
    "title", "multipleOf", "maximum", "exclusiveMaximum", "minimum", "exclusiveMinimum",
    "maxLength", "minLength", "pattern", "maxItems", "minItems", "uniqueItems", "maxProperties",
    "minProperties", "required", "enum", "type", "allOf", "oneOf", "anyOf", "not", "items",
    "properties", "additionalProperties", "description", "format", "default", "nullable",
    "discriminator", "readOnly", "writeOnly", "xml", "externalDocs", "example", "deprecated",
    "$ref", "propertyNames", "const",
}


def walk_schema(node: Any, path: str, bad_keys: list[str], ref_siblings: list[str]) -> None:
    if isinstance(node, list):
        for idx, item in enumerate(node):
            walk_schema(item, f"{path}[{idx}]", bad_keys, ref_siblings)
        return
    if not isinstance(node, dict):
        return

    if "$ref" in node:
        extra = [k for k in node if k != "$ref"]
        if extra:
            ref_siblings.append(f"{path}: $ref with sibling key(s) {extra} (ignored by OpenAPI 3.0)")
        return

    for key in node:
        if key not in SCHEMA_KEYWORDS and not key.startswith("x-"):
            bad_keys.append(f"{path}.{key}")

    for key in ("items", "not", "additionalProperties"):
        if isinstance(node.get(key), dict):
            walk_schema(node[key], f"{path}.{key}", bad_keys, ref_siblings)
    for key in ("allOf", "anyOf", "oneOf"):
        if key in node:
            walk_schema(node[key], f"{path}.{key}", bad_keys, ref_siblings)
    for name, sub in (node.get("properties") or {}).items():
        walk_schema(sub, f"{path}.properties.{name}", bad_keys, ref_siblings)


def check_schema_structure(spec: dict[str, Any]) -> None:
    bad_keys: list[str] = []
    ref_siblings: list[str] = []
    for name, schema in spec["components"]["schemas"].items():
        walk_schema(schema, name, bad_keys, ref_siblings)
    for path, methods in spec["paths"].items():
        for method, operation in methods.items():
            if not isinstance(operation, dict):
                continue
            for status, response in (operation.get("responses") or {}).items():
                schema = (
                    response.get("content", {}).get("application/json", {}).get("schema")
                    if isinstance(response, dict)
                    else None
                )
                if schema:
                    walk_schema(schema, f"{method.upper()} {path} {status}", bad_keys, ref_siblings)

    if bad_keys:
        fail(
            "unexpected keys inside schema objects (usually an unquoted description containing a "
            f"comma): {', '.join(bad_keys[:12])}"
        )
    else:
        ok("no stray keys inside schema objects")

    if ref_siblings:
        fail("; ".join(ref_siblings[:12]))
    else:
        ok("no $ref has sibling keys")


# --------------------------------------------------------------------------- 3. examples

def check_examples(spec: dict[str, Any], definitions: dict[str, Any]) -> None:
    files = sorted(EXAMPLES_DIR.glob("*.json"))
    if not files:
        fail("no example files found in shared/contracts/examples/")
        return
    for path in files:
        parts = path.name.split(".")
        if len(parts) < 3 or parts[-1] != "json":
            fail(f"{path.name}: expected <SchemaName>.<scenario>.json")
            continue
        schema_name = parts[0]
        if schema_name not in definitions:
            fail(f"{path.name}: '{schema_name}' is not a key of components.schemas")
            continue
        payload = json.loads(path.read_text(encoding="utf-8"))
        validator = Draft7Validator(
            {"$ref": f"#/definitions/{schema_name}", "definitions": definitions}
        )
        errors = sorted(validator.iter_errors(payload), key=lambda e: list(e.absolute_path))
        if errors:
            for err in errors[:6]:
                where = "/".join(str(p) for p in err.absolute_path) or "(root)"
                fail(f"{path.name}: {where}: {err.message}")
        else:
            ok(f"{path.name} validates against {schema_name}")


# --------------------------------------------------------------------------- 4. responses

ERROR_STATUS = re.compile(r"^[45]\d\d$")


def check_response_shapes(spec: dict[str, Any]) -> None:
    problems = 0
    operations = 0
    for path, methods in spec["paths"].items():
        for method, operation in methods.items():
            if method not in {"get", "post", "put", "patch", "delete"}:
                continue
            operations += 1
            responses = operation.get("responses", {})
            if not responses:
                fail(f"{method.upper()} {path}: no responses declared")
                problems += 1
                continue
            for status, response in responses.items():
                resolved = response
                if "$ref" in response:
                    node: Any = spec
                    for part in response["$ref"].removeprefix("#/").split("/"):
                        node = node[part]
                    resolved = node
                schema = (
                    resolved.get("content", {}).get("application/json", {}).get("schema", {})
                )
                if not schema:
                    fail(f"{method.upper()} {path} {status}: response has no JSON schema")
                    problems += 1
                    continue
                if ERROR_STATUS.match(str(status)):
                    ref = schema.get("$ref", "")
                    if not ref.endswith("/ErrorResponse"):
                        fail(
                            f"{method.upper()} {path} {status}: error response must $ref ErrorResponse"
                        )
                        problems += 1
    if not problems:
        ok(f"all {operations} operations declare JSON schemas; every 4xx/5xx uses ErrorResponse")


# --------------------------------------------------------------------------- 5. enum parity

TS_UNION = re.compile(
    r"export\s+type\s+(?P<name>\w+)\s*=\s*(?P<body>[^;]+);",
    re.MULTILINE,
)


def ts_unions(text: str) -> dict[str, set[str]]:
    found: dict[str, set[str]] = {}
    for match in TS_UNION.finditer(text):
        body = match.group("body")
        members = set(re.findall(r"'([^']+)'", body))
        if members:
            found[match.group("name")] = members
    return found


def check_enum_parity(spec: dict[str, Any]) -> None:
    schemas = spec["components"]["schemas"]
    unions = ts_unions(TYPES_PATH.read_text(encoding="utf-8"))
    mismatches = 0
    for yaml_name, ts_name in ENUM_PARITY.items():
        schema = schemas.get(yaml_name)
        if schema is None or "enum" not in schema:
            fail(f"enum parity: components.schemas.{yaml_name} missing or has no enum")
            mismatches += 1
            continue
        spec_values = {v for v in schema["enum"] if v is not None}
        ts_values = unions.get(ts_name)
        if ts_values is None:
            fail(f"enum parity: types.ts has no union type '{ts_name}'")
            mismatches += 1
            continue
        only_spec = spec_values - ts_values
        only_ts = ts_values - spec_values
        if only_spec or only_ts:
            fail(
                f"enum parity {yaml_name}/{ts_name}: only in spec={sorted(only_spec)} "
                f"only in types.ts={sorted(only_ts)}"
            )
            mismatches += 1
    if not mismatches:
        ok(f"{len(ENUM_PARITY)} enums match between api-spec.yaml and types.ts")


# --------------------------------------------------------------------------- 6. error-codes.md

def check_error_doc(spec: dict[str, Any]) -> None:
    codes = {v for v in spec["components"]["schemas"]["ErrorCode"]["enum"]}
    doc = ERROR_DOC_PATH.read_text(encoding="utf-8")
    documented = set(re.findall(r"^\|\s*`([A-Z_]+)`\s*\|", doc, re.MULTILINE))
    missing = codes - documented
    extra = documented - codes
    if missing or extra:
        fail(
            f"error-codes.md: undocumented={sorted(missing)} unknown={sorted(extra)}"
        )
    else:
        ok(f"error-codes.md documents all {len(codes)} error codes")


# --------------------------------------------------------------------------- main

def main() -> int:
    print(f"Validating contract in {CONTRACTS.relative_to(ROOT)}")
    spec = load_spec()
    if failures:
        report()
        return 1
    print(
        f"  spec: openapi {spec['openapi']}, version {spec['info']['version']}, "
        f"{len(spec['paths'])} paths, {len(spec['components']['schemas'])} schemas"
    )
    check_refs(spec)
    check_schema_structure(spec)
    definitions = build_definitions(spec)
    check_examples(spec, definitions)
    check_response_shapes(spec)
    check_enum_parity(spec)
    check_error_doc(spec)
    return report()


def report() -> int:
    print()
    if failures:
        print(f"FAILED: {len(failures)} problem(s)")
        for item in failures:
            print(f"  FAIL  {item}")
        return 1
    print(f"OK: {checks_run} checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
