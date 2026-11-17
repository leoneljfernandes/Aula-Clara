from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.api.deps import AIServiceDep, enforce_rate_limit
from app.config import SettingsDep
from app.schemas.ai import ChatRequest, ChatResponse, ImageDescriptionResponse

# Cada llamada a /ai gasta cuota gratuita: límite por IP en todo el router.
router = APIRouter(prefix="/ai", tags=["ai"], dependencies=[Depends(enforce_rate_limit)])

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}


@router.post("/chat")
async def chat(data: ChatRequest, service: AIServiceDep) -> ChatResponse:
    answer, provider = await service.chat(
        action=data.action, message=data.message, document_text=data.document_text, selection=data.selection
    )
    return ChatResponse(answer=answer, provider=provider)


@router.post("/describe-image")
async def describe_image(
    service: AIServiceDep,
    settings: SettingsDep,
    image: Annotated[UploadFile, File()],
    context: Annotated[str, Form(max_length=2_000)] = "",
) -> ImageDescriptionResponse:
    # 415 y 413 son errores de transporte: el único caso donde `api/` usa HTTPException.
    if image.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Only JPEG, PNG, WebP or GIF images")
    data = await image.read(settings.MAX_IMAGE_BYTES + 1)  # no lee más de lo permitido
    if len(data) > settings.MAX_IMAGE_BYTES:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, "Image is larger than the allowed size")
    if not data:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Empty image")
    description, provider = await service.describe_image(image=data, mime=image.content_type, context=context)
    return ImageDescriptionResponse(description=description, provider=provider)
