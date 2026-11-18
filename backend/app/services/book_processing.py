"""Stores a book's extracted entries: one word per headword across all books, one source per (word, book, page)."""

import logging
from dataclasses import dataclass

import gridfs
from bson import ObjectId
from pymongo.database import Database

from app.db import BOOK_FILES_BUCKET, utcnow
from app.services.pdf_extraction import Entry, ExtractionError, best_entry_per_word, extract_entries_from_pdf

logger = logging.getLogger("fluentday.books")


@dataclass
class StoreStats:
    words: int = 0
    new_words: int = 0
    flagged: int = 0


def display_word(headword: str) -> str:
    """Dictionary headwords are shown lowercase; short all-caps words (acronyms like "ASAP") are kept."""
    return headword if headword.isupper() and len(headword) <= 4 else headword.lower()


def book_files(db: Database) -> gridfs.GridFS:
    return gridfs.GridFS(db, collection=BOOK_FILES_BUCKET)


def remove_book_vocabulary(db: Database, book_id: ObjectId) -> None:
    """Removes a book's sources. Words left without any source are deleted unless an admin approved or edited them."""
    word_ids = db.vocabulary_sources.distinct("word_id", {"book_id": book_id})
    db.vocabulary_sources.delete_many({"book_id": book_id})
    for word_id in word_ids:
        remaining = db.vocabulary_sources.find_one({"word_id": word_id}, sort=[("confidence", -1)])
        if remaining is None:
            db.vocabulary_words.delete_one({"_id": word_id, "status": {"$ne": "approved"}, "admin_edited": False})
        else:
            db.vocabulary_words.update_one(
                {"_id": word_id, "admin_edited": False, "definition_source.book_id": book_id},
                {"$set": {
                    "definition": remaining.get("definition"),
                    "definition_source": {"book_id": remaining["book_id"], "page": remaining["page"]},
                    "updated_at": utcnow(),
                }},
            )


def store_entries(db: Database, book: dict, entries: list[Entry]) -> StoreStats:
    stats = StoreStats()
    now = utcnow()
    for entry in best_entry_per_word(entries):
        new_word = {
            "word": display_word(entry.headword),
            "word_key": entry.word_key,
            "part_of_speech": entry.part_of_speech,
            "pronunciation": entry.pronunciation,
            "definition": entry.definition,
            "definition_source": {"book_id": book["_id"], "page": entry.page},
            "examples": [{"text": t, "source": "book"} for t in entry.examples],
            "synonyms": entry.synonyms,
            "antonyms": entry.antonyms,
            "level": None,
            "status": "pending",
            "needs_review": entry.needs_review,
            "review_reasons": entry.reasons,
            "admin_edited": False,
            "created_at": now,
            "updated_at": now,
        }
        result = db.vocabulary_words.update_one({"word_key": entry.word_key}, {"$setOnInsert": new_word}, upsert=True)
        if result.upserted_id is not None:
            word_id = result.upserted_id
            stats.new_words += 1
        else:
            existing = db.vocabulary_words.find_one({"word_key": entry.word_key})
            word_id = existing["_id"]
            if not existing.get("admin_edited"):
                updates: dict = {}
                if not existing.get("pronunciation") and entry.pronunciation:
                    updates["pronunciation"] = entry.pronunciation
                if not existing.get("definition") and entry.definition:
                    updates.update(
                        definition=entry.definition,
                        part_of_speech=existing.get("part_of_speech") or entry.part_of_speech,
                        definition_source={"book_id": book["_id"], "page": entry.page},
                    )
                add_to_set = {
                    "synonyms": {"$each": entry.synonyms},
                    "antonyms": {"$each": entry.antonyms},
                    "examples": {"$each": [{"text": t, "source": "book"} for t in entry.examples]},
                }
                change: dict = {"$addToSet": add_to_set}
                if updates:
                    updates["updated_at"] = now
                    change["$set"] = updates
                db.vocabulary_words.update_one({"_id": word_id}, change)

        db.vocabulary_sources.update_one(
            {"word_id": word_id, "book_id": book["_id"], "page": entry.page},
            {"$set": {
                "book_slot": book["slot"],
                "book_title": book["title"],
                "headword_as_printed": entry.headword,
                "part_of_speech": entry.part_of_speech,
                "definition": entry.definition,
                "raw_text": entry.raw_text[:1000],
                "confidence": entry.confidence,
                "review_reasons": entry.reasons,
                "created_at": now,
            }},
            upsert=True,
        )
        stats.words += 1
        if entry.needs_review:
            stats.flagged += 1
    return stats


def process_book(db: Database, book_id: ObjectId) -> None:
    """Runs in the background after upload or reprocess. Never raises: failures are saved on the book."""
    book = db.vocabulary_books.find_one({"_id": book_id})
    if book is None:
        return
    db.vocabulary_books.update_one({"_id": book_id}, {"$set": {"status": "processing", "error": None}})
    try:
        data = book_files(db).get(book["file_id"]).read()
        result = extract_entries_from_pdf(data)
        if result.text_chars == 0:
            raise ExtractionError(
                "No text could be read from this PDF. It may be scanned images — OCR is not supported yet."
            )
        if not result.entries:
            raise ExtractionError(
                "Text was found, but no dictionary-style entries were recognised "
                "(e.g. a bold headword, or “word (n.): definition”)."
            )
        remove_book_vocabulary(db, book_id)
        stats = store_entries(db, book, result.entries)
        db.vocabulary_books.update_one({"_id": book_id}, {"$set": {
            "status": "ready",
            "error": None,
            "page_count": result.page_count,
            "word_count": stats.words,
            "new_word_count": stats.new_words,
            "flagged_count": stats.flagged,
            "processed_at": utcnow(),
        }})
    except ExtractionError as exc:
        db.vocabulary_books.update_one({"_id": book_id}, {"$set": {"status": "failed", "error": str(exc), "processed_at": utcnow()}})
    except Exception:
        logger.exception("Processing book %s failed", book_id)
        db.vocabulary_books.update_one({"_id": book_id}, {"$set": {
            "status": "failed",
            "error": "Unexpected error while processing this PDF. Check the server log for details.",
            "processed_at": utcnow(),
        }})
