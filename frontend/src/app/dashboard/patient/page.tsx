"use client";
import { useEffect, useState } from "react";
import DashboardProfile from "../components/DashboardProfile";
import { bookingsAPI, dispatchAPI } from "@/lib/api";

interface UserData {
  full_name: string;
  role: string;
}

export default function PatientDashboard() {
  const [user, setUser] = useState<UserData | null>(null);
  const [lang, setLang] = useState<'en' | 'te' | 'hi'>('en');
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAbhaModal, setShowAbhaModal] = useState(false);
  const [abhaTab, setAbhaTab] = useState<'link' | 'create'>('link');
  const [abhaInput, setAbhaInput] = useState('');
  const [aadhaarInput, setAadhaarInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [abhaStep, setAbhaStep] = useState(1); // 1 = enter aadhaar, 2 = enter otp
  const [abhaLinkedNumber, setAbhaLinkedNumber] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);

  // Live Tracking State
  const [activeDispatchId, setActiveDispatchId] = useState<string | null>(null);
  const [trackingData, setTrackingData] = useState<any>(null);
  const [requestingDispatch, setRequestingDispatch] = useState<string | null>(null);
  const [patientOtp, setPatientOtp] = useState<string | null>(null);

  // Dispatch Modal State
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [dispatchProviderType, setDispatchProviderType] = useState("");
  const [dispatchServiceType, setDispatchServiceType] = useState("");
  const [dispatchSpecificReason, setDispatchSpecificReason] = useState<string[]>([]);
  const [dispatchOtherText, setDispatchOtherText] = useState("");
  const [dispatchLabel, setDispatchLabel] = useState("");

  const dispatchOptions: Record<string, string[]> = {
    phlebotomist: ["Blood Sample Collection", "Urine Sample Collection", "ECG", "Routine Health Checkup", "Other"],
    nurse: ["Injection", "Wound Dressing", "IV Fluid Administration", "Catheterization", "Other"],
    doctor: ["General Checkup", "High Fever", "Minor Injury", "Post-Op Consultation", "Other"],
    pharmacy_delivery: ["Prescription Medicines", "OTC Medicines", "First Aid Supplies", "Other"]
  };

  const dict = {
    en: {
      welcome: "Welcome",
      greeting: "Here's your health overview for today",
      bookTest: "Book a Service",
      upcoming: "Upcoming Appointments",
      completed: "Completed Services",
      prescriptions: "Active Prescriptions",
      records: "Health Records",
      quick: "Quick Actions",
      bookLab: "Book Lab Test",
      video: "Video Consultation",
      medicine: "Order Medicine",
      pmjay: "AB-PMJAY Cashless"
    },
    te: {
      welcome: "స్వాగతం",
      greeting: "ఈ రోజు మీ ఆరోగ్య స్థూలదృష్టి ఇక్కడ ఉంది",
      bookTest: "సేవను బుక్ చేయండి",
      upcoming: "రాబోయే నియామకాలు",
      completed: "పూర్తయిన సేవలు",
      prescriptions: "క్రియాశీల ప్రిస్క్రిప్షన్లు",
      records: "ఆరోగ్య రికార్డులు",
      quick: "త్వరిత చర్యలు",
      bookLab: "ల్యాబ్ టెస్ట్ బుక్ చేయండి",
      video: "వీడియో కన్సల్టేషన్",
      medicine: "మందులను ఆర్డర్ చేయండి",
      pmjay: "ఆయుష్మాన్ భారత్ ఉచిత బుకింగ్"
    },
    hi: {
      welcome: "स्वागत है",
      greeting: "यहाँ आज के लिए आपका स्वास्थ्य अवलोकन है",
      bookTest: "सेवा बुक करें",
      upcoming: "आगामी अपॉइंटमेंट",
      completed: "पूर्ण की गई सेवाएँ",
      prescriptions: "सक्रिय नुस्खे",
      records: "स्वास्थ्य रिकॉर्ड",
      quick: "त्वरित कार्य",
      bookLab: "लैब टेस्ट बुक करें",
      video: "वीडियो परामर्श",
      medicine: "दवा ऑर्डर करें",
      pmjay: "आयुष्मान भारत मुफ्त बुकिंग"
    }
  };
  const t = dict[lang];

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      setUser(JSON.parse(stored));
    }
    
    // Fetch bookings
    const fetchBookings = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/bookings/my`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          setBookings(data.data.bookings || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    const fetchMe = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/auth/me`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          setProfile(data.data);
          if (data.data?.abha_number) {
            setAbhaLinkedNumber(data.data.abha_number);
          }
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchBookings();
    fetchMe();
  }, []);

  // Poll for live tracking if active dispatch exists
  useEffect(() => {
    // If we just loaded, try fetching from localStorage first
    if (!activeDispatchId) {
      const stored = localStorage.getItem("activeDispatchId");
      if (stored) {
        setActiveDispatchId(stored);
      }
      return;
    }
    
    const fetchTracking = async () => {
      const token = localStorage.getItem("token");
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/dispatch/track/${activeDispatchId}`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await res.json();
        setTrackingData(data);
        
        // If arrived, fetch OTP so patient can tell the provider
        if (data.status === "arrived") {
          const otpRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/dispatch/${activeDispatchId}/patient-otp`, {
            headers: { "Authorization": `Bearer ${token}` }
          });
          const otpData = await otpRes.json();
          if (otpData.success && otpData.otp) {
            setPatientOtp(otpData.otp);
          }
        } else {
          setPatientOtp(null);
        }

        // Clear tracking if the dispatch is completed, cancelled, or missing
        if (data.status === "completed" || data.status === "cancelled" || data.status === "no_provider" || data.status === "not_found") {
          const timeoutMs = data.status === "not_found" ? 0 : 10000;
          setTimeout(() => {
            setActiveDispatchId(null);
            setTrackingData(null);
            localStorage.removeItem("activeDispatchId");
          }, timeoutMs); // Leave it on screen for 10 seconds before clearing (unless not found)
        }
      } catch (e) {
        console.error("Tracking error", e);
      }
    };

    fetchTracking();
    const interval = setInterval(fetchTracking, 5000); // Poll every 5s for better Uber-like responsiveness
    return () => clearInterval(interval);
  }, [activeDispatchId]);

  const openDispatchModal = (providerType: string, serviceType: string, label: string) => {
    setDispatchProviderType(providerType);
    setDispatchServiceType(serviceType);
    setDispatchLabel(label);
    setDispatchSpecificReason([]);
    setShowDispatchModal(true);
  };

  const confirmDispatchRequest = () => {
    setShowDispatchModal(false);
    setRequestingDispatch(dispatchProviderType);

    const executeDispatch = async (lat: number, lng: number, address: string) => {
      const token = localStorage.getItem("token");
      try {
        const now = new Date();
        const yyyymmdd = now.toISOString().split("T")[0];
        const hhmm = now.toTimeString().split(" ")[0].substring(0, 5); // local time HH:MM
        const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        
        let createdBookingId = null;
        try {
          const bookingRes = await fetch(`${apiBase}/api/bookings`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({
              provider_id: "on_demand",
              provider_type: dispatchProviderType,
              service_type: dispatchServiceType,
              slot_id: `on_demand|${yyyymmdd}|${hhmm}`,
              notes: `Urgent ${dispatchLabel} Request: ${dispatchSpecificReason.join(", ")}${dispatchOtherText ? ' - ' + dispatchOtherText : ''}`,
              total_price: 0
            })
          });
          if (bookingRes.ok) {
            const bData = await bookingRes.json();
            createdBookingId = bData.data?.id;
          }
        } catch (e) {
          console.warn("Failed to log booking, proceeding with dispatch", e);
        }

        const res = await fetch(`${apiBase}/api/dispatch/request`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}` 
          },
          body: JSON.stringify({
            patient_lat: lat,
            patient_lng: lng,
            patient_address: address,
            provider_type: dispatchProviderType,
            service_subtype: dispatchServiceType,
            notes: `Urgent ${dispatchLabel} Request: ${dispatchSpecificReason.join(", ")}${dispatchOtherText ? '\nDetails: ' + dispatchOtherText : ''}`,
            booking_id: createdBookingId
          })
        });

        const data = await res.json();
        if (res.ok && data.dispatch_id) {
          localStorage.setItem("activeDispatchId", data.dispatch_id);
          setActiveDispatchId(data.dispatch_id);
          alert(data.message || "Dispatch request created! Searching for nearby providers.");
        } else {
          alert(data.detail || data.message || "Failed to request dispatch.");
        }
      } catch (e: any) {
        console.error("Dispatch request network error:", e);
        alert(e?.message === "Failed to fetch" ? "Unable to connect to CallMedex server (http://localhost:8000). Please check your backend connection." : (e?.message || "Failed to request dispatch."));
      } finally {
        setRequestingDispatch(null);
      }
    };

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => executeDispatch(pos.coords.latitude, pos.coords.longitude, "Current GPS Location"),
        (err) => {
          console.warn("Geolocation fallback activated:", err.message);
          executeDispatch(17.7231, 83.3013, "Visakhapatnam (Default)");
        },
        { enableHighAccuracy: false, timeout: 4000 }
      );
    } else {
      executeDispatch(17.7231, 83.3013, "Visakhapatnam (Default)");
    }
  };

  const handleLinkAbha = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/auth/link-abha`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ abha_number: abhaInput })
    });
    const data = await res.json();
    if (data.success) {
      setAbhaLinkedNumber(data.data.abha_number);
      setShowAbhaModal(false);
    }
  };

  const handleCreateAbha = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/auth/create-abha`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ aadhaar_number: aadhaarInput, otp: otpInput })
    });
    const data = await res.json();
    if (data.success) {
      setAbhaLinkedNumber(data.data.abha_number);
      setShowAbhaModal(false);
    }
  };

  const handleCancelRequest = async (dispatchId: string | undefined, currentStatus: string) => {
    if (!dispatchId) {
      alert("Unable to cancel: Missing dispatch ID. Please contact support.");
      return;
    }
    let msg = "Are you sure you want to cancel this request?";
    if (currentStatus === "provider_accepted" || currentStatus === "en_route" || currentStatus === "confirmed") {
      msg = "Are you sure? If the provider is already on the way or it has been more than 5 minutes since acceptance, a cancellation fee may apply.";
    }
    if (!confirm(msg)) return;

    try {
      const res = await dispatchAPI.cancelDispatch(dispatchId);
      if (res.success) {
        alert(res.message);
        if (dispatchId === activeDispatchId) {
          setActiveDispatchId(null);
          setTrackingData(null);
        }
        // Refresh bookings
        const bRes = await fetch('/api/bookings/my', {
          headers: { 'Authorization': `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('token') : ''}` }
        });
        if (bRes.ok) {
          const bData = await bRes.json();
          setBookings(bData.bookings || []);
        }
      } else {
        alert(res.message || "Failed to cancel");
      }
    } catch (e: any) {
      alert(e.message || "Failed to cancel request");
    }
  };

  const handleCancelBooking = async (bookingId: string, currentStatus: string) => {
    let msg = "Are you sure you want to cancel this booking?";
    if (currentStatus === "provider_accepted" || currentStatus === "en_route" || currentStatus === "confirmed") {
      msg = "Are you sure? If the provider is already on the way or it has been more than 5 minutes since acceptance, a cancellation fee may apply.";
    }
    if (!confirm(msg)) return;

    try {
      const res = await bookingsAPI.cancelBooking(bookingId);
      if (res.success) {
        alert(res.message);
        // Refresh bookings
        const bRes = await fetch('/api/bookings/my', {
          headers: { 'Authorization': `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('token') : ''}` }
        });
        if (bRes.ok) {
          const bData = await bRes.json();
          setBookings(bData.bookings || []);
        }
      } else {
        alert(res.message || "Failed to cancel booking");
      }
    } catch (e: any) {
      alert(e.message || "Failed to cancel booking");
    }
  };

  const name = user?.full_name || "Patient";
  
  const upcomingCount = bookings.filter(b => ["confirmed", "pending_review", "slot_allotted"].includes(b.status)).length;
  const completedCount = bookings.filter(b => b.status === "completed").length;
  const allottedBookings = bookings.filter(b => b.status === "slot_allotted");

  // Respond to an allotted slot
  const handleRespondSlot = async (bookingId: string, accepted: boolean, reason?: string) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/bookings/${bookingId}/respond-slot`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ accepted, reason: reason || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        // Refresh bookings
        const bRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/bookings/my-bookings`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const bData = await bRes.json();
        if (bData.success) setBookings(bData.data.bookings || []);
      } else {
        alert(data.detail || "Failed to respond");
      }
    } catch (e) {
      alert("Network error");
    }
  };

  // Filter out any active dispatch/home visits for Swiggy-style tracking
  const activeDispatches = bookings.filter(b => 
    b.status === "confirmed" && 
    (b.service_type === "home_collection" || (b.notes && b.notes.includes("Home Visit")))
  );

  return (
    <div className="dashboard">
      <div className="container">
        {/* Header */}
        <div className="dashboard__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>{t.welcome}, {name} 👋</h1>
            <p className="dashboard__greeting">{t.greeting}</p>
          </div>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as any)}
              style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e0', backgroundColor: 'white', cursor: 'pointer' }}
            >
              <option value="en">English</option>
              <option value="te">తెలుగు (Telugu)</option>
              <option value="hi">हिंदी (Hindi)</option>
            </select>
            <a href="/booking" className="btn btn-primary">{t.bookTest}</a>
          </div>
        </div>

        {/* ─── NEW: LIVE UBER-STYLE TRACKER ─── */}
        {activeDispatchId && trackingData && (
          <div style={{ marginBottom: 32, animation: "fadeIn 0.5s ease-out" }}>
            <h3 style={{ marginBottom: 16, fontFamily: "var(--font-body)", fontSize: "1.2rem", display: 'flex', alignItems: 'center', gap: 8, color: '#2f855a' }}>
              <span style={{ position: 'relative', display: 'flex', width: 12, height: 12 }}>
                <span style={{ animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite', position: 'absolute', display: 'inline-flex', height: '100%', width: '100%', borderRadius: '50%', backgroundColor: '#48bb78', opacity: 0.75 }}></span>
                <span style={{ position: 'relative', display: 'inline-flex', borderRadius: '50%', height: 12, width: 12, backgroundColor: '#38a169' }}></span>
              </span>
              Live Service Tracking
            </h3>
            
            <div className="card" style={{ padding: 24, border: trackingData.status === "searching" ? '2px dashed #ecc94b' : '2px solid #38a169', backgroundColor: trackingData.status === "searching" ? '#fffff0' : '#f0fff4', transition: 'all 0.3s ease' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                <span style={{ backgroundColor: trackingData.status === "searching" ? "#fef08a" : "#dcfce7", color: trackingData.status === "searching" ? "#854d0e" : "#16a34a", padding: "6px 16px", borderRadius: "20px", fontWeight: "bold", textTransform: "uppercase" }}>
                  Status: {trackingData.status?.replace("_", " ") || "Unknown"}
                </span>
                
                {trackingData.provider && trackingData.provider.distance_km != null ? (
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#1f2937" }}>
                      {trackingData.provider.distance_km} km away
                    </div>
                    <div style={{ color: "#6b7280", fontSize: "0.9rem" }}>
                      ETA: ~{trackingData.provider.eta_minutes} mins
                    </div>
                  </div>
                ) : trackingData.status === "searching" ? (
                  <div style={{ color: "#854d0e", fontStyle: "italic", animation: "pulse 2s infinite" }}>Scanning radius...</div>
                ) : (
                  <div style={{ color: "#6b7280", fontStyle: "italic" }}>Calculating distance...</div>
                )}
              </div>
              
              {/* Cancel Button Area */}
              {trackingData.status !== "arrived" && trackingData.status !== "in_progress" && trackingData.status !== "completed" && trackingData.status !== "cancelled" && (
                <div style={{ textAlign: 'right', marginBottom: 15 }}>
                  <button 
                    onClick={() => handleCancelRequest(activeDispatchId || trackingData.dispatch_id, trackingData.status)}
                    style={{
                      background: 'none', border: 'none', color: '#dc2626', fontWeight: 600, 
                      fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline'
                    }}
                  >
                    Cancel Request
                  </button>
                </div>
              )}

              {trackingData.provider ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, backgroundColor: "white", padding: 16, borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)" }}>
                    <div style={{ width: 45, height: 45, borderRadius: '50%', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
                      🧑‍⚕️
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{trackingData.provider.name}</div>
                      <div style={{ fontSize: '0.9rem', color: '#4b5563' }}>📞 {trackingData.provider.mobile}</div>
                    </div>
                  </div>

                  {patientOtp && trackingData.status === "arrived" && (
                    <div style={{ backgroundColor: "#3182ce", color: "white", padding: 20, borderRadius: 8, textAlign: "center", animation: "fadeIn 0.5s ease-out" }}>
                      <h4 style={{ margin: "0 0 10px 0" }}>Provider Arrived!</h4>
                      <p style={{ margin: "0 0 15px 0", fontSize: "0.9rem" }}>Please give this 6-digit Secure OTP to the provider to start the service:</p>
                      <div style={{ fontSize: "2.5rem", letterSpacing: "8px", fontWeight: "bold", background: "white", color: "#3182ce", padding: "10px", borderRadius: "8px", display: "inline-block" }}>
                        {patientOtp}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ padding: 30, backgroundColor: "white", borderRadius: 8, textAlign: "center", color: "#854d0e", border: "1px dashed #ecc94b" }}>
                  <div style={{ fontSize: "2rem", marginBottom: 10 }}>📡</div>
                  <div style={{ fontWeight: "bold", marginBottom: 5 }}>Broadcasting Request...</div>
                  <div style={{ fontSize: "0.9rem" }}>Notifying nearby providers. Please wait for someone to accept your request.</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="stats-grid">
          <div className="card stat-card">
            <div className="stat-card__icon" style={{ background: "#dbeafe", color: "#2563eb" }}>📋</div>
            <div>
              <div className="stat-card__value">{upcomingCount}</div>
              <div className="stat-card__label">{t.upcoming}</div>
            </div>
          </div>
          <div className="card stat-card">
            <div className="stat-card__icon" style={{ background: "#dcfce7", color: "#16a34a" }}>✅</div>
            <div>
              <div className="stat-card__value">{completedCount}</div>
              <div className="stat-card__label">{t.completed}</div>
            </div>
          </div>
          <div className="card stat-card">
            <div className="stat-card__icon" style={{ background: "#fef3c7", color: "#d97706" }}>💊</div>
            <div>
              <div className="stat-card__value">0</div>
              <div className="stat-card__label">{t.prescriptions}</div>
            </div>
          </div>
          <div className="card stat-card">
            <div className="stat-card__icon" style={{ background: "#ede9fe", color: "#7c3aed" }}>📊</div>
            <div>
              <div className="stat-card__value">0</div>
              <div className="stat-card__label">{t.records}</div>
            </div>
          </div>
        </div>

        {/* Slot Allotment Notifications */}
        {allottedBookings.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ marginBottom: 12, fontFamily: "var(--font-body)", fontSize: "1.05rem", display: "flex", alignItems: "center", gap: 8 }}>
              🔔 Slot Allotment Notifications
              <span style={{ backgroundColor: "#fbbf24", color: "#78350f", borderRadius: 20, padding: "2px 10px", fontSize: "0.72rem", fontWeight: 700 }}>
                {allottedBookings.length} pending
              </span>
            </h3>
            {allottedBookings.map((b: any) => {
              const slotStart = new Date(b.slot_start);
              const slotEnd = new Date(b.slot_end);
              return (
                <div key={b.id} className="card" style={{
                  padding: "16px 24px", marginBottom: 10, border: "2px solid #f59e0b",
                  background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 700, color: "#92400e", fontSize: "0.95rem", marginBottom: 4 }}>
                        ⏰ Time Slot Allotted
                      </div>
                      <div style={{ fontSize: "0.88rem", color: "#78350f", marginBottom: 4 }}>
                        <strong>{slotStart.toLocaleDateString()}</strong> • {slotStart.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {slotEnd.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#a16207" }}>{b.notes || b.service_type?.replace('_', ' ')}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => handleRespondSlot(b.id, true)}
                        style={{
                          padding: "8px 20px", borderRadius: 8, border: "none",
                          backgroundColor: "#16a34a", color: "white", fontWeight: 600,
                          fontSize: "0.85rem", cursor: "pointer",
                        }}
                      >✅ Accept</button>
                      <button
                        onClick={() => {
                          const reason = prompt("Reason for declining (optional):");
                          handleRespondSlot(b.id, false, reason || undefined);
                        }}
                        style={{
                          padding: "8px 20px", borderRadius: 8, border: "1.5px solid #dc2626",
                          backgroundColor: "white", color: "#dc2626", fontWeight: 600,
                          fontSize: "0.85rem", cursor: "pointer",
                        }}
                      >❌ Decline</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Quick Actions */}
        <h3 style={{ marginBottom: 16, fontFamily: "var(--font-body)", fontSize: "1.1rem" }}>{t.quick}</h3>
        <div className="quick-actions" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
          
          {/* Dispatch Buttons */}
          <button onClick={() => openDispatchModal("phlebotomist", "home_collection", "Blood Collection")} disabled={requestingDispatch !== null} className="card quick-action" style={{ border: 'none', cursor: 'pointer', textAlign: 'center' }}>
            <div className="quick-action__icon" style={{ background: "#fee2e2", color: "#ef4444", margin: "0 auto 12px" }}>🩸</div>
            <h4>{requestingDispatch === "phlebotomist" ? "Requesting..." : "Urgent Home Collection"}</h4>
          </button>
          
          <button onClick={() => openDispatchModal("doctor", "home_visit", "Home Doctor")} disabled={requestingDispatch !== null} className="card quick-action" style={{ border: 'none', cursor: 'pointer', textAlign: 'center' }}>
            <div className="quick-action__icon" style={{ background: "#dbeafe", color: "#2563eb", margin: "0 auto 12px" }}>🧑‍⚕️</div>
            <h4>{requestingDispatch === "doctor" ? "Requesting..." : "Urgent Home Doctor"}</h4>
          </button>
          
          <button onClick={() => openDispatchModal("nurse", "nursing_care", "Home Nurse")} disabled={requestingDispatch !== null} className="card quick-action" style={{ border: 'none', cursor: 'pointer', textAlign: 'center' }}>
            <div className="quick-action__icon" style={{ background: "#fce7f3", color: "#db2777", margin: "0 auto 12px" }}>👩‍⚕️</div>
            <h4>{requestingDispatch === "nurse" ? "Requesting..." : "Urgent Home Nurse"}</h4>
          </button>
          
          <button onClick={() => openDispatchModal("pharmacy_delivery", "medicine_delivery", "Pharmacy Delivery")} disabled={requestingDispatch !== null} className="card quick-action" style={{ border: 'none', cursor: 'pointer', textAlign: 'center' }}>
            <div className="quick-action__icon" style={{ background: "#fef3c7", color: "#d97706", margin: "0 auto 12px" }}>🛵</div>
            <h4>{requestingDispatch === "pharmacy_delivery" ? "Requesting..." : "Urgent Medicine Delivery"}</h4>
          </button>

          {/* Standard Navigation Buttons */}
          <a href="/booking?type=video_consult" className="card quick-action">
            <div className="quick-action__icon" style={{ background: "#dcfce7", color: "#16a34a" }}>📹</div>
            <h4>{t.video}</h4>
          </a>
          
          <a href="/dashboard/patient/pmjay" className="card quick-action" style={{ border: '2px solid #38a169', backgroundColor: '#f0fff4' }}>
            <div className="quick-action__icon" style={{ background: "#38a169", color: "white" }}>🏥</div>
            <h4 style={{ color: '#2f855a' }}>{t.pmjay}</h4>
          </a>
          
          <a href="/dashboard/patient/reports" className="card quick-action" style={{ border: '2px solid #805ad5', backgroundColor: '#faf5ff' }}>
            <div className="quick-action__icon" style={{ background: "#805ad5", color: "white" }}>🤖</div>
            <h4 style={{ color: '#553c9a' }}>AI Reports</h4>
          </a>
        </div>

        {/* Recent Bookings */}
        <h3 style={{ marginBottom: 16, fontFamily: "var(--font-body)", fontSize: "1.1rem" }}>Recent Bookings</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {loading ? (
             <div className="card" style={{ padding: "32px", textAlign: "center", color: "var(--color-gray-500)" }}>Loading...</div>
          ) : bookings?.length > 0 ? (
            bookings.map((booking: any) => (
              <div key={booking.id} className="card" style={{ padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 10,
                    background: booking.service_type === "lab_test" ? "#dbeafe" : booking.service_type === "video_consult" ? "#dcfce7" : "#fef3c7",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem"
                  }}>
                    {booking.service_type === "lab_test" ? "🔬" : booking.service_type === "video_consult" ? "📹" : "🩺"}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.95rem", textTransform: 'capitalize' }}>
                      {booking.service_type.replace('_', ' ')}
                    </div>
                    <div style={{ fontSize: "0.82rem", color: "var(--color-gray-500)" }}>
                      {booking.notes || `Provider ID: ${booking.provider_id}`} · {new Date(booking.slot_start).toLocaleDateString()} at {new Date(booking.slot_start).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                  <span className={`badge ${
                    booking.status === "confirmed" ? "badge-info"
                    : booking.status === "cancelled" || booking.status === "slot_rejected" ? "badge-danger"
                    : booking.status === "pending_review" ? "badge-warning"
                    : booking.status === "slot_allotted" ? "badge-warning"
                    : "badge-success"
                  }`} style={{
                    backgroundColor: booking.status === "cancelled" || booking.status === "slot_rejected" ? "#fee2e2"
                      : booking.status === "pending_review" ? "#eff6ff"
                      : booking.status === "slot_allotted" ? "#fef3c7"
                      : undefined,
                    color: booking.status === "cancelled" || booking.status === "slot_rejected" ? "#ef4444"
                      : booking.status === "pending_review" ? "#2563eb"
                      : booking.status === "slot_allotted" ? "#d97706"
                      : undefined,
                  }}>
                    {booking.status === "pending_review" ? "⏳ Pending Review"
                      : booking.status === "slot_allotted" ? "🔔 Slot Allotted"
                      : booking.status === "slot_rejected" ? "❌ Slot Declined"
                      : booking.status.replace('_', ' ')}
                  </span>
                  {booking.status !== "arrived" && booking.status !== "in_progress" && booking.status !== "completed" && booking.status !== "cancelled" && booking.status !== "slot_allotted" && (
                    <button 
                      onClick={() => handleCancelBooking(booking.id, booking.status)}
                      style={{
                        background: 'none', border: 'none', color: '#dc2626', fontWeight: 500, 
                        fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline', padding: 0
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="card" style={{ padding: "32px", textAlign: "center", color: "var(--color-gray-500)" }}>
              <p>No recent bookings found.</p>
              <a href="/booking" className="btn btn-primary" style={{ marginTop: 12, display: "inline-block" }}>Book Your First Service</a>
            </div>
          )}
          {bookings?.length > 0 && (
            <a href="/dashboard/patient/bookings" className="btn btn-outline" style={{ marginTop: 8, display: 'block', textAlign: 'center' }}>
              View All Bookings History
            </a>
          )}
        </div>

        {/* Health Records Placeholder */}
        <div className="card" style={{ marginTop: 32, padding: 32, textAlign: "center", border: abhaLinkedNumber ? "2px solid #319795" : "2px dashed var(--color-gray-200)", backgroundColor: abhaLinkedNumber ? "#e6fffa" : "white" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>🔗</div>
          <h3 style={{ fontFamily: "var(--font-body)", fontSize: "1.1rem", marginBottom: 8 }}>ABHA Health Records</h3>
          {abhaLinkedNumber ? (
            <div>
              <p style={{ color: "#285e61", fontSize: "1rem", fontWeight: "bold", margin: "16px 0" }}>
                ✅ ABHA Linked: <span style={{ letterSpacing: 1.5 }}>{abhaLinkedNumber}</span>
              </p>
              <p style={{ color: "var(--color-gray-500)", fontSize: "0.9rem", maxWidth: 400, margin: "0 auto 16px" }}>
                Your health records are synced with ABDM.
              </p>
            </div>
          ) : (
            <div>
              <p style={{ color: "var(--color-gray-500)", fontSize: "0.9rem", maxWidth: 400, margin: "0 auto 16px" }}>
                Link your ABHA (Ayushman Bharat Health Account) to access your complete health history from any ABDM-registered facility.
              </p>
              <button className="btn btn-teal" onClick={() => setShowAbhaModal(true)}>Manage ABHA Account</button>
            </div>
          )}
        </div>

        {/* ─── Profile Details ─── */}
        <DashboardProfile profile={profile} role="patient" />
      </div>

      {showAbhaModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card" style={{ padding: 32, maxWidth: 400, width: "100%" }}>
            <h2 style={{ marginBottom: 24, fontSize: "1.25rem", fontFamily: "var(--font-body)" }}>Manage ABHA</h2>
            
            <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
              <button className={`btn ${abhaTab === 'link' ? 'btn-primary' : 'btn-outline'}`} style={{ flex: 1 }} onClick={() => setAbhaTab('link')}>Link Existing</button>
              <button className={`btn ${abhaTab === 'create' ? 'btn-primary' : 'btn-outline'}`} style={{ flex: 1 }} onClick={() => { setAbhaTab('create'); setAbhaStep(1); }}>Create New</button>
            </div>

            {abhaTab === 'link' && (
              <div>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>Enter 14-digit ABHA Number</label>
                <input type="text" className="input" placeholder="e.g. 12-3456-7890-1234" value={abhaInput} onChange={(e) => setAbhaInput(e.target.value)} style={{ width: "100%", marginBottom: 24 }} />
                <button className="btn btn-teal" style={{ width: "100%" }} onClick={handleLinkAbha}>Link Account</button>
              </div>
            )}

            {abhaTab === 'create' && (
              <div>
                {abhaStep === 1 ? (
                  <div>
                    <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>Enter Aadhaar Number</label>
                    <input type="text" className="input" placeholder="12-digit Aadhaar" value={aadhaarInput} onChange={(e) => setAadhaarInput(e.target.value)} style={{ width: "100%", marginBottom: 24 }} />
                    <button className="btn btn-teal" style={{ width: "100%" }} onClick={() => setAbhaStep(2)}>Send OTP</button>
                  </div>
                ) : (
                  <div>
                    <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>Enter OTP Sent to Mobile</label>
                    <input type="text" className="input" placeholder="6-digit OTP" value={otpInput} onChange={(e) => setOtpInput(e.target.value)} style={{ width: "100%", marginBottom: 24 }} />
                    <button className="btn btn-teal" style={{ width: "100%" }} onClick={handleCreateAbha}>Verify & Create</button>
                  </div>
                )}
              </div>
            )}

            <button className="btn btn-outline" style={{ width: "100%", marginTop: 12 }} onClick={() => setShowAbhaModal(false)}>Cancel</button>
          </div>
        </div>
      )}
      {/* Dispatch Reason Modal */}
      {showDispatchModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn 0.2s" }}>
          <div style={{ backgroundColor: "white", padding: "32px", borderRadius: "16px", width: "90%", maxWidth: "450px", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ margin: 0, fontSize: "1.25rem", color: "#1f2937" }}>Select Service Needed</h2>
              <button onClick={() => setShowDispatchModal(false)} style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "#9ca3af" }}>&times;</button>
            </div>
            
            <p style={{ color: "#4b5563", fontSize: "0.95rem", marginBottom: "20px" }}>
              Please specify the exact requirement so we can match you with the right provider.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
              {(dispatchOptions[dispatchProviderType] || ["Other"]).map((opt) => (
                <label key={opt} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px", borderRadius: "8px", border: dispatchSpecificReason.includes(opt) ? "2px solid #3182ce" : "1px solid #e5e7eb", backgroundColor: dispatchSpecificReason.includes(opt) ? "#ebf8ff" : "white", cursor: "pointer", transition: "all 0.2s" }}>
                  <input
                    type="checkbox"
                    name="dispatchReason"
                    value={opt}
                    checked={dispatchSpecificReason.includes(opt)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setDispatchSpecificReason([...dispatchSpecificReason, opt]);
                      } else {
                        setDispatchSpecificReason(dispatchSpecificReason.filter(r => r !== opt));
                      }
                    }}
                    style={{ cursor: "pointer", width: "18px", height: "18px" }}
                  />
                  <span style={{ fontWeight: dispatchSpecificReason.includes(opt) ? 600 : 400, color: dispatchSpecificReason.includes(opt) ? "#2b6cb0" : "#374151" }}>{opt}</span>
                </label>
              ))}
            </div>

            {(dispatchSpecificReason.includes("Other") || dispatchSpecificReason.includes("Prescription Medicines") || dispatchSpecificReason.includes("OTC Medicines")) && (
              <div style={{ marginBottom: "24px", animation: "fadeIn 0.3s" }}>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: 500, color: "#374151", fontSize: "0.95rem" }}>
                  {dispatchSpecificReason.includes("Other") ? "Please specify your requirement:" : "List the medicines you need (e.g. Paracetamol 500mg x2, Dolo 650 x1):"}
                </label>
                <textarea
                  value={dispatchOtherText}
                  onChange={(e) => setDispatchOtherText(e.target.value)}
                  placeholder="Enter details here..."
                  style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #d1d5db", minHeight: "80px", resize: "vertical", fontFamily: "inherit" }}
                />
              </div>
            )}

            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={() => { setShowDispatchModal(false); setDispatchOtherText(""); }} style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "1px solid #d1d5db", backgroundColor: "white", color: "#374151", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={confirmDispatchRequest} disabled={dispatchSpecificReason.length === 0} style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "none", backgroundColor: dispatchSpecificReason.length > 0 ? "#3182ce" : "#9ca3af", color: "white", fontWeight: 600, cursor: dispatchSpecificReason.length > 0 ? "pointer" : "not-allowed", transition: "background-color 0.2s" }}>Confirm Request</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
