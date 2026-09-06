"""
Patient AI Preventive Care Recommendations Router
Leverages OpenRouter AI Client to generate personalized diagnostic and preventive screening recommendations.
"""
import json
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.database import supabase
from app.middleware.auth import get_current_user
from app.utils.db_helpers import _rows
from app.services.openrouter_client import OpenRouterClient, OpenRouterError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/patient", tags=["Patient AI"])


class RecommendTestItem(BaseModel):
    test_name: str
    category: str
    reason: str
    action_url: str
    urgency: str = "medium"  # low, medium, high


class AIRecommendationsResponse(BaseModel):
    health_summary: str
    risk_factors: List[str]
    recommended_tests: List[RecommendTestItem]
    lifestyle_tips: List[str]


def _build_fallback_recommendations(medications: list) -> dict:
    """Clinical fallback based on active medications and routine preventive protocols."""
    med_names = [m.get("medicine_name", "").lower() for m in medications]
    has_cardio = any(k in " ".join(med_names) for k in ["statin", "atorva", "amlodipine", "losartan", "telmisartan"])
    has_diabetic = any(k in " ".join(med_names) for k in ["metformin", "glimepiride", "insulin", "vildagliptin"])

    recommended_tests = [
        {
            "test_name": "Complete Blood Picture (CBP / CBC)",
            "category": "hematology",
            "reason": "Baseline cellular health, hemoglobin indices, and immune surveillance.",
            "action_url": "/diagnostics?search=Complete+Blood+Picture",
            "urgency": "low",
        }
    ]

    if has_diabetic:
        recommended_tests.append({
            "test_name": "Glycated Hemoglobin (HbA1c) & Fasting Blood Sugar",
            "category": "metabolic",
            "reason": "Essential 3-month glycemic surveillance based on active antidiabetic therapy.",
            "action_url": "/diagnostics?search=HbA1c",
            "urgency": "high",
        })
    else:
        recommended_tests.append({
            "test_name": "Comprehensive Metabolic & Lipid Risk Panel",
            "category": "cardiac",
            "reason": "Annual cardiovascular lipid profile and fasting glucose monitoring.",
            "action_url": "/diagnostics?search=Lipid+Profile",
            "urgency": "medium",
        })

    if has_cardio:
        recommended_tests.append({
            "test_name": "Kidney Function Test (KFT) & Serum Electrolytes",
            "category": "renal",
            "reason": "Regular monitoring of glomerular filtration and creatinine on cardiovascular regimens.",
            "action_url": "/diagnostics?search=Kidney+Function",
            "urgency": "medium",
        })
    else:
        recommended_tests.append({
            "test_name": "Vitamin D (25-OH) & Vitamin B12 Duo",
            "category": "preventive",
            "reason": "Evaluate metabolic bone strength, fatigue markers, and neurological baseline.",
            "action_url": "/diagnostics?search=Vitamin+D",
            "urgency": "low",
        })

    return {
        "health_summary": "Your health profile is stable. Preventive monitoring is optimized for your active routine.",
        "risk_factors": [
            "Routine preventive diagnostic interval approaching",
            "Cardiometabolic baseline check recommended" if has_cardio or has_diabetic else "Nutritional balance and micronutrient review",
        ],
        "recommended_tests": recommended_tests,
        "lifestyle_tips": [
            "Maintain adequate hydration throughout daily routines.",
            "Schedule sample collection in the early morning for true fasting accuracy.",
            "Review your smart medicine cabinet pill count for refill timeliness.",
        ],
    }


@router.post("/ai-recommendations", response_model=AIRecommendationsResponse)
async def get_patient_ai_recommendations(
    user: dict = Depends(get_current_user)
):
    """
    Generate personalized preventive diagnostic and wellness recommendations
    using OpenRouter multi-model AI, with clinical guidelines fallback.
    """
    if user.get("role") != "patient":
        raise HTTPException(403, "Patients only.")

    patient_id = user.get("sub")
    if not patient_id:
        raise HTTPException(403, "Invalid session.")

    # 1. Gather patient context (medications, recent tests, profile)
    medications = []
    if supabase:
        try:
            medications = _rows(
                supabase.table("patient_medications")
                .select("medicine_name, dosage, pills_per_day, remaining_pills")
                .eq("patient_id", patient_id)
                .execute()
            )
        except Exception as e:
            logger.warning(f"Could not load medications for AI context: {e}")

    # 2. Try generating via OpenRouterClient
    client = OpenRouterClient()
    if client.api_key:
        try:
            prompt = (
                "You are CallMedex Preventive Clinical AI, an expert medical assistant for India's premier "
                "AI-native doorstep diagnostic and healthcare network. Analyze the following patient health context "
                "and return a strictly valid JSON response with 3 targeted diagnostic tests available in India "
                "(e.g., Lipid Profile, HbA1c, Complete Blood Picture, Thyroid Profile, Liver Function Test, Vitamin D).\n\n"
                f"Patient ID: {patient_id}\n"
                f"Active Medications: {json.dumps(medications)}\n\n"
                "Return JSON matching this exact structure ONLY:\n"
                "{\n"
                '  "health_summary": "Brief 1-2 sentence clinical summary of current health maintenance.",\n'
                '  "risk_factors": ["risk factor 1", "risk factor 2"],\n'
                '  "recommended_tests": [\n'
                '    {\n'
                '      "test_name": "Test Name",\n'
                '      "category": "cardiac|metabolic|hematology|renal|preventive",\n'
                '      "reason": "Clinical justification for this test",\n'
                '      "action_url": "/diagnostics?search=TestName",\n'
                '      "urgency": "low|medium|high"\n'
                '    }\n'
                '  ],\n'
                '  "lifestyle_tips": ["tip 1", "tip 2", "tip 3"]\n'
                "}"
            )

            messages = [
                {"role": "system", "content": "You are a clinical AI advisor. Output valid JSON only."},
                {"role": "user", "content": prompt}
            ]
            response_text = client._call(
                model=client.base_url and "meta-llama/llama-3.3-70b-instruct" or "google/gemini-2.0-flash-001",
                messages=messages,
                temperature=0.2,
            )
            cleaned = response_text.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            data = json.loads(cleaned.strip())
            return AIRecommendationsResponse(**data)
        except Exception as exc:
            logger.warning(f"OpenRouter generation failed or returned unparseable JSON ({exc}); using clinical fallback.")

    # 3. Fallback
    fallback_data = _build_fallback_recommendations(medications)
    return AIRecommendationsResponse(**fallback_data)
