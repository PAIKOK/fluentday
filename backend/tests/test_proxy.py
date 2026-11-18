from app.deps import forwarded_ip


def test_forwarded_ip_trusts_only_the_configured_proxies():
    assert forwarded_ip("1.1.1.1", "6.6.6.6", 0) == "1.1.1.1"  # no proxies: the header is ignored
    assert forwarded_ip("10.0.0.1", "9.9.9.9, 76.76.21.1", 2) == "9.9.9.9"  # Vercel → Render
    assert forwarded_ip("10.0.0.1", "6.6.6.6, 9.9.9.9, 76.76.21.1", 2) == "9.9.9.9"  # a faked first entry is skipped
    assert forwarded_ip("10.0.0.1", None, 2) == "10.0.0.1"
