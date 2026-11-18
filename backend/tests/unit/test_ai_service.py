from unittest.mock import AsyncMock, create_autospec

import pytest

from app.crud.answer_cache import AnswerCache
from app.errors import (
    AIContentBlockedError,
    AIEmptyResponseError,
    AIImageRejectedError,
    AIInputTooLargeError,
    AIKeyInvalidError,
    AIModelNotFoundError,
    AIModelRejectedError,
    AIPermissionDeniedError,
    AIQuotaExceededError,
    AIUnavailableError,
    AppError,
    BusinessRuleError,
)
from app.models import AIAnswer, Completion, ModelInfo
from app.providers.llm.base import (
    LLMProvider,
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
from app.services.ai import AIService


def _provider(
    *, answer: str = "respuesta", failure: Exception | None = None, scope: str = "usuario-a"
) -> LLMProvider:
    provider = create_autospec(LLMProvider, instance=True)
    provider.name = "gemini"
    provider.model = "modelo-x"
    provider.scope = scope
    done = Completion(answer)
    provider.chat = AsyncMock(side_effect=failure) if failure else AsyncMock(return_value=done)
    provider.describe_image = AsyncMock(side_effect=failure) if failure else AsyncMock(return_value=done)
    provider.list_models = AsyncMock(return_value=[])
    return provider  # type: ignore[no-any-return]


class FakeClock:
    """Reloj controlable: cada llamada avanza `step` segundos."""

    def __init__(self, step: float = 0.0) -> None:
        self.now, self.step = 0.0, step

    def __call__(self) -> float:
        self.now += self.step
        return self.now


def _service(clock: FakeClock | None = None) -> tuple[AIService, AsyncMock]:
    sleep = AsyncMock()
    service = AIService(
        cache=AnswerCache(ttl_seconds=60),
        max_input_chars=1_000,
        retry_delay=0.0,
        sleep=sleep,
        clock=clock or FakeClock(),
    )
    return service, sleep


async def _ask(service: AIService, provider: LLMProvider, **kw: str | None) -> AIAnswer:
    args = {"action": "summarize", "message": None, "document_text": "texto", "selection": None, **kw}
    return await service.chat(provider=provider, **args)  # type: ignore[arg-type]


async def test_answer_carries_provider_and_model() -> None:
    service, _ = _service()
    assert await _ask(service, _provider(answer="hola")) == AIAnswer("hola", "gemini", "modelo-x")


async def test_transient_failure_is_retried_once_then_reported_as_unavailable() -> None:
    service, sleep = _service()
    provider = _provider(failure=ProviderUnavailable("503"))
    with pytest.raises(AIUnavailableError):
        await _ask(service, provider)
    assert provider.chat.await_count == 2  # type: ignore[attr-defined]  # intento + 1 reintento
    sleep.assert_awaited_once()


async def test_a_timeout_is_not_retried_so_the_function_stays_within_its_time_limit() -> None:
    service, sleep = _service()
    provider = _provider(failure=ProviderTimeout("lento"))
    with pytest.raises(AIUnavailableError):
        await _ask(service, provider)
    provider.chat.assert_awaited_once()  # type: ignore[attr-defined]
    sleep.assert_not_awaited()


async def test_a_slow_transient_failure_is_not_retried() -> None:
    service, sleep = _service(FakeClock(step=10.0))  # el primer intento tardó 10 s en fallar
    provider = _provider(failure=ProviderUnavailable("503"))
    with pytest.raises(AIUnavailableError):
        await _ask(service, provider)
    provider.chat.assert_awaited_once()  # type: ignore[attr-defined]
    sleep.assert_not_awaited()


@pytest.mark.parametrize(
    ("failure", "error"),
    [
        (ProviderPayloadTooLarge("413"), AIInputTooLargeError),
        (ProviderAuthError("401"), AIKeyInvalidError),
        (ProviderQuotaError("429", reason="rate"), AIQuotaExceededError),
        (ProviderContentBlocked("safety"), AIContentBlockedError),
        (ProviderEmptyResponse("vacío", reason="length"), AIEmptyResponseError),
        (ProviderPermissionDenied("403", reason="region"), AIPermissionDeniedError),
        (ProviderModelNotFound("404"), AIModelNotFoundError),
        (ProviderImageRejected("400"), AIImageRejectedError),
        (ProviderRejected("400"), AIModelRejectedError),
    ],
)
async def test_errors_of_the_person_are_not_retried_and_are_translated(
    failure: ProviderError, error: type[Exception]
) -> None:
    service, sleep = _service()
    provider = _provider(failure=failure)
    with pytest.raises(error):
        await _ask(service, provider)
    provider.chat.assert_awaited_once()  # type: ignore[attr-defined]
    sleep.assert_not_awaited()


async def test_the_domain_error_carries_what_the_person_needs_to_fix_it() -> None:
    service, _ = _service()
    failure = ProviderQuotaError(
        "429", status=429, reason="daily", retry_after=34.2, provider_message="Rate limit reached (TPD)"
    )
    with pytest.raises(AIQuotaExceededError) as caught:
        await _ask(service, _provider(failure=failure))
    error: AppError = caught.value
    assert error.extra == {
        "provider": "gemini",
        "model": "modelo-x",
        "reason": "daily",
        "retry_after_seconds": 35,  # se redondea hacia arriba: esperar de menos vuelve a fallar
        "provider_message": "Rate limit reached (TPD)",
    }
    assert error.headers == {"Retry-After": "35"}


async def test_a_rejected_key_never_carries_the_provider_message() -> None:
    service, _ = _service()
    failure = ProviderAuthError("401", provider_message="Incorrect API key: sk-secret")
    with pytest.raises(AIKeyInvalidError) as caught:
        await _ask(service, _provider(failure=failure))
    assert "provider_message" not in caught.value.extra


async def test_unavailable_keeps_the_reason_for_the_message() -> None:
    service, _ = _service()
    with pytest.raises(AIUnavailableError) as caught:
        await _ask(service, _provider(failure=ProviderTimeout("lento", reason="timeout")))
    assert caught.value.extra["reason"] == "timeout"


async def test_an_error_type_nobody_translated_is_reported_as_unavailable_not_as_a_500() -> None:
    class NewKindOfError(ProviderError):
        pass

    service, _ = _service()
    with pytest.raises(AIUnavailableError):
        await _ask(service, _provider(failure=NewKindOfError("¿?")))


async def test_a_truncated_answer_is_flagged_and_cached_as_truncated() -> None:
    service, _ = _service()
    provider = _provider()
    provider.chat = AsyncMock(return_value=Completion("se cortó a la mit", truncated=True))  # type: ignore[method-assign]
    first = await _ask(service, provider)
    again = await _ask(service, provider)
    assert first.truncated and again.truncated
    provider.chat.assert_awaited_once()


async def test_cached_answer_does_not_call_the_provider_again() -> None:
    service, _ = _service()
    provider = _provider(answer="una vez")
    await _ask(service, provider)
    assert (await _ask(service, provider)).text == "una vez"
    provider.chat.assert_awaited_once()  # type: ignore[attr-defined]


async def test_cache_is_separated_by_user_key() -> None:
    service, _ = _service()
    await _ask(service, _provider(answer="de Ana", scope="ana"))
    beto = _provider(answer="de Beto", scope="beto")
    assert (await _ask(service, beto)).text == "de Beto"
    beto.chat.assert_awaited_once()  # type: ignore[attr-defined]


async def test_failures_are_not_cached() -> None:
    service, _ = _service()
    provider = _provider(failure=ProviderQuotaError("429"))
    with pytest.raises(AIQuotaExceededError):
        await _ask(service, provider)
    provider.chat = AsyncMock(return_value=Completion("ya volvió"))  # type: ignore[method-assign]
    assert (await _ask(service, provider)).text == "ya volvió"


async def test_free_action_requires_a_question() -> None:
    service, _ = _service()
    with pytest.raises(BusinessRuleError):
        await _ask(service, _provider(), action="free")


async def test_simplify_requires_a_selection_or_message() -> None:
    service, _ = _service()
    with pytest.raises(BusinessRuleError):
        await _ask(service, _provider(), action="simplify")


async def test_document_is_trimmed_before_reaching_the_provider() -> None:
    service, _ = _service()
    provider = _provider()
    await _ask(service, provider, document_text="palabra " * 5_000)
    sent = provider.chat.await_args.args[1][0].content  # type: ignore[attr-defined]
    assert len(sent) < 1_600


async def test_describe_image_passes_the_prompt_to_the_provider() -> None:
    service, _ = _service()
    provider = _provider(answer="un gráfico de barras")
    answer = await service.describe_image(provider=provider, image=b"\x89PNG", mime="image/png", context="")
    assert answer == AIAnswer("un gráfico de barras", "gemini", "modelo-x")
    assert provider.describe_image.await_args.kwargs["system"]  # type: ignore[attr-defined]


async def test_describe_image_with_a_text_only_model_is_model_rejected() -> None:
    service, _ = _service()
    with pytest.raises(AIModelRejectedError):
        await service.describe_image(
            provider=_provider(failure=ProviderRejected("400")), image=b"x", mime="image/png", context=""
        )


async def test_list_models_puts_paid_models_last_and_sorts_by_name() -> None:
    service, _ = _service()
    provider = _provider()
    provider.list_models = AsyncMock(  # type: ignore[method-assign]
        return_value=[
            ModelInfo("p", "Pago", None, False),
            ModelInfo("b", "beta", None, True),
            ModelInfo("a", "Alfa", None, None),
        ]
    )
    assert [m.id for m in await service.list_models(provider)] == ["a", "b", "p"]


async def test_list_models_with_invalid_key_is_key_invalid() -> None:
    service, _ = _service()
    provider = _provider()
    provider.list_models = AsyncMock(side_effect=ProviderAuthError("401"))  # type: ignore[method-assign]
    with pytest.raises(AIKeyInvalidError):
        await service.list_models(provider)


async def test_the_reason_is_only_forwarded_when_it_is_a_simple_word() -> None:
    service, _ = _service()
    for reason, expected in (("content_filter", "content_filter"), ("<script>alert(1)</script>", None)):
        with pytest.raises(AIContentBlockedError) as caught:
            await _ask(service, _provider(failure=ProviderContentBlocked("x", reason=reason)))
        assert caught.value.extra.get("reason") == expected


async def test_the_exception_text_is_never_repeated_in_the_error_detail() -> None:
    service, _ = _service()
    with pytest.raises(AIUnavailableError) as caught:
        await _ask(service, _provider(failure=ProviderUnavailable("texto interno con datos")))
    assert "texto interno" not in caught.value.detail


async def test_language_is_part_of_the_cache_key() -> None:
    service, _ = _service()
    provider = _provider(answer="respuesta")
    await service.chat(provider=provider, action="summarize", message=None, document_text="t", selection=None)
    await service.chat(
        provider=provider,
        action="summarize",
        message=None,
        document_text="t",
        selection=None,
        language="plain",
    )
    assert provider.chat.await_count == 2  # type: ignore[attr-defined]


async def test_glossary_does_not_require_a_selection() -> None:
    service, _ = _service()
    assert (await _ask(service, _provider(), action="glossary")).text == "respuesta"
