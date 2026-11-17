import logging
from collections.abc import Sequence

import httpx
from google import genai
from google.genai import errors, types

from app.models import ChatAction, ChatMessage
from app.providers.llm.base import ProviderUnavailable

logger = logging.getLogger(__name__)
_MAX_OUTPUT_TOKENS = 1024


class GeminiProvider:
    """Gemini API (nivel gratuito). Texto e imágenes con el mismo modelo multimodal."""

    name = "gemini"
    supports_images = True

    def __init__(self, *, api_key: str, model: str, timeout_seconds: float) -> None:
        self._model = model
        # HttpOptions.timeout va en milisegundos.
        self._client = genai.Client(
            api_key=api_key, http_options=types.HttpOptions(timeout=int(timeout_seconds * 1000))
        )

    async def _generate(self, contents: list[types.Content], system: str) -> str:
        config = types.GenerateContentConfig(
            system_instruction=system, temperature=0.3, max_output_tokens=_MAX_OUTPUT_TOKENS
        )
        try:
            response = await self._client.aio.models.generate_content(
                model=self._model, contents=contents, config=config
            )
        except errors.APIError as exc:
            # 429 (cuota) y 5xx son esperables en el free tier; el resto (key inválida) se loguea igual.
            logger.warning("gemini request failed", extra={"status": exc.code})
            raise ProviderUnavailable(f"gemini api error {exc.code}") from exc
        except (TimeoutError, httpx.HTTPError) as exc:
            logger.warning("gemini transport error", extra={"error_type": type(exc).__name__})
            raise ProviderUnavailable("gemini unreachable") from exc
        text = (response.text or "").strip()
        if not text:  # respuesta bloqueada o vacía
            raise ProviderUnavailable("gemini returned no text")
        return text

    async def chat(self, system: str, messages: Sequence[ChatMessage], *, action: ChatAction = "free") -> str:
        contents = [
            types.Content(role="user" if m.role == "user" else "model", parts=[types.Part(text=m.content)])
            for m in messages
        ]
        return await self._generate(contents, system)

    async def describe_image(self, image: bytes, mime: str, context: str, *, system: str = "") -> str:
        text = "Describí esta imagen." + (f" Contexto del documento: {context}" if context else "")
        contents = [
            types.Content(
                role="user", parts=[types.Part.from_bytes(data=image, mime_type=mime), types.Part(text=text)]
            )
        ]
        return await self._generate(contents, system)
