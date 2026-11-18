import io

from scripts.sample_pdfs import BOOK_ONE, BOOK_TWO, build_pdf


def upload(client, slot, data, title=None, filename="book.pdf"):
    form = {"title": title} if title else {}
    return client.post(f"/api/admin/books/{slot}", files={"file": (filename, io.BytesIO(data), "application/pdf")}, data=form)


def test_upload_processes_book_and_lists_three_slots(admin_client, db):
    r = upload(admin_client, 1, build_pdf(BOOK_ONE), title="Everyday Words")
    assert r.status_code == 201, r.text
    slots = admin_client.get("/api/admin/books").json()
    assert [s["slot"] for s in slots] == [1, 2, 3]
    book = slots[0]["book"]
    assert book["status"] == "ready", book
    assert book["title"] == "Everyday Words"
    assert book["word_count"] > 5
    assert book["flagged_count"] >= 2
    assert slots[1]["book"] is None


def test_only_slots_one_to_three_and_only_pdfs(admin_client):
    assert upload(admin_client, 4, build_pdf(BOOK_ONE)).status_code == 422
    assert upload(admin_client, 1, b"hello, not a pdf").status_code == 422
    assert upload(admin_client, 1, b"%PDF-1.4 broken").status_code == 422


def test_duplicates_across_books_become_one_word_with_two_sources(admin_client, db):
    upload(admin_client, 1, build_pdf(BOOK_ONE), title="Book One")
    upload(admin_client, 2, build_pdf(BOOK_TWO), title="Book Two")
    assert db.vocabulary_words.count_documents({"word_key": "candid"}) == 1
    items = admin_client.get("/api/admin/vocabulary", params={"q": "candid"}).json()["items"]
    assert len(items) == 1
    assert sorted((s["book_title"], s["page"]) for s in items[0]["sources"]) == [("Book One", 1), ("Book Two", 1)]
    # First book's definition is kept as the word's definition.
    assert items[0]["definition"].startswith("truthful")


def test_replace_book_removes_old_words_but_keeps_approved_ones(admin_client, db):
    upload(admin_client, 1, build_pdf(BOOK_ONE))
    frugal = admin_client.get("/api/admin/vocabulary", params={"q": "frugal"}).json()["items"][0]
    assert admin_client.patch(f"/api/admin/vocabulary/{frugal['id']}", json={"status": "approved"}).status_code == 200
    upload(admin_client, 1, build_pdf(BOOK_TWO))
    keys = set(db.vocabulary_words.distinct("word_key"))
    assert "abundant" not in keys       # pending word from the replaced book
    assert "frugal" in keys             # approved word is never silently deleted
    assert "meticulous" in keys
    assert db.book_files.files.count_documents({}) == 1


def test_reprocess_is_idempotent(admin_client, db):
    upload(admin_client, 1, build_pdf(BOOK_ONE))
    before = db.vocabulary_sources.count_documents({})
    r = admin_client.post("/api/admin/books/1/reprocess")
    assert r.status_code == 200
    assert db.vocabulary_sources.count_documents({}) == before
    assert admin_client.get("/api/admin/books").json()[0]["book"]["status"] == "ready"


def test_text_without_entries_fails_with_a_clear_error(admin_client):
    data = build_pdf([[("This is only an ordinary paragraph of text with no entries at all in it.", "plain")]])
    upload(admin_client, 3, data)
    book = admin_client.get("/api/admin/books").json()[2]["book"]
    assert book["status"] == "failed"
    assert "no dictionary-style entries" in book["error"]


def test_pdf_download_is_admin_only(admin_client, client, db):
    upload(admin_client, 1, build_pdf(BOOK_ONE))
    r = admin_client.get("/api/admin/books/1/file")
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert r.content.startswith(b"%PDF-")
    admin_client.post("/api/auth/logout")
    assert client.get("/api/admin/books/1/file").status_code == 401
