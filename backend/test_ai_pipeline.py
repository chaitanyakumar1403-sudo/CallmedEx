import asyncio
import io
import os
import json
from PIL import Image, ImageDraw, ImageFont

# Set env vars before importing services to ensure settings are loaded
os.environ["USE_MOCK_GOV_API"] = "true"

from app.services.verification import VerificationService
from app.services.ai_ocr import AIOCRService

def create_mock_certificate_image(name: str, license_no: str) -> bytes:
    """Creates a basic image with text to simulate a certificate for OCR testing."""
    img = Image.new('RGB', (800, 400), color=(255, 255, 255))
    d = ImageDraw.Draw(img)
    
    # Draw some text
    d.text((50, 50), "MEDICAL COUNCIL OF INDIA", fill=(0, 0, 0))
    d.text((50, 100), "CERTIFICATE OF REGISTRATION", fill=(0, 0, 0))
    d.text((50, 150), f"This is to certify that {name}", fill=(0, 0, 0))
    d.text((50, 200), f"Registration Number: {license_no}", fill=(0, 0, 0))
    d.text((50, 250), "Qualification: MBBS", fill=(0, 0, 0))
    
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='JPEG')
    return img_byte_arr.getvalue()

async def test_pipeline():
    print("==================================================")
    print("TESTING AI OCR & GOV API PIPELINE END-TO-END")
    print("==================================================")
    
    # 1. Setup mock data
    user_id = "test-user-123"
    role = "doctor"
    profile_name = "Dr. John Doe"
    profile_license = "MCI-12345"
    
    print(f"\n[1] Generating mock certificate image for {profile_name} (License: {profile_license})...")
    image_bytes = create_mock_certificate_image(name=profile_name, license_no=profile_license)
    
    # 2. Mock the DB calls in VerificationService so we don't need a live DB
    # We store the original functions to restore them later if needed (good practice)
    original_get_profile = VerificationService.get_provider_profile
    original_get_user = VerificationService._get_user_record
    original_finalize = VerificationService._finalize
    
    async def mock_get_profile(*args, **kwargs):
        return {
            "medical_license_number": profile_license,
            "specialization": "Cardiology",
            "qualification": "MBBS",
            "verification_status": "pending"
        }
        
    async def mock_get_user(*args, **kwargs):
        return {
            "id": user_id,
            "full_name": profile_name,
            "email": "john.doe@example.com"
        }
        
    async def mock_finalize(uid, r, status, checks, ocr_data=None, gov_data=None):
        return {
            "success": status == "verified",
            "status": status,
            "message": VerificationService._status_message(status),
            "checks": checks,
            "ocr_extraction": ocr_data,
            "gov_api_response": gov_data
        }
        
    VerificationService.get_provider_profile = mock_get_profile
    VerificationService._get_user_record = mock_get_user
    VerificationService._finalize = mock_finalize

    try:
        # 3. RUN THE PIPELINE (Success Case)
        print("\n[2] Running full verification pipeline (SUCCESS CASE)...")
        result = await VerificationService.run_full_verification(
            user_id=user_id,
            role=role,
            file_bytes=image_bytes,
            mime_type="image/jpeg"
        )
        
        print(f"\n[PASS] Final Status: {result['status']}")
        print("OCR Extraction:")
        print(json.dumps(result.get("ocr_extraction"), indent=2))
        print("Gov API Response:")
        print(json.dumps(result.get("gov_api_response"), indent=2))
        
        assert result['status'] == 'verified', f"Expected 'verified', got {result['status']}"
        
        print("\n[WAIT] Sleeping for 15 seconds to respect Gemini Free Tier rate limits...")
        await asyncio.sleep(15)
        
        # 4. RUN THE PIPELINE (Mismatch Case)
        print("\n[3] Running full verification pipeline (MISMATCH CASE)...")
        print(f"    (Generating certificate with wrong license number 'MCI-99999')")
        bad_image_bytes = create_mock_certificate_image(name=profile_name, license_no="MCI-99999")
        
        bad_result = await VerificationService.run_full_verification(
            user_id=user_id,
            role=role,
            file_bytes=bad_image_bytes,
            mime_type="image/jpeg"
        )
        
        print(f"\n[REJECTED AS EXPECTED] Final Status: {bad_result['status']}")
        print(f"Reason: {bad_result['message']}")
        
        assert bad_result['status'] == 'rejected_mismatch', f"Expected 'rejected_mismatch', got {bad_result['status']}"
        
        print("\nALL TESTS PASSED! The AI OCR and Gov API pipeline is working perfectly.")
        
    finally:
        # Restore original functions
        VerificationService.get_provider_profile = original_get_profile
        VerificationService._get_user_record = original_get_user
        VerificationService._finalize = original_finalize

if __name__ == "__main__":
    asyncio.run(test_pipeline())
