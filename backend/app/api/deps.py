"""Raíz de composición: el único módulo de `api/` que conoce `crud` y `providers`.

Los repositorios, la caché y el limitador viven una sola vez por proceso (lru_cache). Para PostgreSQL,
acá se reemplaza `InMemoryRepository` por `SqlAlchemyRepository(session)`; services y routers no cambian."""

from functools import lru_cache
from typing import Annotated

from fastapi import Depends, Query, Request

from app.config import get_settings
from app.crud.answer_cache import AnswerCache
from app.crud.base import Repository
from app.crud.memory import InMemoryRepository
from app.crud.seed import load_documents, load_profiles
from app.models import Document, Profile
from app.providers.llm.factory import build_chat_chain, build_image_chain
from app.rate_limit import RateLimiter
from app.services.ai import AIService
from app.services.document import DocumentService
from app.services.profile import ProfileService


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
        chat_chain=build_chat_chain(settings),
        image_chain=build_image_chain(settings),
        cache=AnswerCache(settings.AI_CACHE_TTL_SECONDS),
        max_input_chars=settings.MAX_INPUT_CHARS,
    )


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
Offset = Annotated[int, Query(ge=0)]
Limit = Annotated[int, Query(ge=1, le=100)]
