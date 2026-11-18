"""Entidades de dominio puras (dataclasses), sin dependencias de frameworks."""

from app.models.chat import AIAnswer, AIProviderName, ChatAction, ChatMessage, Completion, ModelInfo
from app.models.document import Document, DocumentType
from app.models.preset import Preset, SettingValue

__all__ = [
    "AIAnswer",
    "AIProviderName",
    "ChatAction",
    "ChatMessage",
    "Completion",
    "Document",
    "DocumentType",
    "ModelInfo",
    "Preset",
    "SettingValue",
]
