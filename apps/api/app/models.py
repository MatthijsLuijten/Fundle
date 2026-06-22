import uuid
from datetime import date, datetime

from sqlalchemy import JSON, Date, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid

from app.database import Base


class DailyPuzzle(Base):
    __tablename__ = "daily_puzzles"

    puzzle_date: Mapped[date] = mapped_column(Date, primary_key=True)
    global_id: Mapped[int] = mapped_column(Integer, nullable=False)
    answer_eur: Mapped[int] = mapped_column(Integer, nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class GameSession(Base):
    __tablename__ = "game_sessions"
    __table_args__ = (UniqueConstraint("session_id", "puzzle_date", name="uq_session_date"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    puzzle_date: Mapped[date] = mapped_column(
        Date, ForeignKey("daily_puzzles.puzzle_date"), nullable=False
    )
    guesses: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    photo_order: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    listing_global_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    hint_level: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="playing")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    puzzle: Mapped["DailyPuzzle"] = relationship()
