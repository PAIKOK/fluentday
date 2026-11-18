import jwt
from bson import ObjectId
from bson.errors import InvalidId
from fastapi import Depends, HTTPException, Request, status
from pymongo.database import Database

from app.config import Settings
from app.security import SESSION_COOKIE, decode_session_token


def get_db(request: Request) -> Database:
    return request.app.state.db


def get_app_settings(request: Request) -> Settings:
    return request.app.state.settings


def forwarded_ip(peer: str, forwarded_for: str | None, hops: int) -> str:
    """The visitor's IP: with `hops` trusted proxies, the address the outermost one saw (rate limits key on it)."""
    if hops <= 0:
        return peer
    chain = [part.strip() for part in (forwarded_for or "").split(",") if part.strip()] + [peer]
    return chain[-hops - 1] if len(chain) > hops else chain[0]


def client_ip(request: Request) -> str:
    peer = request.client.host if request.client else "unknown"
    return forwarded_ip(peer, request.headers.get("x-forwarded-for"), request.app.state.settings.trusted_proxy_hops)


def get_current_user(
    request: Request,
    db: Database = Depends(get_db),
    settings: Settings = Depends(get_app_settings),
) -> dict:
    unauthenticated = HTTPException(status.HTTP_401_UNAUTHORIZED, "Please log in to continue.")
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise unauthenticated
    try:
        payload = decode_session_token(token, settings.jwt_secret)
        user = db.users.find_one({"_id": ObjectId(payload["sub"])})
    except (jwt.InvalidTokenError, InvalidId, KeyError):
        raise unauthenticated
    if not user or user.get("token_version", 0) != payload.get("ver") or user.get("disabled"):
        raise unauthenticated
    return user


def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Administrator access is required.")
    return user


def parse_object_id(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found.")
