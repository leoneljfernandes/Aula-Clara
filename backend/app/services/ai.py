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
from app.models import AIAnswer, AnswerLanguage, ChatAction, ChatMessage, ModelInfo
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
from app.services import ai_guardrails, ai_rules
from app.services.prompts import COLOR_GUIDE_PROMPT, IMAGE_PROMPT, STUDY_PROMPT

logger = logging.getLogger(__name__)
Sleep = Callable[[float], Awaitable[None]]
Clock = Callable[[], float]
# Solo se reintenta una falla rápida (un 503 inmediato). Con AI_TIMEOUT_SECONDS=20, el peor caso es
# 5 + 0,6 + 20 ≈ 26 s: entra en el `maxDuration` de 30 s de la función de Vercel.
RETRY_ONLY_IF_FAILED_WITHIN_SECONDS = 5.0
# Si el primer llamado ya consumió mucho tiempo, evita exceder los 30 s de Vercel con el verificador.
VERIFIER_MAX_ELAPSED_SECONDS = 12.0


class AIService:
    """Arma el contexto, aplica guardrails de entrada/salida y llama al proveedor que trajo el usuario.

    El service es único por proceso (caché compartida); el proveedor llega en cada llamada.
    """

    def __init__(
        self,
        *,
        cache: AnswerCache,
        max_input_chars: int,
        strict_verifier: bool = False,
        retry_delay: float = 0.6,
        sleep: Sleep = asyncio.sleep,
        clock: Clock = time.monotonic,
    ) -> None:
        self._cache = cache
        self._max_chars = max_input_chars
        self._strict_verifier = strict_verifier
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

    async def _run_strict_verifier(
        self,
        provider: LLMProvider,
        *,
        source_excerpt: str,
        candidate_answer: str,
        started: float,
    ) -> bool:
        """2ª pasada opcional (entailment): aprueba solo si confirma SOPORTADA (fail-closed)."""
        if self._clock() - started > VERIFIER_MAX_ELAPSED_SECONDS:
            logger.warning(
                "strict verifier skipped due to elapsed time budget", extra={"provider": provider.name}
            )
            return False
        v_nonce = ai_guardrails.generate_nonce()
        verifier_msg = ai_guardrails.build_verifier_message(source_excerpt, candidate_answer, v_nonce)
        try:
            verdict = await self._call(
                provider,
                partial(
                    provider.chat,
                    ai_guardrails.VERIFIER_SYSTEM_PROMPT,
                    [ChatMessage(role="user", content=verifier_msg)],
                ),
            )
        except AppError:
            logger.warning("strict verifier call failed (fail-closed)", extra={"provider": provider.name})
            return False
        return ai_guardrails.parse_verifier_verdict(verdict.text)

    async def chat(
        self,
        *,
        provider: LLMProvider,
        action: ChatAction,
        message: str | None,
        document_text: str,
        selection: str | None,
        language: AnswerLanguage = "standard",
    ) -> AIAnswer:
        message = (message or "").strip() or None
        selection = (selection or "").strip() or None
        if action == "free" and message is None:
            raise BusinessRuleError("A question is required for the 'free' action")
        if action == "simplify" and selection is None and message is None:
            raise BusinessRuleError("A selection is required for the 'simplify' action")

        if not document_text.strip() and not selection:
            return AIAnswer(
                text=ai_guardrails.EMPTY_DOCUMENT_ANSWER, provider=provider.name, model=provider.model
            )

        # Capa 1: pre-filtros deterministas en preguntas libres (0 tokens).
        if action == "free" and message is not None:
            if ai_guardrails.detect_prompt_injection(message):
                logger.warning("guardrail blocked prompt injection", extra={"provider": provider.name})
                return AIAnswer(
                    text=ai_guardrails.INJECTION_BLOCKED_ANSWER,
                    provider=provider.name,
                    model=provider.model,
                )
            if not ai_guardrails.is_question_in_scope(message, document_text, selection):
                logger.info("guardrail blocked off-topic question", extra={"provider": provider.name})
                return AIAnswer(
                    text=ai_guardrails.OUT_OF_SCOPE_ANSWER,
                    provider=provider.name,
                    model=provider.model,
                )

        # `scope` incluye la huella de la key: un usuario nunca recibe lo que pagó la cuota de otro.
        # La clave de caché nunca incluye el nonce por pedido, para preservar reutilización.
        key = ai_rules.cache_key(
            "chat",
            provider.scope,
            action,
            language,
            message,
            selection,
            document_text,
            "strict" if self._strict_verifier else "grounded",
        )
        if (cached := self._cache.get(key)) is not None:
            return cached

        # Capa 2: delimitadores con nonce por pedido + retrieval local + sandwich defense.
        nonce = ai_guardrails.generate_nonce()
        focus = selection or (message if action == "simplify" else None)
        query = message if action == "free" else None
        context = ai_rules.build_context(document_text, focus, self._max_chars, nonce=nonce, query=query)
        user_message = ai_rules.build_user_message(action, message, context, language, nonce=nonce)
        system_prompt = ai_guardrails.render_prompt_with_nonce(STUDY_PROMPT, nonce)

        started = self._clock()
        messages = [ChatMessage(role="user", content=user_message)]
        done = await self._call(provider, partial(provider.chat, system_prompt, messages))

        # Capas 3 y 4: verificación determinista de protocolo, citas textuales y sanitización de salida.
        source_text = f"{focus}\n{document_text}" if focus else document_text
        verified = ai_guardrails.verify_grounded_response(done.text, source_text, nonce=nonce)
        if not verified.accepted:
            logger.warning(
                "guardrail rejected response",
                extra={"provider": provider.name, "reason": verified.reason},
            )
            return AIAnswer(text=verified.text, provider=provider.name, model=provider.model, truncated=False)

        # Capa 5 (opcional): verificador LLM de 2ª pasada (entailment) si está habilitado.
        if self._strict_verifier and verified.reason == "verified":
            excerpt = ai_rules.trim_text(
                ai_guardrails.select_relevant_excerpt(document_text, query, self._max_chars),
                self._max_chars,
            )
            verifier_source = f"{focus}\n{excerpt}" if focus else excerpt
            supported = await self._run_strict_verifier(
                provider,
                source_excerpt=verifier_source,
                candidate_answer=verified.text,
                started=started,
            )
            if not supported:
                logger.warning("strict verifier rejected answer", extra={"provider": provider.name})
                return AIAnswer(
                    text=ai_guardrails.OUT_OF_SCOPE_ANSWER,
                    provider=provider.name,
                    model=provider.model,
                    truncated=False,
                )

        answer = AIAnswer(
            text=verified.text,
            provider=provider.name,
            model=provider.model,
            truncated=done.truncated if verified.reason == "verified" else False,
        )
        self._cache.set(key, answer)
        return answer

    async def describe_image(
        self,
        *,
        provider: LLMProvider,
        image: bytes,
        mime: str,
        context: str,
        color_guide: bool = False,
    ) -> AIAnswer:
        trimmed_context = ai_rules.trim_text(context.strip(), 500)
        # Con guía de color la misma imagen da otra respuesta: tiene su propia entrada de caché.
        key = ai_rules.cache_key(
            "image", provider.scope, mime, image, trimmed_context, "color" if color_guide else "plain"
        )
        if (cached := self._cache.get(key)) is not None:
            return cached

        nonce = ai_guardrails.generate_nonce()
        base_system = ai_guardrails.render_prompt_with_nonce(IMAGE_PROMPT, nonce)
        system = f"{base_system}\n\n{COLOR_GUIDE_PROMPT}" if color_guide else base_system
        safe_context = (
            ai_guardrails.wrap_block("contexto_imagen", trimmed_context, nonce) if trimmed_context else ""
        )
        done = await self._call(
            provider, partial(provider.describe_image, image, mime, safe_context, system=system)
        )
        if ai_guardrails.detect_prompt_leakage(done.text, nonce=nonce):
            logger.warning("guardrail blocked image prompt leakage", extra={"provider": provider.name})
            return AIAnswer(
                text=ai_guardrails.OUT_OF_SCOPE_ANSWER,
                provider=provider.name,
                model=provider.model,
                truncated=False,
            )
        clean_text = ai_guardrails.sanitize_output(done.text, source_text=trimmed_context, nonce=nonce)
        answer = AIAnswer(
            text=clean_text or ai_guardrails.OUT_OF_SCOPE_ANSWER,
            provider=provider.name,
            model=provider.model,
            truncated=done.truncated,
        )
        self._cache.set(key, answer)
        return answer

    async def list_models(self, provider: LLMProvider) -> list[ModelInfo]:
        models = await self._call(provider, provider.list_models)
        return sorted(models, key=lambda m: (m.free is False, m.name.lower()))


_SAFE_REASON = re.compile(r"[a-z0-9_]{1,40}")


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
