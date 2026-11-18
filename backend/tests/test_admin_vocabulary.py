import io

from scripts.sample_pdfs import BOOK_ONE, build_pdf


def seed(admin_client):
    admin_client.post("/api/admin/books/1", files={"file": ("b.pdf", io.BytesIO(build_pdf(BOOK_ONE)), "application/pdf")})


def find(admin_client, word):
    return admin_client.get("/api/admin/vocabulary", params={"q": word}).json()["items"][0]


def test_filters_and_pagination(admin_client):
    seed(admin_client)
    page = admin_client.get("/api/admin/vocabulary", params={"page_size": 2}).json()
    assert page["total"] > 2 and len(page["items"]) == 2
    flagged = admin_client.get("/api/admin/vocabulary", params={"needs_review": True}).json()["items"]
    assert {"the", "gregarious"} <= {w["word"] for w in flagged}
    assert admin_client.get("/api/admin/vocabulary", params={"q": ".*"}).json()["total"] == 0  # regex is escaped


def test_edit_marks_admin_edited_and_keeps_sources(admin_client):
    seed(admin_client)
    word = find(admin_client, "candid")
    r = admin_client.patch(f"/api/admin/vocabulary/{word['id']}", json={
        "level": "intermediate",
        "examples": [{"text": "She gave a candid answer.", "source": "admin"}],
        "synonyms": ["Frank", "honest", "frank"],
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["admin_edited"] is True
    assert body["level"] == "intermediate"
    assert body["synonyms"] == ["frank", "honest"]
    assert body["sources"][0]["page"] == 1


def test_cannot_approve_without_definition(admin_client):
    seed(admin_client)
    word = find(admin_client, "gregarious")
    assert admin_client.patch(f"/api/admin/vocabulary/{word['id']}", json={"status": "approved"}).status_code == 422
    r = admin_client.patch(f"/api/admin/vocabulary/{word['id']}", json={"definition": "fond of company; sociable.", "status": "approved"})
    assert r.status_code == 200
    assert r.json()["needs_review"] is False


def test_bulk_status_skips_words_without_definitions(admin_client):
    seed(admin_client)
    ids = [find(admin_client, w)["id"] for w in ("abundant", "candid", "gregarious")]
    r = admin_client.post("/api/admin/vocabulary/bulk-status", json={"ids": ids, "status": "approved"})
    assert r.json() == {"updated": 2, "skipped_without_definition": 1}


def test_renaming_to_an_existing_word_conflicts(admin_client):
    seed(admin_client)
    word = find(admin_client, "candid")
    assert admin_client.patch(f"/api/admin/vocabulary/{word['id']}", json={"word": "Frugal"}).status_code == 409


def test_overview_and_users(admin_client):
    seed(admin_client)
    overview = admin_client.get("/api/admin/overview").json()
    assert overview["users_total"] == 1 and overview["books_ready"] == 1 and overview["words_pending"] > 0
    users = admin_client.get("/api/admin/users").json()
    assert users["items"][0]["email"] == "admin@example.com"
