import asyncio
import json
from app.config import settings
from app.services.fraud_detection import FraudDetectionService
from app.services.ai_reports import AIReportService

def test_groq():
    print("Checking GROQ_API_KEY loaded:", bool(settings.GROQ_API_KEY))
    
    # 1. Test Fraud Detection (Text - llama-3.3-70b-versatile)
    print("\n--- Testing Text Model (Fraud Detection) ---")
    dummy_billing = json.dumps([
        {
            "id": "1",
            "name": "Dr. Test",
            "type": "doctor",
            "total_bookings": 100,
            "no_shows": 90,
            "complaints": 10
        }
    ])
    
    try:
        results = FraudDetectionService.scan_for_anomalies(dummy_billing)
        print("Success! Fraud Detection Result:")
        print(json.dumps(results, indent=2))
    except Exception as e:
        print("Fraud Detection failed:", e)

    # 2. Test AI Reports (PyMuPDF Text Extraction + Groq Text)
    print("\n--- Testing PDF Text Extraction Model (AI Reports) ---")
    try:
        import fitz
        doc = fitz.open()
        page = doc.new_page()
        page.insert_text((50, 50), "Patient: John Doe\nHbA1c: 6.5%\nStatus: High")
        pdf_bytes = doc.write()
        doc.close()
        
        report = AIReportService.interpret_lab_report(pdf_bytes, "application/pdf")
        print("Success! AI Report Result:")
        print(json.dumps(report, indent=2))
    except Exception as e:
        print("AI Reports failed:", e)

if __name__ == "__main__":
    test_groq()
