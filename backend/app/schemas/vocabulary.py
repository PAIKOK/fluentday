from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import ProficiencyLevel, WordStatus

ContentSource = Literal["book", "admin", "ai", "dataset"]


class Example(BaseModel):
    text: str = Field(min_length=1, max_length=300)
    source: ContentSource = "admin"


class WordSourceOut(BaseModel):
    book_id: str
    book_slot: int
    book_title: str
    page: int
    definition: str | None
    raw_text: str
    confidence: float


class WordOut(BaseModel):
    id: str
    word: str
    part_of_speech: str | None
    pronunciation: str | None
    definition: str | None
    examples: list[Example]
    synonyms: list[str]
    antonyms: list[str]
    level: ProficiencyLevel | None
    status: WordStatus
    needs_review: bool
    review_reasons: list[str]
    admin_edited: bool
    sources: list[WordSourceOut]
    # Position in the starter word list (1 = most useful), for words loaded from it.
    starter_rank: int | None = None
    updated_at: datetime


class WordPage(BaseModel):
    items: list[WordOut]
    total: int
    page: int
    page_size: int


def _clean_terms(values: list[str] | None) -> list[str] | None:
    if values is None:
        return None
    cleaned = [" ".join(v.split()).lower() for v in values]
    if any(not v or len(v) > 40 for v in cleaned):
        raise ValueError("Each item must be 1–40 characters.")
    return list(dict.fromkeys(cleaned))


class WordUpdate(BaseModel):
    word: str | None = Field(default=None, min_length=1, max_length=60)
    part_of_speech: str | None = Field(default=None, max_length=30)
    pronunciation: str | None = Field(default=None, max_length=60)
    definition: str | None = Field(default=None, max_length=1000)
    examples: list[Example] | None = Field(default=None, max_length=10)
    synonyms: list[str] | None = Field(default=None, max_length=15)
    antonyms: list[str] | None = Field(default=None, max_length=15)
    level: ProficiencyLevel | None = None
    clear_level: bool = False
    status: WordStatus | None = None

    @field_validator("synonyms", "antonyms")
    @classmethod
    def clean_terms(cls, value: list[str] | None) -> list[str] | None:
        return _clean_terms(value)


class BulkStatusIn(BaseModel):
    ids: list[str] = Field(min_length=1, max_length=200)
    status: WordStatus


class BulkStatusOut(BaseModel):
    updated: int
    skipped_without_definition: int


class StarterVocabularyOut(BaseModel):
    words_in_file: int
    loaded: int
    added: int = 0
    updated: int = 0
