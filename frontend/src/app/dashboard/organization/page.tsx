"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import DashboardProfile from "../components/DashboardProfile";

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('token') : null;

export default function OrganizationDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [statusMsg, setStatusMsg] = useState("");

  // Verification
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Doctors
  const [orgDoctors, setOrgDoctors] = useState<any[]>([]);
  const [addDocForm, setAddDocForm] = useState({ doctor_email: "", specialization: "", consultation_fee: "" });

  // Services
  const [orgServices, setOrgServices] = useState<any[]>([]);
  const [addSvcForm, setAddSvcForm] = useState({
    service_type: "lab_test",
    name: "",
    description: "",
    price: "",
    home_collection_available: false,
    home_collection_surcharge: "",
  });
  
  // Scope of Services Dialog
  const [showScopeDialog, setShowScopeDialog] = useState(false);
  const [scopeSearchQuery, setScopeSearchQuery] = useState("");
  const [selectedScopeServices, setSelectedScopeServices] = useState<Record<string, number>>({});
  const [bulkAdding, setBulkAdding] = useState(false);

  // Packages, Timings & Stats
  const [orgPackages, setOrgPackages] = useState<any[]>([]);
  const [addPkgForm, setAddPkgForm] = useState({ name: "", description: "", price: "", tests_included: [] as string[] });
  
  const [orgTimings, setOrgTimings] = useState<any[]>([]);
  const [orgStats, setOrgStats] = useState<any>(null);

  // Pending Bookings (diagnostic slot allotment workflow)
  const [pendingBookings, setPendingBookings] = useState<any[]>([]);
  const [allotDialog, setAllotDialog] = useState<{ bookingId: string; patientName: string; date: string; tests: string } | null>(null);
  const [allotStartTime, setAllotStartTime] = useState("");
  const [allotEndTime, setAllotEndTime] = useState("");
  const [allotMessage, setAllotMessage] = useState("");
  const [allotting, setAllotting] = useState(false);

  // ─── Data Fetching ─────────────────────────────────────────────────────

  const fetchProfile = useCallback(async () => {
    try {
      const token = getToken();
      if (!token) { router.push("/auth/login"); return; }
      const res = await fetch(`${apiBase}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.data.role === "organization") {
        setProfile(data.data);
      } else {
        router.push("/dashboard/staff");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [router]);

  const fetchDoctors = useCallback(async () => {
    try {
      const token = getToken();
      const res = await fetch(`${apiBase}/api/providers/org/doctors`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setOrgDoctors(data.doctors || []);
    } catch (e) { console.error(e); }
  }, []);

  const fetchServices = useCallback(async () => {
    try {
      const token = getToken();
      const res = await fetch(`${apiBase}/api/providers/org/services`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setOrgServices(data.services || []);
    } catch (e) { console.error(e); }
  }, []);

  const fetchPackages = useCallback(async () => {
    try {
      const token = getToken();
      const res = await fetch(`${apiBase}/api/providers/org/packages`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setOrgPackages(data.packages || []);
    } catch (e) { console.error(e); }
  }, []);

  const fetchTimings = useCallback(async () => {
    try {
      const token = getToken();
      const res = await fetch(`${apiBase}/api/providers/org/timings`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setOrgTimings(data.timings || []);
    } catch (e) { console.error(e); }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const token = getToken();
      const res = await fetch(`${apiBase}/api/providers/org/stats`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setOrgStats(data.stats);
    } catch (e) { console.error(e); }
  }, []);

  const fetchPendingBookings = useCallback(async () => {
    try {
      const token = getToken();
      const res = await fetch(`${apiBase}/api/bookings/pending-review`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setPendingBookings(data.data?.bookings || []);
    } catch (e) { console.error(e); }
  }, []);

  const handleAllotSlot = async () => {
    if (!allotDialog || !allotStartTime || !allotEndTime) return;
    setAllotting(true);
    try {
      const token = getToken();
      const res = await fetch(`${apiBase}/api/bookings/${allotDialog.bookingId}/allot-slot`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          allotted_start_time: allotStartTime,
          allotted_end_time: allotEndTime,
          message: allotMessage || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg(`✅ Slot allotted: ${allotStartTime} - ${allotEndTime}. Patient will be notified.`);
        setAllotDialog(null);
        setAllotStartTime("");
        setAllotEndTime("");
        setAllotMessage("");
        fetchPendingBookings();
      } else {
        setStatusMsg(`❌ ${data.detail || "Failed to allot slot"}`);
      }
    } catch (e) {
      setStatusMsg("❌ Network error while allotting slot");
    } finally {
      setAllotting(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchDoctors();
    fetchServices();
    fetchPackages();
    fetchTimings();
    fetchStats();
    fetchPendingBookings();
  }, [fetchProfile, fetchDoctors, fetchServices, fetchPackages, fetchTimings, fetchStats, fetchPendingBookings]);

  // ─── Verification Handler ──────────────────────────────────────────────

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (JPEG, PNG).");
      return;
    }
    setVerifying(true);
    setError("");
    setVerificationResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const token = getToken();
      const res = await fetch(`${apiBase}/api/verification/verify-document`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setVerificationResult({ success: true, ...data.data.extracted_data });
        setProfile((prev: any) => ({ ...prev, verification_status: "verified" }));
      } else {
        setError(data.detail || "Verification failed.");
      }
    } catch (e) {
      setError("Failed to connect to verification server.");
    } finally {
      setVerifying(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ─── Doctor Management Handlers ────────────────────────────────────────

  const handleAddDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg("Adding doctor...");
    try {
      const token = getToken();
      const res = await fetch(`${apiBase}/api/providers/org/add-doctor`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          doctor_email: addDocForm.doctor_email,
          specialization: addDocForm.specialization,
          consultation_fee: parseFloat(addDocForm.consultation_fee) || 0,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg(`✅ ${data.message}`);
        fetchDoctors();
        setAddDocForm({ doctor_email: "", specialization: "", consultation_fee: "" });
      } else {
        setStatusMsg(`❌ ${data.detail || "Failed to add doctor"}`);
      }
    } catch (e) {
      setStatusMsg("❌ Network error");
    }
  };

  const handleRemoveDoctor = async (doctorUserId: string) => {
    try {
      const token = getToken();
      await fetch(`${apiBase}/api/providers/org/doctor/${doctorUserId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setStatusMsg("✅ Doctor removed");
      fetchDoctors();
    } catch (e) {
      setStatusMsg("❌ Failed to remove doctor");
    }
  };

  // ─── Service Management Handlers ───────────────────────────────────────

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg("Adding service...");
    try {
      const token = getToken();
      const res = await fetch(`${apiBase}/api/providers/org/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          service_type: addSvcForm.service_type,
          name: addSvcForm.name,
          description: addSvcForm.description,
          price: parseFloat(addSvcForm.price) || 0,
          home_collection_available: addSvcForm.home_collection_available,
          home_collection_surcharge: parseFloat(addSvcForm.home_collection_surcharge) || 0,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg(`✅ ${data.message}`);
        fetchServices();
        setAddSvcForm({ service_type: "lab_test", name: "", description: "", price: "", home_collection_available: false, home_collection_surcharge: "" });
      } else {
        setStatusMsg(`❌ ${data.detail || "Failed to add service"}`);
      }
    } catch (e) {
      setStatusMsg("❌ Network error");
    }
  };

  const handleRemoveService = async (serviceId: string) => {
    try {
      const token = getToken();
      await fetch(`${apiBase}/api/providers/org/services/${serviceId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setStatusMsg("✅ Service removed");
      fetchServices();
    } catch (e) {
      setStatusMsg("❌ Failed to remove service");
    }
  };

  // ─── Package & Timing Handlers ──────────────────────────────────────────
  
  const handleAddPackage = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg("Adding package...");
    try {
      const token = getToken();
      const res = await fetch(`${apiBase}/api/providers/org/packages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: addPkgForm.name,
          description: addPkgForm.description,
          price: parseFloat(addPkgForm.price) || 0,
          tests_included: addPkgForm.tests_included,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg(`✅ ${data.message}`);
        fetchPackages();
        setAddPkgForm({ name: "", description: "", price: "", tests_included: [] });
      } else {
        setStatusMsg(`❌ ${data.detail || "Failed to add package"}`);
      }
    } catch (e) {
      setStatusMsg("❌ Network error");
    }
  };

  const handleRemovePackage = async (packageId: string) => {
    try {
      const token = getToken();
      await fetch(`${apiBase}/api/providers/org/packages/${packageId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setStatusMsg("✅ Package removed");
      fetchPackages();
    } catch (e) {
      setStatusMsg("❌ Failed to remove package");
    }
  };

  const handleUpdateTiming = async (dayOfWeek: number, isOpen: boolean, openTime: string, closeTime: string) => {
    try {
      const token = getToken();
      const res = await fetch(`${apiBase}/api/providers/org/timings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ day_of_week: dayOfWeek, is_open: isOpen, open_time: openTime, close_time: closeTime }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg(`✅ Timings updated`);
        fetchTimings();
      } else {
        setStatusMsg(`❌ Failed to update timings`);
      }
    } catch (e) {
      setStatusMsg("❌ Network error");
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>🏥</div>
          <h2 style={{ color: '#1a2b4a' }}>Loading Organization Dashboard...</h2>
        </div>
      </div>
    );
  }

  const isPending = profile?.verification_status !== "verified" && !verificationResult?.success;

  const orgType = profile?.organization_type || "hospital";
  const allTabs = [
    { id: "overview", label: "Overview", icon: "📊" },
    { id: "pending", label: `Pending Review${pendingBookings.length > 0 ? ` (${pendingBookings.length})` : ""}`, icon: "🔔" },
    { id: "doctors", label: `Doctors (${orgDoctors.length})`, icon: "👨‍⚕️" },
    { id: "services", label: `Tests & Services (${orgServices.length})`, icon: "🧪" },
    { id: "packages", label: `Packages (${orgPackages.length})`, icon: "📦" },
    { id: "timings", label: "Timings", icon: "⏰" },
    { id: "bookings", label: "Bookings", icon: "📋" },
    { id: "profile", label: "Profile Details", icon: "👤" },
  ];

  const tabs = allTabs.filter(tab => {
    if (orgType === "diagnostic_center" && tab.id === "doctors") return false;
    if (orgType === "clinic" && tab.id === "packages") return false;
    return true;
  });

  const svcTypeLabel: Record<string, string> = {
    lab_test: "🧪 Lab Test",
    health_package: "📦 Health Package",
    imaging: "📷 Imaging",
    procedure: "🔬 Procedure",
    consultation: "🩺 Consultation",
  };

  const predefinedServices = [
    { id: "c1", type: "consultation", name: "General Physician Consultation", price: 500, description: "Standard consultation" },
    { id: "c2", type: "consultation", name: "Cardiology Consultation", price: 800, description: "Heart specialist consultation" },
    { id: "c3", type: "consultation", name: "Orthopedic Consultation", price: 700, description: "Bone and joint specialist" },
    { id: "l1", type: "lab_test", name: "Complete Blood Count (CBC)", price: 300, description: "Basic blood profile" },
    { id: "l2", type: "lab_test", name: "Lipid Profile", price: 450, description: "Cholesterol levels" },
    { id: "l3", type: "lab_test", name: "Thyroid Profile (T3, T4, TSH)", price: 500, description: "Thyroid function test" },
    { id: "l4", type: "lab_test", name: "HbA1c", price: 400, description: "3-month average blood sugar" },
    { id: "l5", type: "lab_test", name: "Liver Function Test (LFT)", price: 600, description: "Liver health markers" },
    { id: "i1", type: "imaging", name: "X-Ray Chest PA View", price: 400, description: "Standard chest X-ray" },
    { id: "i2", type: "imaging", name: "USG Whole Abdomen", price: 1200, description: "Ultrasound scan" },
    { id: "i3", type: "imaging", name: "ECG", price: 300, description: "Electrocardiogram" },
  ];

  const handleBulkAddServices = async () => {
    const selectedIds = Object.keys(selectedScopeServices);
    if (selectedIds.length === 0) return;
    setBulkAdding(true);
    try {
      const token = getToken();
      const servicesToAdd = predefinedServices.filter(s => selectedIds.includes(s.id));
      
      // Add sequentially to avoid overwhelming if many
      for (const svc of servicesToAdd) {
        const customPrice = selectedScopeServices[svc.id];
        await fetch(`${apiBase}/api/providers/org/services`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            service_type: svc.type,
            name: svc.name,
            description: svc.description,
            price: customPrice,
            home_collection_available: false,
            home_collection_surcharge: 0,
          }),
        });
      }
      setStatusMsg(`✅ Successfully added ${servicesToAdd.length} services from Scope.`);
      fetchServices();
      setShowScopeDialog(false);
      setSelectedScopeServices({});
      setScopeSearchQuery("");
    } catch (e) {
      setStatusMsg("❌ Failed to add some services.");
    } finally {
      setBulkAdding(false);
    }
  };

  return (
    <div style={{ backgroundColor: "#f1f5f9", minHeight: "100vh" }}>
      {/* ─── Header ─── */}
      <div style={{
        background: "linear-gradient(135deg, #581c87 0%, #7e22ce 50%, #581c87 100%)",
        padding: "24px 40px",
        color: "#ffffff",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, color: "#ffffff" }}>
            🏥 {profile?.organization_name || "Organization"} Dashboard
          </h1>
          <p style={{ margin: "4px 0 0 0", color: "rgba(255,255,255,0.75)", fontSize: "0.85rem" }}>
            Manage doctors, services, pricing, and bookings
          </p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {isPending ? (
            <span style={{ backgroundColor: "rgba(239,68,68,0.2)", color: "#fca5a5", padding: "6px 14px", borderRadius: 20, fontSize: "0.8rem", fontWeight: 600 }}>
              Verification Pending
            </span>
          ) : (
            <span style={{ backgroundColor: "rgba(34,197,94,0.2)", color: "#86efac", padding: "6px 14px", borderRadius: 20, fontSize: "0.8rem", fontWeight: 600 }}>
              ✅ Verified
            </span>
          )}
        </div>
      </div>

      {/* ─── Verification Banner ─── */}
      {isPending && (
        <div style={{ margin: "20px 40px", padding: 24, background: "linear-gradient(to right, #fdf4ff, #fae8ff)", borderRadius: 12, border: "1px solid #f5d0fe" }}>
          <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ fontSize: "3rem", lineHeight: 1 }}>✨</div>
            <div style={{ flex: 1, minWidth: 300 }}>
              <h3 style={{ fontSize: "1.2rem", color: "#701a75", marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                AI Verification Required
                <span style={{ fontSize: "0.7rem", backgroundColor: "#f0abfc", color: "#701a75", padding: "2px 8px", borderRadius: 12, fontWeight: 700 }}>Gemini Vision</span>
              </h3>
              <p style={{ color: "#86198f", fontSize: "0.95rem", marginBottom: 16 }}>
                Upload your <strong>Clinical Establishment License</strong> or <strong>Hospital Registration Certificate</strong> to activate your listing.
              </p>
              {error && (
                <div style={{ backgroundColor: "#fef2f2", color: "#b91c1c", padding: "12px 16px", borderRadius: 8, marginBottom: 16, fontSize: "0.9rem", border: "1px solid #fecaca" }}>
                  ❌ {error}
                </div>
              )}
              <input type="file" accept="image/png, image/jpeg, image/jpg" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileUpload} />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={verifying}
                style={{
                  backgroundColor: "#86198f", color: "white", border: "none",
                  padding: "10px 20px", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: "0.9rem",
                }}
              >
                {verifying ? "⏳ AI is analyzing..." : "📸 Upload License for Instant Verification"}
              </button>
            </div>
          </div>
        </div>
      )}

      {verificationResult?.success && (
        <div style={{ margin: "0 40px 20px", padding: 24, backgroundColor: "#f0fdf4", borderRadius: 12, border: "1px solid #bbf7d0" }}>
          <h3 style={{ fontSize: "1.2rem", color: "#166534", marginBottom: 8 }}>✅ Verification Successful!</h3>
          <p style={{ color: "#15803d", fontSize: "0.95rem" }}>Your organization is now live on CallMedex.</p>
        </div>
      )}

      {/* ─── Stats ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, padding: "0 40px 16px" }}>
        {[
          { label: "Linked Doctors", value: orgStats?.total_doctors ?? orgDoctors.length, icon: "👨‍⚕️", color: "#2563eb" },
          { label: "Active Services", value: orgStats?.total_services ?? orgServices.length, icon: "🧪", color: "#16a34a" },
          { label: "Total Bookings", value: orgStats?.total_bookings ?? "—", icon: "📋", color: "#d97706" },
          { label: "Total Revenue", value: orgStats?.total_revenue ? `₹${orgStats.total_revenue}` : "—", icon: "💰", color: "#7c3aed" },
        ].map((stat, i) => (
          <div key={i} style={{
            backgroundColor: "white", borderRadius: 12, padding: 20,
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)", display: "flex", alignItems: "center", gap: 16,
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12, backgroundColor: `${stat.color}15`,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem",
            }}>{stat.icon}</div>
            <div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#1e293b" }}>{stat.value}</div>
              <div style={{ fontSize: "0.8rem", color: "#64748b" }}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Tabs ─── */}
      <div style={{ padding: "0 40px", display: "flex", gap: 4, borderBottom: "1px solid #e2e8f0" }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "12px 20px", border: "none",
              backgroundColor: activeTab === tab.id ? "white" : "transparent",
              color: activeTab === tab.id ? "#581c87" : "#64748b",
              fontWeight: activeTab === tab.id ? 700 : 500,
              fontSize: "0.9rem", cursor: "pointer",
              borderBottom: activeTab === tab.id ? "3px solid #7e22ce" : "3px solid transparent",
              borderRadius: "8px 8px 0 0", transition: "all 0.2s",
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ─── Content ─── */}
      <div style={{ padding: "24px 40px" }}>
        {statusMsg && (
          <div style={{
            padding: "12px 20px",
            backgroundColor: statusMsg.includes("✅") ? "#f0fdf4" : "#fef2f2",
            color: statusMsg.includes("✅") ? "#166534" : "#991b1b",
            borderRadius: 8, marginBottom: 20, fontSize: "0.9rem", fontWeight: 500,
          }}>
            {statusMsg}
            <button onClick={() => setStatusMsg("")} style={{ float: "right", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>✕</button>
          </div>
        )}

        {/* ═══ OVERVIEW TAB ═══ */}
        {activeTab === "overview" && (
          <div style={{
            backgroundColor: "white", borderRadius: 12, padding: 32,
            textAlign: "center", border: "2px dashed #d1d5db",
          }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🚀</div>
            <h3 style={{ fontSize: "1.1rem", marginBottom: 8, color: "#1e293b" }}>
              Welcome to Your Organization Hub
            </h3>
            <p style={{ color: "#64748b", fontSize: "0.9rem", maxWidth: 500, margin: "0 auto" }}>
              Start by adding your doctors in the <strong>Doctors</strong> tab and listing your services (lab tests, packages) in the <strong>Services</strong> tab.
              Patients will discover you on the CallMedex marketplace once everything is set up.
            </p>
          </div>
        )}

        {/* ═══ PROFILE TAB ═══ */}
        {activeTab === "profile" && (
          <DashboardProfile profile={profile} role="organization" />
        )}

        {/* ═══ DOCTORS TAB ═══ */}
        {activeTab === "doctors" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              {/* Add Doctor Form */}
              <div style={{ backgroundColor: "white", borderRadius: 12, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                <h3 style={{ margin: "0 0 16px 0", color: "#475569", fontSize: "1rem" }}>Add Doctor to Organization</h3>
                <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginBottom: 16 }}>
                  The doctor must already have a CallMedex account. Enter their registered email.
                </p>
                <form onSubmit={handleAddDoctor}>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#475569", fontSize: "0.85rem" }}>Doctor&apos;s Email</label>
                    <input
                      type="email"
                      placeholder="doctor@example.com"
                      value={addDocForm.doctor_email}
                      onChange={e => setAddDocForm({ ...addDocForm, doctor_email: e.target.value })}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: "0.9rem" }}
                      required
                    />
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#475569", fontSize: "0.85rem" }}>Specialization</label>
                    <input
                      type="text"
                      placeholder="e.g., Cardiology"
                      value={addDocForm.specialization}
                      onChange={e => setAddDocForm({ ...addDocForm, specialization: e.target.value })}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: "0.9rem" }}
                    />
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#475569", fontSize: "0.85rem" }}>Consultation Fee (₹)</label>
                    <input
                      type="number"
                      placeholder="e.g., 500"
                      value={addDocForm.consultation_fee}
                      onChange={e => setAddDocForm({ ...addDocForm, consultation_fee: e.target.value })}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: "0.9rem" }}
                    />
                  </div>
                  <button type="submit" style={{
                    width: "100%", backgroundColor: "#7e22ce", color: "white", border: "none",
                    padding: "12px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: "0.9rem",
                  }}>
                    + Add Doctor
                  </button>
                </form>
              </div>

              {/* Linked Doctors List */}
              <div style={{ backgroundColor: "white", borderRadius: 12, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                <h3 style={{ margin: "0 0 16px 0", color: "#475569", fontSize: "1rem" }}>Linked Doctors ({orgDoctors.length})</h3>
                {orgDoctors.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 32, color: "#94a3b8" }}>
                    <div style={{ fontSize: "2rem", marginBottom: 8 }}>👨‍⚕️</div>
                    No doctors linked yet.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {orgDoctors.map(doc => {
                      const user = doc.users || {};
                      return (
                        <div key={doc.id} style={{
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          padding: "14px 16px", backgroundColor: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0",
                        }}>
                          <div>
                            <div style={{ fontWeight: 700, color: "#1e293b" }}>{user.full_name || "Doctor"}</div>
                            <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                              {doc.specialization || "General"} • ₹{doc.consultation_fee || 0}
                            </div>
                            <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{user.email}</div>
                          </div>
                          <button
                            onClick={() => handleRemoveDoctor(doc.doctor_user_id)}
                            style={{
                              backgroundColor: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca",
                              padding: "6px 14px", borderRadius: 6, fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ SERVICES TAB ═══ */}
        {activeTab === "services" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              {/* Add Service Form */}
              <div style={{ backgroundColor: "white", borderRadius: 12, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3 style={{ margin: 0, color: "#475569", fontSize: "1rem" }}>Add Service / Test</h3>
                  <button onClick={() => setShowScopeDialog(true)} type="button" style={{
                    backgroundColor: "#f0f9ff", color: "#0284c7", border: "1px solid #bae6fd",
                    padding: "6px 12px", borderRadius: 6, fontWeight: 600, cursor: "pointer", fontSize: "0.8rem",
                  }}>
                    📋 Select Scope of Services
                  </button>
                </div>
                <form onSubmit={handleAddService}>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#475569", fontSize: "0.85rem" }}>Service Type</label>
                    <select
                      value={addSvcForm.service_type}
                      onChange={e => setAddSvcForm({ ...addSvcForm, service_type: e.target.value })}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: "0.9rem" }}
                    >
                      <option value="lab_test">🧪 Lab Test</option>
                      <option value="health_package">📦 Health Package</option>
                      <option value="imaging">📷 Imaging</option>
                      <option value="procedure">🔬 Procedure</option>
                      <option value="consultation">🩺 Consultation</option>
                    </select>
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#475569", fontSize: "0.85rem" }}>Name</label>
                    <input
                      type="text"
                      placeholder="e.g., Complete Blood Count (CBC)"
                      value={addSvcForm.name}
                      onChange={e => setAddSvcForm({ ...addSvcForm, name: e.target.value })}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: "0.9rem" }}
                      required
                    />
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#475569", fontSize: "0.85rem" }}>Price (₹)</label>
                    <input
                      type="number"
                      min={0}
                      placeholder="e.g., 250"
                      value={addSvcForm.price}
                      onChange={e => setAddSvcForm({ ...addSvcForm, price: e.target.value })}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: "0.9rem" }}
                      required
                    />
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#475569", fontSize: "0.85rem" }}>Description (optional)</label>
                    <input
                      type="text"
                      placeholder="Brief description"
                      value={addSvcForm.description}
                      onChange={e => setAddSvcForm({ ...addSvcForm, description: e.target.value })}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: "0.9rem" }}
                    />
                  </div>
                  <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={addSvcForm.home_collection_available}
                      onChange={e => setAddSvcForm({ ...addSvcForm, home_collection_available: e.target.checked })}
                      id="home-collection"
                    />
                    <label htmlFor="home-collection" style={{ fontWeight: 600, color: "#475569", fontSize: "0.85rem" }}>Home Collection Available</label>
                  </div>
                  {addSvcForm.home_collection_available && (
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#475569", fontSize: "0.85rem" }}>Home Collection Surcharge (₹)</label>
                      <input
                        type="number"
                        min={0}
                        placeholder="e.g., 50"
                        value={addSvcForm.home_collection_surcharge}
                        onChange={e => setAddSvcForm({ ...addSvcForm, home_collection_surcharge: e.target.value })}
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: "0.9rem" }}
                      />
                    </div>
                  )}
                  <button type="submit" style={{
                    width: "100%", backgroundColor: "#7e22ce", color: "white", border: "none",
                    padding: "12px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: "0.9rem",
                  }}>
                    + Add Service
                  </button>
                </form>
              </div>

              {/* Services List */}
              <div style={{ backgroundColor: "white", borderRadius: 12, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                <h3 style={{ margin: "0 0 16px 0", color: "#475569", fontSize: "1rem" }}>Your Services ({orgServices.length})</h3>
                {orgServices.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 32, color: "#94a3b8" }}>
                    <div style={{ fontSize: "2rem", marginBottom: 8 }}>🧪</div>
                    No services listed yet.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {orgServices.map(svc => (
                      <div key={svc.id} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "14px 16px", backgroundColor: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0",
                      }}>
                        <div>
                          <div style={{ fontWeight: 700, color: "#1e293b" }}>
                            {svcTypeLabel[svc.service_type] || svc.service_type} — {svc.name}
                          </div>
                          <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: 2 }}>
                            ₹{svc.price}
                            {svc.home_collection_available && (
                              <span style={{ marginLeft: 8, color: "#059669" }}>🏠 Home: +₹{svc.home_collection_surcharge}</span>
                            )}
                          </div>
                          {svc.description && (
                            <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: 2 }}>{svc.description}</div>
                          )}
                        </div>
                        <button
                          onClick={() => handleRemoveService(svc.id)}
                          style={{
                            backgroundColor: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca",
                            padding: "6px 14px", borderRadius: 6, fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              </div>


            {/* Scope of Services Dialog */}
            {showScopeDialog && (
              <div style={{
                position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)",
                display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
              }}>
                <div style={{ backgroundColor: "white", borderRadius: 12, padding: 32, width: "100%", maxWidth: 650, maxHeight: "80vh", overflowY: "auto" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <h2 style={{ margin: 0, fontSize: "1.3rem", color: "#1e293b" }}>Scope of Services</h2>
                    <button onClick={() => setShowScopeDialog(false)} style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "#94a3b8" }}>✕</button>
                  </div>
                  <p style={{ color: "#64748b", fontSize: "0.9rem", marginBottom: 16 }}>
                    Quickly add standard services to your catalog by selecting them from the list below. You can adjust the price before adding.
                  </p>
                  
                  {/* Search Bar */}
                  <div style={{ marginBottom: 20 }}>
                    <input 
                      type="text" 
                      placeholder="🔍 Search for a service (e.g. Blood Test, X-Ray)" 
                      value={scopeSearchQuery}
                      onChange={(e) => setScopeSearchQuery(e.target.value)}
                      style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: "0.9rem" }}
                    />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
                    {predefinedServices.filter(svc => 
                      svc.name.toLowerCase().includes(scopeSearchQuery.toLowerCase()) || 
                      svcTypeLabel[svc.type].toLowerCase().includes(scopeSearchQuery.toLowerCase())
                    ).map(svc => {
                      const isSelected = svc.id in selectedScopeServices;
                      const customPrice = selectedScopeServices[svc.id] ?? svc.price;
                      return (
                        <div key={svc.id} style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 12,
                          backgroundColor: isSelected ? "#f0f9ff" : "white", border: isSelected ? "1px solid #bae6fd" : "1px solid #e2e8f0",
                          borderRadius: 8, transition: "all 0.2s"
                        }}>
                          <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer", flex: 1 }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedScopeServices({ ...selectedScopeServices, [svc.id]: svc.price });
                                } else {
                                  const newSel = { ...selectedScopeServices };
                                  delete newSel[svc.id];
                                  setSelectedScopeServices(newSel);
                                }
                              }}
                              style={{ marginTop: 4 }}
                            />
                            <div>
                              <div style={{ fontWeight: 600, color: "#0f172a" }}>{svc.name}</div>
                              <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                                {svcTypeLabel[svc.type]} • Suggested Price: ₹{svc.price}
                              </div>
                            </div>
                          </label>
                          
                          {/* Inline Price Editor */}
                          {isSelected && (
                            <div style={{ display: "flex", alignItems: "center", gap: 6, backgroundColor: "white", padding: "4px 8px", borderRadius: 6, border: "1px solid #cbd5e1" }}>
                              <span style={{ color: "#64748b", fontSize: "0.9rem", fontWeight: 600 }}>₹</span>
                              <input 
                                type="number" 
                                min={0}
                                value={customPrice}
                                onChange={(e) => setSelectedScopeServices({ ...selectedScopeServices, [svc.id]: Number(e.target.value) })}
                                style={{ width: 60, border: "none", outline: "none", fontSize: "0.9rem", fontWeight: 600, color: "#0f172a" }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
                    <button onClick={() => setShowScopeDialog(false)} style={{
                      padding: "10px 20px", backgroundColor: "#f1f5f9", color: "#475569",
                      border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer"
                    }}>
                      Cancel
                    </button>
                    <button onClick={handleBulkAddServices} disabled={bulkAdding || Object.keys(selectedScopeServices).length === 0} style={{
                      padding: "10px 20px", backgroundColor: "#0284c7", color: "white",
                      border: "none", borderRadius: 8, fontWeight: 600, cursor: (bulkAdding || Object.keys(selectedScopeServices).length === 0) ? "not-allowed" : "pointer",
                      opacity: (bulkAdding || Object.keys(selectedScopeServices).length === 0) ? 0.7 : 1
                    }}>
                      {bulkAdding ? "Adding..." : `Add Selected (${Object.keys(selectedScopeServices).length})`}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ PACKAGES TAB ═══ */}
        {activeTab === "packages" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              {/* Add Package Form */}
              <div style={{ backgroundColor: "white", borderRadius: 12, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                <h3 style={{ margin: "0 0 16px 0", color: "#475569", fontSize: "1rem" }}>Create a Health Package</h3>
                <form onSubmit={handleAddPackage}>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#475569", fontSize: "0.85rem" }}>Package Name</label>
                    <input
                      type="text"
                      placeholder="e.g., Full Body Checkup"
                      value={addPkgForm.name}
                      onChange={e => setAddPkgForm({ ...addPkgForm, name: e.target.value })}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: "0.9rem" }}
                      required
                    />
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#475569", fontSize: "0.85rem" }}>Package Price (₹)</label>
                    <input
                      type="number"
                      min={0}
                      placeholder="e.g., 999"
                      value={addPkgForm.price}
                      onChange={e => setAddPkgForm({ ...addPkgForm, price: e.target.value })}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: "0.9rem" }}
                      required
                    />
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#475569", fontSize: "0.85rem" }}>Description</label>
                    <input
                      type="text"
                      placeholder="Brief description of what's included"
                      value={addPkgForm.description}
                      onChange={e => setAddPkgForm({ ...addPkgForm, description: e.target.value })}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: "0.9rem" }}
                    />
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#475569", fontSize: "0.85rem" }}>Select Tests Included</label>
                    <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 8, padding: 8 }}>
                      {orgServices.length === 0 ? (
                        <div style={{ color: "#94a3b8", fontSize: "0.85rem", padding: 8 }}>No services added yet. Add some first.</div>
                      ) : (
                        orgServices.map(svc => (
                          <div key={svc.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 4px" }}>
                            <input
                              type="checkbox"
                              checked={addPkgForm.tests_included.includes(svc.id)}
                              onChange={(e) => {
                                const newTests = e.target.checked 
                                  ? [...addPkgForm.tests_included, svc.id]
                                  : addPkgForm.tests_included.filter(id => id !== svc.id);
                                setAddPkgForm({ ...addPkgForm, tests_included: newTests });
                              }}
                            />
                            <span style={{ fontSize: "0.85rem", color: "#334155" }}>{svc.name}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  <button type="submit" style={{
                    width: "100%", backgroundColor: "#0284c7", color: "white", border: "none",
                    padding: "12px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: "0.9rem",
                  }}>
                    + Create Package
                  </button>
                </form>
              </div>

              {/* Packages List */}
              <div style={{ backgroundColor: "white", borderRadius: 12, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                <h3 style={{ margin: "0 0 16px 0", color: "#475569", fontSize: "1rem" }}>Your Packages ({orgPackages.length})</h3>
                {orgPackages.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 32, color: "#94a3b8" }}>
                    <div style={{ fontSize: "2rem", marginBottom: 8 }}>📦</div>
                    No packages created yet.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {orgPackages.map(pkg => (
                      <div key={pkg.id} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "14px 16px", backgroundColor: "#f0f9ff", borderRadius: 10, border: "1px solid #bae6fd",
                      }}>
                        <div>
                          <div style={{ fontWeight: 700, color: "#0369a1" }}>{pkg.name}</div>
                          <div style={{ fontSize: "0.8rem", color: "#0284c7", marginTop: 2 }}>
                            ₹{pkg.price} • {pkg.tests_included?.length || 0} tests
                          </div>
                          {pkg.description && (
                            <div style={{ fontSize: "0.75rem", color: "#0ea5e9", marginTop: 2 }}>{pkg.description}</div>
                          )}
                        </div>
                        <button
                          onClick={() => handleRemovePackage(pkg.id)}
                          style={{
                            backgroundColor: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca",
                            padding: "6px 14px", borderRadius: 6, fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ TIMINGS TAB ═══ */}
        {activeTab === "timings" && (
          <div style={{ backgroundColor: "white", borderRadius: 12, padding: 32, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
            <h3 style={{ margin: "0 0 24px 0", color: "#1e293b", fontSize: "1.2rem", display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: "1.5rem" }}>⏰</span> Organization Operating Hours
            </h3>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 600 }}>
              {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day, idx) => {
                const currentTiming = orgTimings.find(t => t.day_of_week === idx) || { is_open: false, open_time: "09:00", close_time: "17:00" };
                return (
                  <div key={day} style={{ 
                    display: "flex", alignItems: "center", gap: 16, padding: "16px", 
                    backgroundColor: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" 
                  }}>
                    <div style={{ width: 120, fontWeight: 600, color: "#334155" }}>{day}</div>
                    
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                      <input 
                        type="checkbox" 
                        checked={currentTiming.is_open} 
                        onChange={(e) => handleUpdateTiming(idx, e.target.checked, currentTiming.open_time, currentTiming.close_time)}
                      />
                      <span style={{ fontSize: "0.9rem", color: currentTiming.is_open ? "#16a34a" : "#94a3b8", fontWeight: 500 }}>
                        {currentTiming.is_open ? "Open" : "Closed"}
                      </span>
                    </label>

                    {currentTiming.is_open && (
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: "auto" }}>
                        <input 
                          type="time" 
                          value={currentTiming.open_time} 
                          onChange={(e) => handleUpdateTiming(idx, true, e.target.value, currentTiming.close_time)}
                          style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: "0.9rem" }}
                        />
                        <span style={{ color: "#94a3b8" }}>to</span>
                        <input 
                          type="time" 
                          value={currentTiming.close_time} 
                          onChange={(e) => handleUpdateTiming(idx, true, currentTiming.open_time, e.target.value)}
                          style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: "0.9rem" }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══ PENDING REVIEW TAB ═══ */}
        {activeTab === "pending" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontSize: "1.15rem", color: "#1e293b", margin: 0 }}>🔔 Pending Booking Requests</h3>
              <button onClick={fetchPendingBookings} style={{
                padding: "8px 16px", borderRadius: 8, border: "1px solid #d1d5db",
                background: "white", cursor: "pointer", fontSize: "0.82rem", fontWeight: 600,
              }}>🔄 Refresh</button>
            </div>
            {pendingBookings.length === 0 ? (
              <div style={{
                backgroundColor: "white", borderRadius: 12, padding: 40, textAlign: "center", border: "2px dashed #d1d5db",
              }}>
                <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>✅</div>
                <h3 style={{ fontSize: "1.1rem", marginBottom: 8, color: "#1e293b" }}>No Pending Requests</h3>
                <p style={{ color: "#64748b", fontSize: "0.9rem" }}>
                  All diagnostic booking requests have been reviewed. New requests from patients will appear here.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {pendingBookings.map((b: any) => (
                  <div key={b.id} style={{
                    backgroundColor: "white", borderRadius: 12, padding: 20,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.08)", border: "1px solid #fbbf24",
                    display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12,
                  }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontWeight: 700, color: "#1e293b", fontSize: "0.95rem", marginBottom: 4 }}>
                        {b.notes || "Diagnostic Tests"}
                      </div>
                      <div style={{ fontSize: "0.82rem", color: "#64748b", marginBottom: 2 }}>
                        📅 Preferred Date: <strong>{b.preferred_date || b.slot_start?.split("T")[0] || "—"}</strong>
                      </div>
                      {b.selected_tests && b.selected_tests.length > 0 && (
                        <div style={{ fontSize: "0.78rem", color: "#2563eb", marginTop: 2 }}>
                          🧪 {b.selected_tests.join(", ")}
                        </div>
                      )}
                      <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: 4 }}>
                        Patient ID: {b.patient_id?.substring(0, 8)}... · Booked: {new Date(b.created_at).toLocaleString()}
                      </div>
                      {b.total_price > 0 && (
                        <div style={{ fontSize: "0.85rem", color: "#16a34a", fontWeight: 600, marginTop: 4 }}>
                          ₹{b.total_price}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <span style={{
                        padding: "4px 12px", borderRadius: 20, fontSize: "0.72rem", fontWeight: 700,
                        backgroundColor: "#fef3c7", color: "#92400e",
                      }}>⏳ Pending Review</span>
                      <button
                        onClick={() => setAllotDialog({
                          bookingId: b.id,
                          patientName: b.patient_id?.substring(0, 8) || "Patient",
                          date: b.preferred_date || b.slot_start?.split("T")[0] || "",
                          tests: b.selected_tests?.join(", ") || b.notes || "",
                        })}
                        style={{
                          padding: "6px 16px", borderRadius: 8, border: "none",
                          backgroundColor: "#7e22ce", color: "white", fontWeight: 600,
                          fontSize: "0.82rem", cursor: "pointer",
                        }}
                      >
                        ⏰ Allot Time Slot
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Allot Slot Dialog */}
            {allotDialog && (
              <div style={{
                position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
              }}>
                <div style={{
                  backgroundColor: "white", borderRadius: 16, padding: 32, width: "90%", maxWidth: 480,
                  boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
                }}>
                  <h3 style={{ fontSize: "1.1rem", color: "#1e293b", marginBottom: 4 }}>⏰ Allot Time Slot</h3>
                  <p style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: 20 }}>
                    Assign a specific time for this diagnostic booking on <strong>{allotDialog.date}</strong>
                  </p>
                  {allotDialog.tests && (
                    <div style={{
                      padding: "10px 14px", backgroundColor: "#f1f5f9", borderRadius: 8, marginBottom: 16,
                      fontSize: "0.82rem", color: "#475569",
                    }}>
                      🧪 <strong>Tests:</strong> {allotDialog.tests}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: 4, color: "#374151" }}>Start Time</label>
                      <input type="time" value={allotStartTime} onChange={e => setAllotStartTime(e.target.value)}
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #d1d5db", fontSize: "0.9rem" }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: 4, color: "#374151" }}>End Time</label>
                      <input type="time" value={allotEndTime} onChange={e => setAllotEndTime(e.target.value)}
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #d1d5db", fontSize: "0.9rem" }} />
                    </div>
                  </div>
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: 4, color: "#374151" }}>Message to Patient (optional)</label>
                    <input type="text" value={allotMessage} onChange={e => setAllotMessage(e.target.value)}
                      placeholder="e.g., Please come 10 mins early for registration"
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #d1d5db", fontSize: "0.85rem" }} />
                  </div>
                  <div style={{ display: "flex", gap: 12 }}>
                    <button onClick={() => { setAllotDialog(null); setAllotStartTime(""); setAllotEndTime(""); setAllotMessage(""); }}
                      style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1.5px solid #d1d5db", background: "white", cursor: "pointer", fontWeight: 600, fontSize: "0.9rem" }}>
                      Cancel
                    </button>
                    <button onClick={handleAllotSlot} disabled={!allotStartTime || !allotEndTime || allotting}
                      style={{
                        flex: 1, padding: "10px", borderRadius: 8, border: "none",
                        backgroundColor: (!allotStartTime || !allotEndTime) ? "#d1d5db" : "#7e22ce",
                        color: "white", cursor: (!allotStartTime || !allotEndTime) ? "not-allowed" : "pointer",
                        fontWeight: 600, fontSize: "0.9rem",
                      }}>
                      {allotting ? "Allotting..." : "✅ Confirm & Notify Patient"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ BOOKINGS TAB ═══ */}
        {activeTab === "bookings" && (
          <div style={{
            backgroundColor: "white", borderRadius: 12, padding: 32,
            textAlign: "center", border: "2px dashed #d1d5db",
          }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>📋</div>
            <h3 style={{ fontSize: "1.1rem", marginBottom: 8, color: "#1e293b" }}>Bookings Dashboard</h3>
            <p style={{ color: "#64748b", fontSize: "0.9rem" }}>
              All confirmed appointments and completed bookings appear here with status tracking.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
