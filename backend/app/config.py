"""Configuración por stage: única fuente de configuración (skill configuring-fastapi-settings).

Nadie más lee `os.environ`. El servidor no guarda API keys de IA: las trae cada usuario en sus pedidos.
"""

import base64
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


def _is_fernet_key(value: str) -> bool:
    try:
        return len(base64.urlsafe_b64decode(value.encode())) == 32
    except ValueError:
        return False


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

    # IA. El servidor no tiene API keys ni modelo: cada usuario manda los suyos en cada pedido
    # (headers X-AI-Provider, X-AI-Model y X-AI-Key). Ver docs/adr/0002-api-key-por-usuario.md.
    # Tope por llamada al proveedor. Debe entrar en el `maxDuration` de 30 s de vercel.json, junto con un
    # posible reintento de una falla rápida (ver services/ai.py): por eso el máximo es 25.
    AI_TIMEOUT_SECONDS: float = Field(default=20.0, gt=0, le=25)

    # Key sellada: si se define, la API key de cada persona puede viajar en una cookie HttpOnly cifrada con
    # esta clave (el JavaScript de la página no puede leerla). Sin ella se usa el modo de headers, con la
    # key guardada en el navegador. Para generarla: `python -c "from cryptography.fernet import Fernet;
    # print(Fernet.generate_key().decode())"`.
    SEALING_KEY: SecretStr | None = None
    SEALING_KEY_PREVIOUS: SecretStr | None = None  # para rotar: se acepta para leer, ya no para sellar
    AI_SESSION_HOURS: int = Field(default=12, ge=1, le=72)  # vida de la cookie si no se pide recordar
    AI_SESSION_REMEMBER_DAYS: int = Field(default=30, ge=1, le=90)  # vida con «Recordar en este dispositivo»

    # Protección de la cuota gratuita.
    MAX_INPUT_CHARS: int = Field(default=12_000, ge=500, le=200_000)
    MAX_IMAGE_BYTES: int = Field(default=4 * 1024 * 1024, ge=1024, le=20 * 1024 * 1024)
    RATE_LIMIT_PER_MIN: int = Field(default=10, ge=1, le=1_000)
    AI_CACHE_TTL_SECONDS: int = Field(default=3_600, ge=0)
    # Verificador opcional de 2ª pasada (entailment): duplica el uso de cuota y suma latencia.
    AI_STRICT_VERIFIER_ENABLED: bool = False

    @property
    def sealing_enabled(self) -> bool:
        return self.SEALING_KEY is not None

    @model_validator(mode="after")
    def _guard_sealing(self) -> Self:
        # Una clave mal formada falla al arrancar, no en el primer intento de guardar una key.
        for name in ("SEALING_KEY", "SEALING_KEY_PREVIOUS"):
            secret: SecretStr | None = getattr(self, name)
            if secret is not None and not _is_fernet_key(secret.get_secret_value()):
                raise ValueError(f"{name} must be 32 random bytes encoded as url-safe base64")
        if self.SEALING_KEY_PREVIOUS is not None and self.SEALING_KEY is None:
            raise ValueError("SEALING_KEY_PREVIOUS requires SEALING_KEY")
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
