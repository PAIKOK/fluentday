"""Builds the starter vocabulary file: everyday English words with definitions, ready for daily lessons.

The word list is the New General Service List (NGSL 1.2, CC BY-SA 4.0): the ~2,800 words that cover
most of everyday English, in order of usefulness, followed by the New Academic Word List (NAWL 1.2,
CC BY-SA 4.0): ~960 harder words used in study, work and the news. Definitions, examples, synonyms, antonyms and
pronunciations come from Open English WordNet (CC BY 4.0).

`build_starter_words` turns the two downloads into a small JSON file
(scripts/build_starter_vocabulary.py writes it to backend/data/). `load_starter_vocabulary` puts that
file into the database (app/services/starter_vocabulary.py). Standard library only, so it runs
before the server's packages are installed.
"""

import csv
import io
import json
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path
from typing import IO

STARTER_FILE = Path(__file__).resolve().parents[2] / "data" / "starter_vocabulary.json"
ATTRIBUTION = [
    "Word list: New General Service List (NGSL) 1.2 by Browne, Culligan & Phillips, CC BY-SA 4.0, newgeneralservicelist.com",
    "Advanced words: New Academic Word List (NAWL) 1.2 by Browne, Culligan & Phillips, CC BY-SA 4.0, newgeneralservicelist.com",
    "Definitions, examples, synonyms and pronunciations: Open English WordNet 2024, CC BY 4.0, en-word.net",
]

POS_NAMES = {"n": "noun", "v": "verb", "a": "adjective", "s": "adjective", "r": "adverb"}
MAX_EXAMPLES = 2
MAX_RELATED = 5
MAX_EXAMPLE_CHARS = 300
# Grammar words WordNet only knows in a rare sense ("can" the container, "may" the shrub).
GRAMMAR_WORDS = {"can", "could", "will", "would", "may", "might", "must", "shall", "should", "ought"}


def level_for_rank(rank: int, advanced_from: int | None = None) -> str:
    """The 1,000 most useful words are beginner. With an academic list (starting at rank `advanced_from`),
    the rest of the everyday list is intermediate and the academic words advanced; without one, the
    next 1,000 are intermediate and the rest advanced."""
    if advanced_from is not None:
        return "beginner" if rank <= 1000 else "intermediate" if rank < advanced_from else "advanced"
    return "beginner" if rank <= 1000 else "intermediate" if rank <= 2000 else "advanced"


def read_word_list(text: str) -> list[str]:
    """Words in order of usefulness, from a CSV (first column, e.g. NGSL_12_stats.csv) or one word per line."""
    words, seen = [], set()
    for row in csv.reader(io.StringIO(text)):
        if not row or row[0].lstrip().startswith("#"):
            continue
        word = row[0].strip().lower()
        if not word or word == "lemma" or not all(ch.isalpha() or ch in "-' " for ch in word) or word in seen:
            continue
        seen.add(word)
        words.append(word)
    return words


def uses_word(example: str, word: str, forms: list[str]) -> bool:
    """Keeps examples that actually use the word (or an inflection like "ran" or "happier")."""
    stem = word if len(word) <= 4 else word[:-2]
    patterns = [re.escape(stem)] + [re.escape(f.lower()) for f in forms]
    return re.search(rf"\b(?:{'|'.join(patterns)})", example.lower()) is not None


def plain_word(name: str) -> bool:
    """Everyday words only: no proper or scientific names ("Crataegus laevigata") or numbers."""
    return len(name) > 1 and name[0].islower() and all(ch.isalpha() or ch in " -'" for ch in name)


def sentence(text: str) -> str:
    text = text.strip()
    return (text[0].upper() + text[1:] + ("" if text[-1] in ".!?" else ".")) if text else text


@dataclass
class _Entry:
    pos: str
    pronunciations: dict[str, str]
    forms: list[str]
    senses: list[tuple[str, list[str]]]  # (synset id, antonym sense ids), most common sense first


def build_starter_words(
    wordnet_xml: IO[bytes], word_list: list[str], advanced_from: int | None = None
) -> tuple[list[dict], list[str]]:
    """Returns (words, missing). `missing` are list words WordNet has no entry for (mostly "the", "of", …).
    `advanced_from` is the rank where the academic words start, if `word_list` includes them."""
    wanted = set(word_list)
    entries: dict[str, list[_Entry]] = {}
    entry_lemma: dict[str, str] = {}
    sense_lemma: dict[str, str] = {}
    synsets: dict[str, tuple[str, list[str], list[str]]] = {}  # id -> (definition, examples, member entry ids)
    needed_synsets: set[str] = set()

    lemma = pos = None
    pronunciations: dict[str, str] = {}
    forms: list[str] = []
    senses: list[tuple[str, list[str]]] = []
    # ElementTree never fetches the external DTD named in the file, so parsing it is safe.
    for event, el in ET.iterparse(wordnet_xml, events=("start", "end")):
        if event == "start":
            if el.tag == "LexicalEntry":
                lemma, pos, pronunciations, forms, senses = None, None, {}, [], []
            continue
        if el.tag == "Lemma":
            lemma, pos = el.get("writtenForm"), el.get("partOfSpeech")
        elif el.tag == "Pronunciation" and el.text:
            pronunciations.setdefault(el.get("variety") or "", el.text.strip())
        elif el.tag == "Form" and el.get("writtenForm"):
            forms.append(el.get("writtenForm"))
        elif el.tag == "Sense":
            sense_lemma[el.get("id")] = lemma
            antonyms = [r.get("target") for r in el.findall("SenseRelation") if r.get("relType") == "antonym"]
            senses.append((el.get("synset"), antonyms))
        elif el.tag == "LexicalEntry":
            entry_lemma[el.get("id")] = lemma
            if lemma in wanted and pos in POS_NAMES and senses:
                entries.setdefault(lemma, []).append(_Entry(pos, pronunciations, forms, senses))
                needed_synsets.update(s for s, _ in senses[:2])
            el.clear()
        elif el.tag == "Synset":
            if el.get("id") in needed_synsets:
                definition = el.findtext("Definition") or ""
                examples = [e.text.strip() for e in el.findall("Example") if e.text and e.text.strip()]
                synsets[el.get("id")] = (definition, examples, (el.get("members") or "").split())
            el.clear()

    words, missing = [], []
    for rank, word in enumerate(word_list, start=1):
        candidates = [e for e in entries.get(word, []) if e.senses[0][0] in synsets and word not in GRAMMAR_WORDS]
        if not candidates:
            missing.append(word)
            continue
        entry = max(candidates, key=lambda e: len(e.senses))  # the word's main use has the most senses
        definition, examples, _ = synsets[entry.senses[0][0]]
        related_synsets = [synsets[s] for s, _ in entry.senses[:2] if s in synsets]
        synonyms: list[str] = []
        for _, _, members in related_synsets:
            for member in members:
                name = entry_lemma.get(member)
                if name and plain_word(name) and name.lower() != word and name not in synonyms:
                    synonyms.append(name)
        antonyms: list[str] = []
        for target in (t for _, ants in entry.senses[:2] for t in ants):
            name = sense_lemma.get(target)
            if name and plain_word(name) and name not in antonyms:
                antonyms.append(name)
        ipa = entry.pronunciations.get("GB") or next(iter(entry.pronunciations.values()), None)
        words.append({
            "rank": rank,
            "word": word,
            "part_of_speech": POS_NAMES[entry.pos],
            "pronunciation": f"/{ipa}/" if ipa else None,
            "definition": sentence(definition),
            "examples": [sentence(x) for x in examples if len(x) < MAX_EXAMPLE_CHARS and uses_word(x, word, entry.forms)][:MAX_EXAMPLES],
            "synonyms": synonyms[:MAX_RELATED],
            "antonyms": antonyms[:MAX_RELATED],
            "level": level_for_rank(rank, advanced_from),
        })
    return words, missing


def write_starter_file(words: list[dict], path: Path = STARTER_FILE) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    document = {"name": "FluentDay starter vocabulary", "license": "CC BY-SA 4.0", "attribution": ATTRIBUTION, "words": words}
    path.write_text(json.dumps(document, ensure_ascii=False, indent=1), encoding="utf-8")

