"use client";

import { useState, useEffect } from "react";
import ProviderDispatchTracker from "../components/ProviderDispatchTracker";
import DashboardProfile from "../components/DashboardProfile";
import { useRouter } from "next/navigation";
import { Button, Icon } from "@/components/ui";
import { MapPin, Stethoscope, User } from "@/components/ui/icons";

import NurseToolsModal from "../../../components/NurseToolsModal";
import DashboardShell, { SkeletonRows } from "../components/DashboardShell";

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('token') : null;

export default function NurseDashboard() {
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
        if (data.success && data.data.role === "nurse") {
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
    { id: "dispatch", label: "Live Dispatch", icon: MapPin },
    { id: "profile", label: "Profile", icon: User },
  ];

  if (loading) {
    return (
      <DashboardShell role="nurse" title="Home Nursing" subtitle="Loading your visits…"
        tabs={[]} activeTab="" onTabChange={() => {}}>
        <SkeletonRows rows={3} />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      role="nurse"
      title="Home Nursing"
      subtitle={`${profile?.full_name || "Nurse"} — home visits, wound care and nursing dispatch`}
      tabs={TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      aside={
        <Button variant="secondary" onClick={() => setShowToolsModal(true)}>
          <Icon as={Stethoscope} size={16} />
          Care guide
        </Button>
      }
    >
      <NurseToolsModal isOpen={showToolsModal} onClose={() => setShowToolsModal(false)} />

        <div style={{ display: activeTab === "dispatch" ? "block" : "none" }}>
          <ProviderDispatchTracker
            title="Nurse Care Station"
            providerType="nurse"
            embedded
            earningsRate={350}
          />
        </div>

      {activeTab === "profile" && (
        <DashboardProfile profile={profile} role="nurse" />
      )}
    </DashboardShell>
  );
}
