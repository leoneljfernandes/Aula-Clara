from pydantic import BaseModel, ConfigDict


class PresetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    font: str
    font_size: int
    line_height: float
    theme: str
    audio_focus: bool


class ProfileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    icon: str
    description: str
    tags: list[str]
    preset: PresetRead | None
