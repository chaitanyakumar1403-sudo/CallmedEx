"use client";

/**
 * SampleStatusRail — Patient-facing 5-step sample progress bar
 *
 * Five stages visible to the patient:
 *   0. Pending Collection
 *   1. Collected
 *   2. In Transit / Received at PC
 *   3. Verified
 *   4. Sent to Reference Lab
 *
 * Each tube gets its own rail. Rejected tubes show a red "Rejected" badge.
 */

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/ui";
import {
  Clock, TestTube, Truck, ShieldCheck, FlaskConical, XCircle,
} from "@/components/ui/icons";
import { patientSamplesAPI } from "@/lib/api";
import { PATIENT_TRANSLATIONS, PatientLang } from "../patient/patientTranslations";

const TUBE_COLOURS: Record<string, string> = {
  lavender: "#9b59b6", gold: "#f39c12", blue: "#3498db",
  grey: "#95a5a6", red: "#e74c3c", green: "#2ecc71", yellow: "#f1c40f",
};

function capToHex(cap: string): string {
  return TUBE_COLOURS[(cap || "").toLowerCase().trim()] || "#94a3b8";
}

function getSteps(lang: PatientLang = 'en') {
  const t = PATIENT_TRANSLATIONS[lang] || PATIENT_TRANSLATIONS.en;
  return [
    { label: t.sampleSteps.pending, icon: Clock },
    { label: t.sampleSteps.collected, icon: TestTube },
    { label: t.sampleSteps.inTransit, icon: Truck },
    { label: t.sampleSteps.verified, icon: ShieldCheck },
    { label: t.sampleSteps.sentToLab, icon: FlaskConical },
  ];
}

function StepDot({
  step, currentStep, label, icon: StepIcon,
}: {
  step: number;
  currentStep: number;
  label: string;
  icon: any;
}) {
  const done = currentStep > step;
  const active = currentStep === step;
  const pending = currentStep < step;

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      flex: 1, position: "relative",
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: "50%",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: done ? "#16a34a"
          : active ? "#1a2b4a"
          : "#e2e8f0",
        color: done || active ? "#fff" : "#94a3b8",
        fontWeight: 700, fontSize: "0.75rem",
        border: active ? "3px solid #3b82f6" : "3px solid transparent",
        boxShadow: active ? "0 0 0 4px rgba(59, 130, 246, 0.2)" : "none",
        transition: "all 0.4s ease",
        animation: active ? "pulse 2s infinite" : "none",
      }}>
        <Icon as={StepIcon} size={16} />
      </div>
      <span style={{
        fontSize: "0.68rem", fontWeight: done || active ? 700 : 500,
        color: done ? "#16a34a" : active ? "#1a2b4a" : "#94a3b8",
        marginTop: 6, textAlign: "center", lineHeight: 1.2,
        transition: "color 0.3s",
      }}>
        {label}
      </span>
    </div>
  );
}

function ConnectorLine({ done }: { done: boolean }) {
  return (
    <div style={{
      flex: 1, height: 3, marginTop: 16,
      background: done
        ? "linear-gradient(90deg, #16a34a, #22c55e)"
        : "#e2e8f0",
      borderRadius: 999,
      transition: "background 0.4s ease",
      minWidth: 20,
    }} />
  );
}

function SampleRail({ sample, lang = 'en' }: { sample: any; lang?: PatientLang }) {
  const isRejected = sample.stage === "rejected";
  const currentStep = isRejected ? -1 : (sample.step ?? 0);
  const steps = getSteps(lang);

  return (
    <div
      className="card"
      style={{
        padding: 16,
        borderLeft: isRejected
          ? "4px solid #dc2626"
          : `4px solid ${capToHex(sample.cap_colour)}`,
      }}
    >
      {/* Tube info */}
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {sample.cap_colour && (
            <div style={{
              width: 18, height: 18, borderRadius: "50%",
              background: capToHex(sample.cap_colour),
              border: "2px solid #fff",
              boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
            }} />
          )}
          <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "#0f172a" }}>
            {sample.tube_name || "Unknown tube"}
          </span>
          {sample.barcode && (
            <span style={{
              fontFamily: "monospace", fontSize: "0.78rem",
              color: "#64748b", marginLeft: 4,
            }}>
              {sample.barcode}
            </span>
          )}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {(sample.test_names || []).map((t: string, i: number) => (
            <span
              key={i}
              style={{
                padding: "2px 10px", borderRadius: 999,
                background: "#f0f9ff", border: "1px solid #bfdbfe",
                fontSize: "0.72rem", fontWeight: 600, color: "#1e40af",
              }}
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      {sample.subject_name && (
        <div style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: 10 }}>
          Patient: <span style={{ fontWeight: 600 }}>{sample.subject_name}</span>
        </div>
      )}

      {/* Progress rail */}
      {isRejected ? (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "10px 14px", borderRadius: 8,
          background: "#fef2f2", border: "1px solid #fca5a5",
        }}>
          <Icon as={XCircle} size={16} />
          <span style={{ fontWeight: 700, color: "#991b1b" }}>
            Sample Rejected
          </span>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "flex-start" }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: "contents" }}>
              <StepDot step={i} currentStep={currentStep} label={s.label} icon={s.icon} />
              {i < steps.length - 1 && <ConnectorLine done={currentStep > i} />}
            </div>
          ))}
        </div>
      )}

      {/* Current status label */}
      {!isRejected && (
        <div style={{
          textAlign: "center", marginTop: 12,
          fontSize: "0.82rem", fontWeight: 700,
          color: currentStep >= 4 ? "#16a34a" : "#1a2b4a",
        }}>
          {sample.step_label || "Processing"}
        </div>
      )}
    </div>
  );
}

export default function SampleStatusRail({ lang = 'en' }: { lang?: PatientLang }) {
  const [samples, setSamples] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const t = PATIENT_TRANSLATIONS[lang] || PATIENT_TRANSLATIONS.en;

  const load = useCallback(async () => {
    try {
      const data = await patientSamplesAPI.getMySamples();
      setSamples(data.samples || []);
    } catch {
      // Silent fail — the section simply won't show
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: "center", color: "#64748b" }}>
        Loading sample status…
      </div>
    );
  }

  if (samples.length === 0) return null;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.2); }
          50% { box-shadow: 0 0 0 8px rgba(59, 130, 246, 0.1); }
        }
      `}</style>

      <h3 style={{
        margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#0f172a",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <Icon as={TestTube} size={16} /> {t.sampleStatusTitle}
      </h3>

      {samples.map((s) => (
        <SampleRail key={s.id} sample={s} lang={lang} />
      ))}
    </div>
  );
}
