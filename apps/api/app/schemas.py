from datetime import date
from typing import Any

from pydantic import BaseModel, Field


class HintPayload(BaseModel):
    level: int
    hints: dict[str, Any]


class GuessRecord(BaseModel):
    amount: int
    direction: str | None = None  # "high" = guess was too high → say "Lager"


class PuzzleTodayResponse(BaseModel):
    puzzle_date: date
    puzzle_number: int
    session_id: str
    correct: bool = False
    direction: str | None = None
    guesses_used: int
    max_guesses: int = 5
    hint_level: int
    status: str
    hints: dict[str, Any]
    new_hints: dict[str, Any] = {}
    new_photo_urls: list[str] = []
    revealed_photos: list[str] = []
    guesses: list[GuessRecord]
    result: dict[str, Any] | None = None


class GuessRequest(BaseModel):
    session_id: str | None = None
    amount: int = Field(..., gt=0)


class GuessResponse(BaseModel):
    puzzle_date: date
    puzzle_number: int
    session_id: str
    correct: bool
    direction: str | None = None
    guesses_used: int
    max_guesses: int = 5
    hint_level: int
    status: str
    hints: dict[str, Any]
    new_hints: dict[str, Any] = {}
    new_photo_urls: list[str] = []
    revealed_photos: list[str] = []
    guesses: list[GuessRecord]
    result: dict[str, Any] | None = None
