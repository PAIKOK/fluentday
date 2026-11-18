from pydantic import BaseModel

from app.schemas.common import ProficiencyLevel


class DayActivityOut(BaseModel):
    date: str
    words_learned: int
    revisions: int
    videos: int
    quizzes: int
    speaking: int


class MonthProgress(BaseModel):
    month: str
    words_learned: int
    words_mastered: int
    # Words learned by the end of this month, all time.
    total_learned: int


class LevelCount(BaseModel):
    level: ProficiencyLevel | None
    count: int


class ProgressOut(BaseModel):
    today: str
    words_learned: int
    words_mastered: int
    revisions_due: int
    in_revision: int
    listening_minutes: int
    videos_completed: int
    quizzes_taken: int
    quiz_accuracy: float | None
    speaking_attempts: int
    streak_days: int
    longest_streak: int
    weekly: list[DayActivityOut]
    monthly: list[MonthProgress]
    levels: list[LevelCount]
