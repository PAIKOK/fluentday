from fastapi import APIRouter, Depends
from pymongo.database import Database

from app.db import utcnow
from app.deps import get_current_user, get_db
from app.schemas.profile import ProfileOut, ProfileUpdate
from app.services.users import get_profile, profile_out

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("", response_model=ProfileOut)
def read_profile(user: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    return profile_out(get_profile(db, user))


@router.patch("", response_model=ProfileOut)
def update_profile(body: ProfileUpdate, user: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    get_profile(db, user)
    changes = body.model_dump(exclude_unset=True, exclude_none=True)
    if changes:
        changes["updated_at"] = utcnow()
        db.profiles.update_one({"user_id": user["_id"]}, {"$set": changes})
    return profile_out(get_profile(db, user))
