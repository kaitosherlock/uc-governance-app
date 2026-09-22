from pathlib import Path

import pytest
from app import main
from fastapi.testclient import TestClient


def test_missing_frontend_does_not_prevent_startup(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setattr(main, "STATIC_DIRECTORY", tmp_path / "missing")
    with TestClient(main.create_app()) as client:
        assert client.get("/api/v1/context").status_code == 200
        assert client.get("/").status_code == 404


def test_static_mount_after_api_routes(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    (tmp_path / "index.html").write_text("<html>Synthetic test frontend</html>", encoding="utf-8")
    (tmp_path / "404.html").write_text("<html>Not found</html>", encoding="utf-8")
    monkeypatch.setattr(main, "STATIC_DIRECTORY", tmp_path)
    with TestClient(main.create_app()) as client:
        assert "Synthetic test frontend" in client.get("/").text
        assert client.get("/api/v1/context").status_code == 200
        missing = client.get("/api/v1/missing")
        assert missing.status_code == 404
        assert missing.json()["code"] == "NOT_FOUND"
        assert client.get("/missing-file").json()["code"] == "NOT_FOUND"
