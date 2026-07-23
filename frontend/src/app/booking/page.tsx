"use client";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

// Standard fallback diagnostic tests if an organization hasn't listed custom items yet
const DEFAULT_DIAGNOSTIC_TESTS = [
  { id: "std-1", name: "Complete Blood Count (CBC)", price: 250, description: "Total RBC, WBC, Hemoglobin & Platelets" },
  { id: "std-2", name: "Lipid Profile (Cholesterol)", price: 400, description: "Total Cholesterol, HDL, LDL, Triglycerides" },
  { id: "std-3", name: "Thyroid Profile (T3/T4/TSH)", price: 550, description: "Comprehensive Thyroid Gland Function" },
  { id: "std-4", name: "HbA1c (Diabetes Monitoring)", price: 350, description: "3-Month Average Blood Glucose Level" },
  { id: "std-5", name: "Liver Function Test (LFT)", price: 450, description: "Bilirubin, SGOT, SGPT, Alkaline Phosphatase" },
  { id: "std-6", name: "Kidney Function Test (KFT)", price: 400, description: "Urea, Creatinine, Uric Acid, Electrolytes" },
  { id: "std-7", name: "Vitamin D & B12 Panel", price: 799, description: "Bone & Nervous System Vitamin Status" },
];

const DEFAULT_DIAGNOSTIC_PACKAGES = [
  { id: "pkg-1", name: "Basic Health Checkup Panel", price: 899, tests: ["CBC", "Fasting Glucose", "Lipid Profile", "KFT"] },
  { id: "pkg-2", name: "Comprehensive Executive Body Checkup", price: 1799, tests: ["CBC", "HbA1c", "Lipid Profile", "Thyroid", "LFT", "KFT", "Vitamin D", "B12", "ECG"] },
];

// Generate 30-min time slots from 8:00 AM to 8:00 PM
const TIME_SLOTS = (() => {
  const slots: string[] = [];
  for (let h = 8; h <= 19; h++) {
    slots.push(`${h.toString().padStart(2, "0")}:00`);
    slots.push(`${h.toString().padStart(2, "0")}:30`);
  }
  slots.push("20:00");
  return slots;
})();

const formatSlotLabel = (t: string) => {
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr);
  const m = mStr;
  if (h === 0) return `12:${m} AM`;
  if (h < 12) return `${h}:${m} AM`;
  if (h === 12) return `12:${m} PM`;
  return `${h - 12}:${m} PM`;
};

function BookingPageContent() {
  const searchParams = useSearchParams();
  const typeParam = searchParams.get("type");
  const orgParam = searchParams.get("org");
  const serviceParam = searchParams.get("service");
  const packageParam = searchParams.get("package");

  const [step, setStep] = useState(1);
  const [bookingType, setBookingType] = useState(""); // "doctor" | "lab" | "home_doctor" | "home_collection" | "video_consult" | "nurse_visit"
  const [selectedOrg, setSelectedOrg] = useState<any>(null);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState<any>(null);
  const [selectedTest, setSelectedTest] = useState<any>(null);
  const [selectedTests, setSelectedTests] = useState<any[]>([]); // Multi-select for diagnostics
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingOrgs, setFetchingOrgs] = useState(false);
  const [error, setError] = useState("");
  const [bookingResult, setBookingResult] = useState<any>(null);
  
  // Real dynamic data state
  const [realOrgs, setRealOrgs] = useState<any[]>([]);
  const [realDoctors, setRealDoctors] = useState<any[]>([]);

  // On-demand dispatch fields
  const [dispatchAddress, setDispatchAddress] = useState("");

  // Multi-test toggle helper
  const toggleTest = (test: any) => {
    setSelectedTests((prev) => {
      const exists = prev.find((t) => t.name === test.name);
      if (exists) return prev.filter((t) => t.name !== test.name);
      return [...prev, test];
    });
    setError("");
  };

  // Multi-test total price
  const multiTestTotal = selectedTests.reduce((sum, t) => sum + (t.price || 0), 0);

  // Pre-select booking type & organization from URL params
  useEffect(() => {
    const targetType = typeParam || (orgParam ? "lab" : "");
    if (targetType && !bookingType) {
      const validTypes = ["doctor", "lab", "home_doctor", "home_collection", "video_consult", "nurse_visit"];
      if (validTypes.includes(targetType)) {
        setBookingType(targetType);
        if (orgParam) {
          setSelectedOrg({ id: orgParam, isReal: true, name: "Selected Provider" });
          setStep(3);
        } else {
          setStep(2);
        }
      }
    }
  }, [typeParam, orgParam, bookingType]);

  // Fetch real registered organizations or doctors when step === 2
  useEffect(() => {
    if (step === 2) {
      setFetchingOrgs(true);
      if (bookingType === "doctor" || bookingType === "lab") {
        const orgTypeFilter = bookingType === "lab" ? "diagnostic" : "";
        const url = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/providers/search/organizations${orgTypeFilter ? `?org_type=${orgTypeFilter}` : ""}`;
        
        fetch(url)
          .then((r) => r.json())
          .then((data) => {
            if (data.success && data.organizations) {
              setRealOrgs(data.organizations);
            } else {
              setRealOrgs([]);
            }
          })
          .catch((err) => {
            console.error("Failed to fetch registered organizations:", err);
            setRealOrgs([]);
          })
          .finally(() => setFetchingOrgs(false));
      } else if (bookingType === "video_consult" || bookingType === "home_doctor") {
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/providers/search/doctors`)
          .then((r) => r.json())
          .then((data) => {
            if (data.success && data.doctors) {
              setRealDoctors(data.doctors);
            } else {
              setRealDoctors([]);
            }
          })
          .catch((err) => {
            console.error("Failed to fetch registered doctors:", err);
            setRealDoctors([]);
          })
          .finally(() => setFetchingOrgs(false));
      } else {
        setFetchingOrgs(false);
      }
    }
  }, [step, bookingType]);

  // Fetch services/tests/packages when an organization is selected
  useEffect(() => {
    if (selectedOrg?.id && !selectedOrg.fetchedDetails) {
      fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/bookings/org-services/${selectedOrg.id}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.success && data.data) {
            const svcs = data.data.services || [];
            const pkgs = data.data.packages || [];
            const docs = data.data.doctors || [];
            const tms = data.data.timings || [];

            setSelectedOrg((prev: any) => ({
              ...prev,
              fetchedDetails: true,
              name: prev?.organization_name || prev?.name || "Selected Facility",
              tests: svcs.length > 0 ? svcs : DEFAULT_DIAGNOSTIC_TESTS,
              packages: pkgs.length > 0 ? pkgs : DEFAULT_DIAGNOSTIC_PACKAGES,
              doctors: docs,
              timings: tms,
            }));
          } else {
            setSelectedOrg((prev: any) => ({
              ...prev,
              fetchedDetails: true,
              tests: DEFAULT_DIAGNOSTIC_TESTS,
              packages: DEFAULT_DIAGNOSTIC_PACKAGES,
              doctors: [],
              timings: [],
            }));
          }
        })
        .catch(() => {
          setSelectedOrg((prev: any) => ({
            ...prev,
            fetchedDetails: true,
            tests: DEFAULT_DIAGNOSTIC_TESTS,
            packages: DEFAULT_DIAGNOSTIC_PACKAGES,
            doctors: [],
            timings: [],
          }));
        });
    }
  }, [selectedOrg]);

  // Generate dynamic time slots based on organization's configured operating hours
  const getDynamicSlots = (dateStr: string): string[] => {
    const orgTimings = selectedOrg?.timings || [];
    if (!dateStr || orgTimings.length === 0) return TIME_SLOTS; // fallback to static

    const dateObj = new Date(dateStr + "T00:00:00");
    const dayOfWeek = dateObj.getDay(); // 0=Sun, 1=Mon ... 6=Sat

    // Find timing for this day
    const dayTiming = orgTimings.find((t: any) => t.day_of_week === dayOfWeek);
    if (!dayTiming || !dayTiming.is_open) return []; // Org closed on this day

    const openTime = dayTiming.open_time || "08:00";
    const closeTime = dayTiming.close_time || "20:00";
    const openHour = parseInt(openTime.split(":")[0]);
    const openMin = parseInt(openTime.split(":")[1] || "0");
    const closeHour = parseInt(closeTime.split(":")[0]);
    const closeMin = parseInt(closeTime.split(":")[1] || "0");

    const slots: string[] = [];
    let h = openHour;
    let m = openMin >= 30 ? 30 : 0;
    if (openMin > 0 && openMin <= 30) m = 30;

    while (h < closeHour || (h === closeHour && m <= closeMin)) {
      slots.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
      m += 30;
      if (m >= 60) { m = 0; h += 1; }
    }
    return slots;
  };

  const isDayClosed = (dateStr: string): boolean => {
    const orgTimings = selectedOrg?.timings || [];
    if (orgTimings.length === 0) return false; // No timings configured = assume open
    const dateObj = new Date(dateStr + "T00:00:00");
    const dayOfWeek = dateObj.getDay();
    const dayTiming = orgTimings.find((t: any) => t.day_of_week === dayOfWeek);
    return !dayTiming || !dayTiming.is_open;
  };

  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return {
      label: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      value: d.toISOString().split("T")[0],
    };
  });

  const handleConfirm = async () => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("You must be logged in to book. Please log in first.");
        setLoading(false);
        return;
      }

      const providerId = selectedOrg?.id || selectedDoctor?.id || "";
      const providerType = selectedDoctor && !selectedOrg ? "doctor" : "organization";
      const serviceType =
        bookingType === "doctor" || bookingType === "home_doctor"
          ? "doctor_appointment"
          : bookingType === "home_collection"
          ? "home_collection"
          : bookingType === "video_consult"
          ? "video_consult"
          : bookingType === "nurse_visit"
          ? "nurse_visit"
          : "lab_test";

      const slotKey = `${providerId}|${selectedDate}|${selectedSlot || "09:00"}`;

      // Build notes with all selected tests if multi-select
      const testNotes =
        selectedTests.length > 0
          ? `Tests: ${selectedTests.map((t) => t.name).join(", ")} | Total: ₹${multiTestTotal}`
          : selectedTest
          ? `Test: ${selectedTest.name}`
          : "";

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          provider_id: providerId,
          provider_type: providerType,
          service_type: serviceType,
          slot_id: slotKey,
          notes: selectedDoctor ? `Doctor: ${selectedDoctor.name}` : testNotes,
          selected_tests: selectedTests.length > 0 ? selectedTests.map((t) => t.name) : undefined,
          total_price: selectedTests.length > 0 ? multiTestTotal : selectedTest?.price || selectedDoctor?.fee || 0,
          preferred_date: selectedDate,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Booking failed. Please try again.");
        setLoading(false);
        return;
      }

      setBookingResult(data.data);
      setStep(10); // Success step
    } catch {
      setError("Network error. Please check if the backend server is running on port 8000.");
    } finally {
      setLoading(false);
    }
  };

  // On-demand dispatch for home services
  const handleDispatchNow = async () => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("Please log in to request an on-demand visit.");
        setLoading(false);
        return;
      }
      if (!dispatchAddress.trim()) {
        setError("Please enter your full address.");
        setLoading(false);
        return;
      }

      const lat = 17.7231;
      const lng = 83.3013;

      const providerTypeStr = bookingType === "home_collection" ? "phlebotomist" : bookingType === "nurse_visit" ? "nurse" : "doctor";
      const serviceTypeStr = bookingType === "home_collection" ? "home_collection" : bookingType === "nurse_visit" ? "nurse_visit" : "doctor_appointment";
      const dispatchNotes =
        selectedTests.length > 0
          ? `Tests: ${selectedTests.map((t) => t.name).join(", ")} | Total: ₹${multiTestTotal}`
          : selectedTest
          ? `Test: ${selectedTest.name}`
          : selectedDoctor
          ? `Doctor: ${selectedDoctor.name}`
          : "";

      let createdBookingId = null;
      try {
        const now = new Date();
        const yyyymmdd = now.toISOString().split("T")[0];
        const hhmm = now.toTimeString().split(" ")[0].substring(0, 5);

        const bookingRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/bookings`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            provider_id: "on_demand",
            provider_type: providerTypeStr,
            service_type: serviceTypeStr,
            slot_id: `on_demand|${yyyymmdd}|${hhmm}`,
            notes: `Urgent On-Demand: ${dispatchNotes}`,
            selected_tests: selectedTests.length > 0 ? selectedTests.map((t) => t.name) : undefined,
            total_price: selectedTests.length > 0 ? multiTestTotal : selectedTest?.price || selectedDoctor?.fee || 0,
          }),
        });
        if (bookingRes.ok) {
          const bData = await bookingRes.json();
          createdBookingId = bData.data?.id;
        }
      } catch (e) {
        console.warn("Failed to log booking, proceeding with dispatch", e);
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/dispatch/request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          patient_lat: lat,
          patient_lng: lng,
          patient_address: dispatchAddress,
          provider_type: providerTypeStr,
          service_subtype: serviceTypeStr,
          notes: dispatchNotes,
          booking_id: createdBookingId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Dispatch request failed. Please try again.");
        setLoading(false);
        return;
      }

      if (data.dispatch_id) {
        localStorage.setItem("activeDispatchId", data.dispatch_id);
      }

      setBookingResult({ ...data, address: dispatchAddress, isDispatch: true });
      setStep(10);
    } catch {
      setError("Network error. Please check if the backend server is running.");
    } finally {
      setLoading(false);
    }
  };

  const isSlotBooked = (time: string) => {
    const providerId = selectedOrg?.id || selectedDoctor?.id || "";
    return bookedSlots.includes(`${providerId}|${selectedDate}|${time}`);
  };

  const getOrgTypeBadge = (type: string) => {
    const map: Record<string, { label: string; color: string }> = {
      clinic: { label: "Clinic", color: "#3182ce" },
      polyclinic: { label: "Polyclinic", color: "#805ad5" },
      hospital: { label: "Hospital", color: "#e53e3e" },
      diagnostic: { label: "Diagnostic Center", color: "#38a169" },
      laboratory: { label: "Diagnostic Lab", color: "#38a169" },
    };
    const v = map[type] || { label: type, color: "#718096" };
    return <span style={{ fontSize: "0.7rem", backgroundColor: v.color, color: "white", padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>{v.label}</span>;
  };

  const isOnDemand = bookingType === "home_collection" || bookingType === "home_doctor" || bookingType === "nurse_visit";
  const fee = selectedDoctor?.fee || (selectedTests.length > 0 ? multiTestTotal : selectedTest?.price) || 0;

  // Step indicator
  const getSteps = () => {
    if (bookingType === "nurse_visit") return ["Select Service", "Choose Care Type", "Enter Address"];
    if (isOnDemand) return ["Select Service", "Choose Item", "Enter Address"];
    if (bookingType === "video_consult") return ["Select Service", "Choose Doctor", "Date & Time"];
    if (bookingType === "doctor") return ["Select Service", "Find Provider", "Choose Doctor", "Date & Time"];
    if (bookingType === "lab") return ["Select Service", "Find Center", "Choose Tests", "Select Date & Time"];
    return [];
  };
  const currentStepIdx = step === 10 ? -1 : isOnDemand ? (step <= 2 ? step - 1 : 2) : Math.min(step - 1, getSteps().length - 1);

  // Filtered real organizations
  const filteredRealOrgs = realOrgs.filter((o) => {
    const nameStr = (o.organization_name || o.name || "").toLowerCase();
    const cityStr = (o.city || o.address || "").toLowerCase();
    const queryStr = searchQuery.toLowerCase();
    return nameStr.includes(queryStr) || cityStr.includes(queryStr);
  });

  return (
    <div className="section" style={{ background: "var(--color-gray-50)", minHeight: "80vh" }}>
      <div className="container" style={{ maxWidth: 800 }}>
        <h2 style={{ marginBottom: 4 }}>Book an Appointment</h2>
        <p style={{ color: "var(--color-gray-500)", marginBottom: 24, fontSize: "0.9rem" }}>Search registered doctors, clinics, hospitals, diagnostic centers — book instantly</p>

        {/* Step Progress Indicator */}
        {step !== 10 && getSteps().length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 32 }}>
            {getSteps().map((label, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", flex: i < getSteps().length - 1 ? 1 : "none" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 60 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      backgroundColor: i <= currentStepIdx ? "#1a2b4a" : "#e2e8f0",
                      color: i <= currentStepIdx ? "white" : "#a0aec0",
                      transition: "all 0.3s",
                    }}
                  >
                    {i < currentStepIdx ? "✓" : i + 1}
                  </div>
                  <span style={{ fontSize: "0.65rem", color: i <= currentStepIdx ? "#1a2b4a" : "#a0aec0", fontWeight: i <= currentStepIdx ? 700 : 400, marginTop: 4, textAlign: "center" }}>
                    {label}
                  </span>
                </div>
                {i < getSteps().length - 1 && (
                  <div style={{ flex: 1, height: 2, backgroundColor: i < currentStepIdx ? "#1a2b4a" : "#e2e8f0", transition: "all 0.3s", margin: "0 4px", marginBottom: 16 }} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div style={{ padding: "12px 20px", backgroundColor: "#fed7d7", color: "#9b2c2c", borderRadius: 10, marginBottom: 20, fontSize: "0.9rem", fontWeight: 600 }}>
            ⚠️ {error}
          </div>
        )}

        {/* ─── STEP 1: Choose What To Book ─── */}
        {step === 1 && (
          <div className="card" style={{ padding: 32 }}>
            <h3 style={{ fontSize: "1.05rem", marginBottom: 20, color: "#1a2b4a" }}>What service would you like to book?</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
              {[
                { key: "doctor", icon: "🩺", label: "Doctor Appointment", desc: "Clinic, Polyclinic or Hospital OPD Visit" },
                { key: "lab", icon: "🧪", label: "Lab Test / Diagnostics", desc: "Visit registered Diagnostic Center for blood/imaging tests" },
                { key: "home_doctor", icon: "🏠", label: "Doctor Home Visit", desc: "Verified doctor arrives at your doorstep" },
                { key: "home_collection", icon: "🩸", label: "Home Sample Collection", desc: "Phlebotomist collects blood samples at home" },
                { key: "video_consult", icon: "📹", label: "Instant Video Consult", desc: "Consult top doctor online via live video room" },
                { key: "nurse_visit", icon: "👩‍⚕️", label: "Nurse Home Visit", desc: "Injection, IV drip, wound care & nursing at home" },
              ].map((opt) => (
                <div
                  key={opt.key}
                  style={{
                    padding: 20,
                    borderRadius: 12,
                    border: "2px solid #e2e8f0",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    backgroundColor: "white",
                  }}
                  onClick={() => {
                    setBookingType(opt.key);
                    setSelectedOrg(null);
                    setSelectedDoctor(null);
                    setSelectedTest(null);
                    setSelectedTests([]);
                    setError("");
                    setStep(2);
                  }}
                >
                  <div style={{ fontSize: "2rem", marginBottom: 8 }}>{opt.icon}</div>
                  <div style={{ fontWeight: 700, color: "#1a2b4a", marginBottom: 4 }}>{opt.label}</div>
                  <div style={{ fontSize: "0.78rem", color: "#718096", lineHeight: 1.4 }}>{opt.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── STEP 2 (Doctor & Lab flow): Search Registered Organizations ─── */}
        {step === 2 && (bookingType === "doctor" || bookingType === "lab") && (
          <div className="card" style={{ padding: 32 }}>
            <h3 style={{ fontSize: "1.05rem", marginBottom: 16, color: "#1a2b4a" }}>
              {bookingType === "lab" ? "Select Registered Diagnostic Center" : "Find a Clinic, Polyclinic or Hospital"}
            </h3>

            {/* Search filter input */}
            <input
              type="text"
              placeholder={bookingType === "lab" ? "Search registered diagnostic centers by name or city..." : "Search registered hospitals or clinics..."}
              className="input-field"
              style={{ marginBottom: 20, width: "100%" }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            {fetchingOrgs ? (
              <div style={{ textAlign: "center", padding: 30, color: "#64748b" }}>⌛ Loading registered providers...</div>
            ) : filteredRealOrgs.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {filteredRealOrgs.map((org) => {
                  const orgName = org.organization_name || org.name || "Healthcare Facility";
                  const orgTypeVal = org.organization_type || org.type || "diagnostic";
                  const fullAddress = [org.address, org.city, org.district || org.state].filter(Boolean).join(", ");
                  const docsCount = org.doctors_count ?? org.total_doctors ?? 0;
                  const svcsCount = org.services_count ?? 0;

                  return (
                    <div
                      key={org.id}
                      style={{
                        padding: 18,
                        borderRadius: 12,
                        border: selectedOrg?.id === org.id ? "2px solid #0284c7" : "2px solid #e2e8f0",
                        backgroundColor: selectedOrg?.id === org.id ? "#f0f9ff" : "white",
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                      onClick={() => {
                        setSelectedOrg(org);
                        setError("");
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                            <h4 style={{ margin: 0, fontSize: "1.05rem", color: "#0f172a", fontWeight: 700 }}>{orgName}</h4>
                            {getOrgTypeBadge(orgTypeVal)}
                            <span style={{ fontSize: "0.72rem", backgroundColor: "#dcfce7", color: "#166534", padding: "2px 8px", borderRadius: 12, fontWeight: 700 }}>
                              ✅ Registered Facility
                            </span>
                          </div>
                          <p style={{ margin: "4px 0 6px 0", fontSize: "0.85rem", color: "#64748b" }}>
                            📍 {fullAddress || "Visakhapatnam"}
                          </p>
                          <div style={{ fontSize: "0.78rem", color: "#0284c7", fontWeight: 600 }}>
                            {docsCount} Doctor{docsCount === 1 ? "" : "s"} · {svcsCount} Active Test{svcsCount === 1 ? "" : "s"} / Services
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: 32, backgroundColor: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0" }}>
                <p style={{ fontSize: "0.95rem", color: "#475569", margin: "0 0 8px 0", fontWeight: 600 }}>No registered facilities match your search query.</p>
                <p style={{ fontSize: "0.82rem", color: "#94a3b8", margin: 0 }}>Try adjusting your search terms or location filter.</p>
              </div>
            )}

            <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => setStep(1)}>← Back</button>
              <button
                className="btn btn-primary"
                style={{ flex: 1, borderRadius: 10 }}
                disabled={!selectedOrg}
                onClick={() => setStep(3)}
              >
                Continue to Test / Service Selection →
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 2 (Video & Home Doctor flow): Select Registered Doctor ─── */}
        {step === 2 && (bookingType === "video_consult" || bookingType === "home_doctor") && (
          <div className="card" style={{ padding: 32 }}>
            <h3 style={{ fontSize: "1.05rem", marginBottom: 16, color: "#1a2b4a" }}>
              {bookingType === "video_consult" ? "Select Doctor for Online Video Consultation" : "Select Doctor for Home Visit"}
            </h3>

            {fetchingOrgs ? (
              <div style={{ textAlign: "center", padding: 30, color: "#64748b" }}>⌛ Loading registered doctors...</div>
            ) : realDoctors.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {realDoctors.map((doc) => (
                  <div
                    key={doc.id}
                    style={{
                      padding: 16,
                      borderRadius: 12,
                      border: selectedDoctor?.id === doc.id ? "2px solid #0284c7" : "2px solid #e2e8f0",
                      backgroundColor: selectedDoctor?.id === doc.id ? "#f0f9ff" : "white",
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      setSelectedDoctor(doc);
                      setError("");
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "1rem", color: "#0f172a" }}>{doc.name}</div>
                        <div style={{ fontSize: "0.82rem", color: "#64748b" }}>{doc.specialization} · {doc.qualification || "MBBS"}</div>
                        <div style={{ fontSize: "0.78rem", color: "#0284c7", marginTop: 4 }}>📍 {doc.city || "Visakhapatnam"}</div>
                      </div>
                      <div style={{ fontWeight: 800, color: "#059669", fontSize: "1.1rem" }}>
                        ₹{doc.fees?.video || doc.fees?.in_person || doc.fee || 499}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: 30, color: "#64748b" }}>No registered doctors currently available for this category.</div>
            )}

            <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => setStep(1)}>← Back</button>
              <button className="btn btn-primary" style={{ flex: 1, borderRadius: 10 }} disabled={!selectedDoctor} onClick={() => setStep(4)}>
                Select Date & Time Slot →
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 2 (On-Demand Home Collection / Nurse Visit) ─── */}
        {step === 2 && (bookingType === "home_collection" || bookingType === "nurse_visit") && (
          <div className="card" style={{ padding: 32 }}>
            <h3 style={{ fontSize: "1.05rem", marginBottom: 16, color: "#1a2b4a" }}>
              {bookingType === "home_collection" ? "Select Blood Tests for Home Sample Collection" : "Enter Patient Location for Nurse Home Visit"}
            </h3>

            {bookingType === "home_collection" && (
              <>
                <p style={{ fontSize: "0.85rem", color: "#64748b", marginBottom: 16 }}>Select one or multiple tests for instant phlebotomist dispatch to your address.</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                  {DEFAULT_DIAGNOSTIC_TESTS.map((test) => {
                    const isSelected = selectedTests.some((t) => t.name === test.name);
                    return (
                      <div
                        key={test.id}
                        style={{
                          padding: 14,
                          borderRadius: 10,
                          border: isSelected ? "2px solid #0284c7" : "2px solid #e2e8f0",
                          backgroundColor: isSelected ? "#f0f9ff" : "white",
                          cursor: "pointer",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                        onClick={() => toggleTest(test)}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <input type="checkbox" checked={isSelected} readOnly />
                          <div>
                            <div style={{ fontWeight: 700, color: "#0f172a" }}>{test.name}</div>
                            <div style={{ fontSize: "0.78rem", color: "#64748b" }}>{test.description}</div>
                          </div>
                        </div>
                        <div style={{ fontWeight: 700, color: "#059669" }}>₹{test.price}</div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontWeight: 700, display: "block", marginBottom: 8, color: "#0f172a" }}>🏡 Complete Home Address</label>
              <textarea
                className="input-field"
                rows={3}
                placeholder="Enter house no, street, landmark, area & pincode..."
                value={dispatchAddress}
                onChange={(e) => setDispatchAddress(e.target.value)}
                style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #cbd5e1" }}
              />
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button className="btn btn-secondary" onClick={() => setStep(1)}>← Back</button>
              <button
                className="btn btn-primary"
                style={{ flex: 1, borderRadius: 10, backgroundColor: "#0284c7" }}
                disabled={!dispatchAddress.trim() || (bookingType === "home_collection" && selectedTests.length === 0)}
                onClick={() => setStep(5)}
              >
                Proceed to Instant Dispatch →
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 3 (lab flow): Select Tests/Packages from Selected Registered Diagnostic Center ─── */}
        {step === 3 && bookingType === "lab" && selectedOrg && (
          <div className="card" style={{ padding: 32 }}>
            <h3 style={{ fontSize: "1.05rem", marginBottom: 6, color: "#1a2b4a" }}>
              Select Tests at {selectedOrg.organization_name || selectedOrg.name}
            </h3>
            <p style={{ fontSize: "0.82rem", color: "#64748b", marginBottom: 20 }}>✅ Select multiple tests or health panels — click to add or remove</p>

            {selectedOrg.packages && selectedOrg.packages.length > 0 && (
              <>
                <h4 style={{ fontSize: "0.92rem", color: "#805ad5", marginBottom: 10 }}>📦 Health Checkup Packages</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                  {selectedOrg.packages.map((pkg: any, i: number) => {
                    const isSelected = selectedTests.some((t) => t.name === pkg.name);
                    return (
                      <div
                        key={i}
                        style={{
                          padding: 14,
                          cursor: "pointer",
                          borderRadius: 10,
                          border: isSelected ? "2px solid #805ad5" : "2px solid #e2e8f0",
                          backgroundColor: isSelected ? "#faf5ff" : "white",
                          transition: "all 0.2s",
                        }}
                        onClick={() => toggleTest(pkg)}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: 4,
                                border: isSelected ? "2px solid #805ad5" : "2px solid #cbd5e0",
                                backgroundColor: isSelected ? "#805ad5" : "white",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "0.75rem",
                                color: "white",
                                fontWeight: 700,
                              }}
                            >
                              {isSelected ? "✓" : ""}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, color: "#1a2b4a" }}>{pkg.name}</div>
                              <div style={{ fontSize: "0.72rem", color: "#718096" }}>
                                {Array.isArray(pkg.tests) ? pkg.tests.join(", ") : pkg.description || "Comprehensive Panel"}
                              </div>
                            </div>
                          </div>
                          <div style={{ fontWeight: 700, color: "#2f855a" }}>₹{pkg.price}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <h4 style={{ fontSize: "0.92rem", color: "#0284c7", marginBottom: 10 }}>🔬 Individual Lab Tests</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              {(selectedOrg.tests || DEFAULT_DIAGNOSTIC_TESTS).map((test: any, i: number) => {
                const isSelected = selectedTests.some((t) => t.name === test.name);
                return (
                  <div
                    key={i}
                    style={{
                      padding: 12,
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      borderRadius: 10,
                      border: isSelected ? "2px solid #0284c7" : "2px solid #e2e8f0",
                      backgroundColor: isSelected ? "#f0f9ff" : "white",
                      transition: "all 0.2s",
                    }}
                    onClick={() => toggleTest(test)}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 4,
                          border: isSelected ? "2px solid #0284c7" : "2px solid #cbd5e0",
                          backgroundColor: isSelected ? "#0284c7" : "white",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.75rem",
                          color: "white",
                          fontWeight: 700,
                        }}
                      >
                        {isSelected ? "✓" : ""}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: "#1a2b4a" }}>{test.name}</div>
                        {test.description && <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{test.description}</div>}
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, color: "#2f855a" }}>₹{test.price}</div>
                  </div>
                );
              })}
            </div>

            {/* Total summary */}
            {selectedTests.length > 0 && (
              <div style={{ padding: 16, backgroundColor: "#f0fdf4", borderRadius: 12, border: "1px solid #bbf7d0", marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontWeight: 700, color: "#166534", fontSize: "0.95rem" }}>🛒 Selected {selectedTests.length} Item(s)</span>
                    <div style={{ fontSize: "0.78rem", color: "#15803d", marginTop: 2 }}>
                      {selectedTests.map((t) => t.name).join(", ")}
                    </div>
                  </div>
                  <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#15803d" }}>₹{multiTestTotal}</div>
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 12 }}>
              <button className="btn btn-secondary" onClick={() => { setStep(2); setSelectedTests([]); }}>← Back</button>
              <button className="btn btn-primary" style={{ flex: 1, borderRadius: 10 }} disabled={selectedTests.length === 0} onClick={() => setStep(4)}>
                Select Date & Time Slot →
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 4: Select Preferred Date AND Time Slot ─── */}
        {step === 4 && (
          <div className="card" style={{ padding: 32 }}>
            <h3 style={{ fontSize: "1.05rem", marginBottom: 16, color: "#1a2b4a" }}>Select Preferred Date & Time Slot</h3>

            {/* Date picker */}
            <div style={{ display: "flex", gap: 8, marginBottom: 24, overflowX: "auto", paddingBottom: 4 }}>
              {dates.map((d) => {
                const parts = d.label.split(" ");
                const dayOfWeek = parts[0]?.replace(",", "");
                const dayNum = parts[parts.length - 1];
                const month = parts.length >= 3 ? parts[1]?.replace(",", "") : "";
                const isToday = d.value === dates[0].value;
                const isSelected = selectedDate === d.value;
                return (
                  <div
                    key={d.value}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 12,
                      textAlign: "center",
                      cursor: "pointer",
                      minWidth: 72,
                      border: isSelected ? "2px solid #0284c7" : "2px solid #e2e8f0",
                      background: isSelected ? "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)" : "white",
                      color: isSelected ? "#fff" : "inherit",
                      transition: "all 0.2s ease",
                      boxShadow: isSelected ? "0 4px 12px rgba(2, 132, 199, 0.3)" : "none",
                    }}
                    onClick={() => {
                      setSelectedDate(d.value);
                      setSelectedSlot("");
                      setError("");
                    }}
                  >
                    <div style={{ fontSize: "0.7rem", opacity: 0.8, fontWeight: 600, textTransform: "uppercase" }}>{dayOfWeek}</div>
                    <div style={{ fontWeight: 800, fontSize: "1.2rem", margin: "2px 0" }}>{dayNum}</div>
                    <div style={{ fontSize: "0.65rem", opacity: 0.7 }}>{isToday ? "Today" : month}</div>
                  </div>
                );
              })}
            </div>

            {/* Time Slot Picker for ALL booking types */}
            {selectedDate && (() => {
              const dynamicSlots = getDynamicSlots(selectedDate);
              const closed = isDayClosed(selectedDate);
              const morningSlots = dynamicSlots.filter((t) => parseInt(t.split(":")[0]) < 12);
              const afternoonSlots = dynamicSlots.filter((t) => parseInt(t.split(":")[0]) >= 12);

              if (closed) {
                return (
                  <div style={{ padding: 24, backgroundColor: "#fef2f2", borderRadius: 12, border: "1px solid #fecaca", textAlign: "center", marginBottom: 20 }}>
                    <div style={{ fontSize: "2rem", marginBottom: 8 }}>🚫</div>
                    <h4 style={{ color: "#991b1b", marginBottom: 4 }}>Center Closed on This Day</h4>
                    <p style={{ color: "#b91c1c", fontSize: "0.85rem" }}>The diagnostic center is not open on this day. Please select a different date.</p>
                  </div>
                );
              }

              if (dynamicSlots.length === 0) {
                return (
                  <div style={{ padding: 24, backgroundColor: "#fffbeb", borderRadius: 12, border: "1px solid #fde68a", textAlign: "center", marginBottom: 20 }}>
                    <div style={{ fontSize: "2rem", marginBottom: 8 }}>⏰</div>
                    <h4 style={{ color: "#92400e", marginBottom: 4 }}>No Time Slots Available</h4>
                    <p style={{ color: "#a16207", fontSize: "0.85rem" }}>No available slots for this date. The center may not have set their operating hours yet.</p>
                  </div>
                );
              }

              return (
                <>
                  <h4 style={{ fontSize: "0.9rem", marginBottom: 12, color: "#4a5568" }}>Available Time Slots</h4>
                  {selectedOrg?.timings?.length > 0 && (
                    <div style={{ fontSize: "0.75rem", color: "#059669", marginBottom: 12, padding: "6px 12px", backgroundColor: "#ecfdf5", borderRadius: 8, display: "inline-block" }}>
                      ⏰ Operating Hours: {selectedOrg.timings.find((t: any) => t.day_of_week === new Date(selectedDate + "T00:00:00").getDay())?.open_time || "N/A"} – {selectedOrg.timings.find((t: any) => t.day_of_week === new Date(selectedDate + "T00:00:00").getDay())?.close_time || "N/A"}
                    </div>
                  )}
                  
                  {/* Morning slots */}
                  {morningSlots.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: "0.75rem", color: "#718096", marginBottom: 8, fontWeight: 600 }}>☀️ Morning Slots</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 8 }}>
                        {morningSlots.map((t) => {
                          const booked = isSlotBooked(t);
                          const isSelected = selectedSlot === t;
                          return (
                            <div
                              key={t}
                              style={{
                                padding: "8px 4px",
                                borderRadius: 8,
                                textAlign: "center",
                                cursor: booked ? "not-allowed" : "pointer",
                                fontSize: "0.82rem",
                                fontWeight: 600,
                                border: isSelected ? "2px solid #0284c7" : "2px solid #cbd5e1",
                                backgroundColor: booked ? "#fee2e2" : isSelected ? "#0284c7" : "white",
                                color: booked ? "#e53e3e" : isSelected ? "white" : "#4a5568",
                                transition: "all 0.15s ease",
                              }}
                              onClick={() => {
                                if (!booked) {
                                  setSelectedSlot(t);
                                  setError("");
                                }
                              }}
                            >
                              {formatSlotLabel(t)}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Afternoon/Evening slots */}
                  {afternoonSlots.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: "0.75rem", color: "#718096", marginBottom: 8, fontWeight: 600 }}>🌇 Afternoon & Evening Slots</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 8 }}>
                        {afternoonSlots.map((t) => {
                          const booked = isSlotBooked(t);
                          const isSelected = selectedSlot === t;
                          return (
                            <div
                              key={t}
                              style={{
                                padding: "8px 4px",
                                borderRadius: 8,
                                textAlign: "center",
                                cursor: booked ? "not-allowed" : "pointer",
                                fontSize: "0.82rem",
                                fontWeight: 600,
                                border: isSelected ? "2px solid #0284c7" : "2px solid #cbd5e1",
                                backgroundColor: booked ? "#fee2e2" : isSelected ? "#0284c7" : "white",
                                color: booked ? "#e53e3e" : isSelected ? "white" : "#4a5568",
                                transition: "all 0.15s ease",
                              }}
                              onClick={() => {
                                if (!booked) {
                                  setSelectedSlot(t);
                                  setError("");
                                }
                              }}
                            >
                              {formatSlotLabel(t)}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}

            {/* Total Fee & Summary */}
            {selectedDate && selectedSlot && (
              <div style={{ padding: 16, backgroundColor: "#f0fdf4", borderRadius: 12, border: "1px solid #bbf7d0", marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 700, color: "#166534" }}>
                      📅 {selectedDate} at {formatSlotLabel(selectedSlot)}
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "#15803d", marginTop: 2 }}>
                      {bookingType === "lab" ? `${selectedTests.length} Lab Test(s) Selected` : selectedDoctor ? selectedDoctor.name : "Appointment"}
                    </div>
                  </div>
                  <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#15803d" }}>₹{fee}</div>
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 12 }}>
              <button className="btn btn-secondary" onClick={() => setStep(3)}>← Back</button>
              <button
                className="btn btn-primary"
                style={{ flex: 1, borderRadius: 10, backgroundColor: "#0284c7" }}
                disabled={!selectedDate || !selectedSlot || loading}
                onClick={handleConfirm}
              >
                {loading ? "Confirming Appointment..." : `Confirm Booking & Pay ₹${fee}`}
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 5: On-Demand Dispatch Confirmation ─── */}
        {step === 5 && isOnDemand && (
          <div className="card" style={{ padding: 32 }}>
            <h3 style={{ fontSize: "1.05rem", marginBottom: 6, color: "#1a2b4a" }}>
              {bookingType === "home_collection" ? "🩸 Confirm Home Sample Collection" : "🏠 Confirm Home Visit"}
            </h3>
            <p style={{ fontSize: "0.85rem", color: "#64748b", marginBottom: 20 }}>A verified healthcare provider will be dispatched to your location.</p>

            <div style={{ padding: 16, backgroundColor: "#f8fafc", borderRadius: 10, border: "1px solid #cbd5e1", marginBottom: 20 }}>
              <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>📍 Location: {dispatchAddress}</div>
              <div style={{ fontWeight: 800, color: "#059669", fontSize: "1.1rem" }}>Total: ₹{fee}</div>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button className="btn btn-secondary" onClick={() => setStep(2)}>← Back</button>
              <button
                className="btn btn-primary"
                style={{ flex: 1, borderRadius: 10, backgroundColor: "#059669" }}
                disabled={loading}
                onClick={handleDispatchNow}
              >
                {loading ? "Dispatching..." : "⚡ Confirm & Dispatch Now"}
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 10: Confirmation Screen ─── */}
        {step === 10 && bookingResult && (
          <div className="card" style={{ padding: 40, textAlign: "center" }}>
            <div style={{ fontSize: "3rem", marginBottom: 12 }}>🎉</div>
            <h3 style={{ fontSize: "1.4rem", color: "#0f172a", fontWeight: 800, marginBottom: 8 }}>Booking Confirmed Successfully!</h3>
            <p style={{ fontSize: "0.9rem", color: "#64748b", marginBottom: 24 }}>Your appointment has been registered on CallMedex.</p>

            <div style={{ backgroundColor: "#f8fafc", padding: 20, borderRadius: 12, border: "1px solid #e2e8f0", textAlign: "left", marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ color: "#64748b" }}>Booking Reference</span>
                <span style={{ fontWeight: 700, color: "#0f172a" }}>#{bookingResult.id?.substring(0, 8) || "CMD-8921"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ color: "#64748b" }}>Date & Time</span>
                <span style={{ fontWeight: 700, color: "#0f172a" }}>{selectedDate || "Today"} at {formatSlotLabel(selectedSlot || "09:00")}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748b" }}>Amount Paid</span>
                <span style={{ fontWeight: 800, color: "#059669" }}>₹{fee}</span>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <a href="/dashboard/patient" className="btn btn-primary" style={{ borderRadius: 10, backgroundColor: "#0284c7" }}>
                Go to Patient Dashboard
              </a>
              <button
                className="btn btn-secondary"
                style={{ borderRadius: 10 }}
                onClick={() => {
                  setStep(1);
                  setBookingType("");
                  setSelectedOrg(null);
                  setSelectedDoctor(null);
                  setSelectedTest(null);
                  setSelectedTests([]);
                  setSelectedDate("");
                  setSelectedSlot("");
                  setError("");
                }}
              >
                Book Another
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function BookingPage() {
  return (
    <Suspense fallback={<div className="section" style={{ textAlign: "center", padding: 60 }}>Loading...</div>}>
      <BookingPageContent />
    </Suspense>
  );
}
