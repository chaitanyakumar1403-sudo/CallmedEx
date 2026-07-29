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
  const [activeTasks, setActiveTasks] = useState<any[]>([]);

  useEffect(() => {
    const fetchTasks = async () => {
      const token = getToken();
      if (!token) return;
      try {
        const res = await fetch(`${apiBase}/api/dispatch/my-tasks`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const list = data.tasks || [];
          setActiveTasks(list);
          const active = list.find((t: any) =>
            ["provider_accepted", "en_route", "arrived", "in_progress"].includes(t.status)
          );
          if (active?.booking_id) {
            setCollectionBookingId(active.booking_id);
          } else if (list.length > 0 && list[0].booking_id) {
            setCollectionBookingId(list[0].booking_id);
          }
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchTasks();
  }, []);

  const TABS = [
    { id: "dispatch", label: "Live Dispatch", icon: MapPin },
    { id: "collection", label: "Doorstep Collection", icon: ScanLine },
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

        <div style={{ display: activeTab === "dispatch" ? "block" : "none" }}>
          <ProviderDispatchTracker
            title="Phlebotomist Hub"
            providerType="phlebotomist"
            embedded
            earningsRate={200}
          />
        </div>

        {activeTab === "collection" && (
          <div className="cm-stack">
            {activeTasks.length > 0 && (
              <div className="card" style={{ padding: 16 }}>
                <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#0f172a", marginBottom: 10 }}>
                  📍 Select Active Run for Doorstep Collection
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {activeTasks.map((t: any) => {
                    const isSelected = collectionBookingId === t.booking_id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setCollectionBookingId(t.booking_id || t.id)}
                        style={{
                          textAlign: "left", padding: "12px 14px", borderRadius: 10,
                          border: isSelected ? "2px solid #1a2b4a" : "1px solid #cbd5e1",
                          background: isSelected ? "#f0f9ff" : "#fff",
                          cursor: "pointer", display: "flex", justifyContent: "space-between",
                          alignItems: "center", gap: 10,
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#0f172a" }}>
                            {(t.service_subtype || t.service_type || "Home Collection").replace(/_/g, " ")}
                          </div>
                          <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: 2 }}>
                            {t.patient_address || "Patient address"}
                          </div>
                        </div>
                        <span style={{
                          padding: "4px 10px", borderRadius: 999, fontSize: "0.75rem",
                          fontWeight: 700, background: isSelected ? "#1a2b4a" : "#f1f5f9",
                          color: isSelected ? "#fff" : "#475569",
                        }}>
                          {isSelected ? "Selected" : "Select"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="card" style={{ padding: 16 }}>
              <label style={{ fontWeight: 600, fontSize: "0.85rem", color: "#475569" }}>
                Or search / scan Booking ID manually
              </label>
              <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                <input
                  value={collectionBookingId}
                  onChange={(e) => setCollectionBookingId(e.target.value)}
                  placeholder="Booking ID (UUID) or scan barcode…"
                  style={{
                    flex: 1, padding: "10px 14px", borderRadius: 8,
                    border: "1.5px solid #cbd5e1", fontFamily: "monospace",
                    fontSize: "0.9rem",
                  }}
                />
              </div>
            </div>

            {collectionBookingId.trim() ? (
              <DoorstepScanPanel bookingId={collectionBookingId.trim()} />
            ) : (
              <div className="card" style={{ padding: 24, textAlign: "center", color: "#64748b" }}>
                Select a run above or enter a Booking ID to validate tubes & add doorstep tests.
              </div>
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
