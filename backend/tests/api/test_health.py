from httpx import AsyncClient


async def test_live_responds_ok(client: AsyncClient) -> None:
    response = await client.get("/api/health/live")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


async def test_ready_reports_mock_provider_without_keys(client: AsyncClient) -> None:
    response = await client.get("/api/health/ready")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["ai_provider"] == "mock"
