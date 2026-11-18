"""Daily reminders.

Run every few minutes by `scripts/run_scheduler.py`. For each learner whose reminder time has
passed today (in their timezone), it prepares today's lesson and sends one reminder through each
channel they have switched on: in-app, email and/or browser push. Nothing is sent without consent.

- One reminder per learner per day (unique index on user_id + local_date), so overlapping runs are safe.
- Learners who have already studied today are not reminded.
- Failed email or push deliveries are retried up to MAX_ATTEMPTS times, with a growing pause.
- A browser that has unsubscribed from push (HTTP 404/410) has its subscription deleted.
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from bson import ObjectId
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError

from app.config import Settings
from app.db import as_utc, utcnow
from app.mailer import send_email
from app.security import create_unsubscribe_token
from app.services.activity import activity_by_day
from app.services.lessons import DEFAULT_TIMEZONE, generate_lesson
from app.services.pronunciation import challenge_word_ids
from app.services.push import send_push
from app.services.quiz import MIN_LEARNED_WORDS

MAX_ATTEMPTS = 3
RETRY_AFTER = timedelta(minutes=10)  # × the number of attempts so far
CHANNELS = ("in_app", "email", "push")


# --- Pure helpers (no database) ---------------------------------------------


def local_now(tz_name: str | None, now: datetime) -> datetime:
    try:
        tz = ZoneInfo(tz_name or DEFAULT_TIMEZONE)
    except (ZoneInfoNotFoundError, ValueError):
        tz = ZoneInfo(DEFAULT_TIMEZONE)
    return now.astimezone(tz)


def is_due(local: datetime, reminder_time: str, window_minutes: int) -> bool:
    """True from the reminder time until `window_minutes` later, on the learner's local day."""
    hour, minute = (int(part) for part in reminder_time.split(":"))
    start = local.replace(hour=hour, minute=minute, second=0, microsecond=0)
    return start <= local < start + timedelta(minutes=window_minutes)


@dataclass(frozen=True)
class Plan:
    new_words: int
    revision_words: int
    videos: int
    speaking: bool
    quiz: bool


def greeting(hour: int) -> str:
    return "Good morning" if hour < 12 else "Good afternoon" if hour < 17 else "Good evening"


def plan_lines(plan: Plan) -> list[str]:
    lines = []
    if plan.new_words:
        lines.append(f"{plan.new_words} new word{'s' if plan.new_words != 1 else ''}")
    elif plan.revision_words:
        lines.append(f"{plan.revision_words} word{'s' if plan.revision_words != 1 else ''} to revise")
    if plan.videos:
        lines.append(f"{plan.videos} listening lesson{'s' if plan.videos != 1 else ''}")
    if plan.speaking:
        lines.append("1 pronunciation challenge")
    if plan.quiz:
        lines.append("1 daily quiz")
    return lines


def reminder_text(name: str, hour: int, plan: Plan) -> tuple[str, str]:
    """(title, body) in the spirit of: "Good morning! Your FluentDay lesson is ready. Today's plan: …"."""
    first = name.split()[0] if name.strip() else ""
    title = f"{greeting(hour)}{', ' + first if first else ''}! Your FluentDay lesson is ready."
    lines = plan_lines(plan)
    body = ("Today's plan:\n" + "\n".join(lines) + "\n\nStart learning today!") if lines else "Start learning today!"
    return title, body


# --- Database operations ----------------------------------------------------


@dataclass
class DispatchSummary:
    sent: int = 0
    skipped_active: int = 0
    retried: int = 0
    errors: list[str] = field(default_factory=list)


def _plan(db: Database, user_id: ObjectId, lesson: dict) -> Plan:
    learned = db.user_vocabulary_progress.count_documents({"user_id": user_id, "status": {"$in": ["learned", "mastered"]}})
    return Plan(
        new_words=len(lesson.get("word_ids", [])),
        revision_words=len(lesson.get("revision_word_ids", [])),
        videos=len(lesson.get("video_ids", [])),
        speaking=bool(challenge_word_ids(db, user_id, lesson)),
        quiz=learned >= MIN_LEARNED_WORDS,
    )


def _deliver_email(db: Database, settings: Settings, user: dict, title: str, body: str) -> tuple[str, str | None]:
    token = create_unsubscribe_token(str(user["_id"]), settings.jwt_secret)
    unsubscribe = f"{settings.frontend_url}/unsubscribe?token={token}"
    text = f"{title}\n\n{body}\n\nOpen FluentDay: {settings.frontend_url}/app\n\n" \
           f"You're receiving this because you turned on email reminders.\n" \
           f"Stop these emails: {unsubscribe}\nChange your reminder time: {settings.frontend_url}/app/settings\n"
    status = send_email(db, settings, user["email"], title, text, headers={"List-Unsubscribe": f"<{unsubscribe}>"})
    if status in ("sent", "logged"):
        return "sent", None
    return ("failed", "email delivery failed") if status == "failed" else ("not_configured", "SMTP is not set up")


def _deliver_push(db: Database, settings: Settings, user_id: ObjectId, title: str, body: str) -> tuple[str, str | None]:
    subscriptions = list(db.push_subscriptions.find({"user_id": user_id}))
    if not subscriptions:
        return "no_subscription", None
    outcomes, error = [], None
    for sub in subscriptions:
        outcome, err = send_push(settings, sub, {"title": title, "body": body, "url": "/app"})
        if outcome == "gone":
            db.push_subscriptions.delete_one({"_id": sub["_id"]})
        error = err or error
        outcomes.append(outcome)
    if "sent" in outcomes:
        return "sent", None
    if "failed" in outcomes:
        return "failed", error
    return ("not_configured", error) if "not_configured" in outcomes else ("no_subscription", None)


def _deliver(db: Database, settings: Settings, user: dict, channel: str, title: str, body: str) -> tuple[str, str | None]:
    if channel == "in_app":
        db.notifications.insert_one({
            "user_id": user["_id"], "kind": "daily_reminder", "title": title, "body": body, "link": "/app",
            "created_at": utcnow(), "read_at": None,
        })
        return "sent", None
    if channel == "email":
        return _deliver_email(db, settings, user, title, body)
    return _deliver_push(db, settings, user["_id"], title, body)


def _attempt(db: Database, settings: Settings, reminder: dict, user: dict, channel: str) -> str:
    status, error = _deliver(db, settings, user, channel, reminder["title"], reminder["body"])
    db.reminders.update_one({"_id": reminder["_id"]}, {
        "$set": {f"channels.{channel}.status": status, f"channels.{channel}.error": error, f"channels.{channel}.last_attempt_at": utcnow()},
        "$inc": {f"channels.{channel}.attempts": 1},
    })
    return status


def send_reminder(db: Database, settings: Settings, user: dict, profile: dict, now: datetime) -> bool:
    """Creates and sends today's reminder for one learner. Returns False if it already existed."""
    prefs = profile.get("notifications", {})
    channels = [c for c in CHANNELS if prefs.get(c, c == "in_app")]
    local = local_now(profile.get("timezone"), now)
    lesson = generate_lesson(db, user, profile, now=now, source="scheduler").lesson
    title, body = reminder_text(profile.get("full_name", ""), local.hour, _plan(db, user["_id"], lesson))
    reminder = {
        "user_id": user["_id"], "local_date": lesson["lesson_date"], "title": title, "body": body,
        "channels": {c: {"status": "pending", "attempts": 0, "error": None, "last_attempt_at": None} for c in channels},
        "created_at": utcnow(),
    }
    try:
        reminder["_id"] = db.reminders.insert_one(reminder).inserted_id
    except DuplicateKeyError:
        return False
    for channel in channels:
        _attempt(db, settings, reminder, user, channel)
    return True


def retry_failed(db: Database, settings: Settings, now: datetime) -> int:
    retried = 0
    since = now - timedelta(hours=12)
    for reminder in db.reminders.find({"created_at": {"$gte": since}}):
        user = None
        for channel, state in reminder.get("channels", {}).items():
            if state.get("status") != "failed" or state.get("attempts", 0) >= MAX_ATTEMPTS:
                continue
            last = as_utc(state.get("last_attempt_at"))
            if last and now - last < RETRY_AFTER * state.get("attempts", 1):
                continue
            user = user or db.users.find_one({"_id": reminder["user_id"], "disabled": {"$ne": True}})
            prefs = (db.profiles.find_one({"user_id": reminder["user_id"]}) or {}).get("notifications", {})
            if user is None or not prefs.get(channel):
                continue  # consent withdrawn since the first attempt
            _attempt(db, settings, reminder, user, channel)
            retried += 1
    return retried


def dispatch_reminders(db: Database, settings: Settings, now: datetime | None = None) -> DispatchSummary:
    now = now or datetime.now(timezone.utc)
    summary = DispatchSummary()
    for user in db.users.find({"email_verified": True, "disabled": {"$ne": True}}):
        profile = db.profiles.find_one({"user_id": user["_id"]})
        if not profile:
            continue
        prefs = profile.get("notifications", {})
        if not any(prefs.get(c, c == "in_app") for c in CHANNELS):
            continue
        local = local_now(profile.get("timezone"), now)
        if not is_due(local, profile.get("reminder_time", "08:00"), settings.reminder_window_minutes):
            continue
        today = local.date().isoformat()
        if db.reminders.find_one({"user_id": user["_id"], "local_date": today}, {"_id": 1}):
            continue
        try:
            done_today = activity_by_day(db, user["_id"], profile.get("timezone"), since=today).get(today)
            if done_today and done_today.total:
                summary.skipped_active += 1
                continue
            if send_reminder(db, settings, user, profile, now):
                summary.sent += 1
        except Exception as exc:  # one learner's failure must not stop the others
            summary.errors.append(f"{user['_id']}: {exc}")
    summary.retried = retry_failed(db, settings, now)
    return summary


def next_reminder(profile: dict, settings: Settings) -> dict | None:
    """What the dashboard shows: the reminder time and the channels that are switched on."""
    prefs = profile.get("notifications", {})
    channels = [c for c in CHANNELS if prefs.get(c, c == "in_app")]
    if not channels:
        return None
    if not settings.push_enabled and "push" in channels:
        channels.remove("push")
    return {"time": profile.get("reminder_time", "08:00"), "channels": channels} if channels else None
