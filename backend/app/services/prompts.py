"""System prompts versionados en app/prompts/*.md (se leen una sola vez)."""

from pathlib import Path

_DIR = Path(__file__).resolve().parent.parent / "prompts"

STUDY_PROMPT = (_DIR / "study_assistant.md").read_text(encoding="utf-8")
IMAGE_PROMPT = (_DIR / "image_description.md").read_text(encoding="utf-8")
