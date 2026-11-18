from httpx import AsyncClient


async def test_live_responds_ok(client: AsyncClient) -> None:
    response = await client.get("/api/health/live")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


async def test_ready_does_not_depend_on_ai_keys(client: AsyncClient) -> None:
    response = await client.get("/api/health/ready")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert "ai_provider" not in response.json()  # las keys son de cada usuario, no del servidor
