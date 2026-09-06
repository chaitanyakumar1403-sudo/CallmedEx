"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Sparkles,
  ChevronUp,
  ChevronDown,
  Stethoscope,
  Activity,
  HeartHandshake,
  Syringe,
  Droplet,
  Building2,
  Pill,
  Users,
  Factory,
  ShieldCheck,
  User,
  CheckCircle2,
  X,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import Clinical3DIcon, { Clinical3DIconName } from "@/components/ui/Clinical3DIcon";

interface MasterPersona {
  role: string;
  slug: string;
  label: string;
  personaName: string;
  badge: string;
  iconName: Clinical3DIconName;
}

const ALL_MASTER_ROLES: MasterPersona[] = [
  {
    role: "patient",
    slug: "patient",
    label: "Patient Portal",
    personaName: "Rahul Sharma",
    badge: "Active Patient",
    iconName: "patient",
  },
  {
    role: "doctor",
    slug: "doctor",
    label: "Doctor Workstation",
    personaName: "Dr. Latchireddi SA Naidu",
    badge: "Clinical Cardio (NI)",
    iconName: "stethoscope",
  },
  {
    role: "dentist",
    slug: "dentist",
    label: "Dental Clinic Console",
    personaName: "Dr. Anita Rao",
    badge: "BDS, MDS Oral Surgery",
    iconName: "dental",
  },
  {
    role: "physiotherapist",
    slug: "physiotherapist",
    label: "Physiotherapy Console",
    personaName: "Dr. Vikram Reddy",
    badge: "BPT, MPT Neuro & Ortho",
    iconName: "physio",
  },
  {
    role: "dietitian",
    slug: "dietitian",
    label: "Clinical Dietitian",
    personaName: "Dr. Sneha Patel",
    badge: "M.Sc Clinical Nutrition",
    iconName: "dietitian",
  },
  {
    role: "nurse",
    slug: "nurse",
    label: "Nurse Care Hub",
    personaName: "Sister Priya Sharma",
    badge: "B.Sc Nursing Critical Care",
    iconName: "nurse",
  },
  {
    role: "phlebotomist",
    slug: "phlebotomist",
    label: "Phlebotomist Mobile",
    personaName: "Rajesh Verma",
    badge: "Full-Time 25km Lead",
    iconName: "phlebo",
  },
  {
    role: "organization",
    slug: "organization",
    label: "Organization Command",
    personaName: "Visakha Multispeciality Clinics",
    badge: "Polyclinic / Hospital",
    iconName: "hospital",
  },
  {
    role: "pharmacy",
    slug: "pharmacy",
    label: "Pharmacy Fulfillment",
    personaName: "CallMedex Prime Pharmacy",
    badge: "24x7 Emergency Retail",
    iconName: "pharmacy",
  },
  {
    role: "staff",
    slug: "staff",
    label: "Staff Desk",
    personaName: "Kavitha Rao",
    badge: "Front Desk & Admissions",
    iconName: "staff",
  },
  {
    role: "processing_center",
    slug: "processing-center",
    label: "Processing Center",
    personaName: "Vizag Central Hub",
    badge: "NABL Molecular Lab",
    iconName: "diagnostics",
  },
  {
    role: "admin",
    slug: "admin",
    label: "Owner / Admin Center",
    personaName: "Chaitanya Kumar",
    badge: "Platform Super Admin",
    iconName: "shield",
  },
];

export default function MasterRoleTeleporterHUD() {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);

  useEffect(() => {
    try {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const u = JSON.parse(userStr);
        if (u?.master_owner || u?.is_owner || u?.role === "admin") {
          setCurrentUser(u);
        } else {
          setCurrentUser(null);
        }
      }
    } catch {
      setCurrentUser(null);
    }
  }, [pathname]);

  if (!currentUser) return null;

  const currentRole = currentUser.role || "patient";
  const masterOwnerEmail = currentUser.master_owner || currentUser.email || "chaitanyakumarf11@gmail.com";

  const handleSwitchRole = async (targetPersona: MasterPersona) => {
    if (targetPersona.role === currentRole && pathname?.includes(`/dashboard/${targetPersona.slug}`)) {
      setIsOpen(false);
      return;
    }

    setSwitchingTo(targetPersona.role);
    try {
      const token = localStorage.getItem("token");
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "";

      const res = await fetch(`${apiBase}/api/auth/master-switch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ target_role: targetPersona.role }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Switching to ${targetPersona.label} failed`);
      }

      const data = await res.json();
      localStorage.setItem("token", data.access_token);
      if (data.refresh_token) {
        localStorage.setItem("refreshToken", data.refresh_token);
      }
      localStorage.setItem("user", JSON.stringify(data.user));

      toast.success(`Teleported to ${targetPersona.label}`, {
        description: `Now inspecting as ${data.user.full_name} (${targetPersona.badge})`,
      });

      setIsOpen(false);
      router.push(`/dashboard/${targetPersona.slug}`);
      setTimeout(() => {
        window.location.href = `/dashboard/${targetPersona.slug}`;
      }, 150);
    } catch (err: any) {
      console.error("Master switch error:", err);
      toast.error("Role Switch Failed", {
        description: err.message || "Could not switch persona.",
      });
    } finally {
      setSwitchingTo(null);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        left: 24,
        zIndex: 99999,
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Floating Pill Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 16px 8px 12px",
          background: "linear-gradient(135deg, #0f1d33 0%, #1e3a8a 100%)",
          color: "#ffffff",
          border: "1.5px solid rgba(56, 189, 248, 0.4)",
          borderRadius: 999,
          boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.4), 0 0 15px rgba(2, 132, 199, 0.3)",
          cursor: "pointer",
          backdropFilter: "blur(12px)",
          transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
        title="Owner Persona & Dashboard Teleporter"
      >
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
            color: "#ffffff",
            display: "grid",
            placeItems: "center",
            fontSize: "0.75rem",
            fontWeight: 900,
            boxShadow: "0 2px 6px rgba(245, 158, 11, 0.5)",
          }}
        >
          👑
        </span>
        <div style={{ textAlign: "left", lineHeight: 1.2 }}>
          <div style={{ fontSize: "0.68rem", color: "#38bdf8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Master Teleporter
          </div>
          <div style={{ fontSize: "0.82rem", fontWeight: 750, color: "#ffffff", display: "flex", alignItems: "center", gap: 6 }}>
            <span>{ALL_MASTER_ROLES.find((r) => r.role === currentRole)?.label || currentRole}</span>
          </div>
        </div>
        {isOpen ? <ChevronDown size={16} style={{ color: "#93c5fd" }} /> : <ChevronUp size={16} style={{ color: "#93c5fd" }} />}
      </button>

      {/* Expanded Teleporter Modal Popover */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            bottom: 56,
            left: 0,
            width: "360px",
            maxHeight: "80vh",
            background: "rgba(15, 29, 51, 0.95)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1.5px solid rgba(56, 189, 248, 0.3)",
            borderRadius: 20,
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 25px rgba(2, 132, 199, 0.25)",
            padding: "20px 18px",
            color: "#ffffff",
            display: "flex",
            flexDirection: "column",
            gap: 14,
            animation: "fadeInUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid rgba(255, 255, 255, 0.12)", paddingBottom: 12 }}>
            <div>
              <div style={{ fontSize: "0.72rem", color: "#38bdf8", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Founder & Owner Control
              </div>
              <h4 style={{ margin: "2px 0 0", fontSize: "1rem", fontWeight: 800, color: "#ffffff" }}>
                Teleport to Any Dashboard
              </h4>
              <div style={{ fontSize: "0.72rem", color: "rgba(255, 255, 255, 0.6)", marginTop: 2 }}>
                Signed in as: <strong style={{ color: "#e2e8f0" }}>{masterOwnerEmail}</strong>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: "rgba(255, 255, 255, 0.1)",
                border: "none",
                borderRadius: "50%",
                width: 28,
                height: 28,
                display: "grid",
                placeItems: "center",
                color: "#cbd5e1",
                cursor: "pointer",
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Roles Grid */}
          <div
            style={{
              overflowY: "auto",
              maxHeight: "50vh",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              paddingRight: 4,
            }}
          >
            {ALL_MASTER_ROLES.map((item) => {
              const isCurrent = item.role === currentRole;
              const isSwitching = switchingTo === item.role;

              return (
                <button
                  key={item.role}
                  type="button"
                  onClick={() => handleSwitchRole(item)}
                  disabled={isSwitching}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 12px",
                    borderRadius: 12,
                    background: isCurrent
                      ? "linear-gradient(135deg, rgba(2, 132, 199, 0.35) 0%, rgba(3, 105, 161, 0.25) 100%)"
                      : "rgba(255, 255, 255, 0.05)",
                    border: isCurrent
                      ? "1.5px solid #0284c7"
                      : "1px solid rgba(255, 255, 255, 0.08)",
                    color: "#ffffff",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isCurrent) e.currentTarget.style.background = "rgba(255, 255, 255, 0.12)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isCurrent) e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                  }}
                >
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      background: isCurrent ? "#0284c7" : "rgba(255, 255, 255, 0.1)",
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Clinical3DIcon name={item.iconName} size={20} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "0.85rem", fontWeight: 750, color: "#ffffff" }}>
                        {item.label}
                      </span>
                      {isCurrent && (
                        <span style={{ fontSize: "0.65rem", background: "#10b981", color: "#ffffff", padding: "1px 6px", borderRadius: 10, fontWeight: 700 }}>
                          Current
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "#94a3b8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {item.personaName} · <span style={{ color: "#38bdf8" }}>{item.badge}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Quick Notice */}
          <div
            style={{
              fontSize: "0.68rem",
              color: "#94a3b8",
              borderTop: "1px solid rgba(255, 255, 255, 0.1)",
              paddingTop: 8,
              textAlign: "center",
              lineHeight: 1.4,
            }}
          >
            🔒 Zero-lock dev mode: all 12 personas are pre-verified & active.
          </div>
        </div>
      )}
    </div>
  );
}
