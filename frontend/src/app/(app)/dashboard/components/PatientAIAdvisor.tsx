"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
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

  // Widget 2 internal sub-tab: tests | doctors | services
  const [widget2Tab, setWidget2Tab] = useState<"tests" | "doctors" | "services">("tests");

  // Fetch AI Recommendations from backend
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
      });

      if (!res.ok) {
        throw new Error("Could not fetch clinical recommendations.");
      }

      const result: AIAdvisorData = await res.json();
      setData(result);

      // Populate local edit state with returned health profile
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
  if (parsedWeight > 0 && parsedHeight > 0) {
    const hm = parsedHeight / 100.0;
    liveBmi = Math.round((parsedWeight / (hm * hm)) * 10) / 10;
    if (liveBmi < 18.5) liveBmiCat = "Underweight";
    else if (liveBmi < 24.9) liveBmiCat = "Normal Weight";
    else if (liveBmi < 29.9) liveBmiCat = "Overweight";
    else liveBmiCat = "Obese";
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

      setSaveSuccessMsg("Health metrics synchronized! Regenerating clinical guidance...");
      setTimeout(() => {
        setSaveSuccessMsg(null);
        setActiveWidget(null);
      }, 1400);

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
    <div id="ai-health-advisor" className="cm-ai-advisor-panel cm-glass-stage" data-surface="glass">
      {/* ── Top Header ── */}
      <div className="cm-ai-advisor-header">
        <div className="cm-ai-advisor-title-wrap">
          <div className="cm-ai-wave-3d-box" aria-hidden="true">
            <svg
              viewBox="0 0 40 40"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="cm-ai-wave-anim"
              style={{ width: 28, height: 28 }}
            >
              <defs>
                <linearGradient id="waveGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="var(--cm-active, #0284c7)" />
                  <stop offset="50%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
                <linearGradient id="waveGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="var(--cm-active, #0284c7)" stopOpacity="0.3" />
                </linearGradient>
              </defs>
              <path
                d="M4 22C10 14 16 28 22 20C26 14 32 24 36 18"
                stroke="url(#waveGrad1)"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M4 27C10 20 16 32 22 25C26 20 32 29 36 24"
                stroke="url(#waveGrad2)"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="22" cy="20" r="2.5" fill="#38bdf8" />
              <circle cx="36" cy="18" r="2" fill="#06b6d4" />
            </svg>
          </div>
          <div>
            <div className="cm-ai-advisor-badge-row">
              <h3 className="cm-ai-advisor-title">AI Preventive Care Advisor</h3>
              <span className="cm-ai-pill-badge">Clinical Intelligence</span>
            </div>
            <p className="cm-ai-advisor-subtitle">
              Comprehensive health orchestra: personalized vitals intake, diagnostic screening, and AI lifestyle care.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchRecommendations}
          disabled={loading}
          className="cm-ai-refresh-btn"
          aria-label="Refresh AI analysis"
        >
          <RefreshCw size={14} className={loading ? "cm-spin-icon" : ""} />
          <span>{loading ? "Analyzing Orchestra..." : "Re-analyze"}</span>
        </button>
      </div>

      {/* ── Summary Strip ── */}
      {data?.health_summary && (
        <div className="cm-ai-summary-card">
          <div className="cm-ai-summary-row">
            <ShieldCheck size={20} className="cm-ai-summary-shield" />
            <div className="cm-ai-summary-text">{data.health_summary}</div>
          </div>
          {data.risk_factors && data.risk_factors.length > 0 && (
            <div className="cm-ai-tags-wrap">
              {data.risk_factors.map((risk, idx) => (
                <span key={idx} className="cm-ai-risk-tag">
                  <CheckCircle2 size={12} />
                  {risk}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 3-Section Columns Layout ── */}
      {loading && !data ? (
        <div className="cm-ai-skeleton-loader">
          <div className="cm-ai-skeleton-bar cm-ai-skeleton-bar--title" />
          <div className="cm-ai-skeleton-cards">
            <div className="cm-ai-skeleton-card" />
            <div className="cm-ai-skeleton-card" />
            <div className="cm-ai-skeleton-card" />
          </div>
        </div>
      ) : error ? (
        <div className="cm-ai-error-box">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button type="button" onClick={fetchRecommendations} className="cm-btn cm-btn--ghost cm-btn--sm">
            Retry
          </button>
        </div>
      ) : (
        <div className="cm-ai-orchestra-grid">
          {/* ══════════════════════════════════════════════════════════════
              COLUMN 1: Patient Health Data & Vitals
             ══════════════════════════════════════════════════════════════ */}
          <div
            className="cm-ai-column-card"
            onClick={() => setActiveWidget(1)}
            role="button"
            tabIndex={0}
            title="Click to open Health Vitals Widget"
          >
            <div className="cm-ai-column-header">
              <div className="cm-ai-col-icon-box cm-ai-col-icon-box--cyan">
                <Activity size={22} color="#38bdf8" />
              </div>
              <div>
                <span className="cm-ai-col-category">Section 1</span>
                <h4 className="cm-ai-col-title">Health Profile &amp; Vitals</h4>
              </div>
            </div>

            <p className="cm-ai-col-desc">
              Biometric intake: weight, height, BMI, blood pressure, fasting glucose &amp; conditions.
            </p>

            <div className="cm-ai-vitals-preview-box">
              <div className="cm-ai-vital-metric">
                <span className="cm-ai-vital-metric-label">BMI</span>
                <strong className="cm-ai-vital-metric-val">
                  {profile?.bmi ? `${profile.bmi}` : "—"}
                </strong>
                <span className={`cm-ai-bmi-badge cm-ai-bmi-badge--${(profile?.bmi_category || "").toLowerCase().replace(" ", "-")}`}>
                  {profile?.bmi_category || "Not Recorded"}
                </span>
              </div>
              <div className="cm-ai-vital-metric">
                <span className="cm-ai-vital-metric-label">Weight / Height</span>
                <strong className="cm-ai-vital-metric-val">
                  {profile?.weight_kg ? `${profile.weight_kg} kg` : "—"} · {profile?.height_cm ? `${profile.height_cm} cm` : "—"}
                </strong>
                <span className="cm-ai-vital-sub">
                  BP: {profile?.blood_pressure || "—"}
                </span>
              </div>
            </div>

            <div className="cm-ai-col-conditions-chips">
              {profile?.conditions && profile.conditions.length > 0 ? (
                profile.conditions.slice(0, 3).map((c, i) => (
                  <span key={i} className="cm-ai-condition-chip">
                    {c}
                  </span>
                ))
              ) : (
                <span className="cm-ai-condition-chip cm-ai-condition-chip--empty">
                  No chronic conditions logged
                </span>
              )}
            </div>

            <div className="cm-ai-col-footer-action">
              <span className="cm-ai-action-text">Update Health Data</span>
              <div className="cm-ai-action-arrow">
                <ArrowRight size={14} />
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════
              COLUMN 2: Recommended Tests, Services & Doctor Consultations
             ══════════════════════════════════════════════════════════════ */}
          <div
            className="cm-ai-column-card"
            onClick={() => setActiveWidget(2)}
            role="button"
            tabIndex={0}
            title="Click to open Clinical Recommendations Widget"
          >
            <div className="cm-ai-column-header">
              <div className="cm-ai-col-icon-box cm-ai-col-icon-box--green">
                <FlaskConical size={22} color="#4ade80" />
              </div>
              <div>
                <span className="cm-ai-col-category">Section 2</span>
                <h4 className="cm-ai-col-title">Diagnostics &amp; Doctors</h4>
              </div>
            </div>

            <p className="cm-ai-col-desc">
              Clinical recommendations: targeted lab screenings, specialist consultations &amp; home care.
            </p>

            <div className="cm-ai-tests-preview-box">
              <div className="cm-ai-test-count-strip">
                <span className="cm-ai-test-count-badge">
                  {tests.length} Recommended Tests
                </span>
                <span className="cm-ai-doc-count-badge">
                  {doctors.length} Specialist Consults
                </span>
              </div>

              <div className="cm-ai-mini-test-list">
                {tests.slice(0, 2).map((t, idx) => (
                  <div key={idx} className="cm-ai-mini-test-row">
                    <span className={`cm-ai-urgency-dot cm-ai-urgency-dot--${t.urgency}`} />
                    <span className="cm-ai-mini-test-name">{t.test_name}</span>
                    <span className="cm-ai-mini-test-price">₹{t.estimated_price || 499}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="cm-ai-col-footer-action">
              <span className="cm-ai-action-text">View Clinical Recommendations</span>
              <div className="cm-ai-action-arrow">
                <ArrowRight size={14} />
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════
              COLUMN 3: Recommended Workouts, Diet & Care Advice
             ══════════════════════════════════════════════════════════════ */}
          <div
            className="cm-ai-column-card"
            onClick={() => setActiveWidget(3)}
            role="button"
            tabIndex={0}
            title="Click to open Workouts & Diet Widget"
          >
            <div className="cm-ai-column-header">
              <div className="cm-ai-col-icon-box cm-ai-col-icon-box--purple">
                <Bike size={22} color="#c084fc" />
              </div>
              <div>
                <span className="cm-ai-col-category">Section 3</span>
                <h4 className="cm-ai-col-title">Workouts &amp; Diet Care</h4>
              </div>
            </div>

            <p className="cm-ai-col-desc">
              Lifestyle engine: daily workout regimen, tailored nutrition targets, hydration &amp; advice.
            </p>

            <div className="cm-ai-guidance-preview-box">
              <div className="cm-ai-guidance-item">
                <span className="cm-ai-guidance-label">Activity Routine</span>
                <div className="cm-ai-guidance-val">
                  {guidance?.workouts?.weekly_frequency || "5 days / week aerobic + mobility"}
                </div>
              </div>
              <div className="cm-ai-guidance-item">
                <span className="cm-ai-guidance-label">Hydration Goal</span>
                <div className="cm-ai-guidance-val">
                  {guidance?.diet_plan?.hydration_target?.slice(0, 32) || "2.5 – 3.0 Liters daily"}
                </div>
              </div>
            </div>

            <div className="cm-ai-col-footer-action">
              <span className="cm-ai-action-text">Explore Regimen &amp; Care Plan</span>
              <div className="cm-ai-action-arrow">
                <ArrowRight size={14} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          GLASSMORPHIC WIDGET 1: HEALTH DATA INTAKE & VITALS
         ══════════════════════════════════════════════════════════════════════ */}
      {activeWidget === 1 && (
        <div className="cm-widget-overlay" onClick={() => setActiveWidget(null)}>
          <div className="cm-glass-widget-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cm-glass-widget-header">
              <div className="cm-glass-widget-header-title">
                <div className="cm-ai-col-icon-box cm-ai-col-icon-box--cyan">
                  <Activity size={22} color="#38bdf8" />
                </div>
                <div>
                  <h3 className="cm-widget-title">Patient Health Profile &amp; Vitals</h3>
                  <p className="cm-widget-sub">
                    Enter your biometrics to power continuous clinical monitoring &amp; diagnostic predictions.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="cm-widget-close-btn"
                onClick={() => setActiveWidget(null)}
                aria-label="Close widget"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveHealthProfile} className="cm-widget-body">
              {saveSuccessMsg && (
                <div className="cm-widget-alert-success">
                  <CheckCircle2 size={16} />
                  <span>{saveSuccessMsg}</span>
                </div>
              )}

              <div className="cm-widget-form-grid">
                {/* Weight */}
                <div className="cm-form-group">
                  <label className="cm-form-label">Weight (kg)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="20"
                    max="300"
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                    placeholder="e.g. 68.5"
                    className="cm-glass-input"
                    required
                  />
                </div>

                {/* Height */}
                <div className="cm-form-group">
                  <label className="cm-form-label">Height (cm)</label>
                  <input
                    type="number"
                    step="1"
                    min="80"
                    max="250"
                    value={heightInput}
                    onChange={(e) => setHeightInput(e.target.value)}
                    placeholder="e.g. 172"
                    className="cm-glass-input"
                    required
                  />
                </div>

                {/* Blood Pressure */}
                <div className="cm-form-group">
                  <label className="cm-form-label">Blood Pressure (mmHg)</label>
                  <input
                    type="text"
                    value={bpInput}
                    onChange={(e) => setBpInput(e.target.value)}
                    placeholder="e.g. 120/80"
                    className="cm-glass-input"
                  />
                </div>

                {/* Fasting Sugar */}
                <div className="cm-form-group">
                  <label className="cm-form-label">Fasting Blood Sugar (mg/dL)</label>
                  <input
                    type="number"
                    step="1"
                    min="40"
                    max="500"
                    value={sugarInput}
                    onChange={(e) => setSugarInput(e.target.value)}
                    placeholder="e.g. 95"
                    className="cm-glass-input"
                  />
                </div>
              </div>

              {/* Dynamic Live BMI Gauge Banner */}
              <div className="cm-bmi-gauge-banner">
                <div className="cm-bmi-gauge-left">
                  <span className="cm-bmi-gauge-title">Calculated Body Mass Index (BMI)</span>
                  <div className="cm-bmi-gauge-val-row">
                    <strong className="cm-bmi-number">{liveBmi ? liveBmi : "—"}</strong>
                    <span className={`cm-ai-bmi-badge cm-ai-bmi-badge--${liveBmiCat.toLowerCase().replace(" ", "-")}`}>
                      {liveBmiCat}
                    </span>
                  </div>
                </div>
                <div className="cm-bmi-scale-bar">
                  <div className={`cm-bmi-scale-segment cm-bmi-scale--under ${liveBmiCat === "Underweight" ? "cm-bmi-scale--active" : ""}`} title="Underweight (<18.5)" />
                  <div className={`cm-bmi-scale-segment cm-bmi-scale--normal ${liveBmiCat === "Normal Weight" ? "cm-bmi-scale--active" : ""}`} title="Normal (18.5–24.9)" />
                  <div className={`cm-bmi-scale-segment cm-bmi-scale--over ${liveBmiCat === "Overweight" ? "cm-bmi-scale--active" : ""}`} title="Overweight (25–29.9)" />
                  <div className={`cm-bmi-scale-segment cm-bmi-scale--obese ${liveBmiCat === "Obese" ? "cm-bmi-scale--active" : ""}`} title="Obese (≥30)" />
                </div>
              </div>

              {/* Chronic Conditions Multi-Select Chips */}
              <div className="cm-form-group" style={{ marginTop: 16 }}>
                <label className="cm-form-label">Existing Health Conditions</label>
                <div className="cm-chips-selector-row">
                  {COMMON_CONDITIONS.map((cond) => {
                    const isSelected = conditionsInput.includes(cond);
                    return (
                      <button
                        type="button"
                        key={cond}
                        onClick={() => toggleCondition(cond)}
                        className={`cm-condition-select-chip ${isSelected ? "cm-condition-select-chip--selected" : ""}`}
                      >
                        {isSelected && <Check size={12} />}
                        <span>{cond}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Lifestyle / Activity & Diet Pref */}
              <div className="cm-widget-form-grid" style={{ marginTop: 14 }}>
                <div className="cm-form-group">
                  <label className="cm-form-label">Dietary Preference</label>
                  <select
                    value={dietPrefInput}
                    onChange={(e) => setDietPrefInput(e.target.value)}
                    className="cm-glass-select"
                  >
                    {DIET_PREFERENCES.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="cm-form-group">
                  <label className="cm-form-label">Activity Level</label>
                  <select
                    value={activityInput}
                    onChange={(e) => setActivityInput(e.target.value)}
                    className="cm-glass-select"
                  >
                    {ACTIVITY_LEVELS.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="cm-glass-widget-footer">
                <button
                  type="button"
                  onClick={() => setActiveWidget(null)}
                  className="cm-btn cm-btn--ghost"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="cm-btn cm-btn--primary"
                >
                  {savingProfile ? "Saving & Syncing..." : "Save & Sync Health Data"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          GLASSMORPHIC WIDGET 2: CLINICAL RECOMMENDATIONS & DOCTORS
         ══════════════════════════════════════════════════════════════════════ */}
      {activeWidget === 2 && (
        <div className="cm-widget-overlay" onClick={() => setActiveWidget(null)}>
          <div className="cm-glass-widget-modal cm-glass-widget-modal--wide" onClick={(e) => e.stopPropagation()}>
            <div className="cm-glass-widget-header">
              <div className="cm-glass-widget-header-title">
                <div className="cm-ai-col-icon-box cm-ai-col-icon-box--green">
                  <FlaskConical size={22} color="#4ade80" />
                </div>
                <div>
                  <h3 className="cm-widget-title">Clinical Recommendations &amp; Care Network</h3>
                  <p className="cm-widget-sub">
                    Personalized diagnostic screening panels, specialist clinician consultations &amp; home care.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="cm-widget-close-btn"
                onClick={() => setActiveWidget(null)}
                aria-label="Close widget"
              >
                <X size={18} />
              </button>
            </div>

            {/* Segmented Sub-Tabs */}
            <div className="cm-widget-subtab-bar">
              <button
                type="button"
                className={`cm-widget-subtab-btn ${widget2Tab === "tests" ? "cm-widget-subtab-btn--active" : ""}`}
                onClick={() => setWidget2Tab("tests")}
              >
                <FlaskConical size={14} />
                <span>Diagnostic Panels ({tests.length})</span>
              </button>
              <button
                type="button"
                className={`cm-widget-subtab-btn ${widget2Tab === "doctors" ? "cm-widget-subtab-btn--active" : ""}`}
                onClick={() => setWidget2Tab("doctors")}
              >
                <Stethoscope size={14} />
                <span>Specialist Doctors ({doctors.length})</span>
              </button>
              <button
                type="button"
                className={`cm-widget-subtab-btn ${widget2Tab === "services" ? "cm-widget-subtab-btn--active" : ""}`}
                onClick={() => setWidget2Tab("services")}
              >
                <HeartPulse size={14} />
                <span>Doorstep Services ({services.length})</span>
              </button>
            </div>

            <div className="cm-widget-body" style={{ maxHeight: "65vh", overflowY: "auto" }}>
              {/* Tab 1: Diagnostic Panels */}
              {widget2Tab === "tests" && (
                <div className="cm-widget-cards-grid">
                  {tests.map((test, index) => (
                    <div key={index} className="cm-widget-card cm-widget-card--test">
                      <div className="cm-widget-card-head">
                        <span className={`cm-ai-urgency-tag cm-ai-urgency-tag--${test.urgency}`}>
                          {test.urgency === "high" ? "Priority Panel" : "Recommended"}
                        </span>
                        <span className="cm-ai-cat-tag">{test.category}</span>
                      </div>
                      <h4 className="cm-widget-card-title">{test.test_name}</h4>
                      <p className="cm-widget-card-desc">{test.reason}</p>
                      <div className="cm-widget-card-footer">
                        <span className="cm-widget-price-tag">
                          Est. ₹{test.estimated_price || 499}
                        </span>
                        <Link href={test.action_url} className="cm-widget-cta-btn">
                          <span>Book Panel</span>
                          <ArrowRight size={13} />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tab 2: Specialist Doctors */}
              {widget2Tab === "doctors" && (
                <div className="cm-widget-cards-grid">
                  {doctors.map((doc, index) => (
                    <div key={index} className="cm-widget-card cm-widget-card--doc">
                      <div className="cm-widget-card-head">
                        <span className="cm-ai-urgency-tag cm-ai-urgency-tag--medium">
                          {doc.specialty}
                        </span>
                        <span className="cm-ai-cat-tag" style={{ textTransform: "capitalize" }}>
                          {doc.consultation_mode.replace("_", " ")}
                        </span>
                      </div>
                      <h4 className="cm-widget-card-title">{doc.title}</h4>
                      <p className="cm-widget-card-desc">{doc.reason}</p>
                      <div className="cm-widget-card-footer">
                        <span className="cm-widget-price-tag">Verified Doctor</span>
                        <Link href={doc.action_url} className="cm-widget-cta-btn cm-widget-cta-btn--doctor">
                          <span>Consult Doctor</span>
                          <ArrowRight size={13} />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tab 3: Doorstep Care Services */}
              {widget2Tab === "services" && (
                <div className="cm-widget-cards-grid">
                  {services.map((svc, index) => (
                    <div key={index} className="cm-widget-card cm-widget-card--service">
                      <div className="cm-widget-card-head">
                        <span className="cm-ai-urgency-tag cm-ai-urgency-tag--low">
                          Doorstep Care
                        </span>
                        <span className="cm-ai-cat-tag">Home Visit</span>
                      </div>
                      <h4 className="cm-widget-card-title">{svc.service_name}</h4>
                      <p className="cm-widget-card-desc">{svc.reason}</p>
                      <div className="cm-widget-card-footer">
                        <span className="cm-widget-price-tag">Cold-Chain Protocol</span>
                        <Link href={svc.action_url} className="cm-widget-cta-btn cm-widget-cta-btn--service">
                          <span>Request Service</span>
                          <ArrowRight size={13} />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="cm-glass-widget-footer">
              <button
                type="button"
                onClick={() => setActiveWidget(null)}
                className="cm-btn cm-btn--ghost"
              >
                Close
              </button>
              <Link href="/booking" className="cm-btn cm-btn--primary">
                Open Full Booking Wizard →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          GLASSMORPHIC WIDGET 3: WORKOUTS, DIET & CARE GUIDANCE
         ══════════════════════════════════════════════════════════════════════ */}
      {activeWidget === 3 && (
        <div className="cm-widget-overlay" onClick={() => setActiveWidget(null)}>
          <div className="cm-glass-widget-modal cm-glass-widget-modal--wide" onClick={(e) => e.stopPropagation()}>
            <div className="cm-glass-widget-header">
              <div className="cm-glass-widget-header-title">
                <div className="cm-ai-col-icon-box cm-ai-col-icon-box--purple">
                  <Bike size={22} color="#c084fc" />
                </div>
                <div>
                  <h3 className="cm-widget-title">Personalized Workouts &amp; Nutritional Plan</h3>
                  <p className="cm-widget-sub">
                    Synthesized for your BMI ({profile?.bmi || "N/A"}) &amp; chronic condition profile.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="cm-widget-close-btn"
                onClick={() => setActiveWidget(null)}
                aria-label="Close widget"
              >
                <X size={18} />
              </button>
            </div>

            <div className="cm-widget-body" style={{ maxHeight: "65vh", overflowY: "auto" }}>
              {/* Section A: Workout Protocol */}
              <div className="cm-widget-regimen-block">
                <div className="cm-regimen-block-header">
                  <Activity size={18} color="#38bdf8" />
                  <h4>Structured Daily Exercise Routine</h4>
                </div>
                <div className="cm-regimen-grid">
                  <div className="cm-regimen-card">
                    <span className="cm-regimen-card-label">Warmup Routine</span>
                    <p className="cm-regimen-card-content">{guidance?.workouts?.warmup || "5–8 minutes light joint rotations and neck rolls."}</p>
                  </div>
                  <div className="cm-regimen-card">
                    <span className="cm-regimen-card-label">Aerobic / Cardio</span>
                    <p className="cm-regimen-card-content">{guidance?.workouts?.cardio || "30–45 minutes low-impact brisk walking or stationary cycling."}</p>
                  </div>
                  <div className="cm-regimen-card">
                    <span className="cm-regimen-card-label">Strength &amp; Mobility</span>
                    <p className="cm-regimen-card-content">{guidance?.workouts?.strength_and_mobility || "Gentle bodyweight squats, wall push-ups, and pelvic tilts."}</p>
                  </div>
                  <div className="cm-regimen-card">
                    <span className="cm-regimen-card-label">Weekly Frequency &amp; Target</span>
                    <p className="cm-regimen-card-content">{guidance?.workouts?.weekly_frequency || "5 days/week (150 min total moderate activity)."}</p>
                  </div>
                </div>
                {guidance?.workouts?.precautions && (
                  <div className="cm-regimen-alert-box">
                    <AlertCircle size={15} color="#fbbf24" />
                    <span><strong>Clinical Precaution:</strong> {guidance.workouts.precautions}</span>
                  </div>
                )}
              </div>

              {/* Section B: Nutrition & Diet Plan */}
              <div className="cm-widget-regimen-block" style={{ marginTop: 20 }}>
                <div className="cm-regimen-block-header">
                  <Droplet size={18} color="#4ade80" />
                  <h4>Nutritional &amp; Dietary Guidelines</h4>
                </div>

                {/* Hydration Banner */}
                <div className="cm-hydration-banner">
                  <div className="cm-hydration-icon-box">
                    <Droplet size={20} color="#38bdf8" />
                  </div>
                  <div>
                    <span className="cm-hydration-label">Daily Hydration Target</span>
                    <div className="cm-hydration-value">{guidance?.diet_plan?.hydration_target || "2.5 – 3.2 Liters clean water daily"}</div>
                  </div>
                </div>

                <div className="cm-diet-split-grid">
                  <div className="cm-diet-column cm-diet-column--good">
                    <h5>✓ Recommended Foods to Include</h5>
                    <ul className="cm-diet-list">
                      {(guidance?.diet_plan?.beneficial_foods || [
                        "Whole grains (Millets, Oats, Brown Rice)",
                        "Plant proteins (Sprouts, Moong Dal, Paneer/Tofu)",
                        "Seasonal green vegetables & fiber-rich salads",
                        "Omega-3 seeds (Walnuts, Flaxseeds, Chia)"
                      ]).map((food, i) => (
                        <li key={i}>{food}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="cm-diet-column cm-diet-column--bad">
                    <h5>✕ Foods to Avoid / Limit</h5>
                    <ul className="cm-diet-list">
                      {(guidance?.diet_plan?.foods_to_avoid || [
                        "Refined sugars, carbonated drinks & processed sweets",
                        "Bakery items with hydrogenated palm oils & trans fats",
                        "Excess sodium / processed snack seasonings"
                      ]).map((food, i) => (
                        <li key={i}>{food}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {guidance?.diet_plan?.meal_timing_tips && (
                  <div className="cm-meal-timing-box">
                    <Clock size={16} color="#38bdf8" />
                    <span>{guidance.diet_plan.meal_timing_tips}</span>
                  </div>
                )}
              </div>

              {/* Section C: Clinical Lifestyle Guidance */}
              {guidance?.lifestyle_tips && guidance.lifestyle_tips.length > 0 && (
                <div className="cm-widget-regimen-block" style={{ marginTop: 20 }}>
                  <div className="cm-regimen-block-header">
                    <ShieldCheck size={18} color="#a78bfa" />
                    <h4>Preventive Care Guidance</h4>
                  </div>
                  <ul className="cm-ai-tips-list">
                    {guidance.lifestyle_tips.map((tip, idx) => (
                      <li key={idx} className="cm-ai-tip-item">
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="cm-glass-widget-footer">
              <button
                type="button"
                onClick={() => setActiveWidget(null)}
                className="cm-btn cm-btn--primary"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
