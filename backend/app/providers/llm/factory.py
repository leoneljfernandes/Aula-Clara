"""Crea el proveedor que eligió el usuario, con su key. Lo llama solo `api/deps.py` (raíz de composición)."""

from app.models import AIProviderName
from app.providers.llm.base import LLMProvider
from app.providers.llm.gemini import GeminiProvider
from app.providers.llm.openai_compatible import OpenAICompatibleProvider


def build_provider(name: AIProviderName, *, api_key: str, model: str, timeout_seconds: float) -> LLMProvider:
    if name == "gemini":
        return GeminiProvider(api_key=api_key, model=model, timeout_seconds=timeout_seconds)
    return OpenAICompatibleProvider(name=name, api_key=api_key, model=model, timeout_seconds=timeout_seconds)
