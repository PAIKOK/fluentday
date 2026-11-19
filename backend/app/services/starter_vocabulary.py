"""Loads the starter vocabulary file (built by scripts/build_starter_vocabulary.py) into the database.

Admins run it from the Vocabulary page. Starter words are added as approved, so they're ready for
lessons. Book words are never overwritten, only filled in where they have no definition yet.
"""

import json
from dataclasses import dataclass
from pathlib import Path

from pymongo.database import Database

from app.db import utcnow
from app.services.pdf_extraction import word_key
from app.services.starter_build import STARTER_FILE

DATASET = "starter"


def read_starter_file(path: Path = STARTER_FILE) -> list[dict]:
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8")).get("words", [])


@dataclass
class LoadStats:
    added: int = 0
    updated: int = 0


def load_starter_vocabulary(db: Database, words: list[dict]) -> LoadStats:
    """Adds starter words as approved, ready for lessons. Safe to run again: existing words are only filled in."""
    stats = LoadStats()
    now = utcnow()
    by_key = {word_key(w["word"]): w for w in words}
    existing = {doc["word_key"]: doc for doc in db.vocabulary_words.find({"word_key": {"$in": list(by_key)}})}

    new_docs = []
    for key, w in by_key.items():
        examples = [{"text": text, "source": "dataset"} for text in w["examples"]]
        doc = existing.get(key)
        if doc is None:
            new_docs.append({
                "word": w["word"], "word_key": key, "part_of_speech": w["part_of_speech"], "pronunciation": w["pronunciation"],
                "definition": w["definition"], "definition_source": {"dataset": DATASET}, "examples": examples,
                "synonyms": w["synonyms"], "antonyms": w["antonyms"], "level": w["level"], "starter_rank": w["rank"],
                "status": "approved", "needs_review": False, "review_reasons": [], "admin_edited": False,
                "created_at": now, "updated_at": now,
            })
            continue
        if doc.get("admin_edited"):
            continue
        fill: dict = {"starter_rank": w["rank"]}
        for field in ("part_of_speech", "pronunciation", "level"):
            if not doc.get(field) and w[field]:
                fill[field] = w[field]
        if doc.get("definition_source") == {"dataset": DATASET} and doc.get("level") != w["level"]:
            fill["level"] = w["level"]  # a starter word follows the file's levels when they change
        if not doc.get("definition"):
            fill.update(definition=w["definition"], definition_source={"dataset": DATASET}, part_of_speech=w["part_of_speech"])
        if fill.keys() == {"starter_rank"} and doc.get("starter_rank") == w["rank"]:
            continue
        fill["updated_at"] = now
        db.vocabulary_words.update_one({"_id": doc["_id"]}, {
            "$set": fill,
            "$addToSet": {"synonyms": {"$each": w["synonyms"]}, "antonyms": {"$each": w["antonyms"]}, "examples": {"$each": examples}},
        })
        stats.updated += 1
    if new_docs:
        db.vocabulary_words.insert_many(new_docs, ordered=False)
        stats.added = len(new_docs)
    return stats
