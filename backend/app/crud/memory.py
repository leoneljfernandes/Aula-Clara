from collections.abc import Iterable, Sequence

from app.crud.base import Entity


class InMemoryRepository[T: Entity]:
    """Repositorio en memoria con datos semilla. Vive mientras viva el proceso."""

    def __init__(self, seed: Iterable[T] = ()) -> None:
        self._items: dict[str, T] = {item.id: item for item in seed}

    async def get(self, entity_id: str) -> T | None:
        return self._items.get(entity_id)

    async def list(self, *, offset: int, limit: int) -> Sequence[T]:
        return list(self._items.values())[offset : offset + limit]

    async def create(self, entity: T) -> T:
        self._items[entity.id] = entity
        return entity

    async def update(self, entity: T) -> T:
        self._items[entity.id] = entity
        return entity

    async def delete(self, entity_id: str) -> bool:
        return self._items.pop(entity_id, None) is not None
