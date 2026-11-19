import enum
import json
import logging
from collections.abc import Sequence
from typing import Any

import httpx
from google import genai
from google.genai import errors, types

from app.models import ChatMessage, Completion, ModelInfo
from app.providers.llm.base import (
    ProviderContentBlocked,
    ProviderEmptyResponse,
    ProviderError,
    ProviderTimeout,
    ProviderUnavailable,
    credential_scope,
)
from app.providers.llm.http_errors import Operation, classify, parse_retry_after

logger = logging.getLogger(__name__)
_MAX_OUTPUT_TOKENS = 2048
# Modelos que generan contenido pero no sirven para un asistente de texto (imágenes, audio, agentes).
_NOT_FOR_CHAT = ("image", "banana", "tts", "audio", "embedding", "imagen", "veo", "antigravity", "research")
# Motivos de fin que significan «el filtro de seguridad bloqueó la respuesta».
_BLOCKED_FINISH = frozenset(
    {"SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII", "IMAGE_SAFETY"}
)


def _enum_name(value: object) -> str:
    return value.name.upper() if isinstance(value, enum.Enum) else ""


def _retry_after(details: Any) -> tuple[float | None, str]:
    """(segundos de espera, texto de cuota) del cuerpo de error de Gemini (`RetryInfo` y `QuotaFailure`)."""
    inner = details.get("error") if isinstance(details, dict) else None
    items = inner.get("details") if isinstance(inner, dict) else None
    retry: float | None = None
    for item in items if isinstance(items, list) else []:
        if isinstance(item, dict) and isinstance(item.get("retryDelay"), str):
            retry = parse_retry_after(item["retryDelay"])
    quota_text = json.dumps(items, default=str) if isinstance(items, list) else ""
    return retry, quota_text  # el texto trae ids como «…PerDayPerProject…»: decide «por día»


def map_api_error(exc: errors.APIError, api_key: str, operation: Operation) -> ProviderError:
    retry, quota_text = _retry_after(exc.details)
    return classify(
        "gemini",
        exc.code,
        message=exc.message,
        code=exc.status,
        retry_after=retry,
        api_key=api_key,
        operation=operation,
        hint=quota_text,
    )


def _map_transport_error(exc: Exception) -> ProviderError:
    if isinstance(exc, (TimeoutError, httpx.TimeoutException)):
        return ProviderTimeout("gemini timed out", reason="timeout")
    return ProviderUnavailable("gemini unreachable", reason="unreachable")


def _completion(response: types.GenerateContentResponse) -> Completion:
    """Texto de la respuesta, o el error que explica por qué no hay."""
    text = (response.text or "").strip()
    candidates = response.candidates or []
    finish = _enum_name(candidates[0].finish_reason) if candidates else ""
    if text:
        return Completion(text, truncated=finish == "MAX_TOKENS")
    feedback = response.prompt_feedback
    block = _enum_name(feedback.block_reason) if feedback else ""
    if block and block != "BLOCKED_REASON_UNSPECIFIED":
        raise ProviderContentBlocked("gemini blocked the prompt", reason=block.lower())
    if finish in _BLOCKED_FINISH:
        raise ProviderContentBlocked("gemini blocked the response", reason=finish.lower())
    if finish == "MAX_TOKENS":
        raise ProviderEmptyResponse("gemini used the whole output limit", reason="length")
    raise ProviderEmptyResponse("gemini returned no text", reason=finish.lower() or "empty")


class GeminiProvider:
    """Gemini API (nivel gratuito). Texto e imágenes con el mismo modelo multimodal."""

    name = "gemini"
    verifies_key = True  # models.list exige una key válida

    def __init__(self, *, api_key: str, model: str, timeout_seconds: float) -> None:
        self.model = model
        self.scope = credential_scope(self.name, model, api_key)
        self._api_key = api_key  # solo para limpiarla de los mensajes de error
        # HttpOptions.timeout va en milisegundos.
        self._client = genai.Client(
            api_key=api_key, http_options=types.HttpOptions(timeout=int(timeout_seconds * 1000))
        )

    async def _generate(self, contents: list[types.Content], system: str, operation: Operation) -> Completion:
        config = types.GenerateContentConfig(
            system_instruction=system, temperature=0.0, max_output_tokens=_MAX_OUTPUT_TOKENS
        )
        try:
            response = await self._client.aio.models.generate_content(
                model=self.model, contents=contents, config=config
            )
        except errors.APIError as exc:
            logger.warning("gemini request failed", extra={"status": exc.code})
            raise map_api_error(exc, self._api_key, operation) from exc
        except (TimeoutError, httpx.HTTPError) as exc:
            logger.warning("gemini transport error", extra={"error_type": type(exc).__name__})
            raise _map_transport_error(exc) from exc
        return _completion(response)

    async def chat(self, system: str, messages: Sequence[ChatMessage]) -> Completion:
        contents = [
            types.Content(role="user" if m.role == "user" else "model", parts=[types.Part(text=m.content)])
            for m in messages
        ]
        return await self._generate(contents, system, "chat")

    async def describe_image(self, image: bytes, mime: str, context: str, *, system: str = "") -> Completion:
        text = "Describí esta imagen." + (f" Contexto del documento: {context}" if context else "")
        contents = [
            types.Content(
                role="user", parts=[types.Part.from_bytes(data=image, mime_type=mime), types.Part(text=text)]
            )
        ]
        return await self._generate(contents, system, "image")

    async def list_models(self) -> list[ModelInfo]:
        try:
            pager = await self._client.aio.models.list(config={"page_size": 100})
            found = [m async for m in pager]
        except errors.APIError as exc:
            logger.warning("gemini list models failed", extra={"status": exc.code})
            raise map_api_error(exc, self._api_key, "models") from exc
        except (TimeoutError, httpx.HTTPError) as exc:
            raise _map_transport_error(exc) from exc
        models: list[ModelInfo] = []
        for m in found:
            model_id = (m.name or "").removeprefix("models/")
            if not model_id or "generateContent" not in (m.supported_actions or []):
                continue
            if any(word in model_id for word in _NOT_FOR_CHAT):
                continue
            # Los modelos Gemini son multimodales; de los demás (Gemma) no hay dato fiable.
            images = True if model_id.startswith("gemini") else None
            models.append(
                ModelInfo(id=model_id, name=m.display_name or model_id, supports_images=images, free=None)
            )
        return models

    async def aclose(self) -> None:
        # Cada pedido crea su cliente (la key es de cada persona): sin esto quedan sockets abiertos.
        await self._client.aio.aclose()
        self._client.close()
