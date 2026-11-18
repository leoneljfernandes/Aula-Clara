from fastapi import APIRouter

from app.api.deps import PresetServiceDep
from app.schemas.preset import PresetRead

router = APIRouter(prefix="/presets", tags=["presets"])


@router.get("")
async def list_presets(service: PresetServiceDep) -> list[PresetRead]:
    return [PresetRead.model_validate(p) for p in await service.list()]
