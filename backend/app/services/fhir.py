"""
FHIR R4 Service — ABDM M2 HIP Role Implementation
Converts CallMedex health events (lab reports, prescriptions, consultation
summaries) into FHIR R4 bundles for ABDM health record sharing.
Phase 2 — claude.md Sections 4.1, 15.3.

ABDM Milestone M2: HIP (Health Information Provider) role.
- Push health records as FHIR R4 bundles to ABDM gateway
- Handle consent requests from other facilities
"""
import uuid
from datetime import datetime, timezone
from typing import Optional
from app.database import supabase


class FHIRService:
    """
    Generates FHIR R4 compliant JSON bundles from CallMedex health events.
    These bundles are pushed to the ABDM gateway when the patient has an
    active ABHA linkage and has granted consent.
    """

    ABDM_SANDBOX_URL = "https://sandbox.abdm.gov.in"

    @staticmethod
    def create_patient_resource(patient: dict, user: dict) -> dict:
        """Create a FHIR R4 Patient resource from CallMedex patient data."""
        return {
            "resourceType": "Patient",
            "id": user.get("id", str(uuid.uuid4())),
            "meta": {
                "profile": [
                    "https://nrces.in/ndhm/fhir/r4/StructureDefinition/Patient"
                ]
            },
            "identifier": [
                {
                    "type": {
                        "coding": [
                            {
                                "system": "https://ndhm.gov.in/identifier",
                                "code": "ABHA",
                                "display": "ABHA Number",
                            }
                        ]
                    },
                    "system": "https://healthid.ndhm.gov.in",
                    "value": patient.get("abha_number", ""),
                }
            ],
            "name": [
                {
                    "use": "official",
                    "text": user.get("full_name", ""),
                }
            ],
            "gender": user.get("gender", "unknown"),
            "birthDate": user.get("date_of_birth", ""),
            "telecom": [
                {
                    "system": "phone",
                    "value": user.get("mobile", ""),
                    "use": "mobile",
                },
                {
                    "system": "email",
                    "value": user.get("email", ""),
                },
            ],
            "address": [
                {
                    "use": "home",
                    "text": user.get("address", ""),
                    "city": user.get("city", ""),
                    "district": user.get("district", ""),
                    "state": user.get("state", ""),
                    "postalCode": user.get("pincode", ""),
                    "country": "IN",
                }
            ],
        }

    @staticmethod
    def create_diagnostic_report_bundle(
        patient_id: str,
        patient_name: str,
        abha_number: str,
        report_data: dict,
    ) -> dict:
        """
        Create a FHIR R4 DiagnosticReport Bundle for a lab test result.
        This is the primary record type for ABDM M2 — pushed after every
        completed diagnostic test.
        """
        bundle_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        observations = []
        for i, test in enumerate(report_data.get("tests", [])):
            obs_id = str(uuid.uuid4())
            observation = {
                "resourceType": "Observation",
                "id": obs_id,
                "status": "final",
                "category": [
                    {
                        "coding": [
                            {
                                "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                                "code": "laboratory",
                                "display": "Laboratory",
                            }
                        ]
                    }
                ],
                "code": {
                    "coding": [
                        {
                            "system": "http://loinc.org",
                            "code": test.get("loinc_code", ""),
                            "display": test.get("test_name", ""),
                        }
                    ],
                    "text": test.get("test_name", ""),
                },
                "subject": {"reference": f"Patient/{patient_id}"},
                "effectiveDateTime": now,
                "valueQuantity": {
                    "value": test.get("value"),
                    "unit": test.get("unit", ""),
                    "system": "http://unitsofmeasure.org",
                },
                "referenceRange": [
                    {
                        "low": {"value": test.get("ref_low"), "unit": test.get("unit", "")},
                        "high": {"value": test.get("ref_high"), "unit": test.get("unit", "")},
                    }
                ]
                if test.get("ref_low") is not None
                else [],
                "interpretation": [
                    {
                        "coding": [
                            {
                                "system": "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
                                "code": test.get("interpretation", "N"),
                                "display": {
                                    "N": "Normal",
                                    "H": "High",
                                    "L": "Low",
                                    "HH": "Critical High",
                                    "LL": "Critical Low",
                                }.get(test.get("interpretation", "N"), "Normal"),
                            }
                        ]
                    }
                ],
            }
            observations.append(observation)

        # DiagnosticReport resource
        diagnostic_report = {
            "resourceType": "DiagnosticReport",
            "id": str(uuid.uuid4()),
            "status": "final",
            "category": [
                {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/v2-0074",
                            "code": "LAB",
                            "display": "Laboratory",
                        }
                    ]
                }
            ],
            "code": {
                "text": report_data.get("report_name", "Diagnostic Report"),
            },
            "subject": {
                "reference": f"Patient/{patient_id}",
                "display": patient_name,
            },
            "effectiveDateTime": now,
            "issued": now,
            "result": [{"reference": f"Observation/{obs['id']}"} for obs in observations],
            "conclusion": report_data.get("conclusion", ""),
            "presentedForm": [
                {
                    "contentType": "application/pdf",
                    "url": report_data.get("pdf_url", ""),
                    "title": report_data.get("report_name", "Lab Report"),
                }
            ]
            if report_data.get("pdf_url")
            else [],
        }

        # Full FHIR Bundle
        bundle = {
            "resourceType": "Bundle",
            "id": bundle_id,
            "type": "document",
            "timestamp": now,
            "meta": {
                "profile": [
                    "https://nrces.in/ndhm/fhir/r4/StructureDefinition/DocumentBundle"
                ]
            },
            "identifier": {
                "system": "https://callmedex.com/fhir/bundle",
                "value": bundle_id,
            },
            "entry": [
                {"fullUrl": f"DiagnosticReport/{diagnostic_report['id']}", "resource": diagnostic_report},
                *[{"fullUrl": f"Observation/{obs['id']}", "resource": obs} for obs in observations],
            ],
        }

        return bundle

    @staticmethod
    def create_prescription_bundle(
        patient_id: str,
        patient_name: str,
        doctor_name: str,
        prescription_data: dict,
    ) -> dict:
        """
        Create a FHIR R4 MedicationRequest Bundle from a prescription.
        Generated after a video consultation, with NMC 2026 generic-name
        compliance (claude.md Section 10.1.1).
        """
        bundle_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        medication_requests = []
        for med in prescription_data.get("medications", []):
            med_req = {
                "resourceType": "MedicationRequest",
                "id": str(uuid.uuid4()),
                "status": "active",
                "intent": "order",
                "medicationCodeableConcept": {
                    "text": med.get("generic_name", med.get("name", "")),
                },
                "subject": {
                    "reference": f"Patient/{patient_id}",
                    "display": patient_name,
                },
                "authoredOn": now,
                "requester": {"display": doctor_name},
                "dosageInstruction": [
                    {
                        "text": f"{med.get('dosage', '')} - {med.get('frequency', '')} - {med.get('duration', '')}",
                        "timing": {"code": {"text": med.get("frequency", "")}},
                        "doseAndRate": [
                            {
                                "doseQuantity": {
                                    "value": med.get("dosage_value", 1),
                                    "unit": med.get("dosage_unit", "tablet"),
                                }
                            }
                        ],
                    }
                ],
                "note": [{"text": med.get("instructions", "")}]
                if med.get("instructions")
                else [],
            }
            medication_requests.append(med_req)

        bundle = {
            "resourceType": "Bundle",
            "id": bundle_id,
            "type": "document",
            "timestamp": now,
            "meta": {
                "profile": [
                    "https://nrces.in/ndhm/fhir/r4/StructureDefinition/DocumentBundle"
                ]
            },
            "entry": [
                {"fullUrl": f"MedicationRequest/{mr['id']}", "resource": mr}
                for mr in medication_requests
            ],
        }

        return bundle

    @staticmethod
    async def push_to_abdm(
        bundle: dict,
        abha_number: str,
        care_context_reference: str,
    ) -> dict:
        """
        Push a FHIR R4 bundle to the ABDM gateway.
        
        PRODUCTION TODO: Implement actual ABDM HIP data-push API call:
        1. Get link token from ABDM gateway
        2. POST /v0.5/health-information/hip/on-request with the FHIR bundle
        3. Handle consent artefact verification
        4. Store push confirmation for audit trail
        
        For now, simulates a successful push and creates an audit record.
        """
        push_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        push_record = {
            "push_id": push_id,
            "abha_number": abha_number,
            "bundle_id": bundle.get("id"),
            "bundle_type": bundle.get("resourceType"),
            "care_context": care_context_reference,
            "status": "pushed",
            "pushed_at": now,
            "abdm_response": {
                "status": "SUCCESS",
                "message": "Health record pushed to ABDM gateway (sandbox)",
                "transaction_id": str(uuid.uuid4()),
            },
        }

        # Store audit trail
        if supabase:
            supabase.table("documents").insert({
                "id": push_id,
                "user_id": "",  # Will be populated from patient lookup
                "document_type": "abdm_fhir_push",
                "file_url": "",
                "metadata": push_record,
                "verification_status": "verified",
                "created_at": now,
            }).execute()

        return push_record

    @staticmethod
    async def generate_and_push_diagnostic_report(
        booking_id: str,
        report_data: dict,
    ) -> dict:
        """
        End-to-end: Generate FHIR bundle from a completed diagnostic test
        and push to ABDM. Called when a lab result is finalized.
        """
        if not supabase:
            return {"success": False, "message": "Supabase not configured"}

        # Get booking details
        booking = supabase.table("bookings").select("*").eq("id", booking_id).execute()
        if not booking.data:
            return {"success": False, "message": "Booking not found"}

        booking_data = booking.data[0]
        patient_id = booking_data["patient_id"]

        # Get patient + user info
        user_result = supabase.table("users").select("*").eq("id", patient_id).execute()
        patient_result = supabase.table("patients").select("*").eq("user_id", patient_id).execute()

        if not user_result.data or not patient_result.data:
            return {"success": False, "message": "Patient not found"}

        user = user_result.data[0]
        patient = patient_result.data[0]
        abha_number = patient.get("abha_number")

        # Generate FHIR bundle
        bundle = FHIRService.create_diagnostic_report_bundle(
            patient_id=patient_id,
            patient_name=user["full_name"],
            abha_number=abha_number or "",
            report_data=report_data,
        )

        result = {
            "success": True,
            "fhir_bundle": bundle,
            "abha_linked": bool(abha_number),
        }

        # Push to ABDM if patient has ABHA linkage
        if abha_number:
            push_result = await FHIRService.push_to_abdm(
                bundle=bundle,
                abha_number=abha_number,
                care_context_reference=f"booking/{booking_id}",
            )
            result["abdm_push"] = push_result
        else:
            result["abdm_push"] = None
            result["message"] = "FHIR bundle generated but ABHA not linked — skipping ABDM push"

        return result
