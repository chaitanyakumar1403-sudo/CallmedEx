"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { customConfirm } from "@/lib/customConfirm";
import { pcAPI } from "@/lib/api";
import {
  Users,
  UserPlus,
  ShieldCheck,
  FlaskConical,
  Mail,
  Phone,
  CheckCircle2,
  XCircle,
  KeyRound,
  Trash2,
  RefreshCw,
  Plus,
  X,
  Shield,
} from "lucide-react";

interface PCStaffPanelProps {
  pcRole?: string;
}

export default function PCStaffPanel({ pcRole = "technician" }: PCStaffPanelProps) {
  const isAdmin = pcRole === "admin";
  const [activeTab, setActiveTab] = useState<"staff" | "phlebotomists">("staff");
  const [staff, setStaff] = useState<any[]>([]);
  const [phlebotomists, setPhlebotomists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    email: "",
    full_name: "",
    mobile: "",
    password: "",
    pc_role: "technician",
  });
  const [newAccountMsg, setNewAccountMsg] = useState<string | null>(null);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const res = await pcAPI.getStaff();
      setStaff(res.staff || []);
      setPhlebotomists(res.phlebotomists || []);
    } catch (e: any) {
      toast.error(e.message || "Failed to load processing center team");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email.trim()) {
      toast.error("Please provide an email address");
      return;
    }

    setSubmitting(true);
    setNewAccountMsg(null);
    try {
      const payload: any = {
        email: form.email.trim().toLowerCase(),
        pc_role: form.pc_role,
      };
      if (form.full_name.trim()) payload.full_name = form.full_name.trim();
      if (form.mobile.trim()) payload.mobile = form.mobile.trim();
      if (form.password.trim()) payload.password = form.password.trim();

      const res = await pcAPI.addStaff(payload);
      if (res.auto_created) {
        toast.success(`Account created for ${res.email}`);
        setNewAccountMsg(
          `Staff account auto-created! Login: ${res.email} | Temporary Password: ${res.temporary_password || form.password || "CallMedex@2026"}`
        );
      } else {
        toast.success(`Assigned ${res.full_name || res.email} as ${res.pc_role}`);
      }

      setForm({
        email: "",
        full_name: "",
        mobile: "",
        password: "",
        pc_role: "technician",
      });
      fetchStaff();
    } catch (e: any) {
      toast.error(e.message || "Failed to add staff member");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRoleToggle = async (userId: string, currentRole: string) => {
    const newRole = currentRole === "admin" ? "technician" : "admin";
    if (
      !(await customConfirm(
        `Switch this staff member's role to ${newRole.toUpperCase()}?`
      ))
    )
      return;

    try {
      await pcAPI.updateStaff(userId, { pc_role: newRole });
      toast.success(`Role updated to ${newRole}`);
      fetchStaff();
    } catch (e: any) {
      toast.error(e.message || "Failed to update staff role");
    }
  };

  const handleDeactivateStaff = async (userId: string, name: string) => {
    if (
      !(await customConfirm(
        `Are you sure you want to deactivate ${name || "this staff member"} from this Processing Center?`
      ))
    )
      return;

    try {
      await pcAPI.deleteStaff(userId, false);
      toast.success("Staff member removed from active duty");
      fetchStaff();
    } catch (e: any) {
      toast.error(e.message || "Failed to deactivate staff");
    }
  };

  const handlePermanentRemoveStaff = async (userId: string, name: string, isPhlebo: boolean) => {
    const confirmPrompt = isPhlebo
      ? `Permanently remove phlebotomist ${name || "this member"} from the internal processing center staff directory? Their phlebotomist fleet account will remain intact.`
      : `Permanently delete ${name || "this staff member"} from the processing center roster? This cannot be undone.`;

    if (!(await customConfirm(confirmPrompt))) return;

    try {
      await pcAPI.deleteStaff(userId, true);
      toast.success("Staff record permanently removed");
      fetchStaff();
    } catch (e: any) {
      toast.error(e.message || "Failed to remove staff record");
    }
  };

  // Dedicated counting excluding miscategorized external phlebotomists
  const activeLabStaff = staff.filter((s) => s.is_active && !s.is_phlebotomist);
  const techniciansCount = activeLabStaff.filter((s) => s.pc_role === "technician").length;
  const adminsCount = activeLabStaff.filter((s) => s.pc_role === "admin").length;
  const phleboCount = phlebotomists.length + staff.filter((s) => s.is_phlebotomist).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Top Banner & Actions */}
      <div
        style={{
          background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
          border: "1px solid #e2e8f0",
          borderRadius: "14px",
          padding: "20px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <Users size={20} color="#0284c7" />
            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#0f172a" }}>
              Processing Centre Team &amp; Workforce
            </h3>
            <span
              style={{
                fontSize: "0.75rem",
                padding: "2px 8px",
                borderRadius: "999px",
                background: "#e0f2fe",
                color: "#0369a1",
                fontWeight: 700,
              }}
            >
              {staff.length + phlebotomists.length} Total Workforce
            </span>
          </div>
          <p style={{ margin: 0, fontSize: "0.84rem", color: "#64748b" }}>
            Manage internal laboratory technicians and monitor field phlebotomist fleet conducting doorstep specimen collections.
            {!isAdmin && " (Admin permissions required to modify staff roles)"}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            type="button"
            onClick={fetchStaff}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#475569",
              fontSize: "0.82rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <RefreshCw size={13} /> Refresh
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setShowAddModal(true);
                setNewAccountMsg(null);
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 16px",
                borderRadius: "8px",
                border: "none",
                background: "#0284c7",
                color: "#ffffff",
                fontSize: "0.84rem",
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 2px 6px rgba(2, 132, 199, 0.25)",
              }}
            >
              <UserPlus size={15} /> Add Staff / Technician
            </button>
          )}
        </div>
      </div>

      {/* Metrics Row (4 Cards) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px" }}>
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "16px 20px",
          }}
        >
          <div style={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 600, marginBottom: "4px" }}>
            Total Active Staff
          </div>
          <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0f172a" }}>
            {activeLabStaff.length}
          </div>
        </div>

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "16px 20px",
          }}
        >
          <div style={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 600, marginBottom: "4px" }}>
            Lab Technicians
          </div>
          <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#059669" }}>
            {techniciansCount}
          </div>
        </div>

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "16px 20px",
          }}
        >
          <div style={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 600, marginBottom: "4px" }}>
            Center Admins
          </div>
          <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#6366f1" }}>
            {adminsCount}
          </div>
        </div>

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "16px 20px",
          }}
        >
          <div style={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 600, marginBottom: "4px" }}>
            Field Phlebotomists
          </div>
          <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#d97706" }}>
            {phleboCount}
          </div>
        </div>
      </div>

      {/* Segmented View Switcher */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid #e2e8f0", paddingBottom: "12px" }}>
        <button
          type="button"
          onClick={() => setActiveTab("staff")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 18px",
            borderRadius: "999px",
            border: "1px solid",
            borderColor: activeTab === "staff" ? "#0284c7" : "#e2e8f0",
            background: activeTab === "staff" ? "#0284c7" : "#ffffff",
            color: activeTab === "staff" ? "#ffffff" : "#475569",
            fontWeight: 700,
            fontSize: "0.85rem",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          <FlaskConical size={14} /> Laboratory Team ({staff.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("phlebotomists")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 18px",
            borderRadius: "999px",
            border: "1px solid",
            borderColor: activeTab === "phlebotomists" ? "#d97706" : "#e2e8f0",
            background: activeTab === "phlebotomists" ? "#d97706" : "#ffffff",
            color: activeTab === "phlebotomists" ? "#ffffff" : "#475569",
            fontWeight: 700,
            fontSize: "0.85rem",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          <Users size={14} /> Field Phlebotomists ({phleboCount})
        </button>
      </div>

      {/* Tab 1: Laboratory Staff Directory */}
      {activeTab === "staff" && (
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "14px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid #f1f5f9",
              fontWeight: 700,
              fontSize: "0.92rem",
              color: "#1e293b",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>Internal Laboratory Directory</span>
            <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
              Role-Based Access: Admin (Full Operations) / Technician (Testing &amp; Intake)
            </span>
          </div>

          {loading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
              Loading team members...
            </div>
          ) : staff.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
              <Users size={32} style={{ margin: "0 auto 10px", opacity: 0.4 }} />
              <p style={{ margin: 0, fontWeight: 600 }}>No internal staff members configured yet.</p>
              {isAdmin && (
                <p style={{ fontSize: "0.82rem", marginTop: 4 }}>
                  Click &quot;Add Staff / Technician&quot; above to create or bind a team member.
                </p>
              )}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", color: "#475569", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ padding: "12px 18px", fontWeight: 700 }}>Team Member</th>
                    <th style={{ padding: "12px 18px", fontWeight: 700 }}>Email &amp; Contact</th>
                    <th style={{ padding: "12px 18px", fontWeight: 700 }}>Role</th>
                    <th style={{ padding: "12px 18px", fontWeight: 700 }}>Status</th>
                    {isAdmin && <th style={{ padding: "12px 18px", fontWeight: 700, textAlign: "right" }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {staff.map((s) => {
                    const isPhlebo = Boolean(s.is_phlebotomist || s.system_role === "phlebotomist");
                    const roleTone = isPhlebo
                      ? "#b45309"
                      : s.pc_role === "admin"
                      ? "#6366f1"
                      : "#059669";
                    const roleBg = isPhlebo
                      ? "#fef3c7"
                      : s.pc_role === "admin"
                      ? "#e0e7ff"
                      : "#d1fae5";

                    return (
                      <tr
                        key={s.id || s.user_id}
                        style={{
                          borderBottom: "1px solid #f1f5f9",
                          opacity: s.is_active ? 1 : 0.75,
                          background: isPhlebo ? "#fffbeb" : "transparent",
                        }}
                      >
                        <td style={{ padding: "14px 18px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: "50%",
                                background: roleBg,
                                color: roleTone,
                                display: "grid",
                                placeItems: "center",
                                fontWeight: 800,
                                fontSize: "0.85rem",
                              }}
                            >
                              {(s.full_name || s.email || "S").charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, color: "#0f172a", display: "flex", alignItems: "center", gap: 6 }}>
                                <span>{s.full_name || "Staff Member"}</span>
                                {isPhlebo && (
                                  <span
                                    style={{
                                      fontSize: "0.68rem",
                                      padding: "1px 6px",
                                      borderRadius: "4px",
                                      background: "#fde68a",
                                      color: "#92400e",
                                      fontWeight: 700,
                                    }}
                                  >
                                    Phlebotomist
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
                                ID: {s.user_id?.slice(0, 8)}...
                              </div>
                            </div>
                          </div>
                        </td>

                        <td style={{ padding: "14px 18px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#334155" }}>
                            <Mail size={13} color="#94a3b8" />
                            <span>{s.email}</span>
                          </div>
                          {s.mobile && (
                            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#64748b", fontSize: "0.78rem", marginTop: 2 }}>
                              <Phone size={12} color="#94a3b8" />
                              <span>{s.mobile}</span>
                            </div>
                          )}
                        </td>

                        <td style={{ padding: "14px 18px" }}>
                          <span
                            style={{
                              padding: "3px 10px",
                              borderRadius: "999px",
                              background: roleBg,
                              color: roleTone,
                              fontWeight: 700,
                              fontSize: "0.75rem",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            {isPhlebo ? (
                              <Users size={11} />
                            ) : s.pc_role === "admin" ? (
                              <Shield size={11} />
                            ) : (
                              <FlaskConical size={11} />
                            )}
                            {isPhlebo
                              ? "Phlebotomist (Field Collector)"
                              : s.pc_role === "admin"
                              ? "Center Admin"
                              : "Lab Technician"}
                          </span>
                        </td>

                        <td style={{ padding: "14px 18px" }}>
                          {s.is_active ? (
                            <span
                              style={{
                                color: "#16a34a",
                                fontWeight: 700,
                                fontSize: "0.75rem",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              <CheckCircle2 size={13} /> Active
                            </span>
                          ) : (
                            <span
                              style={{
                                color: isPhlebo ? "#b45309" : "#94a3b8",
                                fontWeight: 600,
                                fontSize: "0.75rem",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              <XCircle size={13} /> {isPhlebo ? "Inactive (Misassigned)" : "Inactive"}
                            </span>
                          )}
                        </td>

                        {isAdmin && (
                          <td style={{ padding: "14px 18px", textAlign: "right" }}>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                              {!isPhlebo && (
                                <button
                                  type="button"
                                  onClick={() => handleRoleToggle(s.user_id, s.pc_role)}
                                  title={`Switch to ${s.pc_role === "admin" ? "Technician" : "Admin"}`}
                                  style={{
                                    padding: "4px 8px",
                                    borderRadius: 6,
                                    border: "1px solid #cbd5e1",
                                    background: "#ffffff",
                                    color: "#334155",
                                    fontSize: "0.72rem",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                  }}
                                >
                                  Make {s.pc_role === "admin" ? "Technician" : "Admin"}
                                </button>
                              )}

                              {s.is_active && !isPhlebo && (
                                <button
                                  type="button"
                                  onClick={() => handleDeactivateStaff(s.user_id, s.full_name)}
                                  title="Deactivate staff member"
                                  style={{
                                    padding: "4px 8px",
                                    borderRadius: 6,
                                    border: "1px solid #fecaca",
                                    background: "#fef2f2",
                                    color: "#dc2626",
                                    fontSize: "0.72rem",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                  }}
                                >
                                  <Trash2 size={12} /> Deactivate
                                </button>
                              )}

                              {/* Hard purge option for misassigned phlebotomists or inactive ghost entries */}
                              {(isPhlebo || !s.is_active) && (
                                <button
                                  type="button"
                                  onClick={() => handlePermanentRemoveStaff(s.user_id, s.full_name, isPhlebo)}
                                  title={isPhlebo ? "Permanently remove from lab technician list" : "Delete staff record"}
                                  style={{
                                    padding: "4px 10px",
                                    borderRadius: 6,
                                    border: "1px solid #fecaca",
                                    background: "#fef2f2",
                                    color: "#dc2626",
                                    fontSize: "0.72rem",
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                  }}
                                >
                                  <Trash2 size={12} /> {isPhlebo ? "Purge Misassigned" : "Permanently Delete"}
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Field Phlebotomists Fleet */}
      {activeTab === "phlebotomists" && (
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "14px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid #f1f5f9",
              fontWeight: 700,
              fontSize: "0.92rem",
              color: "#1e293b",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <span>Sample Collection Fleet (Field Phlebotomists)</span>
              <p style={{ margin: "4px 0 0 0", fontSize: "0.78rem", color: "#64748b", fontWeight: 400 }}>
                Doorstep collectors operating in this processing centre&apos;s city sector. Specimens collected by them arrive at your intake desk for scanning.
              </p>
            </div>
            <span
              style={{
                fontSize: "0.75rem",
                padding: "3px 10px",
                borderRadius: "999px",
                background: "#fef3c7",
                color: "#b45309",
                fontWeight: 700,
              }}
            >
              {phleboCount} Bound Collectors
            </span>
          </div>

          {loading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
              Loading phlebotomist fleet...
            </div>
          ) : phleboCount === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
              <Users size={32} style={{ margin: "0 auto 10px", opacity: 0.4 }} />
              <p style={{ margin: 0, fontWeight: 600 }}>No active field phlebotomists currently assigned to this centre.</p>
              <p style={{ fontSize: "0.82rem", marginTop: 4 }}>
                When patients book home sample collections in your city, certified phlebotomists are dispatched and their specimens routed to your intake desk.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", color: "#475569", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ padding: "12px 18px", fontWeight: 700 }}>Collector Name</th>
                    <th style={{ padding: "12px 18px", fontWeight: 700 }}>Email &amp; Contact</th>
                    <th style={{ padding: "12px 18px", fontWeight: 700 }}>Role</th>
                    <th style={{ padding: "12px 18px", fontWeight: 700 }}>Field Duty Status</th>
                    <th style={{ padding: "12px 18px", fontWeight: 700 }}>Verification</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Render bound phlebotomists */}
                  {phlebotomists.map((p) => (
                    <tr key={p.user_id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: "50%",
                              background: "#fef3c7",
                              color: "#b45309",
                              display: "grid",
                              placeItems: "center",
                              fontWeight: 800,
                              fontSize: "0.85rem",
                            }}
                          >
                            {(p.full_name || p.email || "P").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: "#0f172a" }}>
                              {p.full_name || "Field Phlebotomist"}
                            </div>
                            <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
                              ID: {p.user_id?.slice(0, 8)}...
                            </div>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#334155" }}>
                          <Mail size={13} color="#94a3b8" />
                          <span>{p.email}</span>
                        </div>
                        {p.mobile && (
                          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#64748b", fontSize: "0.78rem", marginTop: 2 }}>
                            <Phone size={12} color="#94a3b8" />
                            <span>{p.mobile}</span>
                          </div>
                        )}
                      </td>

                      <td style={{ padding: "14px 18px" }}>
                        <span
                          style={{
                            padding: "3px 10px",
                            borderRadius: "999px",
                            background: "#fef3c7",
                            color: "#b45309",
                            fontWeight: 700,
                            fontSize: "0.75rem",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <Users size={11} /> Field Phlebotomist
                        </span>
                      </td>

                      <td style={{ padding: "14px 18px" }}>
                        {p.on_duty ? (
                          <span
                            style={{
                              color: "#16a34a",
                              fontWeight: 700,
                              fontSize: "0.75rem",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <CheckCircle2 size={13} /> On Duty / In Field
                          </span>
                        ) : (
                          <span
                            style={{
                              color: "#64748b",
                              fontWeight: 600,
                              fontSize: "0.75rem",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <XCircle size={13} /> Off Duty
                          </span>
                        )}
                      </td>

                      <td style={{ padding: "14px 18px" }}>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: "999px",
                            background: "#dcfce7",
                            color: "#166534",
                            fontSize: "0.72rem",
                            fontWeight: 700,
                          }}
                        >
                          {p.verification_status || "Verified"}
                        </span>
                      </td>
                    </tr>
                  ))}

                  {/* Render any misassigned phlebo from staff list in the fleet view as well */}
                  {staff
                    .filter((s) => s.is_phlebotomist || s.system_role === "phlebotomist")
                    .filter((s) => !phlebotomists.some((p) => p.user_id === s.user_id))
                    .map((s) => (
                      <tr key={`extra-${s.user_id}`} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "14px 18px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: "50%",
                                background: "#fef3c7",
                                color: "#b45309",
                                display: "grid",
                                placeItems: "center",
                                fontWeight: 800,
                                fontSize: "0.85rem",
                              }}
                            >
                              {(s.full_name || s.email || "P").charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, color: "#0f172a" }}>
                                {s.full_name || "Field Phlebotomist"}
                              </div>
                              <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
                                ID: {s.user_id?.slice(0, 8)}...
                              </div>
                            </div>
                          </div>
                        </td>

                        <td style={{ padding: "14px 18px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#334155" }}>
                            <Mail size={13} color="#94a3b8" />
                            <span>{s.email}</span>
                          </div>
                          {s.mobile && (
                            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#64748b", fontSize: "0.78rem", marginTop: 2 }}>
                              <Phone size={12} color="#94a3b8" />
                              <span>{s.mobile}</span>
                            </div>
                          )}
                        </td>

                        <td style={{ padding: "14px 18px" }}>
                          <span
                            style={{
                              padding: "3px 10px",
                              borderRadius: "999px",
                              background: "#fef3c7",
                              color: "#b45309",
                              fontWeight: 700,
                              fontSize: "0.75rem",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <Users size={11} /> Field Phlebotomist
                          </span>
                        </td>

                        <td style={{ padding: "14px 18px" }}>
                          <span
                            style={{
                              color: "#16a34a",
                              fontWeight: 700,
                              fontSize: "0.75rem",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <CheckCircle2 size={13} /> Active Fleet
                          </span>
                        </td>

                        <td style={{ padding: "14px 18px" }}>
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: "999px",
                              background: "#dcfce7",
                              color: "#166534",
                              fontSize: "0.72rem",
                              fontWeight: 700,
                            }}
                          >
                            Verified
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add Staff Modal */}
      {showAddModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "grid",
            placeItems: "center",
            zIndex: 9999,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              padding: "24px",
              width: "100%",
              maxWidth: "500px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    padding: "6px",
                    borderRadius: "8px",
                    background: "#e0f2fe",
                    color: "#0284c7",
                  }}
                >
                  <UserPlus size={18} />
                </div>
                <h4 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "#0f172a" }}>
                  Provision Staff / Technician
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#64748b",
                }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: "0 0 16px 0", fontSize: "0.82rem", color: "#64748b", lineHeight: 1.5 }}>
              Staff accounts are created with role <strong>processing_center</strong> and activated instantly without MOU requirement.
            </p>

            {newAccountMsg && (
              <div
                style={{
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  marginBottom: "16px",
                  fontSize: "0.82rem",
                  color: "#166534",
                  fontWeight: 600,
                }}
              >
                {newAccountMsg}
              </div>
            )}

            <form onSubmit={handleAddStaff} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="technician@callmedex.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.85rem",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Varma"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.85rem",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                    Role *
                  </label>
                  <select
                    value={form.pc_role}
                    onChange={(e) => setForm({ ...form, pc_role: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "0.85rem",
                    }}
                  >
                    <option value="technician">Lab Technician</option>
                    <option value="admin">Center Admin</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                    Mobile Number
                  </label>
                  <input
                    type="tel"
                    placeholder="10-digit mobile"
                    value={form.mobile}
                    onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "0.85rem",
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                  Initial Password (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Default: CallMedex@2026"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.85rem",
                  }}
                />
                <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
                  If left blank, CallMedex@2026 will be assigned as initial password.
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#475569",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: "8px 18px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#0284c7",
                    color: "#ffffff",
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    cursor: submitting ? "not-allowed" : "pointer",
                  }}
                >
                  {submitting ? "Provisioning..." : "Provision Staff Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
