import re
from calendar import monthrange

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pymongo.database import Database

from app.db import utcnow
from app.deps import get_current_user, get_db, parse_object_id
from app.routers.lessons import lesson_words
from app.schemas.revision import CalendarDay, ReviewIn, ReviewOut, RevisionCalendar, RevisionQueue
from app.services.lessons import lesson_date_for
from app.services.spaced_repetition import next_schedule
from app.services.users import get_profile

router = APIRouter(prefix="/revision", tags=["revision"])

QUEUE_LIMIT = 50


def _today(db: Database, user: dict) -> str:
    return lesson_date_for(get_profile(db, user).get("timezone"))


@router.get("/queue", response_model=RevisionQueue)
def queue(user: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    today = _today(db, user)
    due = db.user_vocabulary_progress.find(
        {"user_id": user["_id"], "status": "learned", "due_date": {"$lte": today}},
        {"word_id": 1},
    ).sort([("due_date", 1), ("difficult", -1)]).limit(QUEUE_LIMIT)
    return RevisionQueue(today=today, words=lesson_words(db, user["_id"], [p["word_id"] for p in due]))


@router.post("/{word_id}", response_model=ReviewOut)
def review(word_id: str, body: ReviewIn, request: Request, user: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    oid = parse_object_id(word_id)
    progress = db.user_vocabulary_progress.find_one({"user_id": user["_id"], "word_id": oid})
    if progress is None or progress.get("status") != "learned":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Only words you have learned can be revised.")
    today = _today(db, user)
    stage_before = progress.get("srs_stage", 0)
    schedule = next_schedule(stage_before, body.rating, today, request.app.state.settings.revision_gap_days)
    changes = {"srs_stage": schedule.stage, "due_date": schedule.due_date, "last_reviewed_on": today, "updated_at": utcnow()}
    if schedule.mastered:
        changes.update(status="mastered", mastered_on=today)
    if body.rating == "difficult":
        changes["difficult"] = True
    update: dict = {"$set": changes, "$inc": {"review_count": 1}}
    if body.rating == "forgot":
        update["$inc"]["lapses"] = 1
    db.user_vocabulary_progress.update_one({"_id": progress["_id"]}, update)
    db.revision_logs.insert_one({
        "user_id": user["_id"], "word_id": oid, "rating": body.rating, "reviewed_on": today,
        "stage_before": stage_before, "stage_after": schedule.stage, "created_at": utcnow(),
    })
    return ReviewOut(word_id=word_id, stage=schedule.stage, due_date=schedule.due_date, mastered=schedule.mastered)


@router.get("/calendar", response_model=RevisionCalendar)
def calendar(
    request: Request,
    month: str | None = Query(default=None, description="YYYY-MM; defaults to the current month"),
    user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    today = _today(db, user)
    month = month or today[:7]
    if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", month):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Month must look like 2026-11.")
    year, mon = int(month[:4]), int(month[5:])
    first, last = f"{month}-01", f"{month}-{monthrange(year, mon)[1]:02d}"
    due: dict[str, int] = {}
    for p in db.user_vocabulary_progress.find({"user_id": user["_id"], "status": "learned", "due_date": {"$gte": first, "$lte": last}}, {"due_date": 1}):
        due[p["due_date"]] = due.get(p["due_date"], 0) + 1
    reviewed: dict[str, int] = {}
    for log in db.revision_logs.find({"user_id": user["_id"], "reviewed_on": {"$gte": first, "$lte": last}}, {"reviewed_on": 1}):
        reviewed[log["reviewed_on"]] = reviewed.get(log["reviewed_on"], 0) + 1
    days = [
        CalendarDay(date=f"{month}-{d:02d}", due=due.get(f"{month}-{d:02d}", 0), reviewed=reviewed.get(f"{month}-{d:02d}", 0))
        for d in range(1, monthrange(year, mon)[1] + 1)
    ]
    return RevisionCalendar(month=month, today=today, days=days, total_stages=len(request.app.state.settings.revision_gap_days))
