"""The background job: prepares daily lessons and sends reminders.

    python -m scripts.run_scheduler          # run once (e.g. from cron every 5 minutes)
    python -m scripts.run_scheduler --loop   # keep running, checking every 5 minutes

Both modes are safe to overlap: lessons and reminders are created at most once per learner per day.
"""

import argparse
import logging
import time
from datetime import timedelta

from app.config import get_settings
from app.db import connect, ensure_indexes, utcnow
from app.services.lessons import generate_for_all_users
from app.services.reminders import dispatch_reminders

INTERVAL_SECONDS = 300
logger = logging.getLogger("fluentday.scheduler")


def run_once(db, settings) -> None:
    # Prepare everyone's lesson in advance about once an hour (each learner's day starts at their own midnight).
    if not db.job_runs.find_one({"job": "generate_daily_lessons", "started_at": {"$gte": utcnow() - timedelta(minutes=55)}}):
        lessons = generate_for_all_users(db)
        logger.info("Lessons created: %d, already prepared: %d, failed: %d", lessons.created, lessons.existing, lessons.failed)
    summary = dispatch_reminders(db, settings)
    logger.info("Reminders sent: %d, skipped (already studied today): %d, retries: %d", summary.sent, summary.skipped_active, summary.retried)
    for error in summary.errors:
        logger.error("  %s", error)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--loop", action="store_true", help=f"run every {INTERVAL_SECONDS // 60} minutes until stopped")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    settings = get_settings()
    client, db = connect(settings.mongodb_uri, settings.mongodb_db)
    with client:
        ensure_indexes(db)
        while True:
            try:
                run_once(db, settings)
            except Exception:  # keep the loop alive through a temporary database outage
                logger.exception("Scheduler run failed")
                if not args.loop:
                    raise
            if not args.loop:
                break
            time.sleep(INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
