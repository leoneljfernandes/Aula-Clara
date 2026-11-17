"""Salud del servicio, fuera de /api/v1 pero bajo /api para que Vercel lo enrute a FastAPI."""

from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from app.config import SettingsDep

router = APIRouter(prefix="/api/health", tags=["health"])


class LiveStatus(BaseModel):
    status: Literal["ok"]


class ReadyStatus(BaseModel):
    status: Literal["ok"]
    version: str
    ai_provider: Literal["gemini", "groq", "mock"]


@router.get("/live")
async def live() -> LiveStatus:
    return LiveStatus(status="ok")  # el proceso responde; no toca nada externo


@router.get("/ready")
async def ready(settings: SettingsDep) -> ReadyStatus:
    # No llama al proveedor de IA (gastaría cuota): informa cuál está configurado.
    return ReadyStatus(status="ok", version=settings.APP_VERSION, ai_provider=settings.active_ai_provider)
