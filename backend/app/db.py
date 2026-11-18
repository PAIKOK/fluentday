from datetime import datetime, timezone

from pymongo import ASCENDING, MongoClient
from pymongo.database import Database

BOOK_FILES_BUCKET = "book_files"


def utcnow() -> datetime:
    """Naive UTC timestamp — what PyMongo stores and returns by default."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def as_utc(value: datetime | None) -> datetime | None:
    """Attach UTC to a stored timestamp so the API emits it with an offset."""
    if value is None:
        return None
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def connect(uri: str, db_name: str) -> tuple[MongoClient, Database]:
    client: MongoClient = MongoClient(uri, serverSelectionTimeoutMS=8000)
    client.admin.command("ping")
    return client, client[db_name]


def ensure_indexes(db: Database) -> None:
    db.users.create_index("email", unique=True)
    db.profiles.create_index("user_id", unique=True)
    db.auth_tokens.create_index("token_hash", unique=True)
    db.auth_tokens.create_index("expires_at", expireAfterSeconds=0)
    db.vocabulary_books.create_index("slot", unique=True)
    db.vocabulary_words.create_index("word_key", unique=True)
    db.vocabulary_words.create_index([("status", ASCENDING), ("word_key", ASCENDING)])
    db.vocabulary_words.create_index("needs_review")
    db.vocabulary_sources.create_index(
        [("word_id", ASCENDING), ("book_id", ASCENDING), ("page", ASCENDING)], unique=True
    )
    db.vocabulary_sources.create_index("book_id")
    db.email_outbox.create_index("created_at")
    db.daily_lessons.create_index([("user_id", ASCENDING), ("lesson_date", ASCENDING)], unique=True)
    db.user_vocabulary_progress.create_index([("user_id", ASCENDING), ("word_id", ASCENDING)], unique=True)
    db.user_vocabulary_progress.create_index([("user_id", ASCENDING), ("learned_on", ASCENDING)])
    db.job_runs.create_index([("job", ASCENDING), ("started_at", ASCENDING)])
    db.user_vocabulary_progress.create_index([("user_id", ASCENDING), ("status", ASCENDING), ("due_date", ASCENDING)])
    db.revision_logs.create_index([("user_id", ASCENDING), ("reviewed_on", ASCENDING)])
    db.notebook_entries.create_index([("user_id", ASCENDING), ("category", ASCENDING), ("updated_at", ASCENDING)])
    db.notebook_entries.create_index([("user_id", ASCENDING), ("word_id", ASCENDING)])
    db.youtube_channels.create_index("key", unique=True)
    db.youtube_videos.create_index("video_id", unique=True)
    db.youtube_videos.create_index([("channel_key", ASCENDING), ("active", ASCENDING), ("published_at", ASCENDING)])
    db.youtube_videos.create_index([("channel_key", ASCENDING), ("scheduled_for", ASCENDING)])
    db.daily_lessons.create_index("video_ids")
    db.video_progress.create_index([("user_id", ASCENDING), ("video_id", ASCENDING)], unique=True)
    db.quiz_attempts.create_index([("user_id", ASCENDING), ("quiz_date", ASCENDING), ("kind", ASCENDING)])
    db.quiz_attempts.create_index([("user_id", ASCENDING), ("result.submitted_at", ASCENDING)])
    db.pronunciation_attempts.create_index([("user_id", ASCENDING), ("practice_date", ASCENDING)])
    db.pronunciation_attempts.create_index([("user_id", ASCENDING), ("created_at", ASCENDING)])
    db.reminders.create_index([("user_id", ASCENDING), ("local_date", ASCENDING)], unique=True)
    db.reminders.create_index("created_at")
    db.notifications.create_index([("user_id", ASCENDING), ("created_at", ASCENDING)])
    db.notifications.create_index([("user_id", ASCENDING), ("read_at", ASCENDING)])
    db.push_subscriptions.create_index("endpoint", unique=True)
    db.push_subscriptions.create_index("user_id")
