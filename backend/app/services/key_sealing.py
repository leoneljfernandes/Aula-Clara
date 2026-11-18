"""Sella la API key de una persona para guardarla en una cookie `HttpOnly`.

El servidor no guarda nada: la cookie lleva la key cifrada y autenticada (Fernet: AES + HMAC) con
`SEALING_KEY`, y solo el servidor puede abrirla. Así el JavaScript de la página, aunque estuviera
comprometido, no puede leer la key ni llevársela: a lo sumo puede hacer consultas mientras la pestaña esté
abierta. Ver docs/adr/0003-key-sellada-en-cookie.md.

Sin HTTP ni FastAPI: la cookie en sí la maneja `api/`.
"""

import json
import time
from collections.abc import Callable, Sequence
from dataclasses import dataclass

from cryptography.fernet import Fernet, InvalidToken, MultiFernet


class SealedKeyError(Exception):
    """El sello no se pudo abrir: manipulado, de otra clave, vencido o ilegible."""


@dataclass(frozen=True, slots=True)
class OpenedKey:
    provider: str
    api_key: str
    remember: bool
    expires_at: float  # epoch, en segundos


class KeySealer:
    def __init__(
        self,
        keys: Sequence[str],
        *,
        session_seconds: int,
        remember_seconds: int,
        clock: Callable[[], float] = time.time,
    ) -> None:
        # La primera clave sella; todas abren (permite rotar sin cerrar la sesión de nadie).
        self._fernet = MultiFernet([Fernet(k) for k in keys])
        self._session_seconds = session_seconds
        self._remember_seconds = remember_seconds
        self._clock = clock

    def seal(self, provider: str, api_key: str, *, remember: bool) -> tuple[str, int]:
        """(sello, segundos de vida). El vencimiento va adentro, cifrado: no se puede alargar desde afuera."""
        ttl = self._remember_seconds if remember else self._session_seconds
        payload = {"p": provider, "k": api_key, "r": remember, "e": int(self._clock()) + ttl}
        return self._fernet.encrypt(json.dumps(payload).encode()).decode(), ttl

    def open(self, token: str) -> OpenedKey:
        try:
            data = json.loads(self._fernet.decrypt(token.encode()))
            opened = OpenedKey(
                provider=str(data["p"]),
                api_key=str(data["k"]),
                remember=bool(data["r"]),
                expires_at=float(data["e"]),
            )
        except (InvalidToken, ValueError, KeyError, TypeError, UnicodeError) as exc:
            raise SealedKeyError("sealed key is invalid") from exc
        if opened.expires_at <= self._clock():
            raise SealedKeyError("sealed key expired")
        return opened

    def remaining_seconds(self, opened: OpenedKey) -> int:
        return max(0, int(opened.expires_at - self._clock()))
