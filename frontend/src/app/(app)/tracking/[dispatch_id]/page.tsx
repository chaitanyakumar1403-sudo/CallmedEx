"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import GeoapifyMap from "@/components/GeoapifyMap";
import StatusSpine, { dispatchSteps } from "@/app/components/StatusSpine";
import {
  Search,
  Send,
  CheckCircle2,
  Navigation,
  MapPin,
  FlaskConical,
  XCircle,
  AlertCircle,
  Phone,
  ShieldCheck,
  Clock,
  Radio,
  TestTube2,
  Home,
  HeartPulse,
  Truck,
  Pill,
} from "lucide-react";

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const getToken = () => (typeof window !== "undefined" ? localStorage.getItem("token") : null);

const STATUS_FLOW: Record<string, { label: string; icon: any; color: string }> = {
  searching: { label: "Searching nearby providers", icon: Search, color: "var(--cm-waiting)" },
  provider_notified: { label: "Providers notified", icon: Send, color: "var(--cm-waiting)" },
  provider_accepted: { label: "Provider assigned", icon: CheckCircle2, color: "var(--cm-active)" },
  en_route: { label: "Provider is on the way", icon: Navigation, color: "var(--cm-active)" },
  arrived: { label: "Provider has arrived", icon: MapPin, color: "var(--cm-done)" },
  in_progress: { label: "Service in progress", icon: FlaskConical, color: "var(--cm-active)" },
  samples_delivered_to_lab: { label: "Samples delivered to lab", icon: TestTube2, color: "var(--cm-navy)" },
  completed: { label: "Service completed", icon: CheckCircle2, color: "var(--cm-done)" },
  cancelled: { label: "Request cancelled", icon: XCircle, color: "var(--cm-urgent)" },
  no_provider: { label: "No provider available", icon: AlertCircle, color: "var(--cm-ink-3)" },
};

function getStatusInfo(status: string) {
  return STATUS_FLOW[status] || STATUS_FLOW.searching;
}

export default function LiveTrackingPage() {
  const params = useParams();
  const router = useRouter();
  const dispatchId = params?.dispatch_id as string;

  const [dispatch, setDispatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [eta, setEta] = useState<number | null>(null);
  const [providerPhone, setProviderPhone] = useState("");
  const [otpData, setOtpData] = useState<{ otp: string | null; message: string; verified: boolean } | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const otpPollRef = useRef<NodeJS.Timeout | null>(null);

  const fetchDispatch = useCallback(async () => {
    const token = getToken();
    if (!token) {
      router.push("/auth/login");
      return;
    }
    if (!dispatchId) return;

    try {
      const res = await fetch(`${apiBase}/api/dispatch/${dispatchId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (data.success || data.id) {
        const d = data.dispatch || data;
        setDispatch(d);

        if (d.estimated_distance_km) {
          const etaMins = Math.ceil((d.estimated_distance_km / 30) * 60);
          setEta(etaMins);
        }

        if (["completed", "cancelled"].includes(d.status)) {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } else {
        setError("Dispatch not found or access denied.");
      }
    } catch (e) {
      console.error("Tracking fetch error:", e);
      setError("Unable to load tracking data. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }, [dispatchId, router]);

  const fetchOtp = useCallback(async () => {
    const token = getToken();
    if (!token || !dispatchId) return;

    try {
      const res = await fetch(`${apiBase}/api/dispatch/${dispatchId}/patient-otp`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setOtpData({ otp: data.otp, message: data.message, verified: data.verified });
        if (data.verified && otpPollRef.current) {
          clearInterval(otpPollRef.current);
        }
      }
    } catch (e) {
      console.error("OTP fetch error:", e);
    }
  }, [dispatchId]);

  useEffect(() => {
    fetchDispatch();
    pollRef.current = setInterval(fetchDispatch, 10000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchDispatch]);

  useEffect(() => {
    if (dispatch?.status === "arrived" || dispatch?.status === "in_progress") {
      fetchOtp();
      otpPollRef.current = setInterval(fetchOtp, 5000);
    }
    return () => {
      if (otpPollRef.current) clearInterval(otpPollRef.current);
    };
  }, [dispatch?.status, fetchOtp]);

  const handleCallProvider = async () => {
    const token = getToken();
    try {
      const res = await fetch(`${apiBase}/api/dispatch/${dispatchId}/masked-call`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.proxy_number) {
        setProviderPhone(data.proxy_number);
        window.location.href = `tel:${data.proxy_number}`;
      }
    } catch (e) {
      console.error("Masked call error:", e);
    }
  };

  const handleCancelDispatch = async () => {
    if (!confirm("Are you sure you want to cancel this request?")) return;
    const token = getToken();
    try {
      const res = await fetch(`${apiBase}/api/dispatch/${dispatchId}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) fetchDispatch();
    } catch (e) {
      console.error("Cancel error:", e);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "var(--cm-surface)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--cm-surface-2)", color: "var(--cm-navy)", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
            <Radio size={28} />
          </div>
          <h2 style={{ color: "var(--cm-ink)", fontSize: "var(--cm-text-base)", fontWeight: 800 }}>Connecting to Live Dispatch Server...</h2>
          <p style={{ color: "var(--cm-ink-3)", fontSize: "var(--cm-text-xs)" }}>Please wait while we fetch your real-time telemetry.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "var(--cm-surface)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ textAlign: "center", maxWidth: 420 }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--cm-urgent-surface)", color: "var(--cm-urgent)", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
            <AlertCircle size={28} />
          </div>
          <h2 style={{ color: "var(--cm-ink)", fontSize: "var(--cm-text-lg)", fontWeight: 800 }}>Tracking Unavailable</h2>
          <p style={{ color: "var(--cm-ink-3)", fontSize: "var(--cm-text-sm)", marginBottom: 20, lineHeight: 1.5 }}>{error}</p>
          <button
            onClick={() => router.push("/dashboard/patient")}
            className="cm-btn cm-btn--primary"
          >
            Go to My Bookings
          </button>
        </div>
      </div>
    );
  }

  const statusInfo = getStatusInfo(dispatch?.status || "searching");
  const StatusIcon = statusInfo.icon;
  const isCancelled = dispatch?.status === "cancelled";
  const isCompleted = dispatch?.status === "completed";
  const canCancel = ["searching", "provider_notified", "provider_accepted", "en_route"].includes(dispatch?.status || "");

  const getServiceLabel = (type: string) => {
    switch (type) {
      case "home_collection": return "Home Sample Collection";
      case "home_visit": return "Doctor Home Visit";
      case "nursing": return "Nursing Service";
      case "ambulance": return "Emergency Ambulance";
      case "pharmacy_delivery": return "Pharmacy Delivery";
      default: return type || "Healthcare Service";
    }
  };

  const getServiceIcon = (type: string) => {
    switch (type) {
      case "home_collection": return TestTube2;
      case "home_visit": return Home;
      case "nursing": return HeartPulse;
      case "ambulance": return Truck;
      case "pharmacy_delivery": return Pill;
      default: return MapPin;
    }
  };

  const ServiceIcon = getServiceIcon(dispatch?.service_type);

  return (
    <div style={{ backgroundColor: "var(--cm-surface-2)", minHeight: "100vh", paddingBottom: 60 }}>
      {/* ─── Clinical Header ─── */}
      <div
        style={{
          background: "var(--cm-surface)",
          borderBottom: "1px solid var(--cm-line)",
          padding: "24px 20px",
          textAlign: "center",
        }}
      >
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--cm-surface-2)", color: statusInfo.color, display: "grid", placeItems: "center", margin: "0 auto 12px", border: "1px solid var(--cm-line)" }}>
          <StatusIcon size={26} />
        </div>
        <h1 style={{ margin: 0, fontSize: "var(--cm-text-xl)", fontWeight: 800, color: "var(--cm-ink)" }}>
          {statusInfo.label}
        </h1>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, margin: "6px 0 0", color: "var(--cm-ink-3)", fontSize: "var(--cm-text-xs)", fontWeight: 700 }}>
          <ServiceIcon size={14} style={{ color: "var(--cm-navy)" }} />
          {getServiceLabel(dispatch?.service_type)}
        </div>
        {eta && !isCompleted && !isCancelled && (
          <div style={{ marginTop: 12 }}>
            <span className="cm-pill cm-pill--active" style={{ fontSize: "var(--cm-text-xs)", padding: "6px 14px" }}>
              <Clock size={13} /> Estimated Arrival: ~{eta} mins
            </span>
          </div>
        )}
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px 16px" }}>
        {/* ─── OTP Display ─── */}
        {otpData && (
          <div
            className="cm-card"
            style={{
              backgroundColor: otpData.verified ? "var(--cm-done-surface)" : "var(--cm-waiting-surface)",
              border: `1px solid ${otpData.verified ? "var(--cm-done-line)" : "var(--cm-waiting-line)"}`,
              borderRadius: "var(--cm-radius)",
              padding: "24px",
              marginBottom: 16,
              textAlign: "center",
            }}
          >
            <h3 style={{ margin: "0 0 12px", color: otpData.verified ? "var(--cm-done)" : "var(--cm-waiting)", fontSize: "var(--cm-text-base)", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              {otpData.verified ? <ShieldCheck size={18} /> : <ShieldCheck size={18} />}
              {otpData.verified ? "Security Verification Complete" : "Provider Handshake OTP"}
            </h3>
            {otpData.otp && !otpData.verified && (
              <div
                style={{
                  fontSize: "2.4rem",
                  fontWeight: 900,
                  letterSpacing: "8px",
                  color: "var(--cm-ink)",
                  backgroundColor: "var(--cm-surface)",
                  padding: "12px 24px",
                  borderRadius: "var(--cm-radius)",
                  display: "inline-block",
                  border: "1px dashed var(--cm-line-strong)",
                  marginBottom: 16,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {otpData.otp}
              </div>
            )}
            <p style={{ margin: 0, color: otpData.verified ? "var(--cm-done)" : "var(--cm-waiting)", fontSize: "var(--cm-text-xs)", fontWeight: 600 }}>
              {otpData.message}
            </p>
          </div>
        )}

        {/* ─── Progress Timeline ─── */}
        {!isCancelled && (
          <div className="cm-card" style={{ padding: "var(--cm-5)", marginBottom: 16, border: "1px solid var(--cm-line)" }}>
            <h3 style={{ margin: "0 0 var(--cm-4) 0", color: "var(--cm-ink)", fontSize: "var(--cm-text-sm)", fontWeight: 800 }}>
              Live Telemetry Timeline
            </h3>
            <StatusSpine
              steps={dispatchSteps(
                dispatch?.status || "searching",
                Object.fromEntries(
                  [
                    dispatch?.provider_name && ["provider_accepted", `${dispatch.provider_name} accepted`],
                    dispatch?.estimated_eta_minutes && ["en_route", `Arriving in about ${dispatch.estimated_eta_minutes} min`],
                  ].filter(Boolean) as [string, string][]
                )
              )}
              urgent={dispatch?.priority === "urgent"}
            />
          </div>
        )}

        {/* ─── Provider Info ─── */}
        {dispatch?.provider_name && (
          <div className="cm-card" style={{ padding: "var(--cm-4) var(--cm-5)", marginBottom: 16, border: "1px solid var(--cm-line)" }}>
            <h3 style={{ margin: "0 0 12px 0", color: "var(--cm-ink-3)", fontSize: "var(--cm-text-xs)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Assigned Healthcare Specialist
            </h3>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    backgroundColor: "var(--cm-surface-2)",
                    color: "var(--cm-navy)",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 800,
                    fontSize: "var(--cm-text-base)",
                    border: "1px solid var(--cm-line)",
                  }}
                >
                  {dispatch.provider_name[0] || "P"}
                </div>
                <div>
                  <div style={{ fontWeight: 800, color: "var(--cm-ink)", fontSize: "var(--cm-text-base)" }}>
                    {dispatch.provider_name}
                  </div>
                  <div style={{ color: "var(--cm-ink-3)", fontSize: "var(--cm-text-xs)", marginTop: 2 }}>
                    {dispatch.service_type === "home_collection" ? "Certified Phlebotomist" : "CallMedex Medical Provider"}
                  </div>
                  {dispatch.estimated_distance_km && (
                    <div style={{ color: "var(--cm-active)", fontSize: "var(--cm-text-xs)", marginTop: 2, fontWeight: 700 }}>
                      {dispatch.estimated_distance_km.toFixed(1)} km away
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={handleCallProvider}
                className="cm-btn cm-btn--primary cm-btn--sm"
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <Phone size={14} /> Call Specialist
              </button>
            </div>
            {providerPhone && (
              <div style={{ marginTop: 10, padding: "8px 12px", backgroundColor: "var(--cm-done-surface)", border: "1px solid var(--cm-done-line)", borderRadius: "var(--cm-radius-sm)", fontSize: "var(--cm-text-xs)", color: "var(--cm-done)" }}>
                Calling via masked gateway: <strong>{providerPhone}</strong> (identity protected)
              </div>
            )}
          </div>
        )}

        {/* ─── Interactive Map ─── */}
        <div className="cm-card" style={{ padding: 0, overflow: "hidden", marginBottom: 16, border: "1px solid var(--cm-line)" }}>
          {dispatch?.patient_lat && dispatch?.patient_lng ? (
            <div>
              <GeoapifyMap
                center={{ lat: dispatch.patient_lat, lng: dispatch.patient_lng }}
                markers={[
                  {
                    lat: dispatch.patient_lat,
                    lng: dispatch.patient_lng,
                    label: "Your Location",
                    icon: "📍",
                  },
                  ...(dispatch.provider_lat && dispatch.provider_lng
                    ? [
                        {
                          lat: dispatch.provider_lat,
                          lng: dispatch.provider_lng,
                          label: dispatch.provider_name || "Provider",
                          icon: "🩺",
                          pulse: true,
                        },
                      ]
                    : []),
                ]}
                routePoints={
                  dispatch.provider_lat && dispatch.provider_lng
                    ? [
                        { lat: dispatch.provider_lat, lng: dispatch.provider_lng },
                        { lat: dispatch.patient_lat, lng: dispatch.patient_lng },
                      ]
                    : undefined
                }
                showRoute={!!(dispatch.provider_lat && dispatch.provider_lng)}
                height={260}
                zoom={14}
                style={{ borderRadius: 0 }}
              />
              <div style={{ padding: "12px 16px", borderTop: "1px solid var(--cm-line)", background: "var(--cm-surface)" }}>
                <div style={{ fontWeight: 700, color: "var(--cm-ink)", fontSize: "var(--cm-text-xs)", display: "flex", alignItems: "center", gap: 6 }}>
                  <MapPin size={14} style={{ color: "var(--cm-active)" }} /> Delivery Address
                </div>
                <div style={{ color: "var(--cm-ink-3)", fontSize: "var(--cm-text-xs)", marginTop: 2 }}>
                  {dispatch.patient_address || `${dispatch.patient_lat.toFixed(4)}, ${dispatch.patient_lng.toFixed(4)}`}
                </div>
                {dispatch.provider_lat && dispatch.provider_lng && (
                  <div style={{ color: "var(--cm-active)", fontSize: "var(--cm-text-xs)", marginTop: 4, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                    <Navigation size={13} /> Provider is en route · Live GPS tracking active
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ padding: 32, textAlign: "center", color: "var(--cm-ink-3)" }}>
              <MapPin size={32} style={{ margin: "0 auto 8px", color: "var(--cm-line-strong)" }} />
              <p style={{ fontSize: "var(--cm-text-xs)", margin: 0 }}>Map coordinates will activate once specialist confirms location.</p>
            </div>
          )}
        </div>

        {/* ─── Dispatch Details ─── */}
        <div className="cm-card" style={{ padding: "var(--cm-4) var(--cm-5)", marginBottom: 16, border: "1px solid var(--cm-line)" }}>
          <h3 style={{ margin: "0 0 12px 0", color: "var(--cm-ink-3)", fontSize: "var(--cm-text-xs)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Operational Request Details
          </h3>
          {[
            { label: "Dispatch ID", value: dispatch?.id?.slice(0, 8).toUpperCase() || "—" },
            { label: "Service", value: getServiceLabel(dispatch?.service_type) },
            { label: "Current Status", value: statusInfo.label },
            { label: "Requested At", value: dispatch?.created_at ? new Date(dispatch.created_at).toLocaleString("en-IN") : "—" },
          ].map(({ label, value }) => (
            <div
              key={label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 0",
                borderBottom: "1px solid var(--cm-line)",
                fontSize: "var(--cm-text-xs)",
              }}
            >
              <span style={{ color: "var(--cm-ink-3)" }}>{label}</span>
              <span style={{ fontWeight: 700, color: "var(--cm-ink)" }}>{value}</span>
            </div>
          ))}
        </div>

        {/* ─── Action Buttons ─── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {canCancel && (
            <button
              onClick={handleCancelDispatch}
              className="cm-btn cm-btn--secondary"
              style={{ color: "var(--cm-urgent)", borderColor: "var(--cm-urgent-line)", background: "var(--cm-surface)" }}
            >
              Cancel Request
            </button>
          )}

          {(isCompleted || isCancelled) && (
            <button
              onClick={() => router.push("/dashboard/patient")}
              className="cm-btn cm-btn--primary"
            >
              View My Bookings
            </button>
          )}

          {isCompleted && (
            <button
              onClick={() => router.push("/booking")}
              className="cm-btn cm-btn--secondary"
            >
              Book Again
            </button>
          )}
        </div>

        {/* ─── Live refresh indicator ─── */}
        {!isCompleted && !isCancelled && (
          <div style={{ textAlign: "center", marginTop: 20, color: "var(--cm-ink-3)", fontSize: "var(--cm-text-xs)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: "var(--cm-done)",
                display: "inline-block",
              }}
            />
            Live Telemetry · Auto-refreshing every 10 seconds
          </div>
        )}
      </div>
    </div>
  );
}
