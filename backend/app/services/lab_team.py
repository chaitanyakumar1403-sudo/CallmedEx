"""
Lab ↔ Phlebotomist Team Service — CallMedex

An affiliation is a two-sided agreement. Either party may open the request, but
the OTHER party must accept before the link takes effect:

    organization invites  ->  phlebotomist accepts  ->  linked
    phlebotomist requests ->  organization accepts  ->  linked

That symmetry matters commercially. A centre must not find unknown collectors
claiming to represent it, and a collector must not be assigned to a lab they
never agreed to work for. Only on acceptance is
`phlebotomists.home_lab_org_user_id` set, so the handover default can never
point somewhere neither side signed up to.
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from app.database import supabase

logger = logging.getLogger(__name__)

OPEN_STATES = ("pending", "accepted")


def _rows(result) -> List[dict]:
    data = getattr(result, "data", None) or []
    return [dict(r) for r in data if isinstance(r, dict)]


def _first(result) -> dict:
    rows = _rows(result)
    return rows[0] if rows else {}


class LabTeamService:
    """Two-sided affiliation between a diagnostic centre and a collector."""

    # ── Lookups ───────────────────────────────────────────────────────────

    @staticmethod
    def _user(user_id: str) -> dict:
        if not supabase or not user_id:
            return {}
        return _first(
            supabase.table("users")
            .select("id, full_name, email, mobile, role, city")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )

    @staticmethod
    def _org_name(org_user_id: str) -> str:
        if not supabase or not org_user_id:
            return "the diagnostic centre"
        org = _first(
            supabase.table("organizations")
            .select("organization_name")
            .eq("user_id", org_user_id)
            .limit(1)
            .execute()
        )
        return org.get("organization_name") or "the diagnostic centre"

    @staticmethod
    def find_phlebotomist(identifier: str) -> dict:
        """Resolve a collector by email or mobile, for the invite form."""
        if not supabase or not identifier:
            return {}
        ident = identifier.strip()
        for column in ("email", "mobile"):
            found = _first(
                supabase.table("users")
                .select("id, full_name, email, mobile, role")
                .eq(column, ident)
                .limit(1)
                .execute()
            )
            if found and found.get("role") in ("phlebotomist", "nurse"):
                return found
        return {}

    # ── Opening a request ─────────────────────────────────────────────────

    @staticmethod
    def request_link(
        org_user_id: str,
        phlebotomist_user_id: str,
        initiated_by: str,
        requested_by: str,
        message: str = "",
    ) -> dict:
        """
        Open (or re-open) an affiliation request between a centre and a collector.

        A rejected or revoked history does not block a fresh approach — people
        change teams — but an already-pending or already-accepted pair is
        returned as-is rather than duplicated into both dashboards.
        """
        if not supabase:
            return {"success": False, "message": "Database not configured"}
        if initiated_by not in ("organization", "phlebotomist"):
            return {"success": False, "message": "Invalid initiator"}

        collector = LabTeamService._user(phlebotomist_user_id)
        if not collector:
            return {"success": False, "message": "That collector was not found."}
        if collector.get("role") not in ("phlebotomist", "nurse"):
            return {"success": False, "message": f"{collector.get('full_name')} is not a collector."}

        org = _first(
            supabase.table("organizations")
            .select("user_id, organization_name, verification_status")
            .eq("user_id", org_user_id)
            .limit(1)
            .execute()
        )
        if not org:
            return {"success": False, "message": "That diagnostic centre was not found."}
        if org.get("verification_status") != "verified":
            return {"success": False, "message": f"{org.get('organization_name')} is not verified yet."}

        existing = _first(
            supabase.table("lab_phlebotomist_links")
            .select("*")
            .eq("org_user_id", org_user_id)
            .eq("phlebotomist_user_id", phlebotomist_user_id)
            .in_("status", list(OPEN_STATES))
            .limit(1)
            .execute()
        )
        if existing:
            return {
                "success": True,
                "already": True,
                "link": existing,
                "message": (
                    "Already on your team."
                    if existing["status"] == "accepted"
                    else "A request is already open with this collector."
                ),
            }

        link_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        try:
            supabase.table("lab_phlebotomist_links").insert({
                "id": link_id,
                "org_user_id": org_user_id,
                "phlebotomist_user_id": phlebotomist_user_id,
                "initiated_by": initiated_by,
                "status": "pending",
                "message": message,
                "requested_by": requested_by,
                "requested_at": now,
            }).execute()
        except Exception as e:
            logger.error(f"request_link failed: {e}")
            return {"success": False, "message": f"Could not send the request: {e}"}

        return {
            "success": True,
            "link_id": link_id,
            "awaiting": "phlebotomist" if initiated_by == "organization" else "organization",
            "message": (
                f"Request sent to {collector.get('full_name')}."
                if initiated_by == "organization"
                else f"Request sent to {org.get('organization_name')}."
            ),
        }

    # ── Answering a request ───────────────────────────────────────────────

    @staticmethod
    def respond(link_id: str, responder_user_id: str, accept: bool, note: str = "") -> dict:
        """
        Accept or decline an affiliation request.

        Only the party who did NOT open it may answer, which is what stops a
        one-sided link: an inviting centre cannot also accept on the collector's
        behalf.
        """
        if not supabase:
            return {"success": False, "message": "Database not configured"}

        link = _first(
            supabase.table("lab_phlebotomist_links")
            .select("*")
            .eq("id", link_id)
            .limit(1)
            .execute()
        )
        if not link:
            return {"success": False, "message": "Request not found."}
        if link["status"] != "pending":
            return {"success": False, "message": f"This request was already {link['status']}."}

        opener_is_org = link["initiated_by"] == "organization"
        must_answer = link["phlebotomist_user_id"] if opener_is_org else link["org_user_id"]
        if responder_user_id != must_answer:
            return {"success": False, "message": "This request is not yours to answer."}

        now = datetime.now(timezone.utc).isoformat()
        try:
            supabase.table("lab_phlebotomist_links").update({
                "status": "accepted" if accept else "rejected",
                "responded_by": responder_user_id,
                "responded_at": now,
                "response_note": note,
            }).eq("id", link_id).execute()
        except Exception as e:
            logger.error(f"respond failed for link {link_id}: {e}")
            return {"success": False, "message": f"Could not record your response: {e}"}

        if not accept:
            # Declining is a successful outcome of the call, not a failure.
            return {"success": True, "accepted": False, "message": "Request declined."}

        # The link is only now real, so this is the only place the handover
        # default is allowed to change.
        try:
            supabase.table("phlebotomists").update(
                {"home_lab_org_user_id": link["org_user_id"]}
            ).eq("user_id", link["phlebotomist_user_id"]).execute()
        except Exception as e:
            logger.error(f"home lab set failed after accept ({link_id}): {e}")

        org_name = LabTeamService._org_name(link["org_user_id"])
        LabTeamService._notify_both(link, org_name)

        return {
            "success": True,
            "accepted": True,
            "org_user_id": link["org_user_id"],
            "org_name": org_name,
            "message": f"You're now teamed up with {org_name}.",
        }

    @staticmethod
    def _notify_both(link: dict, org_name: str) -> None:
        """Best-effort in-app notice to both sides; never blocks the link."""
        if not supabase:
            return
        collector = LabTeamService._user(link["phlebotomist_user_id"])
        pairs = [
            (link["phlebotomist_user_id"], "Lab affiliation confirmed",
             f"You are now linked to {org_name}. Your samples will default to this centre."),
            (link["org_user_id"], "Collector joined your team",
             f"{collector.get('full_name', 'A collector')} accepted your invitation."),
        ]
        for user_id, title, body in pairs:
            try:
                supabase.table("notifications").insert({
                    "id": str(uuid.uuid4()),
                    "user_id": user_id,
                    "channel": "in_app",
                    "title": title,
                    "body": body,
                    "data": {"link_id": link["id"]},
                    "status": "sent",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }).execute()
            except Exception as e:
                logger.error(f"team notify failed for {user_id}: {e}")

    # ── Ending an affiliation ─────────────────────────────────────────────

    @staticmethod
    def revoke(link_id: str, actor_user_id: str) -> dict:
        """
        End an affiliation. Either side may walk away without the other's consent
        — only forming the link needs agreement.
        """
        if not supabase:
            return {"success": False, "message": "Database not configured"}

        link = _first(
            supabase.table("lab_phlebotomist_links")
            .select("*").eq("id", link_id).limit(1).execute()
        )
        if not link:
            return {"success": False, "message": "Link not found."}
        if actor_user_id not in (link["org_user_id"], link["phlebotomist_user_id"]):
            return {"success": False, "message": "This link is not yours."}

        try:
            supabase.table("lab_phlebotomist_links").update({
                "status": "revoked",
                "responded_by": actor_user_id,
                "responded_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", link_id).execute()
        except Exception as e:
            return {"success": False, "message": f"Could not end the link: {e}"}

        # Clear the handover default only if it pointed at this centre; the
        # collector may have since been linked elsewhere.
        try:
            profile = _first(
                supabase.table("phlebotomists")
                .select("user_id, home_lab_org_user_id")
                .eq("user_id", link["phlebotomist_user_id"])
                .limit(1)
                .execute()
            )
            if profile.get("home_lab_org_user_id") == link["org_user_id"]:
                supabase.table("phlebotomists").update(
                    {"home_lab_org_user_id": None}
                ).eq("user_id", link["phlebotomist_user_id"]).execute()
        except Exception as e:
            logger.error(f"home lab clear failed on revoke ({link_id}): {e}")

        return {"success": True, "message": "Affiliation ended."}

    # ── Reads ─────────────────────────────────────────────────────────────

    @staticmethod
    def list_for_org(org_user_id: str) -> dict:
        """The centre's roster plus anything awaiting either side."""
        if not supabase:
            return {"team": [], "incoming": [], "sent": []}

        links = _rows(
            supabase.table("lab_phlebotomist_links")
            .select("*")
            .eq("org_user_id", org_user_id)
            .in_("status", ["pending", "accepted"])
            .execute()
        )
        team, incoming, sent = [], [], []
        for link in links:
            link["phlebotomist"] = LabTeamService._user(link["phlebotomist_user_id"])
            if link["status"] == "accepted":
                team.append(link)
            elif link["initiated_by"] == "phlebotomist":
                incoming.append(link)   # collector applied; centre must answer
            else:
                sent.append(link)       # centre invited; waiting on collector
        return {"team": team, "incoming": incoming, "sent": sent}

    @staticmethod
    def list_for_phlebotomist(phlebotomist_user_id: str) -> dict:
        """The collector's current lab plus anything awaiting either side."""
        if not supabase:
            return {"current": None, "incoming": [], "sent": []}

        links = _rows(
            supabase.table("lab_phlebotomist_links")
            .select("*")
            .eq("phlebotomist_user_id", phlebotomist_user_id)
            .in_("status", ["pending", "accepted"])
            .execute()
        )
        current, incoming, sent = None, [], []
        for link in links:
            link["org_name"] = LabTeamService._org_name(link["org_user_id"])
            if link["status"] == "accepted":
                current = link
            elif link["initiated_by"] == "organization":
                incoming.append(link)   # centre invited; collector must answer
            else:
                sent.append(link)       # collector applied; waiting on centre
        return {"current": current, "incoming": incoming, "sent": sent}
