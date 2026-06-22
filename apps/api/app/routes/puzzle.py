from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.schemas import GuessRequest, GuessResponse, PuzzleTodayResponse
from app.services.game import get_or_create_session, session_state, submit_guess, today_date

router = APIRouter(prefix="/api/v1/puzzle", tags=["puzzle"])


@router.get("/today", response_model=PuzzleTodayResponse)
def get_today(
    session_id: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> dict:
    session = get_or_create_session(
        db, session_id, today_date(), fresh=get_settings().debug_fresh_session
    )
    return session_state(db, session)


@router.post("/guess", response_model=GuessResponse)
def post_guess(
    body: GuessRequest,
    db: Session = Depends(get_db),
) -> dict:
    return submit_guess(db, body.session_id, body.amount)
