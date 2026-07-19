import httpx
from app.config import settings
import logging

logger = logging.getLogger(__name__)

class ABDMService:
    @staticmethod
    async def get_access_token() -> str:
        """
        Retrieves the OAuth2 access token from the ABDM Gateway.
        """
        if not settings.ABDM_CLIENT_ID or not settings.ABDM_CLIENT_SECRET:
            logger.warning("ABDM credentials missing. Simulating access token.")
            return "mock-access-token"

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{settings.ABDM_SANDBOX_URL}/gateway/v0.5/sessions",
                    json={
                        "clientId": settings.ABDM_CLIENT_ID,
                        "clientSecret": settings.ABDM_CLIENT_SECRET
                    }
                )
                response.raise_for_status()
                data = response.json()
                return data.get("accessToken", "")
        except httpx.HTTPError as e:
            logger.error(f"Failed to fetch ABDM access token: {e}")
            raise Exception("ABDM Authentication Failed")

    @staticmethod
    async def verify_health_facility(license_number: str) -> dict:
        """
        Verifies if the given license number exists in the ABDM Health Facility Registry (HFR).
        Returns a dictionary with 'is_valid' and 'facility_details' (if valid).
        """
        if not license_number:
            return {"is_valid": False, "reason": "No license number provided."}
            
        token = await ABDMService.get_access_token()

        if token == "mock-access-token":
            # ---------------------------------------------------------
            # MOCK / FALLBACK MODE FOR LOCAL DEVELOPMENT
            # ---------------------------------------------------------
            logger.warning(f"Simulating ABDM HFR Verification for License: {license_number}")
            
            # Simulate a fake or test license number failing
            if "FAKE" in license_number.upper() or "INVALID" in license_number.upper():
                return {
                    "is_valid": False, 
                    "reason": f"ABDM Registry: Facility with license {license_number} not found or inactive."
                }
                
            # Simulate success
            return {
                "is_valid": True,
                "facility_details": {
                    "facility_name": "Verified Facility (Mocked)",
                    "license_number": license_number,
                    "state": "Telangana"
                }
            }

        # ---------------------------------------------------------
        # REAL PRODUCTION MODE
        # ---------------------------------------------------------
        try:
            async with httpx.AsyncClient() as client:
                # The actual ABDM HFR endpoint for searching facilities
                # (Using the standard HFR v1 schema structure for sandbox)
                headers = {
                    "Authorization": f"Bearer {token}",
                    "X-HIU-ID": settings.ABDM_CLIENT_ID,
                }
                
                # In the real HFR API, you typically search by facility ID or Registration number
                search_payload = {
                    "facilityId": license_number  # Depending on exact HFR specs, this could be 'registrationNumber'
                }
                
                response = await client.post(
                    f"{settings.ABDM_SANDBOX_URL}/hfr/facility/search",
                    headers=headers,
                    json=search_payload
                )
                
                # If the facility isn't found, it usually returns 404 or an empty list
                if response.status_code == 404:
                    return {"is_valid": False, "reason": "Facility not found in government registry."}
                    
                response.raise_for_status()
                data = response.json()
                
                # Validate the response payload
                if data and len(data.get("facilities", [])) > 0:
                    facility = data["facilities"][0]
                    return {
                        "is_valid": True,
                        "facility_details": facility
                    }
                else:
                    return {"is_valid": False, "reason": "Facility not found or inactive."}
                    
        except httpx.HTTPError as e:
            logger.error(f"ABDM HFR API error: {e}")
            # If the government API is down, we might want to gracefully reject or delay
            return {"is_valid": False, "reason": "Government registry is currently unreachable. Please try again later."}
