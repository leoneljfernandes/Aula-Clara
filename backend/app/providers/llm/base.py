from collections.abc import Sequence
from typing import Protocol

from app.models import ChatAction, ChatMessage


class ProviderUnavailable(Exception):
    """El proveedor respondió 429, falló o agotó el tiempo. El service pasa al siguiente."""


class LLMProvider(Protocol):
    name: str  # "gemini" | "groq" | "mock": se devuelve al cliente como `provider`
    supports_images: bool

    async def chat(self, system: str, messages: Sequence[ChatMessage], *, action: ChatAction = "free") -> str:
        """`action` es una pista: solo la usa el mock para elegir su respuesta."""
        ...

    async def describe_image(self, image: bytes, mime: str, context: str, *, system: str = "") -> str:
        """`system`: prompt de descripción, lo arma el service (los proveedores no lo conocen)."""
        ...
