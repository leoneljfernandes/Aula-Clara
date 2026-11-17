from dataclasses import dataclass
from datetime import date
from typing import Literal

DocumentType = Literal["PDF", "Word", "PowerPoint"]


@dataclass(slots=True)
class Document:
    id: str
    title: str
    subject: str
    type: DocumentType
    created_on: date
    progress: float = 0.0  # 0..1
