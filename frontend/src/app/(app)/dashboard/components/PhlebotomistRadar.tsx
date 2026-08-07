'use client';

import React from 'react';
import { Navigation, Thermometer, ShieldCheck, Key, Compass } from 'lucide-react';

interface Props {
  phleboName?: string;
  etaMinutes?: number;
  temperatureCelsius?: number;
  otpPin?: string;
  speedKmh?: number;
}

export const PhlebotomistRadar: React.FC<Props> = ({
  phleboName = 'Ravi Kumar (Certified Phlebotomist)',
  etaMinutes = 8,
  temperatureCelsius = 4.2,
  otpPin = '4829',
  speedKmh = 24,
}) => {
  return (
    <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 text-sky-400 font-semibold text-sm uppercase tracking-wider mb-1">
            <Compass className="w-4 h-4 animate-spin-slow" />
            <span>Real-Time Telemetry Radar</span>
          </div>
          <h2 className="text-xl font-bold text-slate-100">Live Phlebotomist Arrival Tracking</h2>
        </div>

        <div className="flex items-center gap-2 bg-sky-500/10 px-3 py-1.5 rounded-2xl border border-sky-500/20 text-sky-300 text-xs font-semibold self-start sm:self-auto">
          <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
          <span>Arriving in ~{etaMinutes} Mins</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-2">
        {/* Tactical Radar Display Card */}
        <div className="md:col-span-2 bg-slate-950/70 rounded-2xl border border-slate-800 p-5 relative overflow-hidden flex flex-col justify-between min-h-[160px]">
          <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-sky-500/10 rounded-full blur-3xl" />

          <div className="flex items-center justify-between z-10">
            <div>
              <span className="text-xs text-slate-400 font-medium">Assigned Agent</span>
              <h3 className="text-base font-bold text-white mt-0.5">{phleboName}</h3>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 font-medium">Transit Speed</span>
              <span className="text-sm font-bold text-sky-400 block">{speedKmh} km/h</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 z-10 mt-4">
            <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800/80 flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20">
                <Thermometer className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Cold Chain Container</span>
                <span className="text-xs font-bold text-emerald-400">{temperatureCelsius}°C (Optimal 2-8°C)</span>
              </div>
            </div>

            <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800/80 flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Identity Status</span>
                <span className="text-xs font-bold text-emerald-400">NMC Biometric Verified</span>
              </div>
            </div>
          </div>
        </div>

        {/* OTP Verification Box */}
        <div className="bg-gradient-to-b from-sky-950/40 to-slate-950/70 rounded-2xl border border-sky-500/30 p-5 flex flex-col items-center justify-center text-center relative">
          <div className="p-2.5 bg-sky-500/20 text-sky-400 rounded-2xl mb-2 border border-sky-500/30">
            <Key className="w-5 h-5" />
          </div>
          <span className="text-xs text-slate-400 font-medium mb-1">Doorstep Verification OTP</span>
          <div className="text-3xl font-extrabold tracking-widest text-sky-300 bg-slate-900 px-5 py-2 rounded-2xl border border-sky-500/40 shadow-inner font-mono my-1">
            {otpPin}
          </div>
          <span className="text-[10px] text-slate-400 mt-1">Provide this PIN to phlebotomist upon arrival</span>
        </div>
      </div>
    </div>
  );
};
