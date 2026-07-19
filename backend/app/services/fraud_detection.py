"""
Phase 8: Admin Fraud Detection Service
Uses Groq (Llama 3) to scan billing and provider data for anomalies.
"""
from typing import Dict, Any, List
import json
import logging
from app.config import settings

logger = logging.getLogger(__name__)

class FraudDetectionService:
    @staticmethod
    def scan_for_anomalies(billing_data_json: str) -> List[Dict[str, Any]]:
        """
        Feeds raw billing data into Groq to detect fraud/anomalies.
        """
        if not settings.GROQ_API_KEY:
            logger.warning("GROQ_API_KEY is not set. Returning simulated fraud anomalies.")
            return FraudDetectionService._get_mock_anomalies()

        try:
            from groq import Groq
            client = Groq(api_key=settings.GROQ_API_KEY)
            
            prompt = f"""
            You are a forensic auditor and fraud detection AI for a medical platform.
            Analyze the following JSON array of provider billing metrics.
            Look for these specific anomalies:
            1. Unusually high cancellation or no-show rates (suggests phantom bookings).
            2. High complaint rates.
            3. Disproportionately high booking volumes in a short span.
            
            For each provider, calculate a Trust Score from 0 to 100 (where 100 is perfectly trustworthy, and <70 is suspicious).
            If a provider is suspicious (Score < 70), set "flagged" to true, and provide a clear, concise "flag_reason".
            
            Here is the provider data:
            {billing_data_json}
            
            OUTPUT FORMAT:
            You must output ONLY valid JSON containing a single key "anomalies" which maps to an array of objects.
            {{
                "anomalies": [
                    {{
                        "id": "provider_id",
                        "name": "Provider Name",
                        "type": "doctor|pharmacy|phlebotomist",
                        "total_bookings": 100,
                        "no_shows": 5,
                        "complaints": 2,
                        "score": 85.5,
                        "flagged": false,
                        "flag_reason": "N/A or specific reason if flagged"
                    }}
                ]
            }}
            """

            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": "You are a precise JSON output generator. Output only valid JSON."},
                    {"role": "user", "content": prompt}
                ]
            )
            
            response_text = response.choices[0].message.content
            parsed = json.loads(response_text)
            return parsed.get("anomalies", [])
            
        except Exception as e:
            logger.error(f"Groq API Error in Fraud Detection: {e}")
            raise ValueError("Failed to run AI fraud scan.")

    @staticmethod
    def _get_mock_anomalies() -> List[Dict[str, Any]]:
        return [
            { "id": '1', "name": 'Dr. Ramesh Kumar', "type": 'doctor', "total_bookings": 145, "no_shows": 2, "complaints": 1, "score": 98.5, "flagged": False, "flag_reason": "N/A" },
            { "id": '2', "name": 'Apollo Pharmacy (Madhurawada)', "type": 'pharmacy', "total_bookings": 320, "no_shows": 12, "complaints": 8, "score": 65.0, "flagged": True, "flag_reason": "High complaint volume and no-shows." },
            { "id": '3', "name": 'Suresh (Phlebotomist)', "type": 'phlebotomist', "total_bookings": 89, "no_shows": 0, "complaints": 0, "score": 100.0, "flagged": False, "flag_reason": "N/A" },
            { "id": '4', "name": 'Dr. Anjali Gupta', "type": 'doctor', "total_bookings": 45, "no_shows": 5, "complaints": 3, "score": 52.5, "flagged": True, "flag_reason": "Abnormal ratio of no-shows compared to total bookings." }
        ]
