from app.middleware.rate_limiter import resolve_client_ip

def test_no_trusted_proxy_ignores_xff():
    # spoof attempt: client sends XFF=127.0.0.1 to dodge limits; must be ignored
    assert resolve_client_ip("127.0.0.1", "203.0.113.9", 0) == "203.0.113.9"

def test_one_trusted_proxy_takes_second_from_right():
    assert resolve_client_ip("203.0.113.9, 10.0.0.1", "10.0.0.1", 1) == "203.0.113.9"

def test_missing_xff_uses_direct():
    assert resolve_client_ip(None, "203.0.113.9", 1) == "203.0.113.9"
