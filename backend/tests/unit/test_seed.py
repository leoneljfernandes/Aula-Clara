import json
from pathlib import Path

import pytest

from app.crud.seed import SeedError, load_presets

VALID: dict[str, object] = {
    "id": "x-1",
    "title": "X",
    "icon": "X",
    "description": "d",
    "tags": ["t"],
    "settings": {"font_size": 20},
}


def write(tmp_path: Path, rows: list[dict[str, object]]) -> Path:
    path = tmp_path / "presets.json"
    path.write_text(json.dumps(rows), encoding="utf-8")
    return path


def test_loads_a_valid_preset(tmp_path: Path) -> None:
    [preset] = load_presets(write(tmp_path, [VALID]))
    assert preset.id == "x-1"
    assert preset.tags == ("t",)
    assert dict(preset.settings) == {"font_size": 20}


@pytest.mark.parametrize(
    "bad",
    [
        {**VALID, "id": "Con Espacios"},
        {**VALID, "settings": {"fontSize": 20}},
        {**VALID, "settings": {"theme": None}},
        {**VALID, "settings": {"nested": {"a": 1}}},
        {**VALID, "tags": "no-es-lista"},
    ],
)
def test_rejects_an_invalid_preset_naming_it(tmp_path: Path, bad: dict[str, object]) -> None:
    with pytest.raises(SeedError, match=str(bad["id"])):
        load_presets(write(tmp_path, [bad]))


def test_rejects_duplicate_ids(tmp_path: Path) -> None:
    with pytest.raises(SeedError, match="x-1"):
        load_presets(write(tmp_path, [VALID, VALID]))


def test_the_shipped_seed_is_valid() -> None:
    assert [p.id for p in load_presets()] == ["dislexia", "vision", "fatiga"]
