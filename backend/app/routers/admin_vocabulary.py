import re

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError

from app.db import as_utc, utcnow
from app.deps import get_db, parse_object_id, require_admin
from app.schemas.common import ProficiencyLevel, WordStatus
from app.schemas.vocabulary import (
    BulkStatusIn,
    BulkStatusOut,
    Example,
    StarterVocabularyOut,
    WordOut,
    WordPage,
    WordSourceOut,
    WordUpdate,
)
from app.services.pdf_extraction import normalize_headword
from app.services.starter_vocabulary import load_starter_vocabulary, read_starter_file

router = APIRouter(prefix="/admin/vocabulary", tags=["admin: vocabulary"], dependencies=[Depends(require_admin)])

CONTENT_FIELDS = ("word", "part_of_speech", "pronunciation", "definition", "examples", "synonyms", "antonyms", "level")


def _sources_by_word(db: Database, word_ids: list[ObjectId]) -> dict[ObjectId, list[WordSourceOut]]:
    grouped: dict[ObjectId, list[WordSourceOut]] = {wid: [] for wid in word_ids}
    for s in db.vocabulary_sources.find({"word_id": {"$in": word_ids}}).sort([("book_slot", 1), ("page", 1)]):
        grouped[s["word_id"]].append(WordSourceOut(
            book_id=str(s["book_id"]),
            book_slot=s["book_slot"],
            book_title=s["book_title"],
            page=s["page"],
            definition=s.get("definition"),
            raw_text=s.get("raw_text", ""),
            confidence=s.get("confidence", 0.0),
        ))
    return grouped


def word_out(word: dict, sources: list[WordSourceOut]) -> WordOut:
    return WordOut(
        id=str(word["_id"]),
        word=word["word"],
        part_of_speech=word.get("part_of_speech"),
        pronunciation=word.get("pronunciation"),
        definition=word.get("definition"),
        examples=[Example(**e) for e in word.get("examples", [])],
        synonyms=word.get("synonyms", []),
        antonyms=word.get("antonyms", []),
        level=word.get("level"),
        status=word["status"],
        needs_review=word.get("needs_review", False),
        review_reasons=word.get("review_reasons", []),
        admin_edited=word.get("admin_edited", False),
        sources=sources,
        starter_rank=word.get("starter_rank"),
        updated_at=as_utc(word["updated_at"]),
    )


@router.get("", response_model=WordPage)
def list_words(
    db: Database = Depends(get_db),
    q: str | None = Query(default=None, max_length=50),
    status_filter: WordStatus | None = Query(default=None, alias="status"),
    level: ProficiencyLevel | None = None,
    needs_review: bool | None = None,
    slot: int | None = Query(default=None, ge=1, le=3),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
):
    query: dict = {}
    if q and q.strip():
        query["word_key"] = {"$regex": re.escape(q.strip().lower())}
    if status_filter:
        query["status"] = status_filter
    if level:
        query["level"] = level
    if needs_review is not None:
        query["needs_review"] = needs_review
    if slot:
        query["_id"] = {"$in": db.vocabulary_sources.distinct("word_id", {"book_slot": slot})}

    total = db.vocabulary_words.count_documents(query)
    words = list(db.vocabulary_words.find(query).sort("word_key", 1).skip((page - 1) * page_size).limit(page_size))
    sources = _sources_by_word(db, [w["_id"] for w in words])
    return WordPage(items=[word_out(w, sources[w["_id"]]) for w in words], total=total, page=page, page_size=page_size)


@router.get("/starter", response_model=StarterVocabularyOut)
def starter_status(db: Database = Depends(get_db)):
    """How many starter words ship with FluentDay and how many are in the database."""
    return StarterVocabularyOut(
        words_in_file=len(read_starter_file()),
        loaded=db.vocabulary_words.count_documents({"starter_rank": {"$ne": None}}),
    )


@router.post("/starter", response_model=StarterVocabularyOut)
def load_starter(db: Database = Depends(get_db)):
    """Adds the starter vocabulary (everyday words with definitions, approved for lessons). Safe to repeat."""
    words = read_starter_file()
    if not words:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "The starter vocabulary file is missing. Run scripts/build_starter_vocabulary.py.")
    stats = load_starter_vocabulary(db, words)
    return StarterVocabularyOut(
        words_in_file=len(words),
        loaded=db.vocabulary_words.count_documents({"starter_rank": {"$ne": None}}),
        added=stats.added,
        updated=stats.updated,
    )


@router.get("/{word_id}", response_model=WordOut)
def get_word(word_id: str, db: Database = Depends(get_db)):
    oid = parse_object_id(word_id)
    word = db.vocabulary_words.find_one({"_id": oid})
    if word is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Word not found.")
    return word_out(word, _sources_by_word(db, [oid])[oid])


@router.patch("/{word_id}", response_model=WordOut)
def update_word(word_id: str, body: WordUpdate, db: Database = Depends(get_db)):
    oid = parse_object_id(word_id)
    word = db.vocabulary_words.find_one({"_id": oid})
    if word is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Word not found.")

    changes = body.model_dump(exclude_unset=True, exclude={"clear_level"})
    clearable = ("definition", "pronunciation", "part_of_speech")
    changes = {k: v for k, v in changes.items() if v is not None or k in clearable}
    if body.clear_level:
        changes["level"] = None
    if "word" in changes:
        changes["word"] = normalize_headword(changes["word"])
        if not changes["word"]:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "The word cannot be empty.")
        changes["word_key"] = changes["word"].lower()
    if "definition" in changes:
        changes["definition"] = " ".join((changes["definition"] or "").split()) or None

    final_definition = changes.get("definition", word.get("definition"))
    if changes.get("status") == "approved" and not final_definition:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Add a definition before approving this word.")
    if any(k in changes for k in CONTENT_FIELDS):
        changes["admin_edited"] = True
    if changes.get("status") in ("approved", "rejected"):
        changes["needs_review"] = False
    changes["updated_at"] = utcnow()

    try:
        db.vocabulary_words.update_one({"_id": oid}, {"$set": changes})
    except DuplicateKeyError:
        raise HTTPException(status.HTTP_409_CONFLICT, "Another entry already uses this word.")
    return get_word(word_id, db)


@router.post("/bulk-status", response_model=BulkStatusOut)
def bulk_status(body: BulkStatusIn, db: Database = Depends(get_db)):
    ids = [parse_object_id(i) for i in body.ids]
    query: dict = {"_id": {"$in": ids}}
    skipped = 0
    if body.status == "approved":
        without_definition = {"_id": {"$in": ids}, "$or": [{"definition": None}, {"definition": ""}]}
        skipped = db.vocabulary_words.count_documents(without_definition)
        query["definition"] = {"$nin": [None, ""]}
    fields: dict = {"status": body.status, "updated_at": utcnow()}
    if body.status != "pending":
        fields["needs_review"] = False
    result = db.vocabulary_words.update_many(query, {"$set": fields})
    return BulkStatusOut(updated=result.modified_count, skipped_without_definition=skipped)
