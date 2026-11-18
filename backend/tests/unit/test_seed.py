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


def test_the_id_custom_is_reserved_for_the_fixed_personalizado_option(tmp_path: Path) -> None:
    with pytest.raises(SeedError, match="custom"):
        load_presets(write(tmp_path, [{**VALID, "id": "custom"}]))


@pytest.mark.parametrize(
    "bad",
    [
        {**VALID, "id": "x-1\n"},
        {**VALID, "settings": {"font_size\n": 20}},
    ],
)
def test_a_trailing_newline_does_not_pass_the_format_check(tmp_path: Path, bad: dict[str, object]) -> None:
    with pytest.raises(SeedError, match="no cumple"):
        load_presets(write(tmp_path, [bad]))


def test_the_settings_of_a_loaded_preset_are_read_only(tmp_path: Path) -> None:
    [preset] = load_presets(write(tmp_path, [VALID]))
    with pytest.raises(TypeError):
        preset.settings["font_size"] = 99  # type: ignore[index]


def test_rejects_duplicate_ids(tmp_path: Path) -> None:
    with pytest.raises(SeedError, match="x-1"):
        load_presets(write(tmp_path, [VALID, VALID]))


def test_the_shipped_seed_is_valid() -> None:
    assert [p.id for p in load_presets()] == ["dislexia", "vision", "fatiga", "ceguera", "motriz", "sordera"]
