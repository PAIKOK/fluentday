"""Builds small dictionary-style vocabulary PDFs for development and tests.

    python -m scripts.sample_pdfs            # writes sample-data/*.pdf
"""

from pathlib import Path

import fitz

# (headword, rest-of-line) — the headword is drawn in bold, like a printed dictionary.
BOOK_ONE = [
    [
        ("Unit 1: Everyday Words", None),
        ("abundant", " (adj.) existing in large quantities; more than enough."),
        ("e.g. The region has abundant rainfall.", "example"),
        ("benevolent", " adj. well meaning and kindly towards others."),
        ("Syn: kind, generous", "plain"),
        ("Ant: cruel", "plain"),
        ("candid", " (adj.) /KAN-did/ truthful and straightforward; frank."),
        ("This book helps learners build a strong vocabulary through daily practice and short reviews.", "plain"),
    ],
    [
        ("diligent", " (adj.) having or showing care and effort in one's work."),
        ("eloquent", " (adj.) fluent or persuasive in speaking or writing."),
        ("frugal", " (adj.) careful about spending money or using resources."),
        ("the", " (det.) used before nouns."),
        ("gregarious", ""),
    ],
]

BOOK_TWO = [
    [
        ("Vocabulary for Work", None),
        ("candid", " (adj.) honest and direct, especially about something difficult."),
        ("hinder", " (v.) to make it difficult for something to happen."),
        ("Note: words in this list are common in office emails.", "plain"),
        ("1. meticulous: showing great attention to detail; very careful.", "plain"),
        ("2. negotiate – to try to reach an agreement by discussion.", "plain"),
    ],
]


def build_pdf(pages: list[list[tuple[str, str | None]]]) -> bytes:
    doc = fitz.open()
    for lines in pages:
        page = doc.new_page()
        y = 72
        for head, rest in lines:
            if rest is None:  # heading
                page.insert_text((72, y), head, fontname="hebo", fontsize=18)
                y += 34
            elif rest in ("plain", "example"):
                page.insert_text((72, y), head, fontname="helv", fontsize=11)
                y += 24
            else:
                page.insert_text((72, y), head, fontname="hebo", fontsize=11)
                if rest:
                    x = 72 + fitz.get_text_length(head, fontname="hebo", fontsize=11)
                    page.insert_text((x, y), rest, fontname="helv", fontsize=11)
                y += 24
    data = doc.tobytes()
    doc.close()
    return data


def main() -> None:
    out = Path(__file__).resolve().parent.parent / "sample-data"
    out.mkdir(exist_ok=True)
    (out / "sample-book-1.pdf").write_bytes(build_pdf(BOOK_ONE))
    (out / "sample-book-2.pdf").write_bytes(build_pdf(BOOK_TWO))
    print(f"Wrote sample PDFs to {out}")


if __name__ == "__main__":
    main()
