from app.services.pdf_extraction import Line, extract_entries, extract_entries_from_pdf, normalize_headword, normalize_pos
from scripts.sample_pdfs import BOOK_ONE, BOOK_TWO, build_pdf


def by_key(entries):
    return {e.word_key: e for e in entries}


def test_normalisation():
    assert normalize_headword("  Bank2, ") == "Bank"
    assert normalize_headword("don’t") == "don't"
    assert normalize_pos("(adj.)") == "adjective"
    assert normalize_pos("vt") == "verb"
    assert normalize_pos("xyz") is None


def test_bold_headwords_with_part_of_speech_and_definition():
    result = extract_entries_from_pdf(build_pdf(BOOK_ONE))
    words = by_key(result.entries)
    assert result.page_count == 2
    assert words["abundant"].part_of_speech == "adjective"
    assert words["abundant"].definition == "existing in large quantities; more than enough."
    assert words["abundant"].page == 1
    assert words["diligent"].page == 2
    assert not words["abundant"].needs_review


def test_pronunciation_is_kept_separately_from_the_definition():
    words = by_key(extract_entries_from_pdf(build_pdf(BOOK_ONE)).entries)
    assert words["candid"].pronunciation == "/KAN-did/"
    assert words["candid"].definition == "truthful and straightforward; frank."


def test_examples_synonyms_and_antonyms_are_attached_to_their_word():
    words = by_key(extract_entries_from_pdf(build_pdf(BOOK_ONE)).entries)
    assert words["abundant"].examples == ["The region has abundant rainfall."]
    assert words["benevolent"].synonyms == ["kind", "generous"]
    assert words["benevolent"].antonyms == ["cruel"]


def test_paragraphs_and_headings_are_not_vocabulary():
    words = by_key(extract_entries_from_pdf(build_pdf(BOOK_ONE)).entries)
    for not_a_word in ("unit", "this", "book", "learners", "everyday words"):
        assert not_a_word not in words


def test_uncertain_entries_are_flagged():
    words = by_key(extract_entries_from_pdf(build_pdf(BOOK_ONE)).entries)
    assert "common_word" in words["the"].reasons
    assert "missing_definition" in words["gregarious"].reasons
    assert words["gregarious"].needs_review


def test_delimited_and_numbered_entries_without_bold():
    words = by_key(extract_entries_from_pdf(build_pdf(BOOK_TWO)).entries)
    assert words["meticulous"].definition == "showing great attention to detail; very careful."
    assert words["negotiate"].definition == "to try to reach an agreement by discussion."
    assert "note" not in words


def test_headword_line_takes_definition_from_next_line():
    lines = [
        Line("serene", page=1, bold_prefix="serene", size=11, block_start=True),
        Line("calm, peaceful and untroubled.", page=1, size=11, block_start=True),
        Line("tranquil", page=1, bold_prefix="tranquil", size=11, block_start=True),
    ]
    words = by_key(extract_entries(lines, page_count=1))
    assert words["serene"].definition == "calm, peaceful and untroubled."


def test_running_headers_are_ignored():
    lines = []
    for page in range(1, 6):
        lines.append(Line(f"Advanced Vocabulary — page {page}", page=page, bold_prefix="Advanced Vocabulary", size=11, block_start=True))
        lines.append(Line(f"word{page}x – a made up definition here.", page=page, size=11, block_start=True))
    keys = by_key(extract_entries(lines, page_count=5))
    assert "advanced vocabulary" not in keys
