from fastapi import APIRouter, Depends, HTTPException, Query, status
from pymongo.database import Database

from app.db import as_utc, utcnow
from app.deps import get_current_user, get_db, parse_object_id
from app.routers.lessons import today_lesson
from app.schemas.pronunciation import AttemptIn, AttemptOut, PracticeWord, PronunciationHistory, PronunciationToday
from app.services.lessons import lesson_date_for
from app.services.pronunciation import assess, challenge_word_ids, practised_today
from app.services.users import get_profile

router = APIRouter(prefix="/pronunciation", tags=["pronunciation"])

MAX_ATTEMPTS_PER_DAY = 500


def attempt_out(a: dict) -> AttemptOut:
    return AttemptOut(
        id=str(a["_id"]), word_id=str(a["word_id"]), word=a["word"], accent=a["accent"], heard=a.get("heard"),
        recognised=a.get("recognised"), method=a["method"], practice_date=a["practice_date"], created_at=as_utc(a["created_at"]),
    )


@router.get("/today", response_model=PronunciationToday)
def today(user: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    lesson = today_lesson(db, user)
    ids = challenge_word_ids(db, user["_id"], lesson)
    words = {w["_id"]: w for w in db.vocabulary_words.find({"_id": {"$in": ids}})}
    stats = practised_today(db, user["_id"], lesson["lesson_date"], ids)
    items = [
        PracticeWord(
            id=str(i), word=words[i]["word"], part_of_speech=words[i].get("part_of_speech"),
            pronunciation=words[i].get("pronunciation"), definition=words[i].get("definition"),
            example=next((e["text"] for e in words[i].get("examples", [])), None),
            attempts_today=stats.get(i, {}).get("attempts", 0), recognised_today=stats.get(i, {}).get("recognised", False),
        )
        for i in ids if i in words
    ]
    return PronunciationToday(
        today=lesson["lesson_date"],
        accent=get_profile(db, user).get("accent", "british"),
        words=items,
        completed=bool(items) and all(w.attempts_today > 0 for w in items),
    )


@router.post("/attempts", response_model=AttemptOut, status_code=status.HTTP_201_CREATED)
def record_attempt(body: AttemptIn, user: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    word_id = parse_object_id(body.word_id)
    if not db.user_vocabulary_progress.find_one({"user_id": user["_id"], "word_id": word_id}, {"_id": 1}):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This word isn't in your lessons yet.")
    word = db.vocabulary_words.find_one({"_id": word_id}, {"word": 1})
    if word is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This word is no longer available.")
    today = lesson_date_for(get_profile(db, user).get("timezone"))
    if db.pronunciation_attempts.count_documents({"user_id": user["_id"], "practice_date": today}) >= MAX_ATTEMPTS_PER_DAY:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "That's a lot of practice for one day! Come back tomorrow.")
    result = assess(word["word"], body.transcripts, body.self_check)
    attempt = {
        "user_id": user["_id"],
        "word_id": word_id,
        "word": word["word"],
        "accent": body.accent,
        "transcripts": body.transcripts,
        "heard": result.heard,
        "recognised": result.recognised,
        "method": result.method,
        "practice_date": today,
        "created_at": utcnow(),
    }
    attempt["_id"] = db.pronunciation_attempts.insert_one(attempt).inserted_id
    return attempt_out(attempt)


@router.get("/history", response_model=PronunciationHistory)
def history(limit: int = Query(default=30, ge=1, le=100), user: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    mine = {"user_id": user["_id"]}
    return PronunciationHistory(
        items=[attempt_out(a) for a in db.pronunciation_attempts.find(mine).sort("created_at", -1).limit(limit)],
        total_attempts=db.pronunciation_attempts.count_documents(mine),
        recognised_attempts=db.pronunciation_attempts.count_documents({**mine, "recognised": True}),
        days_practised=len(db.pronunciation_attempts.distinct("practice_date", mine)),
    )
