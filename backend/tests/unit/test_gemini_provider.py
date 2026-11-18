from collections.abc import AsyncIterator
from unittest.mock import AsyncMock

import httpx
import pytest
from google.genai import errors, types
from pytest_mock import MockerFixture

from app.models import ChatMessage, Completion
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
from app.providers.llm.gemini import GeminiProvider

KEY = "AIza-clave-de-prueba-123456"
FINISH = types.FinishReason


def _response(
    text: str | None = "hola",
    finish: types.FinishReason | None = FINISH.STOP,
    block: types.BlockedReason | None = None,
) -> types.GenerateContentResponse:
    candidates = [
        types.Candidate(
            content=types.Content(parts=[types.Part(text=text)] if text is not None else []),
            finish_reason=finish,
        )
    ]
    feedback = types.GenerateContentResponsePromptFeedback(block_reason=block) if block else None
    return types.GenerateContentResponse(candidates=candidates, prompt_feedback=feedback)


def _provider(mocker: MockerFixture, generate: AsyncMock) -> GeminiProvider:
    provider = GeminiProvider(api_key=KEY, model="modelo-x", timeout_seconds=5)
    mocker.patch.object(provider._client.aio.models, "generate_content", generate)
    return provider


MESSAGES = [ChatMessage(role="user", content="pregunta")]


async def test_chat_passes_model_system_prompt_and_returns_text(mocker: MockerFixture) -> None:
    generate = AsyncMock(return_value=_response(" hola "))
    provider = _provider(mocker, generate)
    assert await provider.chat("SISTEMA", MESSAGES) == Completion("hola", truncated=False)
    assert generate.await_args is not None
    kwargs = generate.await_args.kwargs
    assert kwargs["model"] == "modelo-x"
    assert kwargs["config"].system_instruction == "SISTEMA"
    assert kwargs["contents"][0].parts[0].text == "pregunta"


async def test_describe_image_sends_the_bytes_as_an_inline_part(mocker: MockerFixture) -> None:
    generate = AsyncMock(return_value=_response("un gráfico"))
    provider = _provider(mocker, generate)
    done = await provider.describe_image(b"\x89PNG", "image/png", "ctx", system="PROMPT")
    assert done.text == "un gráfico"
    assert generate.await_args is not None
    parts = generate.await_args.kwargs["contents"][0].parts
    assert isinstance(parts[0], types.Part) and parts[0].inline_data is not None
    assert parts[0].inline_data.mime_type == "image/png"


def _api_error(
    code: int, message: str, status: str = "", details: list[object] | None = None
) -> errors.APIError:
    return errors.APIError(
        code, {"error": {"code": code, "message": message, "status": status, "details": details or []}}
    )


@pytest.mark.parametrize(
    ("failure", "expected"),
    [
        (
            _api_error(400, "API key not valid. Please pass a valid API key.", "INVALID_ARGUMENT"),
            ProviderAuthError,
        ),
        (
            _api_error(400, "API key expired. Please renew the API key.", "INVALID_ARGUMENT"),
            ProviderAuthError,
        ),
        (_api_error(403, "Your API key was reported as leaked.", "PERMISSION_DENIED"), ProviderAuthError),
        (_api_error(401, "unauthenticated", "UNAUTHENTICATED"), ProviderAuthError),
        # Mencionan la key pero no es la key: cuota, permisos del modelo, región.
        (_api_error(429, "Quota exceeded for this API key", "RESOURCE_EXHAUSTED"), ProviderQuotaError),
        (_api_error(403, "Permission denied on model", "PERMISSION_DENIED"), ProviderPermissionDenied),
        (
            _api_error(400, "User location is not supported for the API use.", "FAILED_PRECONDITION"),
            ProviderPermissionDenied,
        ),
        (_api_error(404, "models/foo is not found for API version v1", "NOT_FOUND"), ProviderModelNotFound),
        (_api_error(413, "request too large"), ProviderPayloadTooLarge),
        (
            _api_error(
                400,
                "The input token count (50000) exceeds the maximum number of tokens allowed (32768).",
                "INVALID_ARGUMENT",
            ),
            ProviderPayloadTooLarge,
        ),
        (
            _api_error(503, "The model is overloaded. Please try again later.", "UNAVAILABLE"),
            ProviderUnavailable,
        ),
        (_api_error(500, "internal", "INTERNAL"), ProviderUnavailable),
        (_api_error(504, "deadline exceeded", "DEADLINE_EXCEEDED"), ProviderTimeout),
        (TimeoutError(), ProviderTimeout),
        (httpx.ReadTimeout("lento"), ProviderTimeout),
        (httpx.ConnectError("sin red"), ProviderUnavailable),
    ],
)
async def test_errors_are_classified(
    mocker: MockerFixture, failure: Exception, expected: type[ProviderError]
) -> None:
    provider = _provider(mocker, AsyncMock(side_effect=failure))
    with pytest.raises(expected):
        await provider.chat("s", MESSAGES)


async def test_quota_error_says_how_long_to_wait_and_whether_it_is_the_daily_limit(
    mocker: MockerFixture,
) -> None:
    details = [
        {
            "@type": "type.googleapis.com/google.rpc.QuotaFailure",
            "violations": [{"quotaId": "GenerateRequestsPerDayPerProjectPerModel-FreeTier"}],
        },
        {"@type": "type.googleapis.com/google.rpc.RetryInfo", "retryDelay": "34s"},
    ]
    provider = _provider(
        mocker,
        AsyncMock(
            side_effect=_api_error(429, "You exceeded your current quota", "RESOURCE_EXHAUSTED", details)
        ),
    )
    with pytest.raises(ProviderQuotaError) as caught:
        await provider.chat("s", MESSAGES)
    assert caught.value.reason == "daily"
    assert caught.value.retry_after == 34.0
    assert caught.value.provider_message == "You exceeded your current quota"


async def test_the_key_is_removed_from_the_provider_message(mocker: MockerFixture) -> None:
    provider = _provider(
        mocker, AsyncMock(side_effect=_api_error(400, f"Bad argument near {KEY}", "INVALID_ARGUMENT"))
    )
    with pytest.raises(ProviderError) as caught:
        await provider.chat("s", MESSAGES)
    assert caught.value.provider_message is not None
    assert KEY not in caught.value.provider_message


async def test_a_response_cut_by_the_output_limit_is_flagged_truncated(mocker: MockerFixture) -> None:
    provider = _provider(
        mocker, AsyncMock(return_value=_response("1. Primera pregunta\n2. Segun", FINISH.MAX_TOKENS))
    )
    assert (await provider.chat("s", MESSAGES)).truncated is True


@pytest.mark.parametrize(
    ("response", "expected", "reason"),
    [
        (_response(None, FINISH.SAFETY), ProviderContentBlocked, "safety"),
        (_response(None, FINISH.PROHIBITED_CONTENT), ProviderContentBlocked, "prohibited_content"),
        (_response(None, FINISH.RECITATION), ProviderContentBlocked, "recitation"),
        (_response(None, None, types.BlockedReason.SAFETY), ProviderContentBlocked, "safety"),
        # El modelo «pensó» hasta agotar el límite de salida y no llegó a escribir.
        (_response(None, FINISH.MAX_TOKENS), ProviderEmptyResponse, "length"),
        (_response(None, FINISH.OTHER), ProviderEmptyResponse, "other"),
        (_response("   ", FINISH.STOP), ProviderEmptyResponse, "stop"),
    ],
)
async def test_an_empty_response_says_why(
    mocker: MockerFixture, response: types.GenerateContentResponse, expected: type[ProviderError], reason: str
) -> None:
    provider = _provider(mocker, AsyncMock(return_value=response))
    with pytest.raises(expected) as caught:
        await provider.chat("s", MESSAGES)
    assert caught.value.reason == reason


async def test_list_models_keeps_text_generation_models_only(mocker: MockerFixture) -> None:
    def model(name: str, display: str, actions: list[str]) -> types.Model:
        return types.Model(name=name, display_name=display, supported_actions=actions)

    found = [
        model("models/gemini-3.5-flash-lite", "Gemini 3.5 Flash Lite", ["generateContent", "countTokens"]),
        model("models/gemma-4-31b-it", "Gemma 4 31B IT", ["generateContent"]),
        model("models/gemini-3.1-flash-image", "Nano Banana 2", ["generateContent"]),
        model("models/gemini-embedding-001", "Embedding", ["embedContent"]),
        model("models/deep-research-preview-04-2026", "Deep Research", ["generateContent"]),
    ]

    async def pager() -> AsyncIterator[types.Model]:
        for m in found:
            yield m

    provider = GeminiProvider(api_key=KEY, model="", timeout_seconds=5)
    mocker.patch.object(provider._client.aio.models, "list", AsyncMock(return_value=pager()))
    models = {m.id: m for m in await provider.list_models()}
    assert set(models) == {"gemini-3.5-flash-lite", "gemma-4-31b-it"}
    assert models["gemini-3.5-flash-lite"].supports_images is True
    assert models["gemma-4-31b-it"].supports_images is None


async def test_list_models_with_an_invalid_key_is_an_auth_error(mocker: MockerFixture) -> None:
    provider = GeminiProvider(api_key=KEY, model="", timeout_seconds=5)
    mocker.patch.object(
        provider._client.aio.models,
        "list",
        AsyncMock(side_effect=_api_error(400, "API key not valid.", "INVALID_ARGUMENT")),
    )
    with pytest.raises(ProviderAuthError):
        await provider.list_models()


def test_scope_depends_on_the_key_but_never_contains_it() -> None:
    a = GeminiProvider(api_key="key-de-ana-123", model="m", timeout_seconds=5)
    b = GeminiProvider(api_key="key-de-beto-123", model="m", timeout_seconds=5)
    assert a.scope != b.scope
    assert "key-de-ana" not in a.scope


async def test_aclose_really_closes_both_http_clients() -> None:
    provider = GeminiProvider(api_key=KEY, model="m", timeout_seconds=5)
    api = provider._client._api_client
    assert api._async_httpx_client is not None and api._httpx_client is not None
    assert not api._async_httpx_client.is_closed and not api._httpx_client.is_closed
    await provider.aclose()
    assert api._async_httpx_client.is_closed and api._httpx_client.is_closed
