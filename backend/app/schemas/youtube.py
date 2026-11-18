import re
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

ChannelKey = Literal["tv_series", "bbc_6min"]


class QuestionIn(BaseModel):
    prompt: str = Field(min_length=3, max_length=300)
    options: list[str] = Field(min_length=2, max_length=4)
    answer_index: int = Field(ge=0, le=3)
    explanation: str = Field(default="", max_length=500)

    @model_validator(mode="after")
    def check(self) -> "QuestionIn":
        self.options = [" ".join(o.split()) for o in self.options]
        if any(not o or len(o) > 150 for o in self.options):
            raise ValueError("Each option must be 1–150 characters.")
        if self.answer_index >= len(self.options):
            raise ValueError("The correct answer must be one of the options.")
        return self


class QuestionAdminOut(QuestionIn):
    id: str


class QuestionOut(BaseModel):
    """What learners see before answering — no correct answer."""
    id: str
    prompt: str
    options: list[str]


class ChannelOut(BaseModel):
    key: ChannelKey
    name: str
    url: str
    channel_id: str
    title_filter: str
    active: bool
    last_imported_at: datetime | None


class ChannelUpdate(BaseModel):
    url: str | None = Field(default=None, max_length=300)
    channel_id: str | None = Field(default=None, max_length=30)
    title_filter: str | None = Field(default=None, max_length=80)
    active: bool | None = None

    @field_validator("url")
    @classmethod
    def check_url(cls, value: str | None) -> str | None:
        if value and not re.match(r"^https://(www\.)?youtube\.com/", value.strip()):
            raise ValueError("Use the channel's https://www.youtube.com/… address.")
        return value.strip() if value is not None else None

    @field_validator("channel_id")
    @classmethod
    def check_channel_id(cls, value: str | None) -> str | None:
        if value and not re.match(r"^UC[A-Za-z0-9_-]{22}$", value.strip()):
            raise ValueError("A channel ID starts with “UC” and is 24 characters long.")
        return value.strip() if value is not None else None


class VideoAdminOut(BaseModel):
    id: str
    video_id: str
    channel_key: ChannelKey
    title: str
    thumbnail_url: str
    duration_seconds: int | None
    published_at: datetime | None
    active: bool
    scheduled_for: str | None
    questions: list[QuestionAdminOut]
    source: str
    times_assigned: int


class VideoPage(BaseModel):
    items: list[VideoAdminOut]
    total: int
    page: int
    page_size: int


class VideoCreate(BaseModel):
    url: str = Field(min_length=5, max_length=300)
    channel_key: ChannelKey
    title: str | None = Field(default=None, max_length=200)
    duration_seconds: int | None = Field(default=None, ge=1, le=21600)
    published_at: date | None = None


class VideoUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    duration_seconds: int | None = Field(default=None, ge=1, le=21600)
    active: bool | None = None
    scheduled_for: date | None = None
    clear_schedule: bool = False
    questions: list[QuestionIn] | None = Field(default=None, max_length=5)


class VideoOut(BaseModel):
    id: str
    video_id: str
    channel_key: ChannelKey
    channel_name: str
    title: str
    thumbnail_url: str
    duration_seconds: int | None
    published_at: datetime | None
    questions: list[QuestionOut]


class QuizResultItem(BaseModel):
    question_id: str
    chosen_index: int | None
    answer_index: int
    correct: bool
    explanation: str


class QuizResult(BaseModel):
    score: int
    total: int
    items: list[QuizResultItem]
    submitted_at: datetime


class VideoProgressOut(BaseModel):
    watched_seconds: int
    completed: bool
    completed_at: datetime | None
    notes: str
    quiz: QuizResult | None


class ListeningItem(BaseModel):
    video: VideoOut
    progress: VideoProgressOut


class ListeningToday(BaseModel):
    lesson_date: str
    items: list[ListeningItem]


class VideoProgressUpdate(BaseModel):
    position_seconds: int | None = Field(default=None, ge=0, le=21600)
    duration_seconds: int | None = Field(default=None, ge=1, le=21600)
    completed: bool | None = None
    notes: str | None = Field(default=None, max_length=10000)


class ExpressionIn(BaseModel):
    text: str = Field(min_length=2, max_length=200)
    meaning: str = Field(default="", max_length=1000)


class QuizAnswersIn(BaseModel):
    answers: list[int | None] = Field(max_length=5)
