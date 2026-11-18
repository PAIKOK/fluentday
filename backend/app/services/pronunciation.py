"""Speaking practice.

The browser does the speech recognition and sends what it heard. The server only records it and
checks whether the target word was among the words heard. That is practice feedback, not a
pronunciation score: browser recognition cannot judge individual sounds. `assess` is the single
place where a dedicated speech-assessment service can be plugged in later.
"""

import re
from dataclasses import dataclass
from typing import Literal

from bson import ObjectId
from pymongo.database import Database

CHALLENGE_SIZE = 5
Method = Literal["browser_recognition", "self_check"]


def normalize_speech(text: str) -> str:
    text = text.lower().replace("’", "'")
    return " ".join(re.sub(r"[^a-z0-9'\s]", " ", text.replace("-", " ")).split())


def heard_target(transcript: str, target: str) -> bool:
    """True if the target word (or phrase) appears as whole words in what was recognised."""
    heard, wanted = normalize_speech(transcript), normalize_speech(target)
    return bool(wanted) and f" {wanted} " in f" {heard} "


@dataclass(frozen=True)
class Assessment:
    heard: str | None         # the best transcript, shown back to the learner
    recognised: bool | None   # None when there was nothing to compare (self-check)
    method: Method


def assess(target: str, transcripts: list[str], self_check: bool = False) -> Assessment:
    transcripts = [t.strip() for t in transcripts if t.strip()]
    if self_check or not transcripts:
        return Assessment(heard=transcripts[0] if transcripts else None, recognised=None, method="self_check")
    matching = next((t for t in transcripts if heard_target(t, target)), None)
    return Assessment(heard=matching or transcripts[0], recognised=matching is not None, method="browser_recognition")


def challenge_word_ids(db: Database, user_id: ObjectId, lesson: dict) -> list[ObjectId]:
    """Today's speaking challenge: today's new words first, then today's revision words, then recently learned ones."""
    ids: list[ObjectId] = []
    for word_id in [*lesson.get("word_ids", []), *lesson.get("revision_word_ids", [])]:
        if word_id not in ids:
            ids.append(word_id)
    if len(ids) < CHALLENGE_SIZE:
        recent = db.user_vocabulary_progress.find(
            {"user_id": user_id, "status": {"$in": ["learned", "mastered"]}, "word_id": {"$nin": ids}}, {"word_id": 1},
        ).sort("learned_on", -1).limit(CHALLENGE_SIZE - len(ids))
        ids += [p["word_id"] for p in recent]
    return ids[:CHALLENGE_SIZE]


def practised_today(db: Database, user_id: ObjectId, day: str, word_ids: list[ObjectId]) -> dict[ObjectId, dict]:
    """Per word: attempts today and whether any was recognised."""
    stats: dict[ObjectId, dict] = {}
    for a in db.pronunciation_attempts.find({"user_id": user_id, "practice_date": day, "word_id": {"$in": word_ids}}, {"word_id": 1, "recognised": 1}):
        s = stats.setdefault(a["word_id"], {"attempts": 0, "recognised": False})
        s["attempts"] += 1
        s["recognised"] = s["recognised"] or a.get("recognised") is True
    return stats


def challenge_done(db: Database, user_id: ObjectId, lesson: dict) -> bool:
    """The day's challenge is done when every challenge word has been practised at least once."""
    ids = challenge_word_ids(db, user_id, lesson)
    return bool(ids) and len(practised_today(db, user_id, lesson["lesson_date"], ids)) == len(ids)
