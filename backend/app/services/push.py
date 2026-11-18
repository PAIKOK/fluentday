"""Web push delivery (the standard browser Push API, signed with VAPID keys).

Uses the optional `pywebpush` package. Without VAPID keys push is simply switched off, and the
settings page says so instead of offering a toggle that can't work.
"""

import json
import logging
from typing import Literal
from urllib.parse import urlsplit

from app.config import Settings

logger = logging.getLogger("fluentday.push")

PushOutcome = Literal["sent", "gone", "failed", "not_configured"]

# Push services used by Chrome/Edge/Opera, Firefox, Edge (legacy) and Safari.
PUSH_HOSTS = ("fcm.googleapis.com", "push.services.mozilla.com", "notify.windows.com", "push.apple.com")


def is_push_service(endpoint: str) -> bool:
    try:
        parts = urlsplit(endpoint)
        port = parts.port
    except ValueError:
        return False
    host = (parts.hostname or "").lower()
    return (
        parts.scheme == "https"
        and port in (None, 443)
        and not parts.username
        and any(host == h or host.endswith("." + h) for h in PUSH_HOSTS)
    )


def send_push(settings: Settings, subscription: dict, payload: dict) -> tuple[PushOutcome, str | None]:
    """Sends one notification. "gone" means the browser unsubscribed (the subscription should be deleted)."""
    if not settings.push_enabled:
        return "not_configured", None
    if not is_push_service(subscription["endpoint"]):
        return "gone", None  # saved before the allow-list existed: drop it
    try:
        from pywebpush import WebPushException, webpush
    except ImportError:
        logger.error("VAPID keys are set but pywebpush is not installed.")
        return "not_configured", "pywebpush is not installed"
    try:
        webpush(
            subscription_info={"endpoint": subscription["endpoint"], "keys": subscription["keys"]},
            data=json.dumps(payload),
            vapid_private_key=settings.vapid_private_key,
            vapid_claims={"sub": settings.vapid_subject},
            timeout=10,
        )
        return "sent", None
    except WebPushException as exc:
        status = getattr(exc.response, "status_code", None)
        if status in (404, 410):
            return "gone", None
        return "failed", f"push service answered {status}" if status else str(exc)[:200]
    except Exception as exc:  # network errors from requests
        return "failed", str(exc)[:200]
