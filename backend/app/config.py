from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

from app.services.spaced_repetition import parse_gaps


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: str = "development"
    mongodb_uri: str = ""
    mongodb_db: str = "fluentday"
    jwt_secret: str = ""
    access_token_days: int = 7
    frontend_url: str = "http://localhost:5173"
    admin_emails: str = ""

    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "FluentDay <no-reply@fluentday.app>"

    # Web push (optional). Generate a key pair with: python -m scripts.generate_vapid_keys
    vapid_public_key: str = ""
    vapid_private_key: str = ""
    vapid_subject: str = "mailto:no-reply@fluentday.app"
    # A reminder is still sent this long after the chosen time (e.g. if the scheduler was down), never later.
    reminder_window_minutes: int = 180

    max_pdf_mb: int = 50
    # Proxies in front of the server that add to X-Forwarded-For (Vercel rewrite + Render = 2). 0 = connect directly.
    trusted_proxy_hops: int = 0
    # Days between revisions: learn on day 1 → revise on days 2, 4, 7, 15.
    revision_gaps: str = "1,2,3,8"

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def admin_email_set(self) -> set[str]:
        return {e.strip().lower() for e in self.admin_emails.split(",") if e.strip()}

    @property
    def revision_gap_days(self) -> tuple[int, ...]:
        return parse_gaps(self.revision_gaps)

    @property
    def secure_cookies(self) -> bool:
        return self.is_production or self.frontend_url.startswith("https://")

    @property
    def push_enabled(self) -> bool:
        return bool(self.vapid_public_key and self.vapid_private_key)

    @property
    def max_pdf_bytes(self) -> int:
        return self.max_pdf_mb * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()
