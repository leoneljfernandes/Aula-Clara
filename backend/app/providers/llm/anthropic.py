"""Claude (Anthropic), por su API Messages. No es compatible con OpenAI: tiene su propia forma de autenticar
(`x-api-key`), de mandar el prompt de sistema y las imágenes, y de informar por qué terminó una respuesta.

Igual que el resto, la URL base es fija (la persona elige un proveedor, nunca una URL) y la key es de cada
persona: se crea un proveedor por pedido y la key no se guarda ni se loguea.
"""

import base64
import logging
from collections.abc import Mapping, Sequence
from typing import Any

import httpx

from app.models import ChatMessage, Completion, ModelInfo
from app.providers.llm.base import (
    ProviderContentBlocked,
    ProviderEmptyResponse,
    ProviderError,
    ProviderTimeout,
    ProviderUnavailable,
    credential_scope,
)
from app.providers.llm.http_errors import Operation, classify, parse_error_body, parse_retry_after

logger = logging.getLogger(__name__)

_BASE_URL = "https://api.anthropic.com/v1"
_VERSION = "2023-06-01"
_MAX_TOKENS = 2048
_MODELS_PAGE = 1000


def _body_of(response: httpx.Response) -> Any:
    try:
        return response.json()
    except ValueError:
        return response.text[:500]


class AnthropicProvider:
    """Claude por la API Messages. Todos los modelos vigentes leen texto e imágenes."""

    name = "anthropic"
    verifies_key = True  # GET /models exige una key válida

    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        timeout_seconds: float,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self.model = model
        self.scope = credential_scope(self.name, model, api_key)
        self._api_key = api_key
        self._timeout = timeout_seconds
        self._transport = transport  # inyectable en tests (httpx.MockTransport)

    async def _request(
        self,
        method: str,
        path: str,
        payload: Mapping[str, Any] | None = None,
        operation: Operation = "chat",
    ) -> Any:
        headers = {"x-api-key": self._api_key, "anthropic-version": _VERSION}
        try:
            async with httpx.AsyncClient(
                base_url=_BASE_URL, timeout=self._timeout, transport=self._transport
            ) as client:
                response = await client.request(method, path, json=payload, headers=headers)
        except httpx.HTTPError as exc:
            logger.warning(
                "provider transport error", extra={"provider": self.name, "error_type": type(exc).__name__}
            )
            if isinstance(exc, httpx.TimeoutException):
                raise ProviderTimeout("anthropic timed out", reason="timeout") from exc
            raise ProviderUnavailable("anthropic unreachable", reason="unreachable") from exc
        if response.is_error:
            logger.warning(
                "provider request failed", extra={"provider": self.name, "status": response.status_code}
            )
            raise self._error_from(response.status_code, _body_of(response), response.headers, operation)
        try:
            return response.json()
        except ValueError as exc:
            raise ProviderUnavailable("anthropic returned malformed json", reason="malformed") from exc

    def _error_from(
        self, status: int, body: Any, headers: Mapping[str, str], operation: Operation
    ) -> ProviderError:
        message, code = parse_error_body(body)
        return classify(
            self.name,
            status,
            message=message,
            code=code,
            retry_after=parse_retry_after(headers.get("retry-after")),
            api_key=self._api_key,
            operation=operation,
        )

    async def _complete(
        self, system: str, messages: list[dict[str, Any]], operation: Operation
    ) -> Completion:
        # Sin `temperature`: los modelos nuevos fijan la suya y rechazan un valor distinto.
        payload = {"model": self.model, "max_tokens": _MAX_TOKENS, "system": system, "messages": messages}
        body = await self._request("POST", "/messages", payload, operation)
        try:
            blocks = body["content"]
            stop = str(body.get("stop_reason") or "")
            text = "".join(
                str(block.get("text") or "")
                for block in blocks
                if isinstance(block, Mapping) and block.get("type") == "text"
            ).strip()
        except (KeyError, TypeError, AttributeError) as exc:
            raise ProviderUnavailable("anthropic malformed response", reason="malformed") from exc
        if text:
            return Completion(text, truncated=stop == "max_tokens")
        if stop == "refusal":
            raise ProviderContentBlocked("anthropic refused the request", reason="refusal")
        if stop == "max_tokens":
            raise ProviderEmptyResponse("anthropic used the whole output limit", reason="length")
        raise ProviderEmptyResponse("anthropic returned no text", reason=stop or "empty")

    async def chat(self, system: str, messages: Sequence[ChatMessage]) -> Completion:
        return await self._complete(
            system, [{"role": m.role, "content": m.content} for m in messages], "chat"
        )

    async def describe_image(self, image: bytes, mime: str, context: str, *, system: str = "") -> Completion:
        text = "Describí esta imagen." + (f" Contexto del documento: {context}" if context else "")
        content = [
            {
                "type": "image",
                "source": {"type": "base64", "media_type": mime, "data": base64.b64encode(image).decode()},
            },
            {"type": "text", "text": text},
        ]
        return await self._complete(system, [{"role": "user", "content": content}], "image")

    async def list_models(self) -> list[ModelInfo]:
        body = await self._request("GET", f"/models?limit={_MODELS_PAGE}", operation="models")
        items = body.get("data") if isinstance(body, Mapping) else None
        if not isinstance(items, list):
            raise ProviderUnavailable("anthropic malformed model list", reason="malformed")
        return [
            ModelInfo(
                id=item["id"],
                name=str(item.get("display_name") or item["id"]),
                supports_images=True,
                free=None,
            )
            for item in items
            if isinstance(item, Mapping) and isinstance(item.get("id"), str)
        ]

    async def aclose(self) -> None:
        """Nada que cerrar: cada pedido abre y cierra su propio `httpx.AsyncClient`."""
