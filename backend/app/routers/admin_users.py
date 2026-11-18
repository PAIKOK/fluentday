import re
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from pymongo.database import Database

from app.db import as_utc
from app.deps import get_db, require_admin
from app.schemas.profile import NotificationPreferences

router = APIRouter(prefix="/admin", tags=["admin: users"], dependencies=[Depends(require_admin)])


class OverviewOut(BaseModel):
    users_total: int
    users_verified: int
    books_ready: int
    words_total: int
    words_approved: int
    words_pending: int
    words_needing_review: int


class AdminUserOut(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    email_verified: bool
    proficiency_level: str | None
    timezone: str | None
    notifications: NotificationPreferences
    created_at: datetime
    last_login_at: datetime | None


class AdminUserPage(BaseModel):
    items: list[AdminUserOut]
    total: int
    page: int
    page_size: int


@router.get("/overview", response_model=OverviewOut)
def overview(db: Database = Depends(get_db)):
    words = db.vocabulary_words
    return OverviewOut(
        users_total=db.users.count_documents({}),
        users_verified=db.users.count_documents({"email_verified": True}),
        books_ready=db.vocabulary_books.count_documents({"status": "ready"}),
        words_total=words.count_documents({}),
        words_approved=words.count_documents({"status": "approved"}),
        words_pending=words.count_documents({"status": "pending"}),
        words_needing_review=words.count_documents({"needs_review": True, "status": "pending"}),
    )


@router.get("/users", response_model=AdminUserPage)
def list_users(
    db: Database = Depends(get_db),
    q: str | None = Query(default=None, max_length=80),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
):
    query: dict = {}
    if q and q.strip():
        query["email"] = {"$regex": re.escape(q.strip().lower())}
    total = db.users.count_documents(query)
    users = list(db.users.find(query).sort("created_at", -1).skip((page - 1) * page_size).limit(page_size))
    profiles = {p["user_id"]: p for p in db.profiles.find({"user_id": {"$in": [u["_id"] for u in users]}})}
    items = []
    for u in users:
        p = profiles.get(u["_id"], {})
        items.append(AdminUserOut(
            id=str(u["_id"]),
            email=u["email"],
            full_name=p.get("full_name", ""),
            role=u["role"],
            email_verified=u.get("email_verified", False),
            proficiency_level=p.get("proficiency_level"),
            timezone=p.get("timezone"),
            notifications=NotificationPreferences(**p.get("notifications", {})),
            created_at=as_utc(u["created_at"]),
            last_login_at=as_utc(u.get("last_login_at")),
        ))
    return AdminUserPage(items=items, total=total, page=page, page_size=page_size)
