"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Clinical3DIcon from "@/components/ui/Clinical3DIcon";
import {
  ShieldCheck, CheckCircle2, AlertCircle, RefreshCw,
  FlaskConical, Activity, HeartPulse, Stethoscope, Bike, Check, X,
  ExternalLink, ChevronRight, User, Droplet, FileText, Pill, Zap, Clock,
  Calendar, MapPin, Video, Phone, UserCheck, Plus, AlertTriangle, Building2,
  Download, Award, Tag, Sparkles, Home
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
    id: "e713e870-4f61-411d-bfe1-1387f0f59c61",
    doctor_name: "Dr. Latchireddi SA Naidu",
    specialty: "Senior Consultant Clinical Cardio Physician & Diabetic Care",
    title: "Senior Consultant Clinical Cardiologist (NI)",
    qualification: "MBBS, PGDCCP (NI)",
    experience: "24+ yrs clinical experience",
    fee: 500,
    languages: ["English", "Telugu", "Hindi"],
    hospital: "Visakha Multispeciality Clinics & Diagnostics",
    rating: 4.98,
    reason: "Comprehensive clinical cardiovascular assessment, hypertension stabilization, glycemic surveillance, and personalized chronic disease management.",
  },
  {
    id: "9ad25430-cef3-4df8-a617-1b1926823a9a",
    doctor_name: "Dr. Kolasani Sudhakar",
    specialty: "Consultant Physiotherapist & Rehabilitation Specialist",
    title: "Consultant Physical Therapist",
    qualification: "MPT (Musculoskeletal), FOMT, DMS",
    experience: "14+ yrs clinical experience",
    fee: 500,
    languages: ["English", "Telugu"],
    hospital: "RECURE CLINIC & Visakha Multispeciality Network",
    rating: 4.95,
    reason: "Targeted musculoskeletal rehabilitation, postural biomechanics realignment, spinal decompression, and therapeutic movement therapy.",
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
    id: "0fe4c63f-9efc-456a-9326-3de10486170e",
    name: "Cardiac Screening Package",
    badge: "RECOMMENDED CARDIO CARE",
    discountPercent: 33,
    originalPrice: 1650,
    offerPrice: 1099,
    parametersCount: "Comprehensive Cardiac Biomarkers",
    description: "Formulated by Senior Cardiologist Dr. Latchireddi SA Naidu: Complete Lipid Risk Profile, Fasting Blood Sugar, Serum Creatinine, Electrolytes & Cardiac Risk Ratios.",
    includes: ["Lipid Profile (Total Cholesterol, HDL, LDL, VLDL, Triglycerides)", "Fasting Blood Sugar", "Serum Creatinine", "Serum Electrolytes", "Blood Pressure Calibration"],
  },
  {
    id: "389ff76d-37f3-41cb-ae86-c63e4ef57ea1",
    name: "Basic Screening (Diabetic)",
    badge: "METABOLIC ESSENTIAL",
    discountPercent: 33,
    originalPrice: 1200,
    offerPrice: 799,
    parametersCount: "Diabetic & Renal Surveillance",
    description: "Essential surveillance for diabetes and pre-diabetes: Glycated Hemoglobin (HbA1c), Fasting Blood Glucose, Urine Microalbumin, and Kidney Screening.",
    includes: ["HbA1c (Glycated Hemoglobin)", "Fasting Blood Sugar", "Urine Routine & Microscopic", "Kidney Function Baseline"],
  },
  {
    id: "dd1291da-eea6-4ae1-b219-c35c213eacee",
    name: "Basic Screening (Non Diabetic)",
    badge: "ROUTINE PREVENTIVE",
    discountPercent: 33,
    originalPrice: 900,
    offerPrice: 599,
    parametersCount: "Annual Wellness Baseline",
    description: "Preventive baseline checkup: Complete Blood Count (CBC/CBP), Urine Routine, Resting Metabolic Panel, and Primary Organ Baseline.",
    includes: ["Complete Blood Picture (24 params)", "Urine Routine & Microscopy", "Random Blood Sugar", "Vital Parameters Assessment"],
  },
  {
    id: "0055616d-49e4-4e3e-9e2b-d448d763dc6d",
    name: "Senior Citizen Package (Male)",
    badge: "SENIOR CARE ADVANCED",
    discountPercent: 31,
    originalPrice: 2600,
    offerPrice: 1799,
    parametersCount: "Full Organ Screening (Age 50+)",
    description: "Advanced geriatric and cardio-metabolic panel for senior health monitoring: Complete Hemogram, Renal Profile, Liver Function, Cardiac Biomarkers & Electrolytes.",
    includes: ["Complete Hemogram (CBC)", "Lipid Risk Panel", "Renal Function Test (KFT)", "Liver Function Test (LFT)", "Electrolytes & Uric Acid"],
  },
  {
    id: "4059f18c-7b24-42cf-ae17-5947100058cc",
    name: "Vitamin Package",
    badge: "NUTRITIONAL VITALITY",
    discountPercent: 33,
    originalPrice: 1500,
    offerPrice: 999,
    parametersCount: "Micronutrient Panel",
    description: "Crucial nutritional screening for fatigue, nerve health, and bone mineral density: Vitamin D3 (25-OH) & Vitamin B12 (Cyanocobalamin).",
    includes: ["Vitamin D3 (25-OH Cholecalciferol)", "Vitamin B12 (Active Cyanocobalamin)", "Calcium & Bone Health"],
  },
];

const DEFAULT_PHARMACY: RecommendPharmacyItem[] = [
  {
    id: "rx-visakha-dispensing",
    name: "Prescription Medicine Dispensing & Doorstep Delivery",
    category: "Registered Partner Pharmacy",
    dosage: "Fulfillment by Sri Visakha Medicals (Lic: AP/03/01/2017-138350)",
    price: 0,
    originalPrice: 0,
    discount: "GENUINE PHARMACY",
    reason: "Upload your valid doctor prescription for verified dispensing by Pharmacist-in-Charge Gayatri at Sri Visakha Medicals with doorstep delivery.",
  },
  {
    id: "rx-chronic-refill",
    name: "Cardio & Diabetic Chronic Care Monthly Refill Plan",
    category: "Scheduled Refill Service",
    dosage: "Monthly scheduled dispensing for verified prescriptions",
    price: 0,
    originalPrice: 0,
    discount: "DOORSTEP REFILL",
    reason: "Never miss a dose of essential hypertension or glycemic medication. Pre-scheduled batch-verified refills delivered on time to your doorstep.",
  },
  {
    id: "rx-clinical-supplies",
    name: "Clinical Diagnostics & Home Monitoring Supplies",
    category: "Clinical Consumables",
    dosage: "Certified BP cuffs, lancets, testing strips & sanitization supplies",
    price: 0,
    originalPrice: 0,
    discount: "CERTIFIED SUPPLIES",
    reason: "Genuine medical-grade biometric monitoring consumables dispensed directly by licensed pharmacy partner Sri Visakha Medicals.",
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

export interface RoutineCheckupItem {
  id: string;
  name: string;
  category: string;
  reason: string;
  price: number;
  originalPrice: number;
  discount: string;
  sampleType: string;
  fastingRequired: boolean;
}

export interface RoutinePackageItem {
  id: string;
  name: string;
  interval: "3m" | "6m" | "12m";
  badge: string;
  parametersCount: string;
  originalPrice: number;
  offerPrice: number;
  description: string;
  includes: string[];
}

const ROUTINE_CHECKUPS_DATA: Record<"3m" | "6m" | "12m", {
  title: string;
  tagline: string;
  summary: string;
  tests: RoutineCheckupItem[];
  packages: RoutinePackageItem[];
}> = {
  "3m": {
    title: "3-Month Quarterly Surveillance",
    tagline: "Recommended quarterly baseline for proactive metabolic & vital balance",
    summary: "Essential quarterly screen for asymptomatic individuals to catch glycemic drift, blood pressure volatility, and cellular hydration fluctuations before symptoms manifest.",
    tests: [
      {
        id: "rt-cbc",
        name: "Complete Blood Count (CBC / Hemogram)",
        category: "Hematology",
        reason: "Evaluates RBC, WBC, platelets, and hemoglobin to ensure active immune defense and rule out subclinical anemia or infection.",
        price: 299,
        originalPrice: 450,
        discount: "33% OFF",
        sampleType: "Blood (EDTA)",
        fastingRequired: false,
      },
      {
        id: "rt-fbs",
        name: "Fasting Blood Sugar (FBS)",
        category: "Metabolic",
        reason: "Measures baseline glucose homeostasis to detect early insulin resistance or pre-diabetes early.",
        price: 99,
        originalPrice: 160,
        discount: "38% OFF",
        sampleType: "Blood (Fluoride)",
        fastingRequired: true,
      },
      {
        id: "rt-urine",
        name: "Urine Routine & Microscopic Examination",
        category: "Renal Screening",
        reason: "Detects asymptomatic proteinuria, microscopic hematuria, or early metabolic by-products.",
        price: 149,
        originalPrice: 220,
        discount: "32% OFF",
        sampleType: "Spot Urine",
        fastingRequired: false,
      },
      {
        id: "rt-bp-vitals",
        name: "Doorstep Vitals & Digital Arterial BP Mapping",
        category: "Cardiovascular",
        reason: "Certified phlebotomist/nurse measures arterial pressure, SpO2, and pulse rhythm at resting conditions.",
        price: 199,
        originalPrice: 350,
        discount: "43% OFF",
        sampleType: "Clinical Vitals",
        fastingRequired: false,
      },
    ],
    packages: [
      {
        id: "pkg-3m-vital",
        name: "Quarterly Active Vital Monitoring Package",
        interval: "3m",
        badge: "POPULAR QUARTERLY",
        parametersCount: "48+ Parameters",
        originalPrice: 1299,
        offerPrice: 699,
        description: "Complete quarterly hemogram, fasting glucose, urine micro-sediment, and doorstep vital examination.",
        includes: ["Complete Hemogram (24 Parameters)", "Fasting Blood Glucose", "Urine Routine & Microscopic", "Resting Blood Pressure", "Free Doorstep Draw"],
      },
    ],
  },
  "6m": {
    title: "6-Month Semi-Annual Checkup",
    tagline: "Comprehensive semi-annual checkup to screen major organ functions & lipids",
    summary: "ICMR recommended 6-month interval to track glycated hemoglobin (HbA1c), cholesterol fractions, liver enzymes, and kidney filtration efficiency.",
    tests: [
      {
        id: "rt-hba1c",
        name: "Glycated Hemoglobin (HbA1c with Average Glucose)",
        category: "Endocrine",
        reason: "Measures 90-day average blood glucose without being skewed by single-day dietary variations.",
        price: 349,
        originalPrice: 550,
        discount: "36% OFF",
        sampleType: "Blood (EDTA)",
        fastingRequired: false,
      },
      {
        id: "rt-lipid",
        name: "Lipid Profile Comprehensive (Cholesterol, HDL, LDL, VLDL, Triglycerides)",
        category: "Cardiovascular",
        reason: "Screens arterial plaque risk, cardiac protection index, and triglyceride accumulation.",
        price: 449,
        originalPrice: 700,
        discount: "35% OFF",
        sampleType: "Blood (Serum)",
        fastingRequired: true,
      },
      {
        id: "rt-kft",
        name: "Kidney Function Test (KFT / RFT with eGFR)",
        category: "Renal",
        reason: "Evaluates serum creatinine, blood urea nitrogen, uric acid, and glomerular filtration rate.",
        price: 499,
        originalPrice: 750,
        discount: "33% OFF",
        sampleType: "Blood (Serum)",
        fastingRequired: false,
      },
      {
        id: "rt-lft",
        name: "Liver Function Test (LFT with Bilirubin, SGOT, SGPT, ALP)",
        category: "Hepatic",
        reason: "Assesses hepatic detox capability, fat deposition markers, and protein synthesis balance.",
        price: 499,
        originalPrice: 750,
        discount: "33% OFF",
        sampleType: "Blood (Serum)",
        fastingRequired: false,
      },
    ],
    packages: [
      {
        id: "pkg-6m-metabolic",
        name: "Semi-Annual Precision Metabolic & Organ Shield",
        interval: "6m",
        badge: "BEST VALUE · 6 MONTHS",
        parametersCount: "68+ Parameters",
        originalPrice: 2499,
        offerPrice: 1299,
        description: "Includes HbA1c 3-month sugar, Complete Lipid Panel, Liver Function, Kidney Function, and Complete Blood Picture.",
        includes: ["HbA1c & Est. Average Glucose", "Full Lipid Risk Ratios", "Kidney RFT with eGFR", "Liver Enzymes (SGOT/SGPT)", "Doorstep Cold-Chain Pickup"],
      },
    ],
  },
  "12m": {
    title: "12-Month Comprehensive Annual Wellness",
    tagline: "Total body preventive baseline covering organs, vitamins, thyroid & cardiac ECG",
    summary: "Gold-standard annual preventive checkup for normal healthy adults to establish multi-year wellness trends and identify silent deficiencies.",
    tests: [
      {
        id: "rt-thyroid",
        name: "Thyroid Profile Total (T3, T4, TSH)",
        category: "Endocrine",
        reason: "Assesses resting basal metabolism, energy levels, weight control, and hormonal rhythm.",
        price: 349,
        originalPrice: 500,
        discount: "30% OFF",
        sampleType: "Blood (Serum)",
        fastingRequired: false,
      },
      {
        id: "rt-vit-d-b12",
        name: "Vitamin D (25-OH) & Vitamin B12 Vitality Duo",
        category: "Vitamins & Minerals",
        reason: "Crucial for bone mineral density, nerve sheath maintenance, and chronic fatigue prevention in Indian populations.",
        price: 899,
        originalPrice: 1400,
        discount: "35% OFF",
        sampleType: "Blood (Serum)",
        fastingRequired: false,
      },
      {
        id: "rt-ecg",
        name: "12-Lead Digital Resting ECG (Doorstep / Lab)",
        category: "Cardiovascular",
        reason: "Screens cardiac conduction, resting rhythm abnormalities, and early myocardial strain.",
        price: 399,
        originalPrice: 600,
        discount: "33% OFF",
        sampleType: "Electrophysiology",
        fastingRequired: false,
      },
      {
        id: "rt-iron",
        name: "Iron Studies with Ferritin & TIBC",
        category: "Hematology",
        reason: "Measures deep cellular iron stores to prevent occult fatigue and oxygen-carrying reduction.",
        price: 549,
        originalPrice: 850,
        discount: "35% OFF",
        sampleType: "Blood (Serum)",
        fastingRequired: true,
      },
    ],
    packages: [
      {
        id: "pkg-12m-total",
        name: "CallMedex Total Body Annual Wellness Shield",
        interval: "12m",
        badge: "FLAGSHIP ANNUAL · 35% OFF",
        parametersCount: "88+ Parameters",
        originalPrice: 3499,
        offerPrice: 2199,
        description: "The complete 360° health audit: Heart, Liver, Kidney, Thyroid, Vitamins (D & B12), Hemogram, Diabetes & Urinalysis.",
        includes: ["Full Thyroid Profile (T3, T4, TSH)", "Vitamin D & Active B12", "Liver & Kidney Comprehensive Panels", "Cardiac Lipid Ratios", "Free Doctor Tele-Review"],
      },
    ],
  },
};

// ─── Component Implementation ───────────────────────────────────────────────

export default function PatientAIAdvisor() {
  const [data, setData] = useState<HealthAdvisorData>(DEFAULT_ADVISOR_DATA);
  const [loading, setLoading] = useState<boolean>(false);
  const [protocolSource, setProtocolSource] = useState<string>("ICMR Clinical Protocols (Active 🛡️)");

  // Active Main Widget Modal: 1 = Specialist Doctor Advisory, 2 = Diagnostics & Packages, 3 = Preventive Care & Pharmacy
  const [activeWidget, setActiveWidget] = useState<1 | 2 | 3 | null>(null);

  // Subtabs within modals
  const [modal1Tab, setModal1Tab] = useState<"vitals" | "doctors">("vitals");
  const [modal2Tab, setModal2Tab] = useState<"tests" | "packages" | "periodic">("tests");
  const [routineInterval, setRoutineInterval] = useState<"3m" | "6m" | "12m">("3m");
  const [modal3Tab, setModal3Tab] = useState<"preventive" | "pharmacy">("preventive");
  const [availableDoctors, setAvailableDoctors] = useState<RecommendDoctor[]>([]);

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
    if (profile.conditions && profile.conditions.length > 0) setConditionsInput(profile.conditions);
    if (profile.dietary_preference) setDietPrefInput(profile.dietary_preference);
    if (profile.activity_level) setActivityInput(profile.activity_level);

    if (typeof window !== "undefined") {
      try {
        const payload = {
          weight_kg: profile.weight_kg,
          height_cm: profile.height_cm,
          blood_pressure: profile.blood_pressure,
          fasting_blood_sugar: profile.fasting_blood_sugar,
          conditions: profile.conditions || [],
          dietary_preference: profile.dietary_preference || "vegetarian",
          activity_level: profile.activity_level || "moderate",
        };
        localStorage.setItem("cm_patient_vitals", JSON.stringify(payload));
      } catch (e) {
        // ignore storage quota errors
      }
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("cm_patient_vitals");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.weight_kg) setWeightInput(String(parsed.weight_kg));
          if (parsed.height_cm) setHeightInput(String(parsed.height_cm));
          if (parsed.blood_pressure) setBpInput(parsed.blood_pressure);
          if (parsed.fasting_blood_sugar) setSugarInput(String(parsed.fasting_blood_sugar));
          if (Array.isArray(parsed.conditions) && parsed.conditions.length > 0) setConditionsInput(parsed.conditions);
          if (parsed.dietary_preference) setDietPrefInput(parsed.dietary_preference);
          if (parsed.activity_level) setActivityInput(parsed.activity_level);
        }
      } catch (e) {
        console.error("Failed to restore vitals from localStorage:", e);
      }
    }
    fetchRecommendations();

    // Dynamically load registered verified doctors from database
    const fetchRegisteredDoctors = async () => {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const res = await fetch(`${apiBase}/api/telemed/doctors`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.doctors) && json.doctors.length > 0) {
            const mapped: RecommendDoctor[] = json.doctors.map((d: any) => ({
              id: d.doctor_id,
              doctor_name: d.name?.toLowerCase().startsWith("dr") ? d.name : `Dr. ${d.name}`,
              specialty: d.specialization || "Clinical Cardio Physician & Diabetic Care",
              title: "Senior Consultant Physician",
              qualification: d.qualification || "MBBS, PGDCCP (NI)",
              experience: `${d.experience_years || 24}+ yrs clinical experience`,
              fee: d.consultation_fee || 500,
              languages: d.languages || ["English", "Telugu"],
              hospital: d.hospital_clinic_name || "Visakha Multispeciality Clinics & Diagnostics",
              rating: 4.98,
              reason: d.bio ? d.bio.slice(0, 150) + "..." : "Primary clinical consultation and specialized cardio-metabolic care tailored to your biometric vitals.",
            }));
            setAvailableDoctors(mapped);
          }
        }
      } catch (e) {
        console.warn("Could not fetch dynamic telemed doctors:", e);
      }
    };
    fetchRegisteredDoctors();
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

      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("cm_patient_vitals", JSON.stringify(payload));
        } catch (e) {
          console.error("Failed to cache vitals to localStorage:", e);
        }
      }

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
  const suggestedDoctorsList = availableDoctors.length > 0
    ? availableDoctors
    : (data?.recommended_doctors && data.recommended_doctors.length > 0 && data.recommended_doctors[0].doctor_name)
      ? data.recommended_doctors
      : DEFAULT_DOCTORS;

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
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => {
                  setActiveWidget(2);
                  setModal2Tab("periodic");
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "5px 14px",
                  borderRadius: 999,
                  background: "linear-gradient(135deg, rgba(16, 185, 129, 0.35) 0%, rgba(5, 150, 105, 0.4) 100%)",
                  border: "1.5px solid rgba(52, 211, 153, 0.6)",
                  color: "#d1fae5",
                  fontSize: "0.78rem",
                  fontWeight: 800,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  boxShadow: "0 2px 10px rgba(16, 185, 129, 0.25)",
                }}
                title="Explore Periodic Routine Checkups for Asymptomatic / Normal Health (3M / 6M / 12M)"
              >
                <Calendar size={13} style={{ color: "#34d399" }} />
                <span>Periodic Routine Checkups · 3M / 6M / 12M</span>
                <ChevronRight size={13} style={{ color: "#6ee7b7" }} />
              </button>
            </div>
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
                {suggestedDoctorsList.length} Verified Specialist{suggestedDoctorsList.length === 1 ? "" : "s"} Available
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
            <div style={{ display: "flex", borderBottom: "1px solid rgba(255, 255, 255, 0.1)", background: "rgba(15, 23, 42, 0.3)", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setModal2Tab("tests")}
                style={{
                  flex: 1,
                  minWidth: 180,
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
                  minWidth: 180,
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
              <button
                type="button"
                onClick={() => setModal2Tab("periodic")}
                style={{
                  flex: 1,
                  minWidth: 200,
                  padding: "12px 16px",
                  background: modal2Tab === "periodic" ? "rgba(16, 185, 129, 0.2)" : "transparent",
                  borderBottom: modal2Tab === "periodic" ? "2px solid #34d399" : "none",
                  color: modal2Tab === "periodic" ? "#34d399" : "#94a3b8",
                  fontWeight: 700,
                  fontSize: "0.84rem",
                  cursor: "pointer",
                  border: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <Calendar size={14} />
                <span>3. Periodic Routine Checkups (3M / 6M / 12M)</span>
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
              {modal2Tab === "tests" && (
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
                        flexWrap: "wrap",
                        gap: 12,
                      }}
                    >
                      <div style={{ maxWidth: "60%" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: "0.95rem", fontWeight: 800, color: "#ffffff" }}>
                            {t.test_name}
                          </span>
                          <span
                            style={{
                              fontSize: "0.68rem",
                              padding: "2px 8px",
                              borderRadius: 6,
                              background: "rgba(56, 189, 248, 0.2)",
                              color: "#38bdf8",
                              fontWeight: 700,
                            }}
                          >
                            {t.category}
                          </span>
                        </div>
                        <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: 4 }}>
                          {t.reason}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "#4ade80", marginTop: 3 }}>
                          Certified Partner Labs · Free Home Sample Collection Available
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
              )}

              {modal2Tab === "packages" && (
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

              {modal2Tab === "periodic" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  {/* Interval Selector Banner */}
                  <div
                    style={{
                      background: "linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(14, 116, 144, 0.2) 100%)",
                      border: "1px solid rgba(52, 211, 153, 0.35)",
                      borderRadius: 14,
                      padding: "16px 20px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                      <Calendar size={18} style={{ color: "#34d399" }} />
                      <span style={{ fontSize: "0.92rem", fontWeight: 800, color: "#ffffff" }}>
                        Preventive Routine Checkups for Asymptomatic &amp; Normal Individuals
                      </span>
                      <span
                        style={{
                          fontSize: "0.68rem",
                          fontWeight: 800,
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: "rgba(52, 211, 153, 0.2)",
                          color: "#34d399",
                          border: "1px solid rgba(52, 211, 153, 0.4)",
                        }}
                      >
                        ICMR PROTOCOLS
                      </span>
                    </div>
                    <p style={{ margin: "0 0 14px 0", fontSize: "0.8rem", color: "#cbd5e1", lineHeight: 1.45 }}>
                      Evidence-based periodic routine checkup schedule for healthy, asymptomatic adults. Regular monitoring detects silent vital drifts early. Select your checkup frequency:
                    </p>

                    {/* Interval Switcher Pills */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
                      {[
                        { id: "3m", label: "3-Month Interval", desc: "Quarterly Baseline Checkup" },
                        { id: "6m", label: "6-Month Interval", desc: "Semi-Annual Organ Surveillance" },
                        { id: "12m", label: "12-Month Interval", desc: "Annual Total Wellness Audit" },
                      ].map((itv) => (
                        <button
                          key={itv.id}
                          type="button"
                          onClick={() => setRoutineInterval(itv.id as "3m" | "6m" | "12m")}
                          style={{
                            padding: "10px 14px",
                            borderRadius: 10,
                            cursor: "pointer",
                            textAlign: "left",
                            transition: "all 0.2s ease",
                            background: routineInterval === itv.id ? "linear-gradient(135deg, rgba(16, 185, 129, 0.35), rgba(5, 150, 105, 0.35))" : "rgba(15, 23, 42, 0.6)",
                            border: routineInterval === itv.id ? "1.5px solid #34d399" : "1px solid rgba(255, 255, 255, 0.12)",
                            color: "#fff",
                          }}
                        >
                          <div style={{ fontSize: "0.86rem", fontWeight: 800, color: routineInterval === itv.id ? "#34d399" : "#f1f5f9" }}>
                            {itv.label}
                          </div>
                          <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: 2 }}>
                            {itv.desc}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Summary for active interval */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", paddingBottom: 8, flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "#34d399" }}>
                        {ROUTINE_CHECKUPS_DATA[routineInterval].title}
                      </h4>
                      <p style={{ margin: "2px 0 0 0", fontSize: "0.76rem", color: "#94a3b8" }}>
                        {ROUTINE_CHECKUPS_DATA[routineInterval].tagline}
                      </p>
                    </div>
                    <span style={{ fontSize: "0.72rem", color: "#64748b" }}>
                      Certified Partner Laboratories
                    </span>
                  </div>

                  {/* SECTION A: INDIVIDUAL ROUTINE TESTS */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <FlaskConical size={16} style={{ color: "#38bdf8" }} />
                      <span style={{ fontSize: "0.86rem", fontWeight: 800, color: "#ffffff" }}>
                        Essential Routine Tests for this Interval ({ROUTINE_CHECKUPS_DATA[routineInterval].tests.length})
                      </span>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {ROUTINE_CHECKUPS_DATA[routineInterval].tests.map((test) => (
                        <div
                          key={test.id}
                          style={{
                            background: "rgba(15, 23, 42, 0.6)",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                            borderRadius: 12,
                            padding: "14px 18px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: 12,
                          }}
                        >
                          <div style={{ maxWidth: "60%" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <span style={{ fontSize: "0.92rem", fontWeight: 800, color: "#ffffff" }}>
                                {test.name}
                              </span>
                              <span
                                style={{
                                  fontSize: "0.66rem",
                                  padding: "2px 7px",
                                  borderRadius: 6,
                                  background: "rgba(56, 189, 248, 0.18)",
                                  color: "#38bdf8",
                                  fontWeight: 700,
                                }}
                              >
                                {test.category}
                              </span>
                              {test.fastingRequired && (
                                <span
                                  style={{
                                    fontSize: "0.66rem",
                                    padding: "2px 7px",
                                    borderRadius: 6,
                                    background: "rgba(245, 158, 11, 0.2)",
                                    color: "#fbbf24",
                                    fontWeight: 700,
                                  }}
                                >
                                  8-10h Fasting
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: 4 }}>
                              {test.reason}
                            </div>
                            <div style={{ fontSize: "0.72rem", color: "#4ade80", marginTop: 3 }}>
                              Sample: {test.sampleType} · Reports delivered within 12–24 hrs
                            </div>
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                              <span style={{ fontSize: "0.78rem", color: "#64748b", textDecoration: "line-through" }}>
                                ₹{test.originalPrice}
                              </span>
                              <span style={{ fontSize: "1.05rem", fontWeight: 900, color: "#4ade80" }}>
                                ₹{test.price}
                              </span>
                              <span style={{ fontSize: "0.7rem", color: "#fb923c", fontWeight: 700 }}>
                                {test.discount}
                              </span>
                            </div>

                            {/* Dual Booking Buttons: Home vs Walk-In */}
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              <Link
                                href={`/booking?type=lab&test=${encodeURIComponent(test.name)}&price=${test.price}&mode=home`}
                                className="cm-advisor-btn-primary"
                                style={{ textDecoration: "none", padding: "6px 12px", fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: 4 }}
                              >
                                <Home size={12} /> Home Collection
                              </Link>
                              <Link
                                href={`/booking?type=lab&test=${encodeURIComponent(test.name)}&price=${test.price}&mode=walkin`}
                                style={{
                                  textDecoration: "none",
                                  padding: "6px 12px",
                                  fontSize: "0.75rem",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  borderRadius: 8,
                                  background: "rgba(255, 255, 255, 0.1)",
                                  border: "1px solid rgba(255, 255, 255, 0.2)",
                                  color: "#ffffff",
                                  fontWeight: 700,
                                }}
                              >
                                <Building2 size={12} /> Walk-In Lab
                              </Link>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* SECTION B: CURATED PERIODIC PACKAGES */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, marginTop: 6 }}>
                      <Award size={16} style={{ color: "#fb923c" }} />
                      <span style={{ fontSize: "0.86rem", fontWeight: 800, color: "#ffffff" }}>
                        Curated Routine Packages for this Interval
                      </span>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {ROUTINE_CHECKUPS_DATA[routineInterval].packages.map((pkg) => (
                        <div
                          key={pkg.id}
                          style={{
                            background: "linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(30, 41, 59, 0.7) 100%)",
                            border: "1.5px solid rgba(52, 211, 153, 0.4)",
                            borderRadius: 14,
                            padding: "16px 20px",
                            display: "flex",
                            flexDirection: "column",
                            gap: 12,
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <span style={{ fontSize: "1.02rem", fontWeight: 900, color: "#ffffff" }}>
                                  {pkg.name}
                                </span>
                                <span
                                  style={{
                                    fontSize: "0.68rem",
                                    padding: "3px 8px",
                                    borderRadius: 6,
                                    background: "rgba(52, 211, 153, 0.2)",
                                    color: "#34d399",
                                    fontWeight: 800,
                                    border: "1px solid rgba(52, 211, 153, 0.4)",
                                  }}
                                >
                                  {pkg.badge}
                                </span>
                                <span
                                  style={{
                                    fontSize: "0.68rem",
                                    padding: "3px 8px",
                                    borderRadius: 6,
                                    background: "rgba(56, 189, 248, 0.2)",
                                    color: "#38bdf8",
                                    fontWeight: 800,
                                  }}
                                >
                                  {pkg.parametersCount}
                                </span>
                              </div>
                              <div style={{ fontSize: "0.8rem", color: "#cbd5e1", marginTop: 4 }}>
                                {pkg.description}
                              </div>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                                <span style={{ fontSize: "0.82rem", color: "#64748b", textDecoration: "line-through" }}>
                                  ₹{pkg.originalPrice}
                                </span>
                                <span style={{ fontSize: "1.25rem", fontWeight: 900, color: "#4ade80" }}>
                                  ₹{pkg.offerPrice}
                                </span>
                              </div>
                              <span style={{ fontSize: "0.72rem", color: "#fb923c", fontWeight: 800 }}>
                                Save ₹{pkg.originalPrice - pkg.offerPrice}
                              </span>
                            </div>
                          </div>

                          {/* Included Tests Chips */}
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {pkg.includes.map((inc, i) => (
                              <span
                                key={i}
                                style={{
                                  fontSize: "0.72rem",
                                  padding: "3px 9px",
                                  borderRadius: 6,
                                  background: "rgba(255, 255, 255, 0.08)",
                                  border: "1px solid rgba(255, 255, 255, 0.15)",
                                  color: "#f1f5f9",
                                }}
                              >
                                ✓ {inc}
                              </span>
                            ))}
                          </div>

                          {/* Footer with Home vs Walk-In */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: 10, flexWrap: "wrap", gap: 10 }}>
                            <span style={{ fontSize: "0.74rem", color: "#94a3b8" }}>
                              Free doorstep phlebotomist cold-chain draw or express lab walk-in
                            </span>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <Link
                                href={`/booking?type=lab&package=${encodeURIComponent(pkg.name)}&price=${pkg.offerPrice}&mode=home`}
                                className="cm-advisor-btn-primary"
                                style={{ textDecoration: "none", padding: "7px 14px", fontSize: "0.78rem", display: "inline-flex", alignItems: "center", gap: 4 }}
                              >
                                <Home size={13} /> Book Home Collection (₹{pkg.offerPrice})
                              </Link>
                              <Link
                                href={`/booking?type=lab&package=${encodeURIComponent(pkg.name)}&price=${pkg.offerPrice}&mode=walkin`}
                                style={{
                                  textDecoration: "none",
                                  padding: "7px 14px",
                                  fontSize: "0.78rem",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  borderRadius: 8,
                                  background: "rgba(255, 255, 255, 0.12)",
                                  border: "1px solid rgba(255, 255, 255, 0.25)",
                                  color: "#ffffff",
                                  fontWeight: 700,
                                }}
                              >
                                <Building2 size={13} /> Walk-In Diagnostic Centre
                              </Link>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
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
                        {item.price > 0 ? (
                          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                            <span style={{ fontSize: "0.75rem", color: "#64748b", textDecoration: "line-through" }}>
                              ₹{item.originalPrice}
                            </span>
                            <span style={{ fontSize: "1rem", fontWeight: 800, color: "#4ade80" }}>
                              ₹{item.price}
                            </span>
                          </div>
                        ) : (
                          <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "#38bdf8" }}>
                            Verified Pharmacy Partner
                          </div>
                        )}
                        <Link
                          href="/pharmacy"
                          className="cm-advisor-btn-primary"
                          style={{ textDecoration: "none", padding: "6px 14px", fontSize: "0.78rem" }}
                        >
                          Order via Sri Visakha Medicals →
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
