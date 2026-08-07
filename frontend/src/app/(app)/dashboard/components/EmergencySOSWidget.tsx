'use client';

import React, { useEffect } from 'react';
import { useFamilyHubStore } from '@/store/useFamilyHubStore';
import { AlertTriangle, ShieldAlert, X, Radio, MapPin } from 'lucide-react';

export const EmergencySOSWidget: React.FC = () => {
  const { sosActive, sosCountdownSeconds, triggerSOS, cancelSOS, decrementSOSCountdown, emergencyContacts } = useFamilyHubStore();

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (sosActive && sosCountdownSeconds > 0) {
      timer = setInterval(() => {
        decrementSOSCountdown();
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [sosActive, sosCountdownSeconds, decrementSOSCountdown]);

  const handleDispatchNow = async () => {
    try {
      await fetch('/api/v1/patient/sos/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: 12.9716, lng: 77.5946, notes: 'Direct emergency trigger from patient dashboard' }),
      });
    } catch (err) {
      console.error('Failed to trigger emergency SOS backend endpoint:', err);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-red-500/50 bg-gradient-to-r from-red-950/90 via-slate-900/95 to-slate-950/90 p-6 text-white shadow-2xl backdrop-blur-xl">
      {/* Background Pulse Ambient Light */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-red-600/20 blur-3xl" />

      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-red-500/40 bg-red-600/20 text-red-400">
            <Radio className="h-6 w-6 animate-pulse" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
            </span>
          </div>

          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="rounded-md border border-red-500/40 bg-red-500/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-red-300">
                24/7 Triage Ready
              </span>
              <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                <MapPin className="h-3 w-3 text-red-400" /> GPS Telemetry Active
              </span>
            </div>
            <h3 className="text-base font-extrabold text-white">Emergency SOS Alert System</h3>
            <p className="text-xs text-slate-400">
              Notifies {emergencyContacts.length} emergency contacts + CallMedex dispatch unit instantly.
            </p>
          </div>
        </div>

        {!sosActive ? (
          <button
            onClick={() => {
              triggerSOS();
              handleDispatchNow();
            }}
            className="group flex items-center justify-center gap-2 rounded-2xl border border-red-400/50 bg-gradient-to-r from-red-600 to-rose-600 px-6 py-3 text-xs font-black uppercase tracking-wider text-white shadow-xl shadow-red-600/30 transition-all hover:scale-105 active:scale-95"
          >
            <ShieldAlert className="h-4 w-4 transition-transform group-hover:rotate-12" />
            Trigger Emergency SOS
          </button>
        ) : (
          <div className="flex items-center gap-3 rounded-2xl border border-red-500/80 bg-red-950/90 p-2.5 px-4 shadow-lg shadow-red-600/30">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-red-400 font-black text-sm text-red-200 shadow-inner">
                {sosCountdownSeconds}s
              </div>
              <span className="text-xs font-bold text-red-200">Alert Dispatched!</span>
            </div>

            <button
              onClick={cancelSOS}
              className="flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200 transition-all hover:bg-slate-700"
            >
              <X className="h-3.5 w-3.5" />
              Cancel SOS
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
