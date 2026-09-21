"""Isolated local fixtures; never depend on developer credentials or real Apps variables."""

import sys
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import main  # noqa: E402


@pytest.fixture(autouse=True)
def isolated_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    import os

    for name in list(os.environ):
        if name.startswith(("UCGOV_", "DATABRICKS_", "PG")):
            monkeypatch.delenv(name)
    monkeypatch.setenv("UCGOV_MODE", "fixture")
    monkeypatch.setenv("UCGOV_FIXTURE_ACTOR", "alice.steward")


@pytest.fixture
def app(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> FastAPI:
    monkeypatch.setattr(main, "STATIC_DIRECTORY", tmp_path / "missing-dist")
    return main.create_app()


@pytest.fixture
def client(app: FastAPI) -> Iterator[TestClient]:
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client
