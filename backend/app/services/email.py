"""
Email Service — Next-Gen CallMedex
Sends role-specific MOU emails with secure magic links.
Uses version-controlled legal documents from the database.
"""
import os
import uuid
import logging
import smtplib
from email.message import EmailMessage
from jose import jwt
from datetime import datetime, timedelta, timezone
from app.config import settings
from app.services.legal import LegalService
from app.services.magic_link import MagicLinkService

logger = logging.getLogger(__name__)

# Use a dedicated secret for email tokens (MOU, password reset, etc.)
# Falls back to JWT_SECRET in dev, but production should set EMAIL_TOKEN_SECRET.
EMAIL_TOKEN_SECRET = settings.EMAIL_TOKEN_SECRET
ALGORITHM = settings.JWT_ALGORITHM


class EmailService:
    @staticmethod
    def _read_mou_terms() -> str:
        """Legacy: Reads the MOU template from the assets folder."""
        try:
            mou_path = os.path.join(os.getcwd(), "assets", "MOU_Terms.txt")
            with open(mou_path, "r") as f:
                return f.read()
        except Exception as e:
            logger.error(f"Could not read MOU file: {e}")
            return "MOU Terms could not be loaded. Please contact support."

    @staticmethod
    def send_mou_email_for_role(to_email: str, role: str, user_payload: dict, registrant_email: str = None):
        """
        Sends role-specific MOU email with a secure magic link.
        Fetches the correct MOU from the legal_documents table (or fallback).
        If registrant_email is provided, it means the MOU is being sent to the owner
        on behalf of the registrant.
        """
        # Get the correct legal document for this role
        legal_doc = LegalService.get_active_document(role)

        # Create a token containing the signup data + document info
        expire = datetime.now(timezone.utc) + timedelta(hours=24)
        payload = {
            "exp": expire,
            "type": "mou_acceptance",
            "role": role,
            "document_id": legal_doc.get("id"),
            "document_version": legal_doc.get("version", "v1.0"),
            "signup_data": user_payload,
        }
        token = jwt.encode(payload, EMAIL_TOKEN_SECRET, algorithm=ALGORITHM)

        # Build the magic link
        magic_link = f"{settings.FRONTEND_URL}/auth/accept-mou?token={token}"
        mou_title = legal_doc.get("title", "CallMedex MOU")
        mou_text = legal_doc.get("content_text", "MOU content unavailable.")

        role_display = role.replace("_", " ").title()
        registrant_name = user_payload.get('user_data', {}).get('full_name', 'Partner')

        # Build HTML content
        subject = f"Action Required: Accept {role_display} MOU to Activate Your CallMedex Account"
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; background-color: #f4f4f5; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px;">
                <h2 style="color: #1e293b;">📋 CallMedex Partner Registration</h2>
                <p>Dear {'Owner' if registrant_email else registrant_name},</p>
                <p>{f"Your representative ({registrant_name}, {registrant_email}) has initiated a {role_display} registration." if registrant_email else f"Thank you for registering as a {role_display} on CallMedex."}</p>
                <p>Please review and accept the <strong>{mou_title}</strong> to activate the account:</p>
                <div style="margin: 25px 0;">
                    <a href="{magic_link}" style="background-color: #7e22ce; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                        Review & Accept MOU
                    </a>
                </div>
                <p style="color: #64748b; font-size: 13px;">This link will expire in 24 hours.</p>
            </div>
        </body>
        </html>
        """
        text_content = f"Accept MOU to activate account: {magic_link}"

        # Dispatch via Resend API / SMTP or fallback to console log
        if not EmailService._send_real_email(to_email, subject, html_content, text_content):
            logger.warning(f"Email delivery degraded to console fallback (MOU email, {to_email}) — RESEND_API_KEY/SMTP not configured or send failed")
            print("\n" + "=" * 70)
            print(f"[EMAIL DISPATCHED TO] {to_email}")
            if registrant_email:
                print(f"[INITIATED BY] {registrant_email} (Registrant)")
            print(f"[SUBJECT] {subject}")
            print("=" * 70)
            print(f"Dear {'Owner' if registrant_email else registrant_name},\n")
            print(f"Review and accept MOU link: {magic_link}\n")
            print("=" * 70 + "\n")

        return token

    @staticmethod
    def send_mou_email(to_email: str, user_payload: dict):
        """
        Legacy method — kept for backward compatibility.
        Now delegates to send_mou_email_for_role with 'organization' role.
        """
        EmailService.send_mou_email_for_role(to_email, "organization", user_payload)

    @staticmethod
    def send_welcome_email(to_email: str, provider_name: str, role: str = "organization"):
        """
        Sends a welcome email after MOU acceptance and account activation.
        """
        role_display = role.replace("_", " ").title()
        subject = f"Welcome to CallMedex! Your {role_display} Account is Active"
        login_url = f"{settings.FRONTEND_URL}/auth/login"

        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; background-color: #f4f4f5; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h2 style="color: #16a34a; margin-top: 0;">🎉 Welcome to CallMedex!</h2>
                <p style="color: #374151; font-size: 16px;">Dear <strong>{provider_name}</strong>,</p>
                <p style="color: #374151; font-size: 16px;">Your MOU acceptance was successful. Your <strong>{role_display}</strong> account is now officially active!</p>
                
                <div style="margin: 25px 0;">
                    <a href="{login_url}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                        Log In to Your Dashboard
                    </a>
                </div>
                <p style="color: #6b7280; font-size: 14px;">Next steps on CallMedex:</p>
                <ul style="color: #4b5563; font-size: 14px; line-height: 1.6;">
                    <li>Complete your organization profile & upload documents</li>
                    <li>Receive and manage patient bookings in real-time</li>
                    <li>Manage service availability and staff schedules</li>
                </ul>
            </div>
        </body>
        </html>
        """
        text_content = f"Dear {provider_name},\nYour {role_display} account is active! Log in at: {login_url}"

        if not EmailService._send_real_email(to_email, subject, html_content, text_content):
            logger.warning(f"Email delivery degraded to console fallback (welcome email, {to_email}) — RESEND_API_KEY/SMTP not configured or send failed")
            print("\n" + "=" * 70)
            print(f"[WELCOME EMAIL TO] {to_email}")
            print(f"[SUBJECT] {subject}")
            print("=" * 70 + "\n")

    @staticmethod
    def send_dispatch_alert_email(to_email: str, provider_name: str, task_details: dict):
        """
        Sends an alert email to a nearby provider when a new dispatch is requested.
        """
        service_title = task_details.get('service_subtype', 'Service').replace('_', ' ').title()
        subject = f"🚨 Urgent: New {service_title} Request Nearby!"
        dashboard_url = f"{settings.FRONTEND_URL}/dashboard"

        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; background-color: #f4f4f5; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h2 style="color: #dc2626; margin-top: 0;">🚨 Urgent Dispatch Request</h2>
                <p style="color: #374151; font-size: 16px;">Hello <strong>{provider_name}</strong>,</p>
                <p style="color: #374151; font-size: 16px;">A new home visit request matched your service area.</p>
                
                <div style="background: #f8fafc; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Service:</strong> {service_title}</p>
                    <p style="margin: 5px 0;"><strong>Location:</strong> {task_details.get('patient_address', 'Unknown Location')}</p>
                    <p style="margin: 5px 0;"><strong>Distance:</strong> {task_details.get('distance_km', '?')} km away</p>
                </div>
                
                <div style="margin: 25px 0;">
                    <a href="{dashboard_url}" style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                        Open Dashboard to Respond
                    </a>
                </div>
            </div>
        </body>
        </html>
        """
        text_content = f"Hello {provider_name}, new request nearby: {service_title}. Open dashboard: {dashboard_url}"

        if not EmailService._send_real_email(to_email, subject, html_content, text_content):
            logger.warning(f"Email delivery degraded to console fallback (dispatch alert, {to_email}) — RESEND_API_KEY/SMTP not configured or send failed")
            print("\n" + "=" * 70)
            print(f"[DISPATCH ALERT TO] {to_email}")
            print(f"[SUBJECT] {subject}")
            print("=" * 70 + "\n")

    @staticmethod
    def send_tracking_link_email(to_email: str, patient_name: str, tracking_url: str, provider_name: str, provider_type: str):
        """
        Sends the tracking link to the patient when a provider accepts the dispatch.
        """
        provider_title = provider_type.replace('_', ' ').title()
        subject = f"🚗 Your {provider_title} is on the way!"

        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; background-color: #f4f4f5; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h2 style="color: #16a34a; margin-top: 0;">🚗 Provider En Route!</h2>
                <p style="color: #374151; font-size: 16px;">Dear <strong>{patient_name}</strong>,</p>
                <p style="color: #374151; font-size: 16px;">Great news! <strong>{provider_name}</strong> has accepted your request and is heading to your location.</p>
                
                <div style="margin: 25px 0;">
                    <a href="{tracking_url}" style="background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                        Track Live Location & View Service OTP
                    </a>
                </div>
                <p style="color: #6b7280; font-size: 14px;">Please keep your 6-digit Service OTP ready to share when the provider arrives.</p>
            </div>
        </body>
        </html>
        """
        text_content = f"Dear {patient_name},\n{provider_name} is on the way! Track live location & OTP here: {tracking_url}"

        if not EmailService._send_real_email(to_email, subject, html_content, text_content):
            logger.warning(f"Email delivery degraded to console fallback (tracking link, {to_email}) — RESEND_API_KEY/SMTP not configured or send failed")
            print("\n" + "=" * 70)
            print(f"[TRACKING LINK TO] {to_email}")
            print(f"[SUBJECT] {subject}")
            print("=" * 70 + "\n")

    @staticmethod
    def _send_real_email(to_email: str, subject: str, html_content: str, text_content: str) -> bool:
        """
        Internal helper to send real email using Resend API or SMTP if configured.
        Returns True if sent via Resend or SMTP, False otherwise.
        """
        # 1. Try Resend API if RESEND_API_KEY is configured
        if getattr(settings, "RESEND_API_KEY", ""):
            try:
                import json
                import urllib.request
                import urllib.error

                url = "https://api.resend.com/emails"
                configured_from = settings.SMTP_FROM_EMAIL or "onboarding@resend.dev"
                if "<" in configured_from:
                    from_email = configured_from
                else:
                    from_email = f"CallMedex <{configured_from}>"

                payload = {
                    "from": from_email,
                    "to": [to_email],
                    "subject": subject,
                    "html": html_content,
                    "text": text_content,
                }
                headers = {
                    "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                    "Content-Type": "application/json",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                }
                req = urllib.request.Request(
                    url,
                    data=json.dumps(payload).encode("utf-8"),
                    headers=headers,
                    method="POST",
                )
                try:
                    with urllib.request.urlopen(req) as resp:
                        if resp.status in (200, 201):
                            logger.info(f"Resend email delivered to {to_email}")
                            return True
                except urllib.error.HTTPError as http_err:
                    err_body = http_err.read().decode("utf-8", errors="ignore")
                    logger.warning(f"Resend primary send failed ({http_err.code}): {err_body}")
                    # If failed due to domain verification, retry with onboarding@resend.dev
                    if "domain" in err_body.lower() or "not verified" in err_body.lower():
                        try:
                            payload["from"] = "CallMedex <onboarding@resend.dev>"
                            req_retry = urllib.request.Request(
                                url,
                                data=json.dumps(payload).encode("utf-8"),
                                headers=headers,
                                method="POST",
                            )
                            with urllib.request.urlopen(req_retry) as resp_retry:
                                if resp_retry.status in (200, 201):
                                    logger.info(f"Resend email delivered to {to_email} via fallback sender")
                                    return True
                        except Exception as retry_err:
                            logger.error(f"Resend fallback retry also failed for {to_email}: {retry_err}")
            except Exception as e:
                logger.error(f"Resend API email sending failed for {to_email}: {e}")

        # 2. Try SMTP fallback if SMTP_HOST and SMTP_USERNAME are configured
        if settings.SMTP_HOST and settings.SMTP_USERNAME:
            try:
                msg = EmailMessage()
                msg['Subject'] = subject
                msg['From'] = settings.SMTP_FROM_EMAIL or "noreply@callmedex.com"
                msg['To'] = to_email
                msg.set_content(text_content)
                msg.add_alternative(html_content, subtype='html')

                with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                    server.starttls()
                    server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                    server.send_message(msg)
                logger.info(f"SMTP email delivered to {to_email}")
                return True
            except Exception as e:
                logger.error(f"SMTP sending failed: {e}")
                return False

        return False

    @staticmethod
    def send_magic_dispatch_email(to_email: str, provider_name: str, task_details: dict, offer_id: str, provider_id: str):
        """
        Sends an interactive magic link email allowing the provider to accept/decline
        the dispatch directly from their email inbox without logging in.
        """
        # The magic link must live as long as the offer itself. It was fixed at
        # 5 minutes while the accept window is 10, so a provider clicking at
        # minute 6 of a valid offer was told the link had expired.
        window = int(task_details.get("window_minutes") or 10)
        accept_token = MagicLinkService.generate_token(offer_id, provider_id, expiration_minutes=window)
        decline_token = MagicLinkService.generate_token(offer_id, provider_id, expiration_minutes=window)
        
        accept_link = f"{settings.FRONTEND_URL}/dispatch/respond?action=accept&token={accept_token}"
        decline_link = f"{settings.FRONTEND_URL}/dispatch/respond?action=decline&token={decline_token}"
        
        # Only genuinely urgent work gets the red treatment. Shouting "URGENT" at
        # every dispatch trains providers to ignore the word, so when a real
        # emergency arrives it reads like all the others.
        is_urgent = task_details.get("priority") == "urgent"
        service_label = task_details.get("service_subtype", "Service").replace("_", " ").title()
        subject = (
            f"🔴 URGENT: {service_label} needed now — {task_details.get('distance_km', '?')} km away"
            if is_urgent
            else f"New {service_label} request nearby"
        )
        
        text_content = f"""
Hello {provider_name},

A new home visit request is available in your area.

--- TASK DETAILS ---
Type: {task_details.get('service_subtype', 'Service').replace('_', ' ').title()}
Location: {task_details.get('patient_address', 'Unknown Location')}
Distance: {task_details.get('distance_km', '?')} km away
Notes: {task_details.get('notes', 'None')}
--------------------

You have {window} minutes to respond. Click a link below:
ACCEPT: {accept_link}
DECLINE: {decline_link}
"""

        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; background-color: #f4f4f5; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h2 style="color: #18181b; margin-top: 0;">🚨 Urgent Dispatch Request</h2>
                <p style="color: #52525b; font-size: 16px;">Hello <strong>{provider_name}</strong>,</p>
                <p style="color: #52525b; font-size: 16px;">A new patient request has matched with you.</p>
                
                <div style="background: #f8fafc; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Type:</strong> {task_details.get('service_subtype', 'Service').replace('_', ' ').title()}</p>
                    <p style="margin: 5px 0;"><strong>Location:</strong> {task_details.get('patient_address', 'Unknown Location')}</p>
                    <p style="margin: 5px 0;"><strong>Distance:</strong> {task_details.get('distance_km', '?')} km away</p>
                    {f'<p style="margin: 5px 0; white-space: pre-wrap;"><strong>Notes:</strong><br/>{task_details.get("notes")}</p>' if task_details.get('notes') else ''}
                </div>
                
                {'<div style="background:#fef2f2;border:2px solid #dc2626;border-radius:8px;padding:14px;margin:16px 0;"><strong style="color:#dc2626;font-size:16px;">🔴 URGENT REQUEST — PRIORITY DISPATCH</strong><div style="color:#991b1b;font-size:13px;margin-top:4px;">This patient needs attention now. Please respond immediately if you can attend.</div></div>' if is_urgent else ''}

                <p style="color: #ef4444; font-weight: bold; font-size: 14px;">⏱️ This offer expires in {window} minutes.</p>
                
                <div style="margin-top: 30px;">
                    <a href="{accept_link}" style="display: inline-block; background-color: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-right: 15px;">✅ Accept Request</a>
                    <a href="{decline_link}" style="display: inline-block; background-color: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">❌ Decline</a>
                </div>
            </div>
        </body>
        </html>
        """

        # P1.6: Retry-once on failure + ops alert on complete failure
        sent = EmailService._send_real_email(to_email, subject, html_content, text_content)

        if not sent:
            # Retry once after a short delay
            import time
            time.sleep(2)
            sent = EmailService._send_real_email(to_email, subject, html_content, text_content)

        if not sent:
            logger.error(
                f"DISPATCH EMAIL FAILED (both attempts) for offer {offer_id} to {to_email}"
            )
            # Create ops alert so dispatch is not silently lost
            try:
                from app.services.ops_alerts import OpsAlertService
                OpsAlertService.create_alert(
                    alert_type="email_send_failed",
                    entity_type="dispatch_offer",
                    entity_id=offer_id,
                    severity="critical",
                    details={
                        "to_email": to_email,
                        "provider_name": provider_name,
                        "provider_id": provider_id,
                        "service_type": task_details.get("service_subtype", ""),
                    },
                )
            except Exception as alert_err:
                logger.error(f"Ops alert creation also failed: {alert_err}")

            # Console fallback
            logger.warning(f"Email delivery degraded to console fallback (magic dispatch, {to_email})")
            print("\n" + "🔴" * 35)
            print("🚨 URGENT EMAIL DELIVERY FAILED 🚨".center(70))
            print("🔴" * 35)
            print(f"TO: {to_email}")
            print(f"SUBJECT: {subject}")
            print("-" * 70)
            print(text_content)
            print("🔴" * 35 + "\n")

    @staticmethod
    def send_magic_dispatch_email_safe(to_email: str, provider_name: str, task_details: dict, offer_id: str, provider_id: str):
        """
        Same as send_magic_dispatch_email, but for callers that fire it as a
        background task (dispatch_engine does via asyncio.create_task). An
        exception raised before that function's own retry/ops-alert logic
        kicks in — e.g. MagicLinkService.generate_token failing — would
        otherwise vanish into the task with nothing but asyncio's generic
        "Task exception was never retrieved" log, and the critical ops alert
        dispatch relies on to know a provider was never notified would never
        fire. This wrapper guarantees that alert fires either way.
        """
        try:
            EmailService.send_magic_dispatch_email(
                to_email=to_email,
                provider_name=provider_name,
                task_details=task_details,
                offer_id=offer_id,
                provider_id=provider_id,
            )
        except Exception as e:
            logger.error(f"DISPATCH EMAIL TASK CRASHED for offer {offer_id} to {to_email}: {e}")
            try:
                from app.services.ops_alerts import OpsAlertService
                OpsAlertService.create_alert(
                    alert_type="email_send_failed",
                    entity_type="dispatch_offer",
                    entity_id=offer_id,
                    severity="critical",
                    details={
                        "to_email": to_email,
                        "provider_name": provider_name,
                        "provider_id": provider_id,
                        "service_type": (task_details or {}).get("service_subtype", ""),
                        "error": str(e),
                    },
                )
            except Exception as alert_err:
                logger.error(f"Ops alert creation also failed: {alert_err}")

    @staticmethod
    def send_password_reset_email(to_email: str, otp_code: str, reset_link: str, user_name: str = "User"):
        """
        Sends password reset email with 6-digit OTP code and magic link.
        Falls back to console output when no SMTP/Resend is configured.
        """
        subject = "🔐 CallMedex Password Reset — Your Verification Code"

        html_content = f"""
        <html>
        <body style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #f0f4f8; padding: 20px; margin: 0;">
            <div style="max-width: 520px; margin: 0 auto; background: white; padding: 40px; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
                <div style="text-align: center; margin-bottom: 30px;">
                    <div style="font-size: 2.5rem; margin-bottom: 8px;">🔐</div>
                    <h2 style="color: #1e293b; margin: 0 0 4px 0; font-size: 22px;">Password Reset Request</h2>
                    <p style="color: #64748b; font-size: 14px; margin: 0;">CallMedex Healthcare Platform</p>
                </div>

                <p style="color: #374151; font-size: 15px; line-height: 1.6;">
                    Hello <strong>{user_name}</strong>,
                </p>
                <p style="color: #374151; font-size: 15px; line-height: 1.6;">
                    We received a request to reset the password for your CallMedex account. Use the verification code below or click the reset button.
                </p>

                <div style="background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
                    <div style="color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">Your Verification Code</div>
                    <div style="color: #ffffff; font-size: 36px; font-weight: 800; letter-spacing: 8px; font-family: 'Courier New', monospace;">{otp_code}</div>
                    <div style="color: #94a3b8; font-size: 12px; margin-top: 8px;">Valid for 15 minutes</div>
                </div>

                <div style="text-align: center; margin: 28px 0;">
                    <span style="color: #9ca3af; font-size: 13px;">— or —</span>
                </div>

                <div style="text-align: center; margin: 20px 0;">
                    <a href="{reset_link}" style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 10px; font-weight: 700; display: inline-block; font-size: 15px; box-shadow: 0 4px 12px rgba(2,132,199,0.3);">
                        🔑 Reset My Password
                    </a>
                </div>

                <div style="background: #fef3c7; border-radius: 8px; padding: 14px; margin-top: 24px;">
                    <p style="color: #92400e; font-size: 13px; margin: 0; line-height: 1.5;">
                        ⚠️ <strong>Security Notice:</strong> If you didn't request this password reset, please ignore this email. Your password will remain unchanged.
                    </p>
                </div>

                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
                <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
                    This is an automated message from CallMedex. Please do not reply.
                </p>
            </div>
        </body>
        </html>
        """

        text_content = f"""
Hello {user_name},

We received a request to reset your CallMedex password.

Your Verification Code: {otp_code}
(Valid for 15 minutes)

Or click this link to reset: {reset_link}

If you didn't request this, please ignore this email.
"""

        if not EmailService._send_real_email(to_email, subject, html_content, text_content):
            logger.warning(f"Email delivery degraded to console fallback (password reset OTP, {to_email}) — RESEND_API_KEY/SMTP not configured or send failed. OTP was NOT delivered to the user.")
            print("\n" + "=" * 70)
            print(f"[PASSWORD RESET EMAIL TO] {to_email}")
            print(f"[SUBJECT] {subject}")
            print("=" * 70)
            print(f"  User: {user_name}")
            print(f"  OTP Code: {otp_code}")
            print(f"  Reset Link: {reset_link}")
            print("=" * 70 + "\n")

    @staticmethod
    def send_booking_alert_email(
        to_email: str,
        recipient_role: str,
        recipient_name: str,
        booking_details: dict,
    ):
        """
        Sends rich booking alert emails:
        - To the patient: Booking confirmed with slot details.
        - To the provider (Doctor, Nurse, Dietitian, Physio): New appointment alert with 80% remuneration breakdown.
        """
        service_type = booking_details.get("service_type", "Healthcare Consultation").replace("_", " ").title()
        slot_time = booking_details.get("slot_time", "Scheduled Time")
        booking_id = booking_details.get("booking_id", "")
        amount = booking_details.get("amount", 0)

        if recipient_role == "provider":
            subject = f"CallMedex Alert: New {service_type} Booking ({slot_time})"
            provider_net = round(amount * 0.8) if amount else 0
            provider_role = booking_details.get("provider_role") or "doctor"
            role_to_path = {
                "doctor": "doctor",
                "dentist": "dentist",
                "nurse": "nurse",
                "dietitian": "dietitian",
                "physiotherapist": "physiotherapist",
                "organization": "organization",
                "pharmacy": "pharmacy",
                "phlebotomist": "phlebotomist",
                "staff": "staff",
            }
            subpath = role_to_path.get(provider_role, "doctor")
            dashboard_url = f"{settings.FRONTEND_URL}/dashboard/{subpath}"
            patient_name = booking_details.get("patient_name", "Patient")
            patient_notes = booking_details.get("notes", "General consultation")

            html_content = f"""
            <html>
            <body style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 20px;">
                <div style="max-width: 600px; margin: 0 auto; background: white; padding: 32px; border-radius: 12px; border: 1px solid #e2e8f0;">
                    <div style="border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 20px;">
                        <h2 style="color: #0f172a; margin: 0;">CallMedex Provider Command Center</h2>
                        <span style="color: #0284c7; font-weight: bold; font-size: 14px;">New Patient Booking Alert</span>
                    </div>
                    <p style="color: #334155; font-size: 15px;">Dear <strong>{recipient_name}</strong>,</p>
                    <p style="color: #334155; font-size: 15px;">A new patient consultation has been scheduled on your CallMedex roster.</p>
                    
                    <div style="background: #f1f5f9; border-radius: 8px; padding: 18px; margin: 20px 0;">
                        <p style="margin: 6px 0; color: #1e293b;"><strong>Patient:</strong> {patient_name}</p>
                        <p style="margin: 6px 0; color: #1e293b;"><strong>Service:</strong> {service_type}</p>
                        <p style="margin: 6px 0; color: #1e293b;"><strong>Scheduled Slot:</strong> {slot_time}</p>
                        <p style="margin: 6px 0; color: #1e293b;"><strong>Chief Complaint:</strong> {patient_notes}</p>
                        <p style="margin: 6px 0; color: #16a34a; font-weight: bold;">
                            <strong>Your 80% Net Take-Home:</strong> ₹{provider_net} (20% platform charge deducted)
                        </p>
                    </div>
                    
                    <div style="margin: 24px 0;">
                        <a href="{dashboard_url}" style="background-color: #0284c7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                            Open Provider Console
                        </a>
                    </div>
                    <p style="color: #64748b; font-size: 12px;">NMC & ABDM/ABHA Compliant Healthcare Platform.</p>
                </div>
            </body>
            </html>
            """
            text_content = f"New booking alert: {service_type} for {patient_name} at {slot_time}. 80% net remuneration: Rs.{provider_net}. Open console: {dashboard_url}"
        else:
            subject = f"CallMedex Booking Confirmed: {service_type}"
            portal_url = f"{settings.FRONTEND_URL}/dashboard/patient"
            html_content = f"""
            <html>
            <body style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 20px;">
                <div style="max-width: 600px; margin: 0 auto; background: white; padding: 32px; border-radius: 12px; border: 1px solid #e2e8f0;">
                    <div style="border-bottom: 2px solid #10b981; padding-bottom: 12px; margin-bottom: 20px;">
                        <h2 style="color: #0f172a; margin: 0;">CallMedex Healthcare</h2>
                        <span style="color: #10b981; font-weight: bold; font-size: 14px;">Booking Confirmation</span>
                    </div>
                    <p style="color: #334155; font-size: 15px;">Dear <strong>{recipient_name}</strong>,</p>
                    <p style="color: #334155; font-size: 15px;">Your appointment has been successfully confirmed on CallMedex.</p>
                    
                    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 18px; margin: 20px 0;">
                        <p style="margin: 6px 0; color: #14532d;"><strong>Booking Reference:</strong> #{booking_id[:8] if booking_id else 'CM-BK'}</p>
                        <p style="margin: 6px 0; color: #14532d;"><strong>Service:</strong> {service_type}</p>
                        <p style="margin: 6px 0; color: #14532d;"><strong>Scheduled Slot:</strong> {slot_time}</p>
                        <p style="margin: 6px 0; color: #14532d;"><strong>Total Paid:</strong> ₹{amount}</p>
                    </div>
                    
                    <div style="margin: 24px 0;">
                        <a href="{portal_url}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                            View in Patient Dashboard
                        </a>
                    </div>
                    <p style="color: #64748b; font-size: 12px;">Thank you for choosing CallMedex. For queries, contact support@callmedex.in</p>
                </div>
            </body>
            </html>
            """
            text_content = f"Your CallMedex booking for {service_type} at {slot_time} is confirmed. Total: Rs.{amount}. View at {portal_url}"

        if not EmailService._send_real_email(to_email, subject, html_content, text_content):
            logger.info(f"[BOOKING ALERT EMAIL DISPATCHED] To: {to_email} | Subject: {subject}")

    @staticmethod
    def send_eprescription_email(
        to_email: str,
        patient_name: str,
        doctor_name: str,
        doctor_qualification: str = "MBBS, MD",
        doctor_reg_number: str = "NMC-VERIFIED-2026",
        diagnosis: str = "",
        medicines: list = None,
        lab_tests: list = None,
        clinical_notes: str = "",
        consultation_id: str = "",
    ) -> bool:
        """Sends an official NMC 2026-compliant digital e-Prescription to the patient's email."""
        medicines = medicines or []
        lab_tests = lab_tests or []
        today_str = datetime.now(timezone.utc).strftime("%d %B %Y")
        ref_id = (consultation_id or str(uuid.uuid4()))[:8].upper()

        # Build medication table rows
        med_rows = ""
        for i, m in enumerate(medicines, 1):
            name = m.get("name") or m.get("generic_name") or "Medicine"
            dose = m.get("dose") or m.get("dosage") or "1 tab"
            freq = m.get("freq") or m.get("frequency") or "OD"
            days = m.get("days") or m.get("duration") or "3 days"
            notes = m.get("notes") or m.get("instructions") or "After meals"
            med_rows += f"""
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 12px; font-weight: bold; color: #0f172a;">{i}. {name}</td>
                <td style="padding: 10px 12px; color: #334155;">{dose}</td>
                <td style="padding: 10px 12px; color: #334155;">{freq}</td>
                <td style="padding: 10px 12px; color: #334155;">{days}</td>
                <td style="padding: 10px 12px; color: #64748b; font-size: 13px;">{notes}</td>
            </tr>
            """

        labs_section = ""
        if lab_tests:
            labs_items = "".join([f"<li style='margin: 4px 0; color: #1e293b;'>{t}</li>" for t in lab_tests])
            labs_section = f"""
            <div style="margin-top: 20px; padding: 16px; background: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 6px;">
                <h4 style="margin: 0 0 8px; color: #1d4ed8; font-size: 14px;">Recommended Diagnostic Lab Tests</h4>
                <ul style="margin: 0; padding-left: 20px;">{labs_items}</ul>
            </div>
            """

        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; background-color: #f1f5f9; padding: 24px;">
            <div style="max-width: 680px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; border: 1px solid #cbd5e1; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                <!-- Header -->
                <div style="background: #0f172a; color: white; padding: 24px; display: flex; justify-content: space-between;">
                    <div>
                        <h2 style="margin: 0 0 4px 0; color: #38bdf8; font-size: 22px;">CallMedex Healthcare</h2>
                        <div style="color: #94a3b8; font-size: 13px;">Digital Clinical e-Prescription (NMC 2026 Compliant)</div>
                    </div>
                </div>

                <!-- Prescribing Doctor & Patient Info -->
                <div style="padding: 24px;">
                    <table style="width: 100%; margin-bottom: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 16px;">
                        <tr>
                            <td style="vertical-align: top; width: 55%;">
                                <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold;">Prescribing Practitioner</div>
                                <div style="font-size: 16px; font-weight: bold; color: #0f172a; margin-top: 2px;">{doctor_name}</div>
                                <div style="font-size: 13px; color: #475569;">{doctor_qualification}</div>
                                <div style="font-size: 12px; color: #0284c7; margin-top: 2px;">Reg. No: {doctor_reg_number}</div>
                            </td>
                            <td style="vertical-align: top; width: 45%; text-align: right;">
                                <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold;">Patient Details</div>
                                <div style="font-size: 16px; font-weight: bold; color: #0f172a; margin-top: 2px;">{patient_name}</div>
                                <div style="font-size: 13px; color: #475569;">Date: {today_str}</div>
                                <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Rx Ref: #{ref_id}</div>
                            </td>
                        </tr>
                    </table>

                    <!-- Diagnosis -->
                    <div style="margin-bottom: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px;">
                        <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold; display: block; margin-bottom: 4px;">Clinical Diagnosis</span>
                        <div style="font-size: 15px; font-weight: bold; color: #0f172a;">{diagnosis or 'Clinical Teleconsultation Evaluation'}</div>
                    </div>

                    <!-- Medicines Table -->
                    <div style="margin-bottom: 20px;">
                        <h3 style="margin: 0 0 10px; color: #0f172a; font-size: 16px; border-bottom: 2px solid #0f172a; padding-bottom: 6px;">
                            ℞ Prescribed Medications
                        </h3>
                        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
                            <thead>
                                <tr style="background: #f1f5f9; color: #475569; font-size: 12px; text-transform: uppercase;">
                                    <th style="padding: 8px 12px;">Medication (Generic)</th>
                                    <th style="padding: 8px 12px;">Dosage</th>
                                    <th style="padding: 8px 12px;">Frequency</th>
                                    <th style="padding: 8px 12px;">Duration</th>
                                    <th style="padding: 8px 12px;">Instructions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {med_rows}
                            </tbody>
                        </table>
                    </div>

                    {labs_section}

                    <!-- Doctor Notes / Advice -->
                    {f'''<div style="margin-top: 20px; padding: 14px; background: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 6px;">
                        <div style="font-size: 11px; text-transform: uppercase; color: #b45309; font-weight: bold; margin-bottom: 4px;">Doctor Advice & Instructions</div>
                        <div style="font-size: 14px; color: #78350f;">{clinical_notes}</div>
                    </div>''' if clinical_notes else ''}

                    <!-- Digital Signature & Security Footer -->
                    <div style="margin-top: 32px; border-top: 1px dashed #cbd5e1; padding-top: 20px; display: flex; justify-content: space-between; align-items: center;">
                        <div style="font-size: 11px; color: #64748b; line-height: 1.4; max-width: 400px;">
                            Digitally generated & securely signed under Telemedicine Practice Guidelines & NMC Act.
                            Valid across licensed Indian retail & hospital pharmacies.
                        </div>
                        <div style="text-align: right;">
                            <div style="font-family: cursive; font-size: 18px; color: #0f172a; font-weight: bold;">{doctor_name}</div>
                            <div style="font-size: 11px; color: #16a34a; font-weight: bold;">✓ Verified Digital Signature</div>
                        </div>
                    </div>
                </div>

                <!-- Footer Bar -->
                <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 14px 24px; text-align: center; font-size: 12px; color: #64748b;">
                    CallMedex Health Tech · Visakhapatnam, Andhra Pradesh · Support: support@callmedex.in
                </div>
            </div>
        </body>
        </html>
        """

        subject = f"Official Digital e-Prescription from {doctor_name} [Ref: #{ref_id}]"
        text_content = f"e-Prescription from {doctor_name} for {patient_name}. Diagnosis: {diagnosis}. Prescribed medicines: {len(medicines)} items."

        sent = EmailService._send_real_email(to_email, subject, html_content, text_content)
        if not sent:
            logger.info(f"[E-PRESCRIPTION EMAIL SIMULATED/LOGGED] To: {to_email} | Doctor: {doctor_name} | Diagnosis: {diagnosis}")
        return True


