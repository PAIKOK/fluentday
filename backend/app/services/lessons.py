"""Daily lesson generation.

Each learner gets one lesson per day, dated by their own timezone. A lesson holds up to seven
approved words the learner has never been given before, preferring their proficiency level.
Generating the same day twice returns the existing lesson (idempotent).
"""

import random
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from bson import ObjectId
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError

from app.db import utcnow
from app.services.youtube import pick_lesson_videos

DAILY_WORD_COUNT = 7
LEVELS = ("beginner", "intermediate", "advanced")
DEFAULT_TIMEZONE = "Asia/Kolkata"


# --- Pure helpers (no database) ---------------------------------------------


def lesson_date_for(tz_name: str | None, now: datetime | None = None) -> str:
    """The learner's local calendar date as YYYY-MM-DD."""
    try:
        tz = ZoneInfo(tz_name or DEFAULT_TIMEZONE)
    except (ZoneInfoNotFoundError, ValueError):
        tz = ZoneInfo(DEFAULT_TIMEZONE)
    now = now or datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    return now.astimezone(tz).date().isoformat()


def level_preference(level: str | None) -> list[str | None]:
    """Order in which word levels are tried: the learner's level, then words without a level,
    then the nearest other levels (easier first on a tie)."""
    own = level if level in LEVELS else "beginner"
    i = LEVELS.index(own)
    others = sorted((lv for lv in LEVELS if lv != own), key=lambda lv: (abs(LEVELS.index(lv) - i), LEVELS.index(lv)))
    return [own, None, *others]


def choose_words(candidates: list[tuple[ObjectId, str | None]], level: str | None, count: int, seed: str) -> list[ObjectId]:
    """Picks `count` word ids from (id, level) candidates, following level_preference.
    The order within a level is shuffled with a fixed seed, so results are reproducible."""
    rng = random.Random(seed)
    groups: dict[str | None, list[ObjectId]] = {}
    for word_id, word_level in sorted(candidates, key=lambda c: str(c[0])):
        groups.setdefault(word_level if word_level in LEVELS else None, []).append(word_id)
    chosen: list[ObjectId] = []
    for lv in level_preference(level):
        group = groups.get(lv, [])
        rng.shuffle(group)
        chosen.extend(group[: count - len(chosen)])
        if len(chosen) >= count:
            break
    return chosen


def streak_days(active_dates: set[str], today: str) -> int:
    """Consecutive days with learning activity, ending today (or yesterday, if today isn't done yet)."""
    day = date.fromisoformat(today)
    if today not in active_dates:
        day -= timedelta(days=1)
    count = 0
    while day.isoformat() in active_dates:
        count += 1
        day -= timedelta(days=1)
    return count


# --- Database operations ----------------------------------------------------


@dataclass
class GenerationResult:
    lesson: dict
    created: bool


@dataclass
class JobSummary:
    created: int = 0
    existing: int = 0
    failed: int = 0
    errors: list[str] = field(default_factory=list)


def _eligible_new_words(db: Database, user_id: ObjectId) -> list[tuple[ObjectId, str | None]]:
    assigned = db.user_vocabulary_progress.distinct("word_id", {"user_id": user_id})
    cursor = db.vocabulary_words.find(
        {"status": "approved", "definition": {"$nin": [None, ""]}, "_id": {"$nin": assigned}},
        {"_id": 1, "level": 1},
    )
    return [(w["_id"], w.get("level")) for w in cursor]


def _revision_words(db: Database, user_id: ObjectId, count: int, exclude: list[ObjectId], lesson_date: str) -> list[ObjectId]:
    """Words the learner has already met, for revision: words due by the spaced-repetition schedule first,
    then difficult ones, then the longest ago. Mastered words are left alone."""
    if count <= 0:
        return []
    cursor = db.user_vocabulary_progress.find(
        {"user_id": user_id, "status": {"$ne": "mastered"}, "word_id": {"$nin": exclude}},
        {"word_id": 1, "difficult": 1, "first_lesson_date": 1, "due_date": 1},
    )

    def priority(p: dict) -> tuple:
        due = p.get("due_date")
        return (not (due is not None and due <= lesson_date), not p.get("difficult", False), due or "9999", p.get("first_lesson_date", ""))

    return [p["word_id"] for p in sorted(cursor, key=priority)[:count]]


def generate_lesson(db: Database, user: dict, profile: dict, now: datetime | None = None, source: str = "on_demand") -> GenerationResult:
    tz_name = profile.get("timezone") or DEFAULT_TIMEZONE
    lesson_date = lesson_date_for(tz_name, now)
    existing = db.daily_lessons.find_one({"user_id": user["_id"], "lesson_date": lesson_date})
    if existing:
        return GenerationResult(existing, created=False)

    level = profile.get("proficiency_level")
    new_ids = choose_words(_eligible_new_words(db, user["_id"]), level, DAILY_WORD_COUNT, f"{user['_id']}:{lesson_date}")
    # When the new-word pool runs low, the rest of the day is filled with revision instead of repeats.
    revision_ids = _revision_words(db, user["_id"], DAILY_WORD_COUNT - len(new_ids), exclude=new_ids, lesson_date=lesson_date)
    kind = "new" if new_ids else ("revision" if revision_ids else "empty")

    lesson = {
        "user_id": user["_id"],
        "lesson_date": lesson_date,
        "timezone": tz_name,
        "kind": kind,
        "level": level,
        "word_ids": new_ids,
        "revision_word_ids": revision_ids,
        "video_ids": pick_lesson_videos(db, user["_id"], lesson_date),
        "source": source,
        "created_at": utcnow(),
    }
    try:
        lesson["_id"] = db.daily_lessons.insert_one(lesson).inserted_id
    except DuplicateKeyError:
        # Another request created today's lesson at the same moment.
        return GenerationResult(db.daily_lessons.find_one({"user_id": user["_id"], "lesson_date": lesson_date}), created=False)

    now_ts = utcnow()
    for word_id in new_ids:
        db.user_vocabulary_progress.update_one(
            {"user_id": user["_id"], "word_id": word_id},
            {"$setOnInsert": {
                "first_lesson_date": lesson_date,
                "lesson_id": lesson["_id"],
                "status": "new",
                "difficult": False,
                "saved": False,
                "learned_on": None,
                "srs_stage": 0,
                "due_date": None,
                "created_at": now_ts,
                "updated_at": now_ts,
            }},
            upsert=True,
        )
    return GenerationResult(lesson, created=True)


def attach_videos(db: Database, lesson: dict) -> dict:
    """Lessons created before any videos were added get today's videos the next time they're opened."""
    if lesson.get("video_ids"):
        return lesson
    video_ids = pick_lesson_videos(db, lesson["user_id"], lesson["lesson_date"])
    if video_ids:
        db.daily_lessons.update_one({"_id": lesson["_id"], "video_ids": []}, {"$set": {"video_ids": video_ids}})
        lesson = db.daily_lessons.find_one({"_id": lesson["_id"]})
    return lesson


def generate_for_all_users(db: Database, now: datetime | None = None) -> JobSummary:
    """The scheduled daily job: prepares today's lesson for every active learner."""
    summary = JobSummary()
    started = utcnow()
    users = db.users.find({"disabled": {"$ne": True}})
    for user in users:
        profile = db.profiles.find_one({"user_id": user["_id"]}) or {}
        try:
            result = generate_lesson(db, user, profile, now=now, source="scheduler")
            if result.created:
                summary.created += 1
            else:
                summary.existing += 1
        except Exception as exc:  # one learner's failure must not stop the others
            summary.failed += 1
            summary.errors.append(f"{user['_id']}: {exc}")
    db.job_runs.insert_one({
        "job": "generate_daily_lessons",
        "started_at": started,
        "finished_at": utcnow(),
        "created": summary.created,
        "existing": summary.existing,
        "failed": summary.failed,
        "errors": summary.errors[:50],
    })
    return summary
