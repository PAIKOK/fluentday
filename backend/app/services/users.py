from bson import ObjectId
from pymongo.database import Database

from app.db import as_utc, utcnow
from app.schemas.profile import MeOut, NotificationPreferences, ProfileOut, UserOut, is_valid_timezone

DEFAULT_TIMEZONE = "Asia/Kolkata"


def default_profile(user_id: ObjectId, full_name: str, timezone: str | None) -> dict:
    now = utcnow()
    return {
        "user_id": user_id,
        "full_name": full_name,
        "proficiency_level": None,
        "accent": "british",
        "reminder_time": "08:00",
        "timezone": timezone if timezone and is_valid_timezone(timezone) else DEFAULT_TIMEZONE,
        "learning_goals": [],
        # Email and push are opt-in: nothing is sent without explicit consent.
        "notifications": NotificationPreferences().model_dump(),
        "created_at": now,
        "updated_at": now,
    }


def get_profile(db: Database, user: dict) -> dict:
    profile = db.profiles.find_one({"user_id": user["_id"]})
    if profile is None:
        profile = default_profile(user["_id"], user["email"].split("@")[0], None)
        db.profiles.insert_one(profile)
    return profile


def profile_out(profile: dict) -> ProfileOut:
    return ProfileOut(
        full_name=profile["full_name"],
        proficiency_level=profile.get("proficiency_level"),
        accent=profile.get("accent", "british"),
        reminder_time=profile.get("reminder_time", "08:00"),
        timezone=profile.get("timezone", DEFAULT_TIMEZONE),
        learning_goals=profile.get("learning_goals", []),
        notifications=NotificationPreferences(**profile.get("notifications", {})),
    )


def user_out(user: dict) -> UserOut:
    return UserOut(
        id=str(user["_id"]),
        email=user["email"],
        role=user["role"],
        email_verified=user.get("email_verified", False),
        created_at=as_utc(user["created_at"]),
    )


def me_out(db: Database, user: dict) -> MeOut:
    return MeOut(user=user_out(user), profile=profile_out(get_profile(db, user)))
