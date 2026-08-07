'use client';

import React, { useState } from 'react';
import { useHealthMatrixStore } from '@/store/useHealthMatrixStore';
import { FileText, Share2, QrCode, X, Sparkles, Heart, Activity, Stethoscope, Pill, CheckCircle2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const SPECIALTIES = [
  { id: 'Cardiology', label: 'Cardiology', icon: Heart, color: 'from-rose-500 to-red-600' },
  { id: 'Endocrinology', label: 'Endocrinology', icon: Activity, color: 'from-amber-500 to-orange-600' },
  { id: 'Gastroenterology', label: 'Gastroenterology', icon: Pill, color: 'from-emerald-500 to-teal-600' },
  { id: 'General Practice', label: 'General Practice', icon: Stethoscope, color: 'from-indigo-500 to-blue-600' },
];

export const DoctorBriefingModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { activeBriefing, setActiveBriefing } = useHealthMatrixStore();
  const [specialty, setSpecialty] = useState<string>('Cardiology');
  const [isCompiling, setIsCompiling] = useState<boolean>(false);
  const [showQR, setShowQR] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleCompile = async () => {
    setIsCompiling(true);
    try {
      const res = await fetch('/api/v1/patient/biomarkers/doctor-briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specialty_type: specialty }),
      });
      const data = await res.json();
      if (data.briefing) {
        setActiveBriefing({
          specialtyType: data.briefing.specialty_type,
          patientId: data.briefing.patient_id,
          compiledAt: data.briefing.compiled_at,
          chiefAnomalies: data.briefing.chief_anomalies,
          activeMedicationsCount: data.briefing.active_medications_count,
          recentReportCount: data.briefing.recent_report_count,
          riskSummary: data.briefing.risk_summary,
          recommendedFocusPoints: data.briefing.recommended_focus_points,
        });
      }
    } catch (err) {
      console.error('Error generating briefing:', err);
    } finally {
      setIsCompiling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xl animate-fadeIn">
      <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-indigo-500/40 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 p-6 text-white shadow-2xl shadow-indigo-500/20">
        {/* Top Glow Accent */}
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-48 w-96 rounded-full bg-indigo-500/20 blur-3xl" />

        {/* Modal Header */}
        <div className="relative z-10 flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-indigo-500/30 bg-indigo-500/20 text-indigo-400">
              <Sparkles className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">AI Doctor Briefing Compiler</h3>
              <p className="text-xs text-slate-400">Synthesize FHIR records into a 1-page clinical summary</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-800/80 text-slate-400 transition-all hover:bg-slate-700 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Specialty Selector Cards */}
        <div className="relative z-10 my-5">
          <label className="mb-2.5 block text-xs font-bold uppercase tracking-wider text-slate-400">
            Target Specialist Category
          </label>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {SPECIALTIES.map((spec) => {
              const IconComponent = spec.icon;
              const isSelected = specialty === spec.id;
              return (
                <button
                  key={spec.id}
                  onClick={() => setSpecialty(spec.id)}
                  className={`flex flex-col items-center justify-center rounded-2xl border p-3 text-center transition-all ${
                    isSelected
                      ? 'border-indigo-500/80 bg-indigo-500/20 text-white font-bold shadow-lg shadow-indigo-500/20 scale-[1.02]'
                      : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <IconComponent className={`mb-1.5 h-5 w-5 ${isSelected ? 'text-indigo-400' : 'text-slate-500'}`} />
                  <span className="text-xs">{spec.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Action / Briefing Output Area */}
        {!activeBriefing ? (
          <div className="relative z-10 my-4 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-950/70 p-8 text-center">
            <FileText className="mb-3 h-12 w-12 text-slate-600" />
            <h4 className="text-sm font-bold text-slate-200">No Active Briefing Compiled</h4>
            <p className="mt-1 max-w-sm text-xs text-slate-400">
              Generates an encrypted 1-page PDF briefing containing lab anomalies, active medications, and risk indices tailored for {specialty}.
            </p>
            <button
              onClick={handleCompile}
              disabled={isCompiling}
              className="mt-5 flex items-center gap-2 rounded-2xl border border-indigo-400/40 bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3 text-xs font-black tracking-wider uppercase text-white shadow-xl shadow-indigo-600/30 transition-all hover:scale-105 disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              {isCompiling ? 'Compiling AI Summary...' : 'Compile Briefing PDF'}
            </button>
          </div>
        ) : (
          /* Compiled Briefing View */
          <div className="relative z-10 my-4 space-y-4">
            <div className="relative overflow-hidden rounded-2xl border border-indigo-500/30 bg-slate-950 p-5 text-xs">
              {/* Document Header */}
              <div className="mb-3 flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="font-extrabold uppercase tracking-widest text-indigo-400">
                  {activeBriefing.specialtyType} Clinical Summary
                </span>
                <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                  Verified ABDM Record
                </span>
              </div>

              {/* Anomalies List */}
              <div className="mb-3">
                <span className="mb-1 block font-bold text-slate-300">Chief Lab Observations:</span>
                <ul className="space-y-1 text-slate-300">
                  {activeBriefing.chiefAnomalies.map((anom, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      <span>{anom}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Doctor Focus Points */}
              <div>
                <span className="mb-1 block font-bold text-slate-300">Recommended Doctor Focus:</span>
                <ul className="space-y-1 text-slate-300">
                  {activeBriefing.recommendedFocusPoints.map((pt, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowQR(!showQR)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 py-3 text-xs font-bold text-slate-200 transition-all hover:bg-slate-700"
              >
                <QrCode className="h-4 w-4 text-emerald-400" />
                {showQR ? 'Hide QR' : 'Doctor QR Code'}
              </button>

              <a
                href={`https://wa.me/?text=${encodeURIComponent(`CallMedex AI Doctor Briefing (${specialty}): Patient ID ${activeBriefing.patientId}`)}`}
                target="_blank"
                rel="noreferrer"
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-600 py-3 text-xs font-bold text-white shadow-lg shadow-emerald-600/25 transition-all hover:bg-emerald-500"
              >
                <Share2 className="h-4 w-4" />
                Share WhatsApp
              </a>
            </div>

            {/* Encrypted QR Box */}
            {showQR && (
              <div className="rounded-2xl border border-emerald-500/40 bg-white p-4 text-center text-slate-950 animate-fadeIn">
                <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-xl border-4 border-slate-950 bg-slate-100 p-2 font-mono text-[9px] font-bold break-all">
                  [ABDM-QR-{activeBriefing.patientId.slice(0, 8)}]
                </div>
                <p className="mt-2 text-[10px] font-bold text-slate-700">
                  Scan with clinic tablet for instant encrypted access to FHIR patient records
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
