import logging
from collections.abc import Iterator
from typing import Any

import pytest
from fakes import FakeProvider
from fastapi import FastAPI
from httpx import AsyncClient
from pytest_mock import MockerFixture

from app.api.deps import get_ai_service, get_rate_limiter
from app.crud.answer_cache import AnswerCache
from app.providers.llm.base import (
    ProviderAuthError,
    ProviderContentBlocked,
    ProviderEmptyResponse,
    ProviderError,
    ProviderPayloadTooLarge,
    ProviderQuotaError,
    ProviderTimeout,
)
from app.rate_limit import RateLimiter
from app.services.ai import AIService

PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 64
KEY = "user-secret-key-123"
HEADERS = {"X-AI-Provider": "gemini", "X-AI-Key": KEY, "X-AI-Model": "gemini-3.5-flash-lite"}
CHAT = {"action": "summarize", "document_text": "Un texto de estudio."}


@pytest.fixture(autouse=True)
def fresh_ai(app: FastAPI) -> Iterator[None]:
    """Servicio, caché y limitador nuevos por test."""
    app.dependency_overrides[get_ai_service] = lambda: AIService(
        cache=AnswerCache(60), max_input_chars=1_000, retry_delay=0.0
    )
    limiter = RateLimiter(5)
    app.dependency_overrides[get_rate_limiter] = lambda: limiter
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def built(mocker: MockerFixture) -> list[dict[str, Any]]:
    """Reemplaza la fábrica de proveedores y registra con qué datos se llamó (y el proveedor creado)."""
    calls: list[dict[str, Any]] = []

    def fake_build(name: str, *, api_key: str, model: str, timeout_seconds: float) -> FakeProvider:
        provider = FakeProvider(name, model)
        calls.append({"name": name, "api_key": api_key, "model": model, "provider": provider})
        return provider

    mocker.patch("app.api.deps.build_provider", side_effect=fake_build)
    return calls


async def test_chat_uses_the_provider_key_and_model_sent_by_the_user(
    client: AsyncClient, built: list[dict[str, Any]]
) -> None:
    response = await client.post("/api/v1/ai/chat", json=CHAT, headers=HEADERS)
    assert response.status_code == 200
    assert response.json() == {
        "answer": "Resumen de prueba",
        "provider": "gemini",
        "model": "gemini-3.5-flash-lite",
        "truncated": False,
    }
    assert [{k: v for k, v in c.items() if k != "provider"} for c in built] == [
        {"name": "gemini", "api_key": KEY, "model": "gemini-3.5-flash-lite"}
    ]


async def test_the_per_request_provider_is_closed_after_the_response(
    client: AsyncClient, built: list[dict[str, Any]]
) -> None:
    await client.post("/api/v1/ai/chat", json=CHAT, headers=HEADERS)
    await client.get("/api/v1/ai/models", headers={"X-AI-Provider": "groq", "X-AI-Key": KEY})
    assert [c["provider"].closed for c in built] == [True, True]


async def test_payload_too_large_for_the_provider_is_413(client: AsyncClient, mocker: MockerFixture) -> None:
    mocker.patch(
        "app.api.deps.build_provider",
        side_effect=lambda name, **kw: FakeProvider(
            name, kw["model"], failure=ProviderPayloadTooLarge("413")
        ),
    )
    response = await client.post("/api/v1/ai/chat", json=CHAT, headers=HEADERS)
    assert response.status_code == 413
    assert response.json()["code"] == "ai_input_too_large"


@pytest.mark.parametrize(
    ("headers", "code"),
    [
        ({}, "ai_credentials_required"),
        ({"X-AI-Provider": "gemini", "X-AI-Model": "m"}, "ai_credentials_required"),  # sin key
        ({**HEADERS, "X-AI-Provider": "openai"}, "ai_credentials_required"),  # proveedor no admitido
        ({**HEADERS, "X-AI-Model": ""}, "ai_credentials_required"),
        ({**HEADERS, "X-AI-Model": "../../etc"}, "ai_credentials_required"),
        ({**HEADERS, "X-AI-Key": "corta"}, "ai_key_invalid"),
    ],
)
async def test_chat_without_valid_credentials_is_401(
    client: AsyncClient, built: list[dict[str, Any]], headers: dict[str, str], code: str
) -> None:
    response = await client.post("/api/v1/ai/chat", json=CHAT, headers=headers)
    assert response.status_code == 401
    assert response.json()["code"] == code
    assert built == []  # nunca se llega a crear un proveedor


async def test_models_lists_what_the_user_key_can_use(
    client: AsyncClient, built: list[dict[str, Any]]
) -> None:
    headers = {"X-AI-Provider": "openrouter", "X-AI-Key": KEY}  # sin modelo: es justamente para elegirlo
    response = await client.get("/api/v1/ai/models", headers=headers)
    assert response.status_code == 200
    assert response.json() == {
        "provider": "openrouter",
        "key_verified": True,
        "models": [
            {
                "id": "gemini-3.5-flash-lite",
                "name": "Gemini 3.5 Flash Lite",
                "supports_images": True,
                "free": None,
            }
        ],
    }
    assert built[0]["model"] == ""


@pytest.mark.parametrize("provider", ["mistral", "nvidia"])
async def test_new_providers_are_accepted(
    client: AsyncClient, built: list[dict[str, Any]], provider: str
) -> None:
    response = await client.get("/api/v1/ai/models", headers={"X-AI-Provider": provider, "X-AI-Key": KEY})
    assert response.status_code == 200
    assert response.json()["key_verified"] is (provider != "nvidia")


async def test_rejected_key_is_401_and_the_key_never_leaks(
    client: AsyncClient, mocker: MockerFixture, caplog: pytest.LogCaptureFixture
) -> None:
    mocker.patch(
        "app.api.deps.build_provider",
        side_effect=lambda name, **kw: FakeProvider(name, kw["model"], failure=ProviderAuthError("401")),
    )
    with caplog.at_level(logging.DEBUG):
        response = await client.post("/api/v1/ai/chat", json=CHAT, headers=HEADERS)
    assert response.status_code == 401
    assert response.json()["code"] == "ai_key_invalid"
    assert KEY not in response.text
    assert KEY not in caplog.text


async def test_chat_free_without_message_is_422_business_rule(
    client: AsyncClient, built: list[dict[str, Any]]
) -> None:
    response = await client.post(
        "/api/v1/ai/chat", json={"action": "free", "document_text": "x"}, headers=HEADERS
    )
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
async def test_chat_invalid_payload_is_422(
    client: AsyncClient, built: list[dict[str, Any]], payload: dict[str, str]
) -> None:
    assert (await client.post("/api/v1/ai/chat", json=payload, headers=HEADERS)).status_code == 422


async def test_describe_image_returns_description_and_model(
    client: AsyncClient, built: list[dict[str, Any]]
) -> None:
    response = await client.post(
        "/api/v1/ai/describe-image",
        files={"image": ("g.png", PNG, "image/png")},
        data={"context": "Gráfico 1"},
        headers=HEADERS,
    )
    assert response.status_code == 200
    assert response.json() == {
        "description": "Un gráfico de prueba",
        "provider": "gemini",
        "model": "gemini-3.5-flash-lite",
        "truncated": False,
    }


async def test_describe_image_rejects_non_images_with_415(
    client: AsyncClient, built: list[dict[str, Any]]
) -> None:
    response = await client.post(
        "/api/v1/ai/describe-image", files={"image": ("a.pdf", b"%PDF", "application/pdf")}, headers=HEADERS
    )
    assert response.status_code == 415


async def test_describe_image_rejects_oversized_with_413(
    client: AsyncClient, built: list[dict[str, Any]]
) -> None:
    big = b"0" * (4 * 1024 * 1024 + 1)
    response = await client.post(
        "/api/v1/ai/describe-image", files={"image": ("g.png", big, "image/png")}, headers=HEADERS
    )
    assert response.status_code == 413


async def test_rate_limit_returns_429_with_retry_after(
    client: AsyncClient, built: list[dict[str, Any]]
) -> None:
    for _ in range(5):
        assert (await client.post("/api/v1/ai/chat", json=CHAT, headers=HEADERS)).status_code == 200
    blocked = await client.post("/api/v1/ai/chat", json=CHAT, headers=HEADERS)
    assert blocked.status_code == 429
    assert blocked.json()["code"] == "rate_limited"
    assert int(blocked.headers["retry-after"]) >= 1


def _failing(mocker: MockerFixture, failure: Exception, *, truncated: bool = False) -> list[FakeProvider]:
    made: list[FakeProvider] = []

    def build(name: str, **kw: object) -> FakeProvider:
        made.append(FakeProvider(name, str(kw["model"]), failure=failure, truncated=truncated))
        return made[-1]

    mocker.patch("app.api.deps.build_provider", side_effect=build)
    return made


ERROR_CASES = [
    (
        ProviderQuotaError("429", reason="daily", retry_after=34.0, provider_message="TPD reached"),
        429,
        "ai_quota_exceeded",
    ),
    (
        ProviderPayloadTooLarge("ctx", reason="context", provider_message="max 8192 tokens"),
        413,
        "ai_input_too_large",
    ),
    (ProviderContentBlocked("safety", reason="safety"), 422, "ai_content_blocked"),
    (ProviderEmptyResponse("vacío", reason="length"), 502, "ai_response_empty"),
    (ProviderTimeout("lento", reason="timeout"), 503, "ai_unavailable"),
]


@pytest.mark.parametrize(("failure", "status", "code"), ERROR_CASES)
async def test_every_provider_failure_reaches_the_person_as_problem_json_with_its_code(
    client: AsyncClient, mocker: MockerFixture, failure: ProviderError, status: int, code: str
) -> None:
    _failing(mocker, failure)
    response = await client.post("/api/v1/ai/chat", json=CHAT, headers=HEADERS)
    assert response.status_code == status
    assert response.headers["content-type"].startswith("application/problem+json")
    body = response.json()
    assert body["code"] == code
    assert body["provider"] == "gemini" and body["model"] == "gemini-3.5-flash-lite"
    assert body.get("reason") == failure.reason


async def test_quota_error_exposes_when_to_retry_and_the_provider_message(
    client: AsyncClient, mocker: MockerFixture
) -> None:
    failure = ProviderQuotaError("429", reason="daily", retry_after=34.0, provider_message="TPD reached")
    _failing(mocker, failure)
    response = await client.post("/api/v1/ai/chat", json=CHAT, headers=HEADERS)
    assert response.headers["retry-after"] == "34"
    assert response.json()["retry_after_seconds"] == 34
    assert response.json()["provider_message"] == "TPD reached"


@pytest.mark.parametrize(("failure", "_status", "_code"), ERROR_CASES)
async def test_the_provider_is_closed_also_when_the_request_fails(
    client: AsyncClient, mocker: MockerFixture, failure: ProviderError, _status: int, _code: str
) -> None:
    made = _failing(mocker, failure)
    await client.post("/api/v1/ai/chat", json=CHAT, headers=HEADERS)
    assert [p.closed for p in made] == [True]


async def test_the_provider_is_closed_even_when_something_unexpected_blows_up(
    client_no_raise: AsyncClient, mocker: MockerFixture
) -> None:
    made = _failing(mocker, RuntimeError("bug inesperado"))
    response = await client_no_raise.post("/api/v1/ai/chat", json=CHAT, headers=HEADERS)
    assert response.status_code == 500
    assert response.json()["code"] == "internal_error"
    assert [p.closed for p in made] == [True]


async def test_the_key_never_appears_in_any_error_response(
    client_no_raise: AsyncClient, mocker: MockerFixture
) -> None:
    # Cualquier excepción que lleve la key en su texto, conocida o no: la respuesta nunca la repite.
    failures: list[Exception] = [
        ProviderAuthError(f"rejected {KEY}", provider_message=f"bad key {KEY}"),
        ProviderQuotaError(f"quota {KEY}"),
        RuntimeError(f"unexpected error with {KEY}"),
    ]
    for failure in failures:
        _failing(mocker, failure)
        for path, kwargs in (
            ("/api/v1/ai/chat", {"json": CHAT}),
            ("/api/v1/ai/describe-image", {"files": {"image": ("g.png", PNG, "image/png")}}),
        ):
            response = await client_no_raise.post(path, headers=HEADERS, **kwargs)
            assert response.status_code >= 400
            assert KEY not in response.text, (path, failure)
            assert KEY not in str(response.headers)


async def test_a_truncated_answer_is_flagged_in_the_response(
    client: AsyncClient, mocker: MockerFixture
) -> None:
    mocker.patch(
        "app.api.deps.build_provider",
        side_effect=lambda name, **kw: FakeProvider(name, kw["model"], truncated=True),
    )
    chat = await client.post("/api/v1/ai/chat", json=CHAT, headers=HEADERS)
    image = await client.post(
        "/api/v1/ai/describe-image", files={"image": ("g.png", PNG, "image/png")}, headers=HEADERS
    )
    assert chat.json()["truncated"] is True
    assert image.json()["truncated"] is True


@pytest.mark.parametrize("action", ["glossary", "visual_outline"])
async def test_chat_accepts_the_new_actions_and_language(
    client: AsyncClient, built: list[dict[str, Any]], action: str
) -> None:
    response = await client.post(
        "/api/v1/ai/chat",
        headers=HEADERS,
        json={"action": action, "document_text": "texto", "language": "easy"},
    )
    assert response.status_code == 200


async def test_chat_rejects_an_unknown_language(client: AsyncClient, built: list[dict[str, Any]]) -> None:
    response = await client.post(
        "/api/v1/ai/chat",
        headers=HEADERS,
        json={"action": "summarize", "document_text": "t", "language": "klingon"},
    )
    assert response.status_code == 422


async def test_describe_image_accepts_color_guide(client: AsyncClient, built: list[dict[str, Any]]) -> None:
    response = await client.post(
        "/api/v1/ai/describe-image",
        headers=HEADERS,
        files={"image": ("a.png", PNG, "image/png")},
        data={"color_guide": "true"},
    )
    assert response.status_code == 200
    assert "180 palabras" in built[0]["provider"].image_systems[-1]


async def test_describe_image_without_color_guide_uses_the_plain_prompt(
    client: AsyncClient, built: list[dict[str, Any]]
) -> None:
    await client.post(
        "/api/v1/ai/describe-image", headers=HEADERS, files={"image": ("a.png", PNG, "image/png")}
    )
    assert "180 palabras" not in built[0]["provider"].image_systems[-1]
