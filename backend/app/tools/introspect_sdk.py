"""Offline SDK shape discovery; never construct a client or call a service method.

The explicit --source-only mode reads installed Python declarations without importing
the SDK. It is weaker evidence than the default runtime introspection, and is labeled
as such in the report. It is never selected automatically on an import failure.
P0-08 explicitly authorizes this developer tool's SDK import outside adapters/.
"""

from __future__ import annotations

import argparse
import ast
import dataclasses
import inspect
import json
from datetime import UTC, datetime
from importlib.metadata import distribution, version
from pathlib import Path
from typing import Any, get_args, get_type_hints

# Candidate names include deliberately uncertain/absent methods, not just successes.
WORKSPACE_OPERATIONS: dict[str, tuple[str, ...]] = {
    "catalogs": ("list", "get", "create", "update", "delete"),
    "schemas": ("list", "get", "create", "update", "delete"),
    "tables": ("list", "get", "create", "update", "delete", "restore"),
    "grants": ("get", "get_effective", "update"),
    "volumes": ("list", "read", "create", "update", "delete"),
    "functions": ("list", "get", "create", "update", "delete"),
    "registered_models": ("list", "get", "create", "update", "delete", "set_alias"),
    "model_versions": ("list", "get", "update", "delete", "create"),
    "metastores": ("current", "summary", "list", "get", "update"),
    "storage_credentials": ("list", "get", "create", "update", "delete", "validate"),
    "external_locations": ("list", "get", "create", "update", "delete", "validate"),
    "connections": ("list", "get", "create", "update", "delete"),
    "shares": (
        "list",
        "list_shares",
        "get",
        "create",
        "update",
        "delete",
        "share_permissions",
        "update_permissions",
    ),
    "recipients": (
        "list",
        "get",
        "create",
        "update",
        "delete",
        "share_permissions",
        "rotate_token",
    ),
    "providers": ("list", "get", "create", "update", "delete", "list_shares"),
    "workspace_bindings": ("get_bindings", "update_bindings"),
    "quality_monitors": (
        "get",
        "create",
        "update",
        "delete",
        "list_refreshes",
        "get_refresh",
        "run_refresh",
    ),
    "serving_endpoints": ("list", "get", "get_permissions"),
    "statement_execution": (
        "execute_statement",
        "get_statement",
        "cancel_execution",
        "get_statement_result_chunk_n",
    ),
    "users": ("list", "get"),
    "groups": ("list", "get"),
    "service_principals": ("list", "get"),
    "current_user": ("me",),
    "entity_tag_assignments": ("list", "get", "create", "update", "delete"),
    "tag_policies": (
        "list_tag_policies",
        "get_tag_policy",
        "create_tag_policy",
        "update_tag_policy",
        "delete_tag_policy",
    ),
    "policies": ("list_policies", "get_policy", "create_policy", "update_policy", "delete_policy"),
    "rfa": (
        "get_access_request_destinations",
        "update_access_request_destinations",
        "batch_create_access_requests",
        "approve_access_request",
        "execute_access_request",
    ),
    "external_lineage": (
        "list_external_lineage_relationships",
        "create_external_lineage_relationship",
        "update_external_lineage_relationship",
        "delete_external_lineage_relationship",
    ),
    "external_metadata": (
        "list_external_metadata",
        "get_external_metadata",
        "create_external_metadata",
        "update_external_metadata",
        "delete_external_metadata",
    ),
    "clean_rooms": ("list", "get"),
    "credentials": (
        "list_credentials",
        "get_credential",
        "create_credential",
        "update_credential",
        "delete_credential",
        "validate_credential",
    ),
    "temporary_table_credentials": ("generate_temporary_table_credentials",),
    "resource_quotas": ("list_quotas", "get_quota"),
    "data_classification": (
        "get_catalog_config",
        "create_catalog_config",
        "update_catalog_config",
        "delete_catalog_config",
        "get_results",
    ),
    "data_quality": ("get_monitor", "list_monitor", "get_refresh", "list_refresh"),
    "consumer_listings": ("list", "get"),
    "lineage": ("get_table_lineage", "get_column_lineage"),
}
ACCOUNT_OPERATIONS: dict[str, tuple[str, ...]] = {
    "metastores": ("list", "get", "create", "update", "delete"),
    "metastore_assignments": ("list", "get", "create", "update", "delete"),
    "users": ("list", "get"),
    "groups": ("list", "get"),
    "service_principals": ("list", "get"),
}
CANDIDATES = {"WorkspaceClient": WORKSPACE_OPERATIONS, "AccountClient": ACCOUNT_OPERATIONS}


def service_class(client_class: type[Any], service: str) -> type[Any] | None:
    """Read the property annotation, without evaluating the property getter."""
    descriptor = inspect.getattr_static(client_class, service, None)
    if descriptor is None:
        return None
    getter = descriptor.fget if isinstance(descriptor, property) else descriptor
    result = get_type_hints(getter).get("return")
    if not isinstance(result, type):
        raise TypeError(f"Unresolved service annotation: {client_class.__name__}.{service}")
    return result


def dto_fields(annotation: Any, seen: set[type[Any]] | None = None) -> dict[str, list[str]]:
    """Include returned DTOs, iterator items, and their nested dataclasses."""
    seen = set() if seen is None else seen
    result: dict[str, list[str]] = {}
    for arg in get_args(annotation):
        result.update(dto_fields(arg, seen))
    if isinstance(annotation, type) and dataclasses.is_dataclass(annotation):
        if annotation in seen:
            return result
        seen.add(annotation)
        result[f"{annotation.__module__}.{annotation.__qualname__}"] = [
            field.name for field in dataclasses.fields(annotation)
        ]
        for hint in get_type_hints(annotation).values():
            result.update(dto_fields(hint, seen))
    return result


def runtime_surfaces() -> list[dict[str, Any]]:
    # Import only: never call WorkspaceClient(), AccountClient(), or SDK methods.
    from databricks.sdk import AccountClient, WorkspaceClient

    result: list[dict[str, Any]] = []
    for client in (WorkspaceClient, AccountClient):
        for service, methods in CANDIDATES[client.__name__].items():
            cls = service_class(client, service)
            row: dict[str, Any] = {
                "client": client.__name__,
                "service": service,
                "present": cls is not None,
                "service_class": f"{cls.__module__}.{cls.__qualname__}" if cls else None,
                "methods": {},
            }
            for name in methods:
                method = inspect.getattr_static(cls, name, None) if cls else None
                details: dict[str, Any] = {"present": callable(method)}
                if callable(method):
                    signature = inspect.signature(method)
                    hints = get_type_hints(method)
                    details.update(
                        parameters=[p for p in signature.parameters if p not in ("self", "cls")],
                        signature=str(signature),
                        return_annotation=str(hints.get("return")),
                        return_annotation_declared="return" in hints,
                        return_dtos=dto_fields(hints.get("return")),
                    )
                row["methods"][name] = details
            result.append(row)
    return result


class SourceIndex:
    """Read declarations only. No exec, imports, credentials, or SDK initialization."""

    def __init__(self) -> None:
        self.root = Path(str(distribution("databricks-sdk").locate_file("")))
        self.modules: dict[str, ast.Module] = {}

    def module(self, name: str) -> ast.Module:
        if name not in self.modules:
            path = self.root.joinpath(*name.split("."))
            path = (
                path.with_suffix(".py")
                if path.with_suffix(".py").is_file()
                else (path / "__init__.py")
            )
            self.modules[name] = ast.parse(path.read_text(encoding="utf-8"))
        return self.modules[name]

    def resolve(self, module: str, name: str) -> tuple[str, ast.ClassDef] | None:
        for node in self.module(module).body:
            if isinstance(node, ast.ClassDef) and node.name == name:
                return module, node
            if isinstance(node, ast.ImportFrom) and node.module and not node.level:
                for alias in node.names:
                    if (alias.asname or alias.name) == name and node.module.startswith(
                        "databricks"
                    ):
                        return self.resolve(node.module, alias.name)
                    prefix, dot, suffix = name.partition(".")
                    if dot and (alias.asname or alias.name) == prefix:
                        return self.resolve(f"{node.module}.{alias.name}", suffix)
        return None

    def method(
        self,
        module: str,
        cls: ast.ClassDef,
        name: str,
    ) -> tuple[str, ast.FunctionDef] | None:
        for node in cls.body:
            if isinstance(node, ast.FunctionDef) and node.name == name:
                return module, node
        for base in cls.bases:
            parent = self.resolve(module, ast.unparse(base))
            if parent:
                result = self.method(*parent, name)
                if result:
                    return result
        return None

    def dtos(
        self,
        module: str,
        annotation: ast.expr | None,
        seen: set[str] | None = None,
    ) -> dict[str, list[str]]:
        seen = set() if seen is None else seen
        result: dict[str, list[str]] = {}
        if annotation is None:
            return result
        for node in ast.walk(annotation):
            if not isinstance(node, ast.Name):
                continue
            resolved = self.resolve(module, node.id)
            if resolved is None:
                continue
            dto_module, cls = resolved
            key = f"{dto_module}.{cls.name}"
            if key in seen or not any(
                ast.unparse(d).split("(")[0] == "dataclass" for d in cls.decorator_list
            ):
                continue
            seen.add(key)
            fields = [f for f in cls.body if isinstance(f, ast.AnnAssign)]
            result[key] = [ast.unparse(f.target) for f in fields]
            for field in fields:
                result.update(self.dtos(dto_module, field.annotation, seen))
        return result


def source_surfaces() -> list[dict[str, Any]]:
    index = SourceIndex()
    result: list[dict[str, Any]] = []
    for client, services in CANDIDATES.items():
        client_cls = index.resolve("databricks.sdk", client)
        assert client_cls is not None
        for service, methods in services.items():
            prop = index.method(*client_cls, service)
            cls = (
                index.resolve(prop[0], ast.unparse(prop[1].returns))
                if (prop and prop[1].returns)
                else None
            )
            if prop is not None and cls is None:
                raise TypeError(f"Unresolved source service: {client}.{service}")
            row: dict[str, Any] = {
                "client": client,
                "service": service,
                "present": prop is not None,
                "service_class": f"{cls[0]}.{cls[1].name}" if cls else None,
                "methods": {},
            }
            for name in methods:
                method = index.method(*cls, name) if cls else None
                details: dict[str, Any] = {"present": method is not None}
                if method:
                    module, fn = method
                    params = fn.args.posonlyargs + fn.args.args
                    if fn.args.vararg:
                        params.append(fn.args.vararg)
                    params += fn.args.kwonlyargs
                    if fn.args.kwarg:
                        params.append(fn.args.kwarg)
                    details.update(
                        parameters=[p.arg for p in params if p.arg not in ("self", "cls")],
                        signature=ast.unparse(fn.args),
                        return_annotation=ast.unparse(fn.returns) if fn.returns else None,
                        return_annotation_declared=fn.returns is not None,
                        return_dtos=index.dtos(module, fn.returns),
                        source=f"{module.replace('.', '/')}.py:{fn.lineno}",
                    )
                row["methods"][name] = details
            result.append(row)
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", type=Path, help="Also write the JSON report to this path")
    parser.add_argument(
        "--source-only",
        action="store_true",
        help="AST evidence, not runtime proof",
    )
    args = parser.parse_args()
    surfaces = source_surfaces() if args.source_only else runtime_surfaces()
    report = {
        "sdk_version": version("databricks-sdk"),
        "observed_at": datetime.now(UTC).isoformat(),
        "evidence_kind": "installed_source_ast" if args.source_only else "runtime_introspection",
        "live_verified": False,
        "limitations": [
            "No clients constructed or SDK methods called; no network or credentials used.",
            "Privileges, OAuth scopes, GA/Preview and runtime availability are not verified.",
            "Missing annotations do not establish an empty DTO or a void response.",
        ]
        + (
            ["Static declarations only; runtime imports/signatures remain unverified."]
            if (args.source_only)
            else []
        ),
        "surface_counts": {
            "present": sum(row["present"] for row in surfaces),
            "absent": sum(not row["present"] for row in surfaces),
        },
        "surfaces": surfaces,
    }
    rendered = json.dumps(report, indent=2, sort_keys=True) + "\n"
    if args.json:
        args.json.parent.mkdir(parents=True, exist_ok=True)
        args.json.write_text(rendered, encoding="utf-8")
    print(rendered, end="")


if __name__ == "__main__":
    main()
