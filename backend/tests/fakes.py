"""Dobles de prueba compartidos por los tests de la API: ninguno llama a un modelo real."""

import re
from collections.abc import Sequence

from app.models import ChatMessage, Completion, ModelInfo

_DOC_BLOCK_RE = re.compile(r"<documento_[a-z0-9]+>\s*(.*?)\s*</documento_[a-z0-9]+>", re.DOTALL)


def _extract_quote(messages: Sequence[ChatMessage]) -> str:
    if not messages:
        return "Un texto de estudio."
    match = _DOC_BLOCK_RE.search(messages[-1].content)
    if not match:
        return "Un texto de estudio."
    first_line = match.group(1).strip().splitlines()[0].strip()
    return first_line[:120] or "Un texto de estudio."


class FakeProvider:
    """Proveedor de prueba: ningún test llama a un modelo real."""

    def __init__(
        self,
        name: str,
        model: str,
        failure: Exception | None = None,
        truncated: bool = False,
        raw_chat_answer: str | None = None,
    ) -> None:
        self.name = name
        self.model = model
        self.scope = f"{name}-{model}"
        self.verifies_key = name != "nvidia"
        self.closed = False
        # Los `system` con que se pidieron descripciones de imágenes: los tests miran qué prompt llegó.
        self.image_systems: list[str] = []
        self.chat_calls: int = 0
        self._failure = failure
        self._truncated = truncated
        self._raw_chat_answer = raw_chat_answer

    async def chat(self, system: str, messages: Sequence[ChatMessage]) -> Completion:
        self.chat_calls += 1
        if self._failure:
            raise self._failure
        if self._raw_chat_answer is not None:
            return Completion(self._raw_chat_answer, truncated=self._truncated)
        quote = _extract_quote(messages)
        grounded = f'ESTADO: EN_DOCUMENTO\nCITAS:\n- "{quote}"\nRESPUESTA:\nResumen de prueba'
        return Completion(grounded, truncated=self._truncated)

    async def describe_image(self, image: bytes, mime: str, context: str, *, system: str = "") -> Completion:
        self.image_systems.append(system)
        if self._failure:
            raise self._failure
        return Completion("Un gráfico de prueba", truncated=self._truncated)

    async def list_models(self) -> list[ModelInfo]:
        if self._failure:
            raise self._failure
        return [ModelInfo("gemini-3.5-flash-lite", "Gemini 3.5 Flash Lite", True, None)]

    async def aclose(self) -> None:
        self.closed = True
