from dataclasses import dataclass, field


@dataclass(frozen=True, slots=True)
class ProfilePreset:
    font: str
    font_size: int
    line_height: float
    theme: str
    audio_focus: bool


@dataclass(frozen=True, slots=True)
class Profile:
    id: str
    title: str
    icon: str
    description: str
    tags: tuple[str, ...] = field(default_factory=tuple)
    preset: ProfilePreset | None = None  # None = «Personalizado»
