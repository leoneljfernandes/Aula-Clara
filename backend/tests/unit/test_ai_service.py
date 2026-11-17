from unittest.mock import AsyncMock, create_autospec

import pytest

from app.crud.answer_cache import AnswerCache
from app.errors import BusinessRuleError
from app.providers.llm.base import LLMProvider, ProviderUnavailable
from app.providers.llm.mock import MockProvider
from app.services.ai import AIService


def _provider(name: str, *, answer: str | None = None, fails: bool = False) -> LLMProvider:
    provider = create_autospec(LLMProvider, instance=True)
    provider.name = name
    provider.supports_images = True
    if fails:
        provider.chat = AsyncMock(side_effect=ProviderUnavailable("429"))
        provider.describe_image = AsyncMock(side_effect=ProviderUnavailable("429"))
    else:
        provider.chat = AsyncMock(return_value=answer)
        provider.describe_image = AsyncMock(return_value=answer)
    return provider  # type: ignore[no-any-return]


def _service(chat: list[LLMProvider], image: list[LLMProvider] | None = None) -> tuple[AIService, AsyncMock]:
    sleep = AsyncMock()
    service = AIService(
        chat_chain=chat,
        image_chain=image or chat,
        cache=AnswerCache(ttl_seconds=60),
        max_input_chars=1_000,
        retry_delay=0.0,
        sleep=sleep,
    )
    return service, sleep


async def _ask(service: AIService, **kw: str | None) -> tuple[str, str]:
    args = {"action": "summarize", "message": None, "document_text": "texto", "selection": None, **kw}
    return await service.chat(**args)  # type: ignore[arg-type]


async def test_uses_the_primary_provider_when_it_works() -> None:
    gemini = _provider("gemini", answer="respuesta real")
    service, _ = _service([gemini, MockProvider()])
    assert await _ask(service) == ("respuesta real", "gemini")


async def test_429_retries_once_then_falls_back_to_the_next_provider() -> None:
    gemini = _provider("gemini", fails=True)
    groq = _provider("groq", answer="del respaldo")
    service, sleep = _service([gemini, groq, MockProvider()])
    assert await _ask(service) == ("del respaldo", "groq")
    assert gemini.chat.await_count == 2  # type: ignore[attr-defined]  # intento + 1 reintento
    sleep.assert_awaited_once()  # backoff entre los dos


async def test_everything_failing_ends_in_the_mock_with_provider_label() -> None:
    service, _ = _service([_provider("gemini", fails=True), MockProvider()])
    answer, provider = await _ask(service, action="quiz")
    assert provider == "mock"
    assert "Preguntas de repaso" in answer


async def test_cached_answer_does_not_call_the_provider_again() -> None:
    gemini = _provider("gemini", answer="una vez")
    service, _ = _service([gemini, MockProvider()])
    await _ask(service)
    assert await _ask(service) == ("una vez", "gemini")
    gemini.chat.assert_awaited_once()  # type: ignore[attr-defined]


async def test_mock_answers_are_not_cached_so_the_real_provider_is_used_when_it_recovers() -> None:
    gemini = _provider("gemini", fails=True)
    service, _ = _service([gemini, MockProvider()])
    await _ask(service)
    gemini.chat = AsyncMock(return_value="ya volvió")  # type: ignore[method-assign]
    assert await _ask(service) == ("ya volvió", "gemini")


async def test_free_action_requires_a_question() -> None:
    service, _ = _service([MockProvider()])
    with pytest.raises(BusinessRuleError):
        await _ask(service, action="free")


async def test_simplify_requires_a_selection_or_message() -> None:
    service, _ = _service([MockProvider()])
    with pytest.raises(BusinessRuleError):
        await _ask(service, action="simplify")


async def test_document_is_trimmed_before_reaching_the_provider() -> None:
    gemini = _provider("gemini", answer="ok")
    service, _ = _service([gemini, MockProvider()])
    await _ask(service, document_text="palabra " * 5_000)
    sent = gemini.chat.await_args.args[1][0].content  # type: ignore[attr-defined]
    assert len(sent) < 1_600


async def test_describe_image_falls_back_to_mock_and_passes_the_prompt() -> None:
    gemini = _provider("gemini", fails=True)
    service, _ = _service([MockProvider()], [gemini, MockProvider()])
    description, provider = await service.describe_image(image=b"\x89PNG", mime="image/png", context="")
    assert provider == "mock"
    assert "gráfico de barras" in description
    assert gemini.describe_image.await_args.kwargs["system"]  # type: ignore[attr-defined]
