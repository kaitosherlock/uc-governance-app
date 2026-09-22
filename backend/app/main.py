"""App factory. Importing this module never constructs a client or reads credentials."""

import os
from pathlib import Path

from fastapi import FastAPI
from starlette.responses import Response
from starlette.staticfiles import StaticFiles
from starlette.types import Scope

from app.api.errors_handler import register_exception_handlers
from app.api.middleware import CorrelationMiddleware, OriginGuardMiddleware
from app.api.v1.routes_context import router
from app.api.v1.routes_reads import router as reads_router
from app.container import Container
from app.config.settings import Mode, assert_mode_is_safe, load_settings
from app.errors import NotFound
from app.logging_setup import configure_logging

STATIC_DIRECTORY = Path(__file__).resolve().parents[2] / "frontend" / "dist"


class EnvelopeStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope: Scope) -> Response:
        if path == "api" or path.startswith("api/"):
            raise NotFound()
        response = await super().get_response(path, scope)
        # A frontend's optional 404.html must not bypass the error envelope.
        if response.status_code == 404:
            raise NotFound()
        return response


def create_app() -> FastAPI:
    settings = load_settings()
    assert_mode_is_safe(settings, os.environ)
    configure_logging()
    app = FastAPI(title="Unity Catalog Governance API", version="1.0.0")
    app.state.settings = settings
    app.state.container = Container(settings)
    app.state.identity_resolver = None
    if settings.mode == Mode.FIXTURE:
        from app.fixtures_data.identities import FixtureIdentityResolver

        app.state.identity_resolver = FixtureIdentityResolver()
    else:
        from app.adapters.databricks.factory import SDKIdentityResolver
        app.state.identity_resolver = SDKIdentityResolver(settings)
    app.include_router(router, prefix="/api/v1")
    app.include_router(reads_router, prefix="/api/v1")
    register_exception_handlers(app)
    app.add_middleware(OriginGuardMiddleware)
    app.add_middleware(CorrelationMiddleware)
    if STATIC_DIRECTORY.is_dir():
        app.mount("/", EnvelopeStaticFiles(directory=STATIC_DIRECTORY, html=True), name="frontend")
    return app
