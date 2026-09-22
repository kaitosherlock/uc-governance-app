"""Lazy, request-scoped SDK clients; user failures never retry as the app principal."""

from collections.abc import Callable
from hashlib import sha256
from typing import TYPE_CHECKING, Any, cast

from app.adapters.databricks.catalogs import CatalogsAdapter
from app.adapters.databricks.common import CursorStore
from app.adapters.databricks.dependencies import DependenciesAdapter
from app.adapters.databricks.functions import FunctionsAdapter
from app.adapters.databricks.grants import GrantsAdapter
from app.adapters.databricks.models import ModelsAdapter
from app.adapters.databricks.principals import PrincipalsAdapter
from app.adapters.databricks.schemas import SchemasAdapter
from app.adapters.databricks.tables import TablesAdapter
from app.adapters.databricks.volumes import VolumesAdapter
from app.adapters.protocols import AssetReader, ObjectReader
from app.api.v1.models import Actor, ActorKind, AppRole
from app.auth.protocols import ResolvedUser
from app.config.settings import Settings
from app.domain.models import AssetDetail, AssetSummary
from app.domain.reads import Readers
from app.errors import NotImplementedYet, Unauthenticated, ValidationFailed

if TYPE_CHECKING:
    from databricks.sdk import WorkspaceClient
    from databricks.sdk.service.catalog import (
        CatalogsAPI,
        FunctionsAPI,
        GrantsAPI,
        RegisteredModelsAPI,
        SchemasAPI,
        TablesAPI,
        VolumesAPI,
    )
    from databricks.sdk.service.iam import GroupsAPI, ServicePrincipalsAPI, UsersAPI


class LazyService:
    def __init__(self, factory: Callable[[], "WorkspaceClient"], service: str) -> None:
        self.factory, self.service = factory, service

    def __getattr__(self, name: str) -> Any:
        return getattr(getattr(self.factory(), self.service), name)


class AssetRouter:
    def __init__(self, readers: dict[str, AssetReader]) -> None:
        self.readers = readers

    def get_asset(self, securable_type: str, full_name: str) -> AssetDetail:
        reader = self.readers.get(securable_type)
        if reader is None:
            raise NotImplementedYet("Read support for this securable type is not implemented.")
        return reader.get_asset(securable_type, full_name)


class ObjectsRouter:
    def __init__(self, readers: tuple[ObjectReader, ...]) -> None:
        self.readers = readers

    def list_objects(
        self, catalog: str, schema: str, page_size: int, page_token: str | None
    ) -> tuple[list[AssetSummary], str | None]:
        index, inner = 0, None
        if page_token:
            stage, separator, cursor = page_token.partition(":")
            if not separator or not stage.isdecimal() or int(stage) >= len(self.readers):
                raise ValidationFailed("Invalid schema-object page token.")
            index, inner = int(stage), cursor or None
        values, next_inner = self.readers[index].list_objects(catalog, schema, page_size, inner)
        token = (
            f"{index}:{next_inner}"
            if next_inner
            else f"{index + 1}:"
            if index + 1 < len(self.readers)
            else None
        )
        return values, token


class SDKIdentityResolver:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def resolve(self, access_token: str) -> ResolvedUser:
        # Resolve identity only using the verified user-token client.
        from app.adapters.databricks.common import translate_exception

        try:
            from databricks.sdk import WorkspaceClient

            client = WorkspaceClient(
                host=self.settings.workspace_host, token=access_token, auth_type="pat"
            )
            user = client.current_user.me()
        except Exception as exc:
            raise translate_exception(exc) from None
        if not user.id or not user.user_name:
            raise Unauthenticated("Databricks did not return a verified user identity.")
        return ResolvedUser(
            actor=Actor(
                id=user.id,
                display=user.user_name,
                kind=ActorKind.USER,
                roles=[AppRole.VIEWER],
                verified_by="user_token",
            ),
            email=user.user_name,
            external_id=user.external_id,
        )


def sdk_readers(settings: Settings, access_token: str, cursors: CursorStore) -> Readers:
    # Constructed only after user-token verification; each operation lazily selects its executor.
    clients: dict[str, WorkspaceClient] = {}

    def client(executor: str) -> "WorkspaceClient":
        if executor not in clients:
            from databricks.sdk import WorkspaceClient

            clients[executor] = (
                WorkspaceClient(host=settings.workspace_host, token=access_token, auth_type="pat")
                if executor == "user"
                else WorkspaceClient(host=settings.workspace_host)
            )
        return clients[executor]

    def service(name: str, executor: str = "user") -> LazyService:
        return LazyService(lambda: client(executor), name)

    key = sha256((settings.workspace_host + "\0" + access_token).encode()).hexdigest()
    catalogs = CatalogsAdapter(cast("CatalogsAPI", service("catalogs")), cursors, key)
    schemas = SchemasAdapter(cast("SchemasAPI", service("schemas")), cursors, key)
    tables = TablesAdapter(cast("TablesAPI", service("tables")), cursors, key)
    volumes = VolumesAdapter(cast("VolumesAPI", service("volumes")), cursors, key)
    functions = FunctionsAdapter(cast("FunctionsAPI", service("functions", "sp")), cursors, key)
    models = ModelsAdapter(
        cast("RegisteredModelsAPI", service("registered_models", "sp")), cursors, key
    )
    grants = GrantsAdapter(cast("GrantsAPI", service("grants", "sp")))
    principals = PrincipalsAdapter(
        cast("UsersAPI", service("users", "sp")),
        cast("GroupsAPI", service("groups", "sp")),
        cast("ServicePrincipalsAPI", service("service_principals", "sp")),
        cursors,
        key,
    )
    from databricks.sdk.service.catalog import Privilege

    return Readers(
        catalogs=catalogs,
        schemas=schemas,
        objects=ObjectsRouter((tables, volumes, functions, models)),
        assets=AssetRouter(
            {
                "CATALOG": catalogs,
                "SCHEMA": schemas,
                "TABLE": tables,
                "VOLUME": volumes,
                "FUNCTION": functions,
                "REGISTERED_MODEL": models,
            }
        ),
        grants=grants,
        principals=principals,
        dependencies=DependenciesAdapter(),
        privilege_codes=tuple(p.value for p in Privilege),
    )
