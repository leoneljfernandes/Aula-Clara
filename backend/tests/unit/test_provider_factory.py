import pytest

from app.providers.llm.anthropic import AnthropicProvider
from app.providers.llm.factory import build_provider
from app.providers.llm.gemini import GeminiProvider
from app.providers.llm.openai_compatible import OpenAICompatibleProvider


@pytest.mark.parametrize(
    ("name", "expected"),
    [
        ("gemini", GeminiProvider),
        ("anthropic", AnthropicProvider),
        ("openai", OpenAICompatibleProvider),
        ("groq", OpenAICompatibleProvider),
        ("openrouter", OpenAICompatibleProvider),
        ("mistral", OpenAICompatibleProvider),
        ("nvidia", OpenAICompatibleProvider),
    ],
)
def test_every_provider_name_builds_its_class(name: str, expected: type) -> None:
    provider = build_provider(name, api_key="k", model="m", timeout_seconds=5)  # type: ignore[arg-type]
    assert isinstance(provider, expected)
    assert provider.name == name
