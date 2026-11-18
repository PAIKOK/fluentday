from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.services.push import is_push_service

Channel = Literal["in_app", "email", "push"]


class NotificationOut(BaseModel):
    id: str
    kind: str
    title: str
    body: str
    link: str | None
    created_at: datetime
    read: bool


class NotificationList(BaseModel):
    items: list[NotificationOut]
    unread: int


class UnreadCount(BaseModel):
    unread: int


class PushConfig(BaseModel):
    enabled: bool
    public_key: str | None


class PushKeys(BaseModel):
    p256dh: str = Field(min_length=1, max_length=200)
    auth: str = Field(min_length=1, max_length=100)


class PushSubscriptionIn(BaseModel):
    endpoint: str = Field(max_length=1000)
    keys: PushKeys

    @field_validator("endpoint")
    @classmethod
    def known_push_service(cls, value: str) -> str:
        # Only the browsers' real push services, so the server can't be made to send requests to internal addresses.
        if not is_push_service(value):
            raise ValueError("Invalid push subscription.")
        return value


class PushUnsubscribeIn(BaseModel):
    endpoint: str = Field(max_length=1000)


class UnsubscribeIn(BaseModel):
    token: str = Field(min_length=10, max_length=500)


class NextReminder(BaseModel):
    time: str
    channels: list[Channel]
