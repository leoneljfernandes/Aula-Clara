from fastapi import APIRouter, FastAPI
from httpx import AsyncClient

from app.errors import NotFoundError, RateLimitedError

# Rutas de prueba montadas una sola vez sobre la app real: ejercitan los handlers globales.
_probe = APIRouter(prefix="/__probe")


@_probe.get("/not-found")
async def _not_found() -> None:
    raise NotFoundError("Document d1 not found")


@_probe.get("/rate-limited")
async def _rate_limited() -> None:
    raise RateLimitedError("Too many requests", headers={"Retry-After": "42"})


@_probe.get("/boom")
async def _boom() -> None:
    raise RuntimeError("secret internals: GEMINI_API_KEY=hunter2")


def _mount_probe(app: FastAPI) -> None:
    if not any(getattr(r, "path", "").startswith("/__probe") for r in app.routes):
        app.include_router(_probe)


async def test_unknown_route_is_problem_json(client: AsyncClient) -> None:
    response = await client.get("/api/v1/does-not-exist")
    assert response.status_code == 404
    assert response.headers["content-type"] == "application/problem+json"
    body = response.json()
    assert body["code"] == "http_404"
    assert body["type"] == "https://errors.test.invalid/http_404"


async def test_domain_error_has_stable_code_and_detail(app: FastAPI, client: AsyncClient) -> None:
    _mount_probe(app)
    response = await client.get("/__probe/not-found")
    assert response.status_code == 404
    assert response.headers["content-type"] == "application/problem+json"
    assert response.json()["code"] == "not_found"
    assert response.json()["detail"] == "Document d1 not found"


async def test_rate_limited_sends_retry_after(app: FastAPI, client: AsyncClient) -> None:
    _mount_probe(app)
    response = await client.get("/__probe/rate-limited")
    assert response.status_code == 429
    assert response.headers["retry-after"] == "42"
    assert response.json()["code"] == "rate_limited"


async def test_unhandled_error_is_500_without_leaking(app: FastAPI, client_no_raise: AsyncClient) -> None:
    _mount_probe(app)
    response = await client_no_raise.get("/__probe/boom")
    assert response.status_code == 500
    assert response.json()["code"] == "internal_error"
    assert "hunter2" not in response.text
