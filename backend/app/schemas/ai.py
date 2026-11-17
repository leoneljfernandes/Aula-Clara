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


class ImageDescriptionResponse(BaseModel):
    description: str
    provider: str
