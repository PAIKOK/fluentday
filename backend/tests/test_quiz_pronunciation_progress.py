import random

from bson import ObjectId

from app.services.activity import last_months, longest_streak
from app.services.pronunciation import assess, heard_target
from app.services.quiz import BLANK, MATCH_SIZE, QUIZ_SIZE, build_question, build_quiz, grade
from tests.conftest import sign_up
from tests.test_lessons import add_words


def word(text, definition, examples=(), synonyms=(), antonyms=()):
    return {"_id": ObjectId(), "word": text, "definition": definition, "examples": [{"text": e} for e in examples],
            "synonyms": list(synonyms), "antonyms": list(antonyms)}


CANDID = word("candid", "truthful and straightforward; frank", ["She gave a candid answer."], ["frank", "honest"], ["secretive"])
POOL = [
    CANDID,
    word("brisk", "quick and energetic", ["We went for a brisk walk."], ["lively"], ["slow"]),
    word("vivid", "producing clear images in the mind", ["He has vivid memories of the war."], ["bright"], ["dull"]),
    word("frugal", "careful with money", ["They lived a frugal life."], ["thrifty"], ["wasteful"]),
    word("serene", "calm and peaceful", [], ["tranquil"], ["agitated"]),
]


# --- Quiz rules ----------------------------------------------------------------


def test_each_question_type_hides_its_answer_in_the_options():
    rng = random.Random(1)
    for kind in ("meaning", "synonym", "antonym", "complete_sentence", "listen"):
        q = build_question(kind, CANDID, POOL, rng)
        assert q is not None, kind
        assert len(q["options"]) == 4 and len(set(q["options"])) == 4
        assert grade(q, q["answer"]) and not grade(q, (q["answer"] + 1) % 4)
    q = build_question("synonym", CANDID, POOL, rng)
    assert q["options"][q["answer"]] in ("frank", "honest")
    assert "secretive" not in q["options"]  # an antonym is never offered as a wrong synonym


def test_fill_blank_removes_the_word_and_accepts_any_case():
    q = build_question("fill_blank", CANDID, POOL, random.Random(1))
    assert q["sentence"] == f"She gave a {BLANK} answer."
    assert grade(q, " Candid ") and not grade(q, "candor") and not grade(q, 0)


def test_questions_need_the_right_data():
    assert build_question("fill_blank", POOL[4], POOL, random.Random(1)) is None   # no example sentence
    assert build_question("meaning", CANDID, [CANDID], random.Random(1)) is None   # not enough wrong options


def test_quiz_mixes_types_and_is_reproducible():
    questions = build_quiz(POOL, POOL, seed="u:2026-11-18")
    assert len(questions) == QUIZ_SIZE
    assert questions[0]["type"] == "match" and len(questions[0]["items"]) == MATCH_SIZE
    assert len({q["type"] for q in questions}) >= 4
    assert len({(tuple(q["word_ids"]), q["type"]) for q in questions}) == len(questions)  # no duplicate question
    assert [q["id"] for q in questions] == [f"q{i}" for i in range(1, QUIZ_SIZE + 1)]
    assert build_quiz(POOL, POOL, seed="u:2026-11-18") == questions
    match = questions[0]
    assert grade(match, match["answer"]) and not grade(match, list(reversed(match["answer"])))


# --- Pronunciation rules ----------------------------------------------------------


def test_heard_target_matches_whole_words_only():
    assert heard_target("Candid.", "candid")
    assert heard_target("she was candid with me", "candid")
    assert heard_target("break the ice", "break the ice")
    assert not heard_target("candidate", "candid")
    assert not heard_target("", "candid")


def test_assess_uses_any_alternative_and_supports_self_check():
    result = assess("candid", ["candy did", "candid"])
    assert result.recognised is True and result.heard == "candid" and result.method == "browser_recognition"
    assert assess("candid", ["candy"]).recognised is False
    assert assess("candid", [], self_check=False).method == "self_check"
    assert assess("candid", ["candid"], self_check=True).recognised is None


# --- Progress helpers -------------------------------------------------------------


def test_longest_streak_and_months():
    assert longest_streak({"2026-11-01", "2026-11-02", "2026-11-05", "2026-11-06", "2026-11-07"}) == 3
    assert longest_streak(set()) == 0
    assert last_months("2026-02-10", 4) == ["2025-11", "2025-12", "2026-01", "2026-02"]


# --- API --------------------------------------------------------------------------


def learn_words(client, n):
    words = client.get("/api/lessons/today").json()["words"][:n]
    for w in words:
        client.patch(f"/api/vocabulary/{w['id']}/progress", json={"learned": True})
    return words


def test_quiz_unlocks_after_learning_and_only_tests_learned_words(client, db):
    add_words(db, 10)
    sign_up(client, db, "ana@example.com")
    learn_words(client, 3)
    locked = client.get("/api/quiz/today").json()
    assert locked["attempt"] is None and locked["learned_words"] == 3
    assert client.post("/api/quiz/practice").status_code == 409

    learned = {w["id"] for w in learn_words(client, 5)}
    quiz = client.get("/api/quiz/today").json()["attempt"]
    assert quiz["kind"] == "daily" and quiz["result"] is None
    assert client.get("/api/quiz/today").json()["attempt"]["id"] == quiz["id"]  # one daily quiz per day
    for q in quiz["questions"]:
        assert "answer" not in q and "explanation" not in q
    stored = db.quiz_attempts.find_one({"_id": ObjectId(quiz["id"])})
    tested = {str(i) for q in stored["questions"] for i in q["word_ids"]}
    assert tested <= learned

    answers = [q["answer"] for q in stored["questions"]]
    answers[-1] = None  # leave one blank
    result = client.post(f"/api/quiz/{quiz['id']}/submit", json={"answers": answers}).json()["result"]
    assert result["score"] == len(answers) - 1 and result["total"] == len(answers)
    assert all(i["explanation"] and i["correct_answer"] for i in result["items"])
    assert client.post(f"/api/quiz/{quiz['id']}/submit", json={"answers": answers}).status_code == 409

    history = client.get("/api/quiz/history").json()
    assert history["quizzes_taken"] == 1 and history["accuracy"] == round((len(answers) - 1) / len(answers), 3)
    assert client.get("/api/dashboard").json()["quiz_done"] is True
    assert client.post("/api/quiz/practice").json()["kind"] == "practice"

    client.post("/api/auth/logout")
    sign_up(client, db, "ben@example.com")
    assert client.get(f"/api/quiz/{quiz['id']}").status_code == 404


def test_pronunciation_challenge_attempts_and_history(client, db):
    add_words(db, 7)
    sign_up(client, db, "ana@example.com")
    today = client.get("/api/pronunciation/today").json()
    assert today["accent"] == "british" and len(today["words"]) == 5 and today["completed"] is False

    first = today["words"][0]
    r = client.post("/api/pronunciation/attempts", json={"word_id": first["id"], "accent": "american", "transcripts": [f"  {first['word']} "]})
    assert r.status_code == 201 and r.json()["recognised"] is True
    r = client.post("/api/pronunciation/attempts", json={"word_id": first["id"], "accent": "british", "transcripts": ["something else"]})
    assert r.json()["recognised"] is False and r.json()["heard"] == "something else"
    assert client.post("/api/pronunciation/attempts", json={"word_id": str(ObjectId()), "accent": "british"}).status_code == 404

    for w in today["words"][1:]:
        client.post("/api/pronunciation/attempts", json={"word_id": w["id"], "accent": "british", "self_check": True})
    today = client.get("/api/pronunciation/today").json()
    assert today["completed"] is True and today["words"][0]["attempts_today"] == 2 and today["words"][0]["recognised_today"]
    assert client.get("/api/dashboard").json()["speaking_challenge_done"] is True

    history = client.get("/api/pronunciation/history").json()
    assert history["total_attempts"] == 6 and history["recognised_attempts"] == 1 and history["days_practised"] == 1


def test_progress_summary_counts_real_activity(client, db):
    add_words(db, 7, level="beginner")
    sign_up(client, db, "ana@example.com")
    empty = client.get("/api/progress").json()
    assert empty["words_learned"] == 0 and empty["quiz_accuracy"] is None and empty["streak_days"] == 0
    assert len(empty["weekly"]) == 7 and len(empty["monthly"]) == 6

    learn_words(client, 2)
    word_id = client.get("/api/lessons/today").json()["words"][0]["id"]
    client.post("/api/pronunciation/attempts", json={"word_id": word_id, "accent": "british", "self_check": True})
    p = client.get("/api/progress").json()
    assert p["words_learned"] == 2 and p["in_revision"] == 2 and p["words_mastered"] == 0
    assert p["speaking_attempts"] == 1 and p["streak_days"] == 1 and p["longest_streak"] == 1
    assert p["weekly"][-1] == {"date": p["today"], "words_learned": 2, "revisions": 0, "videos": 0, "quizzes": 0, "speaking": 1}
    assert p["monthly"][-1]["words_learned"] == 2 and p["monthly"][-1]["total_learned"] == 2
    assert {lv["level"]: lv["count"] for lv in p["levels"]}["beginner"] == 2
