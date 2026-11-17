from unittest.mock import AsyncMock, MagicMock

import pytest
from google.genai import errors, types
from pytest_mock import MockerFixture

from app.models import ChatMessage
from app.providers.llm.base import ProviderUnavailable
from app.providers.llm.gemini import GeminiProvider


def _provider(mocker: MockerFixture, generate: AsyncMock) -> GeminiProvider:
    provider = GeminiProvider(api_key="k", model="modelo-x", timeout_seconds=5)
    mocker.patch.object(provider._client.aio.models, "generate_content", generate)
    return provider


async def test_chat_passes_model_system_prompt_and_returns_text(mocker: MockerFixture) -> None:
    generate = AsyncMock(return_value=MagicMock(text=" hola "))
    provider = _provider(mocker, generate)
    assert await provider.chat("SISTEMA", [ChatMessage(role="user", content="pregunta")]) == "hola"
    assert generate.await_args is not None
    kwargs = generate.await_args.kwargs
    assert kwargs["model"] == "modelo-x"
    assert kwargs["config"].system_instruction == "SISTEMA"
    assert kwargs["contents"][0].parts[0].text == "pregunta"


async def test_describe_image_sends_the_bytes_as_an_inline_part(mocker: MockerFixture) -> None:
    generate = AsyncMock(return_value=MagicMock(text="un gráfico"))
    provider = _provider(mocker, generate)
    assert await provider.describe_image(b"\x89PNG", "image/png", "ctx", system="PROMPT") == "un gráfico"
    assert generate.await_args is not None
    parts = generate.await_args.kwargs["contents"][0].parts
    assert isinstance(parts[0], types.Part) and parts[0].inline_data is not None
    assert parts[0].inline_data.mime_type == "image/png"


@pytest.mark.parametrize(
    "failure",
    [errors.APIError(429, {"error": {"message": "quota"}}), TimeoutError()],
)
async def test_quota_and_timeouts_become_provider_unavailable(
    mocker: MockerFixture, failure: Exception
) -> None:
    provider = _provider(mocker, AsyncMock(side_effect=failure))
    with pytest.raises(ProviderUnavailable):
        await provider.chat("s", [ChatMessage(role="user", content="x")])


async def test_empty_response_becomes_provider_unavailable(mocker: MockerFixture) -> None:
    provider = _provider(mocker, AsyncMock(return_value=MagicMock(text=None)))
    with pytest.raises(ProviderUnavailable):
        await provider.chat("s", [ChatMessage(role="user", content="x")])
