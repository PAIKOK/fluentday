import re
from datetime import datetime
from functools import lru_cache
from zoneinfo import available_timezones

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import Accent, ProficiencyLevel, Role

TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


@lru_cache
def _timezones() -> frozenset[str]:
    return frozenset(available_timezones())


def is_valid_timezone(value: str) -> bool:
    return value in _timezones()


class NotificationPreferences(BaseModel):
    email: bool = False
    push: bool = False
    in_app: bool = True


class ProfileOut(BaseModel):
    full_name: str
    proficiency_level: ProficiencyLevel | None
    accent: Accent
    reminder_time: str
    timezone: str
    learning_goals: list[str]
    notifications: NotificationPreferences


class ProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=80)
    proficiency_level: ProficiencyLevel | None = None
    accent: Accent | None = None
    reminder_time: str | None = None
    timezone: str | None = None
    learning_goals: list[str] | None = Field(default=None, max_length=5)
    notifications: NotificationPreferences | None = None

    @field_validator("reminder_time")
    @classmethod
    def check_time(cls, value: str | None) -> str | None:
        if value is not None and not TIME_RE.match(value):
            raise ValueError("Use 24-hour HH:MM format, e.g. 08:30.")
        return value

    @field_validator("timezone")
    @classmethod
    def check_timezone(cls, value: str | None) -> str | None:
        if value is not None and not is_valid_timezone(value):
            raise ValueError("Unknown timezone.")
        return value

    @field_validator("learning_goals")
    @classmethod
    def check_goals(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        cleaned = [" ".join(g.split()) for g in value]
        if any(len(g) == 0 or len(g) > 80 for g in cleaned):
            raise ValueError("Each goal must be 1–80 characters.")
        return list(dict.fromkeys(cleaned))


class UserOut(BaseModel):
    id: str
    email: str
    role: Role
    email_verified: bool
    created_at: datetime


class MeOut(BaseModel):
    user: UserOut
    profile: ProfileOut
