"""What a learner did on each day (in their own timezone). Used for streaks and progress charts."""

from collections import defaultdict
from dataclasses import dataclass, fields
from datetime import date, timedelta

from bson import ObjectId
from pymongo.database import Database

from app.db import as_utc
from app.services.lessons import lesson_date_for


@dataclass
class DayActivity:
    words_learned: int = 0
    revisions: int = 0
    videos: int = 0
    quizzes: int = 0
    speaking: int = 0

    @property
    def total(self) -> int:
        return sum(getattr(self, f.name) for f in fields(self))


def activity_by_day(db: Database, user_id: ObjectId, tz_name: str | None, since: str = "") -> dict[str, DayActivity]:
    """Activity counts per YYYY-MM-DD, from `since` (inclusive) onwards."""
    days: dict[str, DayActivity] = defaultdict(DayActivity)
    for p in db.user_vocabulary_progress.find({"user_id": user_id, "learned_on": {"$gte": since or "0", "$ne": None}}, {"learned_on": 1}):
        days[p["learned_on"]].words_learned += 1
    for log in db.revision_logs.find({"user_id": user_id, "reviewed_on": {"$gte": since or "0"}}, {"reviewed_on": 1}):
        days[log["reviewed_on"]].revisions += 1
    for q in db.quiz_attempts.find({"user_id": user_id, "submitted_on": {"$gte": since or "0"}}, {"submitted_on": 1}):
        days[q["submitted_on"]].quizzes += 1
    for a in db.pronunciation_attempts.find({"user_id": user_id, "practice_date": {"$gte": since or "0"}}, {"practice_date": 1}):
        days[a["practice_date"]].speaking += 1
    for v in db.video_progress.find({"user_id": user_id, "completed": True, "completed_at": {"$ne": None}}, {"completed_at": 1}):
        day = lesson_date_for(tz_name, as_utc(v["completed_at"]))
        if day >= since:
            days[day].videos += 1
    return dict(days)


def active_dates(db: Database, user_id: ObjectId, tz_name: str | None) -> set[str]:
    return {day for day, a in activity_by_day(db, user_id, tz_name).items() if a.total}


def longest_streak(dates: set[str]) -> int:
    best = run = 0
    previous: date | None = None
    for day in sorted(date.fromisoformat(d) for d in dates):
        run = run + 1 if previous and day - previous == timedelta(days=1) else 1
        best = max(best, run)
        previous = day
    return best


def last_months(today: str, count: int) -> list[str]:
    """The last `count` months as YYYY-MM, oldest first, ending with today's month."""
    year, month = int(today[:4]), int(today[5:7])
    months = []
    for _ in range(count):
        months.append(f"{year:04d}-{month:02d}")
        year, month = (year, month - 1) if month > 1 else (year - 1, 12)
    return months[::-1]
