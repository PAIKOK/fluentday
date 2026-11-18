from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

NotebookCategory = Literal["vocabulary", "expressions", "sentences", "mistakes"]


def _clean_tags(value: list[str] | None) -> list[str] | None:
    if value is None:
        return None
    tags = [" ".join(t.split()).lower().lstrip("#") for t in value]
    if any(not t or len(t) > 30 for t in tags):
        raise ValueError("Each tag must be 1–30 characters.")
    return list(dict.fromkeys(tags))


class NotebookEntryIn(BaseModel):
    category: NotebookCategory
    title: str = Field(min_length=1, max_length=120)
    content: str = Field(default="", max_length=5000)
    tags: list[str] = Field(default_factory=list, max_length=10)
    favourite: bool = False

    @field_validator("title")
    @classmethod
    def clean_title(cls, value: str) -> str:
        value = " ".join(value.split())
        if not value:
            raise ValueError("Please add a title.")
        return value

    @field_validator("tags")
    @classmethod
    def clean_tags(cls, value: list[str]) -> list[str]:
        return _clean_tags(value) or []


class NotebookEntryUpdate(BaseModel):
    category: NotebookCategory | None = None
    title: str | None = Field(default=None, min_length=1, max_length=120)
    content: str | None = Field(default=None, max_length=5000)
    tags: list[str] | None = Field(default=None, max_length=10)
    favourite: bool | None = None

    @field_validator("title")
    @classmethod
    def clean_title(cls, value: str | None) -> str | None:
        return " ".join(value.split()) if value is not None else None

    @field_validator("tags")
    @classmethod
    def clean_tags(cls, value: list[str] | None) -> list[str] | None:
        return _clean_tags(value)


class NotebookEntryOut(BaseModel):
    id: str
    category: NotebookCategory
    title: str
    content: str
    tags: list[str]
    favourite: bool
    word_id: str | None
    video_id: str | None
    created_at: datetime
    updated_at: datetime


class NotebookPage(BaseModel):
    items: list[NotebookEntryOut]
    total: int
    page: int
    page_size: int
    counts: dict[str, int]
