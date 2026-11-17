"""Elige los proveedores según la configuración. Lo llama solo `api/deps.py` (raíz de composición).

Cadena de chat:   [principal, respaldo de texto si hay, mock]
Cadena de imagen: [gemini si hay, mock]   (Groq no procesa imágenes)
El mock va siempre al final: sin key, con AI_PROVIDER=mock o ante un fallo, el sitio sigue funcionando.
"""

from app.config import Settings
from app.providers.llm.base import LLMProvider
from app.providers.llm.gemini import GeminiProvider
from app.providers.llm.groq import GroqProvider
from app.providers.llm.mock import MockProvider


def _gemini(settings: Settings) -> GeminiProvider:
    assert settings.GEMINI_API_KEY is not None and settings.GEMINI_MODEL is not None
    return GeminiProvider(
        api_key=settings.GEMINI_API_KEY.get_secret_value(),
        model=settings.GEMINI_MODEL,
        timeout_seconds=settings.AI_TIMEOUT_SECONDS,
    )


def _groq(settings: Settings) -> GroqProvider:
    assert settings.GROQ_API_KEY is not None and settings.GROQ_MODEL is not None
    return GroqProvider(
        api_key=settings.GROQ_API_KEY.get_secret_value(),
        model=settings.GROQ_MODEL,
        timeout_seconds=settings.AI_TIMEOUT_SECONDS,
    )


def build_chat_chain(settings: Settings) -> list[LLMProvider]:
    chain: list[LLMProvider] = []
    if settings.AI_PROVIDER != "mock":
        primary = settings.active_ai_provider
        if primary == "gemini":
            chain.append(_gemini(settings))
            if settings.groq_configured:
                chain.append(_groq(settings))
        elif primary == "groq":
            chain.append(_groq(settings))
    chain.append(MockProvider())
    return chain


def build_image_chain(settings: Settings) -> list[LLMProvider]:
    chain: list[LLMProvider] = []
    if settings.AI_PROVIDER != "mock" and settings.gemini_configured:
        chain.append(_gemini(settings))
    chain.append(MockProvider())
    return chain
