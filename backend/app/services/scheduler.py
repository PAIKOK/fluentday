"""One scheduler run: prepares daily lessons (about hourly) and sends due reminders.

Called by scripts/run_scheduler.py (cron or --loop) and by POST /api/internal/run-scheduler,
which a free GitHub Actions job calls every 10 minutes in production. Overlapping runs are safe.
"""

import logging
from datetime import timedelta

from pymongo.database import Database

from app.config import Settings
from app.db import utcnow
from app.services.lessons import generate_for_all_users
from app.services.reminders import dispatch_reminders

logger = logging.getLogger("fluentday.scheduler")


def run_once(db: Database, settings: Settings) -> dict:
    result: dict = {"lessons_created": 0}
    # Prepare everyone's lesson in advance about once an hour (each learner's day starts at their own midnight).
    if not db.job_runs.find_one({"job": "generate_daily_lessons", "started_at": {"$gte": utcnow() - timedelta(minutes=55)}}):
        lessons = generate_for_all_users(db)
        logger.info("Lessons created: %d, already prepared: %d, failed: %d", lessons.created, lessons.existing, lessons.failed)
        result["lessons_created"] = lessons.created
    summary = dispatch_reminders(db, settings)
    logger.info("Reminders sent: %d, skipped (already studied today): %d, retries: %d", summary.sent, summary.skipped_active, summary.retried)
    for error in summary.errors:
        logger.error("  %s", error)
    result.update(reminders_sent=summary.sent, skipped_active=summary.skipped_active, retried=summary.retried, errors=len(summary.errors))
    return result
