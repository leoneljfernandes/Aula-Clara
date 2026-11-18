import os

# Antes de importar la app: Settings valida al importarse app.main.
os.environ["APP_ENV"] = "test"  # asignación directa: un APP_ENV del shell no debe elegir otro stage
os.environ.setdefault("ERRORS_BASE_URL", "https://errors.test.invalid")
# Clave de prueba para la key sellada (la de producción va en el entorno del servidor).
os.environ["SEALING_KEY"] = "KmtOxkU7J3d7ZtXbA3Nq0m1y9j5pQe2sVcHfWl8uRzk="

from collections.abc import AsyncIterator

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.main import app as _app


@pytest.fixture
def app() -> FastAPI:
    return _app


@pytest.fixture
async def client(app: FastAPI) -> AsyncIterator[AsyncClient]:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def client_no_raise(app: FastAPI) -> AsyncIterator[AsyncClient]:
    """Cliente que devuelve la respuesta 500 en vez de propagar la excepción al test."""
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
