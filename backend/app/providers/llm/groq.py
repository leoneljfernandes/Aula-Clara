import logging
from collections.abc import Sequence

import httpx

from app.models import ChatAction, ChatMessage
from app.providers.llm.base import ProviderUnavailable

logger = logging.getLogger(__name__)
BASE_URL = "https://api.groq.com/openai/v1"  # API compatible con OpenAI


class GroqProvider:
    """Groq (nivel gratuito). Solo texto: la documentación no confirma modelos con visión en producción."""

    name = "groq"
    supports_images = False

    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        timeout_seconds: float,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._api_key = api_key
        self._model = model
        self._timeout = timeout_seconds
        self._transport = transport  # inyectable en tests (httpx.MockTransport)

    async def chat(self, system: str, messages: Sequence[ChatMessage], *, action: ChatAction = "free") -> str:
        payload = {
            "model": self._model,
            "temperature": 0.3,
            "max_tokens": 1024,
            "messages": [
                {"role": "system", "content": system},
                *({"role": m.role, "content": m.content} for m in messages),
            ],
        }
        try:
            async with httpx.AsyncClient(
                base_url=BASE_URL, timeout=self._timeout, transport=self._transport
            ) as client:
                response = await client.post(
                    "/chat/completions", json=payload, headers={"Authorization": f"Bearer {self._api_key}"}
                )
            response.raise_for_status()
            text = str(response.json()["choices"][0]["message"]["content"] or "").strip()
        except httpx.HTTPStatusError as exc:
            logger.warning("groq request failed", extra={"status": exc.response.status_code})
            raise ProviderUnavailable(f"groq http {exc.response.status_code}") from exc
        except (httpx.HTTPError, KeyError, IndexError, ValueError) as exc:
            logger.warning("groq transport/shape error", extra={"error_type": type(exc).__name__})
            raise ProviderUnavailable("groq unreachable or malformed response") from exc
        if not text:
            raise ProviderUnavailable("groq returned no text")
        return text

    async def describe_image(self, image: bytes, mime: str, context: str, *, system: str = "") -> str:
        raise ProviderUnavailable("groq provider does not support images")
