import hmac

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pymongo.database import Database

from app.config import Settings
from app.deps import get_app_settings, get_db
from app.services.scheduler import run_once

router = APIRouter(prefix="/internal", tags=["internal"], include_in_schema=False)


@router.post("/run-scheduler")
def run_scheduler(
    authorization: str = Header(default=""),
    db: Database = Depends(get_db),
    settings: Settings = Depends(get_app_settings),
):
    """Runs the scheduler once. Needs `Authorization: Bearer <SCHEDULER_TOKEN>`; hidden when no token is set."""
    token = settings.scheduler_token
    if len(token) < 32:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not Found")
    if not hmac.compare_digest(authorization.encode(), f"Bearer {token}".encode()):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid scheduler token.")
    return run_once(db, settings)
