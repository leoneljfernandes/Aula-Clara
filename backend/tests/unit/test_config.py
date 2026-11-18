from typing import Any

import pytest
from pydantic import ValidationError

from app.config import ROOT_DIR, Settings

BASE: dict[str, Any] = {"ERRORS_BASE_URL": "https://errors.test.invalid"}


def _settings(**overrides: Any) -> Settings:
    return Settings(_env_file=None, **{**BASE, **overrides})


def test_prod_rejects_wildcard_cors() -> None:
    with pytest.raises(ValidationError):
        _settings(APP_ENV="prod", CORS_ORIGINS=["*"])


def test_old_server_ai_keys_are_ignored() -> None:
    # Un .env viejo con keys no rompe el arranque, pero el servidor ya no las usa.
    settings = _settings(GEMINI_API_KEY="secreto", GEMINI_MODEL="m1", AI_PROVIDER="gemini")
    assert not hasattr(settings, "GEMINI_API_KEY")
    assert "secreto" not in repr(settings)


def test_env_example_is_valid_and_has_no_ai_secrets() -> None:
    # El archivo de referencia versionado tiene que arrancar tal cual y no pedir ninguna key.
    settings = Settings(_env_file=ROOT_DIR / ".env.example")
    assert settings.CORS_ORIGINS == ["http://localhost:5173"]
    example = (ROOT_DIR / ".env.example").read_text(encoding="utf-8")
    for name in ("GEMINI_API_KEY=", "GROQ_API_KEY=", "GEMINI_MODEL=", "GROQ_MODEL=", "AI_PROVIDER="):
        assert name not in example


def test_ai_timeout_must_fit_in_the_vercel_function_duration() -> None:
    assert _settings().AI_TIMEOUT_SECONDS == 20
    with pytest.raises(ValidationError):
        _settings(AI_TIMEOUT_SECONDS=30)


VALID_SEAL = "KmtOxkU7J3d7ZtXbA3Nq0m1y9j5pQe2sVcHfWl8uRzk="


def test_sealing_is_off_without_a_key_and_on_with_a_valid_one() -> None:
    assert (
        _settings(SEALING_KEY=None).sealing_enabled is False
    )  # None explícito: el entorno de tests define una
    assert _settings(SEALING_KEY=VALID_SEAL).sealing_enabled is True


@pytest.mark.parametrize(
    "overrides",
    [
        {"SEALING_KEY": "demasiado-corta"},
        {"SEALING_KEY": "no es base64 !!!"},
        {"SEALING_KEY": VALID_SEAL, "SEALING_KEY_PREVIOUS": "mala"},
        {"SEALING_KEY": None, "SEALING_KEY_PREVIOUS": VALID_SEAL},  # rotar sin tener la clave nueva
    ],
)
def test_a_bad_sealing_key_fails_at_startup(overrides: dict[str, Any]) -> None:
    with pytest.raises(ValidationError):
        _settings(**overrides)


def test_the_sealing_key_never_appears_in_repr() -> None:
    assert VALID_SEAL not in repr(_settings(SEALING_KEY=VALID_SEAL))


def test_session_lifetimes_have_sane_bounds() -> None:
    settings = _settings()
    assert (settings.AI_SESSION_HOURS, settings.AI_SESSION_REMEMBER_DAYS) == (12, 30)
    for bad in ({"AI_SESSION_HOURS": 0}, {"AI_SESSION_HOURS": 100}, {"AI_SESSION_REMEMBER_DAYS": 365}):
        with pytest.raises(ValidationError):
            _settings(**bad)
