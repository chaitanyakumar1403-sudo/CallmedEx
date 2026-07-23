"use client";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

// ─── Rich Demo Data: Clinics, Polyclinics, Hospitals, Diagnostics ───────────

const ORGANIZATIONS = [
  // Clinics (single-location, small team)
  {
    id: "clinic-1", name: "Dr. Ramesh's Clinic", type: "clinic",
    address: "Dwaraka Nagar, Visakhapatnam", rating: 4.9,
    specializations: ["General Medicine", "Diabetes Care"],
    doctors: [
      { id: "doc-1", name: "Dr. Ramesh Kumar", specialization: "General Medicine", fee: 300 },
    ],
  },
  {
    id: "clinic-2", name: "Smile Dental Clinic", type: "clinic",
    address: "Seethammadhara, Visakhapatnam", rating: 4.7,
    specializations: ["Dentistry"],
    doctors: [
      { id: "doc-2", name: "Dr. Anitha Reddy", specialization: "Dentistry", fee: 500 },
    ],
  },
  // Polyclinics (multiple branches)
  {
    id: "poly-1", name: "MedPlus Polyclinic", type: "polyclinic",
    branches: [
      { id: "branch-1", name: "MVP Colony Branch", address: "MVP Colony, Vizag" },
      { id: "branch-2", name: "Gajuwaka Branch", address: "Gajuwaka, Vizag" },
    ],
    rating: 4.5,
    specializations: ["General Medicine", "Pediatrics", "Gynecology", "ENT"],
    doctors: [
      { id: "doc-3", name: "Dr. Priya Sharma", specialization: "General Medicine", fee: 400, branchId: "branch-1" },
      { id: "doc-4", name: "Dr. Suresh Babu", specialization: "Pediatrics", fee: 350, branchId: "branch-1" },
      { id: "doc-5", name: "Dr. Lakshmi Devi", specialization: "Gynecology", fee: 500, branchId: "branch-2" },
      { id: "doc-6", name: "Dr. Ravi Teja", specialization: "ENT", fee: 400, branchId: "branch-2" },
    ],
  },
  // Hospitals (departments, OPD)
  {
    id: "hosp-1", name: "KIMS Hospital", type: "hospital",
    address: "Waltair Main Road, Visakhapatnam", rating: 4.8,
    departments: ["Cardiology", "Orthopedics", "Neurology", "General Surgery", "Dermatology"],
    doctors: [
      { id: "doc-7", name: "Dr. Venkat Rao", specialization: "Cardiology", fee: 800 },
      { id: "doc-8", name: "Dr. Srinivas Murthy", specialization: "Orthopedics", fee: 700 },
      { id: "doc-9", name: "Dr. Padma Kumari", specialization: "Neurology", fee: 900 },
      { id: "doc-10", name: "Dr. Anil Kumar", specialization: "General Surgery", fee: 600 },
    ],
  },
  {
    id: "hosp-2", name: "Care Hospitals", type: "hospital",
    address: "Ramnagar, Visakhapatnam", rating: 4.6,
    departments: ["Cardiology", "Pulmonology", "Gastroenterology"],
    doctors: [
      { id: "doc-11", name: "Dr. Rajesh Gupta", specialization: "Cardiology", fee: 750 },
      { id: "doc-12", name: "Dr. Meena Iyer", specialization: "Pulmonology", fee: 650 },
    ],
  },
  // Diagnostic Centers (test catalogs)
  {
    id: "diag-1", name: "Vizag Diagnostics Center", type: "diagnostic",
    address: "Dwaraka Nagar, Visakhapatnam", rating: 4.8,
    tests: [
      { name: "Complete Blood Count (CBC)", price: 250 },
      { name: "Lipid Profile", price: 400 },
      { name: "Thyroid Profile (T3/T4/TSH)", price: 550 },
      { name: "HbA1c (Diabetes)", price: 350 },
      { name: "Liver Function Test (LFT)", price: 450 },
      { name: "Kidney Function Test (KFT)", price: 400 },
      { name: "Vitamin D", price: 600 },
      { name: "Vitamin B12", price: 500 },
    ],
    packages: [
      { name: "Basic Health Checkup", price: 799, tests: ["CBC", "Blood Sugar", "Lipid Profile", "Thyroid", "LFT", "KFT"] },
      { name: "Comprehensive Wellness Panel", price: 1999, tests: ["CBC", "HbA1c", "Lipid Profile", "Thyroid", "LFT", "KFT", "Vitamin D", "B12", "Iron", "ECG"] },
    ],
  },
  {
    id: "diag-2", name: "Apollo Diagnostics", type: "diagnostic",
    address: "MVP Colony, Visakhapatnam", rating: 4.6,
    tests: [
      { name: "Complete Blood Count (CBC)", price: 200 },
      { name: "Blood Sugar (Fasting)", price: 100 },
      { name: "ECG", price: 300 },
      { name: "X-Ray Chest", price: 500 },
      { name: "Urine Routine", price: 150 },
    ],
    packages: [
      { name: "Cardiac Risk Assessment", price: 2499, tests: ["Lipid Advanced", "hs-CRP", "Homocysteine", "ECG", "Troponin T"] },
    ],
  },
];

// Independent doctors (Urban Company model — home visits)
const INDEPENDENT_DOCTORS = [
  { id: "indep-1", name: "Dr. Kavya Prasad", specialization: "General Medicine", fee: 500, rating: 4.9, homeVisit: true, area: "Visakhapatnam" },
  { id: "indep-2", name: "Dr. Bharat Singh", specialization: "Physiotherapy", fee: 600, rating: 4.7, homeVisit: true, area: "Visakhapatnam" },
  { id: "indep-3", name: "Dr. Sneha Rao", specialization: "Pediatrics", fee: 550, rating: 4.8, homeVisit: true, area: "Visakhapatnam" },
];

// Video consultation doctors
const VIDEO_DOCTORS = [
  { id: "vid-1", name: "Dr. Priya Sharma", specialization: "General Medicine", fee: 499, rating: 4.9, languages: ["English", "Hindi", "Telugu"] },
  { id: "vid-2", name: "Dr. Rajesh Kumar", specialization: "Cardiology", fee: 799, rating: 4.8, languages: ["English", "Hindi"] },
  { id: "vid-3", name: "Dr. Ananya Reddy", specialization: "Dermatology", fee: 599, rating: 4.7, languages: ["English", "Telugu"] },
  { id: "vid-4", name: "Dr. Mohammed Irfan", specialization: "Pediatrics", fee: 499, rating: 4.9, languages: ["English", "Hindi", "Urdu"] },
  { id: "vid-5", name: "Dr. Lakshmi Devi", specialization: "Gynecology", fee: 699, rating: 4.8, languages: ["English", "Telugu", "Hindi"] },
];

// Home collection tests
const HOME_COLLECTION_TESTS = [
  { id: "hc-1", name: "Complete Blood Count (CBC)", price: 300 },
  { id: "hc-2", name: "Blood Sugar (Fasting + PP)", price: 200 },
  { id: "hc-3", name: "Thyroid Profile", price: 600 },
  { id: "hc-4", name: "Lipid Profile", price: 450 },
  { id: "hc-5", name: "HbA1c (Diabetes Monitoring)", price: 400 },
  { id: "hc-6", name: "Vitamin D + B12 Panel", price: 800 },
  { id: "hc-7", name: "Full Body Checkup (Home)", price: 1499 },
];

// Generate 30-min time slots from 8 AM to 8 PM
const TIME_SLOTS = (() => {
  const slots: string[] = [];
  for (let h = 8; h <= 19; h++) {
    slots.push(`${h.toString().padStart(2, '0')}:00`);
    slots.push(`${h.toString().padStart(2, '0')}:30`);
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
  const [error, setError] = useState("");
  const [bookingResult, setBookingResult] = useState<any>(null);
  // On-demand dispatch fields
  const [dispatchAddress, setDispatchAddress] = useState("");

  // Multi-test toggle helper
  const toggleTest = (test: any) => {
    setSelectedTests(prev => {
      const exists = prev.find(t => t.name === test.name);
      if (exists) return prev.filter(t => t.name !== test.name);
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

  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return { value: d.toISOString().split("T")[0], label: d.toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" }) };
  });

  // Fetch existing bookings to block already-booked slots
  useEffect(() => {
    const fetchMyBookings = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/bookings/my`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success && data.data?.bookings) {
          const booked = data.data.bookings.map((b: any) => b.slot_id);
          setBookedSlots(booked);
        }
      } catch { /* ignore */ }
    };
    fetchMyBookings();
  }, [step]);

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
      const serviceType = bookingType === "doctor" || bookingType === "home_doctor"
        ? "doctor_appointment"
        : bookingType === "home_collection"
          ? "home_collection"
          : bookingType === "video_consult"
            ? "video_consult"
            : bookingType === "nurse_visit"
              ? "nurse_visit"
              : "lab_test";

      const isDiagnostic = bookingType === "lab";
      const slotKey = isDiagnostic
        ? `${providerId}|${selectedDate}|pending`
        : `${providerId}|${selectedDate}|${selectedSlot}`;

      // Build notes with all selected tests if multi-select
      const testNotes = selectedTests.length > 0
        ? `Tests: ${selectedTests.map(t => t.name).join(", ")} | Total: ₹${multiTestTotal}`
        : selectedTest ? `Test: ${selectedTest.name}` : "";

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          provider_id: providerId,
          provider_type: providerType,
          service_type: serviceType,
          slot_id: slotKey,
          notes: selectedDoctor ? `Doctor: ${selectedDoctor.name}` : testNotes,
          selected_tests: selectedTests.length > 0 ? selectedTests.map(t => t.name) : undefined,
          total_price: selectedTests.length > 0 ? multiTestTotal : (selectedTest?.price || selectedDoctor?.fee || 0),
          ...(isDiagnostic ? { preferred_date: selectedDate } : {})
        })
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
        setError("You must be logged in. Please log in first.");
        setLoading(false);
        return;
      }
      if (!dispatchAddress.trim()) {
        setError("Please enter your full address.");
        setLoading(false);
        return;
      }

      // Use a default location for demo — in production, use browser geolocation
      const lat = 17.7231;
      const lng = 83.3013;

      const providerTypeStr = bookingType === "home_collection" ? "phlebotomist" : bookingType === "nurse_visit" ? "nurse" : "doctor";
      const serviceTypeStr = bookingType === "home_collection" ? "home_collection" : bookingType === "nurse_visit" ? "nurse_visit" : "doctor_appointment";
      const dispatchNotes = selectedTests.length > 0
        ? `Tests: ${selectedTests.map(t => t.name).join(", ")} | Total: ₹${multiTestTotal}`
        : selectedTest ? `Test: ${selectedTest.name}` : selectedDoctor ? `Doctor: ${selectedDoctor.name}` : "";

      // 1. Create a Booking so it appears in Patient Dashboard (Upcoming Appointments)
      let createdBookingId = null;
      try {
        const now = new Date();
        const yyyymmdd = now.toISOString().split("T")[0];
        const hhmm = now.toTimeString().split(" ")[0].substring(0, 5); // local time HH:MM
        
        const bookingRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/bookings`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({
            provider_id: "on_demand",
            provider_type: providerTypeStr,
            service_type: serviceTypeStr,
            slot_id: `on_demand|${yyyymmdd}|${hhmm}`,
            notes: `Urgent On-Demand: ${dispatchNotes}`,
            selected_tests: selectedTests.length > 0 ? selectedTests.map(t => t.name) : undefined,
            total_price: selectedTests.length > 0 ? multiTestTotal : (selectedTest?.price || selectedDoctor?.fee || 0)
          })
        });
        if (bookingRes.ok) {
          const bData = await bookingRes.json();
          createdBookingId = bData.data?.id;
        }
      } catch (e) {
        console.warn("Failed to log booking, proceeding with dispatch", e);
      }

      // 2. Request Dispatch
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/dispatch/request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          patient_lat: lat,
          patient_lng: lng,
          patient_address: dispatchAddress,
          provider_type: providerTypeStr,
          service_subtype: serviceTypeStr,
          notes: dispatchNotes,
          booking_id: createdBookingId
        })
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

  const [realOrgs, setRealOrgs] = useState<any[]>([]);
  useEffect(() => {
    if (step === 2 && realOrgs.length === 0) {
      fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/providers/search/organizations`)
        .then(r => r.json())
        .then(data => { if (data.success) setRealOrgs(data.organizations || []); })
        .catch(console.error);
    }
  }, [step, realOrgs.length]);

  useEffect(() => {
    if (selectedOrg?.isReal && !selectedOrg.fetchedDetails) {
      fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/bookings/org-services/${selectedOrg.id}`)
        .then(r => r.json())
        .then(data => {
          if (data.success) {
            setSelectedOrg({
              ...selectedOrg,
              fetchedDetails: true,
              tests: data.services?.filter((s: any) => ["lab_test", "imaging"].includes(s.service_type)) || [],
              packages: data.packages || [],
              doctors: data.doctors || [],
            });
          }
        })
        .catch(console.error);
    }
  }, [selectedOrg]);

  const getFilteredOrgs = (type: string) => {
    const combined = [...realOrgs.map(o => ({ ...o, isReal: true, type: o.type || "clinic" })), ...ORGANIZATIONS];
    return combined.filter(o => {
      if (type === "doctor") return ["clinic", "polyclinic", "hospital"].includes(o.type);
      if (type === "lab") return o.type === "diagnostic" || o.type === "laboratory";
      return false;
    }).filter(o =>
      !searchQuery || 
      o.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o as any).doctors?.some((d: any) => d.name.toLowerCase().includes(searchQuery.toLowerCase()) || d.specialization.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (o as any).tests?.some((t: any) => t.name.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  };

  const getOrgTypeBadge = (type: string) => {
    const map: Record<string, { label: string; color: string }> = {
      clinic: { label: "Clinic", color: "#3182ce" },
      polyclinic: { label: "Polyclinic", color: "#805ad5" },
      hospital: { label: "Hospital", color: "#e53e3e" },
      diagnostic: { label: "Diagnostic Center", color: "#38a169" },
    };
    const v = map[type] || { label: type, color: "#718096" };
    return <span style={{ fontSize: '0.7rem', backgroundColor: v.color, color: 'white', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>{v.label}</span>;
  };

  const isOnDemand = bookingType === "home_collection" || bookingType === "home_doctor" || bookingType === "nurse_visit";
  const fee = selectedDoctor?.fee || (selectedTests.length > 0 ? multiTestTotal : selectedTest?.price) || 0;

  // Step indicator
  const getSteps = () => {
    if (bookingType === "nurse_visit") return ["Select Service", "Choose Care Type", "Enter Address"];
    if (isOnDemand) return ["Select Service", "Choose Item", "Enter Address"];
    if (bookingType === "video_consult") return ["Select Service", "Choose Doctor", "Date & Time"];
    if (bookingType === "doctor") return ["Select Service", "Find Provider", "Choose Doctor", "Date & Time"];
    if (bookingType === "lab") return ["Select Service", "Find Center", "Choose Tests", "Select Date"];
    return [];
  };
  const currentStepIdx = step === 10 ? -1 : isOnDemand ? (step <= 2 ? step - 1 : 2) : Math.min(step - 1, getSteps().length - 1);

  return (
    <div className="section" style={{ background: "var(--color-gray-50)", minHeight: '80vh' }}>
      <div className="container" style={{ maxWidth: 800 }}>
        <h2 style={{ marginBottom: 4 }}>Book an Appointment</h2>
        <p style={{ color: "var(--color-gray-500)", marginBottom: 24, fontSize: '0.9rem' }}>Search doctors, clinics, hospitals, diagnostic centers — book instantly</p>

        {/* Step Progress Indicator */}
        {step !== 10 && getSteps().length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 32 }}>
            {getSteps().map((label, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < getSteps().length - 1 ? 1 : 'none' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 60 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.8rem', fontWeight: 700,
                    backgroundColor: i <= currentStepIdx ? '#1a2b4a' : '#e2e8f0',
                    color: i <= currentStepIdx ? 'white' : '#a0aec0',
                    transition: 'all 0.3s',
                  }}>
                    {i < currentStepIdx ? '✓' : i + 1}
                  </div>
                  <span style={{ fontSize: '0.65rem', color: i <= currentStepIdx ? '#1a2b4a' : '#a0aec0', marginTop: 4, textAlign: 'center', fontWeight: i === currentStepIdx ? 700 : 400 }}>{label}</span>
                </div>
                {i < getSteps().length - 1 && (
                  <div style={{ flex: 1, height: 2, backgroundColor: i < currentStepIdx ? '#1a2b4a' : '#e2e8f0', transition: 'all 0.3s', margin: '0 4px', marginBottom: 18 }}></div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div style={{ padding: "12px 20px", backgroundColor: "#fed7d7", color: "#9b2c2c", borderRadius: 8, marginBottom: 16, fontWeight: 600, textAlign: "center", fontSize: '0.9rem' }}>
            ⚠️ {error}
          </div>
        )}

        {/* ─── STEP 1: Choose What To Book ─── */}
        {step === 1 && (
          <div className="card" style={{ padding: 32 }}>
            <h3 style={{ fontSize: "1.05rem", marginBottom: 20, color: '#1a2b4a' }}>What would you like to book?</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              {[
                { key: "doctor", icon: "🩺", label: "Doctor Appointment", desc: "Clinic, Polyclinic, or Hospital", color: "#3182ce" },
                { key: "lab", icon: "🔬", label: "Lab Test / Diagnostics", desc: "Blood tests, imaging, packages", color: "#38a169" },
                { key: "video_consult", icon: "📹", label: "Video Consultation", desc: "HD video call with doctor", color: "#805ad5" },
                { key: "home_doctor", icon: "🏠", label: "Doctor Home Visit", desc: "Doctor comes to your home", color: "#dd6b20" },
                { key: "home_collection", icon: "🩸", label: "Home Sample Collection", desc: "Phlebotomist at your doorstep", color: "#e53e3e" },
                { key: "nurse_visit", icon: "👩‍⚕️", label: "Nurse Home Visit", desc: "Wound care, injections, elderly care at home", color: "#ec4899" },
              ].map(item => (
                <div key={item.key}
                  style={{
                    padding: 20, cursor: "pointer", textAlign: "center",
                    border: bookingType === item.key ? `2px solid ${item.color}` : "2px solid #e2e8f0",
                    borderRadius: 12,
                    backgroundColor: bookingType === item.key ? `${item.color}08` : 'white',
                    transition: 'all 0.25s ease',
                    boxShadow: bookingType === item.key ? `0 4px 12px ${item.color}25` : '0 1px 3px rgba(0,0,0,0.05)',
                  }}
                  onClick={() => { setBookingType(item.key); setError(""); }}
                  onMouseEnter={(e) => { if (bookingType !== item.key) (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
                >
                  <div style={{ fontSize: "2.2rem", marginBottom: 10 }}>{item.icon}</div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#1a2b4a' }}>{item.label}</div>
                  <div style={{ fontSize: '0.75rem', color: '#718096', marginTop: 4 }}>{item.desc}</div>
                </div>
              ))}
            </div>
            <button className="btn btn-primary btn-full" style={{ marginTop: 24, borderRadius: 10, padding: '12px 0' }} disabled={!bookingType} onClick={() => setStep(2)}>
              Continue →
            </button>
          </div>
        )}

        {/* ─── STEP 2: Select Provider (doctor/lab) ─── */}
        {step === 2 && (bookingType === "doctor" || bookingType === "lab") && (
          <div className="card" style={{ padding: 32 }}>
            <h3 style={{ fontSize: "1.05rem", marginBottom: 16, color: '#1a2b4a' }}>
              {bookingType === "doctor" ? "Find a Doctor or Hospital" : "Find a Diagnostic Center"}
            </h3>
            <input
              type="text" placeholder={bookingType === "doctor" ? "Search by doctor name, specialization, hospital..." : "Search by test name, center..."}
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: '1px solid #e2e8f0', marginBottom: 16, fontSize: '0.92rem', outline: 'none' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 400, overflowY: 'auto' }}>
              {getFilteredOrgs(bookingType).map(org => (
                <div key={org.id}
                  style={{
                    padding: 16, cursor: 'pointer', borderRadius: 10,
                    border: selectedOrg?.id === org.id ? '2px solid #1a2b4a' : '2px solid #e2e8f0',
                    backgroundColor: selectedOrg?.id === org.id ? '#f7fafc' : 'white',
                    transition: 'all 0.2s',
                  }}
                  onClick={() => { setSelectedOrg(org); setError(""); }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ fontWeight: 700, color: '#1a2b4a' }}>
                      {org.name} {org.isReal && <span style={{fontSize: "0.8rem", color: "#16a34a"}}>✅ Verified</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {getOrgTypeBadge(org.type)}
                      <span style={{ fontSize: '0.85rem' }}>⭐ {org.rating || "5.0"}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#718096' }}>{org.address || (org as any).branches?.[0]?.address}</div>
                  {org.type === 'diagnostic' && (
                    <div style={{ fontSize: '0.78rem', color: '#38a169', marginTop: 4 }}>
                      {(org as any).tests?.length} tests available · {(org as any).packages?.length} packages
                    </div>
                  )}
                  {(org as any).doctors && (
                    <div style={{ fontSize: '0.78rem', color: '#3182ce', marginTop: 4 }}>
                      {(org as any).doctors.length} doctors · {(org as any).specializations?.join(", ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={() => { setStep(1); setSelectedOrg(null); setSearchQuery(""); }}>← Back</button>
              <button className="btn btn-primary" style={{ flex: 1, borderRadius: 10 }} disabled={!selectedOrg} onClick={() => setStep(3)}>Continue →</button>
            </div>
          </div>
        )}

        {/* ─── STEP 2 (video_consult): Select Doctor for Video Call ─── */}
        {step === 2 && bookingType === "video_consult" && (
          <div className="card" style={{ padding: 32 }}>
            <h3 style={{ fontSize: "1.05rem", marginBottom: 16, color: '#1a2b4a' }}>Choose a Doctor for Video Consultation</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {VIDEO_DOCTORS.map(doc => (
                <div key={doc.id}
                  style={{
                    padding: 16, cursor: 'pointer', borderRadius: 10,
                    border: selectedDoctor?.id === doc.id ? '2px solid #805ad5' : '2px solid #e2e8f0',
                    backgroundColor: selectedDoctor?.id === doc.id ? '#faf5ff' : 'white',
                    transition: 'all 0.2s',
                  }}
                  onClick={() => { setSelectedDoctor(doc); setError(""); }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#1a2b4a' }}>{doc.name}</div>
                      <div style={{ fontSize: '0.82rem', color: '#718096' }}>{doc.specialization}</div>
                      <div style={{ fontSize: '0.75rem', color: '#a0aec0', marginTop: 2 }}>🌐 {doc.languages.join(", ")}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: '#2f855a', fontSize: '1.1rem' }}>₹{doc.fee}</div>
                      <div style={{ fontSize: '0.82rem' }}>⭐ {doc.rating}</div>
                      <span style={{ fontSize: '0.65rem', backgroundColor: '#805ad5', color: 'white', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>📹 Video</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={() => { setStep(1); setSelectedDoctor(null); }}>← Back</button>
              <button className="btn btn-primary" style={{ flex: 1, borderRadius: 10 }} disabled={!selectedDoctor} onClick={() => setStep(4)}>Select Date & Time →</button>
            </div>
          </div>
        )}

        {/* ─── STEP 2 (home_doctor): Select Independent Doctor ─── */}
        {step === 2 && bookingType === "home_doctor" && (
          <div className="card" style={{ padding: 32 }}>
            <h3 style={{ fontSize: "1.05rem", marginBottom: 16, color: '#1a2b4a' }}>Select a Doctor for Home Visit</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {INDEPENDENT_DOCTORS.map(doc => (
                <div key={doc.id}
                  style={{
                    padding: 16, cursor: 'pointer', borderRadius: 10,
                    border: selectedDoctor?.id === doc.id ? '2px solid #dd6b20' : '2px solid #e2e8f0',
                    backgroundColor: selectedDoctor?.id === doc.id ? '#fffaf0' : 'white',
                    transition: 'all 0.2s',
                  }}
                  onClick={() => { setSelectedDoctor(doc); setError(""); }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#1a2b4a' }}>{doc.name}</div>
                      <div style={{ fontSize: '0.85rem', color: '#718096' }}>{doc.specialization} · Home Visit</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: '#2f855a' }}>₹{doc.fee}</div>
                      <div style={{ fontSize: '0.82rem' }}>⭐ {doc.rating}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={() => { setStep(1); setSelectedDoctor(null); }}>← Back</button>
              <button className="btn btn-primary" style={{ flex: 1, borderRadius: 10 }} disabled={!selectedDoctor} onClick={() => setStep(5)}>Enter Address →</button>
            </div>
          </div>
        )}

        {/* ─── STEP 2 (home_collection): Select tests for home collection (multi-select) ─── */}
        {step === 2 && bookingType === "home_collection" && (
          <div className="card" style={{ padding: 32 }}>
            <h3 style={{ fontSize: "1.05rem", marginBottom: 6, color: '#1a2b4a' }}>Select Tests for Home Collection</h3>
            <p style={{ fontSize: '0.82rem', color: '#718096', marginBottom: 16 }}>A phlebotomist will arrive at your doorstep — select multiple tests! 🩸</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {HOME_COLLECTION_TESTS.map(test => {
                const isSelected = selectedTests.some(t => t.name === test.name);
                return (
                  <div key={test.id}
                    style={{
                      padding: 14, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      borderRadius: 10,
                      border: isSelected ? '2px solid #e53e3e' : '2px solid #e2e8f0',
                      backgroundColor: isSelected ? '#fff5f5' : 'white',
                      transition: 'all 0.2s',
                    }}
                    onClick={() => { toggleTest(test); setSelectedOrg({ id: 'home-collection', name: 'Home Collection Service' }); }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: 4, border: isSelected ? '2px solid #e53e3e' : '2px solid #cbd5e0',
                        backgroundColor: isSelected ? '#e53e3e' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.75rem', color: 'white', fontWeight: 700, transition: 'all 0.15s',
                      }}>{isSelected ? '✓' : ''}</div>
                      <div style={{ fontWeight: 600, color: '#1a2b4a' }}>{test.name}</div>
                    </div>
                    <div style={{ fontWeight: 700, color: '#2f855a' }}>₹{test.price}</div>
                  </div>
                );
              })}
            </div>
            {/* Running total */}
            {selectedTests.length > 0 && (
              <div style={{ marginTop: 16, padding: 14, backgroundColor: '#f0fff4', borderRadius: 10, border: '1px solid #c6f6d5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, color: '#1a2b4a', fontSize: '0.9rem' }}>{selectedTests.length} test{selectedTests.length > 1 ? 's' : ''} selected</div>
                  <div style={{ fontSize: '0.75rem', color: '#718096' }}>{selectedTests.map(t => t.name).join(', ')}</div>
                </div>
                <div style={{ fontWeight: 800, color: '#2f855a', fontSize: '1.2rem' }}>₹{multiTestTotal}</div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={() => { setStep(1); setSelectedTests([]); }}>← Back</button>
              <button className="btn btn-primary" style={{ flex: 1, borderRadius: 10 }} disabled={selectedTests.length === 0} onClick={() => setStep(5)}>Enter Address →</button>
            </div>
          </div>
        )}

        {/* ─── STEP 2 (nurse_visit): Select Nursing Service ─── */}
        {step === 2 && bookingType === "nurse_visit" && (
          <div className="card" style={{ padding: 32 }}>
            <h3 style={{ fontSize: "1.05rem", marginBottom: 6, color: '#1a2b4a' }}>👩‍⚕️ Select Nursing Service</h3>
            <p style={{ fontSize: '0.82rem', color: '#718096', marginBottom: 16 }}>Choose the type of nursing care you need at home</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              {[
                { id: 'wound_dressing', name: 'Wound Dressing', icon: '🩹', desc: 'Post-surgical or injury wound care', duration: '30–60 min', price: 400 },
                { id: 'injection', name: 'Injection', icon: '💉', desc: 'IM, IV, or subcutaneous injections', duration: '15–30 min', price: 200 },
                { id: 'iv_infusion', name: 'IV Infusion', icon: '💧', desc: 'IV drip setup and monitoring', duration: '1–3 hours', price: 800 },
                { id: 'post_operative', name: 'Post-Op Care', icon: '🏥', desc: 'Post-surgery recovery assistance', duration: '2–4 hours', price: 1200 },
                { id: 'catheter_care', name: 'Catheter Care', icon: '🧴', desc: 'Urinary catheter management', duration: '30–60 min', price: 500 },
                { id: 'elderly_care', name: 'Elderly Care', icon: '👵', desc: 'Companion care, medication mgmt', duration: '4–8 hours', price: 1500 },
                { id: 'pediatric', name: 'Pediatric Care', icon: '👶', desc: 'Infant and child healthcare', duration: '1–4 hours', price: 700 },
                { id: 'general', name: 'General Nursing', icon: '👩‍⚕️', desc: 'Vitals, basic care, assessments', duration: '1–2 hours', price: 500 },
              ].map(service => {
                const isSelected = selectedTest?.id === service.id;
                return (
                  <div key={service.id}
                    style={{
                      padding: 16, cursor: 'pointer', borderRadius: 12, textAlign: 'center',
                      border: isSelected ? '2px solid #ec4899' : '2px solid #e2e8f0',
                      backgroundColor: isSelected ? '#fdf2f8' : 'white',
                      transition: 'all 0.2s',
                      boxShadow: isSelected ? '0 4px 12px rgba(236,72,153,0.2)' : '0 1px 3px rgba(0,0,0,0.05)',
                    }}
                    onClick={() => { setSelectedTest(service); setError(""); }}
                  >
                    <div style={{ fontSize: '1.8rem', marginBottom: 6 }}>{service.icon}</div>
                    <div style={{ fontWeight: 700, color: '#1a2b4a', fontSize: '0.88rem' }}>{service.name}</div>
                    <div style={{ fontSize: '0.72rem', color: '#718096', marginTop: 2 }}>{service.desc}</div>
                    <div style={{ fontSize: '0.72rem', color: '#a0aec0', marginTop: 4 }}>⏱ {service.duration}</div>
                    <div style={{ fontWeight: 700, color: '#2f855a', marginTop: 6, fontSize: '0.95rem' }}>₹{service.price}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={() => { setStep(1); setSelectedTest(null); }}>← Back</button>
              <button className="btn btn-primary" style={{ flex: 1, borderRadius: 10 }} disabled={!selectedTest} onClick={() => setStep(5)}>Enter Address →</button>
            </div>
          </div>
        )}

        {/* ─── STEP 3 (doctor flow): Select Doctor from Org ─── */}
        {step === 3 && bookingType === "doctor" && selectedOrg && (
          <div className="card" style={{ padding: 32 }}>
            <h3 style={{ fontSize: "1.05rem", marginBottom: 16, color: '#1a2b4a' }}>Select Doctor at {selectedOrg.name}</h3>

            {/* Branch selection for polyclinics */}
            {selectedOrg.type === "polyclinic" && selectedOrg.branches && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontWeight: 600, fontSize: '0.88rem', display: 'block', marginBottom: 8, color: '#4a5568' }}>Select Branch</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {selectedOrg.branches.map((b: any) => (
                    <div key={b.id}
                      style={{
                        padding: '10px 16px', borderRadius: 10, cursor: 'pointer', flex: 1, textAlign: 'center',
                        border: selectedBranch === b.id ? '2px solid #1a2b4a' : '2px solid #e2e8f0',
                        background: selectedBranch === b.id ? '#1a2b4a' : 'white',
                        color: selectedBranch === b.id ? 'white' : 'inherit',
                        transition: 'all 0.2s',
                      }}
                      onClick={() => { setSelectedBranch(b.id); setSelectedDoctor(null); }}
                    >
                      <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{b.name}</div>
                      <div style={{ fontSize: '0.72rem', opacity: 0.8 }}>{b.address}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Doctor list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(selectedOrg.doctors || [])
                .filter((d: any) => !selectedOrg.branches || !selectedBranch || d.branchId === selectedBranch)
                .map((doc: any) => (
                  <div key={doc.id}
                    style={{
                      padding: 14, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      borderRadius: 10,
                      border: selectedDoctor?.id === doc.id ? '2px solid #1a2b4a' : '2px solid #e2e8f0',
                      backgroundColor: selectedDoctor?.id === doc.id ? '#f7fafc' : 'white',
                      transition: 'all 0.2s',
                    }}
                    onClick={() => { setSelectedDoctor(doc); setError(""); }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, color: '#1a2b4a' }}>{doc.name}</div>
                      <div style={{ fontSize: '0.82rem', color: '#718096' }}>{doc.specialization}</div>
                    </div>
                    <div style={{ fontWeight: 700, color: '#2f855a' }}>₹{doc.fee}</div>
                  </div>
                ))}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={() => { setStep(2); setSelectedDoctor(null); setSelectedBranch(""); }}>← Back</button>
              <button className="btn btn-primary" style={{ flex: 1, borderRadius: 10 }} disabled={!selectedDoctor} onClick={() => setStep(4)}>Select Date & Time →</button>
            </div>
          </div>
        )}

        {/* ─── STEP 3 (lab flow): Select Tests/Packages from Diagnostic Center (MULTI-SELECT) ─── */}
        {step === 3 && bookingType === "lab" && selectedOrg && (
          <div className="card" style={{ padding: 32 }}>
            <h3 style={{ fontSize: "1.05rem", marginBottom: 16, color: '#1a2b4a' }}>Select Tests at {selectedOrg.name}</h3>
            <p style={{ fontSize: '0.82rem', color: '#718096', marginBottom: 16 }}>✅ Select multiple tests — click to add or remove</p>

            {(selectedOrg as any).packages?.length > 0 && (
              <>
                <h4 style={{ fontSize: '0.92rem', color: '#805ad5', marginBottom: 8 }}>📦 Health Packages</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {(selectedOrg as any).packages.map((pkg: any, i: number) => {
                    const isSelected = selectedTests.some(t => t.name === pkg.name);
                    return (
                      <div key={i}
                        style={{
                          padding: 14, cursor: 'pointer', borderRadius: 10,
                          border: isSelected ? '2px solid #805ad5' : '2px solid #e2e8f0',
                          backgroundColor: isSelected ? '#faf5ff' : 'white',
                          transition: 'all 0.2s',
                        }}
                        onClick={() => toggleTest(pkg)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{
                              width: 22, height: 22, borderRadius: 4, border: isSelected ? '2px solid #805ad5' : '2px solid #cbd5e0',
                              backgroundColor: isSelected ? '#805ad5' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.75rem', color: 'white', fontWeight: 700, transition: 'all 0.15s',
                            }}>{isSelected ? '✓' : ''}</div>
                            <div>
                              <div style={{ fontWeight: 700, color: '#1a2b4a' }}>{pkg.name}</div>
                              <div style={{ fontSize: '0.72rem', color: '#718096' }}>{pkg.tests.join(", ")}</div>
                            </div>
                          </div>
                          <div style={{ fontWeight: 700, color: '#2f855a' }}>₹{pkg.price}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <h4 style={{ fontSize: '0.92rem', color: '#3182ce', marginBottom: 8 }}>🔬 Individual Tests</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {((selectedOrg as any).tests || []).map((test: any, i: number) => {
                const isSelected = selectedTests.some(t => t.name === test.name);
                return (
                  <div key={i}
                    style={{
                      padding: 12, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      borderRadius: 10,
                      border: isSelected ? '2px solid #3182ce' : '2px solid #e2e8f0',
                      backgroundColor: isSelected ? '#ebf8ff' : 'white',
                      transition: 'all 0.2s',
                    }}
                    onClick={() => toggleTest(test)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: 4, border: isSelected ? '2px solid #3182ce' : '2px solid #cbd5e0',
                        backgroundColor: isSelected ? '#3182ce' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.75rem', color: 'white', fontWeight: 700, transition: 'all 0.15s',
                      }}>{isSelected ? '✓' : ''}</div>
                      <div style={{ fontWeight: 600, color: '#1a2b4a' }}>{test.name}</div>
                    </div>
                    <div style={{ fontWeight: 700, color: '#2f855a' }}>₹{test.price}</div>
                  </div>
                );
              })}
            </div>

            {/* Running total */}
            {selectedTests.length > 0 && (
              <div style={{ marginTop: 16, padding: 14, backgroundColor: '#f0fff4', borderRadius: 10, border: '1px solid #c6f6d5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, color: '#1a2b4a', fontSize: '0.9rem' }}>🛒 {selectedTests.length} item{selectedTests.length > 1 ? 's' : ''} selected</div>
                  <div style={{ fontSize: '0.75rem', color: '#718096', maxWidth: 300 }}>{selectedTests.map(t => t.name).join(', ')}</div>
                </div>
                <div style={{ fontWeight: 800, color: '#2f855a', fontSize: '1.2rem' }}>₹{multiTestTotal}</div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={() => { setStep(2); setSelectedTests([]); }}>← Back</button>
              <button className="btn btn-primary" style={{ flex: 1, borderRadius: 10 }} disabled={selectedTests.length === 0} onClick={() => setStep(4)}>Select Date & Time →</button>
            </div>
          </div>
        )}

        {/* ─── STEP 4: Select Date & Time Slot (for scheduled bookings only) ─── */}
        {step === 4 && (
          <div className="card" style={{ padding: 32 }}>
            <h3 style={{ fontSize: "1.05rem", marginBottom: 20, color: '#1a2b4a' }}>
              {bookingType === "lab" ? "Select Your Preferred Date" : "Select Date & Time"}
            </h3>

            {/* Diagnostic info banner */}
            {bookingType === "lab" && (
              <div style={{
                padding: '12px 16px', backgroundColor: '#eff6ff', borderRadius: 10,
                border: '1px solid #bfdbfe', marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 10,
              }}>
                <span style={{ fontSize: '1.2rem' }}>ℹ️</span>
                <div>
                  <div style={{ fontWeight: 600, color: '#1e40af', fontSize: '0.88rem' }}>How it works</div>
                  <div style={{ fontSize: '0.8rem', color: '#3b82f6', lineHeight: 1.5 }}>
                    Select your preferred date. The diagnostic centre will review your booking and allot a specific time slot.
                    You'll be notified in your dashboard to accept or decline the allotted time.
                  </div>
                </div>
              </div>
            )}

            {/* Date picker — horizontal scrollable cards */}
            <div style={{ display: "flex", gap: 8, marginBottom: 24, overflowX: "auto", paddingBottom: 4 }}>
              {dates.map((d) => {
                const parts = d.label.split(" ");
                const dayOfWeek = parts[0]?.replace(",", "");
                const dayNum = parts[parts.length - 1];
                const month = parts.length >= 3 ? parts[1]?.replace(",", "") : "";
                const isToday = d.value === dates[0].value;
                const isSelected = selectedDate === d.value;
                return (
                  <div key={d.value}
                    style={{
                      padding: "10px 14px", borderRadius: 12, textAlign: "center", cursor: "pointer", minWidth: 72,
                      border: isSelected ? "2px solid #1a2b4a" : "2px solid #e2e8f0",
                      background: isSelected ? "linear-gradient(135deg, #1a2b4a 0%, #2d4a7a 100%)" : "white",
                      color: isSelected ? "#fff" : "inherit",
                      transition: 'all 0.2s ease',
                      boxShadow: isSelected ? '0 4px 12px rgba(26,43,74,0.3)' : 'none',
                    }}
                    onClick={() => { setSelectedDate(d.value); setSelectedSlot(""); setError(""); }}
                  >
                    <div style={{ fontSize: "0.7rem", opacity: 0.8, fontWeight: 600, textTransform: 'uppercase' }}>{dayOfWeek}</div>
                    <div style={{ fontWeight: 800, fontSize: "1.2rem", margin: '2px 0' }}>{dayNum}</div>
                    <div style={{ fontSize: "0.65rem", opacity: 0.7 }}>{isToday ? "Today" : month}</div>
                  </div>
                );
              })}
            </div>

            {/* Time slots — only for NON-diagnostic bookings */}
            {selectedDate && bookingType !== "lab" && (
              <>
                <h4 style={{ fontSize: "0.9rem", marginBottom: 12, color: "#4a5568" }}>Available Slots</h4>
                {/* Morning slots */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: '0.75rem', color: '#718096', marginBottom: 8, fontWeight: 600 }}>☀️ Morning</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
                    {TIME_SLOTS.filter(t => parseInt(t.split(":")[0]) < 12).map((t) => {
                      const booked = isSlotBooked(t);
                      const isSelected = selectedSlot === t;
                      return (
                        <div key={t}
                          style={{
                            padding: '8px 4px', borderRadius: 8, textAlign: 'center', cursor: booked ? 'not-allowed' : 'pointer',
                            fontSize: '0.82rem', fontWeight: 600,
                            border: isSelected ? '2px solid #1a2b4a' : '2px solid #e2e8f0',
                            backgroundColor: booked ? '#fee2e2' : isSelected ? '#1a2b4a' : 'white',
                            color: booked ? '#e53e3e' : isSelected ? 'white' : '#4a5568',
                            opacity: booked ? 0.5 : 1,
                            textDecoration: booked ? 'line-through' : 'none',
                            transition: 'all 0.15s ease',
                          }}
                          onClick={() => { if (!booked) { setSelectedSlot(t); setError(""); } }}
                        >
                          {formatSlotLabel(t)}
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* Afternoon/Evening slots */}
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#718096', marginBottom: 8, fontWeight: 600 }}>🌇 Afternoon & Evening</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
                    {TIME_SLOTS.filter(t => parseInt(t.split(":")[0]) >= 12).map((t) => {
                      const booked = isSlotBooked(t);
                      const isSelected = selectedSlot === t;
                      return (
                        <div key={t}
                          style={{
                            padding: '8px 4px', borderRadius: 8, textAlign: 'center', cursor: booked ? 'not-allowed' : 'pointer',
                            fontSize: '0.82rem', fontWeight: 600,
                            border: isSelected ? '2px solid #1a2b4a' : '2px solid #e2e8f0',
                            backgroundColor: booked ? '#fee2e2' : isSelected ? '#1a2b4a' : 'white',
                            color: booked ? '#e53e3e' : isSelected ? 'white' : '#4a5568',
                            opacity: booked ? 0.5 : 1,
                            textDecoration: booked ? 'line-through' : 'none',
                            transition: 'all 0.15s ease',
                          }}
                          onClick={() => { if (!booked) { setSelectedSlot(t); setError(""); } }}
                        >
                          {formatSlotLabel(t)}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* Diagnostic: date-selected confirmation */}
            {selectedDate && bookingType === "lab" && (
              <div style={{ marginTop: 4, padding: 16, backgroundColor: '#f0fff4', borderRadius: 10, border: '1px solid #c6f6d5' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                  <span>🧪 Estimated Total</span>
                  <span style={{ color: '#2f855a', fontSize: '1.2rem' }}>₹{fee}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#718096', marginTop: 4 }}>
                  Payment will be collected after the centre confirms your time slot
                </div>
              </div>
            )}

            {/* Non-diagnostic: Payment Summary */}
            {bookingType !== "lab" && selectedSlot && fee > 0 && (
              <div style={{ marginTop: 20, padding: 16, backgroundColor: '#f0fff4', borderRadius: 10, border: '1px solid #c6f6d5' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                  <span>💳 Prepaid Amount</span>
                  <span style={{ color: '#2f855a', fontSize: '1.2rem' }}>₹{fee}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#718096', marginTop: 4 }}>Payment is required before booking confirmation</div>
              </div>
            )}

            <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => setStep(bookingType === "video_consult" ? 2 : 3)}>← Back</button>
              {bookingType === "lab" ? (
                <button className="btn btn-primary" style={{ flex: 1, borderRadius: 10, backgroundColor: '#38a169', borderColor: '#38a169' }}
                  disabled={!selectedDate || loading} onClick={handleConfirm}
                >
                  {loading ? "Submitting..." : "📋 Submit for Review"}
                </button>
              ) : (
                <button className="btn btn-primary" style={{ flex: 1, borderRadius: 10 }} disabled={!selectedSlot || loading} onClick={handleConfirm}>
                  {loading ? "Processing Payment & Booking..." : `Pay ₹${fee} & Confirm`}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ─── STEP 5: On-Demand Dispatch (home_collection / home_doctor / nurse_visit) ─── */}
        {step === 5 && isOnDemand && (
          <div className="card" style={{ padding: 32 }}>
            <h3 style={{ fontSize: "1.05rem", marginBottom: 6, color: '#1a2b4a' }}>
              {bookingType === "home_collection" ? "🩸 Confirm Home Sample Collection"
                : bookingType === "nurse_visit" ? "👩‍⚕️ Confirm Nurse Home Visit"
                : "🏠 Confirm Doctor Home Visit"}
            </h3>
            <p style={{ fontSize: '0.82rem', color: '#718096', marginBottom: 20 }}>
              {bookingType === "home_collection"
                ? "A verified phlebotomist will be dispatched to your location — just like ordering food on Swiggy!"
                : bookingType === "nurse_visit"
                  ? "A qualified nurse will arrive at your doorstep for professional healthcare at home."
                  : "A doctor will arrive at your doorstep — just like an Uber ride!"}
            </p>

            {/* Order summary */}
            <div style={{ padding: 16, backgroundColor: '#f7fafc', borderRadius: 10, border: '1px solid #e2e8f0', marginBottom: 20 }}>
              {selectedTests.length > 0 ? (
                <>
                  <div style={{ fontWeight: 700, color: '#1a2b4a', marginBottom: 8, fontSize: '0.9rem' }}>{selectedTests.length} test{selectedTests.length > 1 ? 's' : ''} selected:</div>
                  {selectedTests.map((t, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.85rem' }}>
                      <span style={{ color: '#4a5568' }}>{t.name}</span>
                      <span style={{ color: '#2f855a', fontWeight: 600 }}>₹{t.price}</span>
                    </div>
                  ))}
                  <div style={{ borderTop: '1px solid #e2e8f0', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700, color: '#1a2b4a' }}>Total</span>
                    <span style={{ fontWeight: 800, color: '#2f855a', fontSize: '1.1rem' }}>₹{multiTestTotal}</span>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, color: '#4a5568' }}>
                      {selectedTest ? selectedTest.name : selectedDoctor ? selectedDoctor.name : '—'}
                    </span>
                    <span style={{ fontWeight: 700, color: '#2f855a', fontSize: '1.1rem' }}>₹{fee}</span>
                  </div>
                  {selectedDoctor && (
                    <div style={{ fontSize: '0.8rem', color: '#718096' }}>{selectedDoctor.specialization} · ⭐ {selectedDoctor.rating}</div>
                  )}
                </>
              )}
            </div>

            {/* Address input */}
            <label style={{ fontWeight: 600, fontSize: '0.88rem', display: 'block', marginBottom: 8, color: '#4a5568' }}>📍 Your Full Address</label>
            <textarea
              rows={3}
              placeholder="e.g., Flat 301, SLV Enclave, Dwaraka Nagar, Visakhapatnam - 530016"
              value={dispatchAddress}
              onChange={e => setDispatchAddress(e.target.value)}
              style={{
                width: '100%', padding: '12px 16px', borderRadius: 10, border: '1px solid #e2e8f0',
                fontSize: '0.9rem', resize: 'vertical', outline: 'none', fontFamily: 'inherit'
              }}
            />
            <div style={{ fontSize: '0.72rem', color: '#a0aec0', marginTop: 4, marginBottom: 20 }}>
              💡 In production, we will auto-detect your GPS location for precise dispatch.
            </div>

            {/* Payment summary */}
            <div style={{ padding: 16, backgroundColor: '#f0fff4', borderRadius: 10, border: '1px solid #c6f6d5', marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                <span>💳 Amount</span>
                <span style={{ color: '#2f855a', fontSize: '1.2rem' }}>₹{fee}</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#718096', marginTop: 4 }}>Payment on completion · No hidden charges</div>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button className="btn btn-secondary" onClick={() => { setStep(2); setDispatchAddress(""); }}>← Back</button>
              <button
                className="btn btn-primary" style={{ flex: 1, borderRadius: 10, backgroundColor: '#e53e3e', borderColor: '#e53e3e' }}
                disabled={!dispatchAddress.trim() || loading}
                onClick={handleDispatchNow}
              >
                {loading ? "Dispatching..." : `🚀 Dispatch Now — ₹${fee}`}
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 10: SUCCESS ─── */}
        {step === 10 && (
          <div className="card" style={{ padding: 40, textAlign: "center" }}>
            <div style={{ fontSize: "4rem", marginBottom: 16 }}>{bookingType === "lab" ? "📋" : "🎉"}</div>
            <h2 style={{ color: '#1a2b4a' }}>
              {isOnDemand ? "Dispatch Requested!" : bookingType === "lab" ? "Submitted for Review!" : "Booking Confirmed!"}
            </h2>
            <p style={{ color: "#718096", marginTop: 8, maxWidth: 420, margin: "8px auto 24px", fontSize: '0.9rem' }}>
              {bookingType === "home_doctor"
                ? "Your doctor has been notified and will arrive at your location. Track their live location from your dashboard."
                : bookingType === "home_collection"
                  ? "A phlebotomist will be dispatched to your location for sample collection. Track live status from your dashboard."
                  : bookingType === "nurse_visit"
                    ? "A nurse will be dispatched to your location. You'll receive OTP verification before the service starts. Track live from your dashboard."
                    : bookingType === "video_consult"
                      ? "Your video consultation is booked. You'll receive a video call link via WhatsApp before the scheduled time."
                      : bookingType === "lab"
                        ? "Your booking has been submitted. The diagnostic centre will review and allot a specific time slot. You'll see a notification in your dashboard to accept or decline."
                        : "Your appointment has been booked successfully. You'll receive a confirmation via WhatsApp shortly."
              }
            </p>
            <div style={{ maxWidth: 400, margin: "0 auto 24px", textAlign: "left", padding: 20, backgroundColor: '#f7fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
              {selectedDoctor && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.88rem' }}>
                  <span style={{ color: '#718096' }}>Doctor</span>
                  <span style={{ fontWeight: 600, color: '#1a2b4a' }}>{selectedDoctor.name}</span>
                </div>
              )}
              {selectedOrg && !isOnDemand && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.88rem' }}>
                  <span style={{ color: '#718096' }}>Provider</span>
                  <span style={{ fontWeight: 600, color: '#1a2b4a' }}>{selectedOrg.name}</span>
                </div>
              )}
              {(selectedTest || selectedTests.length > 0) && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.88rem' }}>
                  <span style={{ color: '#718096' }}>{selectedTests.length > 1 ? 'Tests' : 'Test'}</span>
                  <span style={{ fontWeight: 600, color: '#1a2b4a', maxWidth: 220, textAlign: 'right' }}>
                    {selectedTests.length > 0 ? selectedTests.map(t => t.name).join(', ') : selectedTest?.name}
                  </span>
                </div>
              )}
              {isOnDemand && dispatchAddress && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.88rem' }}>
                  <span style={{ color: '#718096' }}>Address</span>
                  <span style={{ fontWeight: 600, color: '#1a2b4a', maxWidth: 200, textAlign: 'right' }}>{dispatchAddress}</span>
                </div>
              )}
              {!isOnDemand && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.88rem' }}>
                    <span style={{ color: '#718096' }}>Date</span>
                    <span style={{ fontWeight: 600, color: '#1a2b4a' }}>{selectedDate}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.88rem' }}>
                    <span style={{ color: '#718096' }}>Time</span>
                    <span style={{ fontWeight: 600, color: '#1a2b4a' }}>{formatSlotLabel(selectedSlot)}</span>
                  </div>
                </>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>
                <span style={{ color: '#718096' }}>{isOnDemand ? "Amount" : "Amount Paid"}</span>
                <span style={{ fontWeight: 700, color: '#2f855a' }}>₹{fee}</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <a href="/dashboard/patient" className="btn btn-primary" style={{ borderRadius: 10 }}>Go to Dashboard</a>
              <button className="btn btn-secondary" style={{ borderRadius: 10 }} onClick={() => {
                setStep(1); setBookingType(""); setSelectedOrg(null); setSelectedDoctor(null);
                setSelectedTest(null); setSelectedTests([]); setSelectedDate(""); setSelectedSlot(""); setSelectedBranch(""); setError(""); setDispatchAddress("");
              }}>Book Another</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function BookingPage() {
  return (
    <Suspense fallback={<div className="section" style={{ textAlign: 'center', padding: 60 }}>Loading...</div>}>
      <BookingPageContent />
    </Suspense>
  );
}
