from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import Accent
from app.services.pronunciation import Method


class PracticeWord(BaseModel):
    id: str
    word: str
    part_of_speech: str | None
    pronunciation: str | None
    definition: str | None
    example: str | None
    attempts_today: int
    recognised_today: bool


class PronunciationToday(BaseModel):
    today: str
    accent: Accent
    words: list[PracticeWord]
    completed: bool


class AttemptIn(BaseModel):
    word_id: str
    accent: Accent
    # What the browser's speech recognition heard (its alternatives, best first). Empty for a self-check.
    transcripts: list[str] = Field(default=[], max_length=5)
    self_check: bool = False

    @field_validator("transcripts")
    @classmethod
    def trim(cls, value: list[str]) -> list[str]:
        return [" ".join(t.split())[:200] for t in value]


class AttemptOut(BaseModel):
    id: str
    word_id: str
    word: str
    accent: Accent
    heard: str | None
    recognised: bool | None
    method: Method
    practice_date: str
    created_at: datetime


class PronunciationHistory(BaseModel):
    items: list[AttemptOut]
    total_attempts: int
    recognised_attempts: int
    days_practised: int
