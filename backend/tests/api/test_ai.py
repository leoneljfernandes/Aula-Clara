from collections.abc import Iterator

import pytest
from fastapi import FastAPI
from httpx import AsyncClient

from app.api.deps import get_ai_service, get_rate_limiter
from app.crud.answer_cache import AnswerCache
from app.providers.llm.mock import MockProvider
from app.rate_limit import RateLimiter
from app.services.ai import AIService

PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 64


@pytest.fixture(autouse=True)
def fresh_ai(app: FastAPI) -> Iterator[None]:
    """Servicio con mock, caché y limitador nuevos por test: ningún test llama a un proveedor real."""
    app.dependency_overrides[get_ai_service] = lambda: AIService(
        chat_chain=[MockProvider()],
        image_chain=[MockProvider()],
        cache=AnswerCache(60),
        max_input_chars=1_000,
    )
    limiter = RateLimiter(5)
    app.dependency_overrides[get_rate_limiter] = lambda: limiter
    yield
    app.dependency_overrides.clear()


async def test_chat_returns_answer_and_provider(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/ai/chat", json={"action": "summarize", "document_text": "Un texto de estudio."}
    )
    assert response.status_code == 200
    assert response.json()["provider"] == "mock"
    assert response.json()["answer"].startswith("Resumen")


async def test_chat_free_without_message_is_422_business_rule(client: AsyncClient) -> None:
    response = await client.post("/api/v1/ai/chat", json={"action": "free", "document_text": "texto"})
    assert response.status_code == 422
    assert response.json()["code"] == "business_rule_violation"


@pytest.mark.parametrize(
    "payload",
    [
        {"action": "nope", "document_text": "x"},
        {"action": "quiz"},
        {"action": "quiz", "document_text": "x", "extra": 1},
    ],
)
async def test_chat_invalid_payload_is_422(client: AsyncClient, payload: dict[str, str]) -> None:
    assert (await client.post("/api/v1/ai/chat", json=payload)).status_code == 422


async def test_describe_image_returns_description(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/ai/describe-image",
        files={"image": ("g.png", PNG, "image/png")},
        data={"context": "Gráfico 1"},
    )
    assert response.status_code == 200
    assert response.json()["provider"] == "mock"
    assert response.json()["description"]


async def test_describe_image_rejects_non_images_with_415(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/ai/describe-image", files={"image": ("a.pdf", b"%PDF", "application/pdf")}
    )
    assert response.status_code == 415


async def test_describe_image_rejects_oversized_with_413(client: AsyncClient) -> None:
    big = b"0" * (4 * 1024 * 1024 + 1)
    response = await client.post("/api/v1/ai/describe-image", files={"image": ("g.png", big, "image/png")})
    assert response.status_code == 413


async def test_rate_limit_returns_429_with_retry_after(client: AsyncClient) -> None:
    body = {"action": "summarize", "document_text": "texto"}
    for _ in range(5):
        assert (await client.post("/api/v1/ai/chat", json=body)).status_code == 200
    blocked = await client.post("/api/v1/ai/chat", json=body)
    assert blocked.status_code == 429
    assert blocked.json()["code"] == "rate_limited"
    assert int(blocked.headers["retry-after"]) >= 1
