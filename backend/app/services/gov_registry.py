"""
Government Registry API Adapter — CallMedex Verification Pipeline
Provides a unified interface for verifying provider credentials against
Indian government registries.

Supported registries:
  - NMC (National Medical Commission) — for doctors
  - State Pharmacy Council / Drug License — for pharmacies
  - MLT/DMLT Certificate Registry — for phlebotomists
  - Municipal/Health License Registry — for organizations/hospitals
  - State Nursing Council / INC — for nurses

Uses an environment variable toggle (USE_MOCK_GOV_API) to switch between
simulated responses (for development) and real API calls (for production).

When the real APIs are unavailable (timeout/5xx), the system retries with
exponential backoff up to 3 times, then marks the verification as
'flagged_api_down' so the user is not punished for infrastructure issues.
"""
import logging
import asyncio
from typing import Dict, Any, Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

# Maximum retries for government API calls
MAX_RETRIES = 3
# Base delay in seconds for exponential backoff
BASE_DELAY = 1.0


class GovRegistryAPI:
    """
    Unified adapter for all Indian government verification registries.
    Toggle between mock and live mode via USE_MOCK_GOV_API env variable.
    """

    # ─── DOCTOR: NMC Registry ────────────────────────────────────────────

    @staticmethod
    async def verify_doctor(license_number: str, name: str) -> Dict[str, Any]:
        """
        Verify a doctor's medical license against the NMC registry.

        Production endpoint (when available):
            POST https://www.nmc.org.in/api/v1/verify-license
            Body: { "license_number": "...", "name": "..." }

        Returns:
            {
                "is_valid": bool,
                "registry_name": str (e.g., "Dr. Sai Kumar"),
                "status": str (e.g., "active", "expired", "not_found"),
                "details": dict | None,
                "error": str | None
            }
        """
        if settings.USE_MOCK_GOV_API:
            return GovRegistryAPI._mock_verify(
                license_number, name, registry="NMC Doctor Registry"
            )

        return await GovRegistryAPI._call_with_retry(
            url="https://www.nmc.org.in/api/v1/verify-license",
            payload={"license_number": license_number, "name": name},
            registry="NMC Doctor Registry",
        )

    # ─── PHARMACY: Drug License / State Pharmacy Council ─────────────────

    @staticmethod
    async def verify_pharmacy(
        registration_number: str,
        drug_license_number: str,
        pharmacy_name: str,
    ) -> Dict[str, Any]:
        """
        Verify pharmacy registration and drug license.

        Production endpoints (when available):
            - State Pharmacy Council API
            - Central Drug Standard Control Organization (CDSCO)
        """
        if settings.USE_MOCK_GOV_API:
            return GovRegistryAPI._mock_verify(
                drug_license_number or registration_number,
                pharmacy_name,
                registry="Drug License / Pharmacy Council",
            )

        return await GovRegistryAPI._call_with_retry(
            url="https://cdsco.gov.in/api/v1/verify-drug-license",
            payload={
                "registration_number": registration_number,
                "drug_license_number": drug_license_number,
                "name": pharmacy_name,
            },
            registry="Drug License / Pharmacy Council",
        )

    # ─── PHLEBOTOMIST: MLT/DMLT Certificate Registry ────────────────────

    @staticmethod
    async def verify_phlebotomist(
        certification_number: str, name: str
    ) -> Dict[str, Any]:
        """
        Verify phlebotomist MLT/DMLT certification.

        Production endpoint (when available):
            State Medical Lab Technician Registration Council
        """
        if settings.USE_MOCK_GOV_API:
            return GovRegistryAPI._mock_verify(
                certification_number, name, registry="MLT/DMLT Certificate Registry"
            )

        return await GovRegistryAPI._call_with_retry(
            url="https://mltreg.gov.in/api/v1/verify-certificate",
            payload={"certification_number": certification_number, "name": name},
            registry="MLT/DMLT Certificate Registry",
        )

    # ─── ORGANIZATION: Municipal / Health License Registry ───────────────

    @staticmethod
    async def verify_organization(
        license_number: str, organization_name: str
    ) -> Dict[str, Any]:
        """
        Verify hospital/clinic municipal or health license.
        Also tries ABDM Health Facility Registry (HFR) if configured.
        """
        if settings.USE_MOCK_GOV_API:
            return GovRegistryAPI._mock_verify(
                license_number,
                organization_name,
                registry="Municipal/Health License Registry",
            )

        # Try ABDM HFR first if configured
        from app.services.abdm import ABDMService

        abdm_result = await ABDMService.verify_health_facility(license_number)
        if abdm_result.get("is_valid"):
            return {
                "is_valid": True,
                "registry_name": abdm_result.get("facility_details", {}).get(
                    "facility_name", ""
                ),
                "status": "active",
                "details": abdm_result.get("facility_details"),
                "error": None,
            }

        # Fallback to municipal registry
        return await GovRegistryAPI._call_with_retry(
            url="https://healthlicense.gov.in/api/v1/verify",
            payload={
                "license_number": license_number,
                "name": organization_name,
            },
            registry="Municipal/Health License Registry",
        )

    # ─── NURSE: State Nursing Council / INC ──────────────────────────────

    @staticmethod
    async def verify_nurse(license_number: str, name: str) -> Dict[str, Any]:
        """
        Verify nurse registration against Indian Nursing Council or
        State Nursing Council registry.
        """
        if settings.USE_MOCK_GOV_API:
            return GovRegistryAPI._mock_verify(
                license_number, name, registry="Nursing Council Registry"
            )

        return await GovRegistryAPI._call_with_retry(
            url="https://indiannursingcouncil.org/api/v1/verify",
            payload={"license_number": license_number, "name": name},
            registry="Nursing Council Registry",
        )

    # ═══════════════════════════════════════════════════════════════════════
    # INTERNAL: Retry logic & Mock mode
    # ═══════════════════════════════════════════════════════════════════════

    @staticmethod
    async def _call_with_retry(
        url: str,
        payload: dict,
        registry: str,
    ) -> Dict[str, Any]:
        """
        Call an external government API with exponential backoff retries.
        After MAX_RETRIES failures, returns flagged_api_down instead of rejecting.
        """
        last_error = None

        for attempt in range(1, MAX_RETRIES + 1):
            try:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    response = await client.post(url, json=payload)

                    if response.status_code == 404:
                        return {
                            "is_valid": False,
                            "registry_name": None,
                            "status": "not_found",
                            "details": None,
                            "error": f"Not found in {registry}.",
                        }

                    response.raise_for_status()
                    data = response.json()

                    return {
                        "is_valid": data.get("is_valid", False),
                        "registry_name": data.get("name", data.get("facility_name")),
                        "status": data.get("status", "unknown"),
                        "details": data,
                        "error": None,
                    }

            except (httpx.TimeoutException, httpx.HTTPStatusError) as e:
                last_error = str(e)
                delay = BASE_DELAY * (2 ** (attempt - 1))
                logger.warning(
                    f"Gov API attempt {attempt}/{MAX_RETRIES} failed for {registry}: {e}. "
                    f"Retrying in {delay}s..."
                )
                await asyncio.sleep(delay)

            except Exception as e:
                last_error = str(e)
                logger.error(f"Unexpected error calling {registry}: {e}")
                break

        # All retries exhausted — don't punish the user for infra issues
        logger.error(
            f"Gov API {registry} failed after {MAX_RETRIES} retries: {last_error}"
        )
        return {
            "is_valid": False,
            "registry_name": None,
            "status": "api_down",
            "details": None,
            "error": f"{registry} is currently unreachable. Please try again later.",
        }

    @staticmethod
    def _mock_verify(
        identifier: str, name: str, registry: str
    ) -> Dict[str, Any]:
        """
        Simulated government API response for development/testing.
        Rules:
          - If identifier contains 'FAKE' or 'INVALID' → rejected
          - If identifier is empty or less than 4 chars → rejected
          - Otherwise → approved
        """
        if not identifier or len(identifier.strip()) < 4:
            return {
                "is_valid": False,
                "registry_name": None,
                "status": "not_found",
                "details": None,
                "error": f"Identifier not found in {registry} (mock mode).",
            }

        upper_id = identifier.upper()
        if "FAKE" in upper_id or "INVALID" in upper_id or "TEST" in upper_id:
            return {
                "is_valid": False,
                "registry_name": None,
                "status": "rejected",
                "details": None,
                "error": f"Identifier '{identifier}' flagged as invalid in {registry} (mock mode).",
            }

        # Simulate success
        logger.info(f"[MOCK] {registry}: '{identifier}' for '{name}' → VERIFIED")
        return {
            "is_valid": True,
            "registry_name": name,
            "status": "active",
            "details": {
                "identifier": identifier,
                "name": name,
                "registry": registry,
                "mode": "simulated",
            },
            "error": None,
        }
