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
import {
  MapPin, TestTube, Wallet, User, ScanLine, Package, CalendarDays,
  Camera, Search, X, ShieldCheck, Check
} from "@/components/ui/icons";
import { BarcodeScannerModal } from "@/components/BarcodeScannerModal";

import PhlebotomistToolsModal from "../../../components/PhlebotomistToolsModal";
import PhleboSchedulePanel from "../components/PhleboSchedulePanel";
import PhleboFieldOps3D from "../components/PhleboFieldOps3D";
import AdvanceHomeCollectionsWidget from "../components/AdvanceHomeCollectionsWidget";
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
  const [barcodeScannerOpen, setBarcodeScannerOpen] = useState(false);

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

  const handleStartCollection = (bookingId: string) => {
    setCollectionBookingId(bookingId);
    setActiveTab("collection");
  };

  // Full-time collectors are salaried — incentives only, no per-collection
  // accrual — so a wallet showing "earnings" is meaningless to them and reads
  // as if pay were missing. Part-time and freelance keep it.
  const isSalaried = (profile?.phleb_type || "full_time") === "full_time";

  const TABS = [
    { id: "dispatch", label: "Live Dispatch", icon: MapPin },
    { id: "collection", label: "Doorstep Collection", icon: ScanLine },
    { id: "samples", label: "Samples & Handover", icon: TestTube },
    { id: "schedule", label: "Schedule", icon: CalendarDays },
    { id: "stock", label: "Kit & Stock", icon: Package },
    ...(isSalaried ? [] : [{ id: "wallet", label: "Wallet", icon: Wallet }]),
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

      <BarcodeScannerModal
        open={barcodeScannerOpen}
        onClose={() => setBarcodeScannerOpen(false)}
        onScan={(code) => {
          setCollectionBookingId(code);
          setBarcodeScannerOpen(false);
        }}
        title="Scan Patient Barcode"
      />

        <div className={activeTab === "dispatch" ? "" : "tab-panel-hidden"}>
          {/* Mounted only while the tab is open: a hidden panel has zero width,
              so a WebGL context built here would size itself to nothing. */}
          {activeTab === "dispatch" && <PhleboFieldOps3D tasks={activeTasks} />}
          <AdvanceHomeCollectionsWidget onSelectBookingForCollection={handleStartCollection} />
          <ProviderDispatchTracker
            title="Phlebotomist Hub"
            providerType="phlebotomist"
            embedded
          />
        </div>

        {activeTab === "collection" && (
          <div className="cm-stack">
            {/* ── Console Header Card ───────────────────────────────── */}
            <div className="cm-phlebo-console-header">
              <div className="cm-phlebo-badge">
                <Icon as={ShieldCheck} size={14} /> Specimen Verification Console
              </div>
              <h2 className="cm-phlebo-title">
                <Icon as={ScanLine} size={24} /> Doorstep Specimen Verification
              </h2>
              <p className="cm-phlebo-desc">
                Real-time vacutainer barcode scanning, cap color matching, chain-of-custody GPS locking, and doorstep add-on test ordering.
              </p>

              <div className="cm-phlebo-search-box">
                <Icon as={Search} size={20} />
                <input
                  value={collectionBookingId}
                  onChange={(e) => setCollectionBookingId(e.target.value)}
                  placeholder="Enter Booking ID (UUID) or scan barcode..."
                  className="cm-phlebo-search-input"
                />
                {collectionBookingId && (
                  <button
                    type="button"
                    onClick={() => setCollectionBookingId("")}
                    className="cm-phlebo-scan-btn"
                  >
                    <Icon as={X} size={14} /> Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setBarcodeScannerOpen(true)}
                  className="cm-phlebo-scan-btn"
                >
                  <Icon as={Camera} size={16} /> Scan Barcode
                </button>
              </div>
            </div>

            {/* ── Active Run Selector ───────────────────────────────── */}
            {activeTasks.length > 0 && (
              <div className="card cm-phlebo-card">
                <div className="run-picker__title">
                  <Icon as={MapPin} size={16} /> Select Active Run for Doorstep Collection
                </div>
                <div className="cm-phlebo-run-grid">
                  {activeTasks.map((t: any) => {
                    const isSelected = collectionBookingId === (t.booking_id || t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setCollectionBookingId(t.booking_id || t.id)}
                        className={`cm-phlebo-run-card ${isSelected ? "cm-phlebo-run-card--selected" : ""}`}
                      >
                        <div className="cm-phlebo-run-card__header">
                          <div>
                            <div className="cm-phlebo-run-card__name">
                              {(t.service_subtype || t.service_type || "Home Collection").replace(/_/g, " ")}
                            </div>
                            <div className="cm-phlebo-run-card__addr">
                              {t.patient_address || "Patient home address"}
                            </div>
                          </div>
                        </div>
                        <div className="cm-phlebo-run-card__footer">
                          <span className="cm-phlebo-run-card__pill">
                            ID: {t.booking_id ? t.booking_id.slice(0, 8) : t.id?.slice(0, 8)}
                          </span>
                          <span className={`cm-phlebo-run-card__pill ${isSelected ? "cm-phlebo-run-card__pill--selected" : ""}`}>
                            {isSelected ? (
                              <>
                                <Icon as={Check} size={14} /> Active Target
                              </>
                            ) : (
                              "Select for Draw"
                            )}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Panel or Idle Guidance ─────────────────────────────── */}
            {collectionBookingId.trim() ? (
              <DoorstepScanPanel bookingId={collectionBookingId.trim()} />
            ) : (
              <div className="cm-phlebo-idle-card">
                <div className="cm-phlebo-idle-icon-ring">
                  <Icon as={ScanLine} size={24} />
                </div>
                <h3 className="cm-phlebo-idle-title">
                  Ready for Doorstep Specimen Validation
                </h3>
                <p className="cm-phlebo-idle-desc">
                  Scan the patient&apos;s tube barcode, enter a Booking ID in the search bar above, or pick an assigned run from Live Dispatch to begin specimen verification.
                </p>
                <div className="cm-phlebo-idle-actions">
                  <Button variant="primary" onClick={() => setBarcodeScannerOpen(true)}>
                    <Icon as={Camera} size={16} /> Scan with Camera
                  </Button>
                  <Button variant="secondary" onClick={() => setActiveTab("dispatch")}>
                    <Icon as={MapPin} size={16} /> Open Live Dispatch
                  </Button>
                </div>
                <div className="cm-phlebo-protocol-steps">
                  <div className="cm-phlebo-step">
                    <span className="cm-phlebo-step__num">1</span>
                    <div className="cm-phlebo-step__text">
                      <span className="cm-phlebo-step__title">Scan Tube Label</span>
                      Point camera at the barcode sticker on the drawn vacutainer.
                    </div>
                  </div>
                  <div className="cm-phlebo-step">
                    <span className="cm-phlebo-step__num">2</span>
                    <div className="cm-phlebo-step__text">
                      <span className="cm-phlebo-step__title">Cap Color Match</span>
                      System verifies cap color against requested clinical test panels.
                    </div>
                  </div>
                  <div className="cm-phlebo-step">
                    <span className="cm-phlebo-step__num">3</span>
                    <div className="cm-phlebo-step__text">
                      <span className="cm-phlebo-step__title">Chain of Custody</span>
                      Digital lock records GPS coordinate &amp; timestamp for lab handover.
                    </div>
                  </div>
                </div>
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

        {activeTab === "schedule" && (
          <div className="cm-stack">
            <AdvanceHomeCollectionsWidget onSelectBookingForCollection={handleStartCollection} />
            <PhleboSchedulePanel />
          </div>
        )}

        {activeTab === "wallet" && !isSalaried && <PhleboWalletPanel />}

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
