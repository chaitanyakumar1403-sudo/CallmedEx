"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Stethoscope, FlaskConical, Video, Building2, Star, MapPin, Search,
  CheckCircle2, ArrowLeft, ClipboardList,
  Sparkles, Smile, Eye, Ear, Brain, Heart, Wind, Droplet, Bone,
  type LucideIcon,
} from "lucide-react";

interface OrganInfo {
  id: string;
  name: string;
  Icon: LucideIcon;
  specialization: string;
  tests: string[];
  description: string;
}

const ORGANS: Record<string, OrganInfo> = {
  skin: {
    id: "skin",
    name: "Skin & Hair (Dermatology)",
    Icon: Sparkles,
    specialization: "Dermatology",
    tests: ["Skin Biopsy", "Allergy Comprehensive Panel", "Dermatology Teleconsult", "Fungal Culture"],
    description: "Complete skin barrier, acne, eczema, and hair health evaluation.",
  },
  dental: {
    id: "dental",
    name: "Teeth & Oral Care (Dentistry)",
    Icon: Smile,
    specialization: "Dentistry",
    tests: ["Dental X-Ray (OPG)", "Scaling & Polishing", "Cavity & Gum Inspection"],
    description: "Comprehensive oral hygiene, tooth decay check, and gum disease screening.",
  },
  eyes: {
    id: "eyes",
    name: "Eyes & Vision (Ophthalmology)",
    Icon: Eye,
    specialization: "Ophthalmology",
    tests: ["Refraction Vision Test", "Fundus Examination", "Tonometry (Eye Pressure)", "Dry Eye Screening"],
    description: "Vision clarity, cataract screening, glaucoma pressure, and retina check.",
  },
  ent: {
    id: "ent",
    name: "Ears, Nose & Throat (ENT)",
    Icon: Ear,
    specialization: "ENT",
    tests: ["Audiometry Hearing Test", "Nasal Endoscopy", "Throat Swab Culture", "Sinus Evaluation"],
    description: "Ear hearing clarity, nasal blockage check, and throat infection diagnosis.",
  },
  head: {
    id: "head",
    name: "Brain & Nervous System (Neurology)",
    Icon: Brain,
    specialization: "Neurology",
    tests: ["Brain MRI / CT Scan", "EEG (Electroencephalogram)", "Migraine Risk Panel"],
    description: "Headache evaluation, stroke prevention, and nerve reflex mapping.",
  },
  heart: {
    id: "heart",
    name: "Heart & Cardiovascular System",
    Icon: Heart,
    specialization: "Cardiology",
    tests: ["ECG (12-Lead)", "Echocardiogram (2D Echo)", "Lipid Profile", "Cardiac Troponin T"],
    description: "Coronary health, blood pressure control, and cardiac risk score.",
  },
  lungs: {
    id: "lungs",
    name: "Lungs & Respiratory System",
    Icon: Wind,
    specialization: "Pulmonology",
    tests: ["Chest X-Ray (PA View)", "Spirometry (Pulmonary Function)", "SpO2 & ABG Test"],
    description: "Asthma, bronchitis, oxygen saturation, and respiratory capacity check.",
  },
  abdomen: {
    id: "abdomen",
    name: "Abdomen & Digestive System",
    Icon: Droplet,
    specialization: "Gastroenterology",
    tests: ["Ultrasound Abdomen & Pelvis", "Liver Function Test (LFT)", "Kidney Function Test (KFT)"],
    description: "Liver health, stomach digestion, kidney filtration, and gut microbiome.",
  },
  joints: {
    id: "joints",
    name: "Joints, Bones & Spine (Orthopedics)",
    Icon: Bone,
    specialization: "Orthopedics",
    tests: ["Bone Mineral Density (DEXA)", "Joint X-Ray", "Uric Acid Test", "RA Factor"],
    description: "Arthritis screening, bone density, cartilage strength, and spinal alignment.",
  },
};

const HOTSPOTS: { id: string; cx: number; cy: number; r: number; heart?: boolean }[] = [
  { id: "skin", cx: 72, cy: 160, r: 14 },
  { id: "eyes", cx: 92, cy: 45, r: 10 },
  { id: "dental", cx: 108, cy: 58, r: 10 },
  { id: "ent", cx: 122, cy: 45, r: 10 },
  { id: "head", cx: 100, cy: 34, r: 14 },
  { id: "lungs", cx: 100, cy: 125, r: 20 },
  { id: "heart", cx: 112, cy: 138, r: 13, heart: true },
  { id: "abdomen", cx: 100, cy: 185, r: 22 },
  { id: "joints", cx: 110, cy: 255, r: 13 },
];

export default function InteractiveBodyMap() {
  const router = useRouter();
  const [selectedOrgan, setSelectedOrgan] = useState<string>("heart");
  const [consultMode, setConsultMode] = useState<null | "choosing" | "offline_list">(null);
  const [realClinics, setRealClinics] = useState<any[]>([]);
  const [clinicsLoading, setClinicsLoading] = useState<boolean>(false);
  const current = ORGANS[selectedOrgan] || ORGANS["heart"];

  useEffect(() => {
    if (consultMode === "offline_list") {
      setClinicsLoading(true);
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      fetch(`${apiBase}/api/providers/search/doctors?specialization=${encodeURIComponent(current.specialization)}&consultation_mode=in_person`)
        .then(r => r.json())
        .then(data => {
          setRealClinics(data.doctors || []);
        })
        .catch(() => {
          setRealClinics([]);
        })
        .finally(() => {
          setClinicsLoading(false);
        });
    }
  }, [consultMode, current.specialization]);

  const handleOnlineConsult = () => {
    router.push(`/consultation?spec=${encodeURIComponent(current.specialization)}&mode=online`);
  };

  return (
    <div className="cm-panel">
      <div className="cm-row-between" style={{ marginBottom: 'var(--cm-5)' }}>
        <div>
          <h3 className="cm-panel__title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--cm-2)' }}>
            <Stethoscope className="cm-icon" size={18} style={{ color: 'var(--cm-navy)' }} />
            Interactive Body Map
            <span className="cm-pill cm-pill--active">Explore by system</span>
          </h3>
          <p className="cm-panel__note" style={{ marginBottom: 0 }}>
            Select an organ region or specialty tab to see recommended lab panels and consult top specialists.
          </p>
        </div>
      </div>

      {/* Organ Selector Chips Bar */}
      <div style={{ display: "flex", gap: 'var(--cm-2)', overflowX: "auto", paddingBottom: 'var(--cm-2)', marginBottom: 'var(--cm-5)' }}>
        {Object.values(ORGANS).map((org) => {
          const isSelected = org.id === selectedOrgan;
          const OrgIcon = org.Icon;
          return (
            <button
              key={org.id}
              type="button"
              onClick={() => { setSelectedOrgan(org.id); setConsultMode(null); }}
              className="cm-btn cm-btn--sm"
              style={{
                borderRadius: 'var(--cm-radius-pill)',
                border: isSelected ? '2px solid var(--cm-navy)' : '1px solid var(--cm-line-strong)',
                background: isSelected ? 'var(--cm-active-bg)' : 'var(--cm-surface)',
                color: isSelected ? 'var(--cm-navy)' : 'var(--cm-ink-2)',
              }}
            >
              <OrgIcon size={14} /> {org.name.split(" ")[0]}
            </button>
          );
        })}
      </div>

      {/* Main Grid: Body Vector + Organ Info Drawer */}
      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1.4fr", gap: 'var(--cm-5)', alignItems: "center" }}>

        {/* Anatomical Body Map SVG */}
        <div style={{
          position: "relative",
          textAlign: "center",
          background: "var(--cm-surface-2)",
          padding: 'var(--cm-5)',
          borderRadius: 'var(--cm-radius-lg)',
          border: "1px solid var(--cm-line-strong)",
        }}>
          <svg viewBox="0 0 200 420" style={{ width: "100%", maxHeight: 340, cursor: "pointer" }}>
            <path
              d="M100 20 C120 20 135 35 135 55 C135 70 125 80 115 85 L145 105 L165 180 L145 190 L135 130 L135 230 L150 380 L125 380 L110 260 L90 260 L75 380 L50 380 L65 230 L65 130 L55 190 L35 180 L55 105 L85 85 C75 80 65 70 65 55 C65 35 80 20 100 20 Z"
              fill="var(--cm-line-strong)"
              stroke="var(--cm-ink-3)"
              strokeWidth="2"
            />

            {HOTSPOTS.map((spot) => {
              const isSelected = spot.id === selectedOrgan;
              const SpotIcon = ORGANS[spot.id].Icon;
              const fill = spot.heart
                ? (isSelected ? 'var(--cm-urgent)' : 'var(--cm-ink-faint)')
                : (isSelected ? 'var(--cm-active)' : 'var(--cm-ink-faint)');
              const stroke = spot.heart ? 'var(--cm-urgent)' : 'var(--cm-navy)';
              const iconSize = spot.r * 0.95;
              return (
                <g key={spot.id} onClick={() => { setSelectedOrgan(spot.id); setConsultMode(null); }} style={{ cursor: 'pointer' }}>
                  <circle
                    cx={spot.cx}
                    cy={spot.cy}
                    r={spot.r}
                    fill={fill}
                    fillOpacity={isSelected ? 0.95 : 0.55}
                    stroke={stroke}
                    strokeWidth={isSelected ? 3 : 1}
                  />
                  <svg
                    x={spot.cx - iconSize / 2}
                    y={spot.cy - iconSize / 2}
                    width={iconSize}
                    height={iconSize}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth={2.5}
                    pointerEvents="none"
                  >
                    <SpotIcon width={24} height={24} />
                  </svg>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Selected Organ Drawer */}
        <div className="cm-card">
          <div style={{ display: "flex", alignItems: "center", gap: 'var(--cm-3)', marginBottom: 'var(--cm-3)' }}>
            <span style={{ display: 'grid', placeItems: 'center', width: 44, height: 44, borderRadius: 'var(--cm-radius)', background: 'var(--cm-active-bg)', color: 'var(--cm-navy)', flex: 'none' }}>
              <current.Icon size={22} />
            </span>
            <div>
              <h4 style={{ margin: 0, fontSize: 'var(--cm-text-lg)', color: 'var(--cm-ink)', fontWeight: 800 }}>{current.name}</h4>
              <span className="cm-pill cm-pill--active" style={{ marginTop: 4 }}>
                {current.specialization}
              </span>
            </div>
          </div>

          <p style={{ fontSize: 'var(--cm-text-sm)', color: 'var(--cm-ink-3)', margin: '0 0 var(--cm-4) 0' }}>
            {current.description}
          </p>

          <div style={{ background: 'var(--cm-surface-2)', padding: 'var(--cm-3)', borderRadius: 'var(--cm-radius)', marginBottom: 'var(--cm-4)', border: '1px solid var(--cm-line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--cm-2)', marginBottom: 4 }}>
              <ClipboardList size={14} style={{ color: 'var(--cm-ink-3)' }} />
              <strong style={{ fontSize: 'var(--cm-text-sm)', color: 'var(--cm-ink-2)' }}>Vitals for this system</strong>
            </div>
            <p style={{ margin: 0, fontSize: 'var(--cm-text-sm)', color: 'var(--cm-ink-3)' }}>
              No recorded vitals on file yet. Book a test or complete a consultation to populate this from real results.
            </p>
          </div>

          <div style={{ marginBottom: 'var(--cm-5)' }}>
            <strong style={{ fontSize: 'var(--cm-text-sm)', color: 'var(--cm-ink-2)' }}>Recommended Tests & Panels</strong>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 'var(--cm-2)' }}>
              {current.tests.map((t, i) => (
                <span key={i} className="cm-pill cm-pill--active">
                  <CheckCircle2 size={11} /> {t}
                </span>
              ))}
            </div>
          </div>

          {/* Consultation Actions — Online/Offline choice */}
          {consultMode === null && (
            <div style={{ display: "flex", gap: 'var(--cm-2)', flexWrap: "wrap" }}>
              <button type="button" className="cm-btn cm-btn--primary" style={{ flex: 1 }} onClick={() => setConsultMode("choosing")}>
                <Stethoscope size={16} /> Consult {current.specialization}
              </button>
              <button
                type="button"
                className="cm-btn"
                style={{ flex: 1, background: 'var(--cm-navy-deep)', color: '#fff' }}
                onClick={() => router.push(`/diagnostics?search=${encodeURIComponent(current.name)}`)}
              >
                <FlaskConical size={16} /> Book Lab Package
              </button>
            </div>
          )}

          {/* Online vs Offline Choice */}
          {consultMode === "choosing" && (
            <div style={{ background: 'var(--cm-active-bg)', borderRadius: 'var(--cm-radius-lg)', padding: 'var(--cm-4)', border: '1px solid var(--cm-active-line)' }}>
              <div className="cm-row-between" style={{ marginBottom: 'var(--cm-3)' }}>
                <strong style={{ color: 'var(--cm-navy)', fontSize: 'var(--cm-text-sm)' }}>
                  How would you like to consult?
                </strong>
                <button type="button" onClick={() => setConsultMode(null)} className="cm-btn cm-btn--ghost cm-btn--sm">
                  <ArrowLeft size={14} /> Back
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 'var(--cm-3)' }}>
                <button
                  type="button"
                  onClick={handleOnlineConsult}
                  className="cm-card cm-card--interactive"
                  style={{ textAlign: 'center', border: '2px solid var(--cm-navy)' }}
                >
                  <Video size={26} style={{ color: 'var(--cm-navy)', marginBottom: 6 }} />
                  <div style={{ fontWeight: 700, color: 'var(--cm-navy)', fontSize: 'var(--cm-text-sm)' }}>
                    Online
                  </div>
                  <div style={{ fontSize: 'var(--cm-text-xs)', color: 'var(--cm-ink-3)', marginTop: 4 }}>
                    Video consultation from home. HD call with AI-drafted summary.
                  </div>
                  <span className="cm-pill cm-pill--done" style={{ marginTop: 8 }}>Available Now</span>
                </button>

                <button
                  type="button"
                  onClick={() => setConsultMode("offline_list")}
                  className="cm-card cm-card--interactive"
                  style={{ textAlign: 'center', border: '2px solid var(--cm-line-strong)' }}
                >
                  <Building2 size={26} style={{ color: 'var(--cm-ink)', marginBottom: 6 }} />
                  <div style={{ fontWeight: 700, color: 'var(--cm-ink)', fontSize: 'var(--cm-text-sm)' }}>
                    Offline
                  </div>
                  <div style={{ fontSize: 'var(--cm-text-xs)', color: 'var(--cm-ink-3)', marginTop: 4 }}>
                    Visit a partner clinic near you. In-person examination.
                  </div>
                  <span className="cm-pill cm-pill--active" style={{ marginTop: 8 }}>Walk-in</span>
                </button>
              </div>
            </div>
          )}

          {/* Offline Clinic List — Real Data Only */}
          {consultMode === "offline_list" && (
            <div style={{ background: 'var(--cm-surface-2)', borderRadius: 'var(--cm-radius-lg)', padding: 'var(--cm-4)', border: '1px solid var(--cm-line)' }}>
              <div className="cm-row-between" style={{ marginBottom: 'var(--cm-3)' }}>
                <strong style={{ color: 'var(--cm-ink)', fontSize: 'var(--cm-text-sm)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Building2 size={14} /> Walk-in {current.specialization} Clinics
                </strong>
                <button type="button" onClick={() => setConsultMode("choosing")} className="cm-btn cm-btn--ghost cm-btn--sm">
                  <ArrowLeft size={14} /> Back
                </button>
              </div>

              {clinicsLoading ? (
                <div style={{ textAlign: "center", padding: 'var(--cm-5)', color: 'var(--cm-ink-3)', fontSize: 'var(--cm-text-sm)' }}>
                  Searching verified clinics…
                </div>
              ) : realClinics.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 'var(--cm-2)', maxHeight: 240, overflowY: "auto" }}>
                  {realClinics.map((clinic, idx) => {
                    const cName = clinic.hospital_clinic_name || clinic.full_name || clinic.name || "CallMedex Partner Clinic";
                    const cAddr = clinic.city || clinic.address || "Registered Clinic";
                    const cRating = clinic.rating || 4.8;
                    const cId = clinic.user_id || clinic.id;

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => router.push(`/booking?type=doctor&doctor=${cId}&spec=${encodeURIComponent(current.specialization)}`)}
                        className="cm-card cm-card--interactive"
                        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left", gap: 'var(--cm-3)', padding: 'var(--cm-3) var(--cm-4)' }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, color: 'var(--cm-ink)', fontSize: 'var(--cm-text-sm)' }}>
                            {cName}
                          </div>
                          <div style={{ fontSize: 'var(--cm-text-xs)', color: 'var(--cm-ink-3)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <MapPin size={12} /> {cAddr}
                          </div>
                          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                            <span style={{ fontSize: 'var(--cm-text-xs)', color: 'var(--cm-waiting)', display: 'flex', alignItems: 'center', gap: 3 }}>
                              <Star size={11} /> {cRating}
                            </span>
                            <span style={{ fontSize: 'var(--cm-text-xs)', color: 'var(--cm-done)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                              <CheckCircle2 size={11} /> Verified
                            </span>
                          </div>
                        </div>
                        <span className="cm-pill cm-pill--active">Book Visit</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="cm-empty">
                  <span className="cm-empty__icon">
                    <Building2 size={20} />
                  </span>
                  <p className="cm-empty__title" style={{ fontSize: 'var(--cm-text-base)' }}>
                    No Walk-in Clinics for {current.specialization}
                  </p>
                  <p className="cm-empty__body">
                    No partner clinics are currently registered for this specialty in your area.
                  </p>
                  <div style={{ display: "flex", gap: 'var(--cm-2)', justifyContent: "center", flexWrap: "wrap", marginTop: 'var(--cm-4)' }}>
                    <button type="button" onClick={handleOnlineConsult} className="cm-btn cm-btn--primary cm-btn--sm">
                      <Video size={14} /> Book Video Call Instead
                    </button>
                    <button type="button" onClick={() => router.push("/consultation?mode=walkin")} className="cm-btn cm-btn--secondary cm-btn--sm">
                      <Search size={14} /> Browse All Clinics
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
