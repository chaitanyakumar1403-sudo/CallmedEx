"""
Push delivery — Firebase Cloud Messaging HTTP v1.

Why v1 and not FCM_SERVER_KEY: the legacy `fcm.googleapis.com/fcm/send`
endpoint that a server key authenticates against was shut down by Google in
June 2024. Anything built on FCM_SERVER_KEY would fail in production, so this
uses the v1 API, which authenticates with a service account and an OAuth2
bearer token instead. FCM_SERVER_KEY / APNS_KEY_ID / APNS_TEAM_ID remain in
config.py unused; they are dead settings.

Credentials come from FCM_SERVICE_ACCOUNT_JSON — the whole service-account
JSON as one env var, which is what a Render secret can hold without mounting
a file. `google-auth` is already installed (google-generativeai depends on
it) and handles JWT signing and token refresh, so no new dependency and no
hand-rolled crypto.

iOS goes to APNs directly, not through FCM. The mobile client calls Expo's
`getDevicePushTokenAsync()`, which returns an FCM registration token on
Android but a raw APNs device token on iOS — and FCM v1 only addresses FCM
registration tokens. So `platform == "ios"` rows are sent over APNs
token-based auth (an ES256 JWT signed with the .p8 key), and everything else
goes to FCM. One `send_to_user` call fans out to both.
"""
import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx

from app.config import settings
from app.database import supabase

logger = logging.getLogger(__name__)

FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging"
FCM_ENDPOINT = "https://fcm.googleapis.com/v1/projects/{project_id}/messages:send"

# Android channels the mobile client registers in
# mobile/src/services/notifications.ts. A channel_id the app never created is
# dropped to the default channel by Android, so these must stay in step with
# that file.
CHANNEL_DISPATCH = "emergency_sos"
CHANNEL_TELEMEDICINE = "telemedicine"
CHANNEL_REPORTS = "lab_reports"
CHANNEL_APPOINTMENTS = "appointments"

# Token is dead — the app was uninstalled or the token rotated. Safe to
# deactivate. Anything else (a bad payload, an iOS APNs token, a transient
# 5xx) leaves the row alone, so a fixable problem is not papered over by
# quietly dropping the device.
_DEAD_TOKEN_STATUSES = {"UNREGISTERED", "NOT_FOUND"}

_credentials = None
_project_id: Optional[str] = None


def _load_credentials():
    """Build (once) the service-account credentials and cache the project id."""
    global _credentials, _project_id

    if _credentials is not None:
        return _credentials

    raw = (getattr(settings, "FCM_SERVICE_ACCOUNT_JSON", "") or "").strip()
    if not raw:
        return None

    try:
        info = json.loads(raw)
    except json.JSONDecodeError as e:
        logger.error(f"FCM_SERVICE_ACCOUNT_JSON is not valid JSON: {e}")
        return None

    try:
        from google.oauth2 import service_account

        creds = service_account.Credentials.from_service_account_info(
            info, scopes=[FCM_SCOPE]
        )
        project_id = (
            getattr(settings, "FCM_PROJECT_ID", "") or info.get("project_id") or ""
        ).strip()
        if not project_id:
            logger.error("FCM service account has no project_id and FCM_PROJECT_ID is unset")
            return None
        _credentials = creds
        _project_id = project_id
    except Exception as e:
        logger.error(f"Could not build FCM service-account credentials: {e}")
        return None

    return _credentials


def is_configured() -> bool:
    """True when push can actually be delivered."""
    return _load_credentials() is not None


def _fetch_access_token() -> Optional[str]:
    """Mint or refresh the OAuth2 bearer token. Blocking — call off the loop."""
    creds = _load_credentials()
    if creds is None:
        return None
    try:
        if not creds.valid:
            from google.auth.transport.requests import Request

            creds.refresh(Request())
        return creds.token
    except Exception as e:
        logger.error(f"FCM access token refresh failed: {e}")
        return None


def _rows(result) -> List[dict]:
    data = getattr(result, "data", None) or []
    return [dict(r) for r in data if isinstance(r, dict)]


def active_tokens_for_user(user_id: str) -> List[dict]:
    """Every live device registered to this user."""
    if not supabase or not user_id:
        return []
    try:
        return _rows(
            supabase.table("device_tokens")
            .select("push_token, platform")
            .eq("user_id", user_id)
            .eq("is_active", True)
            .execute()
        )
    except Exception as e:
        logger.warning(f"Could not read device tokens for {user_id}: {e}")
        return []


def _deactivate_token(push_token: str) -> None:
    if not supabase:
        return
    try:
        supabase.table("device_tokens").update({
            "is_active": False,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("push_token", push_token).execute()
        logger.info("Deactivated a push token FCM reported as UNREGISTERED")
    except Exception as e:
        logger.warning(f"Could not deactivate dead push token: {e}")


def _stringify(data: Optional[Dict[str, Any]]) -> Dict[str, str]:
    """FCM v1 rejects a data payload whose values are not all strings."""
    if not data:
        return {}
    out: Dict[str, str] = {}
    for k, v in data.items():
        if v is None:
            continue
        if isinstance(v, str):
            out[str(k)] = v
        elif isinstance(v, (dict, list)):
            out[str(k)] = json.dumps(v)
        else:
            out[str(k)] = str(v)
    return out


def _build_message(
    *, token: str, title: str, body: str, data: Dict[str, str], channel_id: str
) -> dict:
    return {
        "message": {
            "token": token,
            "notification": {"title": title, "body": body},
            "data": data,
            "android": {
                # A dispatch offer expires in minutes — it has to wake the
                # device rather than wait for the next maintenance window.
                "priority": "high",
                "notification": {"channel_id": channel_id, "sound": "default"},
            },
            "apns": {
                "headers": {"apns-priority": "10"},
                "payload": {"aps": {"sound": "default"}},
            },
        }
    }


async def _send_fcm(
    devices: List[dict], title: str, body: str, data: Dict[str, str], channel_id: str
) -> tuple:
    """Deliver to Android (and any true FCM token). Returns (delivered, errors)."""
    if not is_configured():
        return 0, [f"FCM not configured for {len(devices)} device(s)"]

    access_token = await asyncio.to_thread(_fetch_access_token)
    if not access_token:
        return 0, ["Could not obtain FCM access token"]

    url = FCM_ENDPOINT.format(project_id=_project_id)
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }

    delivered = 0
    errors: List[str] = []

    async with httpx.AsyncClient(timeout=10.0) as client:
        for device in devices:
            token = device.get("push_token")
            if not token:
                continue
            message = _build_message(
                token=token, title=title, body=body,
                data=data, channel_id=channel_id,
            )
            try:
                resp = await client.post(url, headers=headers, json=message)
            except Exception as e:
                errors.append(f"transport: {e}")
                continue

            if resp.status_code == 200:
                delivered += 1
                continue

            try:
                err_payload = resp.json()
            except Exception:
                err_payload = {}
            status = _error_status(err_payload)
            errors.append(f"{resp.status_code} {status or resp.text[:120]}")

            if status in _DEAD_TOKEN_STATUSES:
                _deactivate_token(token)

    return delivered, errors


# ─── APNs (iOS) ───────────────────────────────────────────────────────────

APNS_HOST_PROD = "https://api.push.apple.com"
APNS_HOST_SANDBOX = "https://api.sandbox.push.apple.com"

# Apple rejects a provider token older than 1 hour and rate-limits minting, so
# one JWT is reused until it is close to expiry.
_APNS_TOKEN_TTL_SECONDS = 45 * 60
_apns_jwt: Optional[str] = None
_apns_jwt_minted_at: float = 0.0

# The device is gone. Anything else (a bad topic, a wrong environment, a
# malformed payload) is our problem to fix, not the device's fault.
_APNS_DEAD_REASONS = {"Unregistered", "BadDeviceToken", "DeviceTokenNotForTopic"}


def apns_is_configured() -> bool:
    return bool(
        (getattr(settings, "APNS_KEY_ID", "") or "").strip()
        and (getattr(settings, "APNS_TEAM_ID", "") or "").strip()
        and (getattr(settings, "APNS_PRIVATE_KEY", "") or "").strip()
    )


def _apns_provider_token() -> Optional[str]:
    """Mint (or reuse) the ES256 provider JWT Apple authenticates against."""
    global _apns_jwt, _apns_jwt_minted_at
    import time

    if _apns_jwt and (time.time() - _apns_jwt_minted_at) < _APNS_TOKEN_TTL_SECONDS:
        return _apns_jwt

    if not apns_is_configured():
        return None

    try:
        import jwt as pyjwt

        # A .p8 pasted into an env var usually arrives with literal "\n".
        private_key = settings.APNS_PRIVATE_KEY.replace("\\n", "\n").strip()
        now = int(time.time())
        _apns_jwt = pyjwt.encode(
            {"iss": settings.APNS_TEAM_ID.strip(), "iat": now},
            private_key,
            algorithm="ES256",
            headers={"kid": settings.APNS_KEY_ID.strip()},
        )
        _apns_jwt_minted_at = now
        return _apns_jwt
    except Exception as e:
        logger.error(f"Could not mint APNs provider token: {e}")
        return None


def _apns_payload(title: str, body: str, data: Dict[str, str]) -> dict:
    # Custom keys sit beside "aps" at the top level, which is why they must
    # not collide with it.
    payload: Dict[str, Any] = {
        "aps": {"alert": {"title": title, "body": body}, "sound": "default"}
    }
    for k, v in data.items():
        if k != "aps":
            payload[k] = v
    return payload


async def _send_apns(
    devices: List[dict], title: str, body: str, data: Dict[str, str]
) -> tuple:
    """Deliver to iOS devices. Returns (delivered, errors)."""
    token_jwt = _apns_provider_token()
    if not token_jwt:
        return 0, [f"APNs not configured for {len(devices)} iOS device(s)"]

    host = APNS_HOST_SANDBOX if getattr(settings, "APNS_USE_SANDBOX", False) else APNS_HOST_PROD
    topic = getattr(settings, "MOBILE_BUNDLE_ID", "") or "com.callmedex.app"
    payload = _apns_payload(title, body, data)

    delivered = 0
    errors: List[str] = []

    # APNs requires HTTP/2.
    async with httpx.AsyncClient(http2=True, timeout=10.0) as client:
        for device in devices:
            token = device.get("push_token")
            if not token:
                continue
            try:
                resp = await client.post(
                    f"{host}/3/device/{token}",
                    json=payload,
                    headers={
                        "authorization": f"bearer {token_jwt}",
                        "apns-topic": topic,
                        "apns-push-type": "alert",
                        "apns-priority": "10",
                    },
                )
            except Exception as e:
                errors.append(f"apns transport: {e}")
                continue

            if resp.status_code == 200:
                delivered += 1
                continue

            try:
                reason = (resp.json() or {}).get("reason", "")
            except Exception:
                reason = resp.text[:120]
            errors.append(f"apns {resp.status_code} {reason}")

            if reason in _APNS_DEAD_REASONS:
                _deactivate_token(token)

    return delivered, errors


def _error_status(payload: Any) -> str:
    """Pull FCM's machine-readable status out of an error response."""
    if not isinstance(payload, dict):
        return ""
    error = payload.get("error") or {}
    for detail in error.get("details") or []:
        if isinstance(detail, dict) and detail.get("errorCode"):
            return str(detail["errorCode"])
    return str(error.get("status") or "")


async def send_to_user(
    user_id: str,
    title: str,
    body: str,
    data: Optional[Dict[str, Any]] = None,
    channel_id: str = CHANNEL_APPOINTMENTS,
) -> Dict[str, Any]:
    """Push to every live device this user has registered.

    Returns a summary rather than raising: a failed push must never take down
    the booking or dispatch it was announcing. Callers that care read
    `delivered`.
    """
    if not is_configured() and not apns_is_configured():
        return {"success": False, "error": "No push provider configured", "delivered": 0, "devices": 0}

    devices = active_tokens_for_user(user_id)
    if not devices:
        return {"success": False, "error": "No registered devices", "delivered": 0, "devices": 0}

    payload_data = _stringify(data)
    delivered = 0
    errors: List[str] = []

    # iOS registers a raw APNs token, which FCM cannot address — split the
    # fleet and send each half over the protocol that can reach it.
    ios_devices = [d for d in devices if (d.get("platform") or "").lower() == "ios"]
    fcm_devices = [d for d in devices if (d.get("platform") or "").lower() != "ios"]

    if ios_devices:
        ios_delivered, ios_errors = await _send_apns(
            ios_devices, title, body, payload_data
        )
        delivered += ios_delivered
        errors.extend(ios_errors)

    if fcm_devices:
        fcm_delivered, fcm_errors = await _send_fcm(
            fcm_devices, title, body, payload_data, channel_id
        )
        delivered += fcm_delivered
        errors.extend(fcm_errors)

    if delivered:
        logger.info(
            f"🔔 Push delivered to {delivered}/{len(devices)} device(s) for user {user_id}"
        )
    else:
        logger.warning(
            f"🔔 Push to {user_id}: NOT DELIVERED to any of {len(devices)} device(s). "
            f"{'; '.join(errors[:3])}"
        )

    return {
        "success": delivered > 0,
        "delivered": delivered,
        "devices": len(devices),
        "errors": errors,
        "error": None if delivered else (errors[0] if errors else "No device accepted the message"),
    }
