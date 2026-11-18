"""Builds backend/data/starter_vocabulary.json from two free downloads:

  python -m scripts.build_starter_vocabulary <english-wordnet-2024.xml.gz> <NGSL_12_stats.csv>

- Open English WordNet: https://github.com/globalwordnet/english-wordnet/releases (the .xml.gz file)
- New General Service List: https://www.newgeneralservicelist.com/new-general-service-list (NGSL_12_stats.csv)

Then load the words from the admin Vocabulary page ("Load starter vocabulary").
"""

import gzip
import sys
from pathlib import Path

from app.services.starter_build import STARTER_FILE, build_starter_words, read_word_list, write_starter_file


def main() -> None:
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    wordnet_path, list_path = Path(sys.argv[1]), Path(sys.argv[2])
    word_list = read_word_list(list_path.read_text(encoding="utf-8-sig"))
    opener = gzip.open if wordnet_path.suffix == ".gz" else open
    with opener(wordnet_path, "rb") as xml:
        words, missing = build_starter_words(xml, word_list)
    write_starter_file(words)
    print(f"{len(words)} of {len(word_list)} words written to {STARTER_FILE}.")
    if missing:
        print(f"{len(missing)} not in WordNet (mostly grammar words like 'the'): {', '.join(missing[:30])}{' …' if len(missing) > 30 else ''}")


if __name__ == "__main__":
    main()
