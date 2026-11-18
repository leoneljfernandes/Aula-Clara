from httpx import AsyncClient


async def test_documents_list_is_paginated(client: AsyncClient) -> None:
    body = (await client.get("/api/v1/documents?limit=2")).json()
    assert len(body["items"]) == 2
    assert body["limit"] == 2


async def test_documents_crud_roundtrip(client: AsyncClient) -> None:
    created = await client.post("/api/v1/documents", json={"title": "Apunte", "type": "PDF"})
    assert created.status_code == 201
    doc = created.json()
    assert doc["progress"] == 0

    updated = await client.patch(f"/api/v1/documents/{doc['id']}", json={"progress": 0.5})
    assert updated.json()["progress"] == 0.5
    assert updated.json()["title"] == "Apunte"  # lo omitido no se pisa

    assert (await client.delete(f"/api/v1/documents/{doc['id']}")).status_code == 204
    assert (await client.get(f"/api/v1/documents/{doc['id']}")).status_code == 404


async def test_missing_document_is_problem_json_404(client: AsyncClient) -> None:
    response = await client.get("/api/v1/documents/nope")
    assert response.status_code == 404
    assert response.json()["code"] == "not_found"


async def test_document_validation_is_422_and_rejects_unknown_fields(client: AsyncClient) -> None:
    for payload in (
        {"title": "", "type": "PDF"},
        {"title": "x", "type": "TXT"},
        {"title": "x", "type": "PDF", "id": "z"},
    ):
        response = await client.post("/api/v1/documents", json=payload)
        assert response.status_code == 422
        assert response.json()["code"] == "validation_error"


async def test_patch_with_explicit_null_on_required_field_does_not_500(client: AsyncClient) -> None:
    response = await client.patch("/api/v1/documents/d1", json={"title": None})
    assert response.status_code == 200
    assert response.json()["title"]
