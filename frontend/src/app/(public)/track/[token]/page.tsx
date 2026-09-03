"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Shield, Clock, MapPin, CheckCircle, AlertCircle, RefreshCw, PhoneCall } from "lucide-react";

interface TrackingData {
  success: boolean;
  status: string;
  provider?: {
    first_name: string;
    rating: number;
    completed_jobs: number;
    verified: boolean;
  };
  eta_minutes: number;
  distance_km: number;
  coarse_lat?: number | null;
  coarse_lng?: number | null;
  is_completed: boolean;
  message?: string;
}

export default function GuardianLiveTrackingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const resolvedParams = use(params);
  const token = resolvedParams.token;

  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchTracking = async () => {
    try {
      const res = await fetch(`/api/track/${token}`);
      if (!res.ok) {
        if (res.status === 410) {
          throw new Error("This tracking link has expired (active up to 30 minutes after visit completion).");
        }
        throw new Error("Tracking link is invalid or expired.");
      }
      const json = await res.json();
      setData(json);
      setError(null);
      setLastRefreshed(new Date());
    } catch (err: any) {
      setError(err.message || "Failed to load live tracking");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTracking();
    const interval = setInterval(fetchTracking, 15000); // 15s auto-poll
    return () => clearInterval(interval);
  }, [token]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "en_route":
      case "in_progress":
        return { label: "En Route to Doorstep", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" };
      case "arrived":
        return { label: "Provider Arrived", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" };
      case "completed":
        return { label: "Visit Completed", color: "bg-teal-500/20 text-teal-400 border-teal-500/30" };
      default:
        return { label: "Assigned & Scheduled", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" };
    }
  };

  return (
    <div className="min-h-screen bg-[#070D18] text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6">
      {/* Background glow */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(14,116,144,0.15),transparent_70%)] pointer-events-none" />

      <div className="w-full max-w-lg relative z-10">
        {/* Header Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 text-xs font-semibold uppercase tracking-wider mb-3">
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
            Guardian Link &bull; Live Health Dispatch
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Live Field Visit Tracking
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Real-time status shared by family member. Zero app install required.
          </p>
        </div>

        {loading ? (
          <div className="bg-[#111C2E]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-8 text-center">
            <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-300">Connecting to secure field telemetry...</p>
          </div>
        ) : error ? (
          <div className="bg-[#111C2E]/80 backdrop-blur-xl border border-red-500/30 rounded-2xl p-6 text-center">
            <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-white mb-1">Tracking Unavailable</h2>
            <p className="text-sm text-slate-300 mb-4">{error}</p>
            <Link
              href="/"
              className="inline-block px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors"
            >
              Go to CallMedex Home
            </Link>
          </div>
        ) : data ? (
          <div className="space-y-4">
            {/* Status & ETA Card */}
            <div className="bg-[#111C2E]/85 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
              <div className="flex items-center justify-between gap-2 mb-4">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusBadge(data.status).color}`}>
                  {getStatusBadge(data.status).label}
                </span>
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Auto-updates live
                </span>
              </div>

              {data.is_completed ? (
                <div className="py-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-white">Visit Completed Successfully</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Samples safely sealed in cold chain and en route to laboratory.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 py-3 border-y border-white/5 my-2">
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-400">Estimated Arrival</span>
                    <span className="text-2xl sm:text-3xl font-bold text-cyan-400 mt-0.5">
                      {data.eta_minutes > 0 ? `${data.eta_minutes} mins` : "Arrived"}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-400">Distance</span>
                    <span className="text-2xl sm:text-3xl font-bold text-white mt-0.5">
                      {data.distance_km > 0 ? `${data.distance_km} km` : "At Doorstep"}
                    </span>
                  </div>
                </div>
              )}

              {/* Provider Info */}
              {data.provider && (
                <div className="mt-4 pt-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 font-bold flex items-center justify-center text-sm">
                      {data.provider.first_name[0]}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white">
                        {data.provider.first_name} (Verified Specialist)
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        ⭐ {data.provider.rating} &bull; {data.provider.completed_jobs}+ home visits completed
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-[11px] text-slate-300 font-medium">
                    CallMedex Verified
                  </span>
                </div>
              )}
            </div>

            {/* Privacy Shield Note */}
            <div className="bg-slate-900/60 border border-white/5 rounded-xl p-4 text-xs text-slate-400 flex items-start gap-2.5">
              <Shield className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-200">DPDP Privacy Shield Active:</strong> Patient identity, residential street address, and lab test details are masked on this shared link. Only real-time field progress is shown.
              </div>
            </div>

            <div className="text-center text-[11px] text-slate-400">
              Refreshed: {lastRefreshed.toLocaleTimeString()} &bull; Powered by CallMedex Liquid Dispatch
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
