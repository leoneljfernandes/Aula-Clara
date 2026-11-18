"""Datos semilla (app/seed/*.json) convertidos a entidades de dominio."""

import json
import math
import re
from datetime import date
from pathlib import Path
from typing import Any, cast

from app.models import Document, Preset
from app.models.preset import SettingValue

SEED_DIR = Path(__file__).resolve().parent.parent / "seed"
_PRESET_ID = re.compile(r"^[a-z][a-z0-9-]{1,31}$")
_SETTING_KEY = re.compile(r"^[a-z][a-z0-9_]*$")


class SeedError(ValueError):
    """Un dato semilla no cumple el formato esperado. El mensaje nombra la fila."""


def _load(path: Path) -> list[dict[str, Any]]:
    return cast(list[dict[str, Any]], json.loads(path.read_text(encoding="utf-8")))


def _text(row: dict[str, Any], field: str, who: str) -> str:
    value = row.get(field)
    if not isinstance(value, str):
        raise SeedError(f"Preset {who}: '{field}' debe ser texto")
    return value


def _setting(key: object, value: object, who: str) -> SettingValue:
    if not isinstance(key, str) or not _SETTING_KEY.match(key):
        raise SeedError(f"Preset {who}: la clave de ajuste {key!r} no cumple {_SETTING_KEY.pattern}")
    if not isinstance(value, str | int | float):  # bool es subclase de int
        raise SeedError(f"Preset {who}: el ajuste '{key}' debe ser texto, número o booleano")
    if isinstance(value, float) and not math.isfinite(value):
        raise SeedError(f"Preset {who}: el ajuste '{key}' debe ser un número finito")
    return value


def _preset(row: object, position: int) -> Preset:
    if not isinstance(row, dict):
        raise SeedError(f"Preset #{position}: debe ser un objeto")
    raw_id = row.get("id")
    who = repr(raw_id) if isinstance(raw_id, str) else f"#{position}"
    if not isinstance(raw_id, str) or not _PRESET_ID.match(raw_id):
        raise SeedError(f"Preset {who}: el id no cumple {_PRESET_ID.pattern}")
    tags = row.get("tags")
    if not isinstance(tags, list) or not all(isinstance(t, str) for t in tags):
        raise SeedError(f"Preset {who}: 'tags' debe ser una lista de textos")
    settings = row.get("settings")
    if not isinstance(settings, dict):
        raise SeedError(f"Preset {who}: 'settings' debe ser un objeto")
    return Preset(
        id=raw_id,
        title=_text(row, "title", who),
        icon=_text(row, "icon", who),
        description=_text(row, "description", who),
        tags=tuple(tags),
        settings={key: _setting(key, value, who) for key, value in settings.items()},
    )


def load_presets(path: Path = SEED_DIR / "presets.json") -> list[Preset]:
    presets = [_preset(row, position) for position, row in enumerate(_load(path))]
    seen: set[str] = set()
    for preset in presets:
        if preset.id in seen:
            raise SeedError(f"Preset {preset.id!r}: id duplicado")
        seen.add(preset.id)
    return presets


def load_documents() -> list[Document]:
    return [
        Document(**{**row, "created_on": date.fromisoformat(row["created_on"])})
        for row in _load(SEED_DIR / "documents.json")
    ]
