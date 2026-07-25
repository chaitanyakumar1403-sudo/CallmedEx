from app.main import is_origin_allowed

def test_allowed_origin_passes():
    assert is_origin_allowed("http://localhost:3000", ["http://localhost:3000"]) is True

def test_arbitrary_origin_rejected():
    assert is_origin_allowed("https://evil.example.com", ["http://localhost:3000"]) is False

def test_empty_origin_rejected():
    assert is_origin_allowed("", ["http://localhost:3000"]) is False


# ── Regression: the deployed frontend origin must never be excluded ──────────
# Every dashboard call was failing preflight with a 400 because ALLOWED_ORIGINS
# and FRONTEND_URL disagreed — the app knew its own frontend URL and still
# rejected it.

import re

from app.main import build_allowed_origins, vercel_preview_regex, _normalise_origin


def test_frontend_url_is_always_allowed(monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings, "ALLOWED_ORIGINS", ["http://localhost:3000"])
    monkeypatch.setattr(settings, "FRONTEND_URL", "https://my-app.vercel.app")

    origins = build_allowed_origins()
    assert "https://my-app.vercel.app" in origins
    assert is_origin_allowed("https://my-app.vercel.app", origins) is True


def test_trailing_slash_does_not_break_matching(monkeypatch):
    """Browsers send Origin without a trailing slash; config often has one."""
    from app.config import settings
    monkeypatch.setattr(settings, "ALLOWED_ORIGINS", ["https://site.app/"])
    monkeypatch.setattr(settings, "FRONTEND_URL", "https://site.app/")

    origins = build_allowed_origins()
    assert origins == ["https://site.app"]
    assert is_origin_allowed("https://site.app", origins) is True


def test_duplicate_frontend_url_is_not_added_twice(monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings, "ALLOWED_ORIGINS", ["https://site.app"])
    monkeypatch.setattr(settings, "FRONTEND_URL", "https://site.app")
    assert build_allowed_origins().count("https://site.app") == 1


def test_preview_regex_matches_own_project_only():
    """
    Preview URLs are per-branch so cannot be listed. The pattern must stay scoped
    to this project — with allow_credentials=True, a blanket *.vercel.app would
    let anyone's deployment call the API with a user's session.
    """
    rx = vercel_preview_regex("https://callmedex-v1.vercel.app")
    assert re.match(rx, "https://callmedex-v1.vercel.app")
    assert re.match(rx, "https://callmedex-v1-git-main-team.vercel.app")
    assert not re.match(rx, "https://evil.vercel.app")
    assert not re.match(rx, "https://callmedex-v1.vercel.app.attacker.com")


def test_empty_frontend_url_yields_no_regex():
    assert vercel_preview_regex("") == ""


def test_normalise_handles_none():
    assert _normalise_origin(None) == ""
