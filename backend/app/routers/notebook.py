import re

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pymongo import ReturnDocument
from pymongo.database import Database

from app.db import utcnow
from app.deps import get_current_user, get_db, parse_object_id
from app.schemas.notebook import NotebookCategory, NotebookEntryIn, NotebookEntryOut, NotebookEntryUpdate, NotebookPage
from app.services.lessons import lesson_date_for
from app.services.notebook import category_counts, create_entry, entry_out
from app.services.notebook_pdf import build_notebook_pdf
from app.services.users import get_profile

router = APIRouter(prefix="/notebook", tags=["notebook"])


def _query(user: dict, category: str | None, q: str | None, tag: str | None, favourite: bool | None) -> dict:
    query: dict = {"user_id": user["_id"]}
    if category:
        query["category"] = category
    if q and q.strip():
        pattern = {"$regex": re.escape(q.strip()), "$options": "i"}
        query["$or"] = [{"title": pattern}, {"content": pattern}, {"tags": pattern}]
    if tag:
        query["tags"] = tag.lower()
    if favourite is not None:
        query["favourite"] = favourite
    return query


def _owned(db: Database, user: dict, entry_id: str) -> dict:
    entry = db.notebook_entries.find_one({"_id": parse_object_id(entry_id), "user_id": user["_id"]})
    if entry is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Note not found.")
    return entry


@router.get("", response_model=NotebookPage)
def list_entries(
    user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
    category: NotebookCategory | None = None,
    q: str | None = Query(default=None, max_length=80),
    tag: str | None = Query(default=None, max_length=30),
    favourite: bool | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    query = _query(user, category, q, tag, favourite)
    total = db.notebook_entries.count_documents(query)
    entries = db.notebook_entries.find(query).sort([("favourite", -1), ("updated_at", -1)]).skip((page - 1) * page_size).limit(page_size)
    return NotebookPage(items=[entry_out(e) for e in entries], total=total, page=page, page_size=page_size, counts=category_counts(db, user["_id"]))


@router.get("/tags", response_model=list[str])
def list_tags(user: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    return sorted(db.notebook_entries.distinct("tags", {"user_id": user["_id"]}))


@router.get("/export.pdf")
def export_pdf(
    user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
    category: NotebookCategory | None = None,
):
    query = _query(user, category, None, None, None)
    entries = list(db.notebook_entries.find(query).sort([("favourite", -1), ("updated_at", -1)]).limit(2000))
    profile = get_profile(db, user)
    today = lesson_date_for(profile.get("timezone"))
    pdf = build_notebook_pdf(profile["full_name"], entries, today)
    return Response(
        pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="fluentday-notebook-{today}.pdf"',
            "Cache-Control": "private, no-store",
        },
    )


@router.post("", response_model=NotebookEntryOut, status_code=status.HTTP_201_CREATED)
def create(body: NotebookEntryIn, user: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    if db.notebook_entries.count_documents({"user_id": user["_id"]}) >= 5000:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Your notebook is full (5,000 notes). Delete some notes first.")
    return entry_out(create_entry(db, user["_id"], **body.model_dump()))


@router.patch("/{entry_id}", response_model=NotebookEntryOut)
def update(entry_id: str, body: NotebookEntryUpdate, user: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    entry = _owned(db, user, entry_id)
    changes = body.model_dump(exclude_unset=True, exclude_none=True)
    if "title" in changes and not changes["title"]:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Please add a title.")
    changes["updated_at"] = utcnow()
    updated = db.notebook_entries.find_one_and_update({"_id": entry["_id"]}, {"$set": changes}, return_document=ReturnDocument.AFTER)
    if "category" in changes and changes["category"] != "vocabulary" and entry.get("category") == "vocabulary" and entry.get("word_id"):
        db.user_vocabulary_progress.update_one({"user_id": user["_id"], "word_id": entry["word_id"]}, {"$set": {"saved": False}})
    return entry_out(updated)


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(entry_id: str, user: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    entry = _owned(db, user, entry_id)
    db.notebook_entries.delete_one({"_id": entry["_id"]})
    if entry.get("category") == "vocabulary" and entry.get("word_id"):
        # Keeps the "Saved to notebook" button on the word card in sync.
        db.user_vocabulary_progress.update_one({"user_id": user["_id"], "word_id": entry["word_id"]}, {"$set": {"saved": False}})
