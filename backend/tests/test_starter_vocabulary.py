import io

from app.services.starter_build import build_starter_words, level_for_rank, read_word_list
from app.services.starter_vocabulary import load_starter_vocabulary, read_starter_file
from tests.conftest import sign_up

# A tiny Open English WordNet file in the same layout as the real one (entries first, then synsets).
WORDNET = b"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE LexicalResource SYSTEM "http://globalwordnet.github.io/schemas/WN-LMF-1.3.dtd">
<LexicalResource><Lexicon id="oewn">
  <LexicalEntry id="oewn-happy-a">
    <Lemma writtenForm="happy" partOfSpeech="a"><Pronunciation variety="GB">h\xc3\xa6pi</Pronunciation></Lemma>
    <Form writtenForm="happier"/>
    <Sense id="oewn-happy__3" synset="s-happy"><SenseRelation relType="antonym" target="oewn-unhappy__3"/></Sense>
  </LexicalEntry>
  <LexicalEntry id="oewn-unhappy-a"><Lemma writtenForm="unhappy" partOfSpeech="a"/><Sense id="oewn-unhappy__3" synset="s-unhappy"/></LexicalEntry>
  <LexicalEntry id="oewn-glad-a"><Lemma writtenForm="glad" partOfSpeech="a"/><Sense id="oewn-glad__3" synset="s-happy"/></LexicalEntry>
  <LexicalEntry id="oewn-Felix-n"><Lemma writtenForm="Felix" partOfSpeech="n"/><Sense id="oewn-felix__1" synset="s-happy"/></LexicalEntry>
  <LexicalEntry id="oewn-can-n"><Lemma writtenForm="can" partOfSpeech="n"/><Sense id="oewn-can__1" synset="s-can"/></LexicalEntry>
  <LexicalEntry id="oewn-run-n"><Lemma writtenForm="run" partOfSpeech="n"/><Sense id="oewn-run__1" synset="s-run-n"/></LexicalEntry>
  <LexicalEntry id="oewn-run-v">
    <Lemma writtenForm="run" partOfSpeech="v"/><Form writtenForm="ran"/>
    <Sense id="oewn-run__2" synset="s-run-v"/><Sense id="oewn-run__3" synset="s-run-v2"/>
  </LexicalEntry>
  <Synset id="s-happy" members="oewn-happy-a oewn-glad-a oewn-Felix-n"><Definition>enjoying or showing joy</Definition>
    <Example>a happier day</Example><Example>they acquired a new pet</Example></Synset>
  <Synset id="s-unhappy" members="oewn-unhappy-a"><Definition>not happy</Definition></Synset>
  <Synset id="s-can" members="oewn-can-n"><Definition>airtight sealed metal container</Definition></Synset>
  <Synset id="s-run-n" members="oewn-run-n"><Definition>a score in baseball</Definition></Synset>
  <Synset id="s-run-v" members="oewn-run-v"><Definition>move fast on foot</Definition><Example>the children ran home</Example></Synset>
  <Synset id="s-run-v2" members="oewn-run-v"><Definition>be in charge of</Definition></Synset>
</Lexicon></LexicalResource>"""


def build(words):
    return build_starter_words(io.BytesIO(WORDNET), words)


def test_word_list_reads_ngsl_csv_in_order():
    text = "Lemma,SFI Rank,SFI\nthe,1,87\nrun,2,80\nRun,3,1\n## comment\nhappy,4,70\n"
    assert read_word_list(text) == ["the", "run", "happy"]
    assert [level_for_rank(r) for r in (1, 1000, 1001, 2001)] == ["beginner", "beginner", "intermediate", "advanced"]


def test_build_picks_the_main_meaning_and_cleans_it_up():
    words, missing = build(["the", "can", "run", "happy"])
    assert missing == ["the", "can"]  # grammar words are left out, even when WordNet has a rare sense
    run, happy = words
    assert (run["rank"], run["part_of_speech"], run["definition"]) == (3, "verb", "Move fast on foot.")
    assert run["examples"] == ["The children ran home."]  # inflections count as using the word
    assert happy["pronunciation"] == "/hæpi/" and happy["level"] == "beginner"
    assert happy["examples"] == ["A happier day."]  # an example that never uses the word is dropped
    assert happy["synonyms"] == ["glad"] and happy["antonyms"] == ["unhappy"]  # no proper names


def test_loading_is_approved_repeatable_and_keeps_book_words(db):
    words, _ = build(["run", "happy"])
    db.vocabulary_words.insert_one({
        "word": "happy", "word_key": "happy", "definition": "Feeling joy.", "definition_source": {"book_id": "b1", "page": 3},
        "examples": [], "synonyms": [], "antonyms": [], "status": "pending", "admin_edited": False,
    })
    first = load_starter_vocabulary(db, words)
    assert (first.added, first.updated) == (1, 1)
    run = db.vocabulary_words.find_one({"word_key": "run"})
    assert run["status"] == "approved" and run["starter_rank"] == 1 and run["examples"][0]["source"] == "dataset"
    happy = db.vocabulary_words.find_one({"word_key": "happy"})
    assert happy["definition"] == "Feeling joy." and happy["status"] == "pending"  # the book's definition wins
    assert happy["antonyms"] == ["unhappy"] and happy["starter_rank"] == 2

    again = load_starter_vocabulary(db, words)
    assert (again.added, again.updated) == (0, 0)
    assert db.vocabulary_words.count_documents({}) == 2


def test_admin_loads_the_bundled_file(admin_client, client, db):
    status = admin_client.get("/api/admin/vocabulary/starter").json()
    assert status["words_in_file"] == len(read_starter_file()) > 2000 and status["loaded"] == 0
    loaded = admin_client.post("/api/admin/vocabulary/starter").json()
    assert loaded["added"] == loaded["loaded"] == status["words_in_file"]
    listing = admin_client.get("/api/admin/vocabulary", params={"q": "happy"}).json()
    assert listing["items"][0]["starter_rank"] is not None

    client.post("/api/auth/logout")
    sign_up(client, db, "ana@example.com")
    assert client.post("/api/admin/vocabulary/starter").status_code == 403
