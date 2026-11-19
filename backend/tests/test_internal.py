def test_scheduler_endpoint_is_hidden_without_a_token_and_needs_the_right_one(client, settings):
    assert client.post("/api/internal/run-scheduler").status_code == 404
    settings.scheduler_token = "s" * 40
    assert client.post("/api/internal/run-scheduler", headers={"Authorization": "Bearer wrong"}).status_code == 401
    r = client.post("/api/internal/run-scheduler", headers={"Authorization": f"Bearer {'s' * 40}"})
    assert r.status_code == 200 and r.json()["reminders_sent"] == 0
