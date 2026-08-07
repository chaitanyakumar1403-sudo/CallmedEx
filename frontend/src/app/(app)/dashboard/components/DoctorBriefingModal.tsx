'use client';

import React, { useState } from 'react';
import { useHealthMatrixStore } from '@/store/useHealthMatrixStore';
import { FileText, Share2, QrCode, X, CheckCircle, Sparkles, Download } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 text-white shadow-2xl relative overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <h3 className="text-lg font-bold text-slate-100">AI Doctor Briefing Compiler</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 rounded-full transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Specialty Selection */}
        <div className="my-5">
          <label className="text-xs text-slate-400 font-medium block mb-2">Target Consultation Specialty</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {['Cardiology', 'Endocrinology', 'Gastroenterology', 'General Practice'].map((spec) => (
              <button
                key={spec}
                onClick={() => setSpecialty(spec)}
                className={`py-2 px-3 rounded-xl text-xs font-medium border transition-all ${
                  specialty === spec
                    ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/60 font-semibold'
                    : 'bg-slate-950/40 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                {spec}
              </button>
            ))}
          </div>
        </div>

        {/* Action Button */}
        {!activeBriefing ? (
          <div className="text-center py-8 bg-slate-950/40 rounded-2xl border border-slate-800/80 my-4">
            <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
              Synthesizes ABHA clinical records, lab anomalies, and current medications into a concise 1-page clinical summary tailored for {specialty}.
            </p>
            <button
              onClick={handleCompile}
              disabled={isCompiling}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-6 py-2.5 rounded-xl shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
            >
              {isCompiling ? 'Compiling AI Briefing...' : 'Compile Briefing PDF'}
            </button>
          </div>
        ) : (
          /* Active Briefing Display */
          <div className="space-y-4 my-4">
            <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800 text-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-indigo-400 uppercase tracking-wider">{activeBriefing.specialtyType} Clinical Summary</span>
                <span className="text-[10px] text-slate-500">{new Date(activeBriefing.compiledAt).toLocaleTimeString()}</span>
              </div>

              <div>
                <span className="text-slate-400 font-semibold block mb-1">Chief Observations:</span>
                <ul className="list-disc list-inside text-slate-300 space-y-1">
                  {activeBriefing.chiefAnomalies.map((anom, idx) => (
                    <li key={idx}>{anom}</li>
                  ))}
                </ul>
              </div>

              <div>
                <span className="text-slate-400 font-semibold block mb-1">Recommended Doctor Focus:</span>
                <ul className="list-disc list-inside text-slate-300 space-y-1">
                  {activeBriefing.recommendedFocusPoints.map((pt, idx) => (
                    <li key={idx}>{pt}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Sharing Options */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                onClick={() => setShowQR(!showQR)}
                className="flex-1 py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all border border-slate-700"
              >
                <QrCode className="w-4 h-4 text-emerald-400" />
                {showQR ? 'Hide QR' : 'Doctor QR Code'}
              </button>

              <a
                href={`https://wa.me/?text=${encodeURIComponent(`CallMedex AI Doctor Briefing for ${specialty}: Stable baseline metrics. Verified ABDM Record ID: ${activeBriefing.patientId}`)}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20"
              >
                <Share2 className="w-4 h-4" />
                Share WhatsApp
              </a>
            </div>

            {/* QR Code Overlay Simulation */}
            {showQR && (
              <div className="p-4 bg-white text-slate-950 rounded-2xl text-center space-y-2">
                <div className="w-28 h-28 mx-auto border-4 border-slate-950 p-2 flex items-center justify-center bg-slate-100 font-mono text-[9px] font-bold break-all">
                  [ABDM-QR-{activeBriefing.patientId.slice(0, 8)}]
                </div>
                <p className="text-[10px] text-slate-600 font-medium">Scan with doctor clinic tablet for instant encrypted access</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
