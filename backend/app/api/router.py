"""Router de la API versionada (/api/v1): un include por recurso."""

from fastapi import APIRouter

from app.api import ai, ai_session, documents, profiles

api_router = APIRouter()
api_router.include_router(profiles.router)
api_router.include_router(documents.router)
api_router.include_router(ai.router)
api_router.include_router(ai_session.router)
