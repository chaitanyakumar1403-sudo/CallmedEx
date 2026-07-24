from app.main import is_origin_allowed

def test_allowed_origin_passes():
    assert is_origin_allowed("http://localhost:3000", ["http://localhost:3000"]) is True

def test_arbitrary_origin_rejected():
    assert is_origin_allowed("https://evil.example.com", ["http://localhost:3000"]) is False

def test_empty_origin_rejected():
    assert is_origin_allowed("", ["http://localhost:3000"]) is False
