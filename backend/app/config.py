"""Configuración por stage: única fuente de configuración (skill configuring-fastapi-settings).

Nadie más lee `os.environ`. Los secretos (API keys) son `SecretStr` y solo se leen con
`.get_secret_value()` en el punto de uso (los proveedores de IA).
"""

import os
from enum import StrEnum
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal, Self

from fastapi import Depends
from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Los .env viven en la raíz del repositorio (backend/app/config.py → parents[2]), no en el
# directorio desde donde se ejecuta el comando.
ROOT_DIR = Path(__file__).resolve().parents[2]


class Stage(StrEnum):
    DEV = "dev"
    TEST = "test"
    STAGING = "staging"
    PROD = "prod"


AIProviderName = Literal["auto", "gemini", "groq", "mock"]


class Settings(BaseSettings):
    # Prioridad (mayor a menor): variables de entorno > .env.<stage> > .env > defaults.
    # env_ignore_empty: una clave vacía (como GEMINI_API_KEY= en .env.example) usa el default.
    model_config = SettingsConfigDict(
        env_file_encoding="utf-8", extra="ignore", frozen=True, env_ignore_empty=True
    )

    APP_ENV: Stage = Stage.DEV
    APP_NAME: str = "aula-clara-api"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False
    DOCS_ENABLED: bool = False  # /docs y /openapi.json; solo se enciende en desarrollo
    LOG_LEVEL: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    CORS_ORIGINS: list[str] = []  # en el entorno, JSON: '["https://app.example.com"]'
    ERRORS_BASE_URL: str = Field(min_length=1)  # prefijo del campo "type" de problem+json

    # IA. Las keys son opcionales a propósito: sin key, todo funciona en modo mock
    # (definición de terminado del MVP). Los modelos no tienen default en el código.
    AI_PROVIDER: AIProviderName = "auto"
    GEMINI_API_KEY: SecretStr | None = None
    GEMINI_MODEL: str | None = None
    GROQ_API_KEY: SecretStr | None = None
    GROQ_MODEL: str | None = None
    AI_TIMEOUT_SECONDS: float = Field(default=30.0, gt=0, le=120)

    # Protección de la cuota gratuita.
    MAX_INPUT_CHARS: int = Field(default=12_000, ge=500, le=200_000)
    MAX_IMAGE_BYTES: int = Field(default=4 * 1024 * 1024, ge=1024, le=20 * 1024 * 1024)
    RATE_LIMIT_PER_MIN: int = Field(default=10, ge=1, le=1_000)
    AI_CACHE_TTL_SECONDS: int = Field(default=3_600, ge=0)

    @property
    def gemini_configured(self) -> bool:
        return self.GEMINI_API_KEY is not None and self.GEMINI_MODEL is not None

    @property
    def groq_configured(self) -> bool:
        return self.GROQ_API_KEY is not None and self.GROQ_MODEL is not None

    @property
    def active_ai_provider(self) -> Literal["gemini", "groq", "mock"]:
        """Proveedor principal según la configuración (el fallback a mock en runtime es aparte)."""
        if self.AI_PROVIDER != "auto":
            return self.AI_PROVIDER
        if self.gemini_configured:
            return "gemini"
        if self.groq_configured:
            return "groq"
        return "mock"

    @model_validator(mode="after")
    def _guard_ai(self) -> Self:
        # Una key sin modelo es una configuración a medias: falla al arrancar, no en la primera request.
        if self.GEMINI_API_KEY is not None and self.GEMINI_MODEL is None:
            raise ValueError("GEMINI_API_KEY is set but GEMINI_MODEL is empty")
        if self.GROQ_API_KEY is not None and self.GROQ_MODEL is None:
            raise ValueError("GROQ_API_KEY is set but GROQ_MODEL is empty")
        if self.AI_PROVIDER == "gemini" and not self.gemini_configured:
            raise ValueError("AI_PROVIDER=gemini requires GEMINI_API_KEY and GEMINI_MODEL")
        if self.AI_PROVIDER == "groq" and not self.groq_configured:
            raise ValueError("AI_PROVIDER=groq requires GROQ_API_KEY and GROQ_MODEL")
        return self

    @model_validator(mode="after")
    def _guard_production(self) -> Self:
        if self.APP_ENV in (Stage.STAGING, Stage.PROD):
            if self.DEBUG:
                raise ValueError("DEBUG must be false in staging/prod")
            if "*" in self.CORS_ORIGINS:
                raise ValueError("CORS_ORIGINS cannot contain '*' in staging/prod")
        return self


@lru_cache
def get_settings() -> Settings:
    stage = os.getenv("APP_ENV", Stage.DEV.value)  # única lectura directa: decide qué archivo cargar
    if stage == Stage.TEST.value:
        return Settings(_env_file=None)  # los tests no leen ningún .env
    settings = Settings(_env_file=(ROOT_DIR / ".env", ROOT_DIR / f".env.{stage}"))
    if settings.APP_ENV.value != stage:
        raise RuntimeError(
            f"APP_ENV={settings.APP_ENV.value} comes from a .env file, but the stage (now: {stage}) "
            "is chosen by the real environment variable: export APP_ENV instead."
        )
    return settings


SettingsDep = Annotated[Settings, Depends(get_settings)]
