'use client';

import React from 'react';
import { useFamilyHubStore } from '@/store/useFamilyHubStore';
import { Pill, AlertTriangle, Plus, RotateCcw, Clock } from 'lucide-react';

export const MedicineCabinetGrid: React.FC = () => {
  const { medications } = useFamilyHubStore();

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900/90 via-slate-900/95 to-slate-950/90 p-6 text-white shadow-xl backdrop-blur-xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-0.5 text-xs font-extrabold uppercase tracking-wider text-violet-400">
              <Pill className="h-3.5 w-3.5" />
              Smart Pill Cabinet
            </span>
          </div>
          <h2 className="text-xl font-extrabold tracking-tight text-slate-100 sm:text-2xl">
            Medication Inventory & Refill Radar
          </h2>
        </div>

        <button className="flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-800/80 px-4 py-2 text-xs font-bold text-slate-200 transition-all hover:border-slate-600 hover:bg-slate-700">
          <Plus className="h-4 w-4" />
          Add Medication
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {medications.map((med) => {
          const daysLeft = Math.max(0, Math.floor(med.remainingPills / med.pillsPerDay));
          const percentRemaining = Math.min(100, Math.round((med.remainingPills / med.totalPills) * 100));
          const isLow = daysLeft <= 5;

          return (
            <div
              key={med.id}
              className={`relative flex flex-col justify-between rounded-2xl border p-5 transition-all duration-300 ${
                isLow
                  ? 'border-amber-500/50 bg-gradient-to-b from-amber-950/20 to-slate-950/80 shadow-lg shadow-amber-500/5'
                  : 'border-slate-800 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-900/40'
              }`}
            >
              <div>
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-extrabold text-white">{med.medicineName}</h3>
                    <p className="mt-1 text-xs text-slate-400">{med.dosage}</p>
                  </div>
                  {isLow && (
                    <span className="flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-400">
                      <AlertTriangle className="h-3 w-3" /> Refill Soon
                    </span>
                  )}
                </div>
              </div>

              {/* Progress Ring & Inventory Counter */}
              <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-4">
                <div className="flex items-center gap-3">
                  {/* Small Circular Gauge SVG */}
                  <div className="relative flex h-10 w-10 items-center justify-center">
                    <svg className="h-full w-full transform -rotate-90" viewBox="0 0 36 36">
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="rgba(30, 41, 59, 0.8)"
                        strokeWidth="4"
                      />
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke={isLow ? '#F59E0B' : '#8B5CF6'}
                        strokeWidth="4"
                        strokeDasharray={`${percentRemaining}, 100`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="absolute text-[9px] font-extrabold text-white">{percentRemaining}%</span>
                  </div>

                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg font-black text-white">{med.remainingPills}</span>
                      <span className="text-xs text-slate-400">/ {med.totalPills} pills</span>
                    </div>
                    <span className={`text-[10px] font-bold ${isLow ? 'text-amber-400' : 'text-slate-400'}`}>
                      ~{daysLeft} days supply remaining
                    </span>
                  </div>
                </div>

                <button className="flex items-center gap-1.5 rounded-xl border border-violet-500/40 bg-violet-600/20 px-3.5 py-2 text-xs font-extrabold text-violet-300 transition-all hover:bg-violet-600 hover:text-white">
                  <RotateCcw className="h-3.5 w-3.5" />
                  Order
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
