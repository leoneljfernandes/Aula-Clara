import base64
import json

import httpx
import pytest

from app.models import ChatMessage, Completion
from app.providers.llm.anthropic import AnthropicProvider
from app.providers.llm.base import (
    ProviderAuthError,
    ProviderContentBlocked,
    ProviderEmptyResponse,
    ProviderError,
    ProviderModelNotFound,
    ProviderPayloadTooLarge,
    ProviderPermissionDenied,
    ProviderQuotaError,
    ProviderTimeout,
    ProviderUnavailable,
)

KEY = "sk-ant-api03-secret-key-value"
MESSAGES = [ChatMessage(role="user", content="hola")]


def _provider(transport: httpx.MockTransport, model: str = "claude-sonnet-4-5") -> AnthropicProvider:
    return AnthropicProvider(api_key=KEY, model=model, timeout_seconds=5, transport=transport)


def _reply(text: str = "respuesta", stop: str = "end_turn") -> dict[str, object]:
    return {"type": "message", "content": [{"type": "text", "text": text}], "stop_reason": stop}


async def test_chat_uses_the_messages_api_with_the_users_key() -> None:
    seen: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["headers"] = dict(request.headers)
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json=_reply(" respuesta "))

    answer = await _provider(httpx.MockTransport(handler)).chat("sistema", MESSAGES)
    assert answer == Completion("respuesta")
    assert seen["url"] == "https://api.anthropic.com/v1/messages"
    headers = seen["headers"]
    assert isinstance(headers, dict)
    assert headers["x-api-key"] == KEY
    assert headers["anthropic-version"] == "2023-06-01"
    assert "authorization" not in headers
    body = seen["body"]
    assert isinstance(body, dict)
    assert body["model"] == "claude-sonnet-4-5"
    assert body["system"] == "sistema"
    assert body["max_tokens"] == 2048
    assert body["messages"] == [{"role": "user", "content": "hola"}]
    assert "temperature" not in body


async def test_the_assistant_role_is_sent_as_assistant() -> None:
    body: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        body.update(json.loads(request.content))
        return httpx.Response(200, json=_reply())

    history = [ChatMessage("user", "a"), ChatMessage("assistant", "b"), ChatMessage("user", "c")]
    await _provider(httpx.MockTransport(handler)).chat("s", history)
    messages = body["messages"]
    assert isinstance(messages, list)
    assert [m["role"] for m in messages] == ["user", "assistant", "user"]


async def test_text_blocks_are_joined_and_other_blocks_ignored() -> None:
    reply = {
        "content": [
            {"type": "text", "text": "uno "},
            {"type": "thinking", "thinking": "..."},
            {"type": "text", "text": "dos"},
        ],
        "stop_reason": "end_turn",
    }
    transport = httpx.MockTransport(lambda _r: httpx.Response(200, json=reply))
    assert (await _provider(transport).chat("s", MESSAGES)).text == "uno dos"


async def test_a_reply_cut_by_the_token_limit_is_marked_truncated() -> None:
    transport = httpx.MockTransport(lambda _r: httpx.Response(200, json=_reply("cortada", "max_tokens")))
    assert await _provider(transport).chat("s", MESSAGES) == Completion("cortada", truncated=True)


async def test_a_refusal_is_reported_as_blocked_content() -> None:
    reply = {"content": [], "stop_reason": "refusal"}
    transport = httpx.MockTransport(lambda _r: httpx.Response(200, json=reply))
    with pytest.raises(ProviderContentBlocked):
        await _provider(transport).chat("s", MESSAGES)


async def test_an_empty_reply_is_an_error_and_a_full_output_limit_says_so() -> None:
    empty = httpx.MockTransport(
        lambda _r: httpx.Response(200, json={"content": [], "stop_reason": "end_turn"})
    )
    with pytest.raises(ProviderEmptyResponse):
        await _provider(empty).chat("s", MESSAGES)
    limit = httpx.MockTransport(
        lambda _r: httpx.Response(200, json={"content": [], "stop_reason": "max_tokens"})
    )
    with pytest.raises(ProviderEmptyResponse) as caught:
        await _provider(limit).chat("s", MESSAGES)
    assert caught.value.reason == "length"


async def test_describe_image_sends_a_base64_image_block_before_the_text() -> None:
    body: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        body.update(json.loads(request.content))
        return httpx.Response(200, json=_reply("un gráfico"))

    answer = await _provider(httpx.MockTransport(handler)).describe_image(
        b"\x89PNG", "image/png", "ctx", system="P"
    )
    assert answer == Completion("un gráfico")
    assert body["system"] == "P"
    content = body["messages"][0]["content"]  # type: ignore[index]
    assert content[0] == {
        "type": "image",
        "source": {
            "type": "base64",
            "media_type": "image/png",
            "data": base64.b64encode(b"\x89PNG").decode(),
        },
    }
    assert content[1]["type"] == "text" and "ctx" in content[1]["text"]


async def test_list_models_returns_the_models_with_their_display_names() -> None:
    listing = {
        "data": [
            {"type": "model", "id": "claude-sonnet-4-5", "display_name": "Claude Sonnet 4.5"},
            {"type": "model", "id": "claude-haiku-4-5", "display_name": "Claude Haiku 4.5"},
            {"type": "model", "id": "sin-nombre"},
        ],
        "has_more": False,
    }
    seen: dict[str, str] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        return httpx.Response(200, json=listing)

    provider = _provider(httpx.MockTransport(handler), model="")
    models = await provider.list_models()
    assert seen["url"].startswith("https://api.anthropic.com/v1/models")
    assert [(m.id, m.name) for m in models] == [
        ("claude-sonnet-4-5", "Claude Sonnet 4.5"),
        ("claude-haiku-4-5", "Claude Haiku 4.5"),
        ("sin-nombre", "sin-nombre"),
    ]
    assert all(m.supports_images is True and m.free is None for m in models)
    assert provider.verifies_key is True


def _error(kind: str, message: str) -> dict[str, object]:
    return {"type": "error", "error": {"type": kind, "message": message}}


@pytest.mark.parametrize(
    ("status", "body", "error"),
    [
        (401, _error("authentication_error", "invalid x-api-key"), ProviderAuthError),
        (
            403,
            _error(
                "permission_error", "Your API key does not have permission to use the specified resource."
            ),
            ProviderPermissionDenied,
        ),
        (404, _error("not_found_error", "model: claude-x"), ProviderModelNotFound),
        (
            413,
            _error("request_too_large", "Request exceeds the maximum allowed number of bytes."),
            ProviderPayloadTooLarge,
        ),
        (
            429,
            _error("rate_limit_error", "Number of request tokens has exceeded your per-minute rate limit"),
            ProviderQuotaError,
        ),
        (
            400,
            _error(
                "invalid_request_error",
                (
                    "Your credit balance is too low to access the Anthropic API. "
                    "Please go to Plans & Billing to upgrade or purchase credits."
                ),
            ),
            ProviderQuotaError,
        ),
        (500, _error("api_error", "Internal server error"), ProviderUnavailable),
        (529, _error("overloaded_error", "Overloaded"), ProviderUnavailable),
    ],
)
async def test_http_errors_are_classified(status: int, body: object, error: type[ProviderError]) -> None:
    transport = httpx.MockTransport(lambda _r: httpx.Response(status, json=body))
    with pytest.raises(error):
        await _provider(transport).chat("s", MESSAGES)


async def test_the_credit_error_says_credit_and_a_rate_limit_carries_the_wait() -> None:
    credit = httpx.MockTransport(
        lambda _r: httpx.Response(400, json=_error("invalid_request_error", "Your credit balance is too low"))
    )
    with pytest.raises(ProviderQuotaError) as caught:
        await _provider(credit).chat("s", MESSAGES)
    assert caught.value.reason == "credit"
    limited = httpx.MockTransport(
        lambda _r: httpx.Response(
            429, json=_error("rate_limit_error", "slow down"), headers={"retry-after": "30"}
        )
    )
    with pytest.raises(ProviderQuotaError) as waited:
        await _provider(limited).chat("s", MESSAGES)
    assert waited.value.retry_after == 30


async def test_the_key_never_appears_in_an_error_or_its_message() -> None:
    body = _error("invalid_request_error", f"bad request for key {KEY}")
    transport = httpx.MockTransport(lambda _r: httpx.Response(400, json=body))
    with pytest.raises(ProviderError) as caught:
        await _provider(transport).chat("s", MESSAGES)
    assert KEY not in str(caught.value)
    assert KEY not in (caught.value.provider_message or "")


async def test_timeouts_and_network_failures_are_transient_errors() -> None:
    def slow(_r: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("slow")

    def down(_r: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("down")

    with pytest.raises(ProviderTimeout):
        await _provider(httpx.MockTransport(slow)).chat("s", MESSAGES)
    with pytest.raises(ProviderUnavailable):
        await _provider(httpx.MockTransport(down)).chat("s", MESSAGES)


async def test_a_reply_that_is_not_json_is_a_transient_error() -> None:
    transport = httpx.MockTransport(lambda _r: httpx.Response(200, text="<html>nope</html>"))
    with pytest.raises(ProviderUnavailable):
        await _provider(transport).chat("s", MESSAGES)


def test_the_scope_separates_keys_without_containing_them() -> None:
    a = AnthropicProvider(api_key="k1", model="m", timeout_seconds=5)
    b = AnthropicProvider(api_key="k2", model="m", timeout_seconds=5)
    assert a.scope != b.scope
    assert "k1" not in a.scope
    assert a.name == "anthropic"
