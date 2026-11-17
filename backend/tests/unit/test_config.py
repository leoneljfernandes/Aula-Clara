from typing import Any

import pytest
from pydantic import ValidationError

from app.config import ROOT_DIR, Settings

# AI_PROVIDER explícito: el conftest exporta AI_PROVIDER=mock y el entorno le gana al default.
BASE: dict[str, Any] = {"ERRORS_BASE_URL": "https://errors.test.invalid", "AI_PROVIDER": "auto"}


def _settings(**overrides: Any) -> Settings:
    return Settings(_env_file=None, **{**BASE, **overrides})


def test_auto_without_keys_falls_back_to_mock() -> None:
    assert _settings(AI_PROVIDER="auto").active_ai_provider == "mock"


def test_auto_prefers_gemini_over_groq() -> None:
    settings = _settings(
        AI_PROVIDER="auto", GEMINI_API_KEY="g", GEMINI_MODEL="m1", GROQ_API_KEY="q", GROQ_MODEL="m2"
    )
    assert settings.active_ai_provider == "gemini"


def test_auto_uses_groq_when_only_groq_is_configured() -> None:
    assert _settings(GROQ_API_KEY="q", GROQ_MODEL="m2").active_ai_provider == "groq"


def test_explicit_mock_wins_even_with_keys() -> None:
    settings = _settings(AI_PROVIDER="mock", GEMINI_API_KEY="g", GEMINI_MODEL="m1")
    assert settings.active_ai_provider == "mock"


@pytest.mark.parametrize(
    "overrides",
    [
        {"GEMINI_API_KEY": "g"},  # key sin modelo
        {"GROQ_API_KEY": "q"},
        {"AI_PROVIDER": "gemini"},  # proveedor forzado sin configurar
        {"AI_PROVIDER": "groq", "GROQ_MODEL": "m2"},
    ],
)
def test_incomplete_ai_config_fails_at_startup(overrides: dict[str, Any]) -> None:
    with pytest.raises(ValidationError):
        _settings(**overrides)


def test_api_keys_never_appear_in_repr() -> None:
    settings = _settings(GEMINI_API_KEY="super-secret-key", GEMINI_MODEL="m1")
    assert "super-secret-key" not in repr(settings)


def test_prod_rejects_wildcard_cors() -> None:
    with pytest.raises(ValidationError):
        _settings(APP_ENV="prod", CORS_ORIGINS=["*"])


def test_env_example_is_valid_and_has_empty_secrets() -> None:
    # El archivo de referencia versionado tiene que arrancar tal cual (modo mock, sin keys).
    settings = Settings(_env_file=ROOT_DIR / ".env.example")
    assert settings.GEMINI_API_KEY is None
    assert settings.GROQ_API_KEY is None
    assert settings.active_ai_provider == "mock"
    assert settings.CORS_ORIGINS == ["http://localhost:5173"]
