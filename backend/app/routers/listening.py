from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.database import Database

from app.db import as_utc, utcnow
from app.deps import get_current_user, get_db, parse_object_id
from app.routers.lessons import today_lesson
from app.schemas.notebook import NotebookEntryOut
from app.schemas.youtube import (
    ExpressionIn,
    ListeningItem,
    ListeningToday,
    QuestionOut,
    QuizAnswersIn,
    QuizResult,
    QuizResultItem,
    VideoOut,
    VideoProgressOut,
    VideoProgressUpdate,
)
from app.services.notebook import create_entry, entry_out

router = APIRouter(prefix="/listening", tags=["listening"])

COMPLETE_AT = 0.9  # watching 90% of a video counts as completed


def video_out(video: dict, channel_names: dict[str, str]) -> VideoOut:
    return VideoOut(
        id=str(video["_id"]),
        video_id=video["video_id"],
        channel_key=video["channel_key"],
        channel_name=channel_names.get(video["channel_key"], ""),
        title=video["title"],
        thumbnail_url=video["thumbnail_url"],
        duration_seconds=video.get("duration_seconds"),
        published_at=as_utc(video.get("published_at")),
        questions=[QuestionOut(id=str(q["id"]), prompt=q["prompt"], options=q["options"]) for q in video.get("questions", [])],
    )


def progress_out(p: dict | None) -> VideoProgressOut:
    p = p or {}
    quiz = p.get("quiz")
    return VideoProgressOut(
        watched_seconds=p.get("watched_seconds", 0),
        completed=p.get("completed", False),
        completed_at=as_utc(p.get("completed_at")),
        notes=p.get("notes", ""),
        quiz=QuizResult(**{**quiz, "submitted_at": as_utc(quiz["submitted_at"])}) if quiz else None,
    )


def _assigned_video(db: Database, user: dict, video_id: str) -> dict:
    """Learners can only use videos from their own lessons."""
    oid = parse_object_id(video_id)
    if not db.daily_lessons.find_one({"user_id": user["_id"], "video_ids": oid}, {"_id": 1}):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This video isn't in your lessons.")
    video = db.youtube_videos.find_one({"_id": oid})
    if video is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This video is no longer available.")
    return video


def _progress(db: Database, user_id: ObjectId, video_id: ObjectId) -> dict | None:
    return db.video_progress.find_one({"user_id": user_id, "video_id": video_id})


@router.get("/today", response_model=ListeningToday)
def today(user: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    lesson = today_lesson(db, user)
    ids = lesson.get("video_ids", [])
    videos = {v["_id"]: v for v in db.youtube_videos.find({"_id": {"$in": ids}})}
    names = {c["key"]: c["name"] for c in db.youtube_channels.find({}, {"key": 1, "name": 1})}
    progress = {p["video_id"]: p for p in db.video_progress.find({"user_id": user["_id"], "video_id": {"$in": ids}})}
    items = [ListeningItem(video=video_out(videos[i], names), progress=progress_out(progress.get(i))) for i in ids if i in videos]
    return ListeningToday(lesson_date=lesson["lesson_date"], items=items)


@router.patch("/{video_id}/progress", response_model=VideoProgressOut)
def update_progress(video_id: str, body: VideoProgressUpdate, user: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    video = _assigned_video(db, user, video_id)
    current = _progress(db, user["_id"], video["_id"]) or {}
    changes: dict = {"updated_at": utcnow()}
    # The admin's duration wins. Otherwise use the length this learner's player reported, kept on their own
    # progress only, so no learner can change the video for everyone else.
    duration = video.get("duration_seconds") or body.duration_seconds or current.get("reported_duration")
    if body.duration_seconds and not video.get("duration_seconds"):
        changes["reported_duration"] = body.duration_seconds
    if body.position_seconds is not None:
        watched = max(current.get("watched_seconds", 0), min(body.position_seconds, duration or body.position_seconds))
        changes["watched_seconds"] = watched
        if duration and watched >= duration * COMPLETE_AT and not current.get("completed"):
            changes.update(completed=True, completed_at=utcnow())
    if body.completed is True and not current.get("completed"):
        changes.update(completed=True, completed_at=utcnow())
    elif body.completed is False:
        changes.update(completed=False, completed_at=None)
    if body.notes is not None:
        changes["notes"] = body.notes
    db.video_progress.update_one(
        {"user_id": user["_id"], "video_id": video["_id"]},
        {"$set": changes, "$setOnInsert": {"created_at": utcnow()}},
        upsert=True,
    )
    return progress_out(_progress(db, user["_id"], video["_id"]))


@router.post("/{video_id}/expressions", response_model=NotebookEntryOut, status_code=status.HTTP_201_CREATED)
def save_expression(video_id: str, body: ExpressionIn, user: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    video = _assigned_video(db, user, video_id)
    content = body.meaning.strip()
    content = f"{content}\n\nHeard in: {video['title']}" if content else f"Heard in: {video['title']}"
    entry = create_entry(db, user["_id"], category="expressions", title=" ".join(body.text.split()), content=content, tags=["listening"], video_id=video["_id"])
    return entry_out(entry)


@router.post("/{video_id}/quiz", response_model=QuizResult)
def submit_quiz(video_id: str, body: QuizAnswersIn, user: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    video = _assigned_video(db, user, video_id)
    questions = video.get("questions", [])
    if not questions:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This video has no comprehension questions.")
    if len(body.answers) != len(questions):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Please answer every question.")
    items = []
    for question, chosen in zip(questions, body.answers):
        items.append(QuizResultItem(
            question_id=str(question["id"]),
            chosen_index=chosen,
            answer_index=question["answer_index"],
            correct=chosen == question["answer_index"],
            explanation=question.get("explanation", ""),
        ))
    result = {"score": sum(i.correct for i in items), "total": len(items), "items": [i.model_dump() for i in items], "submitted_at": utcnow()}
    db.video_progress.update_one(
        {"user_id": user["_id"], "video_id": video["_id"]},
        {"$set": {"quiz": result, "updated_at": utcnow()}, "$setOnInsert": {"created_at": utcnow()}},
        upsert=True,
    )
    return QuizResult(**{**result, "submitted_at": as_utc(result["submitted_at"])})
