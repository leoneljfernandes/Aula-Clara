import time
from collections import OrderedDict

from app.models import AIAnswer


class AnswerCache:
    """Caché en memoria con TTL y tope de entradas (protege la cuota gratuita de IA)."""

    def __init__(self, ttl_seconds: int, max_entries: int = 256) -> None:
        self._ttl = ttl_seconds
        self._max = max_entries
        self._items: OrderedDict[str, tuple[float, AIAnswer]] = OrderedDict()

    def get(self, key: str) -> AIAnswer | None:
        entry = self._items.get(key)
        if entry is None:
            return None
        expires, value = entry
        if expires < time.monotonic():
            del self._items[key]
            return None
        return value

    def set(self, key: str, value: AIAnswer) -> None:
        if self._ttl <= 0:
            return
        self._items[key] = (time.monotonic() + self._ttl, value)
        self._items.move_to_end(key)
        while len(self._items) > self._max:
            self._items.popitem(last=False)
