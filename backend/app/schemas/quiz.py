from datetime import datetime
from typing import Literal

from typing import Annotated

from pydantic import BaseModel, Field

from app.services.quiz import QuestionType

QuizKind = Literal["daily", "practice"]
Response = int | Annotated[list[int], Field(max_length=10)] | Annotated[str, Field(max_length=100)] | None


class QuizQuestionOut(BaseModel):
    id: str
    type: QuestionType
    prompt: str
    sentence: str | None = None
    hint: str | None = None
    # Text the browser reads aloud for "listen and identify" questions.
    speak_text: str | None = None
    items: list[str] = []
    options: list[str] = []


class QuestionResult(BaseModel):
    question_id: str
    correct: bool
    response: Response
    correct_answer: str
    explanation: str


class QuizResult(BaseModel):
    score: int
    total: int
    items: list[QuestionResult]
    submitted_at: datetime


class QuizAttemptOut(BaseModel):
    id: str
    quiz_date: str
    kind: QuizKind
    questions: list[QuizQuestionOut]
    result: QuizResult | None


class QuizToday(BaseModel):
    today: str
    learned_words: int
    min_words: int
    attempt: QuizAttemptOut | None


class QuizSubmit(BaseModel):
    answers: list[Response] = Field(max_length=50)


class QuizHistoryItem(BaseModel):
    id: str
    quiz_date: str
    kind: QuizKind
    score: int
    total: int
    submitted_at: datetime


class QuizHistory(BaseModel):
    items: list[QuizHistoryItem]
    quizzes_taken: int
    accuracy: float | None
