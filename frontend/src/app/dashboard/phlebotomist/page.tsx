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
          <h2 style={{ color: '#1a2b4a' }}>Loading Phlebotomist Dashboard...</h2>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: "#f1f5f9", minHeight: "100vh" }}>
      {/* ─── Header ─── */}
      <div style={{
        background: "linear-gradient(135deg, #b91c1c 0%, #ef4444 50%, #b91c1c 100%)",
        padding: "24px 40px",
        color: "#ffffff",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, color: "#ffffff" }}>
            🩸 Phlebotomist Hub
          </h1>
          <p style={{ margin: "4px 0 0 0", color: "rgba(255,255,255,0.75)", fontSize: "0.85rem" }}>
            Welcome, {profile?.full_name || "Phlebotomist"} • Manage your collections
          </p>
        </div>
      </div>

      {/* ─── Tabs ─── */}
      <div style={{ padding: "0 40px", display: "flex", gap: 4, borderBottom: "1px solid #e2e8f0", backgroundColor: "white", marginTop: 16 }}>
        {[
          { id: "dispatch", label: "Dispatch Tracking", icon: "📍" },
          { id: "profile", label: "Profile Details", icon: "👤" },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "12px 20px",
              border: "none",
              backgroundColor: activeTab === tab.id ? "white" : "transparent",
              color: activeTab === tab.id ? "#b91c1c" : "#64748b",
              fontWeight: activeTab === tab.id ? 700 : 500,
              fontSize: "0.9rem",
              cursor: "pointer",
              borderBottom: activeTab === tab.id ? "3px solid #b91c1c" : "3px solid transparent",
              borderRadius: "8px 8px 0 0",
              transition: "all 0.2s",
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
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
