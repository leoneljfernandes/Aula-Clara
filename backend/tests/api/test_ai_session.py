from collections.abc import Iterator
from http.cookies import SimpleCookie
from typing import Any

import pytest
from fakes import FakeProvider
from fastapi import FastAPI
from httpx import AsyncClient, Response
from pytest_mock import MockerFixture

from app.api.deps import COOKIE_NAME, get_ai_service, get_key_sealer, get_rate_limiter
from app.crud.answer_cache import AnswerCache
from app.rate_limit import RateLimiter
from app.services.ai import AIService

CHAT = {"action": "summarize", "document_text": "Un texto de estudio."}
KEY = "user-secret-key-123"
MARK = {"X-Aula-Clara": "1"}
BODY = {"provider": "gemini", "api_key": KEY, "remember": False}


@pytest.fixture(autouse=True)
def fresh(app: FastAPI) -> Iterator[None]:
    app.dependency_overrides[get_ai_service] = lambda: AIService(
        cache=AnswerCache(60), max_input_chars=1_000, retry_delay=0.0
    )
    limiter = RateLimiter(50)
    app.dependency_overrides[get_rate_limiter] = lambda: limiter
    yield
    app.dependency_overrides.clear()


def _cookie(response: Response) -> tuple[SimpleCookie, str]:
    raw = response.headers["set-cookie"]
    jar: SimpleCookie = SimpleCookie()
    jar.load(raw)
    return jar, raw


async def _sealed(client: AsyncClient, **overrides: Any) -> str:
    response = await client.post("/api/v1/ai/session", json={**BODY, **overrides}, headers=MARK)
    assert response.status_code == 200
    return _cookie(response)[0][COOKIE_NAME].value


def _with(token: str, **headers: str) -> dict[str, str]:
    return {"Cookie": f"{COOKIE_NAME}={token}", **MARK, **headers}


async def test_saving_sets_a_hardened_cookie_and_never_returns_the_key(client: AsyncClient) -> None:
    response = await client.post("/api/v1/ai/session", json=BODY, headers=MARK)
    assert response.status_code == 200
    jar, raw = _cookie(response)
    morsel = jar[COOKIE_NAME]
    assert morsel["httponly"] and morsel["secure"] and morsel["samesite"].lower() == "strict"
    assert morsel["path"] == "/" and not morsel["domain"]  # requisitos del prefijo __Host-
    assert not morsel["max-age"]  # sin «recordar»: cookie de sesión del navegador
    assert KEY not in raw and KEY not in morsel.value and KEY not in response.text
    assert response.json() == {"provider": "gemini", "remember": False, "expires_in_seconds": 12 * 3600}
    assert response.headers["cache-control"] == "no-store"


async def test_remember_makes_the_cookie_persistent(client: AsyncClient) -> None:
    response = await client.post("/api/v1/ai/session", json={**BODY, "remember": True}, headers=MARK)
    morsel = _cookie(response)[0][COOKIE_NAME]
    assert int(morsel["max-age"]) == 30 * 86_400
    assert response.json()["remember"] is True


async def test_the_session_can_be_read_back_without_exposing_the_key(client: AsyncClient) -> None:
    token = await _sealed(client)
    response = await client.get("/api/v1/ai/session", headers=_with(token))
    assert response.status_code == 200
    assert response.json()["provider"] == "gemini"
    assert 0 < response.json()["expires_in_seconds"] <= 12 * 3600
    assert KEY not in response.text


async def test_reading_without_a_cookie_is_401_no_session(client: AsyncClient) -> None:
    response = await client.get("/api/v1/ai/session", headers=MARK)
    assert response.status_code == 401
    assert response.json()["code"] == "ai_credentials_required"
    assert response.json()["reason"] == "no_session"


async def test_deleting_clears_the_cookie(client: AsyncClient) -> None:
    response = await client.delete("/api/v1/ai/session", headers=MARK)
    assert response.status_code == 204
    morsel = _cookie(response)[0][COOKIE_NAME]
    assert morsel.value == "" and int(morsel["max-age"]) == 0
    assert morsel["httponly"] and morsel["secure"]


@pytest.mark.parametrize("method", ["post", "get", "delete"])
async def test_session_endpoints_demand_the_anti_csrf_header(client: AsyncClient, method: str) -> None:
    kwargs: dict[str, Any] = {"json": BODY} if method == "post" else {}
    response = await getattr(client, method)("/api/v1/ai/session", **kwargs)
    assert response.status_code == 403
    assert response.json()["code"] == "forbidden"


async def test_the_key_is_validated_before_sealing(client: AsyncClient) -> None:
    for bad in (
        {"api_key": "corta"},
        {"api_key": "con espacios adentro"},
        {"provider": "cohere"},
        {"extra": 1},
    ):
        response = await client.post("/api/v1/ai/session", json={**BODY, **bad}, headers=MARK)
        assert response.status_code in (401, 422), bad
        assert "set-cookie" not in response.headers


async def test_chat_works_with_the_cookie_and_the_server_receives_the_real_key(
    client: AsyncClient, mocker: MockerFixture
) -> None:
    seen: list[dict[str, str]] = []

    def build(name: str, *, api_key: str, model: str, timeout_seconds: float) -> FakeProvider:
        seen.append({"name": name, "api_key": api_key, "model": model})
        return FakeProvider(name, model)

    mocker.patch("app.api.deps.build_provider", side_effect=build)
    token = await _sealed(client)
    response = await client.post(
        "/api/v1/ai/chat", json=CHAT, headers=_with(token, **{"X-AI-Model": "gemini-3.5-flash-lite"})
    )
    assert response.status_code == 200
    assert seen == [
        {"name": "gemini", "api_key": KEY, "model": "gemini-3.5-flash-lite"}
    ]  # el browser nunca la mandó
    assert KEY not in response.text


async def test_models_can_be_listed_with_only_the_cookie(client: AsyncClient, mocker: MockerFixture) -> None:
    mocker.patch(
        "app.api.deps.build_provider", side_effect=lambda name, **kw: FakeProvider(name, kw["model"])
    )
    token = await _sealed(client)
    response = await client.get("/api/v1/ai/models", headers=_with(token))
    assert response.status_code == 200 and response.json()["provider"] == "gemini"


async def test_using_the_cookie_without_the_marker_header_is_forbidden(
    client: AsyncClient, mocker: MockerFixture
) -> None:
    mocker.patch(
        "app.api.deps.build_provider", side_effect=lambda name, **kw: FakeProvider(name, kw["model"])
    )
    token = await _sealed(client)
    response = await client.post(
        "/api/v1/ai/chat", json=CHAT, headers={"Cookie": f"{COOKIE_NAME}={token}", "X-AI-Model": "m1"}
    )
    assert response.status_code == 403 and response.json()["code"] == "forbidden"


async def test_the_header_key_wins_over_the_cookie(client: AsyncClient, mocker: MockerFixture) -> None:
    seen: list[str] = []

    def build(name: str, *, api_key: str, model: str, timeout_seconds: float) -> FakeProvider:
        seen.append(api_key)
        return FakeProvider(name, model)

    mocker.patch("app.api.deps.build_provider", side_effect=build)
    token = await _sealed(client)
    headers = _with(
        token, **{"X-AI-Provider": "groq", "X-AI-Key": "otra-key-distinta-99", "X-AI-Model": "m1"}
    )
    await client.post("/api/v1/ai/chat", json=CHAT, headers=headers)
    assert seen == ["otra-key-distinta-99"]


@pytest.mark.parametrize("tamper", ["garbage", "x" * 400])
async def test_a_forged_or_corrupt_cookie_asks_the_person_to_load_the_key_again(
    client: AsyncClient, tamper: str
) -> None:
    response = await client.post("/api/v1/ai/chat", json=CHAT, headers=_with(tamper, **{"X-AI-Model": "m1"}))
    assert response.status_code == 401
    assert response.json()["code"] == "ai_credentials_required"
    assert response.json()["reason"] == "session_expired"


async def test_a_cookie_sealed_by_another_secret_is_rejected(client: AsyncClient, app: FastAPI) -> None:
    token = await _sealed(client)
    from cryptography.fernet import Fernet

    from app.services.key_sealing import KeySealer

    other = KeySealer([Fernet.generate_key().decode()], session_seconds=60, remember_seconds=60)
    app.dependency_overrides[get_key_sealer] = lambda: other
    response = await client.get("/api/v1/ai/session", headers=_with(token))
    assert response.status_code == 401 and response.json()["reason"] == "session_expired"


async def test_without_a_sealing_key_the_feature_is_off_and_header_mode_still_works(
    client: AsyncClient, app: FastAPI, mocker: MockerFixture
) -> None:
    app.dependency_overrides[get_key_sealer] = lambda: None
    response = await client.post("/api/v1/ai/session", json=BODY, headers=MARK)
    assert response.status_code == 503 and response.json()["code"] == "ai_sessions_disabled"
    assert "set-cookie" not in response.headers

    mocker.patch(
        "app.api.deps.build_provider", side_effect=lambda name, **kw: FakeProvider(name, kw["model"])
    )
    headers = {"X-AI-Provider": "gemini", "X-AI-Key": KEY, "X-AI-Model": "m1"}
    assert (await client.post("/api/v1/ai/chat", json=CHAT, headers=headers)).status_code == 200


async def test_no_credentials_at_all_still_asks_for_them(client: AsyncClient) -> None:
    response = await client.post("/api/v1/ai/chat", json=CHAT, headers={"X-AI-Model": "m1"})
    assert response.status_code == 401 and response.json()["code"] == "ai_credentials_required"
    assert "reason" not in response.json()
