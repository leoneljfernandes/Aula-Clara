from pydantic import BaseModel, ConfigDict


class PresetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    icon: str
    description: str
    tags: list[str]
    settings: dict[str, str | int | float | bool]
