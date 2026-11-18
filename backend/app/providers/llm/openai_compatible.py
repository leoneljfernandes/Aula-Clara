"""Proveedores con API compatible con OpenAI (Groq, OpenRouter, Mistral, NVIDIA Build).

Las URL base son una lista cerrada: el usuario elige un proveedor, nunca una URL (evita SSRF).
Cada proveedor difiere en detalles (cómo se valida la key, cómo informa capacidades, formato de imagen):
eso vive en `SPECS`, no en ramas `if name == ...` repartidas por el código.
"""

import asyncio
import base64
import logging
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any, Literal

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
from app.providers.llm.http_errors import (
    Operation,
    classify,
    parse_error_body,
    parse_retry_after,
)

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class ProviderSpec:
    base_url: str
    # Cómo se comprueba la key: "models" = el listado exige key; "endpoint" = el listado es público y hay
    # un endpoint aparte que la valida; "none" = no hay forma sin gastar una consulta.
    key_check: Literal["models", "endpoint", "none"]
    key_check_path: str = ""
    reports_free: bool = False  # solo OpenRouter publica precios que distinguen modelos gratuitos
    image_url_as_string: bool = False  # Mistral documenta `image_url` como texto, no como objeto


SPECS: Mapping[str, ProviderSpec] = {
    "groq": ProviderSpec("https://api.groq.com/openai/v1", key_check="models"),
    "openrouter": ProviderSpec(
        "https://openrouter.ai/api/v1", key_check="endpoint", key_check_path="/key", reports_free=True
    ),
    "mistral": ProviderSpec("https://api.mistral.ai/v1", key_check="models", image_url_as_string=True),
    "nvidia": ProviderSpec("https://integrate.api.nvidia.com/v1", key_check="none"),
}
# Modelos que no conversan: embeddings, moderación, rerankers, detectores, OCR, CLIP, código base.
_NOT_FOR_CHAT = (
    "embed",
    "guard",
    "safety",
    "moderation",
    "rerank",
    "retriever",
    "reward",
    "detector",
    "clip",
    "ocr",
    "calibration",
    "starcoder",
)
# NVIDIA no informa modalidades: estos nombres indican modelos que leen imágenes.
_VISION_HINTS = ("-vl", "vlm", "vision", "omni")
_MAX_TOKENS = 2048


def _body_of(response: httpx.Response) -> Any:
    try:
        return response.json()
    except ValueError:
        return response.text[:500]


def _modalities(item: Mapping[str, Any], key: str) -> list[str] | None:
    """Groq las informa en el modelo; OpenRouter, dentro de `architecture`."""
    value = item.get(key)
    if value is None:
        architecture = item.get("architecture")
        value = architecture.get(key) if isinstance(architecture, Mapping) else None
    return [str(v) for v in value] if isinstance(value, list) else None


def _is_free(item: Mapping[str, Any]) -> bool | None:
    pricing = item.get("pricing")
    if not isinstance(pricing, Mapping) or "prompt" not in pricing or "completion" not in pricing:
        return None
    try:
        return float(pricing["prompt"]) == 0 and float(pricing["completion"]) == 0
    except TypeError, ValueError:
        return None


def _supports_images(model_id: str, inputs: list[str] | None, capabilities: object) -> bool | None:
    if inputs is not None:
        return "image" in inputs
    if isinstance(capabilities, Mapping) and "vision" in capabilities:
        return bool(capabilities["vision"])
    return True if any(hint in model_id.lower() for hint in _VISION_HINTS) else None


class OpenAICompatibleProvider:
    def __init__(
        self,
        *,
        name: str,
        api_key: str,
        model: str,
        timeout_seconds: float,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self.name = name
        self.model = model
        self.scope = credential_scope(name, model, api_key)
        self._spec = SPECS[name]
        self.verifies_key = self._spec.key_check != "none"
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
        try:
            async with httpx.AsyncClient(
                base_url=self._spec.base_url, timeout=self._timeout, transport=self._transport
            ) as client:
                response = await client.request(
                    method, path, json=payload, headers={"Authorization": f"Bearer {self._api_key}"}
                )
        except httpx.HTTPError as exc:
            logger.warning(
                "provider transport error", extra={"provider": self.name, "error_type": type(exc).__name__}
            )
            if isinstance(exc, httpx.TimeoutException):
                raise ProviderTimeout(f"{self.name} timed out", reason="timeout") from exc
            raise ProviderUnavailable(f"{self.name} unreachable", reason="unreachable") from exc
        if response.is_error:
            logger.warning(
                "provider request failed", extra={"provider": self.name, "status": response.status_code}
            )
            raise self._error_from(response.status_code, _body_of(response), response.headers, operation)
        try:
            return response.json()
        except ValueError as exc:
            raise ProviderUnavailable(f"{self.name} returned malformed json", reason="malformed") from exc

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

    async def _complete(self, messages: list[dict[str, Any]], operation: Operation) -> Completion:
        payload = {"model": self.model, "temperature": 0.3, "max_tokens": _MAX_TOKENS, "messages": messages}
        body = await self._request("POST", "/chat/completions", payload, operation)
        if isinstance(body, Mapping) and body.get("error") and not body.get("choices"):
            # OpenRouter a veces responde 200 con el error en el cuerpo: el código real va adentro.
            _, code = parse_error_body(body)
            status = int(code) if code is not None and code.isdigit() else 502
            raise self._error_from(status, body, {}, operation)
        try:
            choice = body["choices"][0]
            message = choice["message"]
            text = str(message.get("content") or "").strip()
            finish = str(choice.get("finish_reason") or "")
            refusal = message.get("refusal")
        except (KeyError, IndexError, TypeError, AttributeError) as exc:
            raise ProviderUnavailable(f"{self.name} malformed response", reason="malformed") from exc
        if text:
            return Completion(text, truncated=finish == "length")
        if finish == "content_filter" or refusal:
            raise ProviderContentBlocked(f"{self.name} blocked the response", reason="content_filter")
        if finish == "length":
            raise ProviderEmptyResponse(f"{self.name} used the whole output limit", reason="length")
        raise ProviderEmptyResponse(f"{self.name} returned no text", reason=finish or "empty")

    async def chat(self, system: str, messages: Sequence[ChatMessage]) -> Completion:
        return await self._complete(
            [
                {"role": "system", "content": system},
                *({"role": m.role, "content": m.content} for m in messages),
            ],
            "chat",
        )

    async def describe_image(self, image: bytes, mime: str, context: str, *, system: str = "") -> Completion:
        # Si el modelo no acepta imágenes, el proveedor responde 400/404/422 → ProviderImageRejected.
        data_url = f"data:{mime};base64,{base64.b64encode(image).decode()}"
        image_url: str | dict[str, str] = data_url if self._spec.image_url_as_string else {"url": data_url}
        text = "Describí esta imagen." + (f" Contexto del documento: {context}" if context else "")
        return await self._complete(
            [
                {"role": "system", "content": system},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": text},
                        {"type": "image_url", "image_url": image_url},
                    ],
                },
            ],
            "image",
        )

    async def list_models(self) -> list[ModelInfo]:
        if self._spec.key_check == "endpoint":
            # Las dos llamadas son independientes: van juntas. Si la key falla, gana ese error aunque
            # el listado (público) haya respondido bien o haya fallado por otra razón.
            key_check: Any | BaseException
            listing: Any | BaseException
            key_check, listing = await asyncio.gather(
                self._request("GET", self._spec.key_check_path, operation="models"),
                self._request("GET", "/models", operation="models"),
                return_exceptions=True,
            )
            if isinstance(key_check, BaseException):
                raise key_check
            if isinstance(listing, BaseException):
                raise listing
            body = listing
        else:
            body = await self._request("GET", "/models", operation="models")
        items = body.get("data") if isinstance(body, Mapping) else None
        if not isinstance(items, list):
            raise ProviderUnavailable(f"{self.name} malformed model list", reason="malformed")
        models: list[ModelInfo] = []
        for item in items:
            if not isinstance(item, Mapping) or not isinstance(item.get("id"), str):
                continue
            model_id: str = item["id"]
            inputs, outputs = _modalities(item, "input_modalities"), _modalities(item, "output_modalities")
            if item.get("active") is False or any(word in model_id.lower() for word in _NOT_FOR_CHAT):
                continue
            if (inputs is not None and "text" not in inputs) or (outputs is not None and outputs != ["text"]):
                continue
            capabilities = item.get("capabilities")  # Mistral: {"completion_chat": bool, "vision": bool, …}
            if isinstance(capabilities, Mapping) and capabilities.get("completion_chat") is False:
                continue
            models.append(
                ModelInfo(
                    id=model_id,
                    name=str(item.get("name") or model_id),
                    supports_images=_supports_images(model_id, inputs, capabilities),
                    free=_is_free(item) if self._spec.reports_free else None,
                )
            )
        return models

    async def aclose(self) -> None:
        """Nada que cerrar: cada pedido abre y cierra su propio `httpx.AsyncClient`."""
