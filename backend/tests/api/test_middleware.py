import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient


@pytest.mark.parametrize("method", ["POST", "PATCH", "PUT", "DELETE"])
@pytest.mark.parametrize("headers", [
    {"Origin": "https://cross-site.example.test"},
    {"Sec-Fetch-Site": "cross-site"},
    {"Sec-Fetch-Site": "same-site"},
    {"Origin": "null"},
    {"Origin": "http://testserver@evil.example.test"},
    {"Origin": "http://testserver", "Sec-Fetch-Site": "cross-site"},
])
def test_cross_origin_mutations_denied(
    client: TestClient, method: str, headers: dict[str, str],
) -> None:
    response = client.request(
        method, "/api/v1/me", headers={"X-Request-Id": "origin-test", **headers},
    )
    assert response.status_code == 403
    assert response.json()["code"] == "FORBIDDEN_ROLE"
    assert response.json()["correlation_id"] == response.headers["X-Request-Id"] == "origin-test"


@pytest.mark.parametrize("headers", [{}, {"Origin": "http://testserver"},
                                      {"Origin": "https://other.example.test"}])
def test_reads_unaffected(client: TestClient, headers: dict[str, str]) -> None:
    assert client.get("/api/v1/context", headers=headers).status_code == 200


def test_same_origin_post_reaches_handler(app: FastAPI) -> None:
    @app.post("/test-same-origin")
    def handler() -> dict[str, bool]:
        return {"reached": True}

    with TestClient(app) as client:
        response = client.post("/test-same-origin", headers={
            "Origin": "http://testserver:80", "Sec-Fetch-Site": "same-origin",
        })
    assert response.json() == {"reached": True}
