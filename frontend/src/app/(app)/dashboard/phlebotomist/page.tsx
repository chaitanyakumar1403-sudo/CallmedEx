"use client";

import { useState, useEffect } from "react";
import ProviderDispatchTracker from "../components/ProviderDispatchTracker";
import DashboardProfile from "../components/DashboardProfile";
import SampleCollectionPanel from "../components/SampleCollectionPanel";
import PhleboWalletPanel from "../components/PhleboWalletPanel";
import AttendanceCard from "../components/AttendanceCard";
import DoorstepScanPanel from "../components/DoorstepScanPanel";
import { useRouter } from "next/navigation";
import { Button, Icon } from "@/components/ui";
import { MapPin, TestTube, Wallet, User, ScanLine } from "@/components/ui/icons";

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

  const [collectionBookingId, setCollectionBookingId] = useState("");

  const TABS = [
    { id: "dispatch", label: "Live Dispatch", icon: MapPin },
    { id: "collection", label: "Collection", icon: ScanLine },
    { id: "samples", label: "Samples & Handover", icon: TestTube },
    { id: "wallet", label: "Wallet", icon: Wallet },
    { id: "profile", label: "Profile", icon: User },
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
        <Button variant="secondary" onClick={() => setShowToolsModal(true)}>
          <Icon as={TestTube} size={16} />
          Tube guide
        </Button>
      }
    >
      <PhlebotomistToolsModal isOpen={showToolsModal} onClose={() => setShowToolsModal(false)} />

        {activeTab === "dispatch" && (
          <div>
            <ProviderDispatchTracker
              title="Phlebotomist Hub"
              providerType="phlebotomist"
              embedded
              earningsRate={200}
            />
          </div>
        )}

        {activeTab === "collection" && (
          <div className="cm-stack">
            <div className="card" style={{ padding: 16 }}>
              <label style={{ fontWeight: 600, fontSize: "0.9rem", color: "#475569" }}>
                Enter Booking ID for doorstep collection
              </label>
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <input
                  value={collectionBookingId}
                  onChange={(e) => setCollectionBookingId(e.target.value)}
                  placeholder="Booking ID or scan…"
                  style={{
                    flex: 1, padding: "10px 14px", borderRadius: 8,
                    border: "1.5px solid #cbd5e1", fontFamily: "monospace",
                    fontSize: "0.9rem",
                  }}
                />
              </div>
            </div>
            {collectionBookingId.trim() && (
              <DoorstepScanPanel bookingId={collectionBookingId.trim()} />
            )}
          </div>
        )}

        {activeTab === "samples" && (
          <div className="cm-stack">
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
