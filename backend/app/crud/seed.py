"""Datos semilla (app/seed/*.json) convertidos a entidades de dominio."""

import json
from datetime import date
from pathlib import Path
from typing import Any, cast

from app.models import Document, Profile, ProfilePreset

SEED_DIR = Path(__file__).resolve().parent.parent / "seed"


def _load(name: str) -> list[dict[str, Any]]:
    return cast(list[dict[str, Any]], json.loads((SEED_DIR / name).read_text(encoding="utf-8")))


def load_profiles() -> list[Profile]:
    return [
        Profile(
            id=row["id"],
            title=row["title"],
            icon=row["icon"],
            description=row["description"],
            tags=tuple(row["tags"]),
            preset=ProfilePreset(**row["preset"]) if row["preset"] else None,
        )
        for row in _load("profiles.json")
    ]


def load_documents() -> list[Document]:
    return [
        Document(**{**row, "created_on": date.fromisoformat(row["created_on"])})
        for row in _load("documents.json")
    ]
