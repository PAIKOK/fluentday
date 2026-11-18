import logging
import smtplib
from email.message import EmailMessage

from pymongo.database import Database

from app.config import Settings
from app.db import utcnow

logger = logging.getLogger("fluentday.mail")


def send_email(db: Database, settings: Settings, to: str, subject: str, body: str, headers: dict[str, str] | None = None) -> str:
    """Sends via SMTP when configured; otherwise prints the email (development only).
    Returns the outcome: "sent", "failed", "logged" (development) or "not_configured"."""
    record: dict = {"to": to, "subject": subject, "created_at": utcnow()}

    if settings.smtp_host:
        message = EmailMessage()
        message["From"] = settings.smtp_from
        message["To"] = to
        message["Subject"] = subject
        for name, value in (headers or {}).items():
            message[name] = value
        message.set_content(body)
        try:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
                smtp.starttls()
                if settings.smtp_user:
                    smtp.login(settings.smtp_user, settings.smtp_password)
                smtp.send_message(message)
            record["status"] = "sent"
        except (smtplib.SMTPException, OSError) as exc:
            logger.error("Email to %s failed: %s", to, exc)
            record.update(status="failed", error=str(exc))
    else:
        if settings.is_production:
            logger.error("SMTP_HOST is not set; email to %s was NOT sent.", to)
            record["status"] = "not_configured"
        else:
            logger.warning("\n--- EMAIL (not sent: SMTP_HOST is empty) ---\nTo: %s\nSubject: %s\n\n%s\n---", to, subject, body)
            record.update(status="logged", body=body)

    db.email_outbox.insert_one(record)
    return record["status"]
