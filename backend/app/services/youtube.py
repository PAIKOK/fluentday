"""YouTube content for the Listening Room.

Videos come only from supported sources: a channel's official RSS feed, YouTube's oEmbed endpoint
(for a pasted link's title), or details typed by an administrator. Pages are never scraped.
"""

import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime
from urllib.parse import parse_qs, urlparse

import httpx
from bson import ObjectId
from pymongo.database import Database

from app.db import utcnow

DEFAULT_CHANNELS = [
    {"key": "tv_series", "name": "Learn English with TV Series", "title_filter": ""},
    {"key": "bbc_6min", "name": "BBC Learning English — 6 Minute English", "title_filter": "6 Minute English"},
]
CHANNEL_KEYS = tuple(c["key"] for c in DEFAULT_CHANNELS)

VIDEO_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")
CHANNEL_ID_RE = re.compile(r"^UC[A-Za-z0-9_-]{22}$")
FEED_URL = "https://www.youtube.com/feeds/videos.xml?channel_id={}"
OEMBED_URL = "https://www.youtube.com/oembed"
MAX_FEED_BYTES = 2_000_000
NS = {"atom": "http://www.w3.org/2005/Atom", "yt": "http://www.youtube.com/xml/schemas/2015", "media": "http://search.yahoo.com/mrss/"}


class YouTubeError(Exception):
    """A problem the admin should see, e.g. an invalid link or an unreachable feed."""


@dataclass
class FeedVideo:
    video_id: str
    title: str
    published_at: datetime | None


def thumbnail_url(video_id: str) -> str:
    return f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"


def parse_video_id(url_or_id: str) -> str:
    """Accepts watch?v=, youtu.be/, /shorts/, /embed/, /live/ links or a bare 11-character id."""
    text = url_or_id.strip()
    if VIDEO_ID_RE.match(text):
        return text
    try:
        parsed = urlparse(text if "://" in text else f"https://{text}")
    except ValueError:
        raise YouTubeError("That doesn't look like a YouTube link.")
    host = (parsed.hostname or "").lower().removeprefix("www.").removeprefix("m.")
    candidate = ""
    if host == "youtu.be":
        candidate = parsed.path.strip("/").split("/")[0]
    elif host in ("youtube.com", "youtube-nocookie.com", "music.youtube.com"):
        if parsed.path == "/watch":
            candidate = parse_qs(parsed.query).get("v", [""])[0]
        else:
            parts = parsed.path.strip("/").split("/")
            if len(parts) >= 2 and parts[0] in ("shorts", "embed", "live", "v"):
                candidate = parts[1]
    if not VIDEO_ID_RE.match(candidate):
        raise YouTubeError("That doesn't look like a YouTube video link.")
    return candidate


def parse_feed(xml_bytes: bytes) -> list[FeedVideo]:
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError:
        raise YouTubeError("The channel feed could not be read.")
    videos = []
    for entry in root.findall("atom:entry", NS):
        video_id = entry.findtext("yt:videoId", default="", namespaces=NS)
        title = entry.findtext("atom:title", default="", namespaces=NS).strip()
        published = entry.findtext("atom:published", default="", namespaces=NS)
        try:
            published_at = datetime.fromisoformat(published).replace(tzinfo=None) if published else None
        except ValueError:
            published_at = None
        if VIDEO_ID_RE.match(video_id) and title:
            videos.append(FeedVideo(video_id=video_id, title=title[:200], published_at=published_at))
    return videos


def fetch_feed(channel_id: str) -> list[FeedVideo]:
    if not CHANNEL_ID_RE.match(channel_id):
        raise YouTubeError("Add the channel ID (it starts with “UC” and is 24 characters long) before importing.")
    try:
        response = httpx.get(FEED_URL.format(channel_id), timeout=10, follow_redirects=True)
    except httpx.HTTPError as exc:
        raise YouTubeError(f"Could not reach YouTube: {exc}")
    if response.status_code == 404:
        raise YouTubeError("YouTube has no feed for that channel ID. Check the ID.")
    if response.status_code != 200 or len(response.content) > MAX_FEED_BYTES:
        raise YouTubeError(f"YouTube returned an unexpected response ({response.status_code}).")
    return parse_feed(response.content)


def fetch_title(video_id: str) -> str | None:
    """Title via YouTube's oEmbed endpoint; None if it can't be reached (the admin can type one)."""
    try:
        response = httpx.get(
            OEMBED_URL, params={"url": f"https://www.youtube.com/watch?v={video_id}", "format": "json"}, timeout=8
        )
    except httpx.HTTPError:
        return None
    if response.status_code != 200:
        return None
    title = response.json().get("title")
    return title[:200] if isinstance(title, str) and title.strip() else None


def ensure_channels(db: Database) -> None:
    for channel in DEFAULT_CHANNELS:
        db.youtube_channels.update_one(
            {"key": channel["key"]},
            {"$setOnInsert": {**channel, "url": "", "channel_id": "", "active": True, "last_imported_at": None, "created_at": utcnow()}},
            upsert=True,
        )


def matches_filter(title: str, title_filter: str) -> bool:
    return not title_filter.strip() or title_filter.strip().lower() in title.lower()


def import_channel(db: Database, channel: dict) -> tuple[int, int]:
    """Adds new videos from the channel's feed. Existing videos keep any admin edits. Returns (added, skipped)."""
    added = skipped = 0
    for video in fetch_feed(channel.get("channel_id", "")):
        if not matches_filter(video.title, channel.get("title_filter", "")):
            skipped += 1
            continue
        result = db.youtube_videos.update_one(
            {"video_id": video.video_id},
            {"$setOnInsert": new_video_doc(video.video_id, channel["key"], video.title, video.published_at, "rss")},
            upsert=True,
        )
        if result.upserted_id is not None:
            added += 1
    db.youtube_channels.update_one({"_id": channel["_id"]}, {"$set": {"last_imported_at": utcnow()}})
    return added, skipped


def new_video_doc(video_id: str, channel_key: str, title: str, published_at: datetime | None, source: str, duration: int | None = None) -> dict:
    now = utcnow()
    return {
        "video_id": video_id,
        "channel_key": channel_key,
        "title": title,
        "thumbnail_url": thumbnail_url(video_id),
        "duration_seconds": duration,
        "published_at": published_at,
        "active": True,
        "scheduled_for": None,
        "questions": [],
        "source": source,
        "created_at": now,
        "updated_at": now,
    }


def pick_lesson_videos(db: Database, user_id: ObjectId, lesson_date: str) -> list[ObjectId]:
    """One video per active channel: the one scheduled for this date, otherwise the newest the learner
    hasn't been given yet (or, if they've seen them all, the newest)."""
    seen = set()
    for lesson in db.daily_lessons.find({"user_id": user_id}, {"video_ids": 1}):
        seen.update(lesson.get("video_ids", []))
    chosen = []
    for channel in db.youtube_channels.find({"active": True}).sort("key", -1):
        base = {"channel_key": channel["key"], "active": True}
        video = db.youtube_videos.find_one({**base, "scheduled_for": lesson_date})
        if video is None:
            newest_first = [("published_at", -1), ("created_at", -1)]
            video = db.youtube_videos.find_one({**base, "_id": {"$nin": list(seen)}}, sort=newest_first) or db.youtube_videos.find_one(base, sort=newest_first)
        if video is not None:
            chosen.append(video["_id"])
    return chosen
