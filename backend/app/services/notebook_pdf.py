"""Exports notebook entries to a PDF with PyMuPDF's Story API (HTML → paginated PDF)."""

import html
import io

import fitz

CATEGORY_TITLES = {
    "vocabulary": "My Vocabulary",
    "expressions": "My Expressions",
    "sentences": "My Sentences",
    "mistakes": "My Mistakes",
}

CSS = """
* { font-family: sans-serif; }
h1 { font-size: 20pt; color: #142D36; margin-bottom: 2pt; }
p.meta { font-size: 9pt; color: #556469; margin-top: 0; }
h2 { font-size: 13pt; color: #142D36; margin-top: 14pt; border-bottom: 1px solid #C5E5D5; }
h3 { font-size: 11pt; margin-bottom: 2pt; }
p { font-size: 10pt; line-height: 1.4; margin-top: 0; }
p.tags { font-size: 8pt; color: #556469; }
"""


def _entry_html(entry: dict) -> str:
    parts = [f"<h3>{'★ ' if entry.get('favourite') else ''}{html.escape(entry['title'])}</h3>"]
    for paragraph in (entry.get("content") or "").split("\n"):
        if paragraph.strip():
            parts.append(f"<p>{html.escape(paragraph)}</p>")
    if entry.get("tags"):
        parts.append(f"<p class='tags'>{html.escape(' · '.join('#' + t for t in entry['tags']))}</p>")
    return "".join(parts)


def build_notebook_pdf(learner_name: str, entries: list[dict], exported_on: str) -> bytes:
    sections = []
    for category, title in CATEGORY_TITLES.items():
        items = [e for e in entries if e["category"] == category]
        if items:
            sections.append(f"<h2>{title}</h2>" + "".join(_entry_html(e) for e in items))
    body = "".join(sections) or "<p>Your notebook is empty.</p>"
    document = (
        f"<h1>{html.escape(learner_name)}’s FluentDay notebook</h1>"
        f"<p class='meta'>Exported on {html.escape(exported_on)} · {len(entries)} entries</p>{body}"
    )

    buffer = io.BytesIO()
    writer = fitz.DocumentWriter(buffer)
    story = fitz.Story(html=document, user_css=CSS)
    page_rect = fitz.paper_rect("a4")
    content_rect = page_rect + (54, 54, -54, -54)
    more = True
    while more:
        device = writer.begin_page(page_rect)
        more, _ = story.place(content_rect)
        story.draw(device)
        writer.end_page()
    writer.close()
    return buffer.getvalue()
