"""Pure verification matching + decision logic. No I/O — unit-tested."""
import re
from difflib import SequenceMatcher

_HONORIFIC_RE = re.compile(r"\b(m/s|ms|dr|mr|mrs|prof)\b\.?", re.IGNORECASE)

def normalize_identifier(s: str) -> str:
    if not s:
        return ""
    s = _HONORIFIC_RE.sub("", s.lower())
    return re.sub(r"[^a-z0-9]", "", s)

def license_match(stored: str, extracted: str) -> bool:
    a, b = normalize_identifier(stored), normalize_identifier(extracted)
    return bool(a) and bool(b) and a == b

def names_match(stored: str, extracted: str, threshold: float = 0.85) -> bool:
    a, b = normalize_identifier(stored), normalize_identifier(extracted)
    if not a or not b:
        return False
    if a == b:
        return True
    return SequenceMatcher(None, a, b).ratio() >= threshold

def extract_license_from_ocr(ocr: dict, role: str) -> str:
    if role == "pharmacy":
        return (ocr.get("drug_license_number") or ocr.get("registration_number") or "").strip()
    if role == "phlebotomist":
        return (ocr.get("certification_number") or "").strip()
    return (ocr.get("license_number") or "").strip()

def _chk(name, passed, detail):
    return {"check": name, "passed": passed, "detail": detail}

def cross_document_match(aadhaar_ocr: dict | None, cert_ocr: dict | None,
                         profile_name: str | None) -> dict:
    """Compare names across Aadhaar, certificate, and profile.

    When no government APIs are available (gov_mode="off"), this provides the
    primary assurance: if the name on the Aadhaar, the certificate, and the
    profile all match, the identity is almost certainly legitimate. Mismatches
    flag for manual review.

    Returns a verdict dict with:
      - cross_match_score (0.0-1.0): overall confidence from cross-document checks
      - checks: individual match results
      - all_match: True if all available documents agree on the name
    """
    checks = []
    name_sources = []

    if aadhaar_ocr and aadhaar_ocr.get("extracted_name"):
        aadhaar_name = aadhaar_ocr["extracted_name"].strip()
        name_sources.append(("aadhaar", aadhaar_name))
    if cert_ocr and cert_ocr.get("extracted_name"):
        cert_name = cert_ocr["extracted_name"].strip()
        name_sources.append(("certificate", cert_name))
    if profile_name:
        name_sources.append(("profile", profile_name.strip()))

    if len(name_sources) < 2:
        return {"cross_match_score": 0.5, "checks": checks,
                "all_match": True, "reasoning": "Too few sources to cross-match"}

    matches = 0
    total_pairs = 0
    for i in range(len(name_sources)):
        for j in range(i + 1, len(name_sources)):
            total_pairs += 1
            src_a, name_a = name_sources[i]
            src_b, name_b = name_sources[j]
            match_result = names_match(name_a, name_b)
            if match_result:
                matches += 1
            checks.append({
                "check": f"name_match_{src_a}_vs_{src_b}",
                "passed": match_result,
                "detail": f"'{name_a}' vs '{name_b}': {'✓' if match_result else '✗ mismatch'}",
            })

    score = matches / max(total_pairs, 1)
    all_match = matches == total_pairs
    return {"cross_match_score": score, "checks": checks,
            "all_match": all_match,
            "reasoning": "All documents agree" if all_match else "Name discrepancies found"}

def decide(ocr: dict, stored_name: str, stored_license: str, gov: dict | None,
           auto_approve_enabled: bool, gov_mode: str, confidence_floor: float = 0.75) -> dict:
    checks = []
    if not ocr.get("is_legible", False):
        return {"decision": "auto_reject", "final_status": "rejected",
                "reason": "Document is not legible.", "checks": [_chk("legibility", False, "unreadable")]}
    checks.append(_chk("legibility", True, "readable"))

    if not ocr.get("is_valid_document", False):
        return {"decision": "auto_reject", "final_status": "rejected",
                "reason": "Not a valid certificate.", "checks": checks + [_chk("doc_type", False, "invalid")]}
    checks.append(_chk("doc_type", True, "valid"))

    extracted_license = extract_license_from_ocr(ocr, ocr.get("_role", "")) or (ocr.get("license_number") or "")
    if not license_match(stored_license, extracted_license):
        return {"decision": "auto_reject", "final_status": "rejected",
                "reason": "License/registration number does not match.",
                "checks": checks + [_chk("license_match", False, f"{stored_license} != {extracted_license}")]}
    checks.append(_chk("license_match", True, "match"))

    if not names_match(stored_name, ocr.get("extracted_name") or ""):
        return {"decision": "needs_review", "final_status": "under_review",
                "reason": "Name needs manual review.",
                "checks": checks + [_chk("name_match", False, "differs")]}
    checks.append(_chk("name_match", True, "match"))

    # Gov registry check — only rejects in live mode; skipped entirely in off mode
    if gov_mode == "off":
        checks.append(_chk("gov_registry", True, "skipped (no gov APIs configured)"))
    elif gov_mode == "live" and gov is not None and not gov.get("is_valid", False):
        return {"decision": "auto_reject", "final_status": "rejected",
                "reason": "Not found in government registry.",
                "checks": checks + [_chk("gov_registry", False, gov.get("status", "not_found"))]}
    elif gov_mode == "mock" and gov is not None:
        checks.append(_chk("gov_registry", gov.get("is_valid", False), f"mock: {gov.get('status', 'unknown')}"))

    if float(ocr.get("confidence_score") or 0) < confidence_floor:
        return {"decision": "needs_review", "final_status": "under_review",
                "reason": "Low extraction confidence — manual review.",
                "checks": checks + [_chk("confidence", False, str(ocr.get("confidence_score")))]}
    checks.append(_chk("confidence", True, str(ocr.get("confidence_score"))))

    if auto_approve_enabled:
        return {"decision": "auto_approve", "final_status": "verified",
                "reason": "All checks passed.", "checks": checks}
    return {"decision": "needs_review", "final_status": "under_review",
            "reason": "Auto-approve disabled — pending admin.", "checks": checks}
