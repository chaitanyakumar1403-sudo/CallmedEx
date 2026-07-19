import asyncio
import json
from app.config import settings
from app.services.ai_reports import AIReportService

def test_gemini():
    print("Checking GEMINI_API_KEY loaded:", bool(settings.GEMINI_API_KEY))
    
    # 2. Test AI Reports (Vision)
    print("\n--- Testing Vision Model (AI Reports) ---")
    try:
        # Create a tiny 1x1 dummy PNG
        dummy_image = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'
        
        report = AIReportService.interpret_lab_report(dummy_image, "image/png")
        print("Success! AI Report Result:")
        print(json.dumps(report, indent=2))
    except Exception as e:
        print("AI Reports failed:", e)

if __name__ == "__main__":
    test_gemini()
