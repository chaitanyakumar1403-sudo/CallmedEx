"use client";

import { useState, useEffect } from "react";
import ProviderDispatchTracker from "../components/ProviderDispatchTracker";
import DashboardProfile from "../components/DashboardProfile";
import SampleCollectionPanel from "../components/SampleCollectionPanel";
import PhleboWalletPanel from "../components/PhleboWalletPanel";
import PhleboStockPanel from "../components/PhleboStockPanel";
import PhleboPerformancePanel from "../components/PhleboPerformancePanel";
import AttendanceCard from "../components/AttendanceCard";
import DoorstepScanPanel from "../components/DoorstepScanPanel";
import { useRouter } from "next/navigation";
import { Button, Icon } from "@/components/ui";
import { MapPin, TestTube, Wallet, User, ScanLine, Package, CalendarDays } from "@/components/ui/icons";

import PhlebotomistToolsModal from "../../../components/PhlebotomistToolsModal";
import PhleboSchedulePanel from "../components/PhleboSchedulePanel";
import SelfieVerificationCard from "../components/SelfieVerificationCard";
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
    { id: "schedule", label: "Schedule", icon: CalendarDays },
    { id: "stock", label: "Kit & Stock", icon: Package },
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

        <div className={activeTab === "dispatch" ? "" : "tab-panel-hidden"}>
          <ProviderDispatchTracker
            title="Phlebotomist Hub"
            providerType="phlebotomist"
            embedded
          />
        </div>

        {activeTab === "collection" && (
          <div className="cm-stack">
            {activeTasks.length > 0 && (
              <div className="card run-picker">
                <div className="run-picker__title">
                  <Icon as={MapPin} size={16} /> Select Active Run for Doorstep Collection
                </div>
                <div className="run-picker__grid">
                  {activeTasks.map((t: any) => {
                    const isSelected = collectionBookingId === t.booking_id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setCollectionBookingId(t.booking_id || t.id)}
                        className={isSelected ? "run-picker__run run-picker__run--selected" : "run-picker__run"}
                      >
                        <div>
                          <div className="run-picker__run-name">
                            {(t.service_subtype || t.service_type || "Home Collection").replace(/_/g, " ")}
                          </div>
                          <div className="run-picker__run-addr">
                            {t.patient_address || "Patient address"}
                          </div>
                        </div>
                        <span className={isSelected ? "run-picker__pill run-picker__pill--selected" : "run-picker__pill"}>
                          {isSelected ? "Selected" : "Select"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="card run-picker">
              <label className="run-picker__label">
                Or search / scan Booking ID manually
              </label>
              <div className="run-picker__input-row">
                <input
                  value={collectionBookingId}
                  onChange={(e) => setCollectionBookingId(e.target.value)}
                  placeholder="Booking ID (UUID) or scan barcode…"
                  className="run-picker__input"
                />
              </div>
            </div>

            {collectionBookingId.trim() ? (
              <DoorstepScanPanel bookingId={collectionBookingId.trim()} />
            ) : (
              <div className="card run-picker__empty">
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

        {activeTab === "stock" && <PhleboStockPanel />}

        {activeTab === "schedule" && <PhleboSchedulePanel />}

        {activeTab === "wallet" && <PhleboWalletPanel />}

      {activeTab === "profile" && (
        <>
          <SelfieVerificationCard />
          <PhleboPerformancePanel />
          <DashboardProfile profile={profile} role="phlebotomist" />
        </>
      )}
    </DashboardShell>
  );
}
