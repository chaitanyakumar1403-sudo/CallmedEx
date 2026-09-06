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
 * Each tube gets its own rail. Cancelled tubes are strictly omitted.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Clock, TestTube, Truck, ShieldCheck, FlaskConical, XCircle, Activity
} from "@/components/ui/icons";
import { patientSamplesAPI } from "@/lib/api";
import { PATIENT_TRANSLATIONS, PatientLang } from "../patient/patientTranslations";

const TUBE_COLOURS: Record<string, { bg: string; border: string; text: string }> = {
  lavender: { bg: "rgba(168, 85, 247, 0.15)", border: "rgba(168, 85, 247, 0.4)", text: "var(--cm-ink)" },
  gold: { bg: "rgba(245, 158, 11, 0.15)", border: "rgba(245, 158, 11, 0.4)", text: "var(--cm-ink)" },
  blue: { bg: "rgba(14, 165, 233, 0.15)", border: "rgba(14, 165, 233, 0.4)", text: "var(--cm-ink)" },
  grey: { bg: "rgba(148, 163, 184, 0.15)", border: "rgba(148, 163, 184, 0.4)", text: "var(--cm-ink)" },
  red: { bg: "rgba(239, 68, 68, 0.15)", border: "rgba(239, 68, 68, 0.4)", text: "var(--cm-ink)" },
  green: { bg: "rgba(16, 185, 129, 0.15)", border: "rgba(16, 185, 129, 0.4)", text: "var(--cm-ink)" },
  yellow: { bg: "rgba(234, 179, 8, 0.15)", border: "rgba(234, 179, 8, 0.4)", text: "var(--cm-ink)" },
};

function getTubeStyle(cap: string) {
  const key = (cap || "").toLowerCase().trim();
  return TUBE_COLOURS[key] || { bg: "var(--cm-surface-2)", border: "var(--cm-line)", text: "var(--cm-ink)" };
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

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      flex: 1, position: "relative", zIndex: 1,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: "50%",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: done ? "var(--cm-done)"
          : active ? "var(--cm-active)"
          : "var(--cm-surface-2)",
        color: done || active ? "#ffffff" : "var(--cm-ink-3)",
        fontWeight: 700, fontSize: "0.75rem",
        border: active ? "3px solid var(--cm-accent)" : "3px solid transparent",
        boxShadow: active ? "0 0 0 4px rgba(2, 132, 199, 0.2)" : "none",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      }}>
        <StepIcon size={16} />
      </div>
      <span style={{
        fontSize: "0.72rem", fontWeight: active ? 800 : done ? 600 : 500,
        color: active ? "var(--cm-ink)" : done ? "var(--cm-ink-2)" : "var(--cm-ink-3)",
        marginTop: 6, textAlign: "center", maxWidth: 90, lineHeight: 1.25,
      }}>
        {label}
      </span>
    </div>
  );
}

function ConnectorLine({ done }: { done: boolean }) {
  return (
    <div style={{
      flex: 1, height: 3, marginTop: 17,
      background: done ? "var(--cm-done)" : "var(--cm-line)",
      borderRadius: 2,
      transition: "background 0.3s ease",
    }} />
  );
}

function SampleRail({ sample, lang = 'en' }: { sample: any; lang?: PatientLang }) {
  const currentStep = sample.step ?? 0;
  const isRejected = sample.status === "rejected";
  const tubeStyle = getTubeStyle(sample.cap_colour);
  const steps = getSteps(lang);

  return (
    <div
      className="card"
      style={{
        padding: "16px 20px",
        borderRadius: "var(--cm-radius)",
        border: "1px solid var(--cm-line)",
        borderLeft: `5px solid ${sample.cap_colour ? (sample.cap_colour === 'gold' ? 'var(--cm-amber)' : sample.cap_colour === 'lavender' ? 'var(--cm-purple)' : 'var(--cm-active)') : 'var(--cm-active)'}`,
      }}
    >
      {/* Tube & Test Header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 16, flexWrap: "wrap", gap: 8,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "4px 10px", borderRadius: 999,
            background: tubeStyle.bg, border: `1px solid ${tubeStyle.border}`,
            fontSize: "0.78rem", fontWeight: 700, color: tubeStyle.text,
          }}>
            <TestTube size={13} />
            {sample.tube_name || sample.expected_tube_type_code || "Specimen"}
            {sample.cap_colour ? ` (${sample.cap_colour})` : ""}
          </span>
          {sample.subject_name && (
            <span style={{ fontSize: "0.78rem", color: "var(--cm-ink-3)", fontWeight: 600 }}>
              for {sample.subject_name}
            </span>
          )}
        </div>

        {/* Tests in this tube */}
        {sample.test_names && sample.test_names.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {sample.test_names.map((name: string, i: number) => (
              <span key={i} style={{
                fontSize: "0.72rem", padding: "2px 8px", borderRadius: 4,
                background: "var(--cm-surface-2)", color: "var(--cm-ink-2)",
                border: "1px solid var(--cm-line)", fontWeight: 600,
              }}>
                {name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 5-Step Stepper */}
      {isRejected ? (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "10px 16px", borderRadius: "var(--cm-radius)",
          background: "var(--cm-urgent-surface)", border: "1px solid var(--cm-urgent-line)",
        }}>
          <XCircle size={16} style={{ color: "var(--cm-urgent)" }} />
          <span style={{ fontWeight: 700, color: "var(--cm-urgent)", fontSize: "0.85rem" }}>
            Sample Specimen Requires Recollection
          </span>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "flex-start", position: "relative" }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: "contents" }}>
              <StepDot step={i} currentStep={currentStep} label={s.label} icon={s.icon} />
              {i < steps.length - 1 && <ConnectorLine done={currentStep > i} />}
            </div>
          ))}
        </div>
      )}

      {/* Current status indicator */}
      {!isRejected && (
        <div style={{
          textAlign: "center", marginTop: 14,
          fontSize: "0.82rem", fontWeight: 700,
          color: currentStep >= 4 ? "var(--cm-done)" : "var(--cm-navy)",
          letterSpacing: "0.02em",
        }}>
          {sample.step_label || "Processing in Lab Workflow"}
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
      const all = data.samples || [];
      // Cancelled, rejected, failed, and delivered tests must NOT appear on the live progress rail
      const activeSamples = all.filter((s: any) =>
        s.is_active === true &&
        !["cancelled", "completed", "delivered", "failed", "rejected"].includes(s.status) &&
        !["cancelled", "rejected", "failed"].includes(s.stage)
      );
      setSamples(activeSamples);
    } catch {
      // Silent fail — the section simply won't show
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div id="sample-tracking" style={{ padding: 20, textAlign: "center", color: "var(--cm-ink-3)" }}>
        Loading live sample status…
      </div>
    );
  }

  if (samples.length === 0) return null;

  return (
    <div id="sample-tracking" style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{
          margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "var(--cm-ink)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <Activity size={18} style={{ color: "var(--cm-active)" }} />
          {t.sampleStatusTitle}
        </h3>
        <span style={{
          fontSize: "0.75rem", fontWeight: 700,
          background: "var(--cm-active-surface)", color: "var(--cm-active)",
          border: "1px solid var(--cm-active-line)", padding: "2px 10px", borderRadius: 999,
        }}>
          {samples.length} Active {samples.length === 1 ? "Tube" : "Tubes"}
        </span>
      </div>

      {samples.map((s) => (
        <SampleRail key={s.id} sample={s} lang={lang} />
      ))}
    </div>
  );
}
