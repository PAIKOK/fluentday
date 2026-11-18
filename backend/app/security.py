import hashlib
import secrets
import threading
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import HTTPException, status

SESSION_COOKIE = "fd_session"
JWT_ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), password_hash.encode())
    except ValueError:
        return False


def create_session_token(user_id: str, token_version: int, secret: str, days: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": user_id, "ver": token_version, "iat": now, "exp": now + timedelta(days=days)}
    return jwt.encode(payload, secret, algorithm=JWT_ALGORITHM)


def decode_session_token(token: str, secret: str) -> dict:
    # Requiring "exp" and "ver" means other tokens signed with the same secret (unsubscribe links) can't log anyone in.
    return jwt.decode(token, secret, algorithms=[JWT_ALGORITHM], options={"require": ["exp", "sub", "ver"]})


def create_unsubscribe_token(user_id: str, secret: str) -> str:
    """A signed link token for one-click email unsubscribe. It never expires but can only turn emails off."""
    return jwt.encode({"sub": user_id, "purpose": "unsubscribe"}, secret, algorithm=JWT_ALGORITHM)


def read_unsubscribe_token(token: str, secret: str) -> str | None:
    try:
        payload = jwt.decode(token, secret, algorithms=[JWT_ALGORITHM])
    except jwt.InvalidTokenError:
        return None
    return payload.get("sub") if payload.get("purpose") == "unsubscribe" else None


def new_one_time_token() -> tuple[str, str]:
    """Returns (raw token for the email link, hash to store). Only the hash is saved."""
    raw = secrets.token_urlsafe(32)
    return raw, hash_token(raw)


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


class RateLimiter:
    """Small in-memory sliding-window limiter (per process) for auth endpoints."""

    def __init__(self, limit: int, window_seconds: int):
        self.limit = limit
        self.window = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    MAX_KEYS = 10_000

    def check(self, key: str) -> None:
        now = time.monotonic()
        with self._lock:
            if len(self._hits) > self.MAX_KEYS:
                # Forget keys with no recent hits, so attacker-chosen keys can't grow memory forever.
                for stale in [k for k, h in self._hits.items() if not h or now - h[-1] > self.window]:
                    del self._hits[stale]
            hits = self._hits[key]
            while hits and now - hits[0] > self.window:
                hits.popleft()
            if len(hits) >= self.limit:
                raise HTTPException(
                    status.HTTP_429_TOO_MANY_REQUESTS, "Too many attempts. Please wait a few minutes and try again."
                )
            hits.append(now)
