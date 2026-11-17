from fastapi import APIRouter, Response, status

from app.api.deps import DocumentServiceDep, Limit, Offset
from app.schemas.document import DocumentCreate, DocumentRead, DocumentUpdate, Page

router = APIRouter(prefix="/documents", tags=["documents"])


@router.get("")
async def list_documents(
    service: DocumentServiceDep, offset: Offset = 0, limit: Limit = 50
) -> Page[DocumentRead]:
    items = await service.list(offset=offset, limit=limit)
    return Page(items=[DocumentRead.model_validate(d) for d in items], offset=offset, limit=limit)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_document(data: DocumentCreate, service: DocumentServiceDep) -> DocumentRead:
    return DocumentRead.model_validate(await service.create(data))


@router.get("/{document_id}")
async def get_document(document_id: str, service: DocumentServiceDep) -> DocumentRead:
    return DocumentRead.model_validate(await service.get(document_id))


@router.patch("/{document_id}")
async def update_document(
    document_id: str, data: DocumentUpdate, service: DocumentServiceDep
) -> DocumentRead:
    return DocumentRead.model_validate(await service.update(document_id, data))


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(document_id: str, service: DocumentServiceDep) -> Response:
    await service.delete(document_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
