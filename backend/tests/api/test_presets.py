from httpx import AsyncClient


async def test_presets_catalog_lists_the_seed_presets(client: AsyncClient) -> None:
    response = await client.get("/api/v1/presets")
    assert response.status_code == 200
    presets = {p["id"]: p for p in response.json()}
    assert set(presets) == {"dislexia", "vision", "fatiga", "ceguera"}
    assert presets["vision"]["settings"] == {
        "font": "atkinson",
        "font_size": 28,
        "line_height": 1.7,
        "theme": "contraste",
        "audio_focus": False,
    }
    assert presets["dislexia"]["tags"] == ["OpenDyslexic", "Interlineado amplio", "Fondo sepia"]
    assert presets["ceguera"]["settings"]["voice_guide"] is False
    assert presets["ceguera"]["settings"]["voice_commands"] == "push"


async def test_old_profiles_endpoint_is_gone(client: AsyncClient) -> None:
    assert (await client.get("/api/v1/profiles")).status_code == 404
