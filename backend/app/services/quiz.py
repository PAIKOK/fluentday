"""Quizzes built only from words the learner has already learned.

Questions are stored with their answers on the server. The learner sees prompts and options only;
answers and explanations come back after they submit. Wrong options may come from other words, but
every word being *tested* is one the learner has learned or mastered.
"""

import random
import re
from typing import Literal

from bson import ObjectId
from pymongo.database import Database

QUIZ_SIZE = 8
MIN_LEARNED_WORDS = 4
OPTION_COUNT = 4
MATCH_SIZE = 4
BLANK = "_____"

QuestionType = Literal["meaning", "match", "fill_blank", "synonym", "antonym", "complete_sentence", "listen"]
# The order single-word question types are tried in; each word starts at a different point in the cycle.
SINGLE_TYPES: tuple[QuestionType, ...] = ("meaning", "synonym", "fill_blank", "listen", "antonym", "complete_sentence")


# --- Pure helpers (no database) ---------------------------------------------


def normalize_answer(text: str) -> str:
    return " ".join(re.sub(r"[^\w\s'-]", " ", text.lower().replace("’", "'")).split())


def find_in_sentence(sentence: str, word: str) -> re.Match | None:
    """The word inside an example sentence, also as a simple inflection (candid → candidly is NOT matched)."""
    return re.search(rf"\b{re.escape(word)}(?:s|es|ed|d|ing)?\b", sentence, re.IGNORECASE)


def _sentence_with(word: dict) -> tuple[str, str] | None:
    """(sentence with a blank, the exact form that was removed) from the word's first usable example."""
    for example in word.get("examples", []):
        match = find_in_sentence(example["text"], word["word"])
        if match:
            text = example["text"]
            return text[: match.start()] + BLANK + text[match.end():], match.group(0)
    return None


def _options(correct: str, candidates: list[str], rng: random.Random, exclude: set[str] = frozenset()) -> tuple[list[str], int] | None:
    """`correct` plus three distinct wrong options, shuffled. None if there aren't enough wrong options."""
    seen = {normalize_answer(correct)} | {normalize_answer(e) for e in exclude}
    wrong: list[str] = []
    for c in rng.sample(candidates, len(candidates)):
        key = normalize_answer(c)
        if key and key not in seen:
            seen.add(key)
            wrong.append(c)
        if len(wrong) == OPTION_COUNT - 1:
            break
    if len(wrong) < OPTION_COUNT - 1:
        return None
    options = [correct, *wrong]
    rng.shuffle(options)
    return options, options.index(correct)


def _meaning_of(word: dict) -> str:
    return f"“{word['word']}” means: {word['definition']}"


def build_question(kind: QuestionType, word: dict, pool: list[dict], rng: random.Random) -> dict | None:
    """One question about `word`, or None if the word lacks what this question type needs.
    `pool` holds other words, used only for wrong options."""
    others = [w for w in pool if w["_id"] != word["_id"]]
    other_words = [w["word"] for w in others]
    base = {"type": kind, "word_ids": [word["_id"]]}

    if kind == "meaning":
        picked = _options(word["definition"], [w["definition"] for w in others if w.get("definition")], rng)
        if not picked:
            return None
        return {**base, "prompt": f"What does “{word['word']}” mean?", "options": picked[0], "answer": picked[1],
                "explanation": _meaning_of(word)}

    if kind in ("synonym", "antonym"):
        terms = word.get(f"{kind}s", [])
        if not terms:
            return None
        correct = rng.choice(terms)
        related = set(word.get("synonyms", [])) | set(word.get("antonyms", [])) | {word["word"]}
        candidates = other_words + [t for w in others for t in (*w.get("synonyms", []), *w.get("antonyms", []))]
        picked = _options(correct, candidates, rng, exclude=related)
        if not picked:
            return None
        relation = "closest in meaning to" if kind == "synonym" else "opposite in meaning to"
        return {**base, "prompt": f"Which word is {relation} “{word['word']}”?", "options": picked[0], "answer": picked[1],
                "explanation": f"“{correct}” is {'a synonym' if kind == 'synonym' else 'an antonym'} of “{word['word']}”. {_meaning_of(word)}"}

    if kind in ("fill_blank", "complete_sentence"):
        found = _sentence_with(word)
        if not found:
            return None
        sentence, form = found
        explanation = f"Full sentence: {sentence.replace(BLANK, form)} {_meaning_of(word)}"
        if kind == "fill_blank":
            return {**base, "prompt": "Type the missing word.", "sentence": sentence,
                    "hint": f"Starts with “{form[0].lower()}”, {len(form)} letters", "answer": form, "explanation": explanation}
        picked = _options(form, other_words, rng)
        if not picked:
            return None
        return {**base, "prompt": "Choose the word that completes the sentence.", "sentence": sentence,
                "options": picked[0], "answer": picked[1], "explanation": explanation}

    if kind == "listen":
        picked = _options(word["word"], other_words, rng)
        if not picked:
            return None
        return {**base, "prompt": "Listen, then choose the word you heard.", "speak_text": word["word"],
                "options": picked[0], "answer": picked[1], "explanation": f"You heard “{word['word']}”. {_meaning_of(word)}"}
    return None


def build_match(words: list[dict], rng: random.Random) -> dict:
    """Match each word with its meaning. The answer lists, for each word, the index of its meaning."""
    meanings = [w["definition"] for w in words]
    order = list(range(len(words)))
    rng.shuffle(order)
    options = [meanings[i] for i in order]
    return {
        "type": "match",
        "word_ids": [w["_id"] for w in words],
        "prompt": "Match each word with its meaning.",
        "items": [w["word"] for w in words],
        "options": options,
        "answer": [order.index(i) for i in range(len(words))],
        "explanation": " · ".join(f"“{w['word']}”: {w['definition']}" for w in words),
    }


def build_quiz(learned: list[dict], pool: list[dict], seed: str, size: int = QUIZ_SIZE) -> list[dict]:
    """Up to `size` questions about the `learned` words (difficult words first), mixing question types.
    Words are reused with a different question type only when there are too few of them."""
    rng = random.Random(seed)
    learned = [w for w in learned if w.get("definition")]
    rng.shuffle(learned)
    learned.sort(key=lambda w: not w.get("difficult", False))
    pool = pool + [w for w in learned if w["_id"] not in {p["_id"] for p in pool}]
    questions: list[dict] = []
    if len(learned) >= MATCH_SIZE:
        questions.append(build_match(learned[:MATCH_SIZE], rng))

    used: set[tuple[ObjectId, str]] = set()
    for round_ in range(len(SINGLE_TYPES)):
        added = False
        for i, word in enumerate(learned):
            if len(questions) >= size:
                break
            for step in range(len(SINGLE_TYPES)):
                kind = SINGLE_TYPES[(i + round_ + step) % len(SINGLE_TYPES)]
                if (word["_id"], kind) in used:
                    continue
                question = build_question(kind, word, pool, rng)
                if question:
                    used.add((word["_id"], kind))
                    questions.append(question)
                    added = True
                    break
        if len(questions) >= size or not added:
            break
    for n, q in enumerate(questions, start=1):
        q["id"] = f"q{n}"
    return questions


def grade(question: dict, response: int | str | list[int] | None) -> bool:
    answer = question["answer"]
    if question["type"] == "fill_blank":
        return isinstance(response, str) and normalize_answer(response) == normalize_answer(answer)
    if question["type"] == "match":
        return isinstance(response, list) and response == answer
    return isinstance(response, int) and not isinstance(response, bool) and response == answer


def correct_answer_text(question: dict) -> str:
    if question["type"] == "fill_blank":
        return question["answer"]
    if question["type"] == "match":
        return " · ".join(f"{item} → {question['options'][i]}" for item, i in zip(question["items"], question["answer"]))
    return question["options"][question["answer"]]


# --- Database operations ----------------------------------------------------

WORD_FIELDS = {"word": 1, "definition": 1, "examples": 1, "synonyms": 1, "antonyms": 1}
POOL_SIZE = 40


def learned_word_docs(db: Database, user_id: ObjectId) -> list[dict]:
    progress = {p["word_id"]: p for p in db.user_vocabulary_progress.find(
        {"user_id": user_id, "status": {"$in": ["learned", "mastered"]}}, {"word_id": 1, "difficult": 1})}
    words = db.vocabulary_words.find({"_id": {"$in": list(progress)}, "definition": {"$nin": [None, ""]}}, WORD_FIELDS)
    return [{**w, "difficult": progress[w["_id"]].get("difficult", False)} for w in words]


def daily_quiz_done(db: Database, user_id: ObjectId, day: str) -> bool:
    return db.quiz_attempts.count_documents({"user_id": user_id, "quiz_date": day, "kind": "daily", "result": {"$ne": None}}) > 0


def distractor_pool(db: Database, user_id: ObjectId) -> list[dict]:
    """Words for wrong options: the learner's own words first, then other approved words."""
    assigned = db.user_vocabulary_progress.distinct("word_id", {"user_id": user_id})
    pool = list(db.vocabulary_words.find({"_id": {"$in": assigned}}, WORD_FIELDS).limit(POOL_SIZE))
    if len(pool) < POOL_SIZE:
        pool += list(db.vocabulary_words.find(
            {"status": "approved", "definition": {"$nin": [None, ""]}, "_id": {"$nin": assigned}}, WORD_FIELDS,
        ).limit(POOL_SIZE - len(pool)))
    return pool
