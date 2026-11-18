"""Spaced-repetition schedule.

With the default gaps (1, 2, 3, 8 days) a word learned on day 1 is revised on days 2, 4, 7 and 15,
and becomes "mastered" after the fourth successful revision. The gaps are configurable
(REVISION_GAPS in .env).
"""

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Literal

Rating = Literal["easy", "remembered", "difficult", "forgot"]
DEFAULT_GAPS = (1, 2, 3, 8)


def parse_gaps(text: str | None) -> tuple[int, ...]:
    try:
        gaps = tuple(int(part) for part in (text or "").split(",") if part.strip())
    except ValueError:
        return DEFAULT_GAPS
    return gaps if gaps and all(g > 0 for g in gaps) else DEFAULT_GAPS


@dataclass(frozen=True)
class Schedule:
    stage: int            # number of successful revisions so far
    due_date: str | None  # None once mastered
    mastered: bool


def first_schedule(learned_on: str, gaps: tuple[int, ...] = DEFAULT_GAPS) -> Schedule:
    return Schedule(stage=0, due_date=_add_days(learned_on, gaps[0]), mastered=False)


def next_schedule(stage: int, rating: Rating, today: str, gaps: tuple[int, ...] = DEFAULT_GAPS) -> Schedule:
    """
    easy        → skip ahead two stages
    remembered  → next stage
    difficult   → same stage, see it again tomorrow
    forgot      → back to the start, see it again tomorrow
    """
    if rating == "easy":
        stage += 2
    elif rating == "remembered":
        stage += 1
    elif rating == "forgot":
        stage = 0
    if rating in ("difficult", "forgot"):
        return Schedule(stage=stage, due_date=_add_days(today, 1), mastered=False)
    if stage >= len(gaps):
        return Schedule(stage=len(gaps), due_date=None, mastered=True)
    return Schedule(stage=stage, due_date=_add_days(today, gaps[stage]), mastered=False)


def _add_days(day: str, days: int) -> str:
    return (date.fromisoformat(day) + timedelta(days=days)).isoformat()
