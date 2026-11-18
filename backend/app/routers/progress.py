from datetime import date, timedelta

from fastapi import APIRouter, Depends
from pymongo.database import Database

from app.deps import get_current_user, get_db
from app.schemas.progress import DayActivityOut, LevelCount, MonthProgress, ProgressOut
from app.services.activity import activity_by_day, last_months, longest_streak
from app.services.lessons import LEVELS, lesson_date_for, streak_days
from app.services.users import get_profile

router = APIRouter(prefix="/progress", tags=["progress"])

WEEK_DAYS = 7
MONTHS = 6


@router.get("", response_model=ProgressOut)
def progress(user: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    uid = user["_id"]
    tz = get_profile(db, user).get("timezone")
    today = lesson_date_for(tz)

    words = list(db.user_vocabulary_progress.find(
        {"user_id": uid, "status": {"$in": ["learned", "mastered"]}},
        {"word_id": 1, "status": 1, "learned_on": 1, "mastered_on": 1, "due_date": 1},
    ))
    in_revision = [p for p in words if p["status"] == "learned"]

    activity = activity_by_day(db, uid, tz)
    active = {day for day, a in activity.items() if a.total}
    week_start = date.fromisoformat(today) - timedelta(days=WEEK_DAYS - 1)
    weekly = []
    for offset in range(WEEK_DAYS):
        day = (week_start + timedelta(days=offset)).isoformat()
        a = activity.get(day)
        weekly.append(DayActivityOut(
            date=day, words_learned=a.words_learned if a else 0, revisions=a.revisions if a else 0,
            videos=a.videos if a else 0, quizzes=a.quizzes if a else 0, speaking=a.speaking if a else 0,
        ))

    monthly = []
    for month in last_months(today, MONTHS):
        monthly.append(MonthProgress(
            month=month,
            words_learned=sum(1 for p in words if (p.get("learned_on") or "").startswith(month)),
            words_mastered=sum(1 for p in words if (p.get("mastered_on") or "").startswith(month)),
            total_learned=sum(1 for p in words if p.get("learned_on") and p["learned_on"][:7] <= month),
        ))

    level_counts: dict[str | None, int] = {}
    for w in db.vocabulary_words.find({"_id": {"$in": [p["word_id"] for p in words]}}, {"level": 1}):
        level = w.get("level") if w.get("level") in LEVELS else None
        level_counts[level] = level_counts.get(level, 0) + 1

    videos = list(db.video_progress.find({"user_id": uid}, {"watched_seconds": 1, "completed": 1}))
    quiz_score = quiz_total = quizzes = 0
    for q in db.quiz_attempts.find({"user_id": uid, "result": {"$ne": None}}, {"result.score": 1, "result.total": 1}):
        quizzes += 1
        quiz_score += q["result"]["score"]
        quiz_total += q["result"]["total"]

    return ProgressOut(
        today=today,
        words_learned=len(words),
        words_mastered=len(words) - len(in_revision),
        revisions_due=sum(1 for p in in_revision if p.get("due_date") and p["due_date"] <= today),
        in_revision=len(in_revision),
        listening_minutes=sum(v.get("watched_seconds", 0) for v in videos) // 60,
        videos_completed=sum(1 for v in videos if v.get("completed")),
        quizzes_taken=quizzes,
        quiz_accuracy=round(quiz_score / quiz_total, 3) if quiz_total else None,
        speaking_attempts=db.pronunciation_attempts.count_documents({"user_id": uid}),
        streak_days=streak_days(active, today),
        longest_streak=longest_streak(active),
        weekly=weekly,
        monthly=monthly,
        levels=[LevelCount(level=lv, count=level_counts.get(lv, 0)) for lv in (*LEVELS, None)],
    )
