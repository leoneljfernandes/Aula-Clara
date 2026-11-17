from fastapi import APIRouter

from app.api.deps import ProfileServiceDep
from app.schemas.profile import ProfileRead

router = APIRouter(prefix="/profiles", tags=["profiles"])


@router.get("")
async def list_profiles(service: ProfileServiceDep) -> list[ProfileRead]:
    return [ProfileRead.model_validate(p) for p in await service.list()]
