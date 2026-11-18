"""Router de la API versionada (/api/v1): un include por recurso."""

from fastapi import APIRouter

from app.api import ai, ai_session, documents, presets

api_router = APIRouter()
api_router.include_router(presets.router)
api_router.include_router(documents.router)
api_router.include_router(ai.router)
api_router.include_router(ai_session.router)
