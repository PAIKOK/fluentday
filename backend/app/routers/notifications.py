from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pymongo.database import Database

from app.config import Settings
from app.db import as_utc, utcnow
from app.deps import client_ip, get_app_settings, get_current_user, get_db, parse_object_id
from app.schemas.auth import MessageOut
from app.schemas.notifications import (
    NotificationList,
    NotificationOut,
    PushConfig,
    PushSubscriptionIn,
    PushUnsubscribeIn,
    UnreadCount,
    UnsubscribeIn,
)
from app.security import read_unsubscribe_token

router = APIRouter(prefix="/notifications", tags=["notifications"])

MAX_PUSH_SUBSCRIPTIONS = 10  # per learner (one per browser/device)


def notification_out(n: dict) -> NotificationOut:
    return NotificationOut(
        id=str(n["_id"]), kind=n["kind"], title=n["title"], body=n["body"], link=n.get("link"),
        created_at=as_utc(n["created_at"]), read=n.get("read_at") is not None,
    )


def _unread(db: Database, user_id) -> int:
    return db.notifications.count_documents({"user_id": user_id, "read_at": None})


@router.get("", response_model=NotificationList)
def list_notifications(limit: int = Query(default=30, ge=1, le=100), user: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    items = db.notifications.find({"user_id": user["_id"]}).sort("created_at", -1).limit(limit)
    return NotificationList(items=[notification_out(n) for n in items], unread=_unread(db, user["_id"]))


@router.get("/unread-count", response_model=UnreadCount)
def unread_count(user: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    return UnreadCount(unread=_unread(db, user["_id"]))


@router.post("/read-all", response_model=UnreadCount)
def read_all(user: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    db.notifications.update_many({"user_id": user["_id"], "read_at": None}, {"$set": {"read_at": utcnow()}})
    return UnreadCount(unread=0)


@router.post("/{notification_id}/read", response_model=NotificationOut)
def read_one(notification_id: str, user: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    query = {"_id": parse_object_id(notification_id), "user_id": user["_id"]}
    db.notifications.update_one({**query, "read_at": None}, {"$set": {"read_at": utcnow()}})
    n = db.notifications.find_one(query)
    if n is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found.")
    return notification_out(n)


@router.get("/push/config", response_model=PushConfig)
def push_config(settings: Settings = Depends(get_app_settings)):
    return PushConfig(enabled=settings.push_enabled, public_key=settings.vapid_public_key or None)


@router.post("/push/subscriptions", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
def add_push_subscription(
    body: PushSubscriptionIn,
    user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
    settings: Settings = Depends(get_app_settings),
):
    if not settings.push_enabled:
        raise HTTPException(status.HTTP_409_CONFLICT, "Push notifications aren't set up on this server.")
    existing = db.push_subscriptions.find_one({"endpoint": body.endpoint})
    if existing is None and db.push_subscriptions.count_documents({"user_id": user["_id"]}) >= MAX_PUSH_SUBSCRIPTIONS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Too many devices have push turned on. Turn it off on one first.")
    # An endpoint belongs to one browser; if another account used this browser before, it moves to this one.
    db.push_subscriptions.update_one(
        {"endpoint": body.endpoint},
        {"$set": {"user_id": user["_id"], "keys": body.keys.model_dump(), "updated_at": utcnow()}, "$setOnInsert": {"created_at": utcnow()}},
        upsert=True,
    )
    db.profiles.update_one({"user_id": user["_id"]}, {"$set": {"notifications.push": True, "updated_at": utcnow()}})
    return MessageOut(message="Push reminders are on for this browser.")


@router.post("/push/unsubscribe", response_model=MessageOut)
def remove_push_subscription(body: PushUnsubscribeIn, user: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    db.push_subscriptions.delete_one({"endpoint": body.endpoint, "user_id": user["_id"]})
    if db.push_subscriptions.count_documents({"user_id": user["_id"]}) == 0:
        db.profiles.update_one({"user_id": user["_id"]}, {"$set": {"notifications.push": False, "updated_at": utcnow()}})
    return MessageOut(message="Push reminders are off for this browser.")


@router.post("/unsubscribe", response_model=MessageOut)
def unsubscribe(body: UnsubscribeIn, request: Request, db: Database = Depends(get_db), settings: Settings = Depends(get_app_settings)):
    """One-click email unsubscribe from the link in every reminder email. No login needed."""
    request.app.state.rate_limiters["email"].check(f"unsubscribe:{client_ip(request)}")
    user_id = read_unsubscribe_token(body.token, settings.jwt_secret)
    if user_id is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This unsubscribe link isn't valid. You can turn off emails in Settings.")
    db.profiles.update_one({"user_id": parse_object_id(user_id)}, {"$set": {"notifications.email": False, "updated_at": utcnow()}})
    return MessageOut(message="You won't receive reminder emails any more.")
