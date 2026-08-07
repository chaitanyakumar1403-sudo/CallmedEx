'use client';

import React, { useState } from 'react';
import { useHealthMatrixStore } from '@/store/useHealthMatrixStore';
import { Activity, TrendingDown, ShieldCheck, ChevronRight, BarChart2 } from 'lucide-react';

export const BiomarkerMatrix: React.FC = () => {
  const { biomarkers, selectedCode, setSelectedCode, riskScore } = useHealthMatrixStore();
  const [viewMode, setViewMode] = useState<'chart' | 'compass'>('compass');

  const availableCodes = Array.from(new Set(biomarkers.map((b) => b.observationCode)));
  const filteredData = biomarkers.filter((b) => b.observationCode === selectedCode);
  const activeObservationName = filteredData[0]?.observationName || selectedCode;

  return (
    <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 text-white shadow-2xl transition-all duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm tracking-wider uppercase mb-1">
            <Activity className="w-4 h-4 animate-pulse" />
            <span>Preventive Health Engine</span>
          </div>
          <h2 className="text-xl font-bold text-slate-100">Biomarker Risk Matrix & Projections</h2>
        </div>

        <div className="flex items-center gap-2 bg-slate-800/80 p-1 rounded-2xl border border-slate-700/50 self-start sm:self-auto">
          <button
            onClick={() => setViewMode('compass')}
            className={`px-4 py-1.5 rounded-xl text-xs font-medium transition-all ${
              viewMode === 'compass' ? 'bg-emerald-500 text-slate-950 font-bold shadow-lg shadow-emerald-500/20' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            3D Risk Compass
          </button>
          <button
            onClick={() => setViewMode('chart')}
            className={`px-4 py-1.5 rounded-xl text-xs font-medium transition-all ${
              viewMode === 'chart' ? 'bg-emerald-500 text-slate-950 font-bold shadow-lg shadow-emerald-500/20' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Time-Series Trend
          </button>
        </div>
      </div>

      {/* 3D Risk Compass Ring View */}
      {viewMode === 'compass' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-4">
          <div className="md:col-span-1 flex flex-col items-center justify-center p-6 bg-slate-950/60 rounded-2xl border border-slate-800/80 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/10 to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />
            
            {/* Compass Ring */}
            <div className="relative w-36 h-36 rounded-full border-4 border-slate-800 flex items-center justify-center shadow-inner">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="6" className="text-slate-800" fill="transparent" />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="6"
                  strokeDasharray={251.2}
                  strokeDashoffset={251.2 * (1 - riskScore.overallScore / 100)}
                  className="text-emerald-400 transition-all duration-1000 ease-out"
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>
              <div className="absolute flex flex-col items-center text-center">
                <span className="text-3xl font-extrabold text-white tracking-tight">{riskScore.overallScore}</span>
                <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">Health Index</span>
              </div>
            </div>

            <div className="mt-4 text-center">
              <div className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                <ShieldCheck className="w-3.5 h-3.5" /> Optimal Trajectory
              </div>
            </div>
          </div>

          <div className="md:col-span-2 flex flex-col justify-between space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-3.5">
                <span className="text-xs text-slate-400 block mb-1">Cardio Risk</span>
                <span className="text-lg font-bold text-emerald-400">{riskScore.cardiovascularRisk}%</span>
                <span className="text-[10px] text-slate-500 block">5-yr Low</span>
              </div>

              <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-3.5">
                <span className="text-xs text-slate-400 block mb-1">Metabolic Risk</span>
                <span className="text-lg font-bold text-amber-400">{riskScore.metabolicRisk}%</span>
                <span className="text-[10px] text-slate-500 block">Mild Watch</span>
              </div>

              <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-3.5">
                <span className="text-xs text-slate-400 block mb-1">Inflammation</span>
                <span className="text-lg font-bold text-emerald-400">{riskScore.inflammationRisk}%</span>
                <span className="text-[10px] text-slate-500 block">Normal</span>
              </div>
            </div>

            <div className="p-4 bg-slate-950/40 border border-slate-800/80 rounded-2xl text-xs text-slate-300">
              <p className="leading-relaxed"><strong className="text-emerald-400 font-semibold">AI Projection:</strong> {riskScore.summaryText}</p>
            </div>
          </div>
        </div>
      ) : (
        /* Time Series Trend View */
        <div className="space-y-4 my-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {availableCodes.map((code) => (
              <button
                key={code}
                onClick={() => setSelectedCode(code)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-medium border transition-all whitespace-nowrap ${
                  selectedCode === code
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                    : 'bg-slate-950/40 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                {code}
              </button>
            ))}
          </div>

          <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs text-slate-400 font-medium">{activeObservationName} Recent Readings</span>
              <span className="text-xs text-emerald-400 flex items-center gap-1 font-semibold">
                <TrendingDown className="w-3.5 h-3.5" /> Stable Baseline
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              {filteredData.map((item, idx) => (
                <div key={idx} className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block mb-1">{item.recordedAt}</span>
                  <span className="text-base font-bold text-white">{item.valueNumber}</span>
                  <span className="text-[10px] text-slate-400 ml-1">{item.unit}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
