"use client";

import { useState, useEffect } from "react";
import ProviderDispatchTracker from "../components/ProviderDispatchTracker";
import DashboardProfile from "../components/DashboardProfile";
import SampleCollectionPanel from "../components/SampleCollectionPanel";
import PhleboWalletPanel from "../components/PhleboWalletPanel";
import AttendanceCard from "../components/AttendanceCard";
import { useRouter } from "next/navigation";

import PhlebotomistToolsModal from "../../../components/PhlebotomistToolsModal";
import DashboardShell, { SkeletonRows } from "../components/DashboardShell";

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('token') : null;

export default function PhlebotomistDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("dispatch");
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showToolsModal, setShowToolsModal] = useState(false);

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

  const TABS = [
    { id: "dispatch", label: "Live Dispatch", icon: "📍" },
    { id: "samples", label: "Samples & Handover", icon: "🧪" },
    { id: "wallet", label: "Wallet", icon: "💰" },
    { id: "profile", label: "Profile", icon: "👤" },
  ];

  if (loading) {
    return (
      <DashboardShell
        role="phlebotomist"
        title="Field Collection"
        subtitle="Loading your runs…"
        tabs={[]}
        activeTab=""
        onTabChange={() => {}}
      >
        <SkeletonRows rows={3} />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      role="phlebotomist"
      title="Field Collection"
      subtitle={`${profile?.full_name || "Phlebotomist"} — home sample collection and lab handover`}
      tabs={TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      aside={
        <button
          onClick={() => setShowToolsModal(true)}
          style={{
            padding: "10px 18px", borderRadius: 999, cursor: "pointer",
            border: "1px solid rgba(255,255,255,0.35)",
            background: "rgba(255,255,255,0.12)", color: "#fff", fontWeight: 700,
            fontSize: "0.85rem",
          }}
        >
          🧪 Tube guide
        </button>
      }
    >
      <PhlebotomistToolsModal isOpen={showToolsModal} onClose={() => setShowToolsModal(false)} />

        {activeTab === "dispatch" && (
          <div>
            <ProviderDispatchTracker
              title="Phlebotomist Hub"
              icon="🩸"
              providerType="phlebotomist"
              embedded
              earningsRate={200}
            />
          </div>
        )}

        {activeTab === "samples" && (
          <div style={{ display: "grid", gap: 20 }}>
            <AttendanceCard />
            <SampleCollectionPanel />
          </div>
        )}

        {activeTab === "wallet" && <PhleboWalletPanel />}

      {activeTab === "profile" && (
        <DashboardProfile profile={profile} role="phlebotomist" />
      )}
    </DashboardShell>
  );
}
