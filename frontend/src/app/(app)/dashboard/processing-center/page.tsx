"use client";

/**
 * Processing Center Dashboard — /dashboard/processing-center
 *
 * The operational command centre for diagnostic lab staff. Four tabs:
 *   Queue   — Capacity tiles and expected tube breakdown
 *   Intake  — Barcode scan + 5-point verification
 *   Batches — Create, seal, and dispatch to reference lab
 *   Roster  — Advance phlebotomist roster management
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardShell from "../components/DashboardShell";
import type { DashTab } from "../components/DashboardShell";
import PCQueuePanel from "../components/PCQueuePanel";
import PCIntakePanel from "../components/PCIntakePanel";
import PCBatchPanel from "../components/PCBatchPanel";
import PCRosterPanel from "../components/PCRosterPanel";
import { pcAPI } from "@/lib/api";
import { Building2 } from "lucide-react";

const TABS: DashTab[] = [
  { id: "queue", label: "Queue" },
  { id: "intake", label: "Intake & Verify" },
  { id: "batches", label: "Batches" },
  { id: "roster", label: "Roster" },
];

export default function ProcessingCenterDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("queue");
  const [centre, setCentre] = useState<any>(null);
  const [pcRole, setPcRole] = useState("");
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      try {
        const userStr = localStorage.getItem("user");
        if (!userStr) {
          router.push("/auth/login");
          return;
        }
        const user = JSON.parse(userStr);
        if (user.role !== "processing_center") {
          router.push("/dashboard/" + user.role);
          return;
        }

        // Fetch centre info
        const data = await pcAPI.getMe();
        setCentre(data.center);
        setPcRole(data.pc_role || "technician");
      } catch {
        router.push("/auth/login");
      } finally {
        setAuthChecked(true);
      }
    }
    checkAuth();
  }, [router]);

  if (!authChecked) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex",
        alignItems: "center", justifyContent: "center",
        color: "#64748b", fontSize: "1rem",
      }}>
        Loading…
      </div>
    );
  }

  if (!centre) {
    return (
      <DashboardShell
        role="processing_center"
        title="Processing Center Dashboard"
        subtitle="Operational Command Center"
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      >
        <div className="cm-card" style={{ padding: "var(--cm-6)", textAlign: "center", borderRadius: "var(--cm-radius)", border: "1px solid var(--cm-line)" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--cm-surface-2)", color: "var(--cm-navy)", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
            <Building2 size={28} />
          </div>
          <h3 style={{ color: "var(--cm-ink)", margin: "0 0 8px 0", fontSize: "var(--cm-text-base)", fontWeight: 800 }}>Processing Center Staff Account</h3>
          <p style={{ color: "var(--cm-ink-3)", fontSize: "var(--cm-text-sm)", maxWidth: 500, margin: "0 auto 20px auto", lineHeight: 1.5 }}>
            Your account is authenticated as Processing Center staff. Once assigned to a specific branch in the Admin Panel, your live queue, intake scans, batches, and roster tools will activate automatically.
          </p>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      role="processing_center"
      title={centre.name || "Processing Center"}
      subtitle={`${centre.code || ""} • ${centre.city || ""} • ${pcRole}`}
      tabs={TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {activeTab === "queue" && <PCQueuePanel />}
      {activeTab === "intake" && <PCIntakePanel />}
      {activeTab === "batches" && <PCBatchPanel />}
      {activeTab === "roster" && <PCRosterPanel />}
    </DashboardShell>
  );
}
