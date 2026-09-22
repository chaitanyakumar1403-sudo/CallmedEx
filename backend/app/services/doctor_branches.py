"""
Which of an organisation's physical branches a doctor_availability row is at.

Three writers put shifts into doctor_availability, and they never agreed on
how to say "this shift is at branch X":

  - the organisation's schedule modal stores the branch UUID in
    template_group_id and sets organization_id;
  - the doctor's own shift builder stored a random *group* UUID in
    template_group_id, no organization_id, and only the branch's name in
    location_name;
  - older rows carry nothing but free-text location_name.

Every reader treated template_group_id as the branch id, so a doctor who
published their own hours matched no branch at all: the patient's branch
picker listed nobody, then the booking page fell back to invented facility
hours. One resolver, used by every reader, fixes that.
"""
from typing import Iterable, List, Optional, Tuple

MAIN = "main"


def _norm(s) -> str:
    return " ".join(str(s or "").lower().split())


def resolve_branch(av: dict, org_id: Optional[str], org_name: Optional[str],
                   branches: Iterable[dict]) -> Optional[str]:
    """Branch id of `av` at this organisation ("main" for the main facility),
    or None when the shift is not at this organisation at all — the doctor's
    own clinic, or a different organisation's branch."""
    branches = [b for b in branches if b.get("id")]
    row_org = av.get("organization_id")
    if row_org and org_id and str(row_org) != str(org_id):
        return None

    tg = av.get("template_group_id")
    if tg and any(str(b["id"]) == str(tg) and b["id"] != MAIN for b in branches):
        return str(tg)

    loc = _norm(av.get("location_name"))
    if loc:
        for b in branches:
            if _norm(b.get("name")) == loc:
                return str(b["id"])
        # "Visakha Clinics – Maharanipeta branch" is at the Maharanipeta
        # branch, not the main facility, even though it also names the org.
        best = None
        for b in branches:
            name = _norm(b.get("name"))
            if b["id"] != MAIN and name and name in loc and (best is None or len(name) > len(best[1])):
                best = (str(b["id"]), name)
        if best:
            return best[0]

    if row_org and org_id and str(row_org) == str(org_id):
        return MAIN
    org = _norm(org_name)
    if org and loc and org in loc:
        return MAIN
    return None


def doctor_branch_shifts(avails: Iterable[dict], org_id: Optional[str],
                         org_name: Optional[str],
                         branches: Iterable[dict]) -> Tuple[List[str], List[dict]]:
    """(branch ids the doctor works at, their in-person shifts at this org)."""
    branches = list(branches)
    names = {str(b["id"]): b.get("name") or "" for b in branches if b.get("id")}
    assigned: List[str] = []
    shifts: List[dict] = []
    for av in avails:
        if av.get("consultation_mode") not in (None, "in_person", "both"):
            continue
        bid = resolve_branch(av, org_id, org_name, branches)
        if bid is None:
            continue
        if bid not in assigned:
            assigned.append(bid)
        shifts.append({
            "branch_id": bid,
            "branch_name": names.get(bid) or av.get("location_name") or "",
            "day_of_week": av.get("day_of_week"),
            "start_time": str(av.get("start_time") or "")[:5],
            "end_time": str(av.get("end_time") or "")[:5],
            "slot_duration_minutes": av.get("slot_duration_minutes") or 10,
        })
    shifts.sort(key=lambda s: (s["branch_id"], (s["day_of_week"] or 0), s["start_time"]))
    return assigned, shifts
