from app.services.spaced_repetition import first_schedule, next_schedule, parse_gaps


def test_default_schedule_is_days_2_4_7_15():
    s = first_schedule("2026-11-01")
    assert s.due_date == "2026-11-02"
    seen = [s.due_date]
    for _ in range(3):
        s = next_schedule(s.stage, "remembered", s.due_date)
        seen.append(s.due_date)
    assert seen == ["2026-11-02", "2026-11-04", "2026-11-07", "2026-11-15"]
    final = next_schedule(s.stage, "remembered", s.due_date)
    assert final.mastered and final.due_date is None


def test_ratings_move_the_word_differently():
    assert next_schedule(1, "easy", "2026-11-04").stage == 3
    difficult = next_schedule(2, "difficult", "2026-11-07")
    assert (difficult.stage, difficult.due_date) == (2, "2026-11-08")
    forgot = next_schedule(3, "forgot", "2026-11-15")
    assert (forgot.stage, forgot.due_date) == (0, "2026-11-16")
    assert next_schedule(3, "easy", "2026-11-15").mastered


def test_gaps_are_configurable_and_validated():
    assert parse_gaps("1,3,7") == (1, 3, 7)
    assert parse_gaps("") == (1, 2, 3, 8)
    assert parse_gaps("1,x") == (1, 2, 3, 8)
    assert parse_gaps("0,2") == (1, 2, 3, 8)
    assert next_schedule(2, "remembered", "2026-11-01", gaps=(1, 3, 7)).mastered
