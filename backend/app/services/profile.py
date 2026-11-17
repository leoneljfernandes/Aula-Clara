from collections.abc import Sequence

from app.crud.base import Repository
from app.models import Profile


class ProfileService:
    def __init__(self, profiles: Repository[Profile]) -> None:
        self._profiles = profiles

    async def list(self) -> Sequence[Profile]:
        return await self._profiles.list(offset=0, limit=100)  # catálogo chico y acotado
