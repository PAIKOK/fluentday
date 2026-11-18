"""Notebook entries belong to exactly one learner; every query is scoped by user_id."""

from bson import ObjectId
from fastapi import HTTPException, status
from pymongo.database import Database

from app.db import as_utc, utcnow
from app.schemas.notebook import NotebookEntryOut

CATEGORIES = ("vocabulary", "expressions", "sentences", "mistakes")


def entry_out(entry: dict) -> NotebookEntryOut:
    return NotebookEntryOut(
        id=str(entry["_id"]),
        category=entry["category"],
        title=entry["title"],
        content=entry.get("content", ""),
        tags=entry.get("tags", []),
        favourite=entry.get("favourite", False),
        word_id=str(entry["word_id"]) if entry.get("word_id") else None,
        video_id=str(entry["video_id"]) if entry.get("video_id") else None,
        created_at=as_utc(entry["created_at"]),
        updated_at=as_utc(entry["updated_at"]),
    )


MAX_ENTRIES = 5000  # per learner, so one account can't fill the database


def create_entry(db: Database, user_id: ObjectId, **fields) -> dict:
    if db.notebook_entries.count_documents({"user_id": user_id}) >= MAX_ENTRIES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Your notebook is full ({MAX_ENTRIES} notes). Delete some old notes first.")
    now = utcnow()
    entry = {
        "user_id": user_id,
        "content": "",
        "tags": [],
        "favourite": False,
        "word_id": None,
        "video_id": None,
        "created_at": now,
        "updated_at": now,
        **fields,
    }
    entry["_id"] = db.notebook_entries.insert_one(entry).inserted_id
    return entry


def save_word(db: Database, user_id: ObjectId, word: dict) -> None:
    """'Save to notebook' on a vocabulary card: one My Vocabulary entry per word."""
    if db.notebook_entries.find_one({"user_id": user_id, "category": "vocabulary", "word_id": word["_id"]}):
        return
    create_entry(
        db,
        user_id,
        category="vocabulary",
        title=word["word"],
        content=word.get("definition") or "",
        word_id=word["_id"],
    )


def unsave_word(db: Database, user_id: ObjectId, word_id: ObjectId) -> None:
    db.notebook_entries.delete_many({"user_id": user_id, "category": "vocabulary", "word_id": word_id})


def word_sentences(db: Database, user_id: ObjectId, word_ids: list[ObjectId]) -> dict[ObjectId, list[dict]]:
    """The learner's own sentences (My Sentences entries) for each word."""
    grouped: dict[ObjectId, list[dict]] = {wid: [] for wid in word_ids}
    query = {"user_id": user_id, "category": "sentences", "word_id": {"$in": word_ids}}
    for entry in db.notebook_entries.find(query).sort("created_at", 1):
        grouped.setdefault(entry["word_id"], []).append(entry)
    return grouped


def category_counts(db: Database, user_id: ObjectId) -> dict[str, int]:
    return {c: db.notebook_entries.count_documents({"user_id": user_id, "category": c}) for c in CATEGORIES}
