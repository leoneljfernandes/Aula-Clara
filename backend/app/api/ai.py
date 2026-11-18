from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.api.deps import AIServiceDep, CatalogProviderDep, LLMProviderDep, enforce_rate_limit
from app.config import SettingsDep
from app.schemas.ai import (
    ChatRequest,
    ChatResponse,
    ImageDescriptionResponse,
    ModelListResponse,
    ModelRead,
)

# Cada llamada a /ai gasta cuota de la key del usuario y tiempo de función: límite por IP en todo el router.
router = APIRouter(prefix="/ai", tags=["ai"], dependencies=[Depends(enforce_rate_limit)])

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}


@router.get("/models")
async def list_models(service: AIServiceDep, provider: CatalogProviderDep) -> ModelListResponse:
    """Valida la key del usuario y devuelve los modelos de texto que puede usar."""
    models = await service.list_models(provider)
    return ModelListResponse(
        provider=provider.name,
        key_verified=provider.verifies_key,
        models=[
            ModelRead(id=m.id, name=m.name, supports_images=m.supports_images, free=m.free) for m in models
        ],
    )


@router.post("/chat")
async def chat(data: ChatRequest, service: AIServiceDep, provider: LLMProviderDep) -> ChatResponse:
    answer = await service.chat(
        provider=provider,
        action=data.action,
        message=data.message,
        document_text=data.document_text,
        selection=data.selection,
        language=data.language,
    )
    return ChatResponse(
        answer=answer.text, provider=answer.provider, model=answer.model, truncated=answer.truncated
    )


@router.post("/describe-image")
async def describe_image(
    service: AIServiceDep,
    provider: LLMProviderDep,
    settings: SettingsDep,
    image: Annotated[UploadFile, File()],
    context: Annotated[str, Form(max_length=2_000)] = "",
    color_guide: Annotated[bool, Form()] = False,
) -> ImageDescriptionResponse:
    # 415 y 413 son errores de transporte: el único caso donde `api/` usa HTTPException.
    if image.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Only JPEG, PNG, WebP or GIF images")
    data = await image.read(settings.MAX_IMAGE_BYTES + 1)  # no lee más de lo permitido
    if len(data) > settings.MAX_IMAGE_BYTES:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, "Image is larger than the allowed size")
    if not data:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Empty image")
    answer = await service.describe_image(
        provider=provider,
        image=data,
        mime=image.content_type,
        context=context,
        color_guide=color_guide,
    )
    return ImageDescriptionResponse(
        description=answer.text,
        provider=answer.provider,
        model=answer.model,
        truncated=answer.truncated,
    )
