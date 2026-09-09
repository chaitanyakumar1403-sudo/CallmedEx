"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Home,
  Heart,
  Stethoscope,
  TestTube2,
  Pill,
  Activity,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  ChevronRight,
  PhoneCall,
  Calendar,
  ArrowRight,
  MapPin,
  Star,
  Users,
  Award,
} from "lucide-react";

type ServiceTab = "nursing" | "doctor" | "diagnostics" | "pharmacy" | "packages";

interface ServiceFeature {
  title: string;
  desc: string;
}

interface ServiceDetail {
  id: ServiceTab;
  title: string;
  badge: string;
  tagline: string;
  icon: any;
  color: string;
  accentGradient: string;
  priceTag: string;
  bookingUrl: string;
  ctaText: string;
  features: ServiceFeature[];
  procedures: string[];
  slotsInfo: string;
}

const HOME_SERVICES: Record<ServiceTab, ServiceDetail> = {
  nursing: {
    id: "nursing",
    title: "Doorstep Nursing & Clinical Procedures",
    badge: "Certified Clinical Nurses",
    tagline: "Professional post-operative dressing, catheter changes, injections & vitals monitoring at your bedside.",
    icon: Heart,
    color: "#0284c7",
    accentGradient: "linear-gradient(135deg, rgba(2,132,199,0.15) 0%, rgba(56,189,248,0.05) 100%)",
    priceTag: "Starting from ₹350 per procedure",
    bookingUrl: "/booking?type=nurse&mode=home",
    ctaText: "Book Doorstep Nurse",
    features: [
      { title: "Post-Surgical Wound Care", desc: "Aseptic surgical dressings, stitch & staple removals by registered nurses." },
      { title: "IV Infusion & Injections", desc: "Prescribed IV fluid infusions, antibiotic doses, and subcutaneous injections." },
      { title: "Catheter & Ryle's Tube", desc: "Safe catheter insertion, bladder wash, and nasogastric tube administration." },
      { title: "Geriatric & Bedridden Care", desc: "Vitals tracking, bed-sore prevention, and personalized elderly companion care." },
    ],
    procedures: [
      "Wound & Surgical Dressing",
      "IV Cannulation & Fluid Drips",
      "Foley's Catheterization",
      "IM / Sub-Q Injections",
      "Bedside ECG & Vitals Check",
      "Nebulization & Oxygen Support",
    ],
    slotsInfo: "Flexible 7:00 AM – 8:00 PM slots with verified photo ID nurses.",
  },
  doctor: {
    id: "doctor",
    title: "Doctor Home Visit",
    badge: "General Physicians & Specialists",
    tagline: "Comfortable bedside consultations for seniors, acute illnesses, and non-ambulatory patients with registered physicians.",
    icon: Stethoscope,
    color: "#0284c7",
    accentGradient: "linear-gradient(135deg, rgba(14,165,233,0.15) 0%, rgba(99,102,241,0.05) 100%)",
    priceTag: "Doctor-Published Consultation Tariffs",
    bookingUrl: "/consultation?mode=home",
    ctaText: "Book Doctor Home Visit",
    features: [
      { title: "Comprehensive Physical Exam", desc: "Vitals assessment, auscultation, acute diagnosis, and treatment planning." },
      { title: "Immediate Digital Rx", desc: "Prescription generated instantly in your CallMedex patient portal." },
      { title: "Follow-up Continuity", desc: "Includes free chat follow-up with the doctor for 48 hours." },
      { title: "Senior Citizen Priority", desc: "Gentle, stress-free clinical care without crowded hospital wait rooms." },
    ],
    procedures: [
      "Fever & Infectious Illness Evaluation",
      "Hypertension & Diabetic Check",
      "Elderly Mobility & Palliative Review",
      "Post-Discharge Physician Follow-up",
    ],
    slotsInfo: "Morning & evening appointment slots across Visakhapatnam & metro cities.",
  },
  diagnostics: {
    id: "diagnostics",
    title: "Home Blood Sample Collection",
    badge: "CallMedex Central Processing Lab",
    tagline: "Temperature-controlled phlebotomy dispatched directly to your home with early morning slots.",
    icon: TestTube2,
    color: "#0284c7",
    accentGradient: "linear-gradient(135deg, rgba(2,132,199,0.18) 0%, rgba(14,165,233,0.06) 100%)",
    priceTag: "Free home collection with packages · 5:30 AM – 11:00 AM",
    bookingUrl: "/diagnostics?tab=home",
    ctaText: "Explore Tests & Book Home Collection",
    features: [
      { title: "Morning Fasting Slots", desc: "Strictly scheduled 5:30 AM – 11:00 AM slots for accurate fasting and lipid markers." },
      { title: "Barcoded Vacutainers", desc: "Zero sample mix-up with laser-printed patient barcode tracking at the bedside." },
      { title: "Temperature Controlled", desc: "Cold-chain insulated ice-box transport directly to CallMedex NABL lab." },
      { title: "Digital Reports in 6-12 Hrs", desc: "Automated SMS, WhatsApp, and patient portal download as soon as verified." },
    ],
    procedures: [
      "Complete Blood Count (CBC)",
      "HbA1c & Fasting Glucose",
      "Lipid & Cardiac Profiles",
      "Thyroid Function (T3/T4/TSH)",
      "Liver & Kidney Function (LFT/KFT)",
      "Vitamin D & B12 Levels",
    ],
    slotsInfo: "Dedicated slots: 5:30 AM, 6:00 AM, 6:30 AM ... 11:00 AM every single day.",
  },
  pharmacy: {
    id: "pharmacy",
    title: "Doorstep Medicine Delivery",
    badge: "Jan Aushadhi & Verified Pharmacies",
    tagline: "Authentic generic medications and branded pharmaceuticals delivered to your gate.",
    icon: Pill,
    color: "#059669",
    accentGradient: "linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(5,150,105,0.05) 100%)",
    priceTag: "Licensed Pharmacies · Rapid Doorstep Delivery",
    bookingUrl: "/pharmacy",
    ctaText: "Order Medications Doorstep",
    features: [
      { title: "Upload Prescription & Relax", desc: "Snap a photo of your doctor's slip; our registered pharmacists verify and dispatch." },
      { title: "Affordable Jan Aushadhi Generics", desc: "WHO-GMP certified generic equivalents at a fraction of brand costs." },
      { title: "Chronic Refill Reminders", desc: "Never run out of BP, diabetes, or cardiac maintenance medications." },
      { title: "Cold Storage Preservation", desc: "Insulins and temperature-sensitive biologics delivered in cooling packs." },
    ],
    procedures: [
      "Monthly Chronic Medicine Packs",
      "Acute Antibiotics & Analgesics",
      "Insulins & Diabetic Supplies",
      "Surgical Gauze, Strips & PPE",
    ],
    slotsInfo: "Express 2-4 hour delivery in Visakhapatnam and same-day across districts.",
  },
  packages: {
    id: "packages",
    title: "Preventive Family Health Packages",
    badge: "Single & Couple Rates",
    tagline: "Comprehensive full body screenings tailored for young adults, diabetics, and senior citizens.",
    icon: Activity,
    color: "#7c3aed",
    accentGradient: "linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(139,92,246,0.05) 100%)",
    priceTag: "Packages starting from ₹349 with free home visit",
    bookingUrl: "/diagnostics?tab=home",
    ctaText: "View Health Packages",
    features: [
      { title: "Single & Couple Pricing", desc: "Special discounted bundle rates for couples and entire families." },
      { title: "Complete Organ Screening", desc: "Liver, Kidney, Thyroid, Blood, Lipids, Blood Sugar, and Urine tests." },
      { title: "Free Phlebotomist Visit", desc: "Zero home sample collection charges on all CallMedex health packages." },
      { title: "Doctor Review Included", desc: "Free AI health summary and tele-consultation to interpret your report." },
    ],
    procedures: [
      "Basic Screening (Non-Diabetic) - ₹349",
      "Basic Screening (Diabetic) - ₹549",
      "Full Body Screening - ₹599",
      "Full Body Screening (Diabetic) - ₹749",
      "Anaemia Package - ₹849",
      "Cardiac Comprehensive - ₹1399",
    ],
    slotsInfo: "Morning fasting home collection 5:30 AM to 11:00 AM.",
  },
};

export default function HomeServicesPage() {
  const [activeTab, setActiveTab] = useState<ServiceTab>("nursing");
  const [registeredDoctors, setRegisteredDoctors] = useState<any[]>([]);
  const [registeredNurses, setRegisteredNurses] = useState<any[]>([]);
  const [registeredPharmacies, setRegisteredPharmacies] = useState<any[]>([]);
  const [registeredPhlebotomists, setRegisteredPhlebotomists] = useState<any[]>([]);
  const [, setLoadingProviders] = useState<boolean>(true);

  useEffect(() => {
    async function fetchRealProviders() {
      setLoadingProviders(true);
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      try {
        const [docRes, nurseRes, pharmRes, phlebRes] = await Promise.all([
          fetch(`${apiBase}/api/providers/search/doctors?consultation_mode=home_visit`).then(r => r.json()).catch(() => null),
          fetch(`${apiBase}/api/providers/search/providers?type=nurse`).then(r => r.json()).catch(() => null),
          fetch(`${apiBase}/api/providers/search/providers?type=pharmacy`).then(r => r.json()).catch(() => null),
          fetch(`${apiBase}/api/providers/search/providers?type=phlebotomist`).then(r => r.json()).catch(() => null),
        ]);

        if (docRes?.success && Array.isArray(docRes?.doctors)) {
          setRegisteredDoctors(docRes.doctors);
        } else {
          setRegisteredDoctors([]);
        }

        if (nurseRes?.success && Array.isArray(nurseRes?.providers)) {
          setRegisteredNurses(nurseRes.providers);
        } else {
          setRegisteredNurses([]);
        }

        if (pharmRes?.success && Array.isArray(pharmRes?.providers)) {
          setRegisteredPharmacies(pharmRes.providers);
        } else {
          setRegisteredPharmacies([]);
        }

        if (phlebRes?.success && Array.isArray(phlebRes?.providers)) {
          setRegisteredPhlebotomists(phlebRes.providers);
        } else {
          setRegisteredPhlebotomists([]);
        }
      } catch (e) {
        console.error("Error fetching live providers", e);
      } finally {
        setLoadingProviders(false);
      }
    }
    fetchRealProviders();
  }, []);

  const currentService = HOME_SERVICES[activeTab];
  const IconComponent = currentService.icon;

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #f8fafc 0%, #edf4f9 100%)", paddingBottom: 80 }}>
      {/* ── Hero Section with Cornix Sapphire Gradient ── */}
      <div
        style={{
          background: "linear-gradient(135deg, #0f172a 0%, #0369a1 50%, #0284c7 100%)",
          color: "#fff",
          padding: "56px 20px 64px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -50,
            right: -50,
            width: 300,
            height: 300,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(56,189,248,0.25) 0%, rgba(255,255,255,0) 70%)",
            pointerEvents: "none",
          }}
        />

        <div style={{ maxWidth: 1100, margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 16px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.12)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.2)",
              fontSize: "0.85rem",
              fontWeight: 700,
              color: "#bae6fd",
              marginBottom: 16,
            }}
          >
            <Sparkles size={16} style={{ color: "#38bdf8" }} />
            CALLMEDEX DOORSTEP HEALTHCARE NETWORK
          </div>
          <h1 style={{ fontSize: "clamp(2rem, 4vw, 2.75rem)", fontWeight: 900, letterSpacing: "-0.02em", margin: "0 0 16px" }}>
            Hospital-Grade Care Delivered to Your Home
          </h1>
          <p style={{ fontSize: "1.1rem", color: "#e0f2fe", maxWidth: 760, margin: "0 auto 32px", lineHeight: 1.6 }}>
            Eliminate hospital travel and long clinic wait-times. Verified doctors, registered clinical nurses, temperature-controlled blood sample collectors, and generic pharmaceuticals brought right to your door.
          </p>

          {/* Quick Stats Banner */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 16,
              maxWidth: 900,
              margin: "0 auto",
            }}
          >
            <div
              style={{
                background: "rgba(255,255,255,0.08)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 14,
                padding: "12px 16px",
              }}
            >
              <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#38bdf8" }}>5:30 – 11:00 AM</div>
              <div style={{ fontSize: "0.8rem", color: "#bae6fd" }}>Morning Phlebotomy Window</div>
            </div>
            <div
              style={{
                background: "rgba(255,255,255,0.08)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 14,
                padding: "12px 16px",
              }}
            >
              <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "#38bdf8" }}>NMC & APNC</div>
              <div style={{ fontSize: "0.8rem", color: "#bae6fd" }}>Verified Doctors & Nurses</div>
            </div>
            <div
              style={{
                background: "rgba(255,255,255,0.08)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 14,
                padding: "12px 16px",
              }}
            >
              <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "#38bdf8" }}>NABL Certified</div>
              <div style={{ fontSize: "0.8rem", color: "#bae6fd" }}>CallMedex Central Lab</div>
            </div>
            <div
              style={{
                background: "rgba(255,255,255,0.08)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 14,
                padding: "12px 16px",
              }}
            >
              <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "#38bdf8" }}>Doorstep Pharmacy</div>
              <div style={{ fontSize: "0.8rem", color: "#bae6fd" }}>Licensed Generic & Branded Rx</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Interactive Service Selector Tabs ── */}
      <div style={{ maxWidth: 1100, margin: "-28px auto 0", padding: "0 20px", position: "relative", zIndex: 10 }}>
        <div
          style={{
            display: "flex",
            overflowX: "auto",
            gap: 10,
            background: "rgba(255, 255, 255, 0.92)",
            backdropFilter: "blur(16px)",
            padding: 8,
            borderRadius: 18,
            boxShadow: "0 10px 30px rgba(2,132,199,0.12)",
            border: "1px solid rgba(2,132,199,0.18)",
          }}
        >
          {(
            [
              { id: "nursing", label: "Doorstep Nursing", icon: Heart },
              { id: "doctor", label: "Doctor Home Visit", icon: Stethoscope },
              { id: "diagnostics", label: "Home Lab Collection", icon: TestTube2 },
              { id: "pharmacy", label: "Doorstep Pharmacy", icon: Pill },
              { id: "packages", label: "Health Packages", icon: Activity },
            ] as const
          ).map((tab) => {
            const active = activeTab === tab.id;
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: "1 0 auto",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "12px 20px",
                  borderRadius: 12,
                  border: "none",
                  cursor: "pointer",
                  fontSize: "0.92rem",
                  fontWeight: active ? 700 : 600,
                  transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                  background: active ? "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)" : "transparent",
                  color: active ? "#ffffff" : "#475569",
                  boxShadow: active ? "0 4px 14px rgba(2, 132, 199, 0.35)" : "none",
                }}
              >
                <TabIcon size={18} style={{ color: active ? "#fff" : "#0284c7" }} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Active Service Detail Showcase (Glassmorphic Widget) ── */}
      <div style={{ maxWidth: 1100, margin: "36px auto 0", padding: "0 20px" }}>
        <div
          className="glass-card"
          style={{
            background: "rgba(255, 255, 255, 0.88)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.7)",
            boxShadow: "0 16px 40px rgba(15, 23, 42, 0.08)",
            borderRadius: 24,
            padding: "36px 32px",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Subtle Ambient Background Gradient */}
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: "45%",
              height: "100%",
              background: currentService.accentGradient,
              opacity: 0.8,
              pointerEvents: "none",
              borderRadius: "0 24px 24px 0",
            }}
          />

          <div style={{ position: "relative", zIndex: 1 }}>
            {/* Header / Badges */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 20 }}>
              <div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 12px",
                    borderRadius: 999,
                    background: "#e0f2fe",
                    color: "#0369a1",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    marginBottom: 10,
                  }}
                >
                  <ShieldCheck size={14} />
                  {currentService.badge}
                </div>
                <h2 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0f172a", margin: "0 0 8px" }}>
                  {currentService.title}
                </h2>
                <p style={{ color: "#475569", fontSize: "1.05rem", maxWidth: 700, margin: 0, lineHeight: 1.5 }}>
                  {currentService.tagline}
                </p>
              </div>

              <div
                style={{
                  background: "rgba(2,132,199,0.08)",
                  border: "1px solid rgba(2,132,199,0.2)",
                  borderRadius: 16,
                  padding: "12px 20px",
                  textAlign: "right",
                }}
              >
                <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600 }}>CallMedex Verified</div>
                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0369a1" }}>
                  {currentService.priceTag}
                </div>
              </div>
            </div>

            {/* Timing Banner */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: "10px 16px",
                marginBottom: 28,
                fontSize: "0.88rem",
                color: "#334155",
              }}
            >
              <Clock size={16} style={{ color: "#0284c7", flexShrink: 0 }} />
              <span><strong>Service Window:</strong> {currentService.slotsInfo}</span>
            </div>

            {/* Grid: 4 Pillars of Excellence */}
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1e293b", marginBottom: 14 }}>
              Key Clinical Highlights & Inclusions
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: 16,
                marginBottom: 28,
              }}
            >
              {currentService.features.map((feat, i) => (
                <div
                  key={i}
                  style={{
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 16,
                    padding: 18,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        background: "#e0f2fe",
                        display: "grid",
                        placeItems: "center",
                        color: "#0284c7",
                      }}
                    >
                      <CheckCircle2 size={14} />
                    </div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#0f172a" }}>{feat.title}</div>
                  </div>
                  <p style={{ margin: 0, fontSize: "0.84rem", color: "#64748b", lineHeight: 1.4 }}>{feat.desc}</p>
                </div>
              ))}
            </div>

            {/* Common Services / Procedures List */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: 16,
                padding: "20px 24px",
                marginBottom: 28,
              }}
            >
              <h4 style={{ margin: "0 0 12px", fontSize: "0.95rem", fontWeight: 700, color: "#334155" }}>
                Available Bedside Procedures & Services
              </h4>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {currentService.procedures.map((p, i) => (
                  <span
                    key={i}
                    style={{
                      background: "#f0f9ff",
                      color: "#0369a1",
                      border: "1px solid #bae6fd",
                      borderRadius: 999,
                      padding: "6px 14px",
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <CheckCircle2 size={12} style={{ color: "#0284c7" }} />
                    {p}
                  </span>
                ))}
              </div>
            </div>

            {/* ── Registered Healthcare Providers for this Category ── */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                    <ShieldCheck size={18} style={{ color: "#0284c7" }} />
                    {activeTab === "nursing" && "Registered Doorstep Clinical Nurses"}
                    {activeTab === "doctor" && "Verified Doctors Available for Home Visits"}
                    {activeTab === "diagnostics" && "Certified Central Phlebotomy Team"}
                    {activeTab === "pharmacy" && "Verified Partner Jan Aushadhi & Pharmacies"}
                    {activeTab === "packages" && "Popular Preventive Family Health Packages"}
                  </h4>
                  <p style={{ margin: "2px 0 0", fontSize: "0.82rem", color: "#64748b" }}>
                    100% verified medical credentials, state council licenses, and background checks.
                  </p>
                </div>
                <span style={{ fontSize: "0.75rem", background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0", padding: "4px 10px", borderRadius: 999, fontWeight: 700 }}>
                  ● Active Dispatch Available
                </span>
              </div>

              {/* Provider Cards Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
                {activeTab === "nursing" && (
                  registeredNurses.length > 0 ? (
                    registeredNurses.map((nurse, idx) => (
                      <div key={nurse.provider_user_id || nurse.id || idx} style={{ background: "#ffffff", border: "1.5px solid #e2e8f0", borderRadius: 16, padding: "18px 20px", display: "flex", flexDirection: "column", justifyContent: "space-between", boxShadow: "0 2px 10px rgba(0,0,0,0.03)" }}>
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                            <div>
                              <div style={{ fontWeight: 800, color: "#0f172a", fontSize: "1rem" }}>{nurse.display_name || nurse.name || "Verified Nurse"}</div>
                              <div style={{ fontSize: "0.8rem", color: "#475569", marginTop: 2 }}>{nurse.subtype || nurse.qualification || "Registered Clinical Nurse"}</div>
                            </div>
                            <span style={{ fontSize: "0.72rem", background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0", padding: "2px 8px", borderRadius: 999, fontWeight: 700 }}>
                              ✓ VERIFIED
                            </span>
                          </div>
                          <div style={{ fontSize: "0.74rem", color: "#0284c7", fontWeight: 700, marginBottom: 8 }}>
                            {nurse.license_number ? `Reg #${nurse.license_number}` : "State Council Registered"}
                          </div>
                          <div style={{ fontSize: "0.78rem", color: "#64748b", lineHeight: 1.4, marginBottom: 12 }}>
                            <strong>Location:</strong> {[nurse.city, nurse.district, nurse.state].filter(Boolean).join(", ") || "Verified Doorstep Service"}
                          </div>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTop: "1px solid #f1f5f9" }}>
                          <div>
                            <div style={{ fontSize: "0.72rem", color: "#64748b" }}>Visit Charge</div>
                            <div style={{ fontWeight: 800, color: "#0369a1", fontSize: "0.95rem" }}>{nurse.min_price ? `₹${nurse.min_price}` : "₹350 onwards"}</div>
                          </div>
                          <Link href={`/booking?type=nurse&mode=home&provider=${nurse.provider_user_id || nurse.id}`} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)", color: "white", padding: "8px 14px", borderRadius: 8, fontSize: "0.82rem", fontWeight: 700, textDecoration: "none" }}>
                            <span>Book Nurse</span>
                            <ChevronRight size={14} />
                          </Link>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ background: "#ffffff", border: "1.5px dashed #cbd5e1", borderRadius: 16, padding: "32px 24px", textAlign: "center", gridColumn: "1 / -1" }}>
                      <ShieldCheck size={36} style={{ color: "#0284c7", margin: "0 auto 12px" }} />
                      <h4 style={{ margin: "0 0 6px", fontSize: "1.05rem", fontWeight: 700, color: "#0f172a" }}>
                        No Doorstep Nurses Currently Registered In Your Immediate Sector
                      </h4>
                      <p style={{ margin: "0 0 16px", fontSize: "0.85rem", color: "#64748b", maxWidth: 480, marginInline: "auto" }}>
                        CallMedex 24/7 Helpline coordinators are on standby for immediate manual nursing dispatch &amp; bedside assistance.
                      </p>
                      <a href="tel:18002255633" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#0284c7", color: "white", padding: "10px 20px", borderRadius: 10, textDecoration: "none", fontWeight: 700, fontSize: "0.88rem" }}>
                        <PhoneCall size={16} />
                        <span>Call Helpline: 1800-CALLMEDEX</span>
                      </a>
                    </div>
                  )
                )}

                {activeTab === "doctor" && (
                  registeredDoctors.length > 0 ? (
                    registeredDoctors.map((doc, idx) => (
                      <div key={doc.id || idx} style={{ background: "#ffffff", border: "1.5px solid #e2e8f0", borderRadius: 16, padding: "18px 20px", display: "flex", flexDirection: "column", justifyContent: "space-between", boxShadow: "0 2px 10px rgba(0,0,0,0.03)" }}>
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                            <div>
                              <div style={{ fontWeight: 800, color: "#0f172a", fontSize: "1.02rem" }}>
                                {doc.name?.toLowerCase().startsWith("dr") ? doc.name : `Dr. ${doc.name}`}
                              </div>
                              <div style={{ fontSize: "0.8rem", color: "#0369a1", fontWeight: 700, marginTop: 2 }}>
                                {doc.specialization || "General Medicine"}
                              </div>
                              <div style={{ fontSize: "0.76rem", color: "#64748b", marginTop: 1 }}>
                                {doc.qualification || "MBBS"} {doc.experience_years ? `· ${doc.experience_years} yrs exp` : ""}
                              </div>
                            </div>
                            <span style={{ fontSize: "0.72rem", background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0", padding: "2px 8px", borderRadius: 999, fontWeight: 700 }}>
                              ✓ NMC VERIFIED
                            </span>
                          </div>
                          <div style={{ fontSize: "0.74rem", color: "#64748b", fontWeight: 600, marginBottom: 8 }}>
                            {[doc.district || doc.city, doc.state].filter(Boolean).join(", ") || "Registered Practitioner"}
                          </div>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTop: "1px solid #f1f5f9" }}>
                          <div>
                            <div style={{ fontSize: "0.72rem", color: "#64748b" }}>Home Visit Fee</div>
                            <div style={{ fontWeight: 800, color: "#059669", fontSize: "1.05rem" }}>
                              ₹{doc.home_visit_fee || doc.consultation_fee || 1000}
                            </div>
                          </div>
                          <Link href={`/booking?type=home_doctor&doctor=${doc.id}&fee=${doc.home_visit_fee || doc.consultation_fee || 1000}&name=${encodeURIComponent(doc.name)}&spec=${encodeURIComponent(doc.specialization || '')}`} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)", color: "white", padding: "8px 14px", borderRadius: 8, fontSize: "0.82rem", fontWeight: 700, textDecoration: "none" }}>
                            <span>Book Visit</span>
                            <ChevronRight size={14} />
                          </Link>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ background: "#ffffff", border: "1.5px dashed #cbd5e1", borderRadius: 16, padding: "32px 24px", textAlign: "center", gridColumn: "1 / -1" }}>
                      <ShieldCheck size={36} style={{ color: "#0284c7", margin: "0 auto 12px" }} />
                      <h4 style={{ margin: "0 0 6px", fontSize: "1.05rem", fontWeight: 700, color: "#0f172a" }}>
                        No Doctors Available For Home Visits In Your Region Currently
                      </h4>
                      <p style={{ margin: "0 0 16px", fontSize: "0.85rem", color: "#64748b", maxWidth: 480, marginInline: "auto" }}>
                        You can consult verified doctors instantly online via Video Teleconsultation or call our 24/7 Helpline.
                      </p>
                      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                        <Link href="/consultation?mode=teleconsultation" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#0284c7", color: "white", padding: "10px 20px", borderRadius: 10, textDecoration: "none", fontWeight: 700, fontSize: "0.88rem" }}>
                          <span>Consult Doctor Online Now</span>
                        </Link>
                        <a href="tel:18002255633" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#0f172a", color: "white", padding: "10px 20px", borderRadius: 10, textDecoration: "none", fontWeight: 700, fontSize: "0.88rem" }}>
                          <PhoneCall size={16} />
                          <span>1800-CALLMEDEX</span>
                        </a>
                      </div>
                    </div>
                  )
                )}

                {activeTab === "diagnostics" && (
                  registeredPhlebotomists.length > 0 ? (
                    registeredPhlebotomists.map((phleb, idx) => (
                      <div key={phleb.id || idx} style={{ background: "#ffffff", border: "1.5px solid #e2e8f0", borderRadius: 16, padding: "18px 20px", display: "flex", flexDirection: "column", justifyContent: "space-between", boxShadow: "0 2px 10px rgba(0,0,0,0.03)" }}>
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                            <div>
                              <div style={{ fontWeight: 800, color: "#0f172a", fontSize: "1rem" }}>{phleb.display_name || phleb.name || "Phlebotomist"}</div>
                              <div style={{ fontSize: "0.8rem", color: "#0284c7", fontWeight: 700 }}>{phleb.subtype || "NABL Certified Phlebotomist"}</div>
                            </div>
                            <span style={{ fontSize: "0.72rem", background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0", padding: "2px 8px", borderRadius: 999, fontWeight: 700 }}>
                              ✓ NABL CERTIFIED
                            </span>
                          </div>
                          <div style={{ fontSize: "0.78rem", color: "#475569", lineHeight: 1.4, marginBottom: 8 }}>
                            Cold-Chain Insulated Transport &amp; Barcoded Vacutainers
                          </div>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTop: "1px solid #f1f5f9" }}>
                          <div>
                            <div style={{ fontSize: "0.72rem", color: "#64748b" }}>Sample Collection</div>
                            <div style={{ fontWeight: 800, color: "#059669", fontSize: "0.95rem" }}>Free with Packages</div>
                          </div>
                          <Link href="/diagnostics?tab=home" style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)", color: "white", padding: "8px 14px", borderRadius: 8, fontSize: "0.82rem", fontWeight: 700, textDecoration: "none" }}>
                            <span>Book Collection</span>
                            <ChevronRight size={14} />
                          </Link>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ background: "#ffffff", border: "1.5px dashed #cbd5e1", borderRadius: 16, padding: "32px 24px", textAlign: "center", gridColumn: "1 / -1" }}>
                      <ShieldCheck size={36} style={{ color: "#0284c7", margin: "0 auto 12px" }} />
                      <h4 style={{ margin: "0 0 6px", fontSize: "1.05rem", fontWeight: 700, color: "#0f172a" }}>
                        Central Phlebotomy Fleet &amp; NABL Accredited Sample Collection Active
                      </h4>
                      <p style={{ margin: "0 0 16px", fontSize: "0.85rem", color: "#64748b", maxWidth: 480, marginInline: "auto" }}>
                        Select from over 480+ lab tests and full-body health screening packages for doorstep morning collection.
                      </p>
                      <Link href="/diagnostics?tab=home" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#0284c7", color: "white", padding: "10px 20px", borderRadius: 10, textDecoration: "none", fontWeight: 700, fontSize: "0.88rem" }}>
                        <span>Browse 480+ Lab Tests Directory</span>
                        <ChevronRight size={16} />
                      </Link>
                    </div>
                  )
                )}

                {activeTab === "pharmacy" && (
                  registeredPharmacies.length > 0 ? (
                    registeredPharmacies.map((pharm, idx) => (
                      <div key={pharm.provider_user_id || pharm.id || idx} style={{ background: "#ffffff", border: "1.5px solid #e2e8f0", borderRadius: 16, padding: "18px 20px", display: "flex", flexDirection: "column", justifyContent: "space-between", boxShadow: "0 2px 10px rgba(0,0,0,0.03)" }}>
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                            <div>
                              <div style={{ fontWeight: 800, color: "#0f172a", fontSize: "1rem" }}>{pharm.display_name || pharm.organization_name || pharm.name}</div>
                              <div style={{ fontSize: "0.78rem", color: "#059669", fontWeight: 700 }}>
                                {pharm.license_number ? `License #${pharm.license_number}` : "Licensed Retail Pharmacy"}
                              </div>
                            </div>
                            <span style={{ fontSize: "0.72rem", background: "#ecfdf5", color: "#047857", border: "1px solid #a7f3d0", padding: "2px 8px", borderRadius: 999, fontWeight: 700 }}>
                              ✓ LICENSED
                            </span>
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: 6 }}>
                            <strong>Location:</strong> {[pharm.city, pharm.district, pharm.state].filter(Boolean).join(", ") || "Doorstep Delivery"}
                          </div>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTop: "1px solid #f1f5f9" }}>
                          <div>
                            <div style={{ fontSize: "0.72rem", color: "#64748b" }}>Speed</div>
                            <div style={{ fontWeight: 800, color: "#059669", fontSize: "0.9rem" }}>Same-Day Express</div>
                          </div>
                          <Link href="/pharmacy" style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "linear-gradient(135deg, #059669 0%, #047857 100%)", color: "white", padding: "8px 14px", borderRadius: 8, fontSize: "0.82rem", fontWeight: 700, textDecoration: "none" }}>
                            <span>Order Doorstep</span>
                            <ChevronRight size={14} />
                          </Link>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ background: "#ffffff", border: "1.5px dashed #cbd5e1", borderRadius: 16, padding: "32px 24px", textAlign: "center", gridColumn: "1 / -1" }}>
                      <ShieldCheck size={36} style={{ color: "#059669", margin: "0 auto 12px" }} />
                      <h4 style={{ margin: "0 0 6px", fontSize: "1.05rem", fontWeight: 700, color: "#0f172a" }}>
                        CallMedex Partner Pharmacy &amp; Jan Aushadhi Generic Medicine Network
                      </h4>
                      <p style={{ margin: "0 0 16px", fontSize: "0.85rem", color: "#64748b", maxWidth: 480, marginInline: "auto" }}>
                        Upload your doctor prescription for 1-click doorstep medicine dispatch and savings up to 70% on WHO-GMP certified generic drugs.
                      </p>
                      <Link href="/pharmacy" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#059669", color: "white", padding: "10px 20px", borderRadius: 10, textDecoration: "none", fontWeight: 700, fontSize: "0.88rem" }}>
                        <span>Upload Prescription for Doorstep Delivery</span>
                        <ChevronRight size={16} />
                      </Link>
                    </div>
                  )
                )}

                {activeTab === "packages" && [
                  {
                    name: "Full Body Health Screening",
                    params: "62 Test Parameters",
                    desc: "CBC, Lipid Profile, LFT, KFT, Fasting Glucose, Urine Routine & ESR",
                    mrp: "₹1,800",
                    price: "₹599",
                    url: "/packages",
                  },
                  {
                    name: "Diabetic & Cardiac Screening",
                    params: "74 Test Parameters",
                    desc: "HbA1c, Average Blood Sugar, Lipid Profile, Kidney & Liver Function, Microalbumin",
                    mrp: "₹2,200",
                    price: "₹749",
                    url: "/packages",
                  },
                  {
                    name: "Senior Citizen Vitality Screening",
                    params: "88 Test Parameters",
                    desc: "Vitamins D & B12, Cardiac Risk, Thyroid Function, Bone Health & Complete Organ Panel",
                    mrp: "₹3,500",
                    price: "₹1,399",
                    url: "/packages",
                  },
                ].map((pkg, idx) => (
                  <div key={idx} style={{ background: "#ffffff", border: "1.5px solid #e2e8f0", borderRadius: 16, padding: "18px 20px", display: "flex", flexDirection: "column", justifyContent: "space-between", boxShadow: "0 2px 10px rgba(0,0,0,0.03)" }}>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                        <div>
                          <div style={{ fontWeight: 800, color: "#0f172a", fontSize: "1rem" }}>{pkg.name}</div>
                          <div style={{ fontSize: "0.8rem", color: "#7c3aed", fontWeight: 700 }}>{pkg.params}</div>
                        </div>
                        <span style={{ fontSize: "0.72rem", background: "#f5f3ff", color: "#7c3aed", border: "1px solid #ddd6fe", padding: "2px 8px", borderRadius: 999, fontWeight: 700 }}>
                          FREE HOME VISIT
                        </span>
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "#64748b", lineHeight: 1.4, marginBottom: 8 }}>
                        {pkg.desc}
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTop: "1px solid #f1f5f9" }}>
                      <div>
                        <span style={{ fontSize: "0.75rem", color: "#94a3b8", textDecoration: "line-through", marginRight: 6 }}>{pkg.mrp}</span>
                        <span style={{ fontWeight: 900, color: "#7c3aed", fontSize: "1.15rem" }}>{pkg.price}</span>
                      </div>
                      <Link href={pkg.url} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)", color: "white", padding: "8px 14px", borderRadius: 8, fontSize: "0.82rem", fontWeight: 700, textDecoration: "none" }}>
                        <span>Book Package</span>
                        <ChevronRight size={14} />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action CTA Bar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: "rgba(2,132,199,0.1)",
                    display: "grid",
                    placeItems: "center",
                    color: "#0284c7",
                  }}
                >
                  <IconComponent size={24} />
                </div>
                <div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#0f172a" }}>Need immediate help booking?</div>
                  <div style={{ fontSize: "0.82rem", color: "#64748b" }}>Our patient helpline coordinators are on standby 24/7.</div>
                </div>
              </div>

              <Link
                href={currentService.bookingUrl}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "14px 28px",
                  borderRadius: 14,
                  background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                  color: "#ffffff",
                  textDecoration: "none",
                  fontWeight: 700,
                  fontSize: "1rem",
                  boxShadow: "0 6px 20px rgba(2, 132, 199, 0.35)",
                  transition: "transform 0.2s ease",
                }}
              >
                <span>{currentService.ctaText}</span>
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Why Choose CallMedex Doorstep Care ── */}
      <div style={{ maxWidth: 1100, margin: "48px auto 0", padding: "0 20px" }}>
        <h2 style={{ textAlign: "center", fontSize: "1.6rem", fontWeight: 800, color: "#0f172a", marginBottom: 24 }}>
          Why 20,000+ Families Rely on CallMedex Home Healthcare
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
          <div
            style={{
              background: "#ffffff",
              padding: 24,
              borderRadius: 18,
              border: "1px solid #e2e8f0",
              boxShadow: "0 4px 14px rgba(0,0,0,0.03)",
            }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "#e0f2fe", color: "#0284c7", display: "grid", placeItems: "center", marginBottom: 12 }}>
              <ShieldCheck size={20} />
            </div>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: "0 0 6px", color: "#0f172a" }}>Police & Background Verified</h3>
            <p style={{ margin: 0, fontSize: "0.86rem", color: "#64748b", lineHeight: 1.5 }}>
              Every visiting clinician carries CallMedex authenticated photo identification, verified nursing licenses, and clean police verification.
            </p>
          </div>

          <div
            style={{
              background: "#ffffff",
              padding: 24,
              borderRadius: 18,
              border: "1px solid #e2e8f0",
              boxShadow: "0 4px 14px rgba(0,0,0,0.03)",
            }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "#ecfdf5", color: "#059669", display: "grid", placeItems: "center", marginBottom: 12 }}>
              <Award size={20} />
            </div>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: "0 0 6px", color: "#0f172a" }}>Zero Hidden Travelling Fees</h3>
            <p style={{ margin: 0, fontSize: "0.86rem", color: "#64748b", lineHeight: 1.5 }}>
              Transparent pricing with no surprise transport or PPE surcharges. The price you see on screen is the exact total you pay.
            </p>
          </div>

          <div
            style={{
              background: "#ffffff",
              padding: 24,
              borderRadius: 18,
              border: "1px solid #e2e8f0",
              boxShadow: "0 4px 14px rgba(0,0,0,0.03)",
            }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "#f5f3ff", color: "#7c3aed", display: "grid", placeItems: "center", marginBottom: 12 }}>
              <Users size={20} />
            </div>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: "0 0 6px", color: "#0f172a" }}>Integrated Patient Health Records</h3>
            <p style={{ margin: 0, fontSize: "0.86rem", color: "#64748b", lineHeight: 1.5 }}>
              All home vitals, prescriptions, and lab values instantly sync into your CallMedex portal for seamless doctor consultations.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
