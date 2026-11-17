from dataclasses import dataclass
from typing import Literal

ChatAction = Literal["free", "summarize", "key_concepts", "quiz", "simplify"]


@dataclass(frozen=True, slots=True)
class ChatMessage:
    role: Literal["user", "assistant"]
    content: str
