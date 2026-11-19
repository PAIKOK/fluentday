from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pymongo.database import Database

from app.db import as_utc, utcnow
from app.deps import get_current_user, get_db, parse_object_id
from app.schemas.lessons import (
    DashboardOut,
    DashboardVideo,
    DashboardWord,
    LessonOut,
    LessonWord,
    MySentence,
    ProgressUpdate,
    SentenceIn,
    SourceRef,
    WordProgress,
)
from app.schemas.vocabulary import Example
from app.services.activity import active_dates
from app.services.lessons import (
    DAILY_WORD_COUNT,
    MAX_EXTRA_SETS,
    NoMoreWords,
    add_more_words,
    attach_videos,
    generate_lesson,
    lesson_date_for,
    streak_days,
)
from app.services.notebook import create_entry, save_word, unsave_word, word_sentences
from app.services.pronunciation import challenge_done
from app.services.quiz import daily_quiz_done
from app.services.reminders import next_reminder
from app.services.spaced_repetition import first_schedule
from app.services.users import get_profile

router = APIRouter(tags=["learning"])

MAX_SENTENCES = 20


def progress_out(p: dict, sentences: list[dict]) -> WordProgress:
    return WordProgress(
        status=p.get("status", "new"),
        difficult=p.get("difficult", False),
        saved=p.get("saved", False),
        first_lesson_date=p["first_lesson_date"],
        learned_on=p.get("learned_on"),
        revision_stage=p.get("srs_stage", 0),
        next_revision=p.get("due_date"),
        my_sentences=[MySentence(id=str(s["_id"]), text=s.get("content", ""), created_at=as_utc(s["created_at"])) for s in sentences],
    )


def lesson_words(db: Database, user_id: ObjectId, word_ids: list[ObjectId]) -> list[LessonWord]:
    """Full word cards (with this learner's progress) in the given order."""
    if not word_ids:
        return []
    words = {w["_id"]: w for w in db.vocabulary_words.find({"_id": {"$in": word_ids}})}
    progress = {p["word_id"]: p for p in db.user_vocabulary_progress.find({"user_id": user_id, "word_id": {"$in": word_ids}})}
    sentences = word_sentences(db, user_id, word_ids)
    sources: dict[ObjectId, list[dict]] = {}
    for s in db.vocabulary_sources.find({"word_id": {"$in": word_ids}}).sort([("book_slot", 1), ("page", 1)]):
        sources.setdefault(s["word_id"], []).append(s)
    book_titles = {b["_id"]: b["title"] for b in db.vocabulary_books.find({}, {"title": 1})}

    result = []
    for word_id in word_ids:
        w, p = words.get(word_id), progress.get(word_id)
        if w is None or p is None:
            continue  # word deleted by an admin since the lesson was made
        def_src = w.get("definition_source")
        definition_source = None
        if def_src and not w.get("admin_edited") and def_src.get("book_id") in book_titles:
            definition_source = SourceRef(book_title=book_titles[def_src["book_id"]], page=def_src["page"])
        result.append(LessonWord(
            id=str(word_id),
            word=w["word"],
            part_of_speech=w.get("part_of_speech"),
            pronunciation=w.get("pronunciation"),
            definition=w.get("definition"),
            definition_source=definition_source,
            examples=[Example(**e) for e in w.get("examples", [])],
            synonyms=w.get("synonyms", []),
            antonyms=w.get("antonyms", []),
            level=w.get("level"),
            sources=[SourceRef(book_title=s["book_title"], page=s["page"]) for s in sources.get(word_id, [])],
            progress=progress_out(p, sentences.get(word_id, [])),
        ))
    return result


def today_lesson(db: Database, user: dict) -> dict:
    lesson = generate_lesson(db, user, get_profile(db, user)).lesson
    return attach_videos(db, lesson)


def revisions_due(db: Database, user_id: ObjectId, today: str) -> int:
    return db.user_vocabulary_progress.count_documents({"user_id": user_id, "status": "learned", "due_date": {"$lte": today}})


def _assigned_progress(db: Database, user: dict, word_id: str) -> tuple[ObjectId, dict]:
    oid = parse_object_id(word_id)
    progress = db.user_vocabulary_progress.find_one({"user_id": user["_id"], "word_id": oid})
    if progress is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This word isn't in your lessons yet.")
    return oid, progress


def _progress_response(db: Database, user: dict, word_id: ObjectId) -> WordProgress:
    p = db.user_vocabulary_progress.find_one({"user_id": user["_id"], "word_id": word_id})
    return progress_out(p, word_sentences(db, user["_id"], [word_id])[word_id])


def _dashboard_videos(db: Database, user_id: ObjectId, video_ids: list[ObjectId]) -> list[DashboardVideo]:
    videos = {v["_id"]: v for v in db.youtube_videos.find({"_id": {"$in": video_ids}})}
    names = {c["key"]: c["name"] for c in db.youtube_channels.find({}, {"key": 1, "name": 1})}
    done = set(db.video_progress.distinct("video_id", {"user_id": user_id, "video_id": {"$in": video_ids}, "completed": True}))
    return [
        DashboardVideo(
            id=str(i), title=videos[i]["title"], channel_name=names.get(videos[i]["channel_key"], ""),
            thumbnail_url=videos[i]["thumbnail_url"], duration_seconds=videos[i].get("duration_seconds"), completed=i in done,
        )
        for i in video_ids if i in videos
    ]


def lesson_out(db: Database, user: dict, lesson: dict) -> LessonOut:
    words = lesson_words(db, user["_id"], lesson["word_ids"])
    return LessonOut(
        lesson_date=lesson["lesson_date"],
        kind=lesson["kind"],
        level=lesson.get("level"),
        words=words,
        revision_words=lesson_words(db, user["_id"], lesson.get("revision_word_ids", [])),
        learned_count=sum(1 for w in words if w.progress.status != "new"),
        target=DAILY_WORD_COUNT,
        can_add_more=lesson["kind"] != "empty" and lesson.get("extra_sets", 0) < MAX_EXTRA_SETS,
    )


@router.get("/lessons/today", response_model=LessonOut)
def today(user: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    return lesson_out(db, user, today_lesson(db, user))


@router.post("/lessons/today/more", response_model=LessonOut)
def more_words(user: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    """Another set of new words for today, for learners who want more (or found today's too easy)."""
    try:
        lesson = add_more_words(db, user, get_profile(db, user))
    except NoMoreWords as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc))
    return lesson_out(db, user, attach_videos(db, lesson))


@router.get("/dashboard", response_model=DashboardOut)
def dashboard(request: Request, user: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    lesson = today_lesson(db, user)
    words = lesson_words(db, user["_id"], lesson["word_ids"])
    # Any learning activity keeps the streak going: new words, revision, listening, quizzes or speaking.
    active = active_dates(db, user["_id"], lesson.get("timezone"))
    return DashboardOut(
        lesson_date=lesson["lesson_date"],
        lesson_kind=lesson["kind"],
        words_today=[
            DashboardWord(id=w.id, word=w.word, part_of_speech=w.part_of_speech, definition=w.definition, level=w.level, learned=w.progress.status != "new")
            for w in words
        ],
        videos_today=_dashboard_videos(db, user["_id"], lesson.get("video_ids", [])),
        words_learned_total=db.user_vocabulary_progress.count_documents({"user_id": user["_id"], "status": {"$in": ["learned", "mastered"]}}),
        streak_days=streak_days(active, lesson["lesson_date"]),
        revisions_due_today=revisions_due(db, user["_id"], lesson["lesson_date"]),
        speaking_challenge_done=challenge_done(db, user["_id"], lesson),
        quiz_done=daily_quiz_done(db, user["_id"], lesson["lesson_date"]),
        next_reminder=next_reminder(get_profile(db, user), request.app.state.settings),
    )


@router.get("/vocabulary/{word_id}", response_model=LessonWord)
def word_detail(word_id: str, user: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    oid, _ = _assigned_progress(db, user, word_id)
    words = lesson_words(db, user["_id"], [oid])
    if not words:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This word is no longer available.")
    return words[0]


@router.patch("/vocabulary/{word_id}/progress", response_model=WordProgress)
def update_progress(
    word_id: str,
    body: ProgressUpdate,
    request: Request,
    user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    oid, progress = _assigned_progress(db, user, word_id)
    changes: dict = {"updated_at": utcnow()}
    if body.learned is True and progress.get("status") == "new":
        learned_on = lesson_date_for(get_profile(db, user).get("timezone"))
        schedule = first_schedule(learned_on, request.app.state.settings.revision_gap_days)
        changes.update(status="learned", learned_on=learned_on, srs_stage=schedule.stage, due_date=schedule.due_date)
    elif body.learned is False:
        changes.update(status="new", learned_on=None, srs_stage=0, due_date=None)
    if body.difficult is not None:
        changes["difficult"] = body.difficult
    if body.saved is not None:
        changes["saved"] = body.saved
        if body.saved:
            save_word(db, user["_id"], db.vocabulary_words.find_one({"_id": oid}))
        else:
            unsave_word(db, user["_id"], oid)
    db.user_vocabulary_progress.update_one({"_id": progress["_id"]}, {"$set": changes})
    return _progress_response(db, user, oid)


@router.post("/vocabulary/{word_id}/sentences", response_model=WordProgress, status_code=status.HTTP_201_CREATED)
def add_sentence(word_id: str, body: SentenceIn, user: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    oid, _ = _assigned_progress(db, user, word_id)
    if db.notebook_entries.count_documents({"user_id": user["_id"], "category": "sentences", "word_id": oid}) >= MAX_SENTENCES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"You can keep up to {MAX_SENTENCES} sentences per word.")
    word = db.vocabulary_words.find_one({"_id": oid}, {"word": 1})
    create_entry(db, user["_id"], category="sentences", title=f"Sentence with “{word['word']}”", content=body.text, word_id=oid)
    return _progress_response(db, user, oid)


@router.delete("/vocabulary/{word_id}/sentences/{sentence_id}", response_model=WordProgress)
def delete_sentence(word_id: str, sentence_id: str, user: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    oid, _ = _assigned_progress(db, user, word_id)
    db.notebook_entries.delete_one({"_id": parse_object_id(sentence_id), "user_id": user["_id"], "category": "sentences", "word_id": oid})
    return _progress_response(db, user, oid)
