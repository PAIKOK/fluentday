from pydantic import BaseModel

from app.schemas.lessons import LessonWord
from app.services.spaced_repetition import Rating


class ReviewIn(BaseModel):
    rating: Rating


class ReviewOut(BaseModel):
    word_id: str
    stage: int
    due_date: str | None
    mastered: bool


class RevisionQueue(BaseModel):
    today: str
    words: list[LessonWord]


class CalendarDay(BaseModel):
    date: str
    due: int
    reviewed: int


class RevisionCalendar(BaseModel):
    month: str
    today: str
    days: list[CalendarDay]
    total_stages: int
