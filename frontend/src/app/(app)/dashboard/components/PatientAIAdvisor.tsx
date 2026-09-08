"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Clinical3DIcon from "@/components/ui/Clinical3DIcon";
import {
  Sparkles, ArrowRight, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw,
  FlaskConical, Activity, HeartPulse, Stethoscope, Bike, Check, X,
  ExternalLink, ChevronRight, User, Droplet, FileText, Pill, Zap, Clock
} from "@/components/ui/icons";

interface RecommendTest {
  test_name: string;
  category: string;
  reason: string;
  action_url: string;
  urgency: "low" | "medium" | "high";
  estimated_price?: number;
}

interface RecommendDoctor {
  specialty: string;
  title: string;
  reason: string;
  consultation_mode: "video" | "in_person" | "home_visit";
  action_url: string;
}

interface RecommendService {
  service_name: string;
  reason: string;
  action_url: string;
}

interface WorkoutPlan {
  warmup: string;
  cardio: string;
  strength_and_mobility: string;
  weekly_frequency: string;
  precautions: string;
}

interface DietPlan {
  hydration_target: string;
  beneficial_foods: string[];
  foods_to_avoid: string[];
  meal_timing_tips: string;
}

interface CareGuidance {
  workouts: WorkoutPlan;
  diet_plan: DietPlan;
  lifestyle_tips: string[];
}

interface PatientHealthProfile {
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
  updated_at?: string;
}

interface AIAdvisorData {
  health_summary: string;
  risk_factors: string[];
  health_profile: PatientHealthProfile;
  recommended_tests: RecommendTest[];
  recommended_doctors: RecommendDoctor[];
  recommended_services: RecommendService[];
  care_guidance: CareGuidance;
}

const COMMON_CONDITIONS = [
  "Hypertension",
  "Diabetes Type 2",
  "Thyroid",
  "High Cholesterol",
  "Asthma",
  "Heart Disease",
  "PCOD / PCOS",
  "None",
];

const DIET_PREFERENCES = [
  { id: "vegetarian", label: "Vegetarian" },
  { id: "non-vegetarian", label: "Non-Vegetarian" },
  { id: "vegan", label: "Vegan" },
  { id: "eggetarian", label: "Eggetarian" },
];

const ACTIVITY_LEVELS = [
  { id: "sedentary", label: "Sedentary (Little/no exercise)" },
  { id: "light", label: "Light (1–2 days/week)" },
  { id: "moderate", label: "Moderate (3–5 days/week)" },
  { id: "active", label: "Very Active (6–7 days/week)" },
];

export default function PatientAIAdvisor() {
  const [data, setData] = useState<AIAdvisorData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Active Widget Modal: 1 = Health Data, 2 = Clinical Recommendations, 3 = Workouts & Diet
  const [activeWidget, setActiveWidget] = useState<1 | 2 | 3 | null>(null);

  // Edit Health Data Form State
  const [weightInput, setWeightInput] = useState<string>("");
  const [heightInput, setHeightInput] = useState<string>("");
  const [bpInput, setBpInput] = useState<string>("");
  const [sugarInput, setSugarInput] = useState<string>("");
  const [conditionsInput, setConditionsInput] = useState<string[]>([]);
  const [dietPrefInput, setDietPrefInput] = useState<string>("vegetarian");
  const [activityInput, setActivityInput] = useState<string>("moderate");
  const [savingProfile, setSavingProfile] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Modal 2 subtab
  const [widget2Tab, setWidget2Tab] = useState<"tests" | "doctors" | "services">("tests");

  // Modal 3 subtab
  const [widget3Tab, setWidget3Tab] = useState<"workouts" | "diet" | "lifestyle">("workouts");

  const fetchRecommendations = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

      const res = await fetch(`${apiBase}/api/v1/patient/ai-recommendations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        throw new Error(`Advisor engine responded with HTTP ${res.status}`);
      }

      const json = await res.json();
      const result: AIAdvisorData = json.data;
      setData(result);

      if (result.health_profile) {
        setWeightInput(result.health_profile.weight_kg ? String(result.health_profile.weight_kg) : "");
        setHeightInput(result.health_profile.height_cm ? String(result.health_profile.height_cm) : "");
        setBpInput(result.health_profile.blood_pressure || "");
        setSugarInput(result.health_profile.fasting_blood_sugar ? String(result.health_profile.fasting_blood_sugar) : "");
        setConditionsInput(result.health_profile.conditions || []);
        setDietPrefInput(result.health_profile.dietary_preference || "vegetarian");
        setActivityInput(result.health_profile.activity_level || "moderate");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load AI advice.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, []);

  // Compute live BMI for the form
  const parsedWeight = parseFloat(weightInput);
  const parsedHeight = parseFloat(heightInput);
  let liveBmi: number | null = null;
  let liveBmiCat = "Not Recorded";
  let liveBmiColor = "#94a3b8";
  if (parsedWeight > 0 && parsedHeight > 0) {
    const hm = parsedHeight / 100.0;
    liveBmi = Math.round((parsedWeight / (hm * hm)) * 10) / 10;
    if (liveBmi < 18.5) {
      liveBmiCat = "Underweight";
      liveBmiColor = "#38bdf8";
    } else if (liveBmi < 24.9) {
      liveBmiCat = "Normal Weight";
      liveBmiColor = "#4ade80";
    } else if (liveBmi < 29.9) {
      liveBmiCat = "Overweight";
      liveBmiColor = "#facc15";
    } else {
      liveBmiCat = "Obese";
      liveBmiColor = "#ef4444";
    }
  }

  const toggleCondition = (cond: string) => {
    if (cond === "None") {
      setConditionsInput(["None"]);
      return;
    }
    const filtered = conditionsInput.filter((c) => c !== "None");
    if (filtered.includes(cond)) {
      setConditionsInput(filtered.filter((c) => c !== cond));
    } else {
      setConditionsInput([...filtered, cond]);
    }
  };

  const handleSaveHealthProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setSaveSuccessMsg(null);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const payload = {
        weight_kg: parsedWeight > 0 ? parsedWeight : null,
        height_cm: parsedHeight > 0 ? parsedHeight : null,
        blood_pressure: bpInput.trim() || null,
        fasting_blood_sugar: parseFloat(sugarInput) > 0 ? parseFloat(sugarInput) : null,
        conditions: conditionsInput,
        dietary_preference: dietPrefInput,
        activity_level: activityInput,
      };

      const res = await fetch(`${apiBase}/api/v1/patient/health-profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Failed to save health profile.");
      }

      setSaveSuccessMsg("Biometrics updated! Calibrating AI care plan...");
      setTimeout(() => {
        setSaveSuccessMsg(null);
        setActiveWidget(null);
      }, 1200);

      // Re-trigger complete AI recommendations with updated profile
      await fetchRecommendations();
    } catch (err: any) {
      alert(err?.message || "Failed to update profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const profile = data?.health_profile;
  const tests = data?.recommended_tests || [];
  const doctors = data?.recommended_doctors || [];
  const services = data?.recommended_services || [];
  const guidance = data?.care_guidance;

  return (
    <div
      id="ai-health-advisor"
      style={{
        background: "linear-gradient(145deg, #07132b 0%, #0c2352 50%, #071736 100%)",
        border: "1px solid rgba(56, 189, 248, 0.32)",
        borderRadius: "22px",
        padding: "24px 28px",
        boxShadow: "0 20px 50px -10px rgba(0, 0, 0, 0.65), 0 0 35px rgba(14, 165, 233, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
        color: "#f8fafc",
        marginBottom: "24px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* ── Top Header ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
          marginBottom: "20px",
          paddingBottom: "18px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: "linear-gradient(135deg, rgba(14, 165, 233, 0.25) 0%, rgba(37, 99, 235, 0.25) 100%)",
              border: "1px solid rgba(56, 189, 248, 0.45)",
              display: "grid",
              placeItems: "center",
              boxShadow: "0 0 20px rgba(56, 189, 248, 0.3)",
            }}
          >
            <Clinical3DIcon name="ai-report" size={34} glow />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <h3 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 800, color: "#ffffff", letterSpacing: "-0.01em" }}>
                AI Preventive Care Advisor
              </h3>
              <span
                style={{
                  background: "linear-gradient(135deg, rgba(14, 165, 233, 0.2) 0%, rgba(37, 99, 235, 0.2) 100%)",
                  border: "1px solid rgba(56, 189, 248, 0.45)",
                  color: "#38bdf8",
                  padding: "3px 12px",
                  borderRadius: 999,
                  fontSize: "0.72rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Clinical Intelligence
              </span>
            </div>
            <p style={{ margin: "4px 0 0 0", fontSize: "0.84rem", color: "#94a3b8" }}>
              Comprehensive health orchestra: personalized vitals intake, diagnostic screening, and AI lifestyle care.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchRecommendations}
          disabled={loading}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 18px",
            borderRadius: 10,
            background: "rgba(255, 255, 255, 0.08)",
            border: "1px solid rgba(56, 189, 248, 0.3)",
            color: "#38bdf8",
            fontSize: "0.85rem",
            fontWeight: 700,
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
          aria-label="Refresh AI analysis"
        >
          <RefreshCw size={14} className={loading ? "cm-spin-icon" : ""} />
          <span>{loading ? "Analyzing Orchestra..." : "Re-analyze"}</span>
        </button>
      </div>

      {/* ── Summary Strip ── */}
      {data?.health_summary && (
        <div
          style={{
            background: "rgba(14, 165, 233, 0.09)",
            border: "1px solid rgba(56, 189, 248, 0.25)",
            borderRadius: 14,
            padding: "14px 18px",
            marginBottom: "22px",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <ShieldCheck size={20} color="#38bdf8" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: "0.88rem", color: "#e2e8f0", lineHeight: 1.5, fontWeight: 500 }}>
              {data.health_summary}
            </div>
          </div>
          {data.risk_factors && data.risk_factors.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10, paddingLeft: 32 }}>
              {data.risk_factors.map((risk, idx) => (
                <span
                  key={idx}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    padding: "3px 10px",
                    borderRadius: 999,
                    background: "rgba(239, 68, 68, 0.15)",
                    color: "#fca5a5",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                  }}
                >
                  <AlertCircle size={12} />
                  {risk}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 3-Section Columns Layout ── */}
      {loading && !data ? (
        <div style={{ textAlign: "center", padding: "40px 16px", color: "#94a3b8" }}>
          <Clinical3DIcon name="chart" size={44} glow />
          <div style={{ marginTop: 12, fontWeight: 700, fontSize: "1rem", color: "#e2e8f0" }}>
            Calibrating Clinical Health Orchestra...
          </div>
        </div>
      ) : error ? (
        <div
          style={{
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: 12,
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#fca5a5" }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchRecommendations}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              background: "rgba(255, 255, 255, 0.1)",
              color: "#fff",
              border: "none",
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))",
            gap: "20px",
            alignItems: "stretch",
          }}
        >
          {/* ══════════════════════════════════════════════════════════════
              COLUMN 1: Patient Health Data & Vitals
             ══════════════════════════════════════════════════════════════ */}
          <div
            onClick={() => setActiveWidget(1)}
            role="button"
            tabIndex={0}
            style={{
              background: "linear-gradient(145deg, #091a38 0%, #0f2b5c 60%, #091b3d 100%)",
              border: "1px solid rgba(56, 189, 248, 0.3)",
              borderRadius: "18px",
              padding: "22px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              boxShadow: "0 12px 36px -6px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.12)",
              cursor: "pointer",
              transition: "all 0.25s ease",
            }}
          >
            <div>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: "rgba(14, 165, 233, 0.2)",
                      border: "1px solid rgba(56, 189, 248, 0.4)",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <Clinical3DIcon name="care-pulse" size={26} glow />
                  </div>
                  <div>
                    <span style={{ fontSize: "0.72rem", color: "#38bdf8", fontWeight: 800, textTransform: "uppercase" }}>
                      Section 01 · Biometrics
                    </span>
                    <h4 style={{ margin: "2px 0 0 0", fontSize: "1.08rem", fontWeight: 800, color: "#ffffff" }}>
                      Health Profile &amp; Vitals
                    </h4>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    padding: "3px 10px",
                    borderRadius: 999,
                    background: profile?.bmi ? "rgba(34, 197, 94, 0.2)" : "rgba(245, 158, 11, 0.2)",
                    color: profile?.bmi ? "#4ade80" : "#fbbf24",
                    border: `1px solid ${profile?.bmi ? "rgba(74, 222, 128, 0.35)" : "rgba(251, 191, 36, 0.35)"}`,
                  }}
                >
                  {profile?.bmi ? `BMI: ${profile.bmi}` : "Intake Ready ⚡"}
                </span>
              </div>

              <p style={{ fontSize: "0.82rem", color: "#94a3b8", margin: "0 0 16px 0", lineHeight: 1.4 }}>
                Continuous biometric intake: weight, height, BMI engine, blood pressure, fasting glucose &amp; conditions.
              </p>

              {/* 4 Metric Dials */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "10px",
                  marginBottom: "14px",
                }}
              >
                <div
                  style={{
                    background: "rgba(11, 24, 54, 0.6)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: 10,
                    padding: "10px 12px",
                  }}
                >
                  <div style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: 600 }}>BMI &amp; Category</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#38bdf8", marginTop: 2 }}>
                    {profile?.bmi || "—"}
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "#4ade80", fontWeight: 600, marginTop: 1 }}>
                    {profile?.bmi_category || "Not Recorded"}
                  </div>
                </div>

                <div
                  style={{
                    background: "rgba(11, 24, 54, 0.6)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: 10,
                    padding: "10px 12px",
                  }}
                >
                  <div style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: 600 }}>Weight / Height</div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#ffffff", marginTop: 2 }}>
                    {profile?.weight_kg ? `${profile.weight_kg} kg` : "—"} · {profile?.height_cm ? `${profile.height_cm} cm` : "—"}
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: 1 }}>
                    BP: {profile?.blood_pressure || "—"}
                  </div>
                </div>
              </div>

              {/* Conditions Chips */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                {profile?.conditions && profile.conditions.length > 0 ? (
                  profile.conditions.slice(0, 3).map((c, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: "0.72rem",
                        padding: "2px 8px",
                        borderRadius: 6,
                        background: "rgba(14, 165, 233, 0.15)",
                        color: "#7dd3fc",
                        border: "1px solid rgba(56, 189, 248, 0.25)",
                      }}
                    >
                      {c}
                    </span>
                  ))
                ) : (
                  <span style={{ fontSize: "0.72rem", color: "#64748b" }}>No chronic conditions logged</span>
                )}
              </div>
            </div>

            {/* Bottom CTA */}
            <button
              type="button"
              style={{
                width: "100%",
                padding: "10px 16px",
                borderRadius: 999,
                background: "linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)",
                color: "#ffffff",
                border: "none",
                fontWeight: 700,
                fontSize: "0.85rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                boxShadow: "0 4px 14px rgba(14, 165, 233, 0.35)",
                marginTop: 8,
              }}
            >
              <Zap size={14} /> Calibrate Biometrics &amp; Vitals
            </button>
          </div>

          {/* ══════════════════════════════════════════════════════════════
              COLUMN 2: Recommended Tests, Services & Doctor Consultations
             ══════════════════════════════════════════════════════════════ */}
          <div
            onClick={() => setActiveWidget(2)}
            role="button"
            tabIndex={0}
            style={{
              background: "linear-gradient(145deg, #091a38 0%, #0f2b5c 60%, #091b3d 100%)",
              border: "1px solid rgba(56, 189, 248, 0.3)",
              borderRadius: "18px",
              padding: "22px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              boxShadow: "0 12px 36px -6px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.12)",
              cursor: "pointer",
              transition: "all 0.25s ease",
            }}
          >
            <div>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: "rgba(34, 197, 94, 0.2)",
                      border: "1px solid rgba(74, 222, 128, 0.4)",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <Clinical3DIcon name="droplet" size={26} glow />
                  </div>
                  <div>
                    <span style={{ fontSize: "0.72rem", color: "#4ade80", fontWeight: 800, textTransform: "uppercase" }}>
                      Section 02 · Preventive Tests
                    </span>
                    <h4 style={{ margin: "2px 0 0 0", fontSize: "1.08rem", fontWeight: 800, color: "#ffffff" }}>
                      Diagnostics &amp; Doctors
                    </h4>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    padding: "3px 10px",
                    borderRadius: 999,
                    background: "rgba(14, 165, 233, 0.2)",
                    color: "#38bdf8",
                    border: "1px solid rgba(56, 189, 248, 0.35)",
                  }}
                >
                  {tests.length + doctors.length} Matches
                </span>
              </div>

              <p style={{ fontSize: "0.82rem", color: "#94a3b8", margin: "0 0 16px 0", lineHeight: 1.4 }}>
                Targeted clinical lab screenings, specialist consultations &amp; home healthcare visits.
              </p>

              {/* Preview Rows */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                {tests.slice(0, 2).map((t, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: "rgba(11, 24, 54, 0.6)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      borderRadius: 10,
                      padding: "8px 12px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#38bdf8" }} />
                      <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#fff" }}>{t.test_name}</span>
                    </div>
                    <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#4ade80" }}>
                      ₹{t.estimated_price || 499}
                    </span>
                  </div>
                ))}
                {doctors.slice(0, 1).map((d, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: "rgba(11, 24, 54, 0.6)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      borderRadius: 10,
                      padding: "8px 12px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80" }} />
                      <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#fff" }}>{d.specialty}</span>
                    </div>
                    <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>Consult</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom CTA */}
            <button
              type="button"
              style={{
                width: "100%",
                padding: "10px 16px",
                borderRadius: 999,
                background: "linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)",
                color: "#ffffff",
                border: "none",
                fontWeight: 700,
                fontSize: "0.85rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                boxShadow: "0 4px 14px rgba(14, 165, 233, 0.35)",
                marginTop: 8,
              }}
            >
              <FlaskConical size={14} /> Explore Diagnostic Network →
            </button>
          </div>

          {/* ══════════════════════════════════════════════════════════════
              COLUMN 3: Workouts, Hydration & Targeted Nutrition
             ══════════════════════════════════════════════════════════════ */}
          <div
            onClick={() => setActiveWidget(3)}
            role="button"
            tabIndex={0}
            style={{
              background: "linear-gradient(145deg, #091a38 0%, #0f2b5c 60%, #091b3d 100%)",
              border: "1px solid rgba(56, 189, 248, 0.3)",
              borderRadius: "18px",
              padding: "22px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              boxShadow: "0 12px 36px -6px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.12)",
              cursor: "pointer",
              transition: "all 0.25s ease",
            }}
          >
            <div>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: "rgba(168, 85, 247, 0.2)",
                      border: "1px solid rgba(192, 132, 252, 0.4)",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <Clinical3DIcon name="dietitian" size={26} glow />
                  </div>
                  <div>
                    <span style={{ fontSize: "0.72rem", color: "#c084fc", fontWeight: 800, textTransform: "uppercase" }}>
                      Section 03 · Lifestyle &amp; Diet
                    </span>
                    <h4 style={{ margin: "2px 0 0 0", fontSize: "1.08rem", fontWeight: 800, color: "#ffffff" }}>
                      Workouts &amp; Diet Care
                    </h4>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    padding: "3px 10px",
                    borderRadius: 999,
                    background: "rgba(168, 85, 247, 0.2)",
                    color: "#c084fc",
                    border: "1px solid rgba(192, 132, 252, 0.35)",
                  }}
                >
                  Active Plan
                </span>
              </div>

              <p style={{ fontSize: "0.82rem", color: "#94a3b8", margin: "0 0 16px 0", lineHeight: 1.4 }}>
                Condition-calibrated physical training protocol, hydration targets, and dietary guidance.
              </p>

              {/* Preview Rows */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                <div
                  style={{
                    background: "rgba(11, 24, 54, 0.6)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: 10,
                    padding: "8px 12px",
                  }}
                >
                  <div style={{ fontSize: "0.72rem", color: "#c084fc", fontWeight: 700 }}>Exercise Routine</div>
                  <div style={{ fontSize: "0.84rem", fontWeight: 700, color: "#ffffff", marginTop: 2 }}>
                    {guidance?.workouts?.weekly_frequency || "5 days/week aerobic & mobility"}
                  </div>
                </div>

                <div
                  style={{
                    background: "rgba(11, 24, 54, 0.6)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: 10,
                    padding: "8px 12px",
                  }}
                >
                  <div style={{ fontSize: "0.72rem", color: "#38bdf8", fontWeight: 700 }}>Hydration Target</div>
                  <div style={{ fontSize: "0.84rem", fontWeight: 700, color: "#ffffff", marginTop: 2 }}>
                    {guidance?.diet_plan?.hydration_target || "2.5 – 3.0 Liters daily"}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom CTA */}
            <button
              type="button"
              style={{
                width: "100%",
                padding: "10px 16px",
                borderRadius: 999,
                background: "linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)",
                color: "#ffffff",
                border: "none",
                fontWeight: 700,
                fontSize: "0.85rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                boxShadow: "0 4px 14px rgba(14, 165, 233, 0.35)",
                marginTop: 8,
              }}
            >
              <Bike size={14} /> View Regimen &amp; Care Plan →
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          GLASSMORPHIC WIDGET MODAL 1: HEALTH PROFILE & VITALS INTAKE
          (Styled identically to Image 1 Gold Standard)
         ══════════════════════════════════════════════════════════════════════ */}
      {activeWidget === 1 && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999,
            background: "rgba(2, 6, 23, 0.82)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={() => setActiveWidget(null)}
        >
          <div
            style={{
              background: "linear-gradient(145deg, #07132b 0%, #0d2149 50%, #081938 100%)",
              border: "1px solid rgba(56, 189, 248, 0.35)",
              boxShadow: "0 25px 60px -12px rgba(0, 0, 0, 0.85), 0 0 45px rgba(14, 165, 233, 0.2)",
              borderRadius: "22px",
              maxWidth: "840px",
              width: "94vw",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              color: "#f8fafc",
            }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "rgba(15, 23, 42, 0.4)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: "rgba(2, 132, 199, 0.25)",
                    border: "1px solid rgba(56, 189, 248, 0.45)",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <Clinical3DIcon name="care-pulse" size={26} glow />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "#fff" }}>
                    Patient Health Profile &amp; Biometrics
                  </h3>
                  <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: 2 }}>
                    Continuous clinical intake to calibrate AI diagnostics &amp; risk engines
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveWidget(null)}
                style={{
                  background: "rgba(56, 189, 248, 0.15)",
                  border: "1px solid rgba(56, 189, 248, 0.3)",
                  color: "#cbd5e1",
                  borderRadius: "50%",
                  width: 34,
                  height: 34,
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                aria-label="Close modal"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <form
              onSubmit={handleSaveHealthProfile}
              style={{
                padding: "20px 24px",
                overflowY: "auto",
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: "18px",
              }}
            >
              {saveSuccessMsg && (
                <div
                  style={{
                    background: "rgba(34, 197, 94, 0.15)",
                    border: "1px solid rgba(34, 197, 94, 0.4)",
                    color: "#4ade80",
                    borderRadius: 10,
                    padding: "12px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontWeight: 600,
                    fontSize: "0.88rem",
                  }}
                >
                  <CheckCircle2 size={16} />
                  <span>{saveSuccessMsg}</span>
                </div>
              )}

              {/* 2x2 Input Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#cbd5e1", marginBottom: 6 }}>
                    ⚖️ Weight (kg)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="20"
                    max="300"
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                    placeholder="e.g. 68.5"
                    required
                    style={{
                      background: "rgba(11, 22, 48, 0.9)",
                      border: "1px solid rgba(56, 189, 248, 0.3)",
                      color: "#ffffff",
                      borderRadius: 10,
                      padding: "12px 16px",
                      fontSize: "0.95rem",
                      fontWeight: 600,
                      outline: "none",
                      width: "100%",
                      boxSizing: "border-box",
                      boxShadow: "inset 0 2px 4px rgba(0, 0, 0, 0.4)",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#cbd5e1", marginBottom: 6 }}>
                    📏 Height (cm)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="80"
                    max="250"
                    value={heightInput}
                    onChange={(e) => setHeightInput(e.target.value)}
                    placeholder="e.g. 172"
                    required
                    style={{
                      background: "rgba(11, 22, 48, 0.9)",
                      border: "1px solid rgba(56, 189, 248, 0.3)",
                      color: "#ffffff",
                      borderRadius: 10,
                      padding: "12px 16px",
                      fontSize: "0.95rem",
                      fontWeight: 600,
                      outline: "none",
                      width: "100%",
                      boxSizing: "border-box",
                      boxShadow: "inset 0 2px 4px rgba(0, 0, 0, 0.4)",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#cbd5e1", marginBottom: 6 }}>
                    🩺 Blood Pressure (mmHg)
                  </label>
                  <input
                    type="text"
                    value={bpInput}
                    onChange={(e) => setBpInput(e.target.value)}
                    placeholder="e.g. 120/80"
                    style={{
                      background: "rgba(11, 22, 48, 0.9)",
                      border: "1px solid rgba(56, 189, 248, 0.3)",
                      color: "#ffffff",
                      borderRadius: 10,
                      padding: "12px 16px",
                      fontSize: "0.95rem",
                      fontWeight: 600,
                      outline: "none",
                      width: "100%",
                      boxSizing: "border-box",
                      boxShadow: "inset 0 2px 4px rgba(0, 0, 0, 0.4)",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#cbd5e1", marginBottom: 6 }}>
                    🩸 Fasting Blood Sugar (mg/dL)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="40"
                    max="500"
                    value={sugarInput}
                    onChange={(e) => setSugarInput(e.target.value)}
                    placeholder="e.g. 95"
                    style={{
                      background: "rgba(11, 22, 48, 0.9)",
                      border: "1px solid rgba(56, 189, 248, 0.3)",
                      color: "#ffffff",
                      borderRadius: 10,
                      padding: "12px 16px",
                      fontSize: "0.95rem",
                      fontWeight: 600,
                      outline: "none",
                      width: "100%",
                      boxSizing: "border-box",
                      boxShadow: "inset 0 2px 4px rgba(0, 0, 0, 0.4)",
                    }}
                  />
                </div>
              </div>

              {/* Dynamic Live BMI Gauge Banner */}
              <div
                style={{
                  background: "rgba(11, 24, 54, 0.7)",
                  border: "1px solid rgba(56, 189, 248, 0.25)",
                  borderRadius: 14,
                  padding: "16px 20px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: "0.84rem", fontWeight: 700, color: "#94a3b8" }}>
                    Calculated Body Mass Index (BMI)
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: "1.4rem", fontWeight: 900, color: liveBmiColor }}>
                      {liveBmi ? `${liveBmi}` : "—"}
                    </span>
                    <span
                      style={{
                        padding: "3px 12px",
                        borderRadius: 999,
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        background: `${liveBmiColor}25`,
                        color: liveBmiColor,
                        border: `1px solid ${liveBmiColor}60`,
                      }}
                    >
                      {liveBmiCat}
                    </span>
                  </div>
                </div>

                {/* Visual Spectrum Track */}
                <div
                  style={{
                    height: 10,
                    borderRadius: 5,
                    background: "linear-gradient(to right, #38bdf8 0%, #38bdf8 18.5%, #4ade80 18.5%, #4ade80 24.9%, #facc15 24.9%, #facc15 29.9%, #ef4444 29.9%, #ef4444 100%)",
                    position: "relative",
                    margin: "12px 0 8px 0",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: `${Math.min(100, Math.max(0, (((liveBmi || 22) - 15) / (38 - 15)) * 100))}%`,
                      transform: "translate(-50%, -50%)",
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: "#ffffff",
                      border: "3px solid #07132b",
                      boxShadow: "0 0 12px rgba(255, 255, 255, 0.9)",
                      transition: "left 0.3s ease",
                    }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "#64748b" }}>
                  <span>Underweight (&lt;18.5)</span>
                  <span style={{ color: "#4ade80", fontWeight: 700 }}>Optimal (18.5–24.9)</span>
                  <span>Overweight (25–29.9)</span>
                  <span>Obese (≥30)</span>
                </div>
              </div>

              {/* Chronic Conditions Multi-Select */}
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#cbd5e1", marginBottom: 8 }}>
                  Existing Health Conditions (Select all that apply)
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {COMMON_CONDITIONS.map((cond) => {
                    const isSelected = conditionsInput.includes(cond);
                    return (
                      <button
                        type="button"
                        key={cond}
                        onClick={() => toggleCondition(cond)}
                        style={{
                          padding: "8px 16px",
                          borderRadius: 999,
                          border: isSelected ? "1px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.12)",
                          background: isSelected
                            ? "linear-gradient(135deg, rgba(14, 165, 233, 0.35) 0%, rgba(37, 99, 235, 0.35) 100%)"
                            : "rgba(15, 27, 56, 0.7)",
                          color: isSelected ? "#ffffff" : "#94a3b8",
                          fontSize: "0.82rem",
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          boxShadow: isSelected ? "0 0 12px rgba(56, 189, 248, 0.35)" : "none",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {isSelected && <Check size={13} color="#38bdf8" />}
                        <span>{cond}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Lifestyle / Activity & Diet Pref */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#cbd5e1", marginBottom: 6 }}>
                    Dietary Preference
                  </label>
                  <select
                    value={dietPrefInput}
                    onChange={(e) => setDietPrefInput(e.target.value)}
                    style={{
                      background: "#0c1b3a",
                      border: "1px solid rgba(56, 189, 248, 0.3)",
                      color: "#ffffff",
                      padding: "12px 16px",
                      borderRadius: 10,
                      fontSize: "0.9rem",
                      width: "100%",
                      outline: "none",
                      cursor: "pointer",
                    }}
                  >
                    {DIET_PREFERENCES.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#cbd5e1", marginBottom: 6 }}>
                    Activity Level
                  </label>
                  <select
                    value={activityInput}
                    onChange={(e) => setActivityInput(e.target.value)}
                    style={{
                      background: "#0c1b3a",
                      border: "1px solid rgba(56, 189, 248, 0.3)",
                      color: "#ffffff",
                      padding: "12px 16px",
                      borderRadius: 10,
                      fontSize: "0.9rem",
                      width: "100%",
                      outline: "none",
                      cursor: "pointer",
                    }}
                  >
                    {ACTIVITY_LEVELS.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  padding: "16px 24px",
                  borderTop: "1px solid rgba(255, 255, 255, 0.1)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "rgba(15, 23, 42, 0.45)",
                  marginTop: 10,
                  borderRadius: "0 0 22px 22px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.82rem", color: "#94a3b8" }}>
                  <CheckCircle2 size={16} color="#38bdf8" />
                  <span style={{ color: "#cbd5e1", fontWeight: 600 }}>CallMedex Verified Healthcare Protocol</span>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setActiveWidget(null)}
                    style={{
                      padding: "8px 18px",
                      borderRadius: 10,
                      background: "rgba(255, 255, 255, 0.08)",
                      color: "#cbd5e1",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      fontWeight: 600,
                      fontSize: "0.85rem",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingProfile}
                    style={{
                      padding: "8px 24px",
                      borderRadius: 10,
                      background: "#0284c7",
                      color: "#ffffff",
                      border: "none",
                      fontWeight: 700,
                      fontSize: "0.88rem",
                      cursor: "pointer",
                      boxShadow: "0 2px 10px rgba(2, 132, 199, 0.4)",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {savingProfile ? "Saving & Syncing..." : "Save & Sync Health Data"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          GLASSMORPHIC WIDGET MODAL 2: CLINICAL RECOMMENDATIONS & DOCTORS
          (Styled identically to Image 1 Gold Standard)
         ══════════════════════════════════════════════════════════════════════ */}
      {activeWidget === 2 && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999,
            background: "rgba(2, 6, 23, 0.82)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={() => setActiveWidget(null)}
        >
          <div
            style={{
              background: "linear-gradient(145deg, #07132b 0%, #0d2149 50%, #081938 100%)",
              border: "1px solid rgba(56, 189, 248, 0.35)",
              boxShadow: "0 25px 60px -12px rgba(0, 0, 0, 0.85), 0 0 45px rgba(14, 165, 233, 0.2)",
              borderRadius: "22px",
              maxWidth: "840px",
              width: "94vw",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              color: "#f8fafc",
            }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "rgba(15, 23, 42, 0.4)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: "rgba(34, 197, 94, 0.25)",
                    border: "1px solid rgba(74, 222, 128, 0.45)",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <Clinical3DIcon name="droplet" size={26} glow />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "#fff" }}>
                    Clinical Recommendations &amp; Care Network
                  </h3>
                  <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: 2 }}>
                    Personalized diagnostic screening panels, specialist clinician consultations &amp; home care
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveWidget(null)}
                style={{
                  background: "rgba(56, 189, 248, 0.15)",
                  border: "1px solid rgba(56, 189, 248, 0.3)",
                  color: "#cbd5e1",
                  borderRadius: "50%",
                  width: 34,
                  height: 34,
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                aria-label="Close modal"
              >
                <X size={16} />
              </button>
            </div>

            {/* Segmented Subtab Bar */}
            <div
              style={{
                padding: "12px 24px 0 24px",
                display: "flex",
                gap: 8,
                background: "rgba(11, 22, 48, 0.5)",
              }}
            >
              <button
                type="button"
                onClick={() => setWidget2Tab("tests")}
                style={{
                  padding: "8px 18px",
                  borderRadius: 8,
                  border: "none",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  background: widget2Tab === "tests" ? "linear-gradient(135deg, #0ea5e9, #2563eb)" : "transparent",
                  color: widget2Tab === "tests" ? "#fff" : "#94a3b8",
                  boxShadow: widget2Tab === "tests" ? "0 4px 12px rgba(14, 165, 233, 0.3)" : "none",
                }}
              >
                Diagnostic Panels ({tests.length})
              </button>
              <button
                type="button"
                onClick={() => setWidget2Tab("doctors")}
                style={{
                  padding: "8px 18px",
                  borderRadius: 8,
                  border: "none",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  background: widget2Tab === "doctors" ? "linear-gradient(135deg, #0ea5e9, #2563eb)" : "transparent",
                  color: widget2Tab === "doctors" ? "#fff" : "#94a3b8",
                  boxShadow: widget2Tab === "doctors" ? "0 4px 12px rgba(14, 165, 233, 0.3)" : "none",
                }}
              >
                Specialist Doctors ({doctors.length})
              </button>
              <button
                type="button"
                onClick={() => setWidget2Tab("services")}
                style={{
                  padding: "8px 18px",
                  borderRadius: 8,
                  border: "none",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  background: widget2Tab === "services" ? "linear-gradient(135deg, #0ea5e9, #2563eb)" : "transparent",
                  color: widget2Tab === "services" ? "#fff" : "#94a3b8",
                  boxShadow: widget2Tab === "services" ? "0 4px 12px rgba(14, 165, 233, 0.3)" : "none",
                }}
              >
                Doorstep Services ({services.length})
              </button>
            </div>

            {/* Modal Body */}
            <div
              style={{
                padding: "20px 24px",
                overflowY: "auto",
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {widget2Tab === "tests" && (
                <>
                  {tests.length > 0 ? (
                    tests.map((test, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: "rgba(11, 24, 54, 0.7)",
                          border: "1px solid rgba(56, 189, 248, 0.25)",
                          borderRadius: 14,
                          padding: "16px 18px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 16,
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 220 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <span
                              style={{
                                fontSize: "0.7rem",
                                fontWeight: 800,
                                padding: "2px 8px",
                                borderRadius: 6,
                                background: "rgba(14, 165, 233, 0.2)",
                                color: "#38bdf8",
                                border: "1px solid rgba(56, 189, 248, 0.4)",
                                textTransform: "uppercase",
                              }}
                            >
                              Recommended
                            </span>
                            <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{test.category}</span>
                          </div>
                          <div style={{ fontSize: "1rem", fontWeight: 800, color: "#fff" }}>{test.test_name}</div>
                          <div style={{ fontSize: "0.8rem", color: "#cbd5e1", marginTop: 4 }}>{test.reason}</div>
                          <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: 4 }}>
                            CallMedex Central Pathology · NABL &amp; CAP Accredited
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "#4ade80" }}>
                              ₹{test.estimated_price || 499}
                            </div>
                            <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>Home Sample</div>
                          </div>
                          <Link
                            href={test.action_url || "/booking"}
                            style={{
                              padding: "8px 18px",
                              borderRadius: 8,
                              background: "linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)",
                              color: "#fff",
                              fontWeight: 700,
                              fontSize: "0.82rem",
                              textDecoration: "none",
                              boxShadow: "0 4px 12px rgba(14, 165, 233, 0.35)",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            Book Test →
                          </Link>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div
                      style={{
                        textAlign: "center",
                        padding: "48px 24px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <div
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: 16,
                          background: "rgba(14, 165, 233, 0.15)",
                          border: "1px solid rgba(56, 189, 248, 0.3)",
                          display: "grid",
                          placeItems: "center",
                          marginBottom: 4,
                        }}
                      >
                        <Clinical3DIcon name="chart" size={36} glow />
                      </div>
                      <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#ffffff" }}>
                        No urgent diagnostic panels flagged
                      </div>
                      <div style={{ fontSize: "0.84rem", color: "#94a3b8", maxWidth: 400, lineHeight: 1.5 }}>
                        Need routine medical screening, comprehensive annual wellness, or diagnostic blood tests?
                      </div>
                      <Link
                        href="/booking"
                        style={{
                          marginTop: 8,
                          padding: "10px 24px",
                          borderRadius: 999,
                          background: "#0284c7",
                          color: "#ffffff",
                          fontWeight: 700,
                          fontSize: "0.85rem",
                          textDecoration: "none",
                          boxShadow: "0 4px 14px rgba(2, 132, 199, 0.4)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        Book Diagnostic Blood Test →
                      </Link>
                    </div>
                  )}
                </>
              )}

              {widget2Tab === "doctors" && (
                <>
                  {doctors.length > 0 ? (
                    doctors.map((doc, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: "rgba(11, 24, 54, 0.7)",
                          border: "1px solid rgba(56, 189, 248, 0.25)",
                          borderRadius: 14,
                          padding: "16px 18px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 16,
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 220 }}>
                          <div style={{ fontSize: "0.72rem", color: "#38bdf8", fontWeight: 700, textTransform: "uppercase" }}>
                            Specialty Match
                          </div>
                          <div style={{ fontSize: "1rem", fontWeight: 800, color: "#fff", marginTop: 2 }}>
                            {doc.title || doc.specialty}
                          </div>
                          <div style={{ fontSize: "0.8rem", color: "#cbd5e1", marginTop: 4 }}>{doc.reason}</div>
                        </div>

                        <Link
                          href={doc.action_url || "/booking"}
                          style={{
                            padding: "8px 18px",
                            borderRadius: 8,
                            background: "linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)",
                            color: "#fff",
                            fontWeight: 700,
                            fontSize: "0.82rem",
                            textDecoration: "none",
                            boxShadow: "0 4px 12px rgba(14, 165, 233, 0.35)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          Consult Doctor →
                        </Link>
                      </div>
                    ))
                  ) : (
                    <div
                      style={{
                        textAlign: "center",
                        padding: "48px 24px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <div
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: 16,
                          background: "rgba(14, 165, 233, 0.15)",
                          border: "1px solid rgba(56, 189, 248, 0.3)",
                          display: "grid",
                          placeItems: "center",
                          marginBottom: 4,
                        }}
                      >
                        <Clinical3DIcon name="stethoscope" size={36} glow />
                      </div>
                      <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#ffffff" }}>
                        No specialist consultations currently scheduled
                      </div>
                      <div style={{ fontSize: "0.84rem", color: "#94a3b8", maxWidth: 400, lineHeight: 1.5 }}>
                        Connect with verified cardiologists, endocrinologists, or general physicians.
                      </div>
                      <Link
                        href="/booking"
                        style={{
                          marginTop: 8,
                          padding: "10px 24px",
                          borderRadius: 999,
                          background: "#0284c7",
                          color: "#ffffff",
                          fontWeight: 700,
                          fontSize: "0.85rem",
                          textDecoration: "none",
                          boxShadow: "0 4px 14px rgba(2, 132, 199, 0.4)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        Book Doctor Consultation →
                      </Link>
                    </div>
                  )}
                </>
              )}

              {widget2Tab === "services" && (
                <>
                  {services.length > 0 ? (
                    services.map((svc, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: "rgba(11, 24, 54, 0.7)",
                          border: "1px solid rgba(56, 189, 248, 0.25)",
                          borderRadius: 14,
                          padding: "16px 18px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 16,
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 220 }}>
                          <div style={{ fontSize: "0.72rem", color: "#4ade80", fontWeight: 700, textTransform: "uppercase" }}>
                            Doorstep Service
                          </div>
                          <div style={{ fontSize: "1rem", fontWeight: 800, color: "#fff", marginTop: 2 }}>
                            {svc.service_name}
                          </div>
                          <div style={{ fontSize: "0.8rem", color: "#cbd5e1", marginTop: 4 }}>{svc.reason}</div>
                        </div>

                        <Link
                          href={svc.action_url || "/booking"}
                          style={{
                            padding: "8px 18px",
                            borderRadius: 8,
                            background: "linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)",
                            color: "#fff",
                            fontWeight: 700,
                            fontSize: "0.82rem",
                            textDecoration: "none",
                            boxShadow: "0 4px 12px rgba(14, 165, 233, 0.35)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          Request Visit →
                        </Link>
                      </div>
                    ))
                  ) : (
                    <div
                      style={{
                        textAlign: "center",
                        padding: "48px 24px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <div
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: 16,
                          background: "rgba(14, 165, 233, 0.15)",
                          border: "1px solid rgba(56, 189, 248, 0.3)",
                          display: "grid",
                          placeItems: "center",
                          marginBottom: 4,
                        }}
                      >
                        <Clinical3DIcon name="nurse" size={36} glow />
                      </div>
                      <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#ffffff" }}>
                        No doorstep home visits currently scheduled
                      </div>
                      <div style={{ fontSize: "0.84rem", color: "#94a3b8", maxWidth: 400, lineHeight: 1.5 }}>
                        Need certified nurse visits, phlebotomy, home physiotherapy, or medical oxygen setup?
                      </div>
                      <Link
                        href="/booking"
                        style={{
                          marginTop: 8,
                          padding: "10px 24px",
                          borderRadius: 999,
                          background: "#0284c7",
                          color: "#ffffff",
                          fontWeight: 700,
                          fontSize: "0.85rem",
                          textDecoration: "none",
                          boxShadow: "0 4px 14px rgba(2, 132, 199, 0.4)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        Book Doorstep Healthcare →
                      </Link>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: "16px 24px",
                borderTop: "1px solid rgba(255, 255, 255, 0.1)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "rgba(15, 23, 42, 0.45)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.82rem", color: "#94a3b8" }}>
                <CheckCircle2 size={16} color="#38bdf8" />
                <span style={{ color: "#cbd5e1", fontWeight: 600 }}>CallMedex Verified Healthcare Protocol</span>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <Link
                  href="/booking"
                  style={{
                    padding: "8px 18px",
                    borderRadius: 10,
                    background: "rgba(56, 189, 248, 0.1)",
                    color: "#38bdf8",
                    border: "1px solid rgba(56, 189, 248, 0.3)",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  Open Booking Wizard →
                </Link>
                <button
                  type="button"
                  onClick={() => setActiveWidget(null)}
                  style={{
                    padding: "8px 24px",
                    borderRadius: 10,
                    background: "#0284c7",
                    color: "#ffffff",
                    border: "none",
                    fontWeight: 700,
                    fontSize: "0.88rem",
                    cursor: "pointer",
                    boxShadow: "0 2px 10px rgba(2, 132, 199, 0.4)",
                    transition: "all 0.15s ease",
                  }}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          GLASSMORPHIC WIDGET MODAL 3: WORKOUTS & DIET CARE
          (Styled identically to Image 1 Gold Standard)
         ══════════════════════════════════════════════════════════════════════ */}
      {activeWidget === 3 && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999,
            background: "rgba(2, 6, 23, 0.82)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={() => setActiveWidget(null)}
        >
          <div
            style={{
              background: "linear-gradient(145deg, #07132b 0%, #0d2149 50%, #081938 100%)",
              border: "1px solid rgba(56, 189, 248, 0.35)",
              boxShadow: "0 25px 60px -12px rgba(0, 0, 0, 0.85), 0 0 45px rgba(14, 165, 233, 0.2)",
              borderRadius: "22px",
              maxWidth: "840px",
              width: "94vw",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              color: "#f8fafc",
            }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "rgba(15, 23, 42, 0.4)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: "rgba(168, 85, 247, 0.25)",
                    border: "1px solid rgba(192, 132, 252, 0.45)",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <Clinical3DIcon name="dietitian" size={26} glow />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "#fff" }}>
                    Personalized Care Guidance &amp; Lifestyle Architecture
                  </h3>
                  <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: 2 }}>
                    Clinical-grade physical conditioning, daily hydration &amp; targeted nutrition
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveWidget(null)}
                style={{
                  background: "rgba(56, 189, 248, 0.15)",
                  border: "1px solid rgba(56, 189, 248, 0.3)",
                  color: "#cbd5e1",
                  borderRadius: "50%",
                  width: 34,
                  height: 34,
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                aria-label="Close modal"
              >
                <X size={16} />
              </button>
            </div>

            {/* Segmented Subtabs */}
            <div
              style={{
                padding: "12px 24px 0 24px",
                display: "flex",
                gap: 8,
                background: "rgba(11, 22, 48, 0.5)",
              }}
            >
              <button
                type="button"
                onClick={() => setWidget3Tab("workouts")}
                style={{
                  padding: "8px 18px",
                  borderRadius: 8,
                  border: "none",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  background: widget3Tab === "workouts" ? "linear-gradient(135deg, #8b5cf6, #6366f1)" : "transparent",
                  color: widget3Tab === "workouts" ? "#fff" : "#94a3b8",
                  boxShadow: widget3Tab === "workouts" ? "0 4px 12px rgba(139, 92, 246, 0.3)" : "none",
                }}
              >
                Physical Conditioning
              </button>
              <button
                type="button"
                onClick={() => setWidget3Tab("diet")}
                style={{
                  padding: "8px 18px",
                  borderRadius: 8,
                  border: "none",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  background: widget3Tab === "diet" ? "linear-gradient(135deg, #0ea5e9, #2563eb)" : "transparent",
                  color: widget3Tab === "diet" ? "#fff" : "#94a3b8",
                  boxShadow: widget3Tab === "diet" ? "0 4px 12px rgba(14, 165, 233, 0.3)" : "none",
                }}
              >
                Nutrition &amp; Hydration
              </button>
              <button
                type="button"
                onClick={() => setWidget3Tab("lifestyle")}
                style={{
                  padding: "8px 18px",
                  borderRadius: 8,
                  border: "none",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  background: widget3Tab === "lifestyle" ? "linear-gradient(135deg, #10b981, #059669)" : "transparent",
                  color: widget3Tab === "lifestyle" ? "#fff" : "#94a3b8",
                  boxShadow: widget3Tab === "lifestyle" ? "0 4px 12px rgba(16, 185, 129, 0.3)" : "none",
                }}
              >
                Circadian &amp; Lifestyle
              </button>
            </div>

            {/* Modal Body */}
            <div
              style={{
                padding: "20px 24px",
                overflowY: "auto",
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              {widget3Tab === "workouts" && (
                <>
                  <div
                    style={{
                      background: "rgba(11, 24, 54, 0.7)",
                      border: "1px solid rgba(192, 132, 252, 0.3)",
                      borderRadius: 14,
                      padding: "16px 20px",
                    }}
                  >
                    <div style={{ fontSize: "0.75rem", color: "#c084fc", fontWeight: 800, textTransform: "uppercase" }}>
                      Weekly Training Schedule
                    </div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#fff", marginTop: 2 }}>
                      {guidance?.workouts?.weekly_frequency || "5 Days per Week"}
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div
                      style={{
                        background: "rgba(11, 24, 54, 0.6)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        borderRadius: 12,
                        padding: "14px 16px",
                      }}
                    >
                      <div style={{ fontSize: "0.75rem", color: "#38bdf8", fontWeight: 700 }}>Warm-up Phase</div>
                      <div style={{ fontSize: "0.88rem", color: "#e2e8f0", marginTop: 4 }}>
                        {guidance?.workouts?.warmup || "5–10 min dynamic joint mobility, arm circles & light walking"}
                      </div>
                    </div>

                    <div
                      style={{
                        background: "rgba(11, 24, 54, 0.6)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        borderRadius: 12,
                        padding: "14px 16px",
                      }}
                    >
                      <div style={{ fontSize: "0.75rem", color: "#38bdf8", fontWeight: 700 }}>Cardiovascular Conditioning</div>
                      <div style={{ fontSize: "0.88rem", color: "#e2e8f0", marginTop: 4 }}>
                        {guidance?.workouts?.cardio || "30 min brisk walk, cycling, or swimming at 60–70% max HR"}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      background: "rgba(11, 24, 54, 0.6)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      borderRadius: 12,
                      padding: "14px 16px",
                    }}
                  >
                    <div style={{ fontSize: "0.75rem", color: "#38bdf8", fontWeight: 700 }}>Strength &amp; Musculoskeletal Mobility</div>
                    <div style={{ fontSize: "0.88rem", color: "#e2e8f0", marginTop: 4 }}>
                      {guidance?.workouts?.strength_and_mobility || "Bodyweight squats, wall-pushups, resistance band rows & core isometric holds"}
                    </div>
                  </div>

                  <div
                    style={{
                      background: "rgba(245, 158, 11, 0.08)",
                      border: "1px solid rgba(245, 158, 11, 0.25)",
                      borderRadius: 12,
                      padding: "12px 16px",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <AlertCircle size={18} color="#fbbf24" style={{ flexShrink: 0 }} />
                    <div style={{ fontSize: "0.82rem", color: "#fde68a" }}>
                      <strong>Precautions:</strong> {guidance?.workouts?.precautions || "Stay hydrated; stop if chest discomfort, dizziness, or joint pain occurs."}
                    </div>
                  </div>
                </>
              )}

              {widget3Tab === "diet" && (
                <>
                  <div
                    style={{
                      background: "rgba(14, 165, 233, 0.1)",
                      border: "1px solid rgba(56, 189, 248, 0.3)",
                      borderRadius: 14,
                      padding: "16px 20px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "0.75rem", color: "#38bdf8", fontWeight: 800, textTransform: "uppercase" }}>
                        Daily Target Hydration
                      </div>
                      <div style={{ fontSize: "1.3rem", fontWeight: 900, color: "#fff", marginTop: 2 }}>
                        💧 {guidance?.diet_plan?.hydration_target || "2.5 – 3.0 Liters Daily"}
                      </div>
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "#94a3b8", textAlign: "right", maxWidth: 220 }}>
                      Supports renal filtration, vascular tone &amp; electrolyte balance
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#4ade80", marginBottom: 8 }}>
                      Beneficial Superfoods for Your Profile
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {(guidance?.diet_plan?.beneficial_foods || [
                        "Leafy greens (Spinach, Methi)",
                        "High-fiber oats",
                        "Walnuts & flaxseeds",
                        "Lentils & pulses",
                        "Citrus fruits",
                        "Curd / Probiotics",
                      ]).map((food, idx) => (
                        <span
                          key={idx}
                          style={{
                            padding: "6px 14px",
                            borderRadius: 999,
                            background: "rgba(34, 197, 94, 0.15)",
                            color: "#86efac",
                            border: "1px solid rgba(34, 197, 94, 0.3)",
                            fontSize: "0.82rem",
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                          }}
                        >
                          <Check size={12} /> {food}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#f87171", marginBottom: 8 }}>
                      Foods &amp; Substances to Moderate or Avoid
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {(guidance?.diet_plan?.foods_to_avoid || [
                        "Refined table sugar",
                        "High-sodium processed snacks",
                        "Trans fats & re-fried foods",
                        "Carbonated beverages",
                        "Heavy late-night meals",
                      ]).map((food, idx) => (
                        <span
                          key={idx}
                          style={{
                            padding: "6px 14px",
                            borderRadius: 999,
                            background: "rgba(239, 68, 68, 0.15)",
                            color: "#fca5a5",
                            border: "1px solid rgba(239, 68, 68, 0.3)",
                            fontSize: "0.82rem",
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                          }}
                        >
                          <X size={12} /> {food}
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {widget3Tab === "lifestyle" && (
                <>
                  <div
                    style={{
                      background: "rgba(11, 24, 54, 0.7)",
                      border: "1px solid rgba(56, 189, 248, 0.25)",
                      borderRadius: 14,
                      padding: "16px 20px",
                    }}
                  >
                    <div style={{ fontSize: "0.75rem", color: "#38bdf8", fontWeight: 800, textTransform: "uppercase" }}>
                      Circadian Rhythm &amp; Sleep Target
                    </div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#fff", marginTop: 2 }}>
                      7 – 8 Hours Restorative Sleep
                    </div>
                    <div style={{ fontSize: "0.82rem", color: "#94a3b8", marginTop: 4 }}>
                      Consistent bedtime and screen curfew 45 minutes before sleep restores parasympathetic autonomic tone.
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#cbd5e1" }}>
                      Evidence-Based Clinical Lifestyle Tips
                    </div>
                    {(guidance?.lifestyle_tips || [
                      "Engage in 15 minutes of outdoor sunlight exposure within 1 hour of waking to anchor your circadian clock.",
                      "Avoid caffeine intake past 4:00 PM to protect deep delta-wave sleep cycles.",
                      "Practice 5 minutes of 4-7-8 diaphragmatic breathing whenever resting systolic blood pressure exceeds your baseline.",
                      "Schedule a quarterly preventive comprehensive blood profile to track glycemic and lipid trajectories.",
                    ]).map((tip, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: "rgba(11, 24, 54, 0.6)",
                          border: "1px solid rgba(255, 255, 255, 0.08)",
                          borderRadius: 10,
                          padding: "12px 16px",
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 12,
                        }}
                      >
                        <ShieldCheck size={16} color="#38bdf8" style={{ flexShrink: 0, marginTop: 2 }} />
                        <span style={{ fontSize: "0.84rem", color: "#e2e8f0", lineHeight: 1.4 }}>{tip}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: "16px 24px",
                borderTop: "1px solid rgba(255, 255, 255, 0.1)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "rgba(15, 23, 42, 0.45)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.82rem", color: "#94a3b8" }}>
                <CheckCircle2 size={16} color="#38bdf8" />
                <span style={{ color: "#cbd5e1", fontWeight: 600 }}>CallMedex Verified Healthcare Protocol</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveWidget(null)}
                style={{
                  padding: "8px 24px",
                  borderRadius: 10,
                  background: "#0284c7",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 700,
                  fontSize: "0.88rem",
                  cursor: "pointer",
                  boxShadow: "0 2px 10px rgba(2, 132, 199, 0.4)",
                  transition: "all 0.15s ease",
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
