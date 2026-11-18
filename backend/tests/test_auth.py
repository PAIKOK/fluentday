from tests.conftest import PASSWORD, last_token, sign_up


def register(client, email="learner@example.com", password=PASSWORD):
    return client.post("/api/auth/register", json={"email": email, "password": password, "full_name": "  Ana   Silva "})


def test_register_requires_verification_before_login(client, db):
    assert register(client).status_code == 201
    r = client.post("/api/auth/login", json={"email": "learner@example.com", "password": PASSWORD})
    assert r.status_code == 403
    assert r.json()["detail"]["code"] == "email_not_verified"


def test_verify_logs_in_and_me_returns_profile_defaults(client, db):
    register(client)
    r = client.post("/api/auth/verify-email", json={"token": last_token(db, "learner@example.com"), "password": PASSWORD})
    assert r.status_code == 200
    me = client.get("/api/auth/me").json()
    assert me["user"]["email_verified"] is True
    assert me["user"]["role"] == "subscriber"
    assert me["profile"]["full_name"] == "Ana Silva"
    assert me["profile"]["notifications"] == {"email": False, "push": False, "in_app": True}


def test_password_is_hashed_and_duplicate_email_is_not_revealed(client, db):
    first = register(client, email="Learner@Example.com")
    stored = db.users.find_one({"email": "learner@example.com"})
    assert stored["password_hash"] != PASSWORD and stored["password_hash"].startswith("$2")
    again = register(client, password="a-different-password")
    assert again.status_code == 201 and again.json() == first.json()  # same answer as a new sign-up
    assert db.users.count_documents({"email": "learner@example.com"}) == 1
    assert db.users.find_one({"email": "learner@example.com"})["password_hash"] == stored["password_hash"]
    latest = db.email_outbox.find_one({"to": "learner@example.com"}, sort=[("_id", -1)])
    assert latest["subject"] == "You already have a FluentDay account"


def test_verifying_needs_the_signup_password(client, db):
    """Someone who registers another person's email can't keep access after that person confirms it."""
    register(client)  # the "attacker" knows PASSWORD
    token = last_token(db, "learner@example.com")
    r = client.post("/api/auth/verify-email", json={"token": token, "password": "the-victim-guesses"})
    assert r.status_code == 400 and r.json()["detail"]["code"] == "wrong_password"
    assert db.users.find_one({"email": "learner@example.com"})["email_verified"] is False
    assert client.post("/api/auth/verify-email", json={"token": token, "password": PASSWORD}).status_code == 200  # link still usable


def test_logout_everywhere_ends_all_sessions(client, db):
    sign_up(client, db, "learner@example.com")
    stolen = client.cookies.get("fd_session")
    assert client.post("/api/auth/logout-all").status_code == 204
    client.cookies.set("fd_session", stolen)
    assert client.get("/api/auth/me").status_code == 401


def test_short_password_rejected(client):
    assert register(client, password="short").status_code == 422


def test_wrong_password_and_logout(client, db):
    sign_up(client, db, "learner@example.com")
    assert client.post("/api/auth/login", json={"email": "learner@example.com", "password": "nope-nope-nope"}).status_code == 401
    assert client.post("/api/auth/login", json={"email": "learner@example.com", "password": PASSWORD}).status_code == 200
    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/auth/me").status_code == 401


def test_verification_token_is_single_use_and_stored_hashed(client, db):
    register(client)
    token = last_token(db, "learner@example.com")
    assert db.auth_tokens.find_one({"token_hash": token}) is None
    assert client.post("/api/auth/verify-email", json={"token": token, "password": PASSWORD}).status_code == 200
    assert client.post("/api/auth/verify-email", json={"token": token, "password": PASSWORD}).status_code == 400


def test_forgot_password_does_not_reveal_accounts(client, db):
    a = client.post("/api/auth/forgot-password", json={"email": "nobody@example.com"})
    assert a.status_code == 200
    assert db.email_outbox.count_documents({"to": "nobody@example.com"}) == 0


def test_reset_password_changes_password_and_ends_old_sessions(client, db):
    sign_up(client, db, "learner@example.com")
    assert client.get("/api/auth/me").status_code == 200
    client.post("/api/auth/forgot-password", json={"email": "learner@example.com"})
    r = client.post("/api/auth/reset-password", json={"token": last_token(db, "learner@example.com"), "password": "a-brand-new-pass"})
    assert r.status_code == 200
    assert client.get("/api/auth/me").status_code == 401  # old session invalidated
    assert client.post("/api/auth/login", json={"email": "learner@example.com", "password": PASSWORD}).status_code == 401
    assert client.post("/api/auth/login", json={"email": "learner@example.com", "password": "a-brand-new-pass"}).status_code == 200


def test_admin_emails_get_admin_role(admin_client):
    assert admin_client.get("/api/auth/me").json()["user"]["role"] == "admin"


def test_login_is_rate_limited(client, db):
    sign_up(client, db, "learner@example.com")
    codes = [client.post("/api/auth/login", json={"email": "learner@example.com", "password": "wrong-password"}).status_code for _ in range(11)]
    assert codes[-1] == 429


def test_profile_update_and_validation(client, db):
    sign_up(client, db, "learner@example.com")
    r = client.patch("/api/profile", json={
        "proficiency_level": "intermediate", "accent": "american", "reminder_time": "07:45",
        "timezone": "Europe/London", "learning_goals": ["Job interviews", "Job interviews", "Travel"],
        "notifications": {"email": True, "push": False, "in_app": True},
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["proficiency_level"] == "intermediate"
    assert body["learning_goals"] == ["Job interviews", "Travel"]
    assert client.patch("/api/profile", json={"timezone": "Mars/Base"}).status_code == 422
    assert client.patch("/api/profile", json={"reminder_time": "25:00"}).status_code == 422


def test_subscribers_cannot_use_admin_api(client, db):
    sign_up(client, db, "learner@example.com")
    assert client.get("/api/admin/books").status_code == 403
    assert client.get("/api/admin/vocabulary").status_code == 403
    client.post("/api/auth/logout")
    assert client.get("/api/admin/books").status_code == 401
