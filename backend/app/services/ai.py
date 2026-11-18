import asyncio
import logging
import math
import re
import time
from collections.abc import Awaitable, Callable
from functools import partial

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
from app.models import AIAnswer, ChatAction, ChatMessage, Completion, ModelInfo
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
from app.services import ai_rules
from app.services.prompts import IMAGE_PROMPT, STUDY_PROMPT

logger = logging.getLogger(__name__)
Sleep = Callable[[float], Awaitable[None]]
Clock = Callable[[], float]
# Solo se reintenta una falla rápida (un 503 inmediato). Con AI_TIMEOUT_SECONDS=20, el peor caso es
# 5 + 0,6 + 20 ≈ 26 s: entra en el `maxDuration` de 30 s de la función de Vercel.
RETRY_ONLY_IF_FAILED_WITHIN_SECONDS = 5.0


class AIService:
    """Arma el contexto, elige el prompt y llama al proveedor que trajo el usuario (con su key).

    El service es único por proceso (caché compartida); el proveedor llega en cada llamada.
    """

    def __init__(
        self,
        *,
        cache: AnswerCache,
        max_input_chars: int,
        retry_delay: float = 0.6,
        sleep: Sleep = asyncio.sleep,
        clock: Clock = time.monotonic,
    ) -> None:
        self._cache = cache
        self._max_chars = max_input_chars
        self._retry_delay = retry_delay
        self._sleep = sleep
        self._clock = clock

    async def _call[T](self, provider: LLMProvider, call: Callable[[], Awaitable[T]]) -> T:
        """Un reintento con backoff ante una falla transitoria y rápida; el resto se traduce a errores de
        dominio. Un timeout no se reintenta (ver RETRY_ONLY_IF_FAILED_WITHIN_SECONDS)."""
        started = self._clock()
        try:
            try:
                return await call()
            except ProviderTimeout:
                raise
            except ProviderUnavailable:
                if self._clock() - started > RETRY_ONLY_IF_FAILED_WITHIN_SECONDS:
                    raise
                await self._sleep(self._retry_delay)
                return await call()
        except ProviderError as exc:
            raise _domain_error(provider, exc) from exc

    async def chat(
        self,
        *,
        provider: LLMProvider,
        action: ChatAction,
        message: str | None,
        document_text: str,
        selection: str | None,
    ) -> AIAnswer:
        message = (message or "").strip() or None
        selection = (selection or "").strip() or None
        if action == "free" and message is None:
            raise BusinessRuleError("A question is required for the 'free' action")
        if action == "simplify" and selection is None and message is None:
            raise BusinessRuleError("A selection is required for the 'simplify' action")

        focus = selection or (message if action == "simplify" else None)
        context = ai_rules.build_context(document_text, focus, self._max_chars)
        user_message = ai_rules.build_user_message(action, message, context)
        # `scope` incluye la huella de la key: un usuario nunca recibe lo que pagó la cuota de otro.
        key = ai_rules.cache_key(
            "chat", provider.scope, action, message, selection, document_text[: self._max_chars]
        )
        if (cached := self._cache.get(key)) is not None:
            return cached

        messages = [ChatMessage(role="user", content=user_message)]
        done = await self._call(provider, partial(provider.chat, STUDY_PROMPT, messages))
        answer = _answer(provider, done)
        self._cache.set(key, answer)
        return answer

    async def describe_image(
        self, *, provider: LLMProvider, image: bytes, mime: str, context: str
    ) -> AIAnswer:
        context = ai_rules.trim_text(context.strip(), 500)
        key = ai_rules.cache_key("image", provider.scope, mime, image, context)
        if (cached := self._cache.get(key)) is not None:
            return cached
        done = await self._call(
            provider, partial(provider.describe_image, image, mime, context, system=IMAGE_PROMPT)
        )
        answer = _answer(provider, done)
        self._cache.set(key, answer)
        return answer

    async def list_models(self, provider: LLMProvider) -> list[ModelInfo]:
        models = await self._call(provider, provider.list_models)
        return sorted(models, key=lambda m: (m.free is False, m.name.lower()))


_SAFE_REASON = re.compile(r"[a-z0-9_]{1,40}")


def _answer(provider: LLMProvider, done: Completion) -> AIAnswer:
    return AIAnswer(text=done.text, provider=provider.name, model=provider.model, truncated=done.truncated)


def _domain_error(provider: LLMProvider, exc: ProviderError) -> AppError:
    """Traduce un error del proveedor al error de dominio que la interfaz sabe explicar.

    El orden importa: de lo más específico a lo más general (las subclases de `ProviderRejected` primero).
    """
    extra: dict[str, object] = {"provider": provider.name, "model": provider.model}
    if exc.reason and _SAFE_REASON.fullmatch(exc.reason):  # viene del proveedor: solo palabras simples
        extra["reason"] = exc.reason
    headers: dict[str, str] = {}
    if exc.retry_after is not None:
        seconds = max(1, math.ceil(exc.retry_after))
        extra["retry_after_seconds"] = seconds
        headers["Retry-After"] = str(seconds)
    if exc.provider_message and not isinstance(exc, ProviderAuthError):
        extra["provider_message"] = exc.provider_message  # ya limpio de la key y acotado
    name = provider.name
    # Texto fijo: nunca se repite en la respuesta lo que dijo la excepción (podría traer datos ajenos).
    detail = f"{name} ({provider.model or 'no model'}): {type(exc).__name__}"

    mapping: list[tuple[type[ProviderError], type[AppError]]] = [
        (ProviderAuthError, AIKeyInvalidError),
        (ProviderQuotaError, AIQuotaExceededError),
        (ProviderPayloadTooLarge, AIInputTooLargeError),
        (ProviderContentBlocked, AIContentBlockedError),
        (ProviderEmptyResponse, AIEmptyResponseError),
        (ProviderPermissionDenied, AIPermissionDeniedError),
        (ProviderModelNotFound, AIModelNotFoundError),
        (ProviderImageRejected, AIImageRejectedError),
        (ProviderRejected, AIModelRejectedError),
        (ProviderUnavailable, AIUnavailableError),
    ]
    for provider_error, domain_error in mapping:
        if isinstance(exc, provider_error):
            if domain_error is AIUnavailableError:
                logger.warning("provider unavailable", extra={"provider": name, "reason": exc.reason})
            return domain_error(detail, extra=extra, headers=headers)
    return AIUnavailableError(detail, extra=extra, headers=headers)  # error nuevo sin traducir
