from datetime import datetime, timezone

from bson import ObjectId

from app.db import utcnow
from app.services.lessons import (
    DAILY_WORD_COUNT,
    choose_words,
    generate_for_all_users,
    generate_lesson,
    lesson_date_for,
    level_preference,
    streak_days,
)
from tests.conftest import sign_up

# --- Pure rules ----------------------------------------------------------------


def test_lesson_date_uses_the_learners_timezone():
    moment = datetime(2026, 11, 17, 20, 0, tzinfo=timezone.utc)
    assert lesson_date_for("Asia/Kolkata", moment) == "2026-11-18"   # already past midnight in India
    assert lesson_date_for("America/New_York", moment) == "2026-11-17"
    assert lesson_date_for("Not/AZone", moment) == "2026-11-18"      # falls back to the default timezone


def test_level_preference_order():
    assert level_preference("beginner") == ["beginner", None, "intermediate", "advanced"]
    assert level_preference("intermediate") == ["intermediate", None, "beginner", "advanced"]
    assert level_preference("advanced") == ["advanced", None, "intermediate", "beginner"]
    assert level_preference(None)[0] == "beginner"


def test_choose_words_prefers_level_then_falls_back():
    own = [(ObjectId(), "advanced") for _ in range(3)]
    unlevelled = [(ObjectId(), None) for _ in range(2)]
    other = [(ObjectId(), "beginner") for _ in range(5)]
    chosen = choose_words(own + unlevelled + other, "advanced", 7, seed="u:2026-11-17")
    assert len(chosen) == 7
    assert set(chosen[:3]) == {w for w, _ in own}
    assert set(chosen[3:5]) == {w for w, _ in unlevelled}
    assert choose_words(own + unlevelled + other, "advanced", 7, seed="u:2026-11-17") == chosen  # reproducible


def test_streak_counts_consecutive_days():
    days = {"2026-11-15", "2026-11-16", "2026-11-17"}
    assert streak_days(days, "2026-11-17") == 3
    assert streak_days(days, "2026-11-18") == 3   # today not done yet: streak still alive
    assert streak_days(days, "2026-11-19") == 0
    assert streak_days(set(), "2026-11-17") == 0


# --- Generation against the database -------------------------------------------


def add_words(db, n, level=None, status="approved", definition="a meaning"):
    now = utcnow()
    ids = []
    for _ in range(n):
        key = f"w{ObjectId()}"
        ids.append(db.vocabulary_words.insert_one({
            "word": key, "word_key": key, "definition": definition, "level": level, "status": status,
            "examples": [], "synonyms": [], "antonyms": [], "admin_edited": False, "created_at": now, "updated_at": now,
        }).inserted_id)
    return ids


def learner(db, level="intermediate"):
    user = {"_id": ObjectId(), "email": f"{ObjectId()}@example.com", "email_verified": True}
    db.users.insert_one(user)
    profile = {"user_id": user["_id"], "full_name": "L", "proficiency_level": level, "timezone": "Asia/Kolkata"}
    db.profiles.insert_one(profile)
    return user, profile


def on(day: int) -> datetime:
    return datetime(2026, 11, day, 6, 0, tzinfo=timezone.utc)


def test_seven_new_approved_words_and_idempotent(db):
    add_words(db, 10, "intermediate")
    add_words(db, 5, status="pending")                     # never used
    add_words(db, 5, definition=None)                      # approved but no meaning: never used
    user, profile = learner(db)
    first = generate_lesson(db, user, profile, now=on(17))
    again = generate_lesson(db, user, profile, now=on(17))
    assert first.created and not again.created
    assert again.lesson["_id"] == first.lesson["_id"]
    assert len(first.lesson["word_ids"]) == DAILY_WORD_COUNT
    approved = set(db.vocabulary_words.distinct("_id", {"status": "approved", "definition": "a meaning"}))
    assert set(first.lesson["word_ids"]) <= approved
    assert db.daily_lessons.count_documents({}) == 1


def test_words_never_repeat_across_days(db):
    add_words(db, 14, "intermediate")
    user, profile = learner(db)
    day1 = generate_lesson(db, user, profile, now=on(17)).lesson
    day2 = generate_lesson(db, user, profile, now=on(18)).lesson
    assert not set(day1["word_ids"]) & set(day2["word_ids"])
    assert db.user_vocabulary_progress.count_documents({"user_id": user["_id"]}) == 14


def test_short_pool_is_topped_up_with_revision_then_becomes_a_revision_lesson(db):
    add_words(db, 9, "intermediate")
    user, profile = learner(db)
    generate_lesson(db, user, profile, now=on(17))
    day2 = generate_lesson(db, user, profile, now=on(18)).lesson
    assert len(day2["word_ids"]) == 2 and len(day2["revision_word_ids"]) == 5
    assert day2["kind"] == "new"
    day3 = generate_lesson(db, user, profile, now=on(19)).lesson
    assert day3["kind"] == "revision" and day3["word_ids"] == [] and len(day3["revision_word_ids"]) == 7


def test_empty_lesson_when_nothing_is_approved(db):
    user, profile = learner(db)
    lesson = generate_lesson(db, user, profile, now=on(17)).lesson
    assert lesson["kind"] == "empty"


def test_empty_lesson_is_remade_once_words_are_published(db):
    user, profile = learner(db)
    assert generate_lesson(db, user, profile, now=on(17)).lesson["kind"] == "empty"
    add_words(db, 10)
    lesson = generate_lesson(db, user, profile, now=on(17)).lesson
    assert lesson["kind"] == "new" and len(lesson["word_ids"]) == 7
    assert db.daily_lessons.count_documents({"user_id": user["_id"]}) == 1


def test_daily_job_skips_disabled_learners_and_logs_the_run(db):
    add_words(db, 30)
    learner(db)
    learner(db)
    db.users.insert_one({"_id": ObjectId(), "email": "gone@example.com", "disabled": True})
    first = generate_for_all_users(db, now=on(17))
    second = generate_for_all_users(db, now=on(17))
    assert (first.created, first.existing) == (2, 0)
    assert (second.created, second.existing) == (0, 2)
    assert db.job_runs.count_documents({"job": "generate_daily_lessons"}) == 2


# --- API -------------------------------------------------------------------------


def test_today_endpoint_progress_and_privacy(client, db):
    add_words(db, 10, "beginner")
    sign_up(client, db, "ana@example.com")
    lesson = client.get("/api/lessons/today").json()
    assert lesson["kind"] == "new" and len(lesson["words"]) == 7 and lesson["learned_count"] == 0
    word = lesson["words"][0]

    r = client.patch(f"/api/vocabulary/{word['id']}/progress", json={"learned": True, "difficult": True, "saved": True})
    assert r.status_code == 200
    assert r.json()["status"] == "learned" and r.json()["learned_on"]
    r = client.post(f"/api/vocabulary/{word['id']}/sentences", json={"text": "  My   own sentence. "})
    assert r.status_code == 201 and r.json()["my_sentences"][0]["text"] == "My own sentence."
    sentence_id = r.json()["my_sentences"][0]["id"]

    dash = client.get("/api/dashboard").json()
    assert dash["words_learned_total"] == 1 and dash["streak_days"] == 1
    assert sum(w["learned"] for w in dash["words_today"]) == 1

    assert client.delete(f"/api/vocabulary/{word['id']}/sentences/{sentence_id}").json()["my_sentences"] == []

    # A word that was never assigned to this learner is not visible to them.
    other = add_words(db, 1)[0]
    assert client.get(f"/api/vocabulary/{other}").status_code == 404
    assert client.patch(f"/api/vocabulary/{other}/progress", json={"learned": True}).status_code == 404

    # Another learner can't see or change the first learner's progress.
    client.post("/api/auth/logout")
    sign_up(client, db, "ben@example.com")
    assert client.patch(f"/api/vocabulary/{word['id']}/progress", json={"learned": False}).status_code == 404


def test_lesson_shows_book_source_and_labels_team_edits(admin_client, db):
    import io

    from scripts.sample_pdfs import BOOK_ONE, build_pdf

    admin_client.post("/api/admin/books/1", files={"file": ("b.pdf", io.BytesIO(build_pdf(BOOK_ONE)), "application/pdf")}, data={"title": "Book One"})
    for item in admin_client.get("/api/admin/vocabulary", params={"page_size": 100}).json()["items"]:
        if item["definition"]:
            admin_client.post("/api/admin/vocabulary/bulk-status", json={"ids": [item["id"]], "status": "approved"})
    abundant = admin_client.get("/api/admin/vocabulary", params={"q": "abundant"}).json()["items"][0]
    admin_client.patch(f"/api/admin/vocabulary/{abundant['id']}", json={"definition": "plentiful (edited by the team)"})

    # The sample book has exactly seven words with definitions, so all of them are in today's lesson.
    words = {w["word"]: w for w in admin_client.get("/api/lessons/today").json()["words"]}
    assert len(words) == 7
    assert words["candid"]["definition_source"] == {"book_title": "Book One", "page": 1}
    assert words["candid"]["pronunciation"] == "/KAN-did/"
    assert words["abundant"]["definition_source"] is None      # edited by the team, so not shown as the book's
    assert words["abundant"]["definition"] == "plentiful (edited by the team)"
