from fastapi import APIRouter, Depends, HTTPException, Query, status
from pymongo import ReturnDocument
from pymongo.database import Database

from app.db import as_utc, utcnow
from app.deps import get_current_user, get_db, parse_object_id
from app.schemas.quiz import (
    QuestionResult,
    QuizAttemptOut,
    QuizHistory,
    QuizHistoryItem,
    QuizQuestionOut,
    QuizResult,
    QuizSubmit,
    QuizToday,
)
from app.services.lessons import lesson_date_for
from app.services.quiz import MIN_LEARNED_WORDS, build_quiz, correct_answer_text, distractor_pool, grade, learned_word_docs
from app.services.users import get_profile

router = APIRouter(prefix="/quiz", tags=["quiz"])

PRACTICE_PER_DAY = 10
PUBLIC_FIELDS = ("id", "type", "prompt", "sentence", "hint", "speak_text", "items", "options")


def attempt_out(attempt: dict) -> QuizAttemptOut:
    result = attempt.get("result")
    return QuizAttemptOut(
        id=str(attempt["_id"]),
        quiz_date=attempt["quiz_date"],
        kind=attempt["kind"],
        # Answers and explanations stay on the server until the quiz is submitted.
        questions=[QuizQuestionOut(**{k: q[k] for k in PUBLIC_FIELDS if k in q}) for q in attempt["questions"]],
        result=QuizResult(**{**result, "submitted_at": as_utc(result["submitted_at"])}) if result else None,
    )


def _today(db: Database, user: dict) -> str:
    return lesson_date_for(get_profile(db, user).get("timezone"))


def _new_attempt(db: Database, user: dict, today: str, kind: str, seed: str) -> dict | None:
    learned = learned_word_docs(db, user["_id"])
    if len(learned) < MIN_LEARNED_WORDS:
        return None
    questions = build_quiz(learned, distractor_pool(db, user["_id"]), seed=seed)
    return {"user_id": user["_id"], "quiz_date": today, "kind": kind, "questions": questions, "result": None, "created_at": utcnow()}


@router.get("/today", response_model=QuizToday)
def today(user: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    day = _today(db, user)
    learned_count = db.user_vocabulary_progress.count_documents({"user_id": user["_id"], "status": {"$in": ["learned", "mastered"]}})
    attempt = db.quiz_attempts.find_one({"user_id": user["_id"], "quiz_date": day, "kind": "daily"})
    if attempt is None:
        doc = _new_attempt(db, user, day, "daily", seed=f"{user['_id']}:{day}")
        if doc:
            # Upsert so two tabs opening the quiz at once still share one daily quiz.
            attempt = db.quiz_attempts.find_one_and_update(
                {"user_id": user["_id"], "quiz_date": day, "kind": "daily"},
                {"$setOnInsert": doc},
                upsert=True,
                return_document=ReturnDocument.AFTER,
            )
    return QuizToday(today=day, learned_words=learned_count, min_words=MIN_LEARNED_WORDS, attempt=attempt_out(attempt) if attempt else None)


@router.post("/practice", response_model=QuizAttemptOut, status_code=status.HTTP_201_CREATED)
def practice(user: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    day = _today(db, user)
    count = db.quiz_attempts.count_documents({"user_id": user["_id"], "quiz_date": day, "kind": "practice"})
    if count >= PRACTICE_PER_DAY:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, f"You've done {PRACTICE_PER_DAY} practice quizzes today. Come back tomorrow!")
    doc = _new_attempt(db, user, day, "practice", seed=f"{user['_id']}:{day}:practice:{count}")
    if doc is None:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Learn at least {MIN_LEARNED_WORDS} words to unlock quizzes.")
    doc["_id"] = db.quiz_attempts.insert_one(doc).inserted_id
    return attempt_out(doc)


@router.get("/history", response_model=QuizHistory)
def history(limit: int = Query(default=20, ge=1, le=100), user: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    submitted = {"user_id": user["_id"], "result": {"$ne": None}}
    items = [
        QuizHistoryItem(
            id=str(a["_id"]), quiz_date=a["quiz_date"], kind=a["kind"], score=a["result"]["score"],
            total=a["result"]["total"], submitted_at=as_utc(a["result"]["submitted_at"]),
        )
        for a in db.quiz_attempts.find(submitted, {"questions": 0}).sort("result.submitted_at", -1).limit(limit)
    ]
    score = total = taken = 0
    for a in db.quiz_attempts.find(submitted, {"result.score": 1, "result.total": 1}):
        taken += 1
        score += a["result"]["score"]
        total += a["result"]["total"]
    return QuizHistory(items=items, quizzes_taken=taken, accuracy=round(score / total, 3) if total else None)


def _own_attempt(db: Database, user: dict, attempt_id: str) -> dict:
    attempt = db.quiz_attempts.find_one({"_id": parse_object_id(attempt_id), "user_id": user["_id"]})
    if attempt is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Quiz not found.")
    return attempt


@router.get("/{attempt_id}", response_model=QuizAttemptOut)
def get_attempt(attempt_id: str, user: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    return attempt_out(_own_attempt(db, user, attempt_id))


@router.post("/{attempt_id}/submit", response_model=QuizAttemptOut)
def submit(attempt_id: str, body: QuizSubmit, user: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    attempt = _own_attempt(db, user, attempt_id)
    if attempt.get("result"):
        raise HTTPException(status.HTTP_409_CONFLICT, "This quiz has already been submitted.")
    questions = attempt["questions"]
    if len(body.answers) != len(questions):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Please answer every question.")
    items = [
        QuestionResult(
            question_id=q["id"], correct=grade(q, response), response=response,
            correct_answer=correct_answer_text(q), explanation=q["explanation"],
        )
        for q, response in zip(questions, body.answers)
    ]
    result = {"score": sum(i.correct for i in items), "total": len(items), "items": [i.model_dump() for i in items], "submitted_at": utcnow()}
    updated = db.quiz_attempts.find_one_and_update(
        {"_id": attempt["_id"], "result": None},
        {"$set": {"result": result, "submitted_on": _today(db, user)}},
        return_document=ReturnDocument.AFTER,
    )
    if updated is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "This quiz has already been submitted.")
    return attempt_out(updated)
