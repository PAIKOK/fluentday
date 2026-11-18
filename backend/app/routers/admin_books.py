import re

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Path, UploadFile, status
from fastapi.responses import StreamingResponse
from gridfs.errors import NoFile
from pymongo.database import Database

from app.config import Settings
from app.db import as_utc, utcnow
from app.deps import get_app_settings, get_db, require_admin
from app.schemas.books import BookOut, BookSlotOut
from app.services.book_processing import book_files, process_book, remove_book_vocabulary
from app.services.pdf_extraction import ExtractionError, pdf_page_count

router = APIRouter(prefix="/admin/books", tags=["admin: books"], dependencies=[Depends(require_admin)])

BOOK_SLOTS = (1, 2, 3)
SlotParam = Path(ge=1, le=3, description="Book slot: FluentDay uses exactly three primary books.")


def book_out(book: dict) -> BookOut:
    return BookOut(
        id=str(book["_id"]),
        slot=book["slot"],
        title=book["title"],
        filename=book["filename"],
        size_bytes=book["size_bytes"],
        page_count=book.get("page_count"),
        status=book["status"],
        error=book.get("error"),
        word_count=book.get("word_count", 0),
        new_word_count=book.get("new_word_count", 0),
        flagged_count=book.get("flagged_count", 0),
        uploaded_at=as_utc(book["uploaded_at"]),
        processed_at=as_utc(book.get("processed_at")),
    )


def _get_book(db: Database, slot: int) -> dict:
    book = db.vocabulary_books.find_one({"slot": slot})
    if book is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No book has been uploaded to slot {slot}.")
    return book


def _safe_filename(name: str | None) -> str:
    name = (name or "book.pdf").rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
    name = re.sub(r"[^\w.\- ]", "_", name).strip() or "book.pdf"
    return name[:120]


@router.get("", response_model=list[BookSlotOut])
def list_books(db: Database = Depends(get_db)):
    books = {b["slot"]: b for b in db.vocabulary_books.find({"slot": {"$in": list(BOOK_SLOTS)}})}
    return [BookSlotOut(slot=s, book=book_out(books[s]) if s in books else None) for s in BOOK_SLOTS]


@router.post("/{slot}", response_model=BookOut, status_code=status.HTTP_201_CREATED)
def upload_book(
    background: BackgroundTasks,
    slot: int = SlotParam,
    file: UploadFile = File(...),
    title: str | None = Form(default=None, max_length=120),
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db),
    settings: Settings = Depends(get_app_settings),
):
    data = file.file.read(settings.max_pdf_bytes + 1)
    if len(data) > settings.max_pdf_bytes:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, f"PDFs must be {settings.max_pdf_mb} MB or smaller.")
    if not data.startswith(b"%PDF-"):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Please upload a PDF file.")
    try:
        page_count = pdf_page_count(data)
    except ExtractionError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc))

    existing = db.vocabulary_books.find_one({"slot": slot})
    if existing and existing["status"] in ("queued", "processing"):
        raise HTTPException(status.HTTP_409_CONFLICT, "This book is still being processed. Try again in a moment.")

    filename = _safe_filename(file.filename)
    clean_title = " ".join((title or "").split()) or filename.removesuffix(".pdf").removesuffix(".PDF")
    file_id = book_files(db).put(data, filename=filename, content_type="application/pdf", slot=slot)
    now = utcnow()
    fields = {
        "slot": slot,
        "title": clean_title,
        "filename": filename,
        "file_id": file_id,
        "size_bytes": len(data),
        "page_count": page_count,
        "status": "queued",
        "error": None,
        "word_count": 0,
        "new_word_count": 0,
        "flagged_count": 0,
        "uploaded_by": admin["_id"],
        "uploaded_at": now,
        "processed_at": None,
    }
    if existing:
        # Replacing: drop the old file and the old book's vocabulary before processing the new one.
        remove_book_vocabulary(db, existing["_id"])
        try:
            book_files(db).delete(existing["file_id"])
        except NoFile:
            pass
        db.vocabulary_books.update_one({"_id": existing["_id"]}, {"$set": fields})
        book_id = existing["_id"]
    else:
        book_id = db.vocabulary_books.insert_one(fields).inserted_id

    background.add_task(process_book, db, book_id)
    return book_out(db.vocabulary_books.find_one({"_id": book_id}))


@router.post("/{slot}/reprocess", response_model=BookOut)
def reprocess_book(background: BackgroundTasks, slot: int = SlotParam, db: Database = Depends(get_db)):
    book = _get_book(db, slot)
    if book["status"] in ("queued", "processing"):
        raise HTTPException(status.HTTP_409_CONFLICT, "This book is already being processed.")
    db.vocabulary_books.update_one({"_id": book["_id"]}, {"$set": {"status": "queued", "error": None}})
    background.add_task(process_book, db, book["_id"])
    return book_out(db.vocabulary_books.find_one({"_id": book["_id"]}))


@router.get("/{slot}/file")
def download_book(slot: int = SlotParam, db: Database = Depends(get_db)):
    """Streams the private PDF to administrators only."""
    book = _get_book(db, slot)
    try:
        grid_out = book_files(db).get(book["file_id"])
    except NoFile:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "The stored PDF is missing. Please upload it again.")
    return StreamingResponse(
        grid_out,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{book["filename"]}"',
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )
