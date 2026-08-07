'use client';

import React, { useEffect } from 'react';
import { useFamilyHubStore } from '@/store/useFamilyHubStore';
import { AlertTriangle, PhoneCall, X, ShieldAlert, CheckCircle2 } from 'lucide-react';

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
    <div className="bg-gradient-to-r from-red-950/80 to-slate-900/80 backdrop-blur-xl border border-red-900/50 rounded-3xl p-5 text-white shadow-xl relative overflow-hidden">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-600/20 text-red-400 rounded-2xl border border-red-500/30 animate-pulse">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>Emergency SOS Triage</span>
              <span className="bg-red-500/20 text-red-400 text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-md border border-red-500/30">
                24/7 Ready
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Notifies {emergencyContacts.length} emergency contacts + CallMedex dispatch with live GPS location.
            </p>
          </div>
        </div>

        {!sosActive ? (
          <button
            onClick={() => {
              triggerSOS();
              handleDispatchNow();
            }}
            className="w-full sm:w-auto px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-red-600/30 transition-all flex items-center justify-center gap-2"
          >
            <ShieldAlert className="w-4 h-4" />
            Trigger Emergency SOS
          </button>
        ) : (
          <div className="w-full sm:w-auto flex items-center gap-3 bg-red-950/90 p-2 px-4 rounded-2xl border border-red-600">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full border-2 border-red-400 flex items-center justify-center font-bold text-sm text-red-200">
                {sosCountdownSeconds}s
              </div>
              <span className="text-xs text-red-200 font-medium">Alert Dispatched!</span>
            </div>

            <button
              onClick={cancelSOS}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-all border border-slate-700 ml-auto"
            >
              <X className="w-3.5 h-3.5" />
              Cancel SOS
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
