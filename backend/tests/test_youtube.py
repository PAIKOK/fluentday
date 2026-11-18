import pytest
from bson import ObjectId

from app.db import utcnow
from app.services import youtube
from app.services.youtube import YouTubeError, parse_feed, parse_video_id, pick_lesson_videos
from tests.conftest import sign_up

FEED = b"""<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns="http://www.w3.org/2005/Atom">
  <entry><yt:videoId>AAAAAAAAAAA</yt:videoId><title>6 Minute English: Sleep</title><published>2026-11-10T08:00:00+00:00</published></entry>
  <entry><yt:videoId>BBBBBBBBBBB</yt:videoId><title>News Review</title><published>2026-11-11T08:00:00+00:00</published></entry>
  <entry><yt:videoId>bad</yt:videoId><title>Broken</title></entry>
</feed>"""


@pytest.mark.parametrize("url", [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30",
    "https://youtu.be/dQw4w9WgXcQ",
    "youtube.com/shorts/dQw4w9WgXcQ",
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    "dQw4w9WgXcQ",
])
def test_video_id_from_links(url):
    assert parse_video_id(url) == "dQw4w9WgXcQ"


@pytest.mark.parametrize("url", ["https://vimeo.com/123", "https://www.youtube.com/watch?v=short", "not a link"])
def test_rejects_non_youtube_links(url):
    with pytest.raises(YouTubeError):
        parse_video_id(url)


def test_feed_parsing_skips_invalid_entries():
    videos = parse_feed(FEED)
    assert [v.video_id for v in videos] == ["AAAAAAAAAAA", "BBBBBBBBBBB"]
    assert videos[0].published_at.isoformat() == "2026-11-10T08:00:00"


def test_import_applies_the_title_filter_and_keeps_admin_edits(admin_client, db, monkeypatch):
    monkeypatch.setattr(youtube, "fetch_feed", lambda channel_id: parse_feed(FEED))
    admin_client.patch("/api/admin/youtube/channels/bbc_6min", json={"channel_id": "UC" + "a" * 22})
    r = admin_client.post("/api/admin/youtube/channels/bbc_6min/import")
    assert r.json() == {"added": 1, "skipped": 1}
    video = db.youtube_videos.find_one({"video_id": "AAAAAAAAAAA"})
    admin_client.patch(f"/api/admin/youtube/videos/{video['_id']}", json={"title": "Edited title"})
    assert admin_client.post("/api/admin/youtube/channels/bbc_6min/import").json() == {"added": 0, "skipped": 1}
    assert db.youtube_videos.find_one({"video_id": "AAAAAAAAAAA"})["title"] == "Edited title"


def test_channel_id_is_validated(admin_client):
    assert admin_client.patch("/api/admin/youtube/channels/tv_series", json={"channel_id": "nope"}).status_code == 422
    assert [c["key"] for c in admin_client.get("/api/admin/youtube/channels").json()] == ["tv_series", "bbc_6min"]


def test_add_video_by_link(admin_client, monkeypatch):
    monkeypatch.setattr(youtube, "fetch_title", lambda vid: None)
    from app.routers import admin_youtube
    monkeypatch.setattr(admin_youtube, "fetch_title", lambda vid: None)
    payload = {"url": "https://youtu.be/dQw4w9WgXcQ", "channel_key": "tv_series"}
    assert admin_client.post("/api/admin/youtube/videos", json=payload).status_code == 422  # no title available
    r = admin_client.post("/api/admin/youtube/videos", json={**payload, "title": "Friends: ordering coffee", "duration_seconds": 420})
    assert r.status_code == 201
    assert r.json()["thumbnail_url"] == "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"
    assert admin_client.post("/api/admin/youtube/videos", json={**payload, "title": "again"}).status_code == 409


def add_video(db, key, vid, scheduled=None, questions=None, duration=300):
    doc = youtube.new_video_doc(vid, key, f"Video {vid}", utcnow(), "manual", duration)
    doc.update(scheduled_for=scheduled, questions=questions or [])
    return db.youtube_videos.insert_one(doc).inserted_id


def test_lesson_videos_one_per_channel_scheduled_first(db):
    youtube.ensure_channels(db)
    tv = add_video(db, "tv_series", "T" * 11)
    add_video(db, "bbc_6min", "B" * 11)
    scheduled = add_video(db, "bbc_6min", "S" * 11, scheduled="2026-11-18")
    picked = pick_lesson_videos(db, ObjectId(), "2026-11-18")
    assert picked == [tv, scheduled]


def test_listening_flow(client, db):
    youtube.ensure_channels(db)
    question = {"id": ObjectId(), "prompt": "What is the topic?", "options": ["Sleep", "Food"], "answer_index": 0, "explanation": "They talk about sleep."}
    vid = add_video(db, "bbc_6min", "Q" * 11, questions=[question], duration=None)
    sign_up(client, db, "ana@example.com")
    today = client.get("/api/listening/today").json()
    assert len(today["items"]) == 1
    item = today["items"][0]
    assert "answer_index" not in item["video"]["questions"][0]  # answers are hidden until submitted

    r = client.patch(f"/api/listening/{vid}/progress", json={"position_seconds": 100, "duration_seconds": 200, "notes": "Good phrase: night owl"})
    assert r.json()["watched_seconds"] == 100 and not r.json()["completed"]
    assert db.youtube_videos.find_one({"_id": vid})["duration_seconds"] == 200  # learned from the player
    r = client.patch(f"/api/listening/{vid}/progress", json={"position_seconds": 185})
    assert r.json()["completed"] is True  # 90% watched

    quiz = client.post(f"/api/listening/{vid}/quiz", json={"answers": [1]}).json()
    assert quiz["score"] == 0 and quiz["items"][0]["answer_index"] == 0 and quiz["items"][0]["explanation"]

    expr = client.post(f"/api/listening/{vid}/expressions", json={"text": "night owl", "meaning": "someone who stays up late"})
    assert expr.status_code == 201 and expr.json()["category"] == "expressions"

    other = add_video(db, "tv_series", "Z" * 11)
    assert client.patch(f"/api/listening/{other}/progress", json={"completed": True}).status_code == 404


def test_cannot_delete_a_video_learners_have(admin_client, db):
    youtube.ensure_channels(db)
    vid = add_video(db, "tv_series", "D" * 11)
    admin_client.get("/api/lessons/today")  # admin's own lesson now includes it
    assert admin_client.delete(f"/api/admin/youtube/videos/{vid}").status_code == 409
