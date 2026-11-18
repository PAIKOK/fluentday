"""Extracts dictionary-style vocabulary entries from a PDF.

Only lines that look like dictionary entries are used — a bold headword, or
"word (pos): definition" / "word – definition". Ordinary paragraph text is never
turned into vocabulary. Anything uncertain is kept but flagged for admin review.
"""

import re
import statistics
import unicodedata
from dataclasses import dataclass, field

import fitz  # PyMuPDF

# --- Patterns ---------------------------------------------------------------

_WORD = r"[A-Za-z][A-Za-z'\-]*"
HEADWORD_RE = re.compile(rf"^{_WORD}(?: {_WORD}){{0,3}}$")

POS_ALIASES = {
    "n": "noun", "noun": "noun",
    "v": "verb", "vb": "verb", "vt": "verb", "vi": "verb", "verb": "verb",
    "adj": "adjective", "adjective": "adjective",
    "adv": "adverb", "adverb": "adverb",
    "prep": "preposition", "preposition": "preposition",
    "conj": "conjunction", "conjunction": "conjunction",
    "pron": "pronoun", "pronoun": "pronoun",
    "interj": "interjection", "interjection": "interjection",
    "det": "determiner", "determiner": "determiner",
    "phr v": "phrasal verb", "phrasal verb": "phrasal verb",
    "idiom": "idiom", "phrase": "phrase",
}
_POS_ALT = "|".join(sorted((re.escape(k) for k in POS_ALIASES), key=len, reverse=True))
# "(n.)", "n.", "adj", "[verb]" at the start of the text after the headword.
LEADING_POS_RE = re.compile(rf"^[\(\[]?\s*(?P<pos>{_POS_ALT})\.?\s*[\)\]]?(?=[\s:,\-–—]|$)", re.IGNORECASE)
PRONUNCIATION_RE = re.compile(r"^(/[^/]{1,40}/|\[[^\]]{1,40}\])\s*")
LEADING_DELIM_RE = re.compile(r"^[\s:;,.\-–—]+")
# "word (pos): definition", "word – definition", "12. word: definition"
DELIMITED_RE = re.compile(
    rf"^(?:\d{{1,4}}[.)]\s+)?(?P<word>{_WORD}(?: {_WORD}){{0,2}})\s*"
    rf"(?P<pos>[\(\[]\s*[A-Za-z. ]{{1,15}}[\)\]])?\s*"
    rf"(?P<pron>/[^/]{{1,40}}/)?\s*"
    r"(?::|\s[–—-]\s|[–—])\s*(?P<rest>.+)$"
)
EXAMPLE_RE = re.compile(r"^(?:e\.?\s?g\.?|ex(?:ample)?s?)\s*[:.]?\s*(?P<text>.+)$", re.IGNORECASE)
SYNONYM_RE = re.compile(r"^(?:syn(?:onyms?)?|similar)\s*[:.]\s*(?P<text>.+)$", re.IGNORECASE)
ANTONYM_RE = re.compile(r"^(?:ant(?:onyms?)?|opposite)\s*[:.]\s*(?P<text>.+)$", re.IGNORECASE)

# Labels that look like "Word: ..." but are never vocabulary entries.
LABEL_WORDS = {
    "note", "notes", "example", "examples", "exercise", "exercises", "answer", "answers", "chapter",
    "unit", "lesson", "page", "see", "also", "tip", "tips", "remember", "definition", "meaning",
    "synonym", "synonyms", "antonym", "antonyms", "word", "words", "vocabulary", "contents",
    "introduction", "key", "summary", "review", "test", "quiz", "part", "section", "level",
    "source", "sources", "figure", "table", "question", "questions", "instructions", "ex", "eg",
    "syn", "ant", "usage", "pronunciation", "index", "preface",
}
# Very common words: real entries are possible but unlikely in a vocabulary book.
COMMON_WORDS = {
    "a", "an", "the", "and", "or", "but", "if", "of", "to", "in", "on", "at", "by", "for", "with",
    "is", "are", "was", "were", "be", "it", "this", "that", "these", "those", "he", "she", "they",
    "we", "you", "i", "my", "your", "our", "their", "as", "so", "not", "no", "yes", "do", "does",
    "did", "have", "has", "had", "will", "would", "can", "could", "should", "from", "there", "here",
}

MAX_CONTINUATION_LINES = 4
MAX_DEFINITION_CHARS = 600


# --- Data -------------------------------------------------------------------


@dataclass
class Line:
    text: str
    page: int
    bold_prefix: str = ""
    size: float = 0.0
    block_start: bool = False


@dataclass
class Entry:
    headword: str
    word_key: str
    page: int
    raw_text: str
    part_of_speech: str | None = None
    pronunciation: str | None = None
    definition: str | None = None
    examples: list[str] = field(default_factory=list)
    synonyms: list[str] = field(default_factory=list)
    antonyms: list[str] = field(default_factory=list)
    confidence: float = 0.0
    reasons: list[str] = field(default_factory=list)

    @property
    def needs_review(self) -> bool:
        return bool(self.reasons)


@dataclass
class ExtractionResult:
    entries: list[Entry]
    page_count: int
    text_chars: int


class ExtractionError(Exception):
    """A problem with the PDF the admin should see (not a server bug)."""


# --- Normalisation ----------------------------------------------------------


def clean_text(text: str) -> str:
    text = unicodedata.normalize("NFKC", text).replace("’", "'").replace("­", "")
    return " ".join(text.split())


def normalize_headword(text: str) -> str:
    text = clean_text(text)
    text = re.sub(r"\d+$", "", text)  # homograph numbers, e.g. "bank2"
    return text.strip(" .,:;–—-'\"").strip()


def word_key(headword: str) -> str:
    return normalize_headword(headword).lower()


def normalize_pos(raw: str | None) -> str | None:
    if not raw:
        return None
    key = re.sub(r"[\(\)\[\].]", "", raw).strip().lower()
    key = " ".join(key.split())
    return POS_ALIASES.get(key)


def _split_terms(text: str) -> list[str]:
    parts = re.split(r"[,;/]", text)
    return [p.strip(" .").lower() for p in parts if p.strip(" .") and len(p.strip()) <= 40]


# --- PDF reading ------------------------------------------------------------


def _is_bold(span: dict) -> bool:
    font = span.get("font", "").lower()
    return bool(span.get("flags", 0) & 16) or any(w in font for w in ("bold", "black", "heavy", "semibold"))


def read_pdf_lines(data: bytes) -> tuple[list[Line], int]:
    try:
        doc = fitz.open(stream=data, filetype="pdf")
    except Exception as exc:  # PyMuPDF raises several exception types for broken files
        raise ExtractionError("This file could not be opened as a PDF.") from exc
    if doc.needs_pass:
        raise ExtractionError("This PDF is password-protected. Upload an unlocked copy.")

    lines: list[Line] = []
    with doc:
        page_count = doc.page_count
        for page_number, page in enumerate(doc, start=1):
            for block in page.get_text("dict")["blocks"]:
                if block.get("type") != 0:
                    continue
                for index, raw_line in enumerate(block["lines"]):
                    spans = [s for s in raw_line["spans"] if s["text"].strip()]
                    if not spans:
                        continue
                    text = clean_text("".join(s["text"] for s in raw_line["spans"]))
                    bold = []
                    for span in spans:
                        if not _is_bold(span):
                            break
                        bold.append(span["text"])
                    lines.append(
                        Line(
                            text=text,
                            page=page_number,
                            bold_prefix=clean_text("".join(bold)),
                            size=max(s["size"] for s in spans),
                            block_start=index == 0,
                        )
                    )
    return lines, page_count


def _drop_headers_and_footers(lines: list[Line], page_count: int) -> list[Line]:
    """Removes running headers/footers (text repeated on most pages) and bare page numbers."""
    def shape(text: str) -> str:
        return re.sub(r"\d+", "#", text.lower())

    repeated: set[str] = set()
    if page_count >= 4:
        pages_per_shape: dict[str, set[int]] = {}
        for line in lines:
            pages_per_shape.setdefault(shape(line.text), set()).add(line.page)
        repeated = {s for s, pages in pages_per_shape.items() if len(pages) > page_count * 0.5}
    return [
        line for line in lines
        if shape(line.text) not in repeated and not re.fullmatch(r"(page\s*)?\d{1,4}", line.text, re.IGNORECASE)
    ]


# --- Entry detection ----------------------------------------------------------


def _parse_rest(rest: str) -> tuple[str | None, str | None, str | None]:
    """Splits "(n.) /prəˈnʌn/ – definition" into (part of speech, pronunciation, definition)."""
    rest = rest.strip()
    pos = None
    match = LEADING_POS_RE.match(rest)
    if match:
        pos = normalize_pos(match.group("pos"))
        rest = rest[match.end():]
    rest = LEADING_DELIM_RE.sub("", rest)
    pronunciation = None
    pron = PRONUNCIATION_RE.match(rest)
    if pron:
        pronunciation = pron.group(1)
        rest = rest[pron.end():]
    rest = LEADING_DELIM_RE.sub("", rest)
    return pos, pronunciation, (rest.strip() or None)


def match_entry(line: Line, heading_size: float) -> Entry | None:
    if line.size >= heading_size:
        return None  # chapter/section headings are larger than body text

    # 1) Bold headword at the start of the line.
    if line.bold_prefix:
        head = normalize_headword(line.bold_prefix)
        if HEADWORD_RE.match(head) and head.lower() not in LABEL_WORDS:
            rest = line.text[len(line.bold_prefix):] if line.text.startswith(line.bold_prefix) else line.text[len(head):]
            pos, pronunciation, definition = _parse_rest(rest)
            return Entry(
                headword=head, word_key=head.lower(), page=line.page, raw_text=line.text,
                part_of_speech=pos, pronunciation=pronunciation, definition=definition, confidence=0.9,
            )

    # 2) "word (pos): definition" / "word – definition".
    match = DELIMITED_RE.match(line.text)
    if match:
        head = normalize_headword(match.group("word"))
        if head.lower() in LABEL_WORDS or not HEADWORD_RE.match(head):
            return None
        pos_text = match.group("pos")
        pos = normalize_pos(pos_text)
        rest_pos, pronunciation, definition = _parse_rest(match.group("rest"))
        entry = Entry(
            headword=head, word_key=head.lower(), page=line.page, raw_text=line.text,
            part_of_speech=pos or rest_pos, pronunciation=match.group("pron") or pronunciation,
            definition=definition, confidence=0.8 if (pos or rest_pos) else 0.7,
        )
        if pos_text and not pos:
            entry.reasons.append("unrecognised_part_of_speech")
        return entry
    return None


def _append_continuation(entry: Entry, text: str) -> None:
    for regex, target in ((EXAMPLE_RE, entry.examples), (SYNONYM_RE, entry.synonyms), (ANTONYM_RE, entry.antonyms)):
        match = regex.match(text)
        if match:
            if target is entry.examples:
                target.append(match.group("text").strip().strip('"“”'))
            else:
                target.extend(_split_terms(match.group("text")))
            return
    if entry.definition and entry.definition.endswith("-") and text[:1].islower():
        entry.definition = entry.definition[:-1] + text  # re-join a hyphenated line break
    else:
        entry.definition = f"{entry.definition} {text}" if entry.definition else text
    entry.raw_text = f"{entry.raw_text} {text}"


def _validate(entry: Entry) -> None:
    if entry.definition and len(entry.definition) > MAX_DEFINITION_CHARS:
        entry.definition = entry.definition[:MAX_DEFINITION_CHARS].rsplit(" ", 1)[0] + "…"
        entry.reasons.append("definition_truncated")
    if not entry.definition:
        entry.reasons.append("missing_definition")
        entry.confidence -= 0.4
    elif len(entry.definition.split()) < 3:
        entry.reasons.append("short_definition")
        entry.confidence -= 0.2
    if entry.word_key in COMMON_WORDS:
        entry.reasons.append("common_word")
        entry.confidence -= 0.3
    if len(entry.headword.split()) > 2:
        entry.reasons.append("multi_word_headword")
        entry.confidence -= 0.1
    entry.confidence = round(max(0.0, min(1.0, entry.confidence)), 2)


def extract_entries(lines: list[Line], page_count: int) -> list[Entry]:
    lines = _drop_headers_and_footers(lines, page_count)
    sizes = [line.size for line in lines if line.size > 0]
    body_size = statistics.median(sizes) if sizes else 0.0
    heading_size = body_size * 1.2 if body_size else float("inf")

    entries: list[Entry] = []
    current: Entry | None = None
    continuation = 0
    for line in lines:
        entry = match_entry(line, heading_size)
        if entry:
            current, continuation = entry, 0
            entries.append(entry)
            continue
        if current is None or line.size >= heading_size:
            current = None
            continue
        # A new text block ends a finished entry; a headword-only line may take its definition from the next block.
        same_page = line.page == current.page
        if (line.block_start and current.definition) or not same_page or continuation >= MAX_CONTINUATION_LINES:
            current = None
            continue
        _append_continuation(current, line.text)
        continuation += 1

    for entry in entries:
        _validate(entry)
    return [e for e in entries if len(e.word_key) >= 2]


def best_entry_per_word(entries: list[Entry]) -> list[Entry]:
    """Keeps one entry per word within a book: the most confident, earliest page first."""
    best: dict[str, Entry] = {}
    for entry in entries:
        kept = best.get(entry.word_key)
        if kept is None or entry.confidence > kept.confidence:
            best[entry.word_key] = entry
    return sorted(best.values(), key=lambda e: (e.page, e.word_key))


def extract_entries_from_pdf(data: bytes) -> ExtractionResult:
    lines, page_count = read_pdf_lines(data)
    text_chars = sum(len(line.text) for line in lines)
    return ExtractionResult(entries=extract_entries(lines, page_count), page_count=page_count, text_chars=text_chars)


def pdf_page_count(data: bytes) -> int:
    """Validates that `data` is an openable, unlocked PDF and returns its page count."""
    try:
        with fitz.open(stream=data, filetype="pdf") as doc:
            if doc.needs_pass:
                raise ExtractionError("This PDF is password-protected. Upload an unlocked copy.")
            return doc.page_count
    except ExtractionError:
        raise
    except Exception as exc:
        raise ExtractionError("This file could not be opened as a PDF.") from exc


__all__ = [
    "Entry", "ExtractionError", "ExtractionResult", "Line", "best_entry_per_word", "extract_entries",
    "extract_entries_from_pdf", "match_entry", "normalize_headword", "normalize_pos", "pdf_page_count", "word_key",
]
