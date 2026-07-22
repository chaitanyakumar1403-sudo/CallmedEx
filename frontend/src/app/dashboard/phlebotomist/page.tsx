"use client";

import { useState, useEffect } from "react";
import ProviderDispatchTracker from "../components/ProviderDispatchTracker";
import DashboardProfile from "../components/DashboardProfile";
import { useRouter } from "next/navigation";

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('token') : null;

export default function PhlebotomistDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("dispatch");
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = getToken();
        if (!token) { router.push("/auth/login"); return; }
        const res = await fetch(`${apiBase}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success && data.data.role === "phlebotomist") {
          setProfile(data.data);
        } else {
          router.push("/");
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [router]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>🩸</div>
          <h2 style={{ color: '#1a2b4a' }}>Loading Phlebotomist Command Hub...</h2>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: "#f8fafc", minHeight: "100vh" }}>
      {/* ─── Hero Header ─── */}
      <div className="dashboard-hero-header" style={{ background: "linear-gradient(135deg, #7f1d1d 0%, #991b1b 50%, #b91c1c 100%)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative", zIndex: 2 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
              <h1 style={{ margin: 0, fontSize: "1.8rem", fontWeight: 800, color: "#ffffff" }}>
                🩸 Phlebotomist Diagnostic Radar
              </h1>
              <span className="badge-ai">Live Field Collection</span>
            </div>
            <p style={{ margin: 0, color: "rgba(255,255,255,0.85)", fontSize: "0.92rem" }}>
              Welcome, {profile?.full_name || "Phlebotomist"} • Real-time GPS Home Sample Collection Dispatch
            </p>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{ background: "rgba(255,255,255,0.15)", color: "#fecdd3", padding: "8px 16px", borderRadius: 20, fontSize: "0.85rem", fontWeight: 700, backdropFilter: "blur(4px)", display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, background: "#ef4444", borderRadius: "50%", boxShadow: "0 0 10px #ef4444" }}></div>
              Cold-Chain Monitor Active
            </span>
          </div>
        </div>
      </div>

      {/* ─── Tabs ─── */}
      <div style={{ padding: "20px 40px 0 40px" }}>
        <div className="tab-nav-bar" style={{ maxWidth: 400 }}>
          {[
            { id: "dispatch", label: "Live Dispatch Radar", icon: "📍" },
            { id: "profile", label: "Agent Profile", icon: "👤" },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`tab-pill-btn ${activeTab === tab.id ? "tab-pill-btn--active" : ""}`}
              style={{ flex: 1 }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Content ─── */}
      <div style={{ padding: "24px 40px" }}>
        {activeTab === "dispatch" && (
          <div style={{ margin: "-24px -40px" }}>
            <ProviderDispatchTracker
              title="Phlebotomist Hub"
              icon="🩸"
              providerType="phlebotomist"
              earningsRate={200}
            />
          </div>
        )}

        {activeTab === "profile" && (
          <DashboardProfile profile={profile} role="phlebotomist" />
        )}
      </div>
    </div>
  );
}
