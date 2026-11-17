import uuid
from collections.abc import Sequence
from datetime import date

from app.crud.base import Repository
from app.errors import NotFoundError
from app.models import Document
from app.schemas.document import DocumentCreate, DocumentUpdate


class DocumentService:
    """Metadatos de documentos. En Vercel la memoria no persiste entre invocaciones: la fuente de verdad
    del usuario es localStorage en el navegador; este CRUD demuestra la arquitectura y funciona en local."""

    def __init__(self, documents: Repository[Document]) -> None:
        self._documents = documents

    async def list(self, *, offset: int, limit: int) -> Sequence[Document]:
        return await self._documents.list(offset=offset, limit=limit)

    async def get(self, document_id: str) -> Document:
        document = await self._documents.get(document_id)
        if document is None:
            raise NotFoundError(f"Document {document_id} not found")
        return document

    async def create(self, data: DocumentCreate) -> Document:
        document = Document(
            id=uuid.uuid4().hex[:12],
            title=data.title,
            subject=data.subject,
            type=data.type,
            created_on=date.today(),
        )
        return await self._documents.create(document)

    async def update(self, document_id: str, data: DocumentUpdate) -> Document:
        document = await self.get(document_id)
        for field, value in data.model_dump(exclude_unset=True).items():
            if value is not None:  # un null explícito no borra campos NOT NULL
                setattr(document, field, value)
        return await self._documents.update(document)

    async def delete(self, document_id: str) -> None:
        if not await self._documents.delete(document_id):
            raise NotFoundError(f"Document {document_id} not found")
