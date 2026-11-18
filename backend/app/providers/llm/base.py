"""Interfaz común de los proveedores y los errores que el service traduce a respuestas HTTP.

Cada usuario trae su propia key: los proveedores se crean por pedido y nunca guardan ni loguean la key.
Cada error lleva lo que la persona necesita para resolverlo (motivo, cuánto esperar, el mensaje del
proveedor ya limpio de la key y acotado), porque casi todos los fallos de IA los puede resolver ella.
"""

import hashlib
from collections.abc import Sequence
from typing import Protocol

from app.models import ChatMessage, Completion, ModelInfo


class ProviderError(Exception):
    """Base de los errores de un proveedor de IA."""

    def __init__(
        self,
        message: str,
        *,
        status: int | None = None,
        provider_message: str | None = None,
        retry_after: float | None = None,
        reason: str | None = None,
    ) -> None:
        super().__init__(message)
        self.status = status  # HTTP del proveedor, si lo hubo
        self.provider_message = provider_message  # su texto, sin la key y acotado (ver http_errors)
        self.retry_after = retry_after  # segundos que sugiere esperar
        self.reason = reason  # matiz para el mensaje: "rate" | "daily" | "credit" | "region" | …


class ProviderUnavailable(ProviderError):
    """5xx, sobrecarga, sin red o respuesta ilegible: es transitorio; se reintenta si falló rápido."""


class ProviderTimeout(ProviderUnavailable):
    """Se agotó `AI_TIMEOUT_SECONDS`. No se reintenta: otro intento igual de lento no entra en el tope de
    duración de la función de Vercel."""


class ProviderAuthError(ProviderError):
    """El proveedor rechazó la key (401, o 400/403 que dicen que la key es inválida, vencida o revocada)."""


class ProviderQuotaError(ProviderError):
    """Cuota o saldo agotados. `reason`: "rate" (por minuto), "daily" (por día) o "credit" (sin saldo)."""


class ProviderRejected(ProviderError):
    """El proveedor rechazó el pedido y ninguna categoría más específica aplica (400/422)."""


class ProviderModelNotFound(ProviderRejected):
    """El modelo no existe, fue dado de baja o la cuenta no tiene acceso."""


class ProviderImageRejected(ProviderRejected):
    """El modelo no lee imágenes, o no admite ese formato o tamaño de imagen."""


class ProviderPermissionDenied(ProviderRejected):
    """403 que no es de la key: la cuenta no puede usar el modelo, la región o la función (`reason`)."""


class ProviderPayloadTooLarge(ProviderError):
    """413, o el texto supera la ventana de contexto del modelo: hay que mandar menos."""


class ProviderContentBlocked(ProviderError):
    """El modelo o el proveedor bloquearon el pedido o la respuesta por sus filtros de seguridad."""


class ProviderEmptyResponse(ProviderError):
    """El modelo respondió sin texto. `reason="length"`: gastó todo el límite de salida (típico de los
    modelos que «razonan» antes de contestar)."""


def credential_scope(provider: str, model: str, api_key: str) -> str:
    """Huella de (proveedor, modelo, key) para separar la caché por usuario sin guardar la key."""
    return hashlib.sha256(f"{provider}\x00{model}\x00{api_key}".encode()).hexdigest()[:32]


class LLMProvider(Protocol):
    name: str  # "gemini" | "groq" | "openrouter" | "mistral" | "nvidia": se devuelve como `provider`
    model: str  # vacío cuando el proveedor se crea solo para listar modelos
    scope: str
    # False si el proveedor no permite comprobar la key sin gastar una consulta (NVIDIA): la lista de
    # modelos sale igual, y una key mala recién se nota en la primera consulta.
    verifies_key: bool

    async def chat(self, system: str, messages: Sequence[ChatMessage]) -> Completion: ...

    async def describe_image(self, image: bytes, mime: str, context: str, *, system: str = "") -> Completion:
        """`system`: prompt de descripción, lo arma el service (los proveedores no lo conocen)."""
        ...

    async def list_models(self) -> list[ModelInfo]:
        """Modelos de texto disponibles. Si `verifies_key`, además valida la key (401 → ProviderAuthError)."""
        ...

    async def aclose(self) -> None:
        """Libera conexiones. El proveedor se crea por pedido, así que `api/deps.py` lo cierra al terminar."""
        ...
