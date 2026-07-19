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
    def send_mou_email_for_role(to_email: str, role: str, user_payload: dict):
        """
        Sends role-specific MOU email with a secure magic link.
        Fetches the correct MOU from the legal_documents table (or fallback).
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

        # --- MOCK MAILER (ASCII-safe for Windows console) ---
        role_display = role.replace("_", " ").title()
        print("\n" + "=" * 70)
        print(f"[EMAIL DISPATCHED TO] {to_email}")
        print(f"[SUBJECT] Action Required: Accept {role_display} MOU to Activate Your CallMedex Account")
        print("=" * 70)
        print(f"\nDear {user_payload.get('user_data', {}).get('full_name', 'Partner')},\n")
        print(f"Thank you for registering as a {role_display} on CallMedex.")
        print("To complete your registration, you must review and accept our")
        print(f"Memorandum of Understanding ({mou_title}).\n")
        print("--- MOU PREVIEW ---")
        print(mou_text[:500] + ("..." if len(mou_text) > 500 else ""))
        print("--------------------\n")
        print("To read the full MOU and activate your account, click the link below:")
        print(f"[LINK] {magic_link}\n")
        print(f"[EXPIRES] This link will expire in 24 hours.")
        print(f"[VERSION] Document Version: {legal_doc.get('version', 'v1.0')}")
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
        print("\n" + "=" * 70)
        print(f"[WELCOME EMAIL TO] {to_email}")
        print(f"[SUBJECT] Welcome to CallMedex! Your {role_display} Account is Active")
        print("=" * 70)
        print(f"\nDear {provider_name},\n")
        print(f"Your MOU acceptance was successful. Your {role_display} account has been officially created.\n")
        print("You can now log in to your dashboard and begin using CallMedex:\n")
        print(f"[LOGIN URL] {settings.FRONTEND_URL}/auth/login\n")
        print("What you can do next:")
        print("  [OK] Complete your profile and upload verification documents")
        print("  [OK] Start receiving bookings from patients")
        print("  [OK] Manage your availability and services\n")
        print("Welcome to the future of healthcare orchestration!")
        print("-- The CallMedex Team")
        print("=" * 70 + "\n")

    @staticmethod
    def send_dispatch_alert_email(to_email: str, provider_name: str, task_details: dict):
        """
        Sends an alert email to a nearby provider when a new dispatch is requested.
        """
        print("\n" + "=" * 70)
        print(f"[DISPATCH ALERT TO] {to_email}")
        print(f"[SUBJECT] 🚨 Urgent: New Home Visit Request Nearby!")
        print("=" * 70)
        print(f"\nHello {provider_name},\n")
        print(f"A new home visit request is available in your area.\n")
        print("--- TASK DETAILS ---")
        print(f"Type: {task_details.get('service_subtype', 'Service').replace('_', ' ').title()}")
        print(f"Location: {task_details.get('patient_address', 'Unknown Location')}")
        print(f"Distance: {task_details.get('distance_km', '?')} km away")
        print("--------------------\n")
        print("Please log in to your CallMedex dashboard to accept the request before it expires:")
        print(f"[DASHBOARD URL] {settings.FRONTEND_URL}/dashboard\n")
        print("=" * 70 + "\n")

    @staticmethod
    def send_tracking_link_email(to_email: str, patient_name: str, tracking_url: str, provider_name: str, provider_type: str):
        """
        Sends the tracking link to the patient when a provider accepts the dispatch.
        """
        print("\n" + "=" * 70)
        print(f"[TRACKING LINK TO] {to_email}")
        print(f"[SUBJECT] Your {provider_type.replace('_', ' ').title()} is on the way!")
        print("=" * 70)
        print(f"\nDear {patient_name},\n")
        print(f"Great news! {provider_name} has accepted your home visit request and will be heading to your location shortly.\n")
        print(f"You can track their location and get your unique Service OTP by clicking the link below:")
        print(f"[TRACKING URL] {tracking_url}\n")
        print("Please keep your OTP ready to share with the provider when they arrive.")
        print("-- The CallMedex Team")
        print("=" * 70 + "\n")

    @staticmethod
    def _send_smtp_email(to_email: str, subject: str, html_content: str, text_content: str):
        """Internal helper to send real SMTP email if configured."""
        if not settings.SMTP_HOST or not settings.SMTP_USERNAME:
            return False
        
        try:
            msg = EmailMessage()
            msg['Subject'] = subject
            msg['From'] = settings.SMTP_FROM_EMAIL
            msg['To'] = to_email
            
            msg.set_content(text_content)
            msg.add_alternative(html_content, subtype='html')
            
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                server.starttls()
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                server.send_message(msg)
            return True
        except Exception as e:
            logger.error(f"SMTP sending failed: {e}")
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

        # Try real SMTP first, fallback to Mock logger
        if not EmailService._send_smtp_email(to_email, subject, html_content, text_content):
            print("\n" + "=" * 70)
            print(f"[MAGIC DISPATCH EMAIL TO] {to_email}")
            print(f"[SUBJECT] {subject}")
            print("=" * 70)
            print(text_content)
            print("=" * 70 + "\n")

