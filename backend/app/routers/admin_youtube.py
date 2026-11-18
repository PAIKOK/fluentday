from datetime import datetime

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pymongo import ReturnDocument
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError

from app.db import as_utc, utcnow
from app.deps import get_db, parse_object_id, require_admin
from app.schemas.youtube import (
    ChannelKey,
    ChannelOut,
    ChannelUpdate,
    QuestionAdminOut,
    VideoAdminOut,
    VideoCreate,
    VideoPage,
    VideoUpdate,
)
from app.services.youtube import YouTubeError, ensure_channels, fetch_title, import_channel, new_video_doc, parse_video_id

router = APIRouter(prefix="/admin/youtube", tags=["admin: youtube"], dependencies=[Depends(require_admin)])


def channel_out(c: dict) -> ChannelOut:
    return ChannelOut(
        key=c["key"], name=c["name"], url=c.get("url", ""), channel_id=c.get("channel_id", ""),
        title_filter=c.get("title_filter", ""), active=c.get("active", True), last_imported_at=as_utc(c.get("last_imported_at")),
    )


def video_admin_out(db: Database, v: dict) -> VideoAdminOut:
    return VideoAdminOut(
        id=str(v["_id"]),
        video_id=v["video_id"],
        channel_key=v["channel_key"],
        title=v["title"],
        thumbnail_url=v["thumbnail_url"],
        duration_seconds=v.get("duration_seconds"),
        published_at=as_utc(v.get("published_at")),
        active=v.get("active", True),
        scheduled_for=v.get("scheduled_for"),
        questions=[QuestionAdminOut(id=str(q["id"]), prompt=q["prompt"], options=q["options"], answer_index=q["answer_index"], explanation=q.get("explanation", "")) for q in v.get("questions", [])],
        source=v.get("source", "manual"),
        times_assigned=db.daily_lessons.count_documents({"video_ids": v["_id"]}),
    )


def _channel(db: Database, key: ChannelKey) -> dict:
    ensure_channels(db)
    return db.youtube_channels.find_one({"key": key})


@router.get("/channels", response_model=list[ChannelOut])
def list_channels(db: Database = Depends(get_db)):
    ensure_channels(db)
    return [channel_out(c) for c in db.youtube_channels.find().sort("key", -1)]


@router.patch("/channels/{key}", response_model=ChannelOut)
def update_channel(key: ChannelKey, body: ChannelUpdate, db: Database = Depends(get_db)):
    channel = _channel(db, key)
    changes = body.model_dump(exclude_unset=True, exclude_none=True)
    if changes:
        changes["updated_at"] = utcnow()
        channel = db.youtube_channels.find_one_and_update({"_id": channel["_id"]}, {"$set": changes}, return_document=ReturnDocument.AFTER)
    return channel_out(channel)


@router.post("/channels/{key}/import")
def import_videos(key: ChannelKey, db: Database = Depends(get_db)) -> dict:
    channel = _channel(db, key)
    try:
        added, skipped = import_channel(db, channel)
    except YouTubeError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc))
    return {"added": added, "skipped": skipped}


@router.get("/videos", response_model=VideoPage)
def list_videos(
    db: Database = Depends(get_db),
    channel_key: ChannelKey | None = None,
    active: bool | None = None,
    scheduled: bool | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    query: dict = {}
    if channel_key:
        query["channel_key"] = channel_key
    if active is not None:
        query["active"] = active
    if scheduled is True:
        query["scheduled_for"] = {"$ne": None}
    total = db.youtube_videos.count_documents(query)
    sort = [("scheduled_for", 1)] if scheduled else [("published_at", -1), ("created_at", -1)]
    videos = db.youtube_videos.find(query).sort(sort).skip((page - 1) * page_size).limit(page_size)
    return VideoPage(items=[video_admin_out(db, v) for v in videos], total=total, page=page, page_size=page_size)


@router.post("/videos", response_model=VideoAdminOut, status_code=status.HTTP_201_CREATED)
def add_video(body: VideoCreate, db: Database = Depends(get_db)):
    try:
        video_id = parse_video_id(body.url)
    except YouTubeError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc))
    title = (body.title or "").strip() or fetch_title(video_id)
    if not title:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Couldn't fetch the title from YouTube. Please type the video title.")
    published = datetime(body.published_at.year, body.published_at.month, body.published_at.day) if body.published_at else None
    doc = new_video_doc(video_id, body.channel_key, title, published, "manual", body.duration_seconds)
    try:
        doc["_id"] = db.youtube_videos.insert_one(doc).inserted_id
    except DuplicateKeyError:
        raise HTTPException(status.HTTP_409_CONFLICT, "This video has already been added.")
    return video_admin_out(db, doc)


@router.patch("/videos/{video_id}", response_model=VideoAdminOut)
def update_video(video_id: str, body: VideoUpdate, db: Database = Depends(get_db)):
    oid = parse_object_id(video_id)
    video = db.youtube_videos.find_one({"_id": oid})
    if video is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Video not found.")
    changes = body.model_dump(exclude_unset=True, exclude_none=True, exclude={"clear_schedule", "questions", "scheduled_for"})
    if body.scheduled_for is not None:
        clash = db.youtube_videos.find_one({"_id": {"$ne": oid}, "channel_key": video["channel_key"], "scheduled_for": body.scheduled_for.isoformat()})
        if clash:
            raise HTTPException(status.HTTP_409_CONFLICT, f"“{clash['title']}” is already scheduled for that day on this channel.")
        changes["scheduled_for"] = body.scheduled_for.isoformat()
    if body.clear_schedule:
        changes["scheduled_for"] = None
    if body.questions is not None:
        changes["questions"] = [{"id": ObjectId(), **q.model_dump()} for q in body.questions]
    changes["updated_at"] = utcnow()
    updated = db.youtube_videos.find_one_and_update({"_id": oid}, {"$set": changes}, return_document=ReturnDocument.AFTER)
    return video_admin_out(db, updated)


@router.delete("/videos/{video_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_video(video_id: str, db: Database = Depends(get_db)):
    oid = parse_object_id(video_id)
    if db.daily_lessons.find_one({"video_ids": oid}, {"_id": 1}):
        raise HTTPException(status.HTTP_409_CONFLICT, "Learners have already been given this video. Make it inactive instead.")
    db.youtube_videos.delete_one({"_id": oid})
