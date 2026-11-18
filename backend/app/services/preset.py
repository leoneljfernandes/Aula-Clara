from collections.abc import Sequence

from app.crud.base import Repository
from app.models import Preset


class PresetService:
    def __init__(self, presets: Repository[Preset]) -> None:
        self._presets = presets

    async def list(self) -> Sequence[Preset]:
        return await self._presets.list(offset=0, limit=100)  # catálogo chico y acotado
