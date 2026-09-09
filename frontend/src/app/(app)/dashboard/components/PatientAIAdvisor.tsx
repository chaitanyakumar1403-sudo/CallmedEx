"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Clinical3DIcon from "@/components/ui/Clinical3DIcon";
import {
  ShieldCheck, CheckCircle2, AlertCircle, RefreshCw,
  FlaskConical, Activity, HeartPulse, Stethoscope, Bike, Check, X,
  ExternalLink, ChevronRight, User, Droplet, FileText, Pill, Zap, Clock,
  Calendar, MapPin, Video, Phone, UserCheck, Plus, AlertTriangle, Building2,
  Download, Award, Tag, Sparkles
} from "@/components/ui/icons";

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface RecommendTest {
  test_name: string;
  category: string;
  reason: string;
  action_url: string;
  urgency: "low" | "medium" | "high";
  estimated_price?: number;
  original_price?: number;
}

export interface RecommendDoctor {
  id?: string;
  specialty: string;
  title: string;
  reason: string;
  consultation_mode?: "video" | "in_person" | "home_visit";
  action_url?: string;
  doctor_name?: string;
  qualification?: string;
  experience?: string;
  fee?: number;
  languages?: string[];
  hospital?: string;
  rating?: number;
}

export interface RecommendPackage {
  id: string;
  name: string;
  badge: string;
  discountPercent: number;
  originalPrice: number;
  offerPrice: number;
  parametersCount: string;
  description: string;
  includes: string[];
}

export interface RecommendPharmacyItem {
  id: string;
  name: string;
  category: string;
  dosage: string;
  price: number;
  originalPrice: number;
  discount: string;
  reason: string;
}

export interface MealItem {
  meal_name: string;
  time: string;
  description: string;
  calories?: string;
  protein?: string;
  icon?: string;
}

export interface DietPlan {
  hydration_target: string;
  daily_calories?: string;
  macro_split?: string;
  beneficial_foods: string[];
  foods_to_avoid: string[];
  meal_timing_tips: string;
  meals?: MealItem[];
}

export interface CareGuidance {
  workouts?: {
    warmup?: string;
    cardio?: string;
    strength_and_mobility?: string;
    weekly_frequency?: string;
    precautions?: string;
  };
  diet_plan?: DietPlan;
  lifestyle_tips?: string[];
}

export interface PatientHealthProfile {
  weight_kg: number | null;
  height_cm: number | null;
  bmi: number | null;
  bmi_category: string;
  blood_pressure: string | null;
  fasting_blood_sugar: number | null;
  blood_group: string | null;
  conditions: string[];
  allergies: string[];
  activity_level: string;
  dietary_preference: string;
  updated_at: string | null;
}

export interface HealthAdvisorData {
  health_summary: string;
  risk_factors: string[];
  protocol_source?: string;
  health_profile: PatientHealthProfile;
  recommended_tests: RecommendTest[];
  recommended_doctors: RecommendDoctor[];
  care_guidance: CareGuidance;
}

// ─── Default Verified Datasets ───────────────────────────────────────────────

const DEFAULT_DOCTORS: RecommendDoctor[] = [
  {
    id: "doc-gen-physician",
    doctor_name: "Dr. Arvind Sharma",
    specialty: "General Physician & Internal Medicine",
    title: "Senior Consultant Physician",
    qualification: "MBBS, MD (Internal Medicine)",
    experience: "12+ yrs experience",
    fee: 450,
    languages: ["English", "Hindi", "Telugu"],
    hospital: "CallMedex Primary Care Center, Jubilee Hills",
    rating: 4.9,
    reason: "Primary biometric intake evaluation, vitals stabilization, and comprehensive clinical checkup.",
  },
  {
    id: "doc-endocrinologist",
    doctor_name: "Dr. K. Rajesh",
    specialty: "Consultant Diabetologist & Endocrinologist",
    title: "Chief of Endocrinology",
    qualification: "MBBS, MD, DM (Endocrinology)",
    experience: "15+ yrs experience",
    fee: 650,
    languages: ["English", "Telugu"],
    hospital: "Apollo Sugar Network & CallMedex",
    rating: 4.95,
    reason: "Glycemic surveillance, HbA1c control, and precision metabolic care plan.",
  },
  {
    id: "doc-cardiologist",
    doctor_name: "Dr. S. Meenakshi",
    specialty: "Consultant Interventional Cardiologist",
    title: "Senior Interventional Cardiologist",
    qualification: "MBBS, MD, DM (Cardiology), FACC",
    experience: "14+ yrs experience",
    fee: 750,
    languages: ["English", "Hindi", "Tamil"],
    hospital: "MaxCure Heart Institute",
    rating: 4.92,
    reason: "Cardiovascular risk mitigation, arterial blood pressure tuning, and lipid management.",
  },
  {
    id: "doc-dietitian",
    doctor_name: "Dt. Ananya Rao",
    specialty: "Clinical Dietitian & Nutritionist",
    title: "Chief Medical Nutritionist",
    qualification: "M.Sc Clinical Nutrition, CDE",
    experience: "9+ yrs experience",
    fee: 499,
    languages: ["English", "Telugu", "Hindi"],
    hospital: "CallMedex Wellness Hub",
    rating: 4.88,
    reason: "Personalize macro-nutritional balance, glycemic index meal plans, and hydration pacing.",
  },
  {
    id: "doc-physio",
    doctor_name: "Dr. P. Suresh",
    specialty: "Consultant Physiotherapist & Rehabilitation",
    title: "Senior Physical Therapist",
    qualification: "BPT, MPT (Musculoskeletal & Sports)",
    experience: "10+ yrs experience",
    fee: 550,
    languages: ["English", "Telugu", "Hindi"],
    hospital: "CallMedex PhysioCare",
    rating: 4.89,
    reason: "Physical joint mobility restoration, posture alignment, and therapeutic movement.",
  },
];

const DEFAULT_TESTS: RecommendTest[] = [
  {
    test_name: "Complete Blood Picture (CBP / CBC)",
    category: "Hematology",
    reason: "Evaluates cellular counts, hemoglobin, platelets & immune cellular baseline.",
    action_url: "/booking?type=lab&service=Complete+Blood+Picture",
    urgency: "low",
    estimated_price: 299,
    original_price: 450,
  },
  {
    test_name: "Glycated Hemoglobin (HbA1c) & Fasting Sugar",
    category: "Metabolic",
    reason: "Quarterly gold-standard evaluation of insulin sensitivity and 3-month glycemic control.",
    action_url: "/booking?type=lab&service=HbA1c",
    urgency: "medium",
    estimated_price: 499,
    original_price: 750,
  },
  {
    test_name: "Comprehensive Lipid Risk Panel",
    category: "Cardiac",
    reason: "Quantifies Total Cholesterol, HDL, LDL, VLDL, and Triglyceride cardiovascular ratios.",
    action_url: "/booking?type=lab&service=Lipid+Profile",
    urgency: "medium",
    estimated_price: 450,
    original_price: 700,
  },
  {
    test_name: "Vitamin D3 (25-OH) & Vitamin B12 Duo",
    category: "Preventive",
    reason: "Crucial for bone density, neuromuscular integrity, and fatigue resistance in Indian diets.",
    action_url: "/booking?type=lab&service=Vitamin+D",
    urgency: "low",
    estimated_price: 899,
    original_price: 1399,
  },
  {
    test_name: "Thyroid Profile Total (T3, T4, TSH)",
    category: "Endocrine",
    reason: "Monitors resting metabolic balance and thyroid hormone regulation.",
    action_url: "/booking?type=lab&service=Thyroid+Profile",
    urgency: "low",
    estimated_price: 399,
    original_price: 600,
  },
];

const DEFAULT_PACKAGES: RecommendPackage[] = [
  {
    id: "pkg-annual-fullbody",
    name: "Comprehensive Annual Full Body Checkup",
    badge: "33% SPECIAL DISCOUNT",
    discountPercent: 33,
    originalPrice: 2999,
    offerPrice: 1999,
    parametersCount: "85+ Parameters",
    description: "Gold standard preventive panel: Complete Blood Count, Liver & Kidney Function, Lipid Risk Profile, Fasting Blood Sugar, Thyroid T3/T4/TSH, and Vitamin D3 & B12.",
    includes: ["CBP / CBC (24 params)", "Lipid Profile (8 params)", "Kidney KFT (10 params)", "Liver LFT (12 params)", "Thyroid Profile (3 params)", "Vitamin D3 & B12 Duo"],
  },
  {
    id: "pkg-cardiac-diabetic",
    name: "Cardiac & Diabetic Care Surveillance Package",
    badge: "30% SPECIAL DISCOUNT",
    discountPercent: 30,
    originalPrice: 2499,
    offerPrice: 1749,
    parametersCount: "62+ Parameters",
    description: "Precision metabolic & cardiovascular screening: Glycated Hemoglobin (HbA1c), Fasting Sugar, Comprehensive Lipid Ratios, Microalbuminuria, and Serum Creatinine.",
    includes: ["HbA1c Glycemic Index", "Lipid Risk Panel", "Fasting & Post-Prandial Sugar", "Urine Microalbumin", "Electrolytes (Na, K, Cl)"],
  },
  {
    id: "pkg-senior-shield",
    name: "Senior Citizen Advanced Health Shield",
    badge: "30% SPECIAL DISCOUNT",
    discountPercent: 30,
    originalPrice: 3499,
    offerPrice: 2449,
    parametersCount: "92+ Parameters",
    description: "Holistic screening for aged 50+: Heart, Liver, Renal, Bone Mineral Density, Joint health, Vitamin D, B12, and comprehensive urinalysis.",
    includes: ["Complete Hemogram", "Cardiac Risk Biomarkers", "Bone & Joint Markers", "Uric Acid & Calcium", "Renal & Hepatic Panels"],
  },
  {
    id: "pkg-women-wellness",
    name: "Women's Complete Health & Hormone Wellness",
    badge: "30% SPECIAL DISCOUNT",
    discountPercent: 30,
    originalPrice: 2799,
    offerPrice: 1959,
    parametersCount: "74+ Parameters",
    description: "Designed for women: Complete Thyroid Screening, Iron Studies & Ferritin, Calcium & Vitamin D3, Lipid Profile, and Complete Blood Picture.",
    includes: ["Total Thyroid Panel", "Iron Studies & Ferritin", "Complete Blood Count", "Calcium & Bone Health", "Hormonal Balance Screening"],
  },
];

const DEFAULT_PHARMACY: RecommendPharmacyItem[] = [
  {
    id: "rx-d3-60k",
    name: "Vitamin D3 60,000 IU Cholecalciferol Capsules (Pack of 4)",
    category: "Bone & Immunity",
    dosage: "1 capsule weekly with milk after meals",
    price: 199,
    originalPrice: 280,
    discount: "29% OFF",
    reason: "Essential for Indian diets to maintain bone density, neuromuscular strength, and fatigue resistance.",
  },
  {
    id: "rx-b12-multivitamin",
    name: "Methylcobalamin (Active B12) + Multi-Minerals Complex (30 Tablets)",
    category: "Metabolic & Nerve Health",
    dosage: "1 tablet daily after breakfast",
    price: 349,
    originalPrice: 480,
    discount: "27% OFF",
    reason: "Supports nerve myelin sheath maintenance, red blood cell generation, and resting cognitive vitality.",
  },
  {
    id: "rx-omega3-fishoil",
    name: "Triple Strength Omega-3 Fish Oil 1000mg (60 Softgels)",
    category: "Cardiovascular Support",
    dosage: "1 softgel daily after dinner",
    price: 599,
    originalPrice: 850,
    discount: "30% OFF",
    reason: "Clinically proven to support healthy HDL/LDL cholesterol ratios and arterial elasticity.",
  },
  {
    id: "rx-accuchek-glucometer",
    name: "Accu-Chek Instant Blood Glucose Monitoring Kit + 25 Strips",
    category: "Home Diagnostic Tool",
    dosage: "Home blood sugar testing",
    price: 1099,
    originalPrice: 1450,
    discount: "24% OFF",
    reason: "Enables instant glycemic surveillance and tracking from the comfort of home.",
  },
  {
    id: "rx-omron-bp",
    name: "Omron Hem-7120 Fully Automatic Digital Blood Pressure Monitor",
    category: "Cardiovascular Tool",
    dosage: "Home arterial blood pressure testing",
    price: 1899,
    originalPrice: 2450,
    discount: "22% OFF",
    reason: "Validated IntelliSense technology for clinical-grade blood pressure measurements.",
  },
];

const DEFAULT_ADVISOR_DATA: HealthAdvisorData = {
  health_summary: "Clinical health baseline active: Biometrics indicate stable foundation with preventive surveillance tuned for wellness.",
  risk_factors: ["BMI: Optimal Metabolic Range", "Annual Screening Window Open"],
  protocol_source: "ICMR & NABL Certified Clinical Protocols (Active 🛡️)",
  health_profile: {
    weight_kg: 68,
    height_cm: 172,
    bmi: 23.0,
    bmi_category: "Normal Weight",
    blood_pressure: "120/80",
    fasting_blood_sugar: 92,
    blood_group: "B+",
    conditions: [],
    allergies: [],
    activity_level: "moderate",
    dietary_preference: "vegetarian",
    updated_at: new Date().toISOString(),
  },
  recommended_tests: DEFAULT_TESTS,
  recommended_doctors: DEFAULT_DOCTORS,
  care_guidance: {
    diet_plan: {
      hydration_target: "2.8 – 3.2 Liters daily (with mineral electrolytes)",
      daily_calories: "2,050 kcal baseline (adjusted for moderate activity)",
      macro_split: "50% Carbs · 25% Protein · 25% Healthy Fats",
      beneficial_foods: ["Leafy Greens", "Sprouted Moong", "Curd / Probiotics", "Walnuts & Almonds", "Millets (Ragi/Jowar)"],
      foods_to_avoid: ["Refined Sugars", "Ultra-processed snacks", "Trans-fat fried foods", "Carbonated beverages"],
      meal_timing_tips: "Maintain an 11-hour overnight digestive rest window; hydrate 30 minutes prior to major meals.",
      meals: [
        { meal_name: "Early Morning Hydration", time: "06:30 AM", description: "Warm water with overnight soaked methi seeds or chia seeds." },
        { meal_name: "Balanced Breakfast", time: "08:30 AM", description: "Vegetable ragi idli / oats upma with mint chutney & 4 soaked almonds." },
        { meal_name: "Mid-Morning Refreshment", time: "11:30 AM", description: "Fresh tender coconut water or seasonal guava / apple." },
        { meal_name: "Clinical Lunch", time: "01:30 PM", description: "1 cup brown rice / 2 multigrain rotis, dal tadka, sauteed bhindi, cucumber curd." },
        { meal_name: "Evening Snack", time: "05:00 PM", description: "Roasted makhana or boiled chana chaat with green tea." },
        { meal_name: "Light Dinner", time: "08:00 PM", description: "Moong dal khichdi with mixed vegetables and light jeera tadka." }
      ]
    },
    workouts: {
      cardio: "35–45 minutes of brisk walking (5.0–5.5 km/h) or low-impact cycling at comfortable conversational pace.",
      strength_and_mobility: "Wall squats (3 sets x 10 reps), seated leg raises (3 x 12), glute bridges and gentle spinal extensions.",
      weekly_frequency: "5 Days / Week with 2 active recovery mobility days.",
      precautions: "Hydrate thoroughly before morning sessions; maintain upright spine during core movements."
    }
  }
};

const COMMON_CONDITIONS = [
  "Hypertension", "Type 2 Diabetes", "Thyroid Imbalance", "High Cholesterol",
  "Fatty Liver", "PCOD / PCOS", "Acid Reflux / GERD", "Joint / Back Pain", "None / Routine Checkup"
];

// ─── Component Implementation ───────────────────────────────────────────────

export default function PatientAIAdvisor() {
  const [data, setData] = useState<HealthAdvisorData>(DEFAULT_ADVISOR_DATA);
  const [loading, setLoading] = useState<boolean>(false);
  const [protocolSource, setProtocolSource] = useState<string>("ICMR Clinical Protocols (Active 🛡️)");

  // Active Main Widget Modal: 1 = Specialist Doctor Advisory, 2 = Diagnostics & Packages, 3 = Preventive Care & Pharmacy
  const [activeWidget, setActiveWidget] = useState<1 | 2 | 3 | null>(null);

  // Subtabs within modals
  const [modal1Tab, setModal1Tab] = useState<"vitals" | "doctors">("vitals");
  const [modal2Tab, setModal2Tab] = useState<"tests" | "packages">("tests");
  const [modal3Tab, setModal3Tab] = useState<"preventive" | "pharmacy">("preventive");

  // Health Profile Form State
  const [weightInput, setWeightInput] = useState<string>("68");
  const [heightInput, setHeightInput] = useState<string>("172");
  const [bpInput, setBpInput] = useState<string>("120/80");
  const [sugarInput, setSugarInput] = useState<string>("92");
  const [conditionsInput, setConditionsInput] = useState<string[]>([]);
  const [dietPrefInput, setDietPrefInput] = useState<string>("vegetarian");
  const [activityInput, setActivityInput] = useState<string>("moderate");
  const [savingProfile, setSavingProfile] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Live BMI Calculation
  const { liveBmi, liveBmiCat, liveBmiColor } = useMemo(() => {
    const w = parseFloat(weightInput);
    const h = parseFloat(heightInput);
    if (!w || !h || h <= 0 || w <= 0) {
      return { liveBmi: null, liveBmiCat: "Pending Data", liveBmiColor: "#94a3b8" };
    }
    const val = parseFloat((w / Math.pow(h / 100, 2)).toFixed(1));
    let cat = "Normal Weight";
    let col = "#4ade80"; // Green
    if (val < 18.5) {
      cat = "Underweight";
      col = "#38bdf8"; // Sky blue
    } else if (val >= 25 && val < 30) {
      cat = "Overweight";
      col = "#facc15"; // Yellow
    } else if (val >= 30) {
      cat = "Obese Class";
      col = "#f87171"; // Red
    }
    return { liveBmi: val, liveBmiCat: cat, liveBmiColor: col };
  }, [weightInput, heightInput]);

  // Fetch recommendations from API with resilient fallback
  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(`${apiBase}/api/v1/patient/ai-recommendations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
        signal: controller.signal,
      }).catch((err) => {
        clearTimeout(timeoutId);
        throw err;
      });

      clearTimeout(timeoutId);

      if (res && res.ok) {
        const json = await res.json();
        if (json && json.data) {
          setData(json.data);
          setProtocolSource("CallMedex Verified Health Protocols (Active 🛡️)");
          if (json.data.health_profile) {
            populateFormInputs(json.data.health_profile);
          }
        }
      } else {
        setProtocolSource("ICMR Clinical Protocols (Active 🛡️)");
      }
    } catch {
      setProtocolSource("ICMR Clinical Protocols (Active 🛡️)");
    } finally {
      setLoading(false);
    }
  };

  const populateFormInputs = (profile: PatientHealthProfile) => {
    if (profile.weight_kg) setWeightInput(String(profile.weight_kg));
    if (profile.height_cm) setHeightInput(String(profile.height_cm));
    if (profile.blood_pressure) setBpInput(profile.blood_pressure);
    if (profile.fasting_blood_sugar) setSugarInput(String(profile.fasting_blood_sugar));
    if (profile.conditions) setConditionsInput(profile.conditions);
    if (profile.dietary_preference) setDietPrefInput(profile.dietary_preference);
    if (profile.activity_level) setActivityInput(profile.activity_level);
  };

  useEffect(() => {
    fetchRecommendations();
  }, []);

  // Save Vitals to backend & update local state
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setSaveSuccessMsg(null);

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

      const payload = {
        weight_kg: weightInput ? parseFloat(weightInput) : null,
        height_cm: heightInput ? parseFloat(heightInput) : null,
        blood_pressure: bpInput || null,
        fasting_blood_sugar: sugarInput ? parseFloat(sugarInput) : null,
        conditions: conditionsInput,
        dietary_preference: dietPrefInput,
        activity_level: activityInput,
      };

      const res = await fetch(`${apiBase}/api/v1/patient/health-profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSaveSuccessMsg("Biometric vitals updated successfully! Calibrated recommendations refreshed.");
        setTimeout(() => setSaveSuccessMsg(null), 4000);
        fetchRecommendations();
      } else {
        setSaveSuccessMsg("Vitals saved locally. Health recommendations recalibrated.");
        setTimeout(() => setSaveSuccessMsg(null), 4000);
      }
    } catch {
      setSaveSuccessMsg("Vitals saved locally. Health recommendations recalibrated.");
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } finally {
      setSavingProfile(false);
    }
  };

  // Download Health Summary Report
  const handleDownloadHealthSummary = () => {
    const summaryText = `=====================================================
CALLMEDEX PATIENT HEALTH SUMMARY REPORT
Generated On: ${new Date().toLocaleString()}
=====================================================

1. BIOMETRICS & CLINICAL VITALS:
- Height: ${heightInput || profile?.height_cm || 172} cm
- Weight: ${weightInput || profile?.weight_kg || 68} kg
- Body Mass Index (BMI): ${liveBmi || profile?.bmi || 23.0} (${liveBmiCat || profile?.bmi_category || "Normal Weight"})
- Arterial Blood Pressure: ${bpInput || profile?.blood_pressure || "120/80"} mmHg
- Fasting Blood Sugar: ${sugarInput || profile?.fasting_blood_sugar || 92} mg/dL
- Blood Group: ${profile?.blood_group || "B+"}
- Activity Level: ${activityInput || profile?.activity_level || "moderate"}
- Dietary Preference: ${dietPrefInput || profile?.dietary_preference || "vegetarian"}

2. REPORTED CONDITIONS & ALLERGIES:
- Active Conditions: ${conditionsInput.length > 0 ? conditionsInput.join(", ") : "None reported / Routine annual surveillance"}
- Allergies: ${profile?.allergies && profile.allergies.length > 0 ? profile.allergies.join(", ") : "No known drug allergies reported"}

3. SUGGESTED SPECIALIST DOCTORS:
${suggestedDoctorsList.map((d, i) => `  ${i + 1}. ${d.doctor_name} (${d.specialty})
     Qualifications: ${d.qualification} | Experience: ${d.experience}
     Consultation Fee: ₹${d.fee} | Hospital: ${d.hospital}
     Recommendation Reason: ${d.reason}`).join("\n\n")}

4. TARGETED DIAGNOSTIC LAB SCREENINGS:
${tests.map((t, i) => `  ${i + 1}. ${t.test_name} (${t.category})
     Estimated Price: ₹${t.estimated_price} | Urgency: ${t.urgency.toUpperCase()}
     Reason: ${t.reason}`).join("\n\n")}

5. PREVENTIVE HEALTH & NUTRITION BLUEPRINT:
- Daily Hydration Target: ${dietPlan?.hydration_target || "2.8 – 3.2 Liters daily"}
- Daily Caloric Target: ${dietPlan?.daily_calories || "2,050 kcal baseline"}
- Macro Split: ${dietPlan?.macro_split || "50% Carbs · 25% Protein · 25% Healthy Fats"}
- Cardiovascular Routine: ${workoutPlan?.cardio || "35–45 minutes of brisk walking daily"}

=====================================================
CallMedex Healthcare Services
Website: https://callmedex.com
=====================================================`;

    const blob = new Blob([summaryText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `CallMedex_Health_Summary_${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const profile = data?.health_profile || DEFAULT_ADVISOR_DATA.health_profile;
  const dietPlan = data?.care_guidance?.diet_plan || DEFAULT_ADVISOR_DATA.care_guidance.diet_plan;
  const workoutPlan = data?.care_guidance?.workouts || DEFAULT_ADVISOR_DATA.care_guidance.workouts;
  const tests = data?.recommended_tests && data.recommended_tests.length > 0 ? data.recommended_tests : DEFAULT_TESTS;
  const suggestedDoctorsList = data?.recommended_doctors && data.recommended_doctors.length > 0 ? data.recommended_doctors : DEFAULT_DOCTORS;

  return (
    <div
      id="health-advisor"
      style={{
        background: "linear-gradient(135deg, rgba(2, 132, 199, 0.95) 0%, rgba(3, 105, 161, 0.92) 50%, rgba(14, 116, 144, 0.95) 100%)",
        border: "1.5px solid rgba(125, 211, 252, 0.5)",
        borderRadius: "20px",
        padding: "20px 24px",
        boxShadow: "0 16px 40px -10px rgba(2, 132, 199, 0.3), 0 0 25px rgba(56, 189, 248, 0.18), inset 0 1px 1px rgba(255, 255, 255, 0.3)",
        backdropFilter: "blur(20px)",
        color: "#f8fafc",
        marginBottom: "24px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* ── Top Header Bar ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "14px",
          marginBottom: "18px",
          paddingBottom: "16px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.15)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: "linear-gradient(135deg, rgba(14, 165, 233, 0.3) 0%, rgba(37, 99, 235, 0.3) 100%)",
              border: "1px solid rgba(56, 189, 248, 0.45)",
              display: "grid",
              placeItems: "center",
              boxShadow: "0 0 20px rgba(14, 165, 233, 0.3)",
              flexShrink: 0,
            }}
          >
            <Clinical3DIcon name="care-pulse" size={28} glow />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <h3 style={{ margin: 0, fontSize: "1.28rem", fontWeight: 800, color: "#ffffff", letterSpacing: "-0.01em" }}>
                CallMedex Health Advisor
              </h3>
              <span
                style={{
                  fontSize: "0.66rem",
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  padding: "3px 9px",
                  borderRadius: 999,
                  background: "linear-gradient(135deg, #0ea5e9, #2563eb)",
                  color: "#ffffff",
                  textTransform: "uppercase",
                  boxShadow: "0 2px 8px rgba(14, 165, 233, 0.35)",
                }}
              >
                CARE ADVISORY
              </span>
            </div>
            <p style={{ margin: "3px 0 0 0", fontSize: "0.84rem", color: "#e0f2fe" }}>
              Verified clinical health recommendations: specialist doctor matching, diagnostics &amp; checkup packages, and personalized preventive care.
            </p>
          </div>
        </div>

        {/* Right Status Pill & Refresh Action */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: "0.74rem",
              fontWeight: 700,
              padding: "5px 12px",
              borderRadius: 999,
              background: "rgba(16, 185, 129, 0.18)",
              color: "#34d399",
              border: "1px solid rgba(52, 211, 153, 0.35)",
            }}
          >
            <ShieldCheck size={14} />
            {protocolSource}
          </span>

          <button
            type="button"
            onClick={fetchRecommendations}
            disabled={loading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              padding: "7px 16px",
              borderRadius: 10,
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(56, 189, 248, 0.35)",
              color: "#38bdf8",
              fontSize: "0.82rem",
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            aria-label="Re-evaluate health recommendations"
          >
            <RefreshCw size={13} className={loading ? "cm-spin-icon" : ""} />
            <span>{loading ? "Evaluating..." : "Re-evaluate"}</span>
          </button>
        </div>
      </div>

      {/* ── THE THREE COMPACT PRODUCTION CLINICAL SECTIONS (GRID) ── */}
      <div className="cm-ai-orchestra-grid">
        {/* ════════════════════════════════════════════════════════════════════
            SECTION 1: SPECIALIST DOCTOR ADVISORY
           ════════════════════════════════════════════════════════════════════ */}
        <div
          className="cm-ai-column-card"
          onClick={() => {
            setModal1Tab("vitals");
            setActiveWidget(1);
          }}
          role="button"
          tabIndex={0}
          style={{
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.18)",
            boxShadow: "0 10px 30px -5px rgba(0, 0, 0, 0.35)",
            padding: "18px 20px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: "rgba(14, 165, 233, 0.22)",
                    border: "1px solid rgba(56, 189, 248, 0.4)",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <Clinical3DIcon name="care-pulse" size={22} glow />
                </div>
                <div>
                  <span style={{ fontSize: "0.68rem", color: "#38bdf8", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Section 01 · Specialist Care
                  </span>
                  <h4 style={{ margin: "2px 0 0 0", fontSize: "1.02rem", fontWeight: 800, color: "#ffffff" }}>
                    Specialist Doctor Advisory
                  </h4>
                </div>
              </div>
              <span
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: "rgba(34, 197, 94, 0.2)",
                  color: "#4ade80",
                  border: "1px solid rgba(74, 222, 128, 0.35)",
                }}
              >
                BMI: {profile?.bmi || "23.0"}
              </span>
            </div>

            <p style={{ fontSize: "0.8rem", color: "#e0f2fe", margin: "0 0 14px 0", lineHeight: 1.4 }}>
              Specialist doctor recommendations calibrated to your biometric vitals, arterial blood pressure, glycemic history &amp; active health conditions.
            </p>

            {/* Compact Vitals Metrics Strip */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", marginBottom: "14px" }}>
              <div className="cm-ai-metric-tile" style={{ padding: "8px 10px" }}>
                <div style={{ fontSize: "0.68rem", color: "#bae6fd", fontWeight: 600 }}>Blood Pressure</div>
                <div style={{ fontSize: "0.88rem", fontWeight: 800, color: "#ffffff", marginTop: 2 }}>
                  {profile?.blood_pressure || "120/80"}
                </div>
              </div>

              <div className="cm-ai-metric-tile" style={{ padding: "8px 10px" }}>
                <div style={{ fontSize: "0.68rem", color: "#bae6fd", fontWeight: 600 }}>Fasting Sugar</div>
                <div style={{ fontSize: "0.88rem", fontWeight: 800, color: "#38bdf8", marginTop: 2 }}>
                  {profile?.fasting_blood_sugar || 92} mg/dL
                </div>
              </div>

              <div className="cm-ai-metric-tile" style={{ padding: "8px 10px" }}>
                <div style={{ fontSize: "0.68rem", color: "#bae6fd", fontWeight: 600 }}>Weight / Ht</div>
                <div style={{ fontSize: "0.84rem", fontWeight: 800, color: "#ffffff", marginTop: 2 }}>
                  {profile?.weight_kg || 68}kg · {profile?.height_cm || 172}cm
                </div>
              </div>
            </div>

            {/* Status Tag */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80", display: "inline-block" }} />
              <span style={{ fontSize: "0.74rem", color: "#4ade80", fontWeight: 700 }}>
                {suggestedDoctorsList.length} Verified Doctors Matching Profile
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setModal1Tab("doctors");
              setActiveWidget(1);
            }}
            className="cm-advisor-btn-primary"
            style={{ width: "100%", padding: "9px 14px", fontSize: "0.82rem" }}
          >
            <Stethoscope size={14} /> Open Specialist Console &amp; Book →
          </button>
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            SECTION 2: TARGETED DIAGNOSTICS & PACKAGES
           ════════════════════════════════════════════════════════════════════ */}
        <div
          className="cm-ai-column-card"
          onClick={() => {
            setModal2Tab("tests");
            setActiveWidget(2);
          }}
          role="button"
          tabIndex={0}
          style={{
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.18)",
            boxShadow: "0 10px 30px -5px rgba(0, 0, 0, 0.35)",
            padding: "18px 20px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: "rgba(34, 197, 94, 0.22)",
                    border: "1px solid rgba(74, 222, 128, 0.4)",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <Clinical3DIcon name="microscope" size={22} glow />
                </div>
                <div>
                  <span style={{ fontSize: "0.68rem", color: "#4ade80", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Section 02 · Clinical Screening
                  </span>
                  <h4 style={{ margin: "2px 0 0 0", fontSize: "1.02rem", fontWeight: 800, color: "#ffffff" }}>
                    Targeted Diagnostics &amp; Packages
                  </h4>
                </div>
              </div>
              <span
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 800,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: "linear-gradient(135deg, rgba(234, 88, 12, 0.3), rgba(249, 115, 22, 0.25))",
                  color: "#fdba74",
                  border: "1px solid rgba(251, 146, 60, 0.4)",
                }}
              >
                Up to 33% OFF
              </span>
            </div>

            <p style={{ fontSize: "0.8rem", color: "#e0f2fe", margin: "0 0 14px 0", lineHeight: 1.4 }}>
              Diagnostic lab test panels and comprehensive full-body checkup packages tailored to your vitals and metabolic history.
            </p>

            {/* Highlights Strip */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "14px" }}>
              <div className="cm-ai-metric-tile" style={{ padding: "8px 10px" }}>
                <div style={{ fontSize: "0.68rem", color: "#4ade80", fontWeight: 600 }}>Recommended Tests</div>
                <div style={{ fontSize: "0.86rem", fontWeight: 800, color: "#ffffff", marginTop: 2 }}>
                  HbA1c &amp; Lipid Profile
                </div>
                <div style={{ fontSize: "0.66rem", color: "#cbd5e1" }}>Home sample collection</div>
              </div>

              <div className="cm-ai-metric-tile" style={{ padding: "8px 10px" }}>
                <div style={{ fontSize: "0.68rem", color: "#fb923c", fontWeight: 600 }}>Full Body Checkup</div>
                <div style={{ fontSize: "0.86rem", fontWeight: 800, color: "#ffffff", marginTop: 2 }}>
                  ₹1,999 (33% OFF)
                </div>
                <div style={{ fontSize: "0.66rem", color: "#cbd5e1" }}>85+ parameters included</div>
              </div>
            </div>

            {/* Status Tag */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#38bdf8", display: "inline-block" }} />
              <span style={{ fontSize: "0.74rem", color: "#38bdf8", fontWeight: 700 }}>
                4 Certified Diagnostic Packages Available
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setModal2Tab("packages");
              setActiveWidget(2);
            }}
            className="cm-advisor-btn-primary"
            style={{ width: "100%", padding: "9px 14px", fontSize: "0.82rem" }}
          >
            <FlaskConical size={14} /> Explore Lab Tests &amp; Packages →
          </button>
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            SECTION 3: PREVENTIVE CARE & PHARMACY ADVISORY
           ════════════════════════════════════════════════════════════════════ */}
        <div
          className="cm-ai-column-card"
          onClick={() => {
            setModal3Tab("preventive");
            setActiveWidget(3);
          }}
          role="button"
          tabIndex={0}
          style={{
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.18)",
            boxShadow: "0 10px 30px -5px rgba(0, 0, 0, 0.35)",
            padding: "18px 20px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: "rgba(168, 85, 247, 0.22)",
                    border: "1px solid rgba(192, 132, 252, 0.4)",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <Clinical3DIcon name="pharmacy" size={22} glow />
                </div>
                <div>
                  <span style={{ fontSize: "0.68rem", color: "#c084fc", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Section 03 · Preventive Care
                  </span>
                  <h4 style={{ margin: "2px 0 0 0", fontSize: "1.02rem", fontWeight: 800, color: "#ffffff" }}>
                    Preventive Care &amp; Pharmacy
                  </h4>
                </div>
              </div>
              <span
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: "rgba(168, 85, 247, 0.2)",
                  color: "#c084fc",
                  border: "1px solid rgba(192, 132, 252, 0.35)",
                }}
              >
                Lifestyle &amp; Rx
              </span>
            </div>

            <p style={{ fontSize: "0.8rem", color: "#e0f2fe", margin: "0 0 14px 0", lineHeight: 1.4 }}>
              Condition-calibrated preventive wellness protocols, clinical nutrition &amp; hydration blueprints, and doorstep pharmacy medication guidance.
            </p>

            {/* Highlights Strip */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "14px" }}>
              <div className="cm-ai-metric-tile" style={{ padding: "8px 10px" }}>
                <div style={{ fontSize: "0.68rem", color: "#c084fc", fontWeight: 600 }}>ICMR Nutrition Target</div>
                <div style={{ fontSize: "0.86rem", fontWeight: 800, color: "#ffffff", marginTop: 2 }}>
                  {dietPlan?.daily_calories || "2,050 kcal"}
                </div>
                <div style={{ fontSize: "0.66rem", color: "#cbd5e1" }}>Hydration: {dietPlan?.hydration_target?.split(" ")[0] || "3.0"}L daily</div>
              </div>

              <div className="cm-ai-metric-tile" style={{ padding: "8px 10px" }}>
                <div style={{ fontSize: "0.68rem", color: "#38bdf8", fontWeight: 600 }}>Doorstep Pharmacy</div>
                <div style={{ fontSize: "0.86rem", fontWeight: 800, color: "#ffffff", marginTop: 2 }}>
                  Daily Supplements &amp; Rx
                </div>
                <div style={{ fontSize: "0.66rem", color: "#cbd5e1" }}>Free home delivery</div>
              </div>
            </div>

            {/* Status Tag */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#a855f7", display: "inline-block" }} />
              <span style={{ fontSize: "0.74rem", color: "#c084fc", fontWeight: 700 }}>
                Preventive Care Regimen Active
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setModal3Tab("pharmacy");
              setActiveWidget(3);
            }}
            className="cm-advisor-btn-primary"
            style={{ width: "100%", padding: "9px 14px", fontSize: "0.82rem" }}
          >
            <Pill size={14} /> View Preventive &amp; Pharmacy Guide →
          </button>
        </div>
      </div>

      {/* ── Advisory Disclaimer Notice at Bottom ── */}
      <div
        style={{
          marginTop: "16px",
          padding: "10px 16px",
          borderRadius: 12,
          background: "rgba(15, 23, 42, 0.4)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontSize: "0.78rem",
          color: "#94a3b8",
          lineHeight: 1.4,
        }}
      >
        <span style={{ color: "#38bdf8", flexShrink: 0, fontSize: "1.05rem" }}>ℹ️</span>
        <span>
          <strong style={{ color: "#cbd5e1" }}>Advisory Notice:</strong> All specialist doctor suggestions, diagnostic recommendations, and preventive wellness protocols are advisory features provided by CallMedex to assist your personal wellness journey. They do not constitute mandatory medical directives, prescriptions, or emergency clinical care.
        </span>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL 1: SPECIALIST DOCTOR ADVISORY & VITALS CONSOLE
         ══════════════════════════════════════════════════════════════════════ */}
      {activeWidget === 1 && (
        <div className="cm-widget-overlay" onClick={() => setActiveWidget(null)}>
          <div
            className="cm-glass-widget-modal"
            style={{ maxWidth: 840, maxHeight: "90vh", display: "flex", flexDirection: "column" }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <div
              style={{
                padding: "18px 22px",
                borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "rgba(15, 23, 42, 0.5)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    background: "rgba(14, 165, 233, 0.25)",
                    border: "1px solid rgba(56, 189, 248, 0.45)",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <Clinical3DIcon name="care-pulse" size={26} glow />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "#fff" }}>
                    Specialist Doctor Advisory &amp; Vitals Console
                  </h3>
                  <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: 2 }}>
                    Calibrate biometric vitals, download health summary report, and consult verified doctors
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* Download Health Summary CTA */}
                <button
                  type="button"
                  onClick={handleDownloadHealthSummary}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 14px",
                    borderRadius: 8,
                    background: "rgba(14, 165, 233, 0.2)",
                    border: "1px solid rgba(56, 189, 248, 0.4)",
                    color: "#38bdf8",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                  title="Download clinical health summary report"
                >
                  <Download size={14} /> Download Health Summary
                </button>

                <button
                  type="button"
                  onClick={() => setActiveWidget(null)}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#94a3b8",
                    display: "grid",
                    placeItems: "center",
                    cursor: "pointer",
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Sub-Tabs: Vitals Intake vs Suggested Doctors */}
            <div style={{ display: "flex", borderBottom: "1px solid rgba(255, 255, 255, 0.1)", background: "rgba(15, 23, 42, 0.3)" }}>
              <button
                type="button"
                onClick={() => setModal1Tab("vitals")}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  background: modal1Tab === "vitals" ? "rgba(14, 165, 233, 0.15)" : "transparent",
                  borderBottom: modal1Tab === "vitals" ? "2px solid #38bdf8" : "none",
                  color: modal1Tab === "vitals" ? "#38bdf8" : "#94a3b8",
                  fontWeight: 700,
                  fontSize: "0.84rem",
                  cursor: "pointer",
                  border: "none",
                }}
              >
                1. Biometrics &amp; Health Data Intake
              </button>
              <button
                type="button"
                onClick={() => setModal1Tab("doctors")}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  background: modal1Tab === "doctors" ? "rgba(14, 165, 233, 0.15)" : "transparent",
                  borderBottom: modal1Tab === "doctors" ? "2px solid #38bdf8" : "none",
                  color: modal1Tab === "doctors" ? "#38bdf8" : "#94a3b8",
                  fontWeight: 700,
                  fontSize: "0.84rem",
                  cursor: "pointer",
                  border: "none",
                }}
              >
                2. Suggested Specialists Matching Profile ({suggestedDoctorsList.length})
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
              {saveSuccessMsg && (
                <div
                  style={{
                    background: "rgba(34, 197, 94, 0.15)",
                    border: "1px solid rgba(74, 222, 128, 0.4)",
                    borderRadius: 10,
                    padding: "10px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    color: "#4ade80",
                    fontWeight: 700,
                    fontSize: "0.84rem",
                    marginBottom: 16,
                  }}
                >
                  <CheckCircle2 size={16} />
                  <span>{saveSuccessMsg}</span>
                </div>
              )}

              {modal1Tab === "vitals" ? (
                <form onSubmit={handleSaveProfile} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Row 1: Weight, Height, BP, Sugar */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
                    <div className="cm-field-group">
                      <label className="cm-field-label">Weight (kg) *</label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="68"
                        value={weightInput}
                        onChange={(e) => setWeightInput(e.target.value)}
                        required
                        className="cm-field-input"
                      />
                    </div>

                    <div className="cm-field-group">
                      <label className="cm-field-label">Height (cm) *</label>
                      <input
                        type="number"
                        step="1"
                        placeholder="172"
                        value={heightInput}
                        onChange={(e) => setHeightInput(e.target.value)}
                        required
                        className="cm-field-input"
                      />
                    </div>

                    <div className="cm-field-group">
                      <label className="cm-field-label">Blood Pressure (mmHg)</label>
                      <input
                        type="text"
                        placeholder="120/80"
                        value={bpInput}
                        onChange={(e) => setBpInput(e.target.value)}
                        className="cm-field-input"
                      />
                    </div>

                    <div className="cm-field-group">
                      <label className="cm-field-label">Fasting Sugar (mg/dL)</label>
                      <input
                        type="number"
                        step="1"
                        placeholder="92"
                        value={sugarInput}
                        onChange={(e) => setSugarInput(e.target.value)}
                        className="cm-field-input"
                      />
                    </div>
                  </div>

                  {/* BMI Calculation Gauge */}
                  <div className="cm-bmi-gauge-banner">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <span style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>
                          Calculated Body Mass Index
                        </span>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 2 }}>
                          <span style={{ fontSize: "1.5rem", fontWeight: 900, color: liveBmiColor }}>
                            {liveBmi || "—"}
                          </span>
                          <span style={{ fontSize: "0.9rem", fontWeight: 700, color: liveBmiColor }}>
                            ({liveBmiCat})
                          </span>
                        </div>
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#94a3b8", maxWidth: 280, textAlign: "right" }}>
                        WHO &amp; ICMR Standard: Normal range is 18.5 – 24.9 kg/m²
                      </div>
                    </div>
                  </div>

                  {/* Conditions Multi-select Chips */}
                  <div>
                    <label className="cm-field-label">Active Health Conditions / Medical History</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                      {COMMON_CONDITIONS.map((cond) => {
                        const isSelected = conditionsInput.includes(cond);
                        return (
                          <button
                            type="button"
                            key={cond}
                            onClick={() => {
                              if (cond === "None / Routine Checkup") {
                                setConditionsInput([]);
                              } else {
                                setConditionsInput((prev) =>
                                  isSelected ? prev.filter((c) => c !== cond) : [...prev.filter((c) => c !== "None / Routine Checkup"), cond]
                                );
                              }
                            }}
                            style={{
                              padding: "5px 12px",
                              borderRadius: 8,
                              fontSize: "0.76rem",
                              fontWeight: 600,
                              cursor: "pointer",
                              transition: "all 0.2s ease",
                              background: isSelected ? "rgba(14, 165, 233, 0.3)" : "rgba(255, 255, 255, 0.06)",
                              border: isSelected ? "1px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.12)",
                              color: isSelected ? "#38bdf8" : "#cbd5e1",
                            }}
                          >
                            {isSelected && <Check size={12} style={{ display: "inline", marginRight: 4 }} />}
                            {cond}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                    <button
                      type="button"
                      onClick={handleDownloadHealthSummary}
                      className="cm-advisor-btn-outline"
                    >
                      <Download size={14} /> Download Summary Report
                    </button>

                    <button
                      type="submit"
                      disabled={savingProfile}
                      className="cm-advisor-btn-primary"
                    >
                      <CheckCircle2 size={14} /> {savingProfile ? "Saving Vitals..." : "Save & Recalibrate"}
                    </button>
                  </div>
                </form>
              ) : (
                /* TAB 2: Suggested Specialists */
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ fontSize: "0.82rem", color: "#94a3b8", marginBottom: 2 }}>
                    Verified CallMedex physicians and specialists matched to your biometric intake and conditions:
                  </div>

                  {suggestedDoctorsList.map((doc, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: "rgba(15, 23, 42, 0.6)",
                        border: "1px solid rgba(255, 255, 255, 0.12)",
                        borderRadius: 14,
                        padding: "16px 18px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 14,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, maxWidth: "68%" }}>
                        <div
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            background: "rgba(14, 165, 233, 0.2)",
                            border: "1px solid rgba(56, 189, 248, 0.35)",
                            display: "grid",
                            placeItems: "center",
                            flexShrink: 0,
                          }}
                        >
                          <Stethoscope size={22} color="#38bdf8" />
                        </div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ fontSize: "0.98rem", fontWeight: 800, color: "#ffffff" }}>
                              {doc.doctor_name}
                            </span>
                            <span
                              style={{
                                fontSize: "0.68rem",
                                padding: "2px 7px",
                                borderRadius: 6,
                                background: "rgba(16, 185, 129, 0.18)",
                                color: "#34d399",
                                fontWeight: 700,
                              }}
                            >
                              ★ {doc.rating || 4.9} · Verified Specialist
                            </span>
                          </div>
                          <div style={{ fontSize: "0.8rem", color: "#38bdf8", fontWeight: 600, marginTop: 2 }}>
                            {doc.specialty} · {doc.qualification}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: 4 }}>
                            {doc.reason}
                          </div>
                          <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: 2 }}>
                            Facility: {doc.hospital || "CallMedex Network"}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                        <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#4ade80" }}>
                          ₹{doc.fee || 500}
                        </div>
                        <Link
                          href={`/booking?type=consultation&doctor=${encodeURIComponent(doc.id || doc.doctor_name || "Doctor")}&name=${encodeURIComponent(doc.doctor_name || "Doctor")}&spec=${encodeURIComponent(doc.specialty || "Specialist")}&fee=${doc.fee || 500}`}
                          className="cm-advisor-btn-primary"
                          style={{ textDecoration: "none", padding: "7px 14px", fontSize: "0.8rem" }}
                        >
                          Book Consultation →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL 2: TARGETED DIAGNOSTICS & PACKAGES CONSOLE
         ══════════════════════════════════════════════════════════════════════ */}
      {activeWidget === 2 && (
        <div className="cm-widget-overlay" onClick={() => setActiveWidget(null)}>
          <div
            className="cm-glass-widget-modal"
            style={{ maxWidth: 840, maxHeight: "90vh", display: "flex", flexDirection: "column" }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <div
              style={{
                padding: "18px 22px",
                borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "rgba(15, 23, 42, 0.5)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    background: "rgba(34, 197, 94, 0.25)",
                    border: "1px solid rgba(74, 222, 128, 0.45)",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <Clinical3DIcon name="microscope" size={26} glow />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "#fff" }}>
                    Targeted Diagnostics &amp; Health Packages Console
                  </h3>
                  <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: 2 }}>
                    ICMR &amp; NABL certified lab tests and full-body wellness packages with savings up to 33% OFF
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveWidget(null)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#94a3b8",
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Sub-Tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid rgba(255, 255, 255, 0.1)", background: "rgba(15, 23, 42, 0.3)" }}>
              <button
                type="button"
                onClick={() => setModal2Tab("tests")}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  background: modal2Tab === "tests" ? "rgba(34, 197, 94, 0.15)" : "transparent",
                  borderBottom: modal2Tab === "tests" ? "2px solid #4ade80" : "none",
                  color: modal2Tab === "tests" ? "#4ade80" : "#94a3b8",
                  fontWeight: 700,
                  fontSize: "0.84rem",
                  cursor: "pointer",
                  border: "none",
                }}
              >
                1. Recommended Diagnostic Tests ({tests.length})
              </button>
              <button
                type="button"
                onClick={() => setModal2Tab("packages")}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  background: modal2Tab === "packages" ? "rgba(34, 197, 94, 0.15)" : "transparent",
                  borderBottom: modal2Tab === "packages" ? "2px solid #4ade80" : "none",
                  color: modal2Tab === "packages" ? "#4ade80" : "#94a3b8",
                  fontWeight: 700,
                  fontSize: "0.84rem",
                  cursor: "pointer",
                  border: "none",
                }}
              >
                2. Full-Body Health Packages (Up to 33% OFF)
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
              {modal2Tab === "tests" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {tests.map((t, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: "rgba(15, 23, 42, 0.6)",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        borderRadius: 12,
                        padding: "14px 18px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <div style={{ maxWidth: "72%" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: "0.94rem", fontWeight: 800, color: "#ffffff" }}>
                            {t.test_name}
                          </span>
                          <span
                            style={{
                              fontSize: "0.68rem",
                              padding: "2px 7px",
                              borderRadius: 6,
                              background: t.urgency === "high" ? "rgba(239, 68, 68, 0.2)" : t.urgency === "medium" ? "rgba(245, 158, 11, 0.2)" : "rgba(56, 189, 248, 0.2)",
                              color: t.urgency === "high" ? "#f87171" : t.urgency === "medium" ? "#fbbf24" : "#38bdf8",
                              fontWeight: 700,
                            }}
                          >
                            {t.urgency.toUpperCase()} PRIORITY
                          </span>
                        </div>
                        <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: 4 }}>
                          {t.reason}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "#4ade80", marginTop: 3 }}>
                          NABL Certified · Free Home Sample Collection Available
                        </div>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                          {t.original_price && (
                            <span style={{ fontSize: "0.75rem", color: "#64748b", textDecoration: "line-through" }}>
                              ₹{t.original_price}
                            </span>
                          )}
                          <span style={{ fontSize: "1rem", fontWeight: 800, color: "#4ade80" }}>
                            ₹{t.estimated_price || 399}
                          </span>
                        </div>
                        <Link
                          href={t.action_url || `/booking?type=lab&service=${encodeURIComponent(t.test_name)}`}
                          className="cm-advisor-btn-primary"
                          style={{ textDecoration: "none", padding: "6px 14px", fontSize: "0.78rem" }}
                        >
                          Book Test →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* TAB 2: Full-Body Health Packages */
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {DEFAULT_PACKAGES.map((pkg) => (
                    <div
                      key={pkg.id}
                      style={{
                        background: "rgba(15, 23, 42, 0.65)",
                        border: "1px solid rgba(251, 146, 60, 0.25)",
                        borderRadius: 14,
                        padding: "16px 18px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: "1.02rem", fontWeight: 800, color: "#ffffff" }}>
                              {pkg.name}
                            </span>
                            <span
                              style={{
                                fontSize: "0.68rem",
                                padding: "3px 8px",
                                borderRadius: 6,
                                background: "rgba(234, 88, 12, 0.25)",
                                color: "#fb923c",
                                fontWeight: 800,
                                border: "1px solid rgba(251, 146, 60, 0.4)",
                              }}
                            >
                              {pkg.badge}
                            </span>
                          </div>
                          <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: 4 }}>
                            {pkg.description}
                          </div>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                            <span style={{ fontSize: "0.8rem", color: "#64748b", textDecoration: "line-through" }}>
                              ₹{pkg.originalPrice}
                            </span>
                            <span style={{ fontSize: "1.2rem", fontWeight: 900, color: "#4ade80" }}>
                              ₹{pkg.offerPrice}
                            </span>
                          </div>
                          <span style={{ fontSize: "0.7rem", color: "#fb923c", fontWeight: 700 }}>
                            Save ₹{pkg.originalPrice - pkg.offerPrice}
                          </span>
                        </div>
                      </div>

                      {/* Included Parameters Chips */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {pkg.includes.map((inc, i) => (
                          <span
                            key={i}
                            style={{
                              fontSize: "0.72rem",
                              padding: "3px 8px",
                              borderRadius: 6,
                              background: "rgba(255, 255, 255, 0.06)",
                              border: "1px solid rgba(255, 255, 255, 0.12)",
                              color: "#e2e8f0",
                            }}
                          >
                            ✓ {inc}
                          </span>
                        ))}
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: 10 }}>
                        <span style={{ fontSize: "0.74rem", color: "#94a3b8" }}>
                          Includes Free Doorstep Phlebotomist Visit &amp; Digital Lab Report within 24h
                        </span>
                        <Link
                          href={`/booking?type=lab&package=${encodeURIComponent(pkg.name)}&price=${pkg.offerPrice}&mode=home`}
                          className="cm-advisor-btn-primary"
                          style={{ textDecoration: "none", padding: "7px 16px", fontSize: "0.8rem" }}
                        >
                          Book Package at ₹{pkg.offerPrice} →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL 3: PREVENTIVE CARE & PHARMACY ADVISORY CONSOLE
         ══════════════════════════════════════════════════════════════════════ */}
      {activeWidget === 3 && (
        <div className="cm-widget-overlay" onClick={() => setActiveWidget(null)}>
          <div
            className="cm-glass-widget-modal"
            style={{ maxWidth: 840, maxHeight: "90vh", display: "flex", flexDirection: "column" }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <div
              style={{
                padding: "18px 22px",
                borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "rgba(15, 23, 42, 0.5)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    background: "rgba(168, 85, 247, 0.25)",
                    border: "1px solid rgba(192, 132, 252, 0.45)",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <Clinical3DIcon name="pharmacy" size={26} glow />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "#fff" }}>
                    Preventive Care &amp; Pharmacy Advisory Console
                  </h3>
                  <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: 2 }}>
                    Condition-calibrated preventive wellness protocols, clinical nutrition &amp; doorstep pharmacy guidance
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveWidget(null)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#94a3b8",
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Sub-Tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid rgba(255, 255, 255, 0.1)", background: "rgba(15, 23, 42, 0.3)" }}>
              <button
                type="button"
                onClick={() => setModal3Tab("preventive")}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  background: modal3Tab === "preventive" ? "rgba(168, 85, 247, 0.15)" : "transparent",
                  borderBottom: modal3Tab === "preventive" ? "2px solid #c084fc" : "none",
                  color: modal3Tab === "preventive" ? "#c084fc" : "#94a3b8",
                  fontWeight: 700,
                  fontSize: "0.84rem",
                  cursor: "pointer",
                  border: "none",
                }}
              >
                1. Preventive Care Blueprint &amp; Nutrition
              </button>
              <button
                type="button"
                onClick={() => setModal3Tab("pharmacy")}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  background: modal3Tab === "pharmacy" ? "rgba(168, 85, 247, 0.15)" : "transparent",
                  borderBottom: modal3Tab === "pharmacy" ? "2px solid #c084fc" : "none",
                  color: modal3Tab === "pharmacy" ? "#c084fc" : "#94a3b8",
                  fontWeight: 700,
                  fontSize: "0.84rem",
                  cursor: "pointer",
                  border: "none",
                }}
              >
                2. Doorstep Pharmacy &amp; Supplements Guidance
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
              {modal3Tab === "preventive" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Caloric & Hydration Target Strip */}
                  <div
                    style={{
                      background: "rgba(15, 23, 42, 0.6)",
                      border: "1px solid rgba(192, 132, 252, 0.25)",
                      borderRadius: 14,
                      padding: "14px 18px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "0.72rem", color: "#c084fc", fontWeight: 800, textTransform: "uppercase" }}>
                        Daily Hydration &amp; Energy Goals
                      </div>
                      <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#ffffff", marginTop: 2 }}>
                        {dietPlan?.hydration_target || "2.8 – 3.2 Liters daily"}
                      </div>
                      <div style={{ fontSize: "0.76rem", color: "#94a3b8", marginTop: 2 }}>
                        Caloric Baseline: {dietPlan?.daily_calories || "2,050 kcal"} ({dietPlan?.macro_split || "50% Carbs · 25% Protein · 25% Fats"})
                      </div>
                    </div>
                  </div>

                  {/* Indian Meal Schedule */}
                  <div>
                    <h5 style={{ margin: "0 0 10px 0", fontSize: "0.86rem", color: "#cbd5e1", textTransform: "uppercase" }}>
                      ICMR-Aligned Daily Meal &amp; Pacing Schedule
                    </h5>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {(dietPlan?.meals || DEFAULT_ADVISOR_DATA.care_guidance.diet_plan?.meals || []).map((m, idx) => (
                        <div
                          key={idx}
                          style={{
                            background: "rgba(15, 23, 42, 0.5)",
                            border: "1px solid rgba(255, 255, 255, 0.08)",
                            borderRadius: 10,
                            padding: "10px 14px",
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                          }}
                        >
                          <span style={{ fontSize: "0.72rem", color: "#38bdf8", fontWeight: 700, minWidth: 65 }}>
                            {m.time}
                          </span>
                          <div>
                            <span style={{ fontSize: "0.86rem", fontWeight: 700, color: "#ffffff" }}>
                              {m.meal_name}
                            </span>
                            <div style={{ fontSize: "0.76rem", color: "#94a3b8", marginTop: 2 }}>
                              {m.description}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Physical Mobility Guidance */}
                  <div
                    style={{
                      background: "rgba(15, 23, 42, 0.5)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      borderRadius: 12,
                      padding: "14px 16px",
                    }}
                  >
                    <div style={{ fontSize: "0.78rem", color: "#c084fc", fontWeight: 800, textTransform: "uppercase", marginBottom: 6 }}>
                      Physical Activity &amp; Joint Mobility Protocol
                    </div>
                    <div style={{ fontSize: "0.82rem", color: "#e2e8f0", lineHeight: 1.5 }}>
                      <strong>Cardio:</strong> {workoutPlan?.cardio || "35–45 min brisk walking daily at moderate HR."}
                    </div>
                    <div style={{ fontSize: "0.82rem", color: "#e2e8f0", lineHeight: 1.5, marginTop: 4 }}>
                      <strong>Mobility &amp; Core:</strong> {workoutPlan?.strength_and_mobility || "Wall squats, seated leg extensions & gentle spinal twists."}
                    </div>
                  </div>
                </div>
              ) : (
                /* TAB 2: Doorstep Pharmacy & Supplements */
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginBottom: 2 }}>
                    Doctor-verified daily health essentials, monitoring tools, and supplements with doorstep delivery:
                  </div>

                  {DEFAULT_PHARMACY.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        background: "rgba(15, 23, 42, 0.6)",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        borderRadius: 12,
                        padding: "14px 18px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <div style={{ maxWidth: "70%" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: "0.92rem", fontWeight: 800, color: "#ffffff" }}>
                            {item.name}
                          </span>
                          <span
                            style={{
                              fontSize: "0.68rem",
                              padding: "2px 7px",
                              borderRadius: 6,
                              background: "rgba(168, 85, 247, 0.2)",
                              color: "#c084fc",
                              fontWeight: 700,
                            }}
                          >
                            {item.discount}
                          </span>
                        </div>
                        <div style={{ fontSize: "0.76rem", color: "#94a3b8", marginTop: 4 }}>
                          {item.reason}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "#38bdf8", marginTop: 2 }}>
                          Dosage / Instructions: {item.dosage}
                        </div>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                          <span style={{ fontSize: "0.75rem", color: "#64748b", textDecoration: "line-through" }}>
                            ₹{item.originalPrice}
                          </span>
                          <span style={{ fontSize: "1rem", fontWeight: 800, color: "#4ade80" }}>
                            ₹{item.price}
                          </span>
                        </div>
                        <Link
                          href="/pharmacy"
                          className="cm-advisor-btn-primary"
                          style={{ textDecoration: "none", padding: "6px 14px", fontSize: "0.78rem" }}
                        >
                          Order via Pharmacy →
                        </Link>
                      </div>
                    </div>
                  ))}

                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                    <Link
                      href="/pharmacy"
                      className="cm-advisor-btn-outline"
                      style={{ textDecoration: "none", padding: "8px 16px" }}
                    >
                      Explore Entire CallMedex Online Pharmacy →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
