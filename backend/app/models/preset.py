from collections.abc import Mapping
from dataclasses import dataclass, field

SettingValue = str | int | float | bool


@dataclass(frozen=True, slots=True)
class Preset:
    """Un perfil sugerido: ajustes como pares clave-valor que el backend no interpreta.

    `settings` no es hasheable: no usar un `Preset` como clave de un dict."""

    id: str
    title: str
    icon: str
    description: str
    tags: tuple[str, ...] = field(default_factory=tuple)
    settings: Mapping[str, SettingValue] = field(default_factory=dict)
