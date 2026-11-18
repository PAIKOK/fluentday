from datetime import date, timedelta

from tests.conftest import sign_up
from tests.test_lessons import add_words


def test_notebook_crud_search_and_privacy(client, db):
    sign_up(client, db, "ana@example.com")
    r = client.post("/api/notebook", json={"category": "mistakes", "title": "  Since vs for ", "content": "I have lived here since 3 years ✗", "tags": ["Grammar", "#grammar", "time"]})
    assert r.status_code == 201
    entry = r.json()
    assert entry["title"] == "Since vs for" and entry["tags"] == ["grammar", "time"]

    client.post("/api/notebook", json={"category": "expressions", "title": "break the ice"})
    assert client.get("/api/notebook", params={"q": "SINCE"}).json()["total"] == 1
    assert client.get("/api/notebook", params={"tag": "grammar"}).json()["total"] == 1
    page = client.get("/api/notebook", params={"category": "expressions"}).json()
    assert page["total"] == 1 and page["counts"] == {"vocabulary": 0, "expressions": 1, "sentences": 0, "mistakes": 1}

    assert client.patch(f"/api/notebook/{entry['id']}", json={"favourite": True}).json()["favourite"] is True
    assert client.get("/api/notebook/tags").json() == ["grammar", "time"]

    pdf = client.get("/api/notebook/export.pdf")
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF-")
    assert "attachment" in pdf.headers["content-disposition"]

    client.post("/api/auth/logout")
    sign_up(client, db, "ben@example.com")
    assert client.get("/api/notebook").json()["total"] == 0
    assert client.patch(f"/api/notebook/{entry['id']}", json={"title": "hacked"}).status_code == 404
    assert client.delete(f"/api/notebook/{entry['id']}").status_code == 404


def test_saving_a_word_and_sentences_live_in_the_notebook(client, db):
    add_words(db, 7)
    sign_up(client, db, "ana@example.com")
    word = client.get("/api/lessons/today").json()["words"][0]
    client.patch(f"/api/vocabulary/{word['id']}/progress", json={"saved": True})
    client.patch(f"/api/vocabulary/{word['id']}/progress", json={"saved": True})  # no duplicate
    client.post(f"/api/vocabulary/{word['id']}/sentences", json={"text": "A sentence of mine."})
    counts = client.get("/api/notebook").json()["counts"]
    assert counts["vocabulary"] == 1 and counts["sentences"] == 1

    # Deleting the notebook entry un-saves the word.
    vocab_entry = client.get("/api/notebook", params={"category": "vocabulary"}).json()["items"][0]
    client.delete(f"/api/notebook/{vocab_entry['id']}")
    assert client.get(f"/api/vocabulary/{word['id']}").json()["progress"]["saved"] is False


def test_revision_schedule_queue_and_calendar(client, db):
    add_words(db, 7)
    sign_up(client, db, "ana@example.com")
    word = client.get("/api/lessons/today").json()["words"][0]
    progress = client.patch(f"/api/vocabulary/{word['id']}/progress", json={"learned": True}).json()
    learned_on = date.fromisoformat(progress["learned_on"])
    assert progress["next_revision"] == (learned_on + timedelta(days=1)).isoformat()
    assert client.get("/api/revision/queue").json()["words"] == []  # not due until tomorrow

    # Pretend it's due today.
    db.user_vocabulary_progress.update_many({}, {"$set": {"due_date": learned_on.isoformat()}})
    queue = client.get("/api/revision/queue").json()
    assert [w["id"] for w in queue["words"]] == [word["id"]]
    assert client.get("/api/dashboard").json()["revisions_due_today"] == 1

    r = client.post(f"/api/revision/{word['id']}", json={"rating": "remembered"})
    assert r.json()["stage"] == 1 and r.json()["due_date"] == (learned_on + timedelta(days=2)).isoformat()
    assert client.get("/api/revision/queue").json()["words"] == []

    cal = client.get("/api/revision/calendar", params={"month": learned_on.isoformat()[:7]}).json()
    by_day = {d["date"]: d for d in cal["days"]}
    assert by_day[learned_on.isoformat()]["reviewed"] == 1
    assert client.get("/api/revision/calendar", params={"month": "2026-13"}).status_code == 422


def test_only_learned_words_can_be_revised_and_mastery(client, db, settings):
    add_words(db, 7)
    sign_up(client, db, "ana@example.com")
    word = client.get("/api/lessons/today").json()["words"][0]
    assert client.post(f"/api/revision/{word['id']}", json={"rating": "easy"}).status_code == 404
    client.patch(f"/api/vocabulary/{word['id']}/progress", json={"learned": True})
    client.post(f"/api/revision/{word['id']}", json={"rating": "easy"})
    result = client.post(f"/api/revision/{word['id']}", json={"rating": "easy"}).json()
    assert result["mastered"] is True
    assert client.get(f"/api/vocabulary/{word['id']}").json()["progress"]["status"] == "mastered"
