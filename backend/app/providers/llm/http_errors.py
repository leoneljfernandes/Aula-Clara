"""Clasifica los errores HTTP de los proveedores en los tipos de `base.py` (una sola vez, para todos).

Primero manda el código HTTP y después el texto del error: un 429 o un 403 pueden mencionar «API key»
sin que la key esté mal. Los textos son los que documentan los proveedores; lo que no se reconoce cae en
`ProviderRejected` o `ProviderUnavailable` con el mensaje del proveedor, para que la persona igual lo vea.
"""

import json
import re
from collections.abc import Mapping
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from typing import Any, Literal

from app.providers.llm.base import (
    ProviderAuthError,
    ProviderContentBlocked,
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

Operation = Literal["chat", "image", "models"]
MAX_PROVIDER_MESSAGE = 300
MAX_RETRY_AFTER = 3600.0  # esperar más de una hora no es una instrucción útil

_TOKEN_LIKE = re.compile(r"\b[A-Za-z0-9_\-]{32,}\b")  # restos de keys, ids largos
_KEY_WORDS = re.compile(r"api[ _-]?key|apikey", re.I)
_KEY_BAD = re.compile(r"invalid|not valid|expired|missing|revoked|leaked|incorrect|unauthori[sz]ed", re.I)
_AUTH = re.compile(r"authenticat|unauthori[sz]ed|credential|invalid (access )?token|bearer", re.I)
_CONTEXT = re.compile(
    r"context[ _-]?(length|window)|too many tokens|token count|maximum (number of )?tokens|"
    r"reduce the length|prompt is too long|input is too long|too long|exceeds? the (maximum|limit)",
    re.I,
)
_BLOCKED = re.compile(
    r"safety|moderation|content[ _-]?(policy|filter)|flagged|blocked|prohibited|harmful", re.I
)
_REGION = re.compile(
    r"location is not supported|not available in your|unsupported (country|region)|not supported in your",
    re.I,
)
_CREDIT = re.compile(r"insufficient|out of credits|no credits|credit balance|add (more )?credits", re.I)
_DAILY = re.compile(r"per[ _-]?day|daily|\brpd\b|\btpd\b", re.I)
_MODEL_MISSING = re.compile(
    r"(model|function).{0,60}(not found|does not exist|doesn't exist|decommission|deprecat|not available)|"
    r"not found for account|no such model|unknown model",
    re.I,
)
_OVERLOAD = re.compile(r"overload|capacity|try again later|temporarily", re.I)


def sanitize_message(text: str | None, api_key: str) -> str | None:
    """Texto del proveedor apto para mostrar: sin la key de la persona, sin restos que parezcan keys,
    en una línea y acotado. Nunca se muestra un mensaje del proveedor sin pasar por acá."""
    if not text:
        return None
    if api_key:
        text = text.replace(api_key, "[tu key]")
    cleaned = _TOKEN_LIKE.sub("[…]", " ".join(text.split()))
    if len(cleaned) > MAX_PROVIDER_MESSAGE:
        cleaned = cleaned[:MAX_PROVIDER_MESSAGE].rstrip() + "…"
    return cleaned or None


def parse_error_body(body: Any) -> tuple[str | None, str | None]:
    """(mensaje, código) de los formatos de error conocidos: OpenAI/Groq/OpenRouter (`error.message`),
    Mistral (`message`), NVIDIA/FastAPI (`detail`) y texto plano."""
    if isinstance(body, str):
        return body.strip() or None, None
    if not isinstance(body, Mapping):
        return None, None
    error: Any = body.get("error", body)
    if isinstance(error, str):
        return error, None
    if not isinstance(error, Mapping):
        return None, None
    message: Any = error.get("message") or error.get("detail") or body.get("detail")
    if isinstance(message, (Mapping, list)):
        message = json.dumps(message, ensure_ascii=False)
    code: Any = error.get("code") or error.get("type") or error.get("status")
    return (str(message) if message else None), (str(code) if code else None)


def parse_retry_after(value: str | None, *, now: datetime | None = None) -> float | None:
    """`Retry-After` (segundos o fecha HTTP) o el `retryDelay` de Gemini («34s», «1.5s»)."""
    if not value:
        return None
    value = value.strip()
    seconds: float | None = None
    try:
        seconds = float(value.removesuffix("s"))
    except ValueError:
        try:
            seconds = (parsedate_to_datetime(value) - (now or datetime.now(UTC))).total_seconds()
        except TypeError, ValueError:
            return None
    return min(max(seconds, 0.0), MAX_RETRY_AFTER)


def classify(
    provider: str,
    status: int,
    *,
    message: str | None,
    code: str | None = None,
    retry_after: float | None = None,
    api_key: str,
    operation: Operation = "chat",
    hint: str = "",
) -> ProviderError:
    """Convierte (código HTTP, mensaje, código del proveedor) en el error que corresponde.

    `hint`: texto extra solo para decidir (por ejemplo, el detalle de cuota de Gemini); no se muestra.
    """
    text = message or ""
    probe = f"{text} {code or ''} {hint}"
    shown = sanitize_message(message, api_key)
    extra: dict[str, Any] = {"status": status, "provider_message": shown, "retry_after": retry_after}
    name = f"{provider} http {status}"

    if status == 401:
        return ProviderAuthError(name, status=status, retry_after=retry_after)  # sin mensaje: ya se explica
    if status == 402 or (status == 429 and _CREDIT.search(probe)):
        return ProviderQuotaError(name, reason="credit", **extra)
    if status == 429:
        return ProviderQuotaError(name, reason="daily" if _DAILY.search(probe) else "rate", **extra)
    if status == 413:
        return ProviderPayloadTooLarge(name, reason="size", **extra)

    if status in (400, 403, 404, 422):
        key_rejected = bool(_KEY_WORDS.search(text) and _KEY_BAD.search(text))
        if key_rejected or (status == 403 and _AUTH.search(text)):
            return ProviderAuthError(name, status=status, retry_after=retry_after)
        if _CONTEXT.search(probe) and status != 403:
            return ProviderPayloadTooLarge(name, reason="context", **extra)
        if _BLOCKED.search(probe):
            return ProviderContentBlocked(name, **extra)
        if _REGION.search(probe):
            return ProviderPermissionDenied(name, reason="region", **extra)
        if status == 403:
            return ProviderPermissionDenied(name, reason="access", **extra)
        if (
            status == 404
            or (code or "").lower() in ("model_not_found", "model_not_available")
            or (_MODEL_MISSING.search(text))
        ):
            return ProviderModelNotFound(name, **extra)
        if operation == "image":
            return ProviderImageRejected(name, **extra)
        return ProviderRejected(name, **extra)

    if status in (408, 504):
        return ProviderTimeout(name, reason="timeout", **extra)
    if status >= 500:
        reason = "overloaded" if status in (503, 529) or _OVERLOAD.search(probe) else "provider_error"
        return ProviderUnavailable(name, reason=reason, **extra)
    return ProviderRejected(name, **extra)
