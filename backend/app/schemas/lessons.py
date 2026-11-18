from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import ProficiencyLevel
from app.schemas.notifications import NextReminder
from app.schemas.vocabulary import Example

LessonKind = Literal["new", "revision", "empty"]
ProgressStatus = Literal["new", "learned", "mastered"]


class SourceRef(BaseModel):
    book_title: str
    page: int


class MySentence(BaseModel):
    id: str
    text: str
    created_at: datetime


class WordProgress(BaseModel):
    status: ProgressStatus
    difficult: bool
    saved: bool
    first_lesson_date: str
    learned_on: str | None
    # Spaced repetition: successful revisions so far, and when the next one is due.
    revision_stage: int
    next_revision: str | None
    my_sentences: list[MySentence]


class LessonWord(BaseModel):
    id: str
    word: str
    part_of_speech: str | None
    pronunciation: str | None
    definition: str | None
    # Where the definition was printed. None means it was written or edited by the FluentDay team.
    definition_source: SourceRef | None
    examples: list[Example]
    synonyms: list[str]
    antonyms: list[str]
    level: ProficiencyLevel | None
    sources: list[SourceRef]
    progress: WordProgress


class LessonOut(BaseModel):
    lesson_date: str
    kind: LessonKind
    level: ProficiencyLevel | None
    words: list[LessonWord]
    revision_words: list[LessonWord]
    learned_count: int
    target: int


class DashboardWord(BaseModel):
    id: str
    word: str
    part_of_speech: str | None
    definition: str | None
    level: ProficiencyLevel | None
    learned: bool


class DashboardVideo(BaseModel):
    id: str
    title: str
    channel_name: str
    thumbnail_url: str
    duration_seconds: int | None
    completed: bool


class DashboardOut(BaseModel):
    lesson_date: str
    lesson_kind: LessonKind
    words_today: list[DashboardWord]
    videos_today: list[DashboardVideo]
    words_learned_total: int
    streak_days: int
    revisions_due_today: int
    speaking_challenge_done: bool
    quiz_done: bool
    next_reminder: NextReminder | None


class ProgressUpdate(BaseModel):
    learned: bool | None = None
    difficult: bool | None = None
    saved: bool | None = None


class SentenceIn(BaseModel):
    text: str = Field(min_length=3, max_length=300)

    @field_validator("text")
    @classmethod
    def clean(cls, value: str) -> str:
        value = " ".join(value.split())
        if len(value) < 3:
            raise ValueError("Write a sentence of at least 3 characters.")
        return value
