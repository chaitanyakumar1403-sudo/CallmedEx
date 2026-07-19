"""
Phase 4: NHCX Insurance Claims Engine
Mocks the FHIR-converter middleware and eligibility checks.
"""
import uuid
from typing import Dict, Any

class NHCXService:
    @staticmethod
    def check_eligibility(abha_number: str) -> Dict[str, Any]:
        """
        Simulates querying the NHCX Sandbox for active insurance policies linked to an ABHA number.
        """
        if not abha_number or len(abha_number) < 5:
            return {"eligible": False, "reason": "Invalid ABHA ID"}
            
        return {
            "eligible": True,
            "insurer_name": "Star Health Insurance (AB-PMJAY)",
            "coverage_limit": 500000.0,
            "co_pay_percentage": 0.0,
            "status": "Active"
        }

    @staticmethod
    def generate_fhir_claim_bundle(patient_id: str, booking_id: str, amount: float) -> Dict[str, Any]:
        """
        Simulates converting internal Supabase records into a FHIR R4 Claim bundle.
        """
        return {
            "resourceType": "Bundle",
            "type": "collection",
            "entry": [
                {
                    "resource": {
                        "resourceType": "Claim",
                        "status": "active",
                        "type": {"coding": [{"system": "http://terminology.hl7.org/CodeSystem/claim-type", "code": "institutional"}]},
                        "patient": {"reference": f"Patient/{patient_id}"},
                        "total": {"value": amount, "currency": "INR"}
                    }
                }
            ]
        }
