"""Interfaz de repositorio. Para PostgreSQL se agrega `SqlAlchemyRepository` con la misma interfaz
(recibe una `AsyncSession` por constructor) y solo cambia `api/deps.py`: services y routers no se tocan."""

from collections.abc import Sequence
from typing import Protocol


class Entity(Protocol):
    @property
    def id(self) -> str: ...  # solo lectura: también sirve a dataclasses frozen


class Repository[T: Entity](Protocol):
    async def get(self, entity_id: str) -> T | None: ...
    async def list(self, *, offset: int, limit: int) -> Sequence[T]: ...
    async def create(self, entity: T) -> T: ...
    async def update(self, entity: T) -> T: ...
    async def delete(self, entity_id: str) -> bool: ...
