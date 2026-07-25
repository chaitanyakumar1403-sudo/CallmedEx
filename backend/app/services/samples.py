"""
Sample Lifecycle Service — CallMedex

Implements the physical chain of custody for home-collected specimens:

    collect (phlebotomist, at patient)
      -> in_transit
      -> handover_requested (phlebotomist submits a batch to a diagnostic centre)
      -> received | rejected   (centre verifies each tube individually)
      -> processing
      -> report_ready

Every transition appends to `sample_events` with actor, role, GPS and time. The
phlebotomist MOUs make the collector "fully responsible for the collected samples
from the time of collection until delivery to the designated processing center",
so the custody trail has to be reconstructible per tube, not per booking.

Payout policy, from the MOUs:
  - Part-time phlebotomists earn their per-collection rate (Rs150 default) only
    for samples the centre ACCEPTS. Rejected tubes pay nothing.
  - Full-time phlebotomists are salaried, so their rate is 0 and no credit fires.
"""
import logging
import random
import uuid
from datetime import datetime, timezone
from typing import Optional, List

from app.database import supabase
from app.services.wallet import WalletService

logger = logging.getLogger(__name__)

# Statuses from which a phlebotomist may still submit a tube to a lab.
SUBMITTABLE = ("collected", "in_transit")

BARCODE_PREFIX = "CMX"


def _rows(result) -> List[dict]:
    """Coerce a Supabase response into a plain list of dicts.

    The client returns loosely-typed JSON, so normalising once here keeps every
    caller free of defensive `or []` / index guards.
    """
    data = getattr(result, "data", None) or []
    return [dict(r) for r in data if isinstance(r, dict)]


def _first(result) -> dict:
    """First row of a Supabase response, or {} when empty."""
    rows = _rows(result)
    return rows[0] if rows else {}


class SampleService:
    """Chain-of-custody operations for collected specimens."""

    # ── Barcode ───────────────────────────────────────────────────────────

    @staticmethod
    def generate_barcode(max_attempts: int = 6) -> str:
        """
        Mint a unique, human-readable barcode: CMX-260725-4F9C21.

        The date segment makes a tube identifiable at a glance during a manual
        lab reconciliation; the random tail avoids collisions. Uniqueness is
        enforced by the database, so a collision here is retried rather than
        trusted.
        """
        stamp = datetime.now(timezone.utc).strftime("%y%m%d")
        for _ in range(max_attempts):
            tail = "".join(random.choices("0123456789ABCDEF", k=6))
            candidate = f"{BARCODE_PREFIX}-{stamp}-{tail}"
            if not SampleService._barcode_exists(candidate):
                return candidate
        # Fall back to a UUID tail, which is effectively collision-free.
        return f"{BARCODE_PREFIX}-{stamp}-{uuid.uuid4().hex[:10].upper()}"

    @staticmethod
    def _barcode_exists(barcode: str) -> bool:
        if not supabase:
            return False
        try:
            found = _rows(
                supabase.table("samples")
                .select("id")
                .eq("barcode", barcode)
                .limit(1)
                .execute()
            )
            return bool(found)
        except Exception:
            return False

    # ── Custody log ───────────────────────────────────────────────────────

    @staticmethod
    def _log_event(
        sample_id: str,
        event: str,
        actor_id: Optional[str] = None,
        actor_role: str = "",
        lat: Optional[float] = None,
        lng: Optional[float] = None,
        photo_url: str = "",
        notes: str = "",
    ) -> None:
        """Append to the immutable custody log. Never raises: the caller's
        state transition matters more than the log write."""
        if not supabase:
            return
        try:
            supabase.table("sample_events").insert({
                "id": str(uuid.uuid4()),
                "sample_id": sample_id,
                "event": event,
                "actor_id": actor_id,
                "actor_role": actor_role,
                "lat": lat,
                "lng": lng,
                "photo_url": photo_url,
                "notes": notes,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }).execute()
        except Exception as e:
            logger.error(f"sample_event write failed (sample={sample_id}, event={event}): {e}")

    # ── Helpers ───────────────────────────────────────────────────────────

    @staticmethod
    def _phlebo_profile(user_id: str) -> dict:
        """Phlebotomist row for the given user, or {} if absent."""
        if not supabase:
            return {}
        try:
            res = (
                supabase.table("phlebotomists")
                .select("*")
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
            return _first(res)
        except Exception as e:
            logger.error(f"phlebo lookup failed for {user_id}: {e}")
            return {}

    @staticmethod
    def _org_display_name(org_user_id: str) -> str:
        """Diagnostic centre's trading name, for patient-facing messages."""
        if not supabase or not org_user_id:
            return "the diagnostic centre"
        try:
            res = (
                supabase.table("organizations")
                .select("organization_name")
                .eq("user_id", org_user_id)
                .limit(1)
                .execute()
            )
            row = _first(res)
            if row.get("organization_name"):
                return str(row["organization_name"])
        except Exception:
            pass
        try:
            row = _first(
                supabase.table("users").select("full_name").eq("id", org_user_id).limit(1).execute()
            )
            if row.get("full_name"):
                return str(row["full_name"])
        except Exception:
            pass
        return "the diagnostic centre"

    # ── Home lab ──────────────────────────────────────────────────────────

    @staticmethod
    def get_home_lab(phlebotomist_user_id: str) -> dict:
        """The centre this collector hands samples to by default."""
        profile = SampleService._phlebo_profile(phlebotomist_user_id)
        lab_id = profile.get("home_lab_org_user_id")
        if not lab_id:
            return {"home_lab_org_user_id": None, "home_lab_name": None}
        return {
            "home_lab_org_user_id": lab_id,
            "home_lab_name": SampleService._org_display_name(lab_id),
        }

    @staticmethod
    def set_home_lab(phlebotomist_user_id: str, org_user_id: Optional[str]) -> dict:
        """
        Link this collector to a diagnostic centre, or clear the link.

        The centre must be a real, verified organisation — otherwise a typo would
        silently send every subsequent handover into a dead end that only shows
        up when the collector is standing at the wrong lab.
        """
        if not supabase:
            return {"success": False, "message": "Database not configured"}

        if org_user_id:
            org = _first(
                supabase.table("organizations")
                .select("user_id, organization_name, organization_type, verification_status")
                .eq("user_id", org_user_id)
                .limit(1)
                .execute()
            )
            if not org:
                return {"success": False, "message": "That diagnostic centre was not found."}
            if org.get("verification_status") != "verified":
                return {
                    "success": False,
                    "message": f"{org.get('organization_name')} is not verified yet.",
                }

        try:
            updated = _rows(
                supabase.table("phlebotomists")
                .update({"home_lab_org_user_id": org_user_id})
                .eq("user_id", phlebotomist_user_id)
                .execute()
            )
        except Exception as e:
            logger.error(f"set_home_lab failed for {phlebotomist_user_id}: {e}")
            return {"success": False, "message": f"Could not save your lab: {e}"}

        if not updated:
            return {"success": False, "message": "No phlebotomist profile found for you."}

        return {
            "success": True,
            "message": (
                f"Linked to {SampleService._org_display_name(org_user_id)}."
                if org_user_id else "Lab link cleared."
            ),
            **SampleService.get_home_lab(phlebotomist_user_id),
        }

    @staticmethod
    def _authorise_collection(
        phlebotomist_user_id: str,
        claimed_patient_id: Optional[str],
        dispatch_request_id: Optional[str],
        allow_unlinked: bool = False,
    ) -> tuple:
        """
        Decide whether this collector may file a tube, and for which patient.

        Returns (allowed, patient_id, reason).

        The patient is taken from the dispatch record, never from the request
        body, so a tampered or mistaken patient_id cannot attach a specimen to
        someone else's health record. `allow_unlinked` is the admin escape hatch
        for back-office corrections and walk-ins.
        """
        if dispatch_request_id:
            dispatch = _first(
                supabase.table("dispatch_requests")
                .select("id, patient_id, assigned_provider_id, status")
                .eq("id", dispatch_request_id)
                .limit(1)
                .execute()
            )
            if not dispatch:
                return False, None, "That dispatch does not exist."
            if dispatch.get("assigned_provider_id") != phlebotomist_user_id:
                return False, None, "That run is not assigned to you."

            true_patient = dispatch.get("patient_id")
            if claimed_patient_id and claimed_patient_id != true_patient:
                # Surface the mismatch rather than silently overriding it: a
                # disagreement here means the app sent the wrong run or the wrong
                # patient, and either way the collector should re-check.
                return False, None, (
                    "Patient does not match that run. Re-select the run and try again."
                )
            return True, true_patient, ""

        if allow_unlinked:
            if not claimed_patient_id:
                return False, None, "A patient is required."
            return True, claimed_patient_id, ""

        return False, None, (
            "Select the run this tube belongs to. Samples must be linked to a "
            "dispatch assigned to you."
        )

    # ── 1. Collection ─────────────────────────────────────────────────────

    @staticmethod
    async def collect(
        phlebotomist_user_id: str,
        patient_id: Optional[str] = None,
        booking_id: Optional[str] = None,
        dispatch_request_id: Optional[str] = None,
        barcode: Optional[str] = None,
        sample_type: str = "blood",
        container_type: str = "",
        test_names: Optional[List[str]] = None,
        lat: Optional[float] = None,
        lng: Optional[float] = None,
        photo_url: str = "",
        destination_org_user_id: Optional[str] = None,
        notes: str = "",
        allow_unlinked: bool = False,
    ) -> dict:
        """
        Register a tube collected at the patient's side.

        `barcode` may be supplied by a scanner; when absent one is minted. The
        destination defaults to the phlebotomist's home lab and may be overridden
        when the booking belongs to a different partner centre.

        The caller must reference a dispatch assigned to them, and the patient is
        derived from that dispatch rather than trusted from the request body.
        Without this, a collector could file a specimen — and in turn a lab report
        — against an arbitrary patient's ABHA-linked record.
        """
        if not supabase:
            return {"success": False, "message": "Database not configured"}

        allowed, patient_id, why = SampleService._authorise_collection(
            phlebotomist_user_id, patient_id, dispatch_request_id, allow_unlinked
        )
        if not allowed:
            return {"success": False, "message": why}

        profile = SampleService._phlebo_profile(phlebotomist_user_id)
        destination = destination_org_user_id or profile.get("home_lab_org_user_id")

        barcode = (barcode or "").strip().upper() or SampleService.generate_barcode()

        sample_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        record = {
            "id": sample_id,
            "barcode": barcode,
            "booking_id": booking_id,
            "dispatch_request_id": dispatch_request_id,
            "patient_id": patient_id,
            "phlebotomist_user_id": phlebotomist_user_id,
            "destination_org_user_id": destination,
            "sample_type": sample_type,
            "container_type": container_type,
            "test_names": test_names or [],
            "status": "collected",
            "collected_at": now,
            "collection_lat": lat,
            "collection_lng": lng,
            "collection_photo_url": photo_url,
            "notes": notes,
        }

        try:
            supabase.table("samples").insert(record).execute()
        except Exception as e:
            if "23505" in str(e) or "duplicate key" in str(e).lower():
                return {
                    "success": False,
                    "message": f"Barcode {barcode} is already registered to another sample.",
                }
            logger.error(f"sample collect failed: {e}")
            return {"success": False, "message": f"Failed to register sample: {e}"}

        SampleService._log_event(
            sample_id, "collected",
            actor_id=phlebotomist_user_id, actor_role="phlebotomist",
            lat=lat, lng=lng, photo_url=photo_url,
            notes=notes or f"Collected {sample_type}",
        )

        return {
            "success": True,
            "message": f"Sample {barcode} registered.",
            "sample_id": sample_id,
            "barcode": barcode,
            "destination_org_user_id": destination,
            "has_destination": bool(destination),
        }

    # ── 2. Handover request ───────────────────────────────────────────────

    @staticmethod
    async def request_handover(
        phlebotomist_user_id: str,
        sample_ids: List[str],
        destination_org_user_id: Optional[str] = None,
        notes: str = "",
    ) -> dict:
        """
        Submit a batch of tubes to a diagnostic centre for verification.

        Only tubes the caller collected and that are still in hand may be
        submitted, so a tube cannot be handed over twice or by someone else.
        """
        if not supabase:
            return {"success": False, "message": "Database not configured"}
        if not sample_ids:
            return {"success": False, "message": "No samples selected"}

        try:
            owned = _rows(
                supabase.table("samples")
                .select("*")
                .eq("phlebotomist_user_id", phlebotomist_user_id)
                .in_("id", sample_ids)
                .in_("status", list(SUBMITTABLE))
                .execute()
            )
        except Exception as e:
            logger.error(f"handover lookup failed: {e}")
            return {"success": False, "message": f"Failed to read samples: {e}"}

        if not owned:
            return {
                "success": False,
                "message": "None of the selected samples are in your possession and awaiting handover.",
            }

        profile = SampleService._phlebo_profile(phlebotomist_user_id)
        destination = (
            destination_org_user_id
            or profile.get("home_lab_org_user_id")
            or next((s.get("destination_org_user_id") for s in owned if s.get("destination_org_user_id")), None)
        )
        if not destination:
            return {
                "success": False,
                "message": "No destination diagnostic centre. Set your linked lab or choose one for this handover.",
            }

        handover_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        accepted_ids = [s["id"] for s in owned]

        try:
            supabase.table("sample_handovers").insert({
                "id": handover_id,
                "phlebotomist_user_id": phlebotomist_user_id,
                "destination_org_user_id": destination,
                "status": "pending",
                "sample_count": len(accepted_ids),
                "requested_at": now,
                "notes": notes,
            }).execute()

            supabase.table("samples").update({
                "status": "handover_requested",
                "handover_id": handover_id,
                "destination_org_user_id": destination,
            }).in_("id", accepted_ids).execute()
        except Exception as e:
            logger.error(f"handover create failed: {e}")
            return {"success": False, "message": f"Failed to create handover: {e}"}

        for sid in accepted_ids:
            SampleService._log_event(
                sid, "handover_requested",
                actor_id=phlebotomist_user_id, actor_role="phlebotomist",
                notes=f"Submitted to {SampleService._org_display_name(destination)}",
            )

        skipped = [sid for sid in sample_ids if sid not in accepted_ids]
        return {
            "success": True,
            "handover_id": handover_id,
            "submitted_count": len(accepted_ids),
            "skipped_count": len(skipped),
            "destination_org_user_id": destination,
            "destination_name": SampleService._org_display_name(destination),
            "message": (
                f"{len(accepted_ids)} sample(s) submitted to "
                f"{SampleService._org_display_name(destination)} for verification."
            ),
        }

    # ── 3. Centre verifies ────────────────────────────────────────────────

    @staticmethod
    async def respond_to_handover(
        handover_id: str,
        responder_user_id: str,
        accepted_sample_ids: List[str],
        rejected: Optional[dict] = None,
        notes: str = "",
    ) -> dict:
        """
        Diagnostic centre accepts and/or rejects each tube in a handover.

        `rejected` maps sample_id -> reason. Accepting credits the collecting
        phlebotomist's wallet (part-time only); rejecting pays nothing, which is
        the MOU's deduction clause for contamination, leakage or delay.

        The patient is notified per accepted sample, naming the centre.
        """
        if not supabase:
            return {"success": False, "message": "Database not configured"}

        rejected = rejected or {}

        try:
            handovers = _rows(
                supabase.table("sample_handovers")
                .select("*")
                .eq("id", handover_id)
                .limit(1)
                .execute()
            )
        except Exception as e:
            return {"success": False, "message": f"Failed to read handover: {e}"}

        if not handovers:
            return {"success": False, "message": "Handover not found"}
        handover = handovers[0]

        if handover["destination_org_user_id"] != responder_user_id:
            return {"success": False, "message": "This handover was not sent to your centre."}
        if handover["status"] != "pending":
            return {"success": False, "message": f"Handover already {handover['status']}."}

        try:
            samples = _rows(
                supabase.table("samples")
                .select("*")
                .eq("handover_id", handover_id)
                .execute()
            )
        except Exception as e:
            return {"success": False, "message": f"Failed to read samples: {e}"}

        by_id = {s["id"]: s for s in samples}
        accepted = [sid for sid in accepted_sample_ids if sid in by_id]
        refused = [sid for sid in rejected if sid in by_id]

        # Anything the centre did not explicitly rule on stays with the batch
        # decision: silence on a tube means it was accepted alongside the rest.
        unaddressed = [sid for sid in by_id if sid not in accepted and sid not in refused]
        accepted.extend(unaddressed)

        now = datetime.now(timezone.utc).isoformat()
        centre_name = SampleService._org_display_name(responder_user_id)

        if accepted:
            try:
                supabase.table("samples").update({
                    "status": "received",
                    "received_at": now,
                    "received_by": responder_user_id,
                }).in_("id", accepted).execute()
            except Exception as e:
                logger.error(f"accept update failed: {e}")
                return {"success": False, "message": f"Failed to accept samples: {e}"}

        for sid in refused:
            reason = (rejected.get(sid) or "").strip() or "Rejected on inspection"
            try:
                supabase.table("samples").update({
                    "status": "rejected",
                    "rejection_reason": reason,
                    "received_by": responder_user_id,
                }).eq("id", sid).execute()
            except Exception as e:
                logger.error(f"reject update failed for {sid}: {e}")

        for sid in accepted:
            SampleService._log_event(
                sid, "received", actor_id=responder_user_id,
                actor_role="organization", notes=f"Accepted by {centre_name}",
            )
        for sid in refused:
            SampleService._log_event(
                sid, "rejected", actor_id=responder_user_id, actor_role="organization",
                notes=rejected.get(sid) or "Rejected on inspection",
            )

        status = (
            "accepted" if not refused
            else "rejected" if not accepted
            else "partially_accepted"
        )
        try:
            supabase.table("sample_handovers").update({
                "status": status,
                "accepted_count": len(accepted),
                "rejected_count": len(refused),
                "responded_at": now,
                "responded_by": responder_user_id,
                "rejection_reason": "; ".join(
                    f"{by_id[s]['barcode']}: {rejected[s]}" for s in refused
                )[:1000],
                "notes": notes or handover.get("notes", ""),
            }).eq("id", handover_id).execute()
        except Exception as e:
            logger.error(f"handover status update failed: {e}")

        payout = SampleService._credit_for_accepted(
            handover["phlebotomist_user_id"], accepted, by_id, responder_user_id
        )
        await SampleService._notify_patients_received(accepted, by_id, centre_name)
        SampleService._advance_dispatches(accepted, by_id)

        return {
            "success": True,
            "handover_id": handover_id,
            "status": status,
            "accepted_count": len(accepted),
            "rejected_count": len(refused),
            "payout": payout,
            "message": (
                f"{len(accepted)} sample(s) received"
                + (f", {len(refused)} rejected" if refused else "")
                + "."
            ),
        }

    # ── Payout, notification, dispatch closure ────────────────────────────

    @staticmethod
    def _credit_for_accepted(
        phlebotomist_user_id: str,
        accepted_ids: List[str],
        by_id: dict,
        responder_user_id: str,
    ) -> dict:
        """
        Credit the collecting phlebotomist for each accepted tube.

        Part-time phlebotomists carry a per-collection rate (Rs150 by default);
        full-time are salaried and carry 0, so `WalletService.credit` no-ops.
        Credits are keyed to the sample, so a retried acceptance cannot double-pay.
        """
        if not phlebotomist_user_id or not accepted_ids:
            return {"credited": 0, "amount": 0.0}

        profile = SampleService._phlebo_profile(phlebotomist_user_id)
        rate = float(profile.get("per_collection_rate") or 0.0)
        if rate <= 0:
            return {
                "credited": 0,
                "amount": 0.0,
                "note": "Salaried phlebotomist — no per-collection accrual.",
            }

        credited = 0
        for sid in accepted_ids:
            sample = by_id.get(sid, {})
            result = WalletService.credit(
                provider_user_id=phlebotomist_user_id,
                amount=rate,
                reason="collection_payout",
                sample_id=sid,
                booking_id=sample.get("booking_id"),
                notes=f"Verified collection {sample.get('barcode', '')}",
                created_by=responder_user_id,
            )
            if result.get("success") and not result.get("duplicate"):
                credited += 1

        return {"credited": credited, "rate": rate, "amount": round(credited * rate, 2)}

    @staticmethod
    async def _notify_patients_received(accepted_ids: List[str], by_id: dict, centre_name: str) -> None:
        """Tell each patient, by name of centre, that their sample arrived."""
        if not accepted_ids:
            return
        try:
            from app.services.notification_engine import NotificationEngine
        except Exception:
            return

        for sid in accepted_ids:
            sample = by_id.get(sid) or {}
            patient_id = sample.get("patient_id")
            if not patient_id:
                continue
            barcode = sample.get("barcode", "")
            try:
                await NotificationEngine.send(
                    user_id=patient_id,
                    channel="in_app",
                    title="Sample received by the lab",
                    body=(
                        f"{centre_name} has received your sample ({barcode}) and "
                        f"has begun processing. Your report will appear here once ready."
                    ),
                    data={"sample_id": sid, "barcode": barcode, "centre": centre_name},
                )
            except Exception as e:
                logger.error(f"patient notify failed for sample {sid}: {e}")

    @staticmethod
    def _advance_dispatches(accepted_ids: List[str], by_id: dict) -> None:
        """
        Close out the dispatch once its samples reach the lab.

        `samples_delivered_to_lab` already exists in the dispatch_requests status
        constraint but nothing wrote it until now.
        """
        if not supabase or not accepted_ids:
            return
        dispatch_ids = {
            by_id[sid].get("dispatch_request_id")
            for sid in accepted_ids
            if by_id.get(sid, {}).get("dispatch_request_id")
        }
        for did in dispatch_ids:
            try:
                supabase.table("dispatch_requests").update({
                    "status": "samples_delivered_to_lab",
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }).eq("id", did).execute()
            except Exception as e:
                logger.error(f"dispatch advance failed for {did}: {e}")

    # ── 4. Report ─────────────────────────────────────────────────────────

    @staticmethod
    async def upload_report(
        sample_id: str,
        uploader_user_id: str,
        report_url: str,
        notes: str = "",
    ) -> dict:
        """Attach the finished report to a received sample and notify the patient."""
        if not supabase:
            return {"success": False, "message": "Database not configured"}

        try:
            rows = _rows(supabase.table("samples").select("*").eq("id", sample_id).limit(1).execute())
        except Exception as e:
            return {"success": False, "message": f"Failed to read sample: {e}"}
        if not rows:
            return {"success": False, "message": "Sample not found"}

        sample = rows[0]
        if sample.get("destination_org_user_id") != uploader_user_id:
            return {"success": False, "message": "This sample was not delivered to your centre."}
        if sample.get("status") not in ("received", "processing"):
            return {
                "success": False,
                "message": f"Cannot publish a report for a sample that is '{sample.get('status')}'.",
            }

        now = datetime.now(timezone.utc).isoformat()
        try:
            supabase.table("samples").update({
                "status": "report_ready",
                "report_url": report_url,
                "report_uploaded_at": now,
            }).eq("id", sample_id).execute()
        except Exception as e:
            return {"success": False, "message": f"Failed to save report: {e}"}

        SampleService._log_event(
            sample_id, "report_uploaded", actor_id=uploader_user_id,
            actor_role="organization", notes=notes or "Report published",
        )

        centre_name = SampleService._org_display_name(uploader_user_id)
        try:
            from app.services.notification_engine import NotificationEngine
            await NotificationEngine.send(
                user_id=sample["patient_id"],
                channel="in_app",
                title="Your report is ready",
                body=f"{centre_name} has published your report for sample {sample.get('barcode', '')}.",
                data={"sample_id": sample_id, "report_url": report_url},
            )
        except Exception as e:
            logger.error(f"report notify failed for {sample_id}: {e}")

        return {"success": True, "message": "Report published.", "sample_id": sample_id}

    # ── Reads ─────────────────────────────────────────────────────────────

    @staticmethod
    def list_for_phlebotomist(phlebotomist_user_id: str, statuses: Optional[List[str]] = None) -> list:
        """Tubes currently attributable to this phlebotomist."""
        if not supabase:
            return []
        try:
            query = (
                supabase.table("samples")
                .select("*")
                .eq("phlebotomist_user_id", phlebotomist_user_id)
                .order("collected_at", desc=True)
            )
            if statuses:
                query = query.in_("status", statuses)
            return _rows(query.limit(200).execute())
        except Exception as e:
            logger.error(f"list_for_phlebotomist failed: {e}")
            return []

    @staticmethod
    def list_incoming_handovers(org_user_id: str, status: str = "pending") -> list:
        """Handover batches awaiting this centre's verification, with their tubes."""
        if not supabase:
            return []
        try:
            handovers = _rows(
                supabase.table("sample_handovers")
                .select("*")
                .eq("destination_org_user_id", org_user_id)
                .eq("status", status)
                .order("requested_at", desc=True)
                .limit(100)
                .execute()
            )
        except Exception as e:
            logger.error(f"list_incoming_handovers failed: {e}")
            return []

        for h in handovers:
            try:
                h["samples"] = _rows(
                    supabase.table("samples")
                    .select("id, barcode, sample_type, container_type, test_names, collected_at, patient_id, status")
                    .eq("handover_id", h["id"])
                    .execute()
                )
            except Exception:
                h["samples"] = []
            try:
                h["phlebotomist"] = _first(
                    supabase.table("users")
                    .select("full_name, mobile")
                    .eq("id", h["phlebotomist_user_id"])
                    .limit(1)
                    .execute()
                )
            except Exception:
                h["phlebotomist"] = {}
        return handovers

    @staticmethod
    def get_custody_trail(sample_id: str) -> dict:
        """Full custody history for one tube — the patient-facing tracking view."""
        if not supabase:
            return {}
        try:
            rows = _rows(supabase.table("samples").select("*").eq("id", sample_id).limit(1).execute())
            if not rows:
                return {}
            sample = rows[0]
            sample["events"] = _rows(
                supabase.table("sample_events")
                .select("*")
                .eq("sample_id", sample_id)
                .order("created_at", desc=False)
                .execute()
            )
            if sample.get("destination_org_user_id"):
                sample["destination_name"] = SampleService._org_display_name(
                    sample["destination_org_user_id"]
                )
            return sample
        except Exception as e:
            logger.error(f"get_custody_trail failed for {sample_id}: {e}")
            return {}
