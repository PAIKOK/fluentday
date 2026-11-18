import logging
import secrets
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pymongo.database import Database
from pymongo.errors import PyMongoError

from app.config import Settings, get_settings
from app.db import connect, ensure_indexes
from app.routers import (
    admin_books,
    admin_users,
    admin_vocabulary,
    admin_youtube,
    auth,
    lessons,
    listening,
    notebook,
    notifications,
    profile,
    progress,
    pronunciation,
    quiz,
    revision,
)
from app.security import RateLimiter

logger = logging.getLogger("fluentday")
MAX_JSON_BODY = 1_000_000


def _check_secret(settings: Settings) -> None:
    if not settings.is_production and settings.frontend_url.startswith("https://"):
        # A public (HTTPS) site running in development mode would log email links and use a temporary secret.
        raise RuntimeError("FRONTEND_URL is HTTPS but ENVIRONMENT is not 'production'. Set ENVIRONMENT=production.")
    if len(settings.jwt_secret) >= 32:
        return
    if settings.is_production:
        raise RuntimeError("JWT_SECRET must be set to at least 32 characters in production.")
    settings.jwt_secret = secrets.token_urlsafe(48)
    logger.warning("JWT_SECRET is not set; using a temporary secret. You will be logged out when the server restarts.")


def _in_memory_db(settings: Settings) -> Database:
    """Development only: a temporary database (mongomock, from requirements-dev.txt) when MONGODB_URI is empty,
    so the app can be tried without MongoDB. Everything is lost when the server stops."""
    try:
        import mongomock
        from mongomock.gridfs import enable_gridfs_integration
    except ImportError as exc:
        raise RuntimeError("MONGODB_URI is not set. Fill it in backend/.env, or install requirements-dev.txt to use a temporary database.") from exc
    enable_gridfs_integration()
    logger.warning(
        "\n*** MONGODB_URI is empty: using a TEMPORARY in-memory database. All accounts and data are lost when the server stops. ***"
    )
    return mongomock.MongoClient()[settings.mongodb_db]


def create_app(settings: Settings | None = None, db: Database | None = None) -> FastAPI:
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        _check_secret(settings)
        client = None
        if db is not None:
            app.state.db = db
        elif not settings.mongodb_uri and not settings.is_production:
            app.state.db = _in_memory_db(settings)
        else:
            if not settings.mongodb_uri:
                raise RuntimeError("MONGODB_URI is not set. Copy backend/.env.example to backend/.env and fill it in.")
            try:
                client, app.state.db = connect(settings.mongodb_uri, settings.mongodb_db)
            except PyMongoError as exc:
                raise RuntimeError(f"Could not connect to MongoDB: {exc}") from exc
            logger.info("Connected to MongoDB database %r", settings.mongodb_db)
        ensure_indexes(app.state.db)
        yield
        if client is not None:
            client.close()

    # The interactive API docs list every route, so they are only served in development.
    docs = {} if not settings.is_production else {"docs_url": None, "redoc_url": None, "openapi_url": None}
    app = FastAPI(title="FluentDay API", version="0.3.0", lifespan=lifespan, **docs)

    @app.middleware("http")
    async def limit_body_size(request: Request, call_next):
        # PDFs go to the admin upload route; every other request is small JSON.
        limit = settings.max_pdf_bytes + 1_000_000 if request.url.path.startswith("/api/admin/books") else MAX_JSON_BODY
        length = request.headers.get("content-length")
        if length and length.isdigit() and int(length) > limit:
            return JSONResponse({"detail": "This request is too large."}, status_code=413)
        return await call_next(request)

    app.state.settings = settings
    app.state.rate_limiters = {
        "login": RateLimiter(limit=10, window_seconds=300),
        "register": RateLimiter(limit=10, window_seconds=3600),
        "email": RateLimiter(limit=5, window_seconds=900),
        "email_ip": RateLimiter(limit=30, window_seconds=3600),
    }
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_url],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Content-Type"],
    )
    routers = (
        auth.router, profile.router, lessons.router, listening.router, notebook.router, revision.router,
        pronunciation.router, quiz.router, progress.router, notifications.router,
        admin_books.router, admin_vocabulary.router, admin_youtube.router, admin_users.router,
    )
    for router in routers:
        app.include_router(router, prefix="/api")

    @app.get("/api/health", tags=["health"])
    def health() -> dict:
        return {"status": "ok"}

    return app


app = create_app()
