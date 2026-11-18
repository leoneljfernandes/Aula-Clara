from dataclasses import dataclass
from typing import Literal

ChatAction = Literal["free", "summarize", "key_concepts", "quiz", "simplify", "glossary", "visual_outline"]
# Nivel de lenguaje de la respuesta: estándar, lenguaje claro (ISO 24495-1) o Lectura Fácil.
AnswerLanguage = Literal["standard", "plain", "easy"]
AIProviderName = Literal["gemini", "groq", "openrouter", "mistral", "nvidia"]


@dataclass(frozen=True, slots=True)
class ChatMessage:
    role: Literal["user", "assistant"]
    content: str


@dataclass(frozen=True, slots=True)
class Completion:
    """Lo que devuelve un proveedor: el texto y si el modelo lo cortó por el límite de largo."""

    text: str
    truncated: bool = False


@dataclass(frozen=True, slots=True)
class AIAnswer:
    """Respuesta de un modelo, con quién la generó (se muestra en la interfaz)."""

    text: str
    provider: str
    model: str
    truncated: bool = False


@dataclass(frozen=True, slots=True)
class ModelInfo:
    """Un modelo que la key del usuario puede usar. `None` = el proveedor no lo informa."""

    id: str
    name: str
    supports_images: bool | None
    free: bool | None
