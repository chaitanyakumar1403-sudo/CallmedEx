'use client';

import React from 'react';
import { useFamilyHubStore } from '@/store/useFamilyHubStore';
import { Pill, Clock, AlertTriangle, Plus, RotateCw } from 'lucide-react';

export const MedicineCabinetGrid: React.FC = () => {
  const { medications } = useFamilyHubStore();

  return (
    <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 text-white shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-violet-400 font-semibold text-sm uppercase tracking-wider mb-1">
            <Pill className="w-4 h-4" />
            <span>Smart Pill Cabinet</span>
          </div>
          <h2 className="text-xl font-bold text-slate-100">Medicine Inventory & Refill Radar</h2>
        </div>

        <button className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition-all">
          <Plus className="w-4 h-4" />
          Add Prescription
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {medications.map((med) => {
          const daysLeft = Math.floor(med.remainingPills / med.pillsPerDay);
          const percentRemaining = Math.round((med.remainingPills / med.totalPills) * 100);
          const isLow = daysLeft <= 5;

          return (
            <div
              key={med.id}
              className={`p-4 rounded-2xl border transition-all duration-300 relative overflow-hidden flex flex-col justify-between ${
                isLow
                  ? 'bg-amber-950/20 border-amber-500/40 shadow-lg shadow-amber-500/5'
                  : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-bold text-slate-100 text-sm">{med.medicineName}</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">{med.dosage}</p>
                  </div>
                  {isLow && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/30">
                      <AlertTriangle className="w-3 h-3" /> Refill Soon
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-extrabold text-white">{med.remainingPills}</span>
                    <span className="text-xs text-slate-400">/ {med.totalPills} pills</span>
                  </div>
                  <span className={`text-[10px] font-semibold block mt-0.5 ${isLow ? 'text-amber-400' : 'text-slate-400'}`}>
                    ~{daysLeft} days remaining
                  </span>
                </div>

                <button className="p-2 bg-violet-600/20 hover:bg-violet-600/40 text-violet-300 rounded-xl border border-violet-500/30 transition-all flex items-center gap-1 text-xs font-semibold">
                  <RotateCw className="w-3.5 h-3.5" />
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
