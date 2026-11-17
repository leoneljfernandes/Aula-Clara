from datetime import date
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

from app.models import DocumentType


class DocumentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Annotated[str, Field(min_length=1, max_length=200)]
    subject: Annotated[str, Field(max_length=100)] = ""
    type: DocumentType


class DocumentUpdate(BaseModel):
    """Todo opcional: se aplica con `model_dump(exclude_unset=True)`."""

    model_config = ConfigDict(extra="forbid")

    title: Annotated[str, Field(min_length=1, max_length=200)] | None = None
    subject: Annotated[str, Field(max_length=100)] | None = None
    progress: Annotated[float, Field(ge=0, le=1)] | None = None


class DocumentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    subject: str
    type: DocumentType
    created_on: date
    progress: float


class Page[T](BaseModel):
    items: list[T]
    offset: int
    limit: int
