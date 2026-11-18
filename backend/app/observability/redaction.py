"""Tacha la API key de la persona en cualquier línea de log, por si una librería la incluye en un mensaje.

La key de la consulta en curso se guarda en una variable de contexto (una por pedido, no compartida entre
pedidos concurrentes) y el formateador de logs la reemplaza antes de escribir. Es una segunda barrera: el
código ya evita loguear la key, esto cubre el caso de un mensaje de error ajeno que la contenga.
"""

from contextvars import ContextVar

REDACTED = "[key tachada]"
_MIN_LENGTH = 8  # nunca se tacha algo tan corto que arruinaría el log (la validación exige 8 o más)
_current_key: ContextVar[str | None] = ContextVar("request_api_key", default=None)


def remember_key(api_key: str) -> None:
    _current_key.set(api_key)


def scrub(text: str) -> str:
    key = _current_key.get()
    return text.replace(key, REDACTED) if key and len(key) >= _MIN_LENGTH else text
