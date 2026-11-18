from datetime import datetime
from typing import Literal

from pydantic import BaseModel

BookStatus = Literal["queued", "processing", "ready", "failed"]


class BookOut(BaseModel):
    id: str
    slot: int
    title: str
    filename: str
    size_bytes: int
    page_count: int | None
    status: BookStatus
    error: str | None
    word_count: int
    new_word_count: int
    flagged_count: int
    uploaded_at: datetime
    processed_at: datetime | None


class BookSlotOut(BaseModel):
    slot: int
    book: BookOut | None
