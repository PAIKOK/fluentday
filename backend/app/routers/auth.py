from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError

from app.config import Settings
from app.db import utcnow
from app.deps import client_ip, get_app_settings, get_current_user, get_db
from app.mailer import send_email
from app.schemas.auth import EmailIn, LoginIn, MessageOut, RegisterIn, ResetPasswordIn, VerifyEmailIn
from app.schemas.profile import MeOut
from app.security import (
    SESSION_COOKIE,
    create_session_token,
    hash_password,
    hash_token,
    new_one_time_token,
    verify_password,
)
from app.services.users import default_profile, me_out

router = APIRouter(prefix="/auth", tags=["auth"])

VERIFY_TTL = timedelta(hours=24)
RESET_TTL = timedelta(hours=1)
# Compared against when an email isn't registered, so login takes the same time either way.
_DUMMY_HASH = hash_password("fluentday-timing-equaliser")


def _limit(request: Request, name: str, key: str) -> None:
    request.app.state.rate_limiters[name].check(key)


def _limit_email(request: Request, purpose: str, email: str) -> None:
    """Per address (so one inbox isn't flooded) and per IP (so one client can't email thousands of addresses)."""
    _limit(request, "email", f"{purpose}:{client_ip(request)}:{email}")
    _limit(request, "email_ip", client_ip(request))


def _issue_token(db: Database, user: dict, purpose: str, ttl: timedelta) -> str:
    db.auth_tokens.delete_many({"user_id": user["_id"], "purpose": purpose})
    raw, token_hash = new_one_time_token()
    db.auth_tokens.insert_one(
        {"user_id": user["_id"], "purpose": purpose, "token_hash": token_hash, "expires_at": utcnow() + ttl}
    )
    return raw


def _consume_token(db: Database, raw: str, purpose: str) -> dict:
    token = db.auth_tokens.find_one_and_delete(
        {"token_hash": hash_token(raw), "purpose": purpose, "expires_at": {"$gt": utcnow()}}
    )
    if token is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This link is invalid or has expired. Please request a new one.")
    user = db.users.find_one({"_id": token["user_id"]})
    if user is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This link is invalid or has expired.")
    return user


def _send_verification(db: Database, settings: Settings, user: dict) -> None:
    raw = _issue_token(db, user, "verify_email", VERIFY_TTL)
    link = f"{settings.frontend_url}/verify-email?token={raw}"
    send_email(
        db,
        settings,
        user["email"],
        "Confirm your FluentDay email",
        f"Welcome to FluentDay!\n\nConfirm your email address to start learning:\n{link}\n\n"
        "This link expires in 24 hours. If you did not create an account, you can ignore this email.",
    )


def _set_session(response: Response, settings: Settings, user: dict) -> None:
    token = create_session_token(str(user["_id"]), user.get("token_version", 0), settings.jwt_secret, settings.access_token_days)
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=settings.access_token_days * 86400,
        httponly=True,
        secure=settings.secure_cookies,
        samesite="lax",
        path="/",
    )


@router.post("/register", status_code=status.HTTP_201_CREATED, response_model=MessageOut)
def register(
    body: RegisterIn,
    request: Request,
    db: Database = Depends(get_db),
    settings: Settings = Depends(get_app_settings),
):
    _limit(request, "register", client_ip(request))
    email = body.email.lower()
    now = utcnow()
    user = {
        "email": email,
        "password_hash": hash_password(body.password),
        "role": "admin" if email in settings.admin_email_set else "subscriber",
        "email_verified": False,
        "token_version": 0,
        "created_at": now,
        "updated_at": now,
    }
    message = MessageOut(message="Check your email to confirm your address and finish signing up.")
    try:
        user["_id"] = db.users.insert_one(user).inserted_id
    except DuplicateKeyError:
        # Same answer as a new sign-up, so nobody can test which emails are registered. The owner is told by email.
        send_email(
            db, settings, email, "You already have a FluentDay account",
            "Someone tried to create a FluentDay account with this email address, but you already have one.\n\n"
            f"Log in: {settings.frontend_url}/login\nForgot your password? {settings.frontend_url}/forgot-password\n\n"
            "If this wasn't you, you can ignore this email.",
        )
        return message
    db.profiles.insert_one(default_profile(user["_id"], body.full_name, body.timezone))
    _send_verification(db, settings, user)
    return message


@router.post("/login", response_model=MeOut)
def login(
    body: LoginIn,
    request: Request,
    response: Response,
    db: Database = Depends(get_db),
    settings: Settings = Depends(get_app_settings),
):
    email = body.email.lower()
    _limit(request, "login", f"{client_ip(request)}:{email}")
    user = db.users.find_one({"email": email})
    password_ok = verify_password(body.password, user["password_hash"] if user else _DUMMY_HASH)
    if user is None or not password_ok or user.get("disabled"):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password.")
    if not user.get("email_verified"):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            {"code": "email_not_verified", "message": "Please confirm your email address first."},
        )
    _set_session(response, settings, user)
    db.users.update_one({"_id": user["_id"]}, {"$set": {"last_login_at": utcnow()}})
    return me_out(db, user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response, settings: Settings = Depends(get_app_settings)):
    response.delete_cookie(SESSION_COOKIE, path="/", httponly=True, secure=settings.secure_cookies, samesite="lax")


@router.post("/logout-all", status_code=status.HTTP_204_NO_CONTENT)
def logout_all(
    response: Response,
    user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
    settings: Settings = Depends(get_app_settings),
):
    """Ends every session on every device (e.g. after using a shared computer)."""
    db.users.update_one({"_id": user["_id"]}, {"$inc": {"token_version": 1}})
    logout(response, settings)


@router.get("/me", response_model=MeOut)
def me(user: dict = Depends(get_current_user), db: Database = Depends(get_db)):
    return me_out(db, user)


@router.post("/verify-email", response_model=MeOut)
def verify_email(
    body: VerifyEmailIn,
    request: Request,
    response: Response,
    db: Database = Depends(get_db),
    settings: Settings = Depends(get_app_settings),
):
    _limit(request, "login", f"verify:{client_ip(request)}")
    token = db.auth_tokens.find_one({"token_hash": hash_token(body.token), "purpose": "verify_email", "expires_at": {"$gt": utcnow()}})
    pending = db.users.find_one({"_id": token["user_id"]}) if token else None
    if pending is not None and not verify_password(body.password, pending["password_hash"]):
        # The link stays valid so the learner can try again.
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            {"code": "wrong_password", "message": "That isn't the password chosen when this account was created. "
                                                  "If you didn't sign up yourself, use “Forgot password” to take over the account safely."},
        )
    user = _consume_token(db, body.token, "verify_email")
    db.users.update_one({"_id": user["_id"]}, {"$set": {"email_verified": True, "updated_at": utcnow()}})
    user["email_verified"] = True
    _set_session(response, settings, user)
    return me_out(db, user)


@router.post("/resend-verification", response_model=MessageOut)
def resend_verification(
    body: EmailIn,
    request: Request,
    db: Database = Depends(get_db),
    settings: Settings = Depends(get_app_settings),
):
    email = body.email.lower()
    _limit_email(request, "verify", email)
    user = db.users.find_one({"email": email})
    if user and not user.get("email_verified"):
        _send_verification(db, settings, user)
    return MessageOut(message="If that account needs confirming, we have sent a new link.")


@router.post("/forgot-password", response_model=MessageOut)
def forgot_password(
    body: EmailIn,
    request: Request,
    db: Database = Depends(get_db),
    settings: Settings = Depends(get_app_settings),
):
    email = body.email.lower()
    _limit_email(request, "reset", email)
    user = db.users.find_one({"email": email})
    if user and not user.get("disabled"):
        raw = _issue_token(db, user, "reset_password", RESET_TTL)
        link = f"{settings.frontend_url}/reset-password?token={raw}"
        send_email(
            db,
            settings,
            email,
            "Reset your FluentDay password",
            f"Someone asked to reset the password for your FluentDay account.\n\nChoose a new password here:\n{link}\n\n"
            "This link expires in 1 hour. If this wasn't you, you can ignore this email.",
        )
    # Same answer whether or not the account exists, so emails can't be discovered.
    return MessageOut(message="If an account exists for that email, we have sent a reset link.")


@router.post("/reset-password", response_model=MessageOut)
def reset_password(body: ResetPasswordIn, db: Database = Depends(get_db)):
    user = _consume_token(db, body.token, "reset_password")
    db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {"password_hash": hash_password(body.password), "email_verified": True, "updated_at": utcnow()},
            # Logs out every existing session.
            "$inc": {"token_version": 1},
        },
    )
    return MessageOut(message="Your password has been updated. You can now log in.")
