"""
Push delivery (FCM HTTP v1) — app/services/push.py.

Covers the parts that would fail quietly: a payload FCM would reject, a dead
token that must be retired, an iOS token that must NOT be retired, and the
dispatch fan-out actually reaching the phlebotomist's phone.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services import push as push_service


class _Resp:
    def __init__(self, status_code, payload=None, text=""):
        self.status_code = status_code
        self._payload = payload or {}
        self.text = text

    def json(self):
        return self._payload


def _device_db(devices):
    sb = MagicMock()
    chain = sb.table.return_value
    for m in ("select", "eq", "update"):
        getattr(chain, m).return_value = chain
    chain.execute.return_value = MagicMock(data=devices)
    return sb


@pytest.fixture
def configured(monkeypatch):
    """Pretend credentials are loaded, without touching Google."""
    monkeypatch.setattr(push_service, "_credentials", object())
    monkeypatch.setattr(push_service, "_project_id", "callmedex-test")
    monkeypatch.setattr(push_service, "_fetch_access_token", lambda: "ya29.fake")
    yield
    monkeypatch.setattr(push_service, "_credentials", None)


# ─── Payload shape ────────────────────────────────────────────────────────

def test_data_values_are_all_strings():
    """FCM v1 rejects the whole message if any data value is not a string."""
    out = push_service._stringify(
        {"distance_km": 2.4, "count": 3, "flag": True, "meta": {"a": 1}, "skip": None}
    )
    assert all(isinstance(v, str) for v in out.values())
    assert out["distance_km"] == "2.4"
    assert out["meta"] == '{"a": 1}'
    assert "skip" not in out


def test_message_targets_the_named_android_channel():
    msg = push_service._build_message(
        token="tok", title="T", body="B", data={"k": "v"},
        channel_id=push_service.CHANNEL_DISPATCH,
    )["message"]
    assert msg["token"] == "tok"
    assert msg["android"]["priority"] == "high"
    assert msg["android"]["notification"]["channel_id"] == "emergency_sos"


def test_error_status_is_read_from_fcm_detail_block():
    payload = {"error": {"status": "NOT_FOUND",
                         "details": [{"errorCode": "UNREGISTERED"}]}}
    assert push_service._error_status(payload) == "UNREGISTERED"
    assert push_service._error_status({"error": {"status": "INVALID_ARGUMENT"}}) == "INVALID_ARGUMENT"
    assert push_service._error_status(None) == ""


# ─── Delivery ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_unconfigured_reports_failure_not_success():
    with patch.object(push_service, "_load_credentials", lambda: None):
        result = await push_service.send_to_user("user-1", "T", "B")
    assert result["success"] is False
    assert result["delivered"] == 0


@pytest.mark.asyncio
async def test_delivers_to_every_registered_device(configured):
    db = _device_db([
        {"push_token": "fcm-a", "platform": "android"},
        {"push_token": "fcm-b", "platform": "android"},
    ])
    client = AsyncMock()
    client.post.return_value = _Resp(200, {"name": "projects/x/messages/1"})

    with patch.object(push_service, "supabase", db), \
         patch("httpx.AsyncClient") as ac:
        ac.return_value.__aenter__.return_value = client
        result = await push_service.send_to_user("user-1", "T", "B")

    assert result["success"] is True
    assert result["delivered"] == 2
    assert client.post.await_count == 2


@pytest.mark.asyncio
async def test_dead_token_is_deactivated(configured):
    db = _device_db([{"push_token": "fcm-dead", "platform": "android"}])
    client = AsyncMock()
    client.post.return_value = _Resp(
        404, {"error": {"status": "NOT_FOUND",
                        "details": [{"errorCode": "UNREGISTERED"}]}}
    )

    with patch.object(push_service, "supabase", db), \
         patch("httpx.AsyncClient") as ac:
        ac.return_value.__aenter__.return_value = client
        result = await push_service.send_to_user("user-1", "T", "B")

    assert result["success"] is False
    db.table.assert_any_call("device_tokens")
    update_arg = db.table.return_value.update.call_args[0][0]
    assert update_arg["is_active"] is False


@pytest.mark.asyncio
async def test_ios_devices_never_go_to_fcm(configured, monkeypatch):
    """An iOS token is an APNs token — sending it to FCM can only fail."""
    monkeypatch.setattr(push_service, "apns_is_configured", lambda: False)
    db = _device_db([{"push_token": "apns-hex", "platform": "ios"}])
    client = AsyncMock()

    with patch.object(push_service, "supabase", db), \
         patch("httpx.AsyncClient") as ac:
        ac.return_value.__aenter__.return_value = client
        result = await push_service.send_to_user("user-1", "T", "B")

    assert result["success"] is False
    client.post.assert_not_awaited()          # never sent to FCM
    db.table.return_value.update.assert_not_called()   # and never retired


@pytest.mark.asyncio
async def test_ios_delivers_over_apns(monkeypatch):
    db = _device_db([{"push_token": "apns-hex", "platform": "ios"}])
    monkeypatch.setattr(push_service, "apns_is_configured", lambda: True)
    monkeypatch.setattr(push_service, "_apns_provider_token", lambda: "jwt-fake")
    client = AsyncMock()
    client.post.return_value = _Resp(200)

    with patch.object(push_service, "supabase", db), \
         patch("httpx.AsyncClient") as ac:
        ac.return_value.__aenter__.return_value = client
        result = await push_service.send_to_user("user-1", "T", "B")

    assert result["success"] is True
    assert result["delivered"] == 1
    url = client.post.await_args[0][0]
    assert url.endswith("/3/device/apns-hex")
    headers = client.post.await_args.kwargs["headers"]
    assert headers["authorization"] == "bearer jwt-fake"
    assert headers["apns-push-type"] == "alert"


@pytest.mark.asyncio
async def test_apns_unregistered_device_is_retired(monkeypatch):
    db = _device_db([{"push_token": "apns-dead", "platform": "ios"}])
    monkeypatch.setattr(push_service, "apns_is_configured", lambda: True)
    monkeypatch.setattr(push_service, "_apns_provider_token", lambda: "jwt-fake")
    client = AsyncMock()
    client.post.return_value = _Resp(410, {"reason": "Unregistered"})

    with patch.object(push_service, "supabase", db), \
         patch("httpx.AsyncClient") as ac:
        ac.return_value.__aenter__.return_value = client
        result = await push_service.send_to_user("user-1", "T", "B")

    assert result["success"] is False
    assert db.table.return_value.update.call_args[0][0]["is_active"] is False


@pytest.mark.asyncio
async def test_apns_bad_payload_does_not_retire_the_device(monkeypatch):
    """A wrong topic is our misconfiguration — the phone is fine."""
    db = _device_db([{"push_token": "apns-ok", "platform": "ios"}])
    monkeypatch.setattr(push_service, "apns_is_configured", lambda: True)
    monkeypatch.setattr(push_service, "_apns_provider_token", lambda: "jwt-fake")
    client = AsyncMock()
    client.post.return_value = _Resp(400, {"reason": "TopicDisallowed"})

    with patch.object(push_service, "supabase", db), \
         patch("httpx.AsyncClient") as ac:
        ac.return_value.__aenter__.return_value = client
        await push_service.send_to_user("user-1", "T", "B")

    db.table.return_value.update.assert_not_called()


def test_apns_payload_keeps_custom_data_beside_aps():
    payload = push_service._apns_payload("T", "B", {"dispatch_id": "d-1", "aps": "ignored"})
    assert payload["aps"]["alert"] == {"title": "T", "body": "B"}
    assert payload["dispatch_id"] == "d-1"
    assert payload["aps"] != "ignored"


@pytest.mark.asyncio
async def test_mixed_fleet_uses_both_providers(configured, monkeypatch):
    """One user, an Android phone and an iPad — both must be reached."""
    db = _device_db([
        {"push_token": "fcm-a", "platform": "android"},
        {"push_token": "apns-b", "platform": "ios"},
    ])
    monkeypatch.setattr(push_service, "apns_is_configured", lambda: True)
    monkeypatch.setattr(push_service, "_apns_provider_token", lambda: "jwt-fake")
    client = AsyncMock()
    client.post.return_value = _Resp(200, {"name": "ok"})

    with patch.object(push_service, "supabase", db), \
         patch("httpx.AsyncClient") as ac:
        ac.return_value.__aenter__.return_value = client
        result = await push_service.send_to_user("user-1", "T", "B")

    assert result["delivered"] == 2
    urls = [c[0][0] for c in client.post.await_args_list]
    assert any("api.push.apple.com" in u for u in urls)
    assert any("fcm.googleapis.com" in u for u in urls)


@pytest.mark.asyncio
async def test_transport_failure_is_reported_not_raised(configured):
    db = _device_db([{"push_token": "fcm-a", "platform": "android"}])
    client = AsyncMock()
    client.post.side_effect = RuntimeError("connection reset")

    with patch.object(push_service, "supabase", db), \
         patch("httpx.AsyncClient") as ac:
        ac.return_value.__aenter__.return_value = client
        result = await push_service.send_to_user("user-1", "T", "B")

    assert result["success"] is False
    assert "connection reset" in result["errors"][0]


# ─── Wiring ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_notification_engine_push_channel_uses_fcm():
    from app.services.notification_engine import NotificationEngine

    sent = {}

    async def _fake_send(**kwargs):
        sent.update(kwargs)
        return {"success": True, "delivered": 1, "devices": 1, "errors": [], "error": None}

    with patch.object(push_service, "send_to_user", new=_fake_send):
        result = await NotificationEngine._send_push(
            "user-1", "Title", "Body", {"channel_id": push_service.CHANNEL_DISPATCH}
        )

    assert result["success"] is True
    assert sent["channel_id"] == "emergency_sos"


@pytest.mark.asyncio
async def test_dispatch_offer_push_carries_no_patient_identity():
    """A push preview renders on a locked screen — it must not leak the
    patient's name or full address."""
    from app.services.dispatch_engine import UniversalDispatchEngine

    sent = {}

    async def _fake_send(**kwargs):
        sent.update(kwargs)
        return {"success": True, "delivered": 1, "devices": 1, "errors": [], "error": None}

    with patch.object(push_service, "send_to_user", new=_fake_send):
        await UniversalDispatchEngine._push_offer_to_candidate(
            provider_id="phlebo-1",
            service_subtype="home_collection",
            distance_km=2.4,
            patient_address="12-3-4 Flat 5, Dwaraka Nagar, Visakhapatnam",
            priority="urgent",
            dispatch_id="dispatch-1",
            offer_id="offer-1",
        )

    blob = f"{sent['title']} {sent['body']}"
    assert "Flat 5" not in blob
    assert "12-3-4" not in blob
    assert "2.4 km" in blob
    assert sent["channel_id"] == "emergency_sos"
    assert sent["data"]["offer_id"] == "offer-1"


@pytest.mark.asyncio
async def test_offer_push_never_raises_into_the_dispatch(configured):
    from app.services.dispatch_engine import UniversalDispatchEngine

    async def _boom(**kwargs):
        raise RuntimeError("FCM down")

    with patch.object(push_service, "send_to_user", new=_boom):
        # Must return, not propagate — a push failure cannot sink a dispatch.
        await UniversalDispatchEngine._push_offer_to_candidate(
            provider_id="phlebo-1",
            service_subtype="home_collection",
            distance_km=1.0,
            patient_address="Somewhere",
            priority="normal",
            dispatch_id="d-1",
            offer_id="o-1",
        )
