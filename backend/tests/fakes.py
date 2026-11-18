"""Dobles de prueba compartidos por los tests de la API: ninguno llama a un modelo real."""

from collections.abc import Sequence

from app.models import ChatMessage, Completion, ModelInfo


class FakeProvider:
    """Proveedor de prueba: ningún test llama a un modelo real."""

    def __init__(
        self,
        name: str,
        model: str,
        failure: Exception | None = None,
        truncated: bool = False,
    ) -> None:
        self.name = name
        self.model = model
        self.scope = f"{name}-{model}"
        self.verifies_key = name != "nvidia"
        self.closed = False
        # Los `system` con que se pidieron descripciones de imágenes: los tests miran qué prompt llegó.
        self.image_systems: list[str] = []
        self._failure = failure
        self._truncated = truncated

    async def chat(self, system: str, messages: Sequence[ChatMessage]) -> Completion:
        if self._failure:
            raise self._failure
        return Completion("Resumen de prueba", truncated=self._truncated)

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
