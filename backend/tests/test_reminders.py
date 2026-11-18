from datetime import datetime, timezone

from app.security import create_unsubscribe_token, create_session_token
from app.services.reminders import Plan, dispatch_reminders, is_due, local_now, plan_lines, reminder_text
from tests.conftest import sign_up
from tests.test_lessons import add_words

# 02:45 UTC is 08:15 in India (the default timezone).
AT_0815_IST = datetime(2026, 11, 18, 2, 45, tzinfo=timezone.utc)


def test_is_due_only_inside_the_window():
    local = local_now("Asia/Kolkata", AT_0815_IST)
    assert local.hour == 8 and local.minute == 15
    assert is_due(local, "08:00", 180)
    assert not is_due(local, "08:30", 180)   # not yet
    assert not is_due(local, "04:00", 180)   # too late today
    assert is_due(local_now("America/New_York", AT_0815_IST), "21:30", 180)  # 21:45 the evening before in New York


def test_reminder_text_follows_the_real_plan():
    plan = Plan(new_words=7, revision_words=0, videos=2, speaking=True, quiz=True)
    title, body = reminder_text("Ana Silva", 8, plan)
    assert title == "Good morning, Ana! Your FluentDay lesson is ready."
    assert body == "Today's plan:\n7 new words\n2 listening lessons\n1 pronunciation challenge\n1 daily quiz\n\nStart learning today!"
    assert plan_lines(Plan(0, 3, 1, False, False)) == ["3 words to revise", "1 listening lesson"]
    assert reminder_text("", 19, Plan(0, 0, 0, False, False)) == ("Good evening! Your FluentDay lesson is ready.", "Start learning today!")


def test_unsubscribe_tokens_cannot_log_anyone_in(client, db, settings):
    sign_up(client, db, "ana@example.com")
    user_id = str(db.users.find_one({"email": "ana@example.com"})["_id"])
    client.cookies.set("fd_session", create_unsubscribe_token(user_id, settings.jwt_secret))
    assert client.get("/api/auth/me").status_code == 401
    client.cookies.set("fd_session", create_session_token(user_id, 0, settings.jwt_secret, 1))
    assert client.get("/api/auth/me").status_code == 200


def set_prefs(db, email, **prefs):
    user = db.users.find_one({"email": email})
    db.profiles.update_one({"user_id": user["_id"]}, {"$set": {"reminder_time": "08:00", "timezone": "Asia/Kolkata", **{f"notifications.{k}": v for k, v in prefs.items()}}})
    return user


def test_dispatch_sends_once_per_day_only_on_consented_channels(client, db, settings):
    add_words(db, 7)
    sign_up(client, db, "ana@example.com")
    sign_up(client, db, "ben@example.com")
    ana = set_prefs(db, "ana@example.com", in_app=True, email=True, push=False)
    set_prefs(db, "ben@example.com", in_app=False, email=False, push=False)  # no consent at all
    outbox_before = db.email_outbox.count_documents({})

    summary = dispatch_reminders(db, settings, now=AT_0815_IST)
    assert summary.sent == 1 and not summary.errors
    reminder = db.reminders.find_one({"user_id": ana["_id"]})
    assert reminder["local_date"] == "2026-11-18" and set(reminder["channels"]) == {"in_app", "email"}
    assert reminder["channels"]["email"]["status"] == "sent"
    assert db.daily_lessons.count_documents({"user_id": ana["_id"], "lesson_date": "2026-11-18"}) == 1  # prepared in advance
    mail = db.email_outbox.find_one(sort=[("_id", -1)])
    assert db.email_outbox.count_documents({}) == outbox_before + 1 and "7 new words" in mail["body"] and "/unsubscribe?token=" in mail["body"]

    assert dispatch_reminders(db, settings, now=AT_0815_IST).sent == 0  # never twice a day
    assert db.notifications.count_documents({"user_id": ana["_id"]}) == 1


def test_no_reminder_for_learners_who_already_studied(client, db, settings):
    add_words(db, 7)
    sign_up(client, db, "ana@example.com")
    ana = set_prefs(db, "ana@example.com", in_app=True)
    db.user_vocabulary_progress.insert_one({"user_id": ana["_id"], "word_id": db.vocabulary_words.find_one()["_id"], "learned_on": "2026-11-18", "status": "learned"})
    summary = dispatch_reminders(db, settings, now=AT_0815_IST)
    assert summary.sent == 0 and summary.skipped_active == 1


def test_in_app_notifications_and_email_unsubscribe(client, db, settings):
    add_words(db, 7)
    sign_up(client, db, "ana@example.com")
    ana = set_prefs(db, "ana@example.com", in_app=True, email=True)
    dispatch_reminders(db, settings, now=AT_0815_IST)

    listing = client.get("/api/notifications").json()
    assert listing["unread"] == 1 and listing["items"][0]["title"].startswith("Good morning")
    client.post(f"/api/notifications/{listing['items'][0]['id']}/read")
    assert client.get("/api/notifications/unread-count").json() == {"unread": 0}

    assert client.post("/api/notifications/unsubscribe", json={"token": "not-a-real-token"}).status_code == 400
    token = create_unsubscribe_token(str(ana["_id"]), settings.jwt_secret)
    assert client.post("/api/notifications/unsubscribe", json={"token": token}).status_code == 200
    assert db.profiles.find_one({"user_id": ana["_id"]})["notifications"]["email"] is False

    client.post("/api/auth/logout")
    sign_up(client, db, "ben@example.com")
    assert client.get("/api/notifications").json()["items"] == []
    assert client.post(f"/api/notifications/{listing['items'][0]['id']}/read").status_code == 404


def test_push_needs_server_keys_and_https_endpoints(client, db, settings):
    sign_up(client, db, "ana@example.com")
    assert client.get("/api/notifications/push/config").json() == {"enabled": False, "public_key": None}
    sub = {"endpoint": "https://fcm.googleapis.com/fcm/send/abc", "keys": {"p256dh": "k", "auth": "a"}}
    assert client.post("/api/notifications/push/subscriptions", json=sub).status_code == 409

    settings.vapid_public_key, settings.vapid_private_key = "pub", "priv"
    for bad in ("http://169.254.169.254/", "https://localhost/x", "https://10.0.0.5/x", "https://fcm.googleapis.com.evil.com/x", "https://fcm.googleapis.com:8443/x"):
        assert client.post("/api/notifications/push/subscriptions", json={**sub, "endpoint": bad}).status_code == 422, bad
    assert client.post("/api/notifications/push/subscriptions", json=sub).status_code == 201
    assert client.get("/api/profile").json()["notifications"]["push"] is True
    client.post("/api/notifications/push/unsubscribe", json={"endpoint": sub["endpoint"]})
    assert db.push_subscriptions.count_documents({}) == 0
    assert client.get("/api/profile").json()["notifications"]["push"] is False
