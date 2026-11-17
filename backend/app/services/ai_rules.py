"""Reglas puras del asistente (sin red ni estado): se prueban como funciones."""

import hashlib

from app.models import ChatAction

ACTION_INSTRUCTIONS: dict[ChatAction, str] = {
    "free": "Respondé la pregunta de la persona usando solo el documento.",
    "summarize": "Resumí el documento en 4 a 6 viñetas cortas.",
    "key_concepts": "Explicá los conceptos clave del documento en viñetas cortas, una definición por viñeta.",
    "quiz": "Escribí exactamente 3 preguntas de repaso numeradas sobre el documento.",
    "simplify": "Reformulá el fragmento seleccionado con palabras más simples, sin perder el significado "
    "y sin agregar información.",
}
_CUT_MARK = "\n[…texto recortado…]"


def trim_text(text: str, limit: int) -> str:
    """Recorta al límite, cortando en un espacio para no partir una palabra."""
    if len(text) <= limit:
        return text
    cut = text[:limit].rsplit(" ", 1)[0] or text[:limit]
    return cut + _CUT_MARK


def build_context(document_text: str, selection: str | None, max_chars: int) -> str:
    """Nunca manda el documento entero si es largo: selección primero y el texto con el cupo restante."""
    parts: list[str] = []
    budget = max_chars
    if selection:
        selection = trim_text(selection, max_chars // 2)
        parts.append(f"<seleccion>\n{selection}\n</seleccion>")
        budget = max(max_chars - len(selection), max_chars // 2)
    parts.append(f"<documento>\n{trim_text(document_text, budget)}\n</documento>")
    return "\n\n".join(parts)


def build_user_message(action: ChatAction, message: str | None, context: str) -> str:
    asked = f"Pregunta: {message}\n\n" if message else ""
    return f"{ACTION_INSTRUCTIONS[action]}\n\n{asked}{context}"


def cache_key(*parts: str | bytes | None) -> str:
    digest = hashlib.sha256()
    for part in parts:
        digest.update(part.encode() if isinstance(part, str) else (part or b""))
        digest.update(b"\x00")
    return digest.hexdigest()
