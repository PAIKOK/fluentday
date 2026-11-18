"""Prepares today's lesson for every active learner. Safe to run repeatedly (idempotent).

    python -m scripts.generate_daily_lessons

`scripts.run_scheduler` also prepares each learner's lesson when their reminder is sent.
"""

from app.config import get_settings
from app.db import connect, ensure_indexes
from app.services.lessons import generate_for_all_users


def main() -> None:
    settings = get_settings()
    client, db = connect(settings.mongodb_uri, settings.mongodb_db)
    with client:
        ensure_indexes(db)
        summary = generate_for_all_users(db)
    print(f"Created {summary.created}, already existed {summary.existing}, failed {summary.failed}.")
    for error in summary.errors:
        print("  ", error)


if __name__ == "__main__":
    main()
