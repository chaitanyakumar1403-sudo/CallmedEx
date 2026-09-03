"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { TestTube, ShieldCheck, Thermometer, CheckCircle2, Clock, AlertTriangle, RefreshCw } from "lucide-react";

interface TimelineEvent {
  id: string;
  eventType: string;
  label: string;
  actorRole: string;
  actorName?: string | null;
  temperatureCelsius?: number | null;
  at: string;
  verification?: Array<{ point: string; passed: boolean }> | null;
}

interface PassportData {
  success: boolean;
  sampleId: string;
  barcode: string;
  tubeType: string;
  status: string;
  isVerified: boolean;
  events: TimelineEvent[];
}

export default function SpecimenPassportPublicPage({
  params,
}: {
  params: Promise<{ barcode: string }>;
}) {
  const resolvedParams = use(params);
  const barcode = resolvedParams.barcode;

  const [data, setData] = useState<PassportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPassport() {
      try {
        const res = await fetch(`/api/patient/samples/${barcode}/timeline`);
        if (!res.ok) {
          throw new Error("Specimen passport not found or tracking token required.");
        }
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message || "Failed to load specimen passport");
      } finally {
        setLoading(false);
      }
    }
    fetchPassport();
  }, [barcode]);

  const getTubeColor = (tubeType: string) => {
    const t = tubeType.toUpperCase();
    if (t.includes("LAVENDER") || t.includes("EDTA")) return { bg: "bg-purple-600", text: "text-purple-300", border: "border-purple-500/40", name: "EDTA K2 Lavender" };
    if (t.includes("YELLOW") || t.includes("SST")) return { bg: "bg-amber-500", text: "text-amber-300", border: "border-amber-500/40", name: "Serum SST Yellow" };
    if (t.includes("GREY") || t.includes("FLUORIDE")) return { bg: "bg-slate-400", text: "text-slate-200", border: "border-slate-400/40", name: "Sodium Fluoride Grey" };
    if (t.includes("BLUE") || t.includes("CITRATE")) return { bg: "bg-sky-500", text: "text-sky-300", border: "border-sky-500/40", name: "Sodium Citrate Blue" };
    return { bg: "bg-rose-500", text: "text-rose-300", border: "border-rose-500/40", name: tubeType || "Clinical Specimen" };
  };

  const tube = getTubeColor(data?.tubeType || "");

  return (
    <div className="min-h-screen bg-[#070D18] text-slate-100 flex flex-col items-center justify-start p-4 sm:p-8">
      {/* Glow */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(99,102,241,0.15),transparent_65%)] pointer-events-none" />

      <div className="w-full max-w-xl relative z-10">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-950/60 border border-indigo-500/30 text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-3">
            <TestTube className="w-3.5 h-3.5 text-indigo-400" />
            Specimen Passport &bull; Custody Chain
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Digital Specimen Passport
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Tamper-evident cold chain and intake verification trail.
          </p>
        </div>

        {loading ? (
          <div className="bg-[#111C2E]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-8 text-center">
            <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-300">Auditing custody ledger...</p>
          </div>
        ) : error ? (
          <div className="bg-[#111C2E]/80 backdrop-blur-xl border border-red-500/30 rounded-2xl p-6 text-center">
            <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-white mb-1">Specimen Unavailable</h2>
            <p className="text-sm text-slate-300 mb-4">{error}</p>
            <Link
              href="/"
              className="inline-block px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors"
            >
              Return to Home
            </Link>
          </div>
        ) : data ? (
          <div className="space-y-4">
            {/* Tube & Barcode Hero */}
            <div className="bg-[#111C2E]/85 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-12 rounded-full ${tube.bg} shadow-lg ring-2 ring-white/20`} />
                  <div>
                    <h2 className="text-lg font-bold text-white font-mono tracking-wider">
                      {data.barcode}
                    </h2>
                    <p className={`text-xs font-semibold ${tube.text}`}>
                      {tube.name}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 inline-flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {data.isVerified ? "5-Point Verified" : "Intake Sealed"}
                  </span>
                  <p className="text-[11px] text-slate-400 mt-1 capitalize">
                    Status: {data.status.replace("_", " ")}
                  </p>
                </div>
              </div>
            </div>

            {/* Timeline Trail */}
            <div className="bg-[#111C2E]/85 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                Custody Chain Milestones
              </h3>

              <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-white/10">
                {data.events.map((ev, idx) => (
                  <div key={ev.id || idx} className="relative group">
                    <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-indigo-400 ring-4 ring-[#111C2E]" />
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-white">{ev.label}</span>
                      {ev.temperatureCelsius !== null && ev.temperatureCelsius !== undefined && (
                        <span className="text-xs px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 font-mono flex items-center gap-1">
                          <Thermometer className="w-3 h-3 text-cyan-400" />
                          {ev.temperatureCelsius}°C
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                      {ev.actorName && (
                        <span>By {ev.actorName} ({ev.actorRole})</span>
                      )}
                      <span>&bull;</span>
                      <span>{ev.at ? new Date(ev.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Timestamp recorded"}</span>
                    </div>

                    {/* 5-Point Verification Checklist (G4 Clinical Opaque Card) */}
                    {ev.verification && ev.verification.length > 0 && (
                      <div className="mt-3 p-3.5 rounded-xl bg-[#09111e] border border-white/15 shadow-inner">
                        <h4 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                          Processing Center 5-Point Verification
                        </h4>
                        <div className="space-y-1.5">
                          {ev.verification.map((v, vIdx) => (
                            <div key={vIdx} className="flex items-center justify-between text-xs">
                              <span className="text-slate-300">{v.point}</span>
                              <span className={`font-semibold flex items-center gap-1 ${v.passed ? "text-emerald-400" : "text-amber-400"}`}>
                                <CheckCircle2 className="w-3 h-3" />
                                {v.passed ? "PASSED" : "REVIEWED"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="text-center text-xs text-slate-400 pt-2">
              CallMedex Chain-of-Custody Standard &bull; DPDP Audit Tracked
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
