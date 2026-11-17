import asyncio
import logging
from collections.abc import Awaitable, Callable, Sequence
from functools import partial

from app.crud.answer_cache import AnswerCache
from app.errors import BusinessRuleError
from app.models import ChatAction, ChatMessage
from app.providers.llm.base import LLMProvider, ProviderUnavailable
from app.services import ai_rules
from app.services.prompts import IMAGE_PROMPT, STUDY_PROMPT

logger = logging.getLogger(__name__)
Sleep = Callable[[float], Awaitable[None]]


class AIService:
    """Arma el contexto, elige el prompt y recorre la cadena de proveedores (principal → respaldo → mock)."""

    def __init__(
        self,
        *,
        chat_chain: Sequence[LLMProvider],
        image_chain: Sequence[LLMProvider],
        cache: AnswerCache,
        max_input_chars: int,
        retry_delay: float = 0.6,
        sleep: Sleep = asyncio.sleep,
    ) -> None:
        self._chat_chain = chat_chain
        self._image_chain = image_chain
        self._cache = cache
        self._max_chars = max_input_chars
        self._retry_delay = retry_delay
        self._sleep = sleep

    async def _with_retry[T](self, provider: LLMProvider, call: Callable[[], Awaitable[T]]) -> T:
        """Un reintento con backoff; el mock nunca falla, no hace falta reintentarlo."""
        try:
            return await call()
        except ProviderUnavailable:
            if provider.name == "mock":
                raise
            await self._sleep(self._retry_delay)
            return await call()

    async def chat(
        self, *, action: ChatAction, message: str | None, document_text: str, selection: str | None
    ) -> tuple[str, str]:
        message = (message or "").strip() or None
        selection = (selection or "").strip() or None
        if action == "free" and message is None:
            raise BusinessRuleError("A question is required for the 'free' action")
        if action == "simplify" and selection is None and message is None:
            raise BusinessRuleError("A selection is required for the 'simplify' action")

        focus = selection or (message if action == "simplify" else None)
        context = ai_rules.build_context(document_text, focus, self._max_chars)
        user_message = ai_rules.build_user_message(action, message, context)
        key = ai_rules.cache_key("chat", action, message, selection, document_text[: self._max_chars])
        if (cached := self._cache.get(key)) is not None:
            return cached

        messages = [ChatMessage(role="user", content=user_message)]
        for provider in self._chat_chain:
            try:
                answer = await self._with_retry(
                    provider, partial(provider.chat, STUDY_PROMPT, messages, action=action)
                )
            except ProviderUnavailable:
                logger.warning("provider failed, trying next", extra={"provider": provider.name})
                continue
            if provider.name != "mock":  # lo simulado no se cachea: cuando el proveedor vuelva, se usa
                self._cache.set(key, (answer, provider.name))
            return answer, provider.name
        raise RuntimeError("chat chain must end with a provider that cannot fail")  # pragma: no cover

    async def describe_image(self, *, image: bytes, mime: str, context: str) -> tuple[str, str]:
        context = ai_rules.trim_text(context.strip(), 500)
        key = ai_rules.cache_key("image", mime, image, context)
        if (cached := self._cache.get(key)) is not None:
            return cached
        for provider in self._image_chain:
            try:
                description = await self._with_retry(
                    provider, partial(provider.describe_image, image, mime, context, system=IMAGE_PROMPT)
                )
            except ProviderUnavailable:
                logger.warning("provider failed, trying next", extra={"provider": provider.name})
                continue
            if provider.name != "mock":
                self._cache.set(key, (description, provider.name))
            return description, provider.name
        raise RuntimeError("image chain must end with a provider that cannot fail")  # pragma: no cover
