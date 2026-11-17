import json

import httpx
import pytest

from app.models import ChatMessage
from app.providers.llm.base import ProviderUnavailable
from app.providers.llm.groq import GroqProvider

MESSAGES = [ChatMessage(role="user", content="hola")]


def _groq(handler: httpx.MockTransport) -> GroqProvider:
    return GroqProvider(api_key="k-secret", model="m1", timeout_seconds=5, transport=handler)


async def test_groq_sends_openai_style_request_and_returns_text() -> None:
    seen: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["auth"] = request.headers["authorization"]
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json={"choices": [{"message": {"content": " respuesta "}}]})

    answer = await _groq(httpx.MockTransport(handler)).chat("sistema", MESSAGES)
    assert answer == "respuesta"
    assert seen["url"] == "https://api.groq.com/openai/v1/chat/completions"
    assert seen["auth"] == "Bearer k-secret"
    body = seen["body"]
    assert isinstance(body, dict) and body["model"] == "m1"
    assert body["messages"][0] == {"role": "system", "content": "sistema"}


@pytest.mark.parametrize("status", [429, 500, 401])
async def test_groq_http_errors_become_provider_unavailable(status: int) -> None:
    transport = httpx.MockTransport(lambda _r: httpx.Response(status, json={"error": "x"}))
    with pytest.raises(ProviderUnavailable):
        await _groq(transport).chat("s", MESSAGES)


async def test_groq_malformed_body_becomes_provider_unavailable() -> None:
    transport = httpx.MockTransport(lambda _r: httpx.Response(200, json={"unexpected": True}))
    with pytest.raises(ProviderUnavailable):
        await _groq(transport).chat("s", MESSAGES)


async def test_groq_has_no_image_support() -> None:
    with pytest.raises(ProviderUnavailable):
        await _groq(httpx.MockTransport(lambda _r: httpx.Response(200))).describe_image(b"x", "image/png", "")
