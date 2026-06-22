from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from app.config import get_settings, settings
from app.database import Base, engine
from app.routes.puzzle import router as puzzle_router
from app.services.puzzle_builder import ensure_puzzle_for_date
from app.services.game import today_date
from sqlalchemy.orm import Session
from app.database import SessionLocal


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    inspector = inspect(engine)
    if "game_sessions" in inspector.get_table_names():
        columns = {c["name"] for c in inspector.get_columns("game_sessions")}
        if "photo_order" not in columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE game_sessions ADD COLUMN photo_order JSON"))
        if "listing_global_id" not in columns:
            with engine.begin() as conn:
                conn.execute(
                    text("ALTER TABLE game_sessions ADD COLUMN listing_global_id INTEGER")
                )
    db = SessionLocal()
    try:
        ensure_puzzle_for_date(db, today_date())
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
        "demo_mode": cfg.demo_mode,
        "debug_fresh_session": cfg.debug_fresh_session,
    }
