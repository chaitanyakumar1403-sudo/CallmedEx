'use client';

import React from 'react';
import { Compass, Navigation, Thermometer, ShieldCheck, Key, Radio } from 'lucide-react';

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
    <div className="relative overflow-hidden rounded-3xl border border-sky-500/40 bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-slate-950/95 p-6 text-white shadow-2xl backdrop-blur-xl">
      {/* Decorative Sky Blue Ambient Glow */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-sky-500/15 blur-3xl" />

      <div className="relative z-10 mb-5 flex flex-col gap-4 sm:flex-row sm:items-center justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-0.5 text-xs font-extrabold uppercase tracking-wider text-sky-400">
              <Radio className="h-3.5 w-3.5 animate-pulse" />
              Live Telemetry Stream
            </span>
          </div>
          <h2 className="text-xl font-extrabold tracking-tight text-slate-100 sm:text-2xl">
            Live Phlebotomist Arrival Tracking
          </h2>
        </div>

        <div className="flex items-center gap-2 rounded-2xl border border-sky-500/30 bg-sky-500/10 px-4 py-2 text-xs font-black text-sky-300 shadow-md">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sky-500" />
          </span>
          <span>ETA ~{etaMinutes} Mins</span>
        </div>
      </div>

      <div className="relative z-10 grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Tactical Radar Display Card */}
        <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/80 p-5 md:col-span-2 shadow-inner">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Assigned Provider</span>
              <h3 className="text-base font-extrabold text-white">{phleboName}</h3>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Transit Speed</span>
              <span className="block text-sm font-black text-sky-400">{speedKmh} km/h</span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/80 p-3.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-400">
                <Thermometer className="h-5 w-5" />
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-400">Cold Chain Storage</span>
                <span className="text-xs font-black text-emerald-400">{temperatureCelsius}°C (Optimal 2-8°C)</span>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/80 p-3.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-400">Security Profile</span>
                <span className="text-xs font-black text-emerald-400">NMC Biometric Verified</span>
              </div>
            </div>
          </div>
        </div>

        {/* OTP PIN Code Box */}
        <div className="relative flex flex-col items-center justify-center rounded-2xl border border-sky-500/40 bg-gradient-to-b from-sky-950/30 to-slate-950/90 p-5 text-center shadow-lg shadow-sky-500/10">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-2xl border border-sky-500/40 bg-sky-500/20 text-sky-300">
            <Key className="h-5 w-5" />
          </div>
          <span className="text-xs font-bold text-slate-400">Doorstep Verification OTP</span>
          <div className="my-2 rounded-2xl border border-sky-500/50 bg-slate-900 px-6 py-2.5 font-mono text-3xl font-black tracking-widest text-sky-300 shadow-inner">
            {otpPin}
          </div>
          <span className="text-[10px] font-medium text-slate-400">Share this code only upon agent arrival</span>
        </div>
      </div>
    </div>
  );
};
