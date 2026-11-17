"""Límite por clave (IP) con ventana deslizante de un minuto, en memoria.

En Vercel cada instancia de la función tiene su propio contador: sirve como freno de la cuota gratuita,
no como límite estricto."""

import math
import time
from collections import defaultdict, deque

from app.errors import RateLimitedError


class RateLimiter:
    def __init__(self, per_minute: int, *, window_seconds: float = 60.0) -> None:
        self._limit = per_minute
        self._window = window_seconds
        self._hits: defaultdict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str) -> None:
        now = time.monotonic()
        hits = self._hits[key]
        while hits and hits[0] <= now - self._window:
            hits.popleft()
        if len(hits) >= self._limit:
            retry_after = max(1, math.ceil(hits[0] + self._window - now))
            raise RateLimitedError(
                f"Limit of {self._limit} requests per minute reached",
                headers={"Retry-After": str(retry_after)},
            )
        hits.append(now)
        if not hits:  # pragma: no cover
            del self._hits[key]
