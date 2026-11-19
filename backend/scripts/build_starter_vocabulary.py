"""Builds backend/data/starter_vocabulary.json from two free downloads:

  python -m scripts.build_starter_vocabulary <english-wordnet-2024.xml.gz> <NGSL_12_stats.csv> [NAWL_12_lemmatized_for_teaching.csv]

- Open English WordNet: https://github.com/globalwordnet/english-wordnet/releases (the .xml.gz file)
- New General Service List: https://www.newgeneralservicelist.com/new-general-service-list (NGSL_12_stats.csv)
- New Academic Word List (optional, becomes the advanced level):
  https://www.newgeneralservicelist.com/new-academic-word-list (NAWL_12_lemmatized_for_teaching.csv)

Then load the words from the admin Vocabulary page ("Load starter vocabulary").
"""

import gzip
import sys
from pathlib import Path

from app.services.starter_build import STARTER_FILE, build_starter_words, read_word_list, write_starter_file


def read_text(path: Path) -> str:
    """The NGSL files are UTF-8, but some (like the NAWL teaching list) are Latin-1."""
    data = path.read_bytes()
    try:
        return data.decode("utf-8-sig")
    except UnicodeDecodeError:
        return data.decode("latin-1")


def main() -> None:
    if len(sys.argv) not in (3, 4):
        sys.exit(__doc__)
    wordnet_path, list_path = Path(sys.argv[1]), Path(sys.argv[2])
    word_list = read_word_list(read_text(list_path))
    advanced_from = None
    if len(sys.argv) == 4:
        everyday = set(word_list)
        academic = [w for w in read_word_list(read_text(Path(sys.argv[3]))) if w not in everyday]
        advanced_from = len(word_list) + 1
        word_list += academic
    opener = gzip.open if wordnet_path.suffix == ".gz" else open
    with opener(wordnet_path, "rb") as xml:
        words, missing = build_starter_words(xml, word_list, advanced_from)
    write_starter_file(words)
    print(f"{len(words)} of {len(word_list)} words written to {STARTER_FILE}.")
    if missing:
        print(f"{len(missing)} not in WordNet (mostly grammar words like 'the'): {', '.join(missing[:30])}{' …' if len(missing) > 30 else ''}")


if __name__ == "__main__":
    main()
