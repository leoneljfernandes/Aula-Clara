"""Raíz de composición: el único módulo de `api/` que conoce `crud` y `providers`.

Los repositorios, la caché y el limitador viven una sola vez por proceso (lru_cache). El proveedor de IA,
en cambio, se crea en cada pedido con la key y el modelo de la persona: el servidor no tiene keys propias.
La key llega de una de dos formas (docs/adr/0003-key-sellada-en-cookie.md): en el header `X-AI-Key` (modo de
headers) o sellada en una cookie `HttpOnly` que solo el servidor puede abrir (modo de cookie).
Para PostgreSQL, acá se reemplaza `InMemoryRepository` por `SqlAlchemyRepository(session)`; services y
routers no cambian."""

import re
from collections.abc import AsyncIterator
from functools import lru_cache
from typing import Annotated, get_args

from fastapi import Cookie, Depends, Header, Query, Request

from app.config import SettingsDep, get_settings
from app.crud.answer_cache import AnswerCache
from app.crud.base import Repository
from app.crud.memory import InMemoryRepository
from app.crud.seed import load_documents, load_profiles
from app.errors import AICredentialsRequiredError, AIKeyInvalidError, ForbiddenError
from app.models import AIProviderName, Document, Profile
from app.observability.redaction import remember_key
from app.providers.llm.base import LLMProvider
from app.providers.llm.factory import build_provider
from app.rate_limit import RateLimiter
from app.services.ai import AIService
from app.services.document import DocumentService
from app.services.key_sealing import KeySealer, OpenedKey, SealedKeyError
from app.services.profile import ProfileService

PROVIDERS: tuple[str, ...] = get_args(AIProviderName)
# `__Host-` obliga a Secure, Path=/ y sin Domain: ningún subdominio puede pisar la cookie.
COOKIE_NAME = "__Host-aula_ai"
# Ids reales: "gemini-3.5-flash-lite", "openai/gpt-oss-20b", "vendor/modelo:free".
_MODEL_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:/@-]{0,127}$")


@lru_cache
def _profiles_repo() -> Repository[Profile]:
    return InMemoryRepository(load_profiles())


@lru_cache
def _documents_repo() -> Repository[Document]:
    return InMemoryRepository(load_documents())


@lru_cache
def get_ai_service() -> AIService:
    settings = get_settings()
    return AIService(
        cache=AnswerCache(settings.AI_CACHE_TTL_SECONDS), max_input_chars=settings.MAX_INPUT_CHARS
    )


@lru_cache
def get_key_sealer() -> KeySealer | None:
    settings = get_settings()
    if settings.SEALING_KEY is None:
        return None
    keys = [settings.SEALING_KEY.get_secret_value()]
    if settings.SEALING_KEY_PREVIOUS is not None:
        keys.append(settings.SEALING_KEY_PREVIOUS.get_secret_value())
    return KeySealer(
        keys,
        session_seconds=settings.AI_SESSION_HOURS * 3600,
        remember_seconds=settings.AI_SESSION_REMEMBER_DAYS * 86_400,
    )


KeySealerDep = Annotated[KeySealer | None, Depends(get_key_sealer)]


def require_marker(x_aula_clara: Annotated[str | None, Header()] = None) -> None:
    """Un pedido que usa la cookie tiene que traer este header: un formulario o una imagen de otro sitio no
    puede agregarlo (y un `fetch` de otro sitio dispara la verificación CORS). Segunda barrera contra CSRF,
    además de `SameSite=Strict`."""
    if x_aula_clara != "1":
        raise ForbiddenError("Missing X-Aula-Clara header")


def open_sealed(sealer: KeySealer | None, token: str) -> OpenedKey:
    """Abre la cookie. Si no se puede (vencida, manipulada, de otra clave), la persona recarga su key."""
    expired = {"reason": "session_expired"}
    if sealer is None:
        raise AICredentialsRequiredError("Sealed AI sessions are not enabled", extra=expired)
    try:
        return sealer.open(token)
    except SealedKeyError as exc:
        raise AICredentialsRequiredError("The saved AI session expired or is invalid", extra=expired) from exc


def _user_credentials(provider: str | None, api_key: str | None) -> tuple[AIProviderName, str]:
    if not provider or not api_key:
        raise AICredentialsRequiredError("Send your own AI provider and API key (X-AI-Provider, X-AI-Key)")
    if provider not in PROVIDERS:
        raise AICredentialsRequiredError(f"Unsupported AI provider. Use one of: {', '.join(PROVIDERS)}")
    api_key = api_key.strip()
    if not 8 <= len(api_key) <= 400 or not api_key.isascii() or any(c.isspace() for c in api_key):
        raise AIKeyInvalidError("The API key has an invalid format")
    remember_key(api_key)  # desde acá, cualquier log de este pedido sale con la key tachada
    return provider, api_key  # type: ignore[return-value]  # validado contra PROVIDERS


def resolve_credentials(
    sealer: KeySealerDep,
    x_ai_provider: Annotated[str | None, Header()] = None,
    x_ai_key: Annotated[str | None, Header()] = None,
    sealed: Annotated[str | None, Cookie(alias=COOKIE_NAME)] = None,
    x_aula_clara: Annotated[str | None, Header()] = None,
) -> tuple[AIProviderName, str]:
    """(proveedor, key) de la persona. Si trae `X-AI-Key` manda ese modo; si no, la cookie sellada."""
    if x_ai_key:
        return _user_credentials(x_ai_provider, x_ai_key)
    if sealed is not None:
        require_marker(x_aula_clara)
        opened = open_sealed(sealer, sealed)
        return _user_credentials(opened.provider, opened.api_key)
    raise AICredentialsRequiredError("Send your own AI provider and API key (X-AI-Provider, X-AI-Key)")


CredentialsDep = Annotated[tuple[AIProviderName, str], Depends(resolve_credentials)]


async def get_llm_provider(
    settings: SettingsDep,
    credentials: CredentialsDep,
    x_ai_model: Annotated[str | None, Header()] = None,
) -> AsyncIterator[LLMProvider]:
    """Proveedor del usuario para chatear o describir imágenes: exige proveedor, key y modelo.

    Se crea por pedido con la key de la persona y se cierra al terminar (libera sus conexiones)."""
    name, api_key = credentials
    if not x_ai_model or not _MODEL_ID.match(x_ai_model):
        raise AICredentialsRequiredError("Choose a model (X-AI-Model)")
    provider = build_provider(
        name, api_key=api_key, model=x_ai_model, timeout_seconds=settings.AI_TIMEOUT_SECONDS
    )
    try:
        yield provider
    finally:
        await provider.aclose()


async def get_catalog_provider(
    settings: SettingsDep, credentials: CredentialsDep
) -> AsyncIterator[LLMProvider]:
    """Proveedor sin modelo, solo para listar los modelos de la key (y validarla). Se cierra al terminar."""
    name, api_key = credentials
    provider = build_provider(name, api_key=api_key, model="", timeout_seconds=settings.AI_TIMEOUT_SECONDS)
    try:
        yield provider
    finally:
        await provider.aclose()


@lru_cache
def get_rate_limiter() -> RateLimiter:
    return RateLimiter(get_settings().RATE_LIMIT_PER_MIN)


def get_profile_service() -> ProfileService:
    return ProfileService(_profiles_repo())


def get_document_service() -> DocumentService:
    return DocumentService(_documents_repo())


def client_ip(request: Request) -> str:
    # En Vercel la plataforma fija x-forwarded-for; fuera de ahí es un dato del cliente.
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def enforce_rate_limit(request: Request, limiter: Annotated[RateLimiter, Depends(get_rate_limiter)]) -> None:
    limiter.check(client_ip(request))


ProfileServiceDep = Annotated[ProfileService, Depends(get_profile_service)]
DocumentServiceDep = Annotated[DocumentService, Depends(get_document_service)]
AIServiceDep = Annotated[AIService, Depends(get_ai_service)]
LLMProviderDep = Annotated[LLMProvider, Depends(get_llm_provider)]
CatalogProviderDep = Annotated[LLMProvider, Depends(get_catalog_provider)]
Offset = Annotated[int, Query(ge=0)]
Limit = Annotated[int, Query(ge=1, le=100)]
