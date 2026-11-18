"""Promote or demote a user:  python -m scripts.set_role someone@example.com admin"""

import sys

from app.config import get_settings
from app.db import connect, utcnow


def main() -> None:
    if len(sys.argv) != 3 or sys.argv[2] not in ("admin", "subscriber"):
        sys.exit("Usage: python -m scripts.set_role <email> <admin|subscriber>")
    email, role = sys.argv[1].lower(), sys.argv[2]
    settings = get_settings()
    client, db = connect(settings.mongodb_uri, settings.mongodb_db)
    with client:
        result = db.users.update_one({"email": email}, {"$set": {"role": role, "updated_at": utcnow()}})
    sys.exit(f"{email} is now {role}." if result.matched_count else f"No user with email {email}.")


if __name__ == "__main__":
    main()
