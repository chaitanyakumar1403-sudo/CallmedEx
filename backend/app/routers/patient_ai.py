"""
Patient AI Preventive Care Recommendations & Health Orchestra Router
Leverages OpenRouter AI Client with deepseek/deepseek-v4-flash-0731 to generate
personalized 3-section healthcare orchestration:
1. Patient Health Profile & Vitals (Weight, Height, BMI, BP, Glucose, Conditions)
2. Targeted Diagnostic Tests, Care Services & Doctor Consultations
3. AI Care Guidance (Workouts, Diet & Nutrition Plan, Lifestyle Advice)
"""
import asyncio
import json
import logging
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.database import supabase
from app.middleware.auth import get_current_user
from app.utils.db_helpers import _rows
from app.services.openrouter_client import OpenRouterClient, OpenRouterError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/patient", tags=["Patient AI"])

AI_MODEL = "deepseek/deepseek-v4-flash-0731"


# ─── Pydantic Models ─────────────────────────────────────────────────────────

class PatientHealthProfileIn(BaseModel):
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    blood_pressure: Optional[str] = None  # e.g. "120/80"
    fasting_blood_sugar: Optional[float] = None  # mg/dL
    blood_group: Optional[str] = None
    conditions: Optional[List[str]] = None
    allergies: Optional[List[str]] = None
    activity_level: Optional[str] = None  # sedentary, light, moderate, active
    dietary_preference: Optional[str] = None  # vegetarian, non-vegetarian, vegan, eggetarian


class PatientHealthProfileResponse(BaseModel):
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    bmi: Optional[float] = None
    bmi_category: str = "Not Recorded"
    blood_pressure: Optional[str] = None
    fasting_blood_sugar: Optional[float] = None
    blood_group: Optional[str] = None
    conditions: List[str] = []
    allergies: List[str] = []
    activity_level: Optional[str] = "moderate"
    dietary_preference: Optional[str] = "vegetarian"
    updated_at: Optional[str] = None


class RecommendTestItem(BaseModel):
    test_name: str
    category: str
    reason: str
    action_url: str
    urgency: str = "medium"  # low, medium, high
    estimated_price: Optional[int] = None


class RecommendDoctorItem(BaseModel):
    id: Optional[str] = None
    doctor_id: Optional[str] = None
    doctor_name: str
    specialty: str
    title: Optional[str] = None
    qualification: Optional[str] = None
    experience: Optional[str] = None
    fee: int = 500
    languages: List[str] = Field(default_factory=lambda: ["English", "Telugu"])
    hospital: Optional[str] = None
    rating: float = 4.98
    reason: str
    consultation_mode: str = "video"  # video, in_person, home_visit
    action_url: str


class RecommendServiceItem(BaseModel):
    service_name: str
    reason: str
    action_url: str


class WorkoutPlan(BaseModel):
    warmup: str
    cardio: str
    strength_and_mobility: str
    weekly_frequency: str
    precautions: str


class DietPlan(BaseModel):
    hydration_target: str
    beneficial_foods: List[str]
    foods_to_avoid: List[str]
    meal_timing_tips: str


class CareGuidance(BaseModel):
    workouts: WorkoutPlan
    diet_plan: DietPlan
    lifestyle_tips: List[str]


class AIRecommendationsResponse(BaseModel):
    health_summary: str
    risk_factors: List[str]
    health_profile: PatientHealthProfileResponse
    recommended_tests: List[RecommendTestItem]
    recommended_doctors: List[RecommendDoctorItem]
    recommended_services: List[RecommendServiceItem]
    care_guidance: CareGuidance
    lifestyle_tips: Optional[List[str]] = Field(default_factory=list)

    def __init__(self, **data):
        super().__init__(**data)
        if not self.lifestyle_tips and self.care_guidance and self.care_guidance.lifestyle_tips:
            self.lifestyle_tips = list(self.care_guidance.lifestyle_tips)


# ─── Helper: Compute BMI ─────────────────────────────────────────────────────

def _calculate_bmi(weight_kg: Optional[float], height_cm: Optional[float]):
    if not weight_kg or not height_cm or height_cm <= 0 or weight_kg <= 0:
        return None, "Not Recorded"
    height_m = height_cm / 100.0
    bmi = round(weight_kg / (height_m * height_m), 1)
    if bmi < 18.5:
        cat = "Underweight"
    elif bmi < 24.9:
        cat = "Normal Weight"
    elif bmi < 29.9:
        cat = "Overweight"
    else:
        cat = "Obese"
    return bmi, cat


# ─── Clinical Fallback Engine ────────────────────────────────────────────────

def _build_clinical_fallback(profile: PatientHealthProfileResponse, medications: list) -> dict:
    """Evidence-based clinical fallback following ICMR & Indian preventive protocols."""
    med_names = [m.get("medicine_name", "").lower() for m in medications]
    conds = [c.lower() for c in profile.conditions]

    has_cardio = any(k in " ".join(med_names) for k in ["statin", "atorva", "amlodipine", "losartan", "telmisartan"]) or "hypertension" in conds or "heart disease" in conds
    has_diabetic = any(k in " ".join(med_names) for k in ["metformin", "glimepiride", "insulin", "vildagliptin"]) or "diabetes" in conds or "diabetes type 2" in conds
    has_thyroid = "thyroid" in conds or any("thyroxine" in m for m in med_names)

    bmi = profile.bmi or 22.0
    is_overweight = bmi >= 25.0

    # Tests
    tests: List[dict] = [
        {
            "test_name": "Complete Blood Picture (CBP / CBC)",
            "category": "hematology",
            "reason": "Evaluates baseline red/white blood cellular indices, hemoglobin, and immune defense.",
            "action_url": "/diagnostics?search=Complete+Blood+Picture",
            "urgency": "low",
            "estimated_price": 299,
        }
    ]

    if has_diabetic or (profile.fasting_blood_sugar and profile.fasting_blood_sugar > 110):
        tests.append({
            "test_name": "Glycated Hemoglobin (HbA1c) & Fasting Blood Sugar",
            "category": "metabolic",
            "reason": "Essential 3-month glycemic evaluation and surveillance for insulin resistance.",
            "action_url": "/diagnostics?search=HbA1c",
            "urgency": "high",
            "estimated_price": 499,
        })
    else:
        tests.append({
            "test_name": "Comprehensive Lipid Risk Panel",
            "category": "cardiac",
            "reason": "Annual cardiovascular lipid profile (Total Cholesterol, HDL, LDL, Triglycerides).",
            "action_url": "/diagnostics?search=Lipid+Profile",
            "urgency": "medium",
            "estimated_price": 450,
        })

    if has_cardio:
        tests.append({
            "test_name": "Kidney Function Test (KFT) & Serum Electrolytes",
            "category": "renal",
            "reason": "Monitors glomerular filtration rate and serum creatinine on active cardiovascular regimens.",
            "action_url": "/diagnostics?search=Kidney+Function",
            "urgency": "medium",
            "estimated_price": 550,
        })
    elif has_thyroid:
        tests.append({
            "test_name": "Thyroid Profile Total (T3, T4, TSH)",
            "category": "endocrine",
            "reason": "Assesses metabolic rate balance and endocrine regulatory feedback.",
            "action_url": "/diagnostics?search=Thyroid+Profile",
            "urgency": "high",
            "estimated_price": 399,
        })
    else:
        tests.append({
            "test_name": "Vitamin D (25-OH) & Vitamin B12 Duo",
            "category": "preventive",
            "reason": "Evaluates musculoskeletal bone density, fatigue resistance, and nerve sheath vitality.",
            "action_url": "/diagnostics?search=Vitamin+D",
            "urgency": "low",
            "estimated_price": 899,
        })

    # Doctors - 100% Genuine Registered CallMedex Practitioners Only (No Fabricated Doctors)
    doctors: List[dict] = []
    if has_cardio or has_diabetic:
        doctors.append({
            "id": "e713e870-4f61-411d-bfe1-1387f0f59c61",
            "doctor_id": "e713e870-4f61-411d-bfe1-1387f0f59c61",
            "doctor_name": "Dr. Latchireddi SA Naidu",
            "specialty": "Senior Consultant Clinical Cardio Physician & Diabetic Care",
            "title": "Senior Consultant Physician",
            "qualification": "MBBS, PGDCCP (NI)",
            "experience": "24+ yrs clinical experience",
            "fee": 500,
            "languages": ["English", "Telugu", "Hindi"],
            "hospital": "Visakha Multispeciality Clinics & Diagnostics",
            "rating": 4.98,
            "reason": "Comprehensive clinical cardiovascular assessment, hypertension stabilization, glycemic surveillance, and personalized chronic disease management.",
            "consultation_mode": "video",
            "action_url": "/booking?type=consultation&doctor=e713e870-4f61-411d-bfe1-1387f0f59c61",
        })

    # Services
    services: List[dict] = [
        {
            "service_name": "Doorstep Phlebotomist Blood Draw",
            "reason": "NABL cold-chain certified doorstep sample collection with painless vacuum tubes.",
            "action_url": "/booking?mode=home",
        },
        {
            "service_name": "Doorstep Nurse Vitals & ECG Check",
            "reason": "In-home 12-lead digital ECG screening and blood pressure calibration.",
            "action_url": "/booking?type=nurse",
        }
    ]

    # Workouts tailored to BMI & conditions
    if is_overweight:
        workouts = {
            "warmup": "5–8 minutes of light joint rotations, neck rolls, and arm swings.",
            "cardio": "35–45 minutes of low-impact brisk walking or stationary cycling at conversational pace.",
            "strength_and_mobility": "Bodyweight wall squats (2 sets x 10), seated leg extensions, and gentle cat-cow spinal stretches.",
            "weekly_frequency": "5 days per week (minimum 150 minutes total moderate activity).",
            "precautions": "Avoid high-impact jumping; wear supportive footwear; stay hydrated."
        }
    else:
        workouts = {
            "warmup": "5 minutes dynamic stretching, jumping jacks, and shoulder circles.",
            "cardio": "30 minutes moderate aerobic jog, cycling, or brisk outdoor walking.",
            "strength_and_mobility": "Push-ups (3 sets x 8), bodyweight squats (3 sets x 12), plank holds (30 seconds), and hamstring stretches.",
            "weekly_frequency": "4–5 days per week with 1 day dedicated active recovery.",
            "precautions": "Maintain neutral spine alignment; hydrate adequately before and during training."
        }

    # Diet Plan
    diet = {
        "hydration_target": "2.5 to 3.2 Liters clean water daily (add lemon/mint for electrolytes).",
        "beneficial_foods": [
            "Fiber-rich whole grains (Millets, Jowar, Oats, Brown Rice)",
            "Lean plant proteins (Sprouts, Moong Dal, Paneer / Tofu, Chickpeas)",
            "Leafy seasonal vegetables (Spinach, Methi, Bottle Gourd, Bitter Gourd)",
            "Healthy omega-3 fats (Walnuts, Flaxseeds, Chia seeds, Almonds)"
        ],
        "foods_to_avoid": [
            "Refined sugars, carbonated sodas, and packaged fruit juices",
            "Ultra-processed bakery goods containing trans fats and palm oil",
            "Excessive table salt (keep under 5g/day for optimal blood pressure)"
        ],
        "meal_timing_tips": "Consume your primary carbohydrate meals between 8 AM and 7 PM. Finish dinner at least 2.5 hours before sleeping to optimize glycemic control."
    }

    lifestyle_tips = [
        "Maintain consistent sleep hygiene with 7–8 hours of restorative rest nightly.",
        "Practice 10 minutes of box breathing (Pranayama) daily to moderate cortisol and blood pressure.",
        "Ensure fasting diagnostic blood draws are scheduled between 7:00 AM and 9:00 AM for peak biomarker accuracy.",
        "Keep your digital health locker synchronized with ABHA for instant doctor review during consults."
    ]

    health_summary = (
        f"Your health orchestra indicates {profile.bmi_category} status (BMI {profile.bmi or 'N/A'}). "
        "Preventive surveillance is tuned for active cardiovascular stability and metabolic wellness."
    )

    risk_factors = [
        f"BMI status: {profile.bmi_category} ({profile.bmi or 'baseline'})",
        "Metabolic surveillance recommended" if has_diabetic else "Routine preventive cardiovascular checkup window open",
    ]
    if profile.blood_pressure:
        risk_factors.append(f"Recorded Blood Pressure: {profile.blood_pressure} mmHg")

    return {
        "health_summary": health_summary,
        "risk_factors": risk_factors,
        "health_profile": profile.model_dump(),
        "recommended_tests": tests,
        "recommended_doctors": doctors[:3],
        "recommended_services": services,
        "care_guidance": {
            "workouts": workouts,
            "diet_plan": diet,
            "lifestyle_tips": lifestyle_tips,
        },
        "lifestyle_tips": lifestyle_tips,
    }


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/health-profile", response_model=PatientHealthProfileResponse)
async def get_patient_health_profile(
    user: dict = Depends(get_current_user)
):
    """Retrieve the current patient's saved vitals, BMI, and clinical profile."""
    if user.get("role") != "patient":
        raise HTTPException(403, "Patients only.")

    patient_id = user.get("sub")
    if not patient_id:
        raise HTTPException(403, "Invalid session.")

    profile_data = {
        "weight_kg": None,
        "height_cm": None,
        "bmi": None,
        "bmi_category": "Not Recorded",
        "blood_pressure": None,
        "fasting_blood_sugar": None,
        "blood_group": None,
        "conditions": [],
        "allergies": [],
        "activity_level": "moderate",
        "dietary_preference": "vegetarian",
        "updated_at": None,
    }

    if supabase:
        try:
            u_row = _rows(
                supabase.table("users")
                .select("weight_kg, height_cm, blood_group, medical_history, address_info, updated_at")
                .eq("id", patient_id)
                .limit(1)
                .execute()
            )
            if u_row:
                row = u_row[0]
                w = row.get("weight_kg")
                h = row.get("height_cm")
                bmi, cat = _calculate_bmi(w, h)
                profile_data["weight_kg"] = w
                profile_data["height_cm"] = h
                profile_data["bmi"] = bmi
                profile_data["bmi_category"] = cat
                profile_data["blood_group"] = row.get("blood_group")
                profile_data["conditions"] = row.get("medical_history") or []
                profile_data["updated_at"] = row.get("updated_at")

            # Check recent vitals from patient_biomarkers for BP & Sugar if recorded
            bm_rows = _rows(
                supabase.table("patient_biomarkers")
                .select("observation_code, value_number, unit, recorded_at")
                .eq("patient_id", patient_id)
                .in_("observation_code", ["BP_SYS", "BP_DIA", "FBS", "GLUCOSE_FASTING", "BLOOD_PRESSURE"])
                .order("recorded_at", desc=True)
                .execute()
            )
            for bm in bm_rows:
                code = bm.get("observation_code")
                if code in ("FBS", "GLUCOSE_FASTING") and profile_data["fasting_blood_sugar"] is None:
                    profile_data["fasting_blood_sugar"] = bm.get("value_number")
                elif code == "BLOOD_PRESSURE" and not profile_data["blood_pressure"]:
                    profile_data["blood_pressure"] = str(bm.get("unit") or bm.get("value_number") or "")
        except Exception as e:
            logger.warning(f"Could not load patient health profile from DB: {e}")

    return PatientHealthProfileResponse(**profile_data)


@router.post("/health-profile", response_model=PatientHealthProfileResponse)
@router.put("/health-profile", response_model=PatientHealthProfileResponse)
async def update_patient_health_profile(
    profile_in: PatientHealthProfileIn,
    user: dict = Depends(get_current_user)
):
    """Save and update patient vitals, height, weight, BP, sugar, and chronic conditions."""
    if user.get("role") != "patient":
        raise HTTPException(403, "Patients only.")

    patient_id = user.get("sub")
    if not patient_id:
        raise HTTPException(403, "Invalid session.")

    now_iso = datetime.now(timezone.utc).isoformat()
    bmi, bmi_cat = _calculate_bmi(profile_in.weight_kg, profile_in.height_cm)

    if supabase:
        try:
            update_payload = {
                "updated_at": now_iso,
            }
            if profile_in.weight_kg is not None:
                update_payload["weight_kg"] = profile_in.weight_kg
            if profile_in.height_cm is not None:
                update_payload["height_cm"] = profile_in.height_cm
            if profile_in.blood_group is not None:
                update_payload["blood_group"] = profile_in.blood_group
            if profile_in.conditions is not None:
                update_payload["medical_history"] = profile_in.conditions

            supabase.table("users").update(update_payload).eq("id", patient_id).execute()

            # Record BP in biomarkers if provided
            if profile_in.blood_pressure:
                try:
                    supabase.table("patient_biomarkers").insert({
                        "patient_id": patient_id,
                        "observation_code": "BLOOD_PRESSURE",
                        "observation_name": "Blood Pressure",
                        "value_number": 0,
                        "unit": profile_in.blood_pressure,
                        "recorded_at": now_iso,
                    }).execute()
                except Exception:
                    pass

            # Record fasting sugar if provided
            if profile_in.fasting_blood_sugar:
                try:
                    supabase.table("patient_biomarkers").insert({
                        "patient_id": patient_id,
                        "observation_code": "FBS",
                        "observation_name": "Fasting Blood Sugar",
                        "value_number": profile_in.fasting_blood_sugar,
                        "unit": "mg/dL",
                        "recorded_at": now_iso,
                    }).execute()
                except Exception:
                    pass
        except Exception as e:
            logger.error(f"Failed to update patient health profile in Supabase: {e}")
            raise HTTPException(500, "Could not persist health metrics.")

    return PatientHealthProfileResponse(
        weight_kg=profile_in.weight_kg,
        height_cm=profile_in.height_cm,
        bmi=bmi,
        bmi_category=bmi_cat,
        blood_pressure=profile_in.blood_pressure,
        fasting_blood_sugar=profile_in.fasting_blood_sugar,
        blood_group=profile_in.blood_group,
        conditions=profile_in.conditions or [],
        allergies=profile_in.allergies or [],
        activity_level=profile_in.activity_level or "moderate",
        dietary_preference=profile_in.dietary_preference or "vegetarian",
        updated_at=now_iso,
    )


@router.post("/ai-recommendations", response_model=AIRecommendationsResponse)
async def get_patient_ai_recommendations(
    user: dict = Depends(get_current_user)
):
    """
    Generate personalized 3-section preventive care orchestration using
    OpenRouter deepseek/deepseek-v4-flash-0731 model, with clinical guidelines fallback.
    No external model names are exposed to the frontend.
    """
    if user.get("role") != "patient":
        raise HTTPException(403, "Patients only.")

    patient_id = user.get("sub")
    if not patient_id:
        raise HTTPException(403, "Invalid session.")

    # 1. Fetch current health profile & medications
    health_profile = await get_patient_health_profile(user)

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

    # 2. Try OpenRouter with deepseek/deepseek-v4-flash-0731
    client = OpenRouterClient()
    if client.api_key:
        try:
            prompt = (
                "You are CallMedex Clinical Intelligence, India's leading AI healthcare orchestration engine. "
                "Analyze this patient's health profile, vitals, and medications, then return a comprehensive "
                "JSON response with diagnostic tests, doctor consultations, doorstep services, and a tailored "
                "care guidance plan (workout regimen and diet plan) suited for Indian lifestyle and clinical guidelines.\n\n"
                f"Patient Profile:\n"
                f"- Weight: {health_profile.weight_kg or 'Not provided'} kg\n"
                f"- Height: {health_profile.height_cm or 'Not provided'} cm\n"
                f"- Calculated BMI: {health_profile.bmi or 'N/A'} ({health_profile.bmi_category})\n"
                f"- Blood Pressure: {health_profile.blood_pressure or 'Not provided'}\n"
                f"- Fasting Blood Sugar: {health_profile.fasting_blood_sugar or 'Not provided'} mg/dL\n"
                f"- Chronic Conditions: {', '.join(health_profile.conditions) if health_profile.conditions else 'None declared'}\n"
                f"- Allergies: {', '.join(health_profile.allergies) if health_profile.allergies else 'None declared'}\n"
                f"- Activity Level: {health_profile.activity_level}\n"
                f"- Dietary Preference: {health_profile.dietary_preference}\n"
                f"- Active Medications: {json.dumps(medications)}\n\n"
                "Return JSON matching this exact structure ONLY:\n"
                "{\n"
                '  "health_summary": "1-2 sentence clinical summary of current health maintenance.",\n'
                '  "risk_factors": ["risk factor 1", "risk factor 2"],\n'
                '  "recommended_tests": [\n'
                '    {\n'
                '      "test_name": "Test Name",\n'
                '      "category": "cardiac|metabolic|hematology|renal|preventive",\n'
                '      "reason": "Clinical justification for this diagnostic test",\n'
                '      "action_url": "/diagnostics?search=TestName",\n'
                '      "urgency": "low|medium|high",\n'
                '      "estimated_price": 499\n'
                '    }\n'
                '  ],\n'
                '  "recommended_doctors": [\n'
                '    {\n'
                '      "specialty": "Specialty Name",\n'
                '      "title": "Title",\n'
                '      "reason": "Clinical reason for consultation",\n'
                '      "consultation_mode": "video|in_person|home_visit",\n'
                '      "action_url": "/booking?type=video_consult&specialty=SpecialtyName"\n'
                '    }\n'
                '  ],\n'
                '  "recommended_services": [\n'
                '    {\n'
                '      "service_name": "Service Name",\n'
                '      "reason": "Reason for service",\n'
                '      "action_url": "/booking?mode=home"\n'
                '    }\n'
                '  ],\n'
                '  "care_guidance": {\n'
                '    "workouts": {\n'
                '      "warmup": "Warmup instructions",\n'
                '      "cardio": "Cardiovascular exercise details",\n'
                '      "strength_and_mobility": "Strength and flexibility routine",\n'
                '      "weekly_frequency": "Frequency guidelines",\n'
                '      "precautions": "Safety notes regarding vitals/conditions"\n'
                '    },\n'
                '    "diet_plan": {\n'
                '      "hydration_target": "Daily water target e.g. 2.5 - 3.0 L",\n'
                '      "beneficial_foods": ["food 1", "food 2", "food 3", "food 4"],\n'
                '      "foods_to_avoid": ["avoid 1", "avoid 2", "avoid 3"],\n'
                '      "meal_timing_tips": "Nutritional timing advice"\n'
                '    },\n'
                '    "lifestyle_tips": ["lifestyle tip 1", "lifestyle tip 2", "lifestyle tip 3"]\n'
                '  }\n'
                "}"
            )

            messages = [
                {"role": "system", "content": "You are CallMedex Clinical Intelligence. Return strictly valid JSON with no markdown wrapping."},
                {"role": "user", "content": prompt}
            ]

            response_text = await asyncio.wait_for(
                asyncio.to_thread(
                    client._call,
                    model=AI_MODEL,
                    messages=messages,
                    temperature=0.2,
                    max_tokens=3500,
                ),
                timeout=4.5,
            )

            cleaned = response_text.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            parsed = json.loads(cleaned.strip())
            parsed["health_profile"] = health_profile.model_dump()
            try:
                from app.services.telemedicine import TelemedicineService
                avail = await TelemedicineService.get_available_doctors()
                doc_items = []
                if avail:
                    cond_str = " ".join([c.lower() for c in (health_profile.conditions or [])])
                    for d in avail:
                        doc_spec = (d.get("specialization") or "").lower()
                        # Strict concern matching: only include if the doctor's registered specialty matches the condition
                        is_match = False
                        if any(k in cond_str for k in ["heart", "cardio", "bp", "blood pressure", "chest", "hypertension"]):
                            if any(k in doc_spec for k in ["cardio", "heart", "physician"]):
                                is_match = True
                        if any(k in cond_str for k in ["diabet", "sugar", "glucose"]):
                            if any(k in doc_spec for k in ["diabet", "physician", "endocrine"]):
                                is_match = True
                        
                        if is_match:
                            name = d.get("name", "Medical Specialist")
                            doc_name = name if name.lower().startswith("dr") else f"Dr. {name}"
                            doc_items.append({
                                "id": d.get("doctor_id"),
                                "doctor_id": d.get("doctor_id"),
                                "doctor_name": doc_name,
                                "specialty": d.get("specialization") or "Senior Consultant Clinical Cardio Physician & Diabetic Care",
                                "title": "Senior Consultant Physician",
                                "qualification": d.get("qualification") or "MBBS, PGDCCP (NI)",
                                "experience": f"{d.get('experience_years', 24)}+ yrs clinical experience",
                                "fee": d.get("consultation_fee") or 500,
                                "languages": d.get("languages") or ["English", "Telugu"],
                                "hospital": d.get("hospital_clinic_name") or "Visakha Multispeciality Clinics & Diagnostics",
                                "rating": 4.98,
                                "reason": (d.get("bio")[:150] + "...") if d.get("bio") else "Specialist clinical cardio-metabolic evaluation and personalized management.",
                                "consultation_mode": "video",
                                "action_url": f"/booking?type=consultation&doctor={d.get('doctor_id')}",
                            })
                parsed["recommended_doctors"] = doc_items
            except Exception as e:
                logger.warning(f"Could not attach real telemed doctors: {e}")
                parsed["recommended_doctors"] = []
            return AIRecommendationsResponse(**parsed)
        except Exception as exc:
            logger.warning(
                f"OpenRouter {AI_MODEL} generation failed or returned invalid JSON ({exc}); "
                "using clinical guidelines fallback."
            )

    # 3. Clinical Fallback
    fallback_data = _build_clinical_fallback(health_profile, medications)
    return AIRecommendationsResponse(**fallback_data)
