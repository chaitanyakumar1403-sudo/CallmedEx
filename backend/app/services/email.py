"""
Email Service — Next-Gen CallMedex
Sends role-specific MOU emails with secure magic links.
Uses version-controlled legal documents from the database.
"""
import os
import logging
import smtplib
from email.message import EmailMessage
from jose import jwt
from datetime import datetime, timedelta, timezone
from app.config import settings
from app.services.legal import LegalService
from app.services.magic_link import MagicLinkService

logger = logging.getLogger(__name__)

# We use the same JWT secret to sign the email tokens
EMAIL_TOKEN_SECRET = settings.JWT_SECRET
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
            except Exception as e:
                logger.error(f"Resend API email sending failed: {e}")

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
        # Generate 5-minute magic links
        accept_token = MagicLinkService.generate_token(offer_id, provider_id, expiration_minutes=5)
        decline_token = MagicLinkService.generate_token(offer_id, provider_id, expiration_minutes=5)
        
        accept_link = f"{settings.FRONTEND_URL}/dispatch/respond?action=accept&token={accept_token}"
        decline_link = f"{settings.FRONTEND_URL}/dispatch/respond?action=decline&token={decline_token}"
        
        subject = f"🚨 Urgent: New {task_details.get('service_subtype', 'Service').replace('_', ' ').title()} Request Nearby!"
        
        text_content = f"""
Hello {provider_name},

A new home visit request is available in your area.

--- TASK DETAILS ---
Type: {task_details.get('service_subtype', 'Service').replace('_', ' ').title()}
Location: {task_details.get('patient_address', 'Unknown Location')}
Distance: {task_details.get('distance_km', '?')} km away
Notes: {task_details.get('notes', 'None')}
--------------------

You have 5 minutes to respond. Click a link below:
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
                
                <p style="color: #ef4444; font-weight: bold; font-size: 14px;">⏱️ This offer expires in 5 minutes.</p>
                
                <div style="margin-top: 30px;">
                    <a href="{accept_link}" style="display: inline-block; background-color: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-right: 15px;">✅ Accept Request</a>
                    <a href="{decline_link}" style="display: inline-block; background-color: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">❌ Decline</a>
                </div>
            </div>
        </body>
        </html>
        """

        # Try real Resend API / SMTP first, fallback to Mock logger
        if not EmailService._send_real_email(to_email, subject, html_content, text_content):
            print("\n" + "=" * 70)
            print(f"[MAGIC DISPATCH EMAIL TO] {to_email}")
            print(f"[SUBJECT] {subject}")
            print("=" * 70)
            print(text_content)
            print("=" * 70 + "\n")

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
            print("\n" + "=" * 70)
            print(f"[PASSWORD RESET EMAIL TO] {to_email}")
            print(f"[SUBJECT] {subject}")
            print("=" * 70)
            print(f"  User: {user_name}")
            print(f"  OTP Code: {otp_code}")
            print(f"  Reset Link: {reset_link}")
            print("=" * 70 + "\n")

