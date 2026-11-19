import base64
import json

import httpx
import pytest

from app.models import ChatMessage, Completion
from app.providers.llm.base import (
    ProviderAuthError,
    ProviderContentBlocked,
    ProviderEmptyResponse,
    ProviderError,
    ProviderImageRejected,
    ProviderModelNotFound,
    ProviderPayloadTooLarge,
    ProviderPermissionDenied,
    ProviderQuotaError,
    ProviderRejected,
    ProviderTimeout,
    ProviderUnavailable,
)
from app.providers.llm.openai_compatible import OpenAICompatibleProvider

MESSAGES = [ChatMessage(role="user", content="hola")]


def _provider(
    handler: httpx.MockTransport, name: str = "groq", model: str = "m1"
) -> OpenAICompatibleProvider:
    return OpenAICompatibleProvider(
        name=name, api_key="k-secret", model=model, timeout_seconds=5, transport=handler
    )


async def test_chat_sends_openai_style_request_with_the_user_key() -> None:
    seen: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["auth"] = request.headers["authorization"]
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json={"choices": [{"message": {"content": " respuesta "}}]})

    assert await _provider(httpx.MockTransport(handler)).chat("sistema", MESSAGES) == Completion("respuesta")
    assert seen["url"] == "https://api.groq.com/openai/v1/chat/completions"
    assert seen["auth"] == "Bearer k-secret"
    body = seen["body"]
    assert isinstance(body, dict) and body["model"] == "m1"
    assert body["messages"][0] == {"role": "system", "content": "sistema"}


async def test_openrouter_uses_its_own_base_url() -> None:
    urls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        urls.append(str(request.url))
        return httpx.Response(200, json={"choices": [{"message": {"content": "ok"}}]})

    await _provider(httpx.MockTransport(handler), name="openrouter").chat("s", MESSAGES)
    assert urls == ["https://openrouter.ai/api/v1/chat/completions"]


async def test_describe_image_sends_a_data_url() -> None:
    body: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        body.update(json.loads(request.content))
        return httpx.Response(200, json={"choices": [{"message": {"content": "un gráfico"}}]})

    answer = await _provider(httpx.MockTransport(handler)).describe_image(
        b"\x89PNG", "image/png", "ctx", system="P"
    )
    assert answer == Completion("un gráfico")
    messages = body["messages"]
    assert isinstance(messages, list)
    part = messages[1]["content"][1]
    assert part["image_url"]["url"] == "data:image/png;base64," + base64.b64encode(b"\x89PNG").decode()


KEY = "k-secret"


def _fails_with(status: int, body: object, headers: dict[str, str] | None = None) -> httpx.MockTransport:
    return httpx.MockTransport(lambda _r: httpx.Response(status, json=body, headers=headers))


@pytest.mark.parametrize(
    ("status", "body", "error"),
    [
        (401, {"error": {"message": "Invalid API Key"}}, ProviderAuthError),
        (403, {"error": {"message": "Authentication failed"}}, ProviderAuthError),
        (402, {"error": {"message": "Insufficient credits", "code": 402}}, ProviderQuotaError),
        (429, {"error": {"message": "Rate limit reached for requests per minute"}}, ProviderQuotaError),
        (413, {"error": {"message": "Request too large"}}, ProviderPayloadTooLarge),
        (
            400,
            {
                "error": {
                    "message": "This model's maximum context length is 8192 tokens",
                    "code": "context_length_exceeded",
                }
            },
            ProviderPayloadTooLarge,
        ),
        (400, {"error": {"message": "The prompt was flagged by moderation"}}, ProviderContentBlocked),
        (403, {"error": {"message": "Your input was flagged"}}, ProviderContentBlocked),
        (403, {"error": {"message": "No access to this model"}}, ProviderPermissionDenied),
        (
            404,
            {"error": {"message": "The model `x` does not exist", "code": "model_not_found"}},
            ProviderModelNotFound,
        ),
        (404, {"detail": "Function 'abc': Not found for account 'x'"}, ProviderModelNotFound),  # NVIDIA
        (400, {"error": {"message": "Invalid value for temperature"}}, ProviderRejected),
        (
            422,
            {"object": "error", "message": {"detail": [{"loc": ["body", "model"]}]}},
            ProviderRejected,
        ),  # Mistral
        (500, {"error": {"message": "Internal"}}, ProviderUnavailable),
        (503, {"error": {"message": "overloaded"}}, ProviderUnavailable),
        (504, {"error": {"message": "gateway"}}, ProviderTimeout),
    ],
)
async def test_http_errors_are_classified(status: int, body: object, error: type[ProviderError]) -> None:
    with pytest.raises(error):
        await _provider(_fails_with(status, body)).chat("s", MESSAGES)


async def test_an_error_page_that_is_not_json_still_becomes_an_error() -> None:
    transport = httpx.MockTransport(lambda _r: httpx.Response(502, text="<html>Bad gateway</html>"))
    with pytest.raises(ProviderUnavailable) as caught:
        await _provider(transport).chat("s", MESSAGES)
    assert caught.value.status == 502


async def test_a_quota_error_carries_the_wait_and_the_provider_message_without_the_key() -> None:
    body = {"error": {"message": f"Rate limit reached for key {KEY}: tokens per day (TPD)"}}
    with pytest.raises(ProviderQuotaError) as caught:
        await _provider(_fails_with(429, body, {"retry-after": "42"})).chat("s", MESSAGES)
    assert caught.value.reason == "daily"
    assert caught.value.retry_after == 42.0
    assert caught.value.provider_message is not None
    assert KEY not in caught.value.provider_message


async def test_a_400_when_describing_an_image_is_an_image_rejection() -> None:
    body = {"error": {"message": "This model does not support image input"}}
    with pytest.raises(ProviderImageRejected):
        await _provider(_fails_with(400, body)).describe_image(b"x", "image/png", "")
    with pytest.raises(ProviderRejected) as caught:  # el mismo error al chatear no es de imagen
        await _provider(_fails_with(400, body)).chat("s", MESSAGES)
    assert not isinstance(caught.value, ProviderImageRejected)


async def test_openrouter_can_answer_200_with_the_error_in_the_body() -> None:
    body = {"error": {"message": "Rate limit exceeded: free-models-per-day", "code": 429}}
    transport = httpx.MockTransport(lambda _r: httpx.Response(200, json=body))
    with pytest.raises(ProviderQuotaError) as caught:
        await _provider(transport, name="openrouter").chat("s", MESSAGES)
    assert caught.value.reason == "daily"


def _completion(content: str | None, finish: str, **message: object) -> httpx.MockTransport:
    body = {"choices": [{"message": {"content": content, **message}, "finish_reason": finish}]}
    return httpx.MockTransport(lambda _r: httpx.Response(200, json=body))


async def test_an_answer_cut_by_the_output_limit_is_flagged_truncated() -> None:
    done = await _provider(_completion("1. Primera\n2. Segu", "length")).chat("s", MESSAGES)
    assert done == Completion("1. Primera\n2. Segu", truncated=True)


@pytest.mark.parametrize(
    ("content", "finish", "message", "expected", "reason"),
    [
        ("", "length", {}, ProviderEmptyResponse, "length"),  # un modelo que «razona» gastó todos los tokens
        (None, "stop", {}, ProviderEmptyResponse, "stop"),
        ("  ", "", {}, ProviderEmptyResponse, "empty"),
        ("", "content_filter", {}, ProviderContentBlocked, "content_filter"),
        (None, "stop", {"refusal": "No puedo ayudar con eso"}, ProviderContentBlocked, "content_filter"),
    ],
)
async def test_an_empty_answer_says_why(
    content: str | None, finish: str, message: dict[str, object], expected: type[ProviderError], reason: str
) -> None:
    with pytest.raises(expected) as caught:
        await _provider(_completion(content, finish, **message)).chat("s", MESSAGES)
    assert caught.value.reason == reason


async def test_malformed_body_and_network_errors_are_transient() -> None:
    with pytest.raises(ProviderUnavailable):
        await _provider(httpx.MockTransport(lambda _r: httpx.Response(200, json={"x": 1}))).chat(
            "s", MESSAGES
        )

    def boom(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("sin red", request=request)

    with pytest.raises(ProviderUnavailable):
        await _provider(httpx.MockTransport(boom)).chat("s", MESSAGES)


async def test_a_timeout_is_reported_as_timeout_so_it_is_not_retried() -> None:
    def slow(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("lento", request=request)

    with pytest.raises(ProviderTimeout):
        await _provider(httpx.MockTransport(slow)).chat("s", MESSAGES)


async def test_groq_list_models_keeps_only_text_chat_models() -> None:
    data = [
        {
            "id": "openai/gpt-oss-20b",
            "input_modalities": ["text"],
            "output_modalities": ["text"],
            "active": True,
        },
        {
            "id": "qwen/vl",
            "input_modalities": ["text", "image"],
            "output_modalities": ["text"],
            "active": True,
        },
        {"id": "whisper-large-v3", "input_modalities": ["audio"], "output_modalities": ["transcription"]},
        {"id": "canopylabs/orpheus", "input_modalities": ["text"], "output_modalities": ["speech"]},
        {
            "id": "meta-llama/llama-prompt-guard-2-22m",
            "input_modalities": ["text"],
            "output_modalities": ["text"],
        },
        {"id": "viejo", "input_modalities": ["text"], "output_modalities": ["text"], "active": False},
        {"id": "sin-datos"},
    ]
    transport = httpx.MockTransport(lambda _r: httpx.Response(200, json={"object": "list", "data": data}))
    models = {m.id: m for m in await _provider(transport, model="").list_models()}
    assert set(models) == {"openai/gpt-oss-20b", "qwen/vl", "sin-datos"}
    assert models["qwen/vl"].supports_images is True
    assert models["openai/gpt-oss-20b"].supports_images is False
    assert models["sin-datos"].supports_images is None
    assert all(m.free is None for m in models.values())  # Groq: el nivel gratuito es por cuenta


async def test_openrouter_list_models_flags_free_ones() -> None:
    data = [
        {
            "id": "vendor/a:free",
            "name": "A (free)",
            "architecture": {"input_modalities": ["text", "image"], "output_modalities": ["text"]},
            "pricing": {"prompt": "0", "completion": "0"},
        },
        {
            "id": "vendor/b",
            "name": "B",
            "architecture": {"input_modalities": ["text"], "output_modalities": ["text"]},
            "pricing": {"prompt": "0.000008", "completion": "0.00004"},
        },
        {
            "id": "vendor/img",
            "architecture": {"input_modalities": ["text"], "output_modalities": ["image"]},
            "pricing": {"prompt": "0", "completion": "0"},
        },
    ]
    transport = httpx.MockTransport(lambda _r: httpx.Response(200, json={"data": data}))
    models = {m.id: m for m in await _provider(transport, name="openrouter", model="").list_models()}
    assert set(models) == {"vendor/a:free", "vendor/b"}
    assert models["vendor/a:free"].free is True and models["vendor/a:free"].supports_images is True
    assert models["vendor/b"].free is False


async def test_list_models_with_an_invalid_key_is_an_auth_error() -> None:
    transport = httpx.MockTransport(lambda _r: httpx.Response(401, json={"error": "invalid"}))
    with pytest.raises(ProviderAuthError):
        await _provider(transport, model="").list_models()


@pytest.mark.parametrize("models_status", [200, 500])
async def test_openrouter_validates_the_key_alongside_the_public_listing(models_status: int) -> None:
    paths: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        paths.append(request.url.path)
        if request.url.path.endswith("/key"):
            return httpx.Response(401, json={"error": "invalid"})
        return httpx.Response(models_status, json={"data": []})

    # La key inválida gana siempre, aunque el listado (público) haya respondido bien o haya fallado.
    with pytest.raises(ProviderAuthError):
        await _provider(httpx.MockTransport(handler), name="openrouter", model="").list_models()
    assert sorted(paths) == ["/api/v1/key", "/api/v1/models"]  # las dos llamadas van en paralelo


async def test_mistral_uses_capabilities_to_filter_and_detect_vision() -> None:
    data = [
        {
            "id": "mistral-small-latest",
            "name": "mistral-small-latest",
            "capabilities": {"completion_chat": True, "vision": True},
        },
        {"id": "codestral-latest", "capabilities": {"completion_chat": True, "vision": False}},
        {"id": "mistral-embed", "capabilities": {"completion_chat": False, "vision": False}},
        {"id": "mistral-ocr-latest", "capabilities": {"completion_chat": True, "vision": True}},
    ]
    urls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        urls.append(str(request.url))
        return httpx.Response(200, json={"object": "list", "data": data})

    provider = _provider(httpx.MockTransport(handler), name="mistral", model="")
    models = {m.id: m for m in await provider.list_models()}
    assert urls == ["https://api.mistral.ai/v1/models"]
    assert set(models) == {"mistral-small-latest", "codestral-latest"}
    assert models["mistral-small-latest"].supports_images is True
    assert models["codestral-latest"].supports_images is False
    assert provider.verifies_key is True


async def test_mistral_sends_the_image_url_as_a_string() -> None:
    body: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        body.update(json.loads(request.content))
        return httpx.Response(200, json={"choices": [{"message": {"content": "ok"}}]})

    await _provider(httpx.MockTransport(handler), name="mistral").describe_image(b"x", "image/png", "")
    messages = body["messages"]
    assert isinstance(messages, list)
    assert isinstance(messages[1]["content"][1]["image_url"], str)


async def test_nvidia_lists_chat_models_but_cannot_verify_the_key() -> None:
    ids = [
        "openai/gpt-oss-20b",
        "nvidia/nemotron-3.5-super-vl-120b-a12b",
        "nvidia/nemotron-3.5-embed-8b",
        "nvidia/llama-3.1-nemotron-safety-guard-8b-v3",
        "nvidia/nvclip",
        "nvidia/ai-synthetic-video-detector",
        "bigcode/starcoder2-15b",
    ]
    urls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        urls.append(str(request.url))
        return httpx.Response(200, json={"data": [{"id": i, "object": "model"} for i in ids]})

    provider = _provider(httpx.MockTransport(handler), name="nvidia", model="")
    models = {m.id: m for m in await provider.list_models()}
    assert urls == ["https://integrate.api.nvidia.com/v1/models"]
    assert set(models) == {"openai/gpt-oss-20b", "nvidia/nemotron-3.5-super-vl-120b-a12b"}
    assert models["nvidia/nemotron-3.5-super-vl-120b-a12b"].supports_images is True
    assert models["openai/gpt-oss-20b"].supports_images is None
    assert provider.verifies_key is False


# --- OpenAI (ChatGPT) ---------------------------------------------------------------------------------


async def test_openai_uses_its_url_and_the_parameters_current_models_accept() -> None:
    seen: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["auth"] = request.headers["authorization"]
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json={"choices": [{"message": {"content": "hola"}}]})

    await _provider(httpx.MockTransport(handler), name="openai", model="gpt-4o").chat("s", MESSAGES)
    assert seen["url"] == "https://api.openai.com/v1/chat/completions"
    assert seen["auth"] == "Bearer k-secret"
    body = seen["body"]
    assert isinstance(body, dict)
    # Los modelos de razonamiento rechazan `max_tokens` y una temperatura distinta de la de fábrica.
    assert body["max_completion_tokens"] == 4096
    assert "max_tokens" not in body
    assert "temperature" not in body


async def test_the_other_providers_keep_sending_max_tokens_and_temperature() -> None:
    body: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        body.update(json.loads(request.content))
        return httpx.Response(200, json={"choices": [{"message": {"content": "ok"}}]})

    await _provider(httpx.MockTransport(handler), name="groq").chat("s", MESSAGES)
    assert body["max_tokens"] == 2048
    assert body["temperature"] == 0.3
    assert "max_completion_tokens" not in body


async def test_openai_model_list_keeps_only_chat_models_and_marks_the_ones_that_read_images() -> None:
    ids = [
        "gpt-4o",
        "gpt-4o-mini",
        "gpt-3.5-turbo",
        "gpt-5",
        "chatgpt-4o-latest",
        "o3-mini",
        "text-embedding-3-small",
        "whisper-1",
        "tts-1",
        "dall-e-3",
        "gpt-4o-audio-preview",
        "gpt-4o-realtime-preview",
        "gpt-4o-mini-transcribe",
        "gpt-image-1",
        "omni-moderation-latest",
        "davinci-002",
        "gpt-3.5-turbo-instruct",
        "o1-pro",
        "gpt-4o-search-preview",
    ]
    transport = httpx.MockTransport(
        lambda _r: httpx.Response(200, json={"data": [{"id": i, "object": "model"} for i in ids]})
    )
    models = await _provider(transport, name="openai").list_models()
    by_id = {m.id: m for m in models}
    assert set(by_id) == {"gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo", "gpt-5", "chatgpt-4o-latest", "o3-mini"}
    assert by_id["gpt-4o"].supports_images is True
    assert by_id["gpt-5"].supports_images is True
    assert by_id["gpt-3.5-turbo"].supports_images is None  # no se sabe: no se promete nada
    assert all(m.free is None for m in models)
    assert _provider(transport, name="openai").verifies_key is True


async def test_openai_without_balance_is_a_credit_error() -> None:
    body = {"error": {"message": "You exceeded your current quota", "code": "insufficient_quota"}}
    with pytest.raises(ProviderQuotaError) as caught:
        await _provider(_fails_with(429, body), name="openai").chat("s", MESSAGES)
    assert caught.value.reason == "credit"
