"""
Phase 3: Telemedicine Engine (Video Consultations & E-Prescriptions)
NMC 2026 Compliant AI Pipeline.
Full implementation: room security, session management, AI transcription.
"""
import uuid
import json
import logging
import hashlib
import hmac
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List
import google.generativeai as genai
from app.config import settings
from app.database import supabase

logger = logging.getLogger(__name__)

if settings.GEMINI_API_KEY:
    genai.configure(api_key=settings.GEMINI_API_KEY)

# Room auto-finalize timeout (minutes)
CONSULTATION_TIMEOUT_MINUTES = 45


class TelemedicineService:
    """
    Full-featured telemedicine service:
    - Secure Jitsi room generation with token-based naming
    - Consultation lifecycle management
    - AI-powered transcript → e-prescription pipeline
    - Consultation history & analytics
    """

    # ──────────────────────────────────────────────────────────────────
    # Room Generation (Daily.co & Jitsi Fallback)
    # ──────────────────────────────────────────────────────────────────

    @staticmethod
    async def generate_daily_room(consultation_id: str = None) -> dict:
        """
        Creates a high-definition private video room using the Daily.co REST API.
        Auto-expires after 45 minutes for security.
        """
        if not getattr(settings, "DAILY_API_KEY", ""):
            if getattr(settings, "APP_ENV", "development") == "production":
                raise ValueError("Daily.co API key is not configured for production telemedicine.")
            return TelemedicineService.generate_jitsi_room(consultation_id)

        import time
        import json
        import urllib.request
        import urllib.error

        room_name = f"cmx-{consultation_id[:12]}" if consultation_id else f"cmx-{uuid.uuid4().hex[:12]}"
        exp_time = int(time.time()) + (CONSULTATION_TIMEOUT_MINUTES * 60)

        payload = {
            "name": room_name,
            "privacy": "private",
            "properties": {
                "exp": exp_time,
                "enable_chat": True,
                "enable_screenshare": True,
                "enable_prejoin_ui": True,
                "start_video_off": False,
                "start_audio_off": False,
                "lang": "en"
            }
        }

        try:
            import httpx
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    "https://api.daily.co/v1/rooms",
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {settings.DAILY_API_KEY}",
                        "Content-Type": "application/json",
                        "User-Agent": "CallMedex-Backend/1.0"
                    },
                )
                if resp.status_code in (200, 201):
                    data = resp.json()
                    return {
                        "room_url": data.get("url"),
                        "room_name": data.get("name"),
                        "provider": "daily",
                    }
                else:
                    if getattr(settings, "APP_ENV", "development") == "production":
                        raise RuntimeError(f"Daily.co API returned status {resp.status_code}: {resp.text}")
        except Exception as e:
            if getattr(settings, "APP_ENV", "development") == "production":
                logger.error(f"Daily.co API room creation failed in production: {e}")
                raise RuntimeError(f"Daily.co video room creation failed: {e}")
            logger.warning(f"Daily.co API room creation failed, falling back to Jitsi in non-production: {e}")

        return TelemedicineService.generate_jitsi_room(consultation_id)

    @staticmethod
    async def generate_daily_meeting_token(room_name: str, user_name: str, is_doctor: bool) -> Optional[str]:
        """
        Generates a role-specific meeting token via Daily.co API.
        Doctors receive moderator privileges (owner/record/mute), patients receive attendee tokens.
        """
        if not getattr(settings, "DAILY_API_KEY", ""):
            return None

        import json
        import urllib.request
        import time

        exp_time = int(time.time()) + (CONSULTATION_TIMEOUT_MINUTES * 60)
        payload = {
            "properties": {
                "room_name": room_name,
                "is_owner": is_doctor,
                "user_name": user_name,
                "exp": exp_time
            }
        }

        try:
            import httpx
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    "https://api.daily.co/v1/meeting-tokens",
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {settings.DAILY_API_KEY}",
                        "Content-Type": "application/json",
                        "User-Agent": "CallMedex-Backend/1.0"
                    },
                )
                if resp.status_code in (200, 201):
                    data = resp.json()
                    return data.get("token")
        except Exception as e:
            logger.error(f"Failed to generate Daily.co meeting token: {e}")

        return None

    @staticmethod
    def generate_jitsi_room(consultation_id: str = None) -> dict:
        """Fallback: Generates a secure Jitsi Meet room URL."""
        room_suffix = consultation_id[:12] if consultation_id else str(uuid.uuid4())[:12]
        room_hash = hashlib.sha256(
            f"callmedex-{room_suffix}-{settings.JWT_SECRET}".encode()
        ).hexdigest()[:16]
        room_name = f"CMX-{room_hash}"
        room_url = f"https://meet.jit.si/{room_name}"

        return {
            "room_url": room_url,
            "room_name": room_name,
            "provider": "jitsi",
        }

    @staticmethod
    async def generate_video_room(consultation_id: str = None) -> dict:
        """Generates a video room (Daily.co with Jitsi fallback)."""
        return await TelemedicineService.generate_daily_room(consultation_id)

    # ──────────────────────────────────────────────────────────────────
    # Consultation Lifecycle
    # ──────────────────────────────────────────────────────────────────

    @staticmethod
    async def create_consultation(
        patient_id: str,
        doctor_id: str,
        booking_id: Optional[str] = None,
    ) -> dict:
        """
        Create a new consultation session with video room.
        Records NMC 2026 digital consent timestamp.
        """
        consultation_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        room_info = await TelemedicineService.generate_video_room(consultation_id)

        consultation_data = {
            "id": consultation_id,
            "patient_id": patient_id,
            "doctor_id": doctor_id,
            "booking_id": booking_id,
            "video_room_url": room_info["room_url"],
            "video_room_name": room_info["room_name"],
            "status": "waiting",  # waiting → in_progress → completed / cancelled
            "digital_consent_captured": True,
            "consent_timestamp": now,
            "started_at": None,
            "ended_at": None,
            "created_at": now,
            "updated_at": now,
        }

        if supabase:
            try:
                supabase.table("consultations").insert(consultation_data).execute()
            except Exception as e:
                # Returning a room URL for a consultation that was never
                # persisted hands both parties a link that dies on the next
                # call (get_consultation -> None -> "Consultation not found").
                logger.error(f"Failed to create consultation: {e}")
                raise RuntimeError("Could not create the consultation record") from e

        # Tell the provider someone is waiting in the room. Without this the
        # consultation sat at status "waiting" with nothing anywhere telling
        # the provider it existed, and the patient stared at an empty room.
        await TelemedicineService._notify_provider_waiting(
            doctor_id=doctor_id, patient_id=patient_id, consultation_id=consultation_id
        )

        return {
            "consultation_id": consultation_id,
            "video_url": room_info["room_url"],
            "room_name": room_info["room_name"],
            "status": "waiting",
        }

    @staticmethod
    async def _notify_provider_waiting(
        doctor_id: str, patient_id: str, consultation_id: str
    ) -> None:
        """Tell the provider a patient is waiting in their consultation room.

        Best-effort: a notification failure must never sink a room that has
        already been created and handed to the patient.
        """
        if not supabase or not doctor_id:
            return
        try:
            patient_name = "A patient"
            rows = (
                supabase.table("users").select("full_name")
                .eq("id", patient_id).limit(1).execute()
            )
            if rows.data and rows.data[0].get("full_name"):
                patient_name = rows.data[0]["full_name"]

            from app.services.notification_engine import NotificationEngine
            from app.services.push import CHANNEL_APPOINTMENTS

            await NotificationEngine.send_multi(
                user_id=doctor_id,
                channels=["in_app", "push", "email"],
                title="Patient waiting in consultation room",
                body=f"{patient_name} has joined your CallMedex consultation room and is waiting for you.",
                data={
                    "consultation_id": consultation_id,
                    "patient_id": patient_id,
                    "channel_id": CHANNEL_APPOINTMENTS,
                },
            )
        except Exception as e:
            logger.warning(
                f"Could not notify provider {doctor_id} of waiting consultation "
                f"{consultation_id}: {e}"
            )

    @staticmethod
    async def get_consultation(consultation_id: str) -> Optional[dict]:
        """Get consultation details by ID."""
        if not supabase:
            return None
        try:
            result = (
                supabase.table("consultations")
                .select("*")
                .eq("id", consultation_id)
                .execute()
            )
            return result.data[0] if result.data else None
        except Exception as e:
            logger.error(f"Failed to get consultation: {e}")
            return None

    @staticmethod
    async def join_room(consultation_id: str, user_id: str) -> dict:
        """
        Mark that a participant has joined the room.
        If both parties have joined, move status to in_progress.
        """
        now = datetime.now(timezone.utc).isoformat()
        consultation = await TelemedicineService.get_consultation(consultation_id)

        if not consultation:
            return {"success": False, "message": "Consultation not found"}

        if consultation["status"] == "completed":
            return {"success": False, "message": "Consultation already completed"}

        update_data = {"updated_at": now}

        # Move to in_progress if still waiting
        if consultation["status"] == "waiting":
            update_data["status"] = "in_progress"
            update_data["started_at"] = now

        if supabase:
            try:
                supabase.table("consultations").update(update_data).eq(
                    "id", consultation_id
                ).execute()
            except Exception as e:
                logger.warning(f"Failed to update consultation on join: {e}")

        return {
            "success": True,
            "consultation_id": consultation_id,
            "video_url": consultation.get("video_room_url"),
            "room_name": consultation.get("video_room_name"),
            "status": update_data.get("status", consultation["status"]),
        }

    @staticmethod
    async def end_consultation(consultation_id: str, ended_by: str) -> dict:
        """End a consultation and mark it for finalization."""
        now = datetime.now(timezone.utc).isoformat()

        if supabase:
            try:
                result = (
                    supabase.table("consultations")
                    .update({
                        "status": "ended",
                        "ended_at": now,
                        "ended_by": ended_by,
                        "updated_at": now,
                    })
                    .eq("id", consultation_id)
                    .in_("status", ["waiting", "in_progress"])
                    .execute()
                )
                if result.data:
                    return {"success": True, "message": "Consultation ended"}
                return {"success": False, "message": "Consultation not found or already ended"}
            except Exception as e:
                logger.error(f"Failed to end consultation: {e}")
                return {"success": False, "message": str(e)}

        return {"success": True, "message": "Consultation ended"}

    # ──────────────────────────────────────────────────────────────────
    # History & Queries
    # ──────────────────────────────────────────────────────────────────

    @staticmethod
    async def get_consultation_history(
        user_id: str,
        role: str = "patient",
        limit: int = 20,
    ) -> List[dict]:
        """Get consultation history for a patient or doctor."""
        if not supabase:
            return []

        try:
            field = "patient_id" if role == "patient" else "doctor_id"
            result = (
                supabase.table("consultations")
                .select("*")
                .eq(field, user_id)
                .order("created_at", desc=True)
                .limit(limit)
                .execute()
            )
            return result.data or []
        except Exception as e:
            logger.error(f"Failed to get consultation history: {e}")
            return []

    @staticmethod
    async def get_active_consultations(doctor_id: str) -> List[dict]:
        """Get active/waiting consultations for a consulting provider enriched with patient info."""
        if not supabase:
            return []

        try:
            result = (
                supabase.table("consultations")
                .select("*")
                .eq("doctor_id", doctor_id)
                .in_("status", ["waiting", "in_progress"])
                .order("created_at", desc=True)
                .execute()
            )
            consultations = result.data or []
            if not consultations:
                return []

            # Enrich with patient demographics
            patient_ids = list({c["patient_id"] for c in consultations if c.get("patient_id")})
            patient_map = {}
            if patient_ids:
                try:
                    user_res = (
                        supabase.table("users")
                        .select("id, full_name, mobile, email, gender, date_of_birth, city")
                        .in_("id", patient_ids)
                        .execute()
                    )
                    patient_map = {u["id"]: u for u in (user_res.data or [])}
                except Exception as pe:
                    logger.warning(f"Failed to load patient profiles for active consults: {pe}")

            # Enrich with booking details if present
            booking_ids = list({c["booking_id"] for c in consultations if c.get("booking_id")})
            booking_map = {}
            if booking_ids:
                try:
                    bk_res = (
                        supabase.table("bookings")
                        .select("id, service_type, slot_start, notes")
                        .in_("id", booking_ids)
                        .execute()
                    )
                    booking_map = {b["id"]: b for b in (bk_res.data or [])}
                except Exception as be:
                    logger.warning(f"Failed to load bookings for active consults: {be}")

            now_utc = datetime.now(timezone.utc)
            for c in consultations:
                pid = c.get("patient_id")
                u = patient_map.get(pid) or {}
                c["patient_name"] = u.get("full_name") or "Patient"
                c["patient_mobile"] = u.get("mobile") or ""
                c["patient_email"] = u.get("email") or ""
                c["patient_gender"] = (u.get("gender") or "Unknown").capitalize()
                c["patient_city"] = u.get("city") or ""

                # Age calculation
                dob_str = u.get("date_of_birth")
                if dob_str:
                    try:
                        birth_year = int(str(dob_str)[:4])
                        c["patient_age"] = now_utc.year - birth_year
                    except Exception:
                        c["patient_age"] = None
                else:
                    c["patient_age"] = None

                # Booking & Notes
                b = booking_map.get(c.get("booking_id")) or {}
                c["service_type"] = b.get("service_type") or "Video Consultation"
                c["notes"] = c.get("chief_complaint") or c.get("notes") or b.get("notes") or "Clinical Teleconsultation"
                c["triage_level"] = c.get("priority") or "Standard"

                # Wait time calculation
                created_at_str = c.get("created_at")
                if created_at_str:
                    try:
                        ca = datetime.fromisoformat(str(created_at_str).replace("Z", "+00:00"))
                        if ca.tzinfo is None:
                            ca = ca.replace(tzinfo=timezone.utc)
                        c["elapsed_minutes"] = max(0, int((now_utc - ca).total_seconds() / 60))
                    except Exception:
                        c["elapsed_minutes"] = 0
                else:
                    c["elapsed_minutes"] = 0

            return consultations
        except Exception as e:
            logger.error(f"Failed to get active consultations: {e}")
            return []

    @staticmethod
    async def get_available_doctors(specialization: str = None) -> List[dict]:
        """Get list of doctors available for video consultation."""
        if not supabase:
            return []

        try:
            query = (
                supabase.table("doctors")
                .select("*, users!inner(id, full_name, email, mobile, city)")
                .eq("available_for_online", True)
                .eq("verification_status", "verified")
            )
            if specialization:
                query = query.eq("specialization", specialization)

            result = query.execute()
            doctors = []
            for d in result.data or []:
                user = d.get("users", {})
                doctors.append({
                    "doctor_id": user.get("id"),
                    "name": user.get("full_name", "Unknown"),
                    "specialization": d.get("specialization", ""),
                    "qualification": d.get("qualification", ""),
                    "experience_years": d.get("years_of_experience", 0),
                    "consultation_fee": d.get("consultation_fee", 0),
                    "languages": d.get("languages_spoken", ["English"]),
                    "city": user.get("city", ""),
                    "available": True,
                })
            return doctors
        except Exception as e:
            logger.error(f"Failed to get available doctors: {e}")
            return []

    # ──────────────────────────────────────────────────────────────────
    # AI Pipeline: Transcript → E-Prescription
    # ──────────────────────────────────────────────────────────────────

    @staticmethod
    async def process_consultation_transcript(transcript: str) -> Dict[str, Any]:
        """
        Uses Groq to parse the raw video transcript into a
        structured NMC-compliant e-prescription and summary.
        Optimized for Indian medical context.

        IMPORTANT: This method MUST NOT return fabricated medical data.
        If the AI pipeline is unavailable, it raises an error rather than
        silently generating a fake prescription — a fake prescription is
        a clinical liability and NMC violation.
        """
        if not settings.GROQ_API_KEY:
            logger.error("GROQ_API_KEY is not set — cannot process transcript.")
            raise RuntimeError(
                "E-Prescription generation is unavailable. The AI pipeline is not "
                "configured. Please contact your administrator."
            )

        if not transcript or not transcript.strip():
            raise ValueError("Cannot process an empty transcript.")

        try:
            from groq import Groq
            client = Groq(api_key=settings.GROQ_API_KEY)

            prompt = f"""You are a highly skilled AI Medical Scribe working in India.
            Read the following live transcript of a telemedicine consultation between a doctor and patient.

            Extract the following information strictly:
            1. A brief clinical summary of the patient's condition (2-3 sentences).
            2. Primary diagnosis with ICD-10 code if applicable.
            3. Prescribed medicines — MUST use generic names per Indian NMC 2026 mandate. Include:
               - generic_name, dosage, frequency, duration, route (oral/topical/IV/IM)
            4. Any investigations ordered.
            5. Lifestyle/diet advice given.
            6. Whether the doctor requested a follow-up, and in how many days.

            Transcript:
            {transcript}

            OUTPUT STRICTLY IN JSON FORMAT:
            {{
                "summary": "Brief clinical summary...",
                "diagnosis": "Primary diagnosis with ICD-10 code",
                "medicines": [
                    {{"generic_name": "Medicine Name", "dosage": "500mg", "frequency": "twice a day", "duration": "5 days", "route": "oral"}}
                ],
                "investigations": ["Investigation 1", "Investigation 2"],
                "advice": ["Advice 1", "Advice 2"],
                "requires_followup": true,
                "followup_in_days": 7,
                "generated_eprescription_url": ""
            }}"""

            # Run the blocking Groq call in a thread pool to avoid blocking the event loop
            import asyncio
            response = await asyncio.to_thread(
                lambda: client.chat.completions.create(
                    model="llama-3.3-70b-versatile",
                    response_format={"type": "json_object"},
                    messages=[
                        {"role": "system", "content": "You are a precise JSON output generator. Output only valid JSON."},
                        {"role": "user", "content": prompt}
                    ],
                    timeout=30.0,
                )
            )

            response_text = response.choices[0].message.content
            result = json.loads(response_text)

            # Validate the result has at minimum a diagnosis and summary
            if not result.get("diagnosis") or not result.get("summary"):
                raise ValueError("AI response missing required fields (diagnosis, summary)")

            return result

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Groq response as JSON: {e}")
            raise RuntimeError(
                "E-Prescription generation failed: could not parse the AI output. "
                "The transcript must be reviewed manually."
            )
        except Exception as e:
            logger.error(f"Groq API Error in E-Prescription: {e}")
            raise RuntimeError(
                f"E-Prescription generation failed: {str(e)[:200]}. "
                "The transcript must be reviewed manually."
            )

    @staticmethod
    async def finalize_consultation(
        consultation_id: str,
        transcript: str,
    ) -> dict:
        """
        Finalize a consultation: run AI pipeline and store results.
        """
        # Run AI pipeline
        ai_output = await TelemedicineService.process_consultation_transcript(transcript)
        now = datetime.now(timezone.utc).isoformat()

        if supabase:
            try:
                update_data = {
                    "status": "completed",
                    "transcript_text": transcript,
                    "ai_summary": ai_output.get("summary", ""),
                    "ai_diagnosis": ai_output.get("diagnosis", ""),
                    "ai_medicines": ai_output.get("medicines", []),
                    "ai_investigations": ai_output.get("investigations", []),
                    "ai_advice": ai_output.get("advice", []),
                    "eprescription_url": ai_output.get("generated_eprescription_url", ""),
                    "requires_followup": ai_output.get("requires_followup", False),
                    "followup_in_days": ai_output.get("followup_in_days"),
                    "ended_at": now,
                    "updated_at": now,
                }
                supabase.table("consultations").update(update_data).eq(
                    "id", consultation_id
                ).execute()
            except Exception as e:
                logger.error(f"Failed to finalize consultation in DB: {e}")

        return {
            "success": True,
            "consultation_id": consultation_id,
            "ai_analysis": ai_output,
        }

    # ──────────────────────────────────────────────────────────────────
    # Pre-Intake & 1-Click Post-Consultation Action Hub
    # ──────────────────────────────────────────────────────────────────

    @staticmethod
    async def submit_pre_intake(
        consultation_id: str,
        symptoms: str,
        duration: str,
        pain_score: int,
        active_medications: str = "",
        allergies: str = "",
    ) -> dict:
        """
        Processes pre-call patient intake and generates a clinical note for the doctor.
        """
        now = datetime.now(timezone.utc).isoformat()
        intake_summary = f"Symptoms: {symptoms} ({duration}). Pain Score: {pain_score}/10. Meds: {active_medications or 'None'}. Allergies: {allergies or 'None'}."

        if supabase:
            try:
                supabase.table("consultations").update({
                    "transcript_text": f"[PRE-INTAKE] {intake_summary}",
                    "updated_at": now,
                }).eq("id", consultation_id).execute()
            except Exception as e:
                logger.warning(f"Failed to update pre-intake in DB: {e}")

        return {
            "success": True,
            "consultation_id": consultation_id,
            "intake_summary": intake_summary,
        }

    @staticmethod
    async def order_prescribed_actions(
        consultation_id: str,
        patient_id: str,
        action_type: str,  # 'pharmacy' or 'diagnostics'
        address: str = "Patient Default Address",
    ) -> dict:
        """
        1-Click Post-Consultation Dispatch:
        Routes prescribed medicines to pharmacy partner or dispatches phlebotomist for lab tests.
        """
        consultation = await TelemedicineService.get_consultation(consultation_id) or {}

        if action_type == "pharmacy":
            medicines = consultation.get("ai_medicines", [])
            med_text = ", ".join([m.get("generic_name", "") for m in medicines if isinstance(m, dict)])
            notes = f"Telemedicine E-Prescription Order ({consultation_id[:8]}): {med_text or 'Prescribed medications'}"
            provider_type = "pharmacy"
        else:
            investigations = consultation.get("ai_investigations", [])
            inv_text = ", ".join(investigations) if isinstance(investigations, list) else str(investigations)
            notes = f"Telemedicine Prescribed Lab Test ({consultation_id[:8]}): {inv_text or 'Diagnostic blood tests'}"
            provider_type = "phlebotomist"

        # This used to write a bare dispatch_requests row with status
        # "searching" and no coordinates: no candidate search, no offers, no
        # email, no push. Nobody was ever told, and the periodic sweep
        # cancelled it minutes later — while the patient had been told
        # "Successfully created". Go through the engine so the order actually
        # reaches a provider.
        lat, lng, resolved_address = TelemedicineService._resolve_patient_location(
            patient_id, address
        )
        if lat is None or lng is None:
            return {
                "success": False,
                "action_type": action_type,
                "message": (
                    "We could not pin your delivery address. Please set your "
                    "address on your profile, then reorder."
                ),
            }

        from app.services.dispatch_engine import UniversalDispatchEngine

        result = await UniversalDispatchEngine.create_dispatch(
            patient_id=patient_id,
            patient_lat=float(lat),
            patient_lng=float(lng),
            patient_address=resolved_address,
            provider_type=provider_type,
            service_subtype="teleconsult_followup",
            booking_id=consultation.get("booking_id"),
            notes=notes,
            priority="normal",
        )

        return {
            "success": True,
            "action_type": action_type,
            "dispatch_id": result["dispatch_id"],
            "providers_notified": result.get("all_candidates", 0),
            "message": result.get("message")
            or f"Successfully created 1-click {action_type} request.",
        }

    @staticmethod
    def _resolve_patient_location(patient_id: str, address: str):
        """Best coordinates we can get for a post-consultation order.

        `users` carries no lat/lng, so the address is geocoded. Returns
        (None, None, address) when it cannot be resolved — the caller then
        refuses rather than dispatching a provider to a guessed location.
        """
        stored_address, city = "", ""
        if supabase and patient_id:
            try:
                rows = (
                    supabase.table("users").select("address, city")
                    .eq("id", patient_id).limit(1).execute()
                )
                if rows.data:
                    stored_address = rows.data[0].get("address") or ""
                    city = rows.data[0].get("city") or ""
            except Exception as e:
                logger.warning(f"Could not read address for patient {patient_id}: {e}")

        # The router's default placeholder is not an address anyone can drive to.
        candidate = address if address and address != "Patient Default Address" else stored_address
        if not candidate and not city:
            return None, None, address

        try:
            from app.services.geocoding import geocode_address, GeocodingError
            try:
                lat, lng = geocode_address(address=candidate or city, city=city)
                return lat, lng, candidate or city
            except GeocodingError as e:
                logger.warning(
                    f"Post-consultation order for {patient_id}: geocoding "
                    f"{candidate!r} (city={city!r}) failed: {e}"
                )
        except Exception as e:
            logger.warning(f"Geocoding unavailable for patient {patient_id}: {e}")

        return None, None, candidate or address
