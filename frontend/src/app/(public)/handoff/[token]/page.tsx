"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Stethoscope, Clock, Pill, Activity, ShieldCheck, Download, AlertCircle, RefreshCw, FileText } from "lucide-react";

interface HandoffData {
  success: boolean;
  patient?: {
    name: string;
    gender: string;
    dob: string;
  };
  medications?: Array<{
    medicine_name: string;
    dosage: string;
    pills_per_day: number;
    remaining_pills?: number;
    refill_date?: string;
  }>;
  biomarkers?: Array<{
    observation_code: string;
    observation_name: string;
    value_number: number;
    unit: string;
    recorded_at: string;
  }>;
  briefing?: {
    specialty_type?: string;
    chief_anomalies?: string[];
    recommended_focus_points?: string[];
    risk_summary?: string;
  } | null;
  fhir_bundle?: any;
}

export default function DoctorHandoffViewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const resolvedParams = use(params);
  const token = resolvedParams.token;

  const [data, setData] = useState<HandoffData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFhir, setShowFhir] = useState(false);

  useEffect(() => {
    async function loadHandoff() {
      try {
        const res = await fetch(`/api/v1/handoff/${token}`);
        if (!res.ok) {
          if (res.status === 401) {
            throw new Error("This Doctor Handoff packet has expired (15-minute consultation limit) or is invalid.");
          }
          throw new Error("Failed to load handoff packet.");
        }
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message || "Failed to load handoff data");
      } finally {
        setLoading(false);
      }
    }
    loadHandoff();
  }, [token]);

  const downloadFhir = () => {
    if (!data?.fhir_bundle) return;
    const blob = new Blob([JSON.stringify(data.fhir_bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `FHIR_R4_Patient_${data.patient?.name?.replace(/\s+/g, "_") || "Record"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#070D18] text-slate-100 flex flex-col items-center justify-start p-4 sm:p-8">
      {/* Glow */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(16,185,129,0.12),transparent_60%)] pointer-events-none" />

      <div className="w-full max-w-2xl relative z-10">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs font-semibold uppercase tracking-wider mb-3">
            <Stethoscope className="w-3.5 h-3.5 text-emerald-400" />
            Verified Clinical Handoff &bull; ABDM FHIR R4
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Physician Consultation Packet
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Patient-consented briefing for physical OPD or emergency room intake.
          </p>
        </div>

        {loading ? (
          <div className="bg-[#111C2E]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-8 text-center">
            <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-300">Decrypting clinical observations...</p>
          </div>
        ) : error ? (
          <div className="bg-[#111C2E]/80 backdrop-blur-xl border border-red-500/30 rounded-2xl p-6 text-center">
            <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-white mb-1">Packet Expired or Unavailable</h2>
            <p className="text-sm text-slate-300 mb-4">{error}</p>
            <p className="text-xs text-slate-400">
              For security and DPDP compliance, patient handoff QR codes expire strictly 15 minutes after generation. Ask the patient to tap &ldquo;Regenerate QR&rdquo; in their app.
            </p>
          </div>
        ) : data ? (
          <div className="space-y-4">
            {/* Patient Card */}
            <div className="bg-[#111C2E]/85 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4 mb-4">
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {data.patient?.name || "Verified Patient"}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {data.patient?.gender ? data.patient.gender.toUpperCase() : "PATIENT"} &bull; DOB: {data.patient?.dob || "On File"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Consent Verified
                  </span>
                  <button
                    onClick={downloadFhir}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 transition-colors"
                    title="Download FHIR R4 JSON"
                  >
                    <Download className="w-4 h-4 text-emerald-400" />
                  </button>
                </div>
              </div>

              {/* Doctor Briefing Highlights */}
              {data.briefing && (
                <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-xl p-4 mb-5">
                  <h3 className="text-xs font-bold text-emerald-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-emerald-400" />
                    Clinical Trend Highlights ({data.briefing.specialty_type || "General"})
                  </h3>
                  {data.briefing.chief_anomalies && data.briefing.chief_anomalies.length > 0 ? (
                    <ul className="space-y-1 text-xs text-slate-200">
                      {data.briefing.chief_anomalies.map((anom, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-amber-400 font-bold">&bull;</span>
                          <span>{anom}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-300">
                      No acute lab trends flagged. Baseline observations stable.
                    </p>
                  )}
                </div>
              )}

              {/* Active Medications */}
              <div className="mb-5">
                <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                  <Pill className="w-4 h-4 text-cyan-400" />
                  Active Medications ({data.medications?.length || 0})
                </h3>
                {data.medications && data.medications.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {data.medications.map((med, idx) => (
                      <div
                        key={idx}
                        className="bg-white/5 border border-white/5 rounded-xl p-3 flex flex-col justify-between"
                      >
                        <span className="font-semibold text-sm text-slate-100">{med.medicine_name}</span>
                        <span className="text-xs text-slate-400 mt-1">
                          {med.dosage} &bull; {med.pills_per_day}x daily
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 bg-white/5 rounded-xl p-3">
                    No active medications recorded by patient.
                  </p>
                )}
              </div>

              {/* Recent Biomarkers / Lab Observations */}
              <div>
                <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  Recent Lab Observations ({data.biomarkers?.length || 0})
                </h3>
                {data.biomarkers && data.biomarkers.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-white/10 text-slate-400">
                          <th className="py-2 px-3">Biomarker</th>
                          <th className="py-2 px-3">Reading</th>
                          <th className="py-2 px-3">Recorded</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {data.biomarkers.map((bm, idx) => (
                          <tr key={idx} className="hover:bg-white/5">
                            <td className="py-2 px-3 font-medium text-slate-200">{bm.observation_name}</td>
                            <td className="py-2 px-3 font-semibold text-emerald-400">
                              {bm.value_number} {bm.unit}
                            </td>
                            <td className="py-2 px-3 text-slate-400">{bm.recorded_at ? bm.recorded_at.slice(0, 10) : "Recent"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 bg-white/5 rounded-xl p-3">
                    No historical lab tests on file.
                  </p>
                )}
              </div>
            </div>

            {/* Action footer */}
            <div className="flex items-center justify-between text-xs text-slate-400 px-2">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Valid for 15 minutes from generation
              </span>
              <button
                onClick={() => setShowFhir(!showFhir)}
                className="text-cyan-400 hover:underline flex items-center gap-1"
              >
                <FileText className="w-3.5 h-3.5" />
                {showFhir ? "Hide Raw FHIR" : "View FHIR R4 Bundle"}
              </button>
            </div>

            {showFhir && (
              <pre className="bg-[#0c1422] border border-white/10 rounded-xl p-4 text-[11px] text-emerald-300 overflow-x-auto max-h-80">
                {JSON.stringify(data.fhir_bundle, null, 2)}
              </pre>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
