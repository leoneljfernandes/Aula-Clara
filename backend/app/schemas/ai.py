from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

from app.models import ChatAction


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: ChatAction
    message: Annotated[str, Field(max_length=2_000)] | None = None
    # Tope duro de transporte; el recorte fino por MAX_INPUT_CHARS lo hace el service.
    document_text: Annotated[str, Field(max_length=500_000)]
    selection: Annotated[str, Field(max_length=20_000)] | None = None


class ChatResponse(BaseModel):
    answer: str
    provider: str
    model: str
    # True si el modelo cortó la respuesta por el límite de largo: la interfaz lo avisa.
    truncated: bool = False


class ImageDescriptionResponse(BaseModel):
    description: str
    provider: str
    model: str
    truncated: bool = False


class ModelRead(BaseModel):
    id: str
    name: str
    supports_images: bool | None
    free: bool | None


class ModelListResponse(BaseModel):
    provider: str
    # False: el proveedor no permite comprobar la key sin gastar una consulta (NVIDIA Build).
    key_verified: bool
    models: list[ModelRead]
