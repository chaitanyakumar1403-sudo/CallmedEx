'use client';

import React, { useState } from 'react';
import { useHealthMatrixStore } from '@/store/useHealthMatrixStore';
import { Activity, TrendingDown, ShieldCheck, Heart, Zap, AlertCircle, Compass, LineChart } from 'lucide-react';

export const BiomarkerMatrix: React.FC = () => {
  const { biomarkers, selectedCode, setSelectedCode, riskScore } = useHealthMatrixStore();
  const [viewMode, setViewMode] = useState<'compass' | 'chart'>('compass');

  const availableCodes = Array.from(new Set(biomarkers.map((b) => b.observationCode)));
  const filteredData = biomarkers.filter((b) => b.observationCode === selectedCode);
  const activeObservationName = filteredData[0]?.observationName || selectedCode;

  // Max value calculation for scaling chart bars
  const maxVal = Math.max(...filteredData.map((d) => d.valueNumber), 1);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-700/60 bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-slate-950/95 p-6 text-white shadow-2xl backdrop-blur-2xl transition-all duration-300">
      {/* Decorative Neon Background Glows */}
      <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 -bottom-20 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />

      {/* Top Header & Switcher */}
      <div className="relative z-10 mb-6 flex flex-col gap-4 sm:flex-row sm:items-center justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-0.5 text-xs font-extrabold uppercase tracking-wider text-emerald-400">
              <Activity className="h-3.5 w-3.5 animate-pulse" />
              Preventive AI Engine
            </span>
            <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-bold text-cyan-300">
              5-Yr Risk Projections
            </span>
          </div>
          <h2 className="text-xl font-extrabold tracking-tight text-slate-100 sm:text-2xl">
            Biomarker Matrix & Health Risk Compass
          </h2>
        </div>

        {/* View Mode Toggle Pill */}
        <div className="flex items-center gap-1 rounded-2xl border border-slate-700/70 bg-slate-950/80 p-1.5 shadow-inner">
          <button
            onClick={() => setViewMode('compass')}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all duration-200 ${
              viewMode === 'compass'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-lg shadow-emerald-500/25'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Compass className="h-3.5 w-3.5" />
            3D Risk Compass
          </button>
          <button
            onClick={() => setViewMode('chart')}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all duration-200 ${
              viewMode === 'chart'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 shadow-lg shadow-cyan-500/25'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LineChart className="h-3.5 w-3.5" />
            Time-Series Trend
          </button>
        </div>
      </div>

      {/* View Mode 1: 3D Health Risk Compass Ring */}
      {viewMode === 'compass' ? (
        <div className="relative z-10 grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Circular Risk Index Gauge */}
          <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/60 p-6 text-center shadow-inner">
            <div className="relative flex h-40 w-40 items-center justify-center">
              {/* Radial Progress Ring SVG */}
              <svg className="h-full w-full transform -rotate-90" viewBox="0 0 120 120">
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  stroke="rgba(30, 41, 59, 0.8)"
                  strokeWidth="10"
                  fill="transparent"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  stroke="url(#compassGlowGradient)"
                  strokeWidth="10"
                  strokeDasharray={314.15}
                  strokeDashoffset={314.15 * (1 - riskScore.overallScore / 100)}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-1000 ease-out"
                />
                <defs>
                  <linearGradient id="compassGlowGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#10B981" />
                    <stop offset="50%" stopColor="#06B6D4" />
                    <stop offset="100%" stopColor="#3B82F6" />
                  </linearGradient>
                </defs>
              </svg>

              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-4xl font-black tracking-tight text-white drop-shadow-md">
                  {riskScore.overallScore}
                </span>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400">
                  Health Index
                </span>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              Optimal 5-Year Profile
            </div>
          </div>

          {/* Subsystem Risk Cards */}
          <div className="flex flex-col justify-between space-y-4 md:col-span-2">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 transition-all hover:border-emerald-500/40">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Cardio Risk</span>
                  <Heart className="h-4 w-4 text-rose-400" />
                </div>
                <div className="text-2xl font-black text-emerald-400">{riskScore.cardiovascularRisk}%</div>
                <span className="mt-1 block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Low Risk Tier
                </span>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 transition-all hover:border-amber-500/40">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Metabolic</span>
                  <Zap className="h-4 w-4 text-amber-400" />
                </div>
                <div className="text-2xl font-black text-amber-400">{riskScore.metabolicRisk}%</div>
                <span className="mt-1 block text-[10px] font-bold text-amber-500/80 uppercase tracking-wider">
                  Mild Watch
                </span>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 transition-all hover:border-cyan-500/40">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Inflammation</span>
                  <Activity className="h-4 w-4 text-cyan-400" />
                </div>
                <div className="text-2xl font-black text-cyan-400">{riskScore.inflammationRisk}%</div>
                <span className="mt-1 block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Normal Range
                </span>
              </div>
            </div>

            {/* AI Summary Box */}
            <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/40 to-slate-950/80 p-4.5 text-xs">
              <div className="mb-1.5 flex items-center gap-2 font-bold text-emerald-300">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>AI Clinical Projection Summary</span>
              </div>
              <p className="leading-relaxed text-slate-300">{riskScore.summaryText}</p>
            </div>
          </div>
        </div>
      ) : (
        /* View Mode 2: Time-Series Biomarker Trend */
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {availableCodes.map((code) => (
              <button
                key={code}
                onClick={() => setSelectedCode(code)}
                className={`whitespace-nowrap rounded-xl border px-4 py-2 text-xs font-bold transition-all ${
                  selectedCode === code
                    ? 'border-cyan-500/60 bg-cyan-500/20 text-cyan-300 shadow-md shadow-cyan-500/10'
                    : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                {code}
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-white">{activeObservationName} Observation Trend</h4>
                <span className="text-xs text-slate-400">Historical lab values over last 6 months</span>
              </div>
              <div className="flex items-center gap-1 text-xs font-bold text-emerald-400">
                <TrendingDown className="h-4 w-4" />
                <span>Baseline Stable</span>
              </div>
            </div>

            {/* Visual Bar & Point Graphic */}
            <div className="grid grid-cols-3 gap-4">
              {filteredData.map((item, idx) => {
                const heightPercent = Math.min(100, Math.max(30, (item.valueNumber / maxVal) * 100));
                return (
                  <div key={idx} className="flex flex-col items-center rounded-xl border border-slate-800/80 bg-slate-900/60 p-4">
                    <span className="mb-2 text-[10px] font-semibold text-slate-400">{item.recordedAt}</span>
                    <div className="relative mb-2 flex h-24 w-full items-end justify-center rounded-lg bg-slate-950 p-2">
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className="w-8 rounded-t-lg bg-gradient-to-t from-cyan-600 to-emerald-400 transition-all duration-500 shadow-lg shadow-cyan-500/20"
                      />
                    </div>
                    <span className="text-base font-black text-white">
                      {item.valueNumber} <span className="text-[10px] font-medium text-slate-400">{item.unit}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
