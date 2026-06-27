import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from app.config import get_settings, settings
from app.database import Base, SessionLocal, engine
from app.routes.puzzle import router as puzzle_router
from app.services.game import today_date
from app.services.puzzle_builder import _parse_price_buckets, ensure_puzzle_for_date

logger = logging.getLogger(__name__)

load_dotenv(Path(__file__).parent.parent / ".env")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    _parse_price_buckets()  # Validate config at startup
    Base.metadata.create_all(bind=engine)
    inspector = inspect(engine)
    if "game_sessions" in inspector.get_table_names():
        columns = {c["name"] for c in inspector.get_columns("game_sessions")}
        if "photo_order" not in columns:
            with engine.begin() as conn:
                conn.execute(
                    text("ALTER TABLE game_sessions ADD COLUMN photo_order JSON")
                )
        if "listing_global_id" not in columns:
            with engine.begin() as conn:
                conn.execute(
                    text(
                        "ALTER TABLE game_sessions ADD COLUMN listing_global_id INTEGER"
                    )
                )
    db = SessionLocal()
    try:
        force = settings.force_puzzle_rebuild
        puzzle_date = today_date()
        puzzle = ensure_puzzle_for_date(db, puzzle_date, force=force)
        action = "rebuilt" if force else "reusing"
        msg = f"✓ Puzzle: €{puzzle.answer_eur:,} ({puzzle.payload.get('city')}) [{action}]"
        print(f"\033[92m{msg}\033[0m", file=sys.stderr, flush=True)
    finally:
        db.close()
    yield


app = FastAPI(title="Fundle API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(puzzle_router)


@app.get("/health")
def health() -> dict[str, str | bool]:
    cfg = get_settings()
    return {
        "status": "ok",
        "debug_fresh_session": cfg.debug_fresh_session,
    }
