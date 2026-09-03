"use client";

import { useEffect, useState } from "react";
import { Users, UserCheck, CheckCircle2, AlertCircle, Trash2, Calendar, Phone, Plus, X } from "@/components/ui/icons";

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const getToken = () => typeof window !== "undefined" ? localStorage.getItem("token") : null;

interface FamilyMember {
  id: string;
  full_name: string;
  relationship: string;
  gender: string;
  date_of_birth: string | null;
  mobile: string;
  is_self: boolean;
}

export default function FamilyMembersPanel() {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ full_name: "", relationship: "", gender: "", date_of_birth: "", mobile: "", address: "", city: "", district: "", pincode: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchMembers = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${apiBase}/api/family-members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
      }
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMembers(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.relationship.trim()) {
      setMsg({ type: "error", text: "Name and relationship are required." });
      return;
    }
    setSaving(true);
    setMsg(null);
    const token = getToken();
    try {
      const res = await fetch(`${apiBase}/api/family-members`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setMsg({ type: "success", text: "Member added successfully!" });
        setForm({ full_name: "", relationship: "", gender: "", date_of_birth: "", mobile: "", address: "", city: "", district: "", pincode: "" });
        setShowForm(false);
        fetchMembers();
      } else {
        const d = await res.json();
        setMsg({ type: "error", text: d.detail || "Failed to add family member" });
      }
    } catch { setMsg({ type: "error", text: "Network connection error" }); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this family member?")) return;
    const token = getToken();
    try {
      const res = await fetch(`${apiBase}/api/family-members/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchMembers();
      } else {
        const d = await res.json();
        alert(d.detail || "Cannot remove this member.");
      }
    } catch { alert("Network error"); }
  };

  const relationships = ["Spouse", "Parent", "Child", "Sibling", "Grandparent", "Other"];
  const genders = ["Male", "Female", "Other"];

  if (loading) {
    return <div className="cm-card" style={{ padding: 32, textAlign: "center", color: "var(--cm-ink-3)" }}>Loading family members…</div>;
  }

  return (
    <div className="cm-stack" style={{ marginBottom: "var(--cm-6)" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, color: "var(--cm-ink)", fontSize: "1.15rem", fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 6, background: "var(--cm-surface-3)", color: "var(--cm-navy)" }}>
              <Users size={16} />
            </span>
            Family Care Circle
          </h3>
          <p style={{ margin: "4px 0 0", color: "var(--cm-ink-3)", fontSize: "0.85rem" }}>
            Add and manage family profiles to schedule doorstep collections and doctor consults on their behalf.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          style={{
            padding: "8px 16px", borderRadius: "var(--cm-radius)", border: "none", cursor: "pointer",
            backgroundColor: showForm ? "var(--cm-surface-3)" : "var(--cm-navy)", color: showForm ? "var(--cm-ink)" : "#fff",
            fontWeight: 700, fontSize: "0.85rem", transition: "all 0.2s", display: "inline-flex", alignItems: "center", gap: 6
          }}
        >
          {showForm ? <><X size={14} /> Cancel</> : <><Plus size={14} /> Add Member</>}
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="cm-card" style={{ padding: 24, marginBottom: 16, borderLeft: "4px solid var(--cm-active)" }}>
          <form onSubmit={handleAdd}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--cm-ink-2)", display: "block", marginBottom: 4 }}>Full Name *</label>
                <input
                  value={form.full_name}
                  onChange={e => setForm({ ...form, full_name: e.target.value })}
                  placeholder="Family member's full name"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--cm-line-strong)", fontSize: "0.9rem", background: "var(--cm-surface)", color: "var(--cm-ink)" }}
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--cm-ink-2)", display: "block", marginBottom: 4 }}>Relationship *</label>
                <select
                  value={form.relationship}
                  onChange={e => setForm({ ...form, relationship: e.target.value })}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--cm-line-strong)", fontSize: "0.9rem", background: "var(--cm-surface)", color: "var(--cm-ink)" }}
                  required
                >
                  <option value="">Select relationship</option>
                  {relationships.map(r => <option key={r} value={r.toLowerCase()}>{r}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--cm-ink-2)", display: "block", marginBottom: 4 }}>Gender</label>
                <select
                  value={form.gender}
                  onChange={e => setForm({ ...form, gender: e.target.value })}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--cm-line-strong)", fontSize: "0.9rem", background: "var(--cm-surface)", color: "var(--cm-ink)" }}
                >
                  <option value="">Select gender</option>
                  {genders.map(g => <option key={g} value={g.toLowerCase()}>{g}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--cm-ink-2)", display: "block", marginBottom: 4 }}>Date of Birth</label>
                <input
                  type="date"
                  value={form.date_of_birth}
                  onChange={e => setForm({ ...form, date_of_birth: e.target.value })}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--cm-line-strong)", fontSize: "0.9rem", background: "var(--cm-surface)", color: "var(--cm-ink)" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--cm-ink-2)", display: "block", marginBottom: 4 }}>Mobile</label>
                <input
                  value={form.mobile}
                  onChange={e => setForm({ ...form, mobile: e.target.value })}
                  placeholder="Mobile number"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--cm-line-strong)", fontSize: "0.9rem", background: "var(--cm-surface)", color: "var(--cm-ink)" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--cm-ink-2)", display: "block", marginBottom: 4 }}>Pincode</label>
                <input
                  value={form.pincode}
                  onChange={e => setForm({ ...form, pincode: e.target.value })}
                  placeholder="Pincode"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--cm-line-strong)", fontSize: "0.9rem", background: "var(--cm-surface)", color: "var(--cm-ink)" }}
                />
              </div>
            </div>
            {msg && (
              <div style={{
                display: "flex", alignItems: "center", gap: 6, marginBottom: 12, fontSize: "0.85rem",
                color: msg.type === "success" ? "var(--cm-done)" : "var(--cm-urgent)",
                fontWeight: 600
              }}>
                {msg.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                {msg.text}
              </div>
            )}
            <button
              type="submit"
              disabled={saving}
              className="cm-btn cm-btn--primary"
              style={{ cursor: saving ? "not-allowed" : "pointer" }}
            >
              {saving ? "Saving..." : "Add Family Member"}
            </button>
          </form>
        </div>
      )}

      {/* Members List */}
      {members.length === 0 ? (
        <div className="cm-card" style={{ padding: 40, textAlign: "center", color: "var(--cm-ink-3)" }}>
          <div style={{ display: "inline-flex", padding: 16, borderRadius: "50%", background: "var(--cm-surface-3)", color: "var(--cm-navy)", marginBottom: 12 }}>
            <Users size={32} />
          </div>
          <p style={{ margin: 0, fontWeight: 600 }}>No family members added yet.</p>
          <p style={{ margin: "4px 0 0", fontSize: "0.85rem" }}>Add profiles to easily book lab tests and doctor visits for your family.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {members.map(m => (
            <div
              key={m.id}
              className="cm-card"
              style={{
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderLeft: m.is_self ? "4px solid var(--cm-done)" : "4px solid var(--cm-active)",
                transition: "transform 0.15s ease",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <span style={{ fontWeight: 800, fontSize: "1.02rem", color: "var(--cm-ink)" }}>{m.full_name}</span>
                  {m.is_self && (
                    <span style={{
                      padding: "2px 8px", borderRadius: 9999, fontSize: "0.7rem",
                      fontWeight: 800, backgroundColor: "var(--cm-done-surface)", color: "var(--cm-done)",
                      border: "1px solid var(--cm-done-line)"
                    }}>YOU</span>
                  )}
                  {m.relationship && m.relationship !== "self" && (
                    <span style={{
                      padding: "2px 8px", borderRadius: 9999, fontSize: "0.7rem",
                      fontWeight: 700, backgroundColor: "var(--cm-active-surface)", color: "var(--cm-active)",
                      textTransform: "capitalize", border: "1px solid var(--cm-active-line)"
                    }}>{m.relationship}</span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 16, fontSize: "0.82rem", color: "var(--cm-ink-3)", alignItems: "center", flexWrap: "wrap" }}>
                  {m.gender && <span style={{ textTransform: "capitalize" }}>{m.gender}</span>}
                  {m.date_of_birth && (
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Calendar size={12} /> {m.date_of_birth}
                    </span>
                  )}
                  {m.mobile && (
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Phone size={12} /> {m.mobile}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <a
                  href={`/booking?for=${m.id}&name=${encodeURIComponent(m.full_name)}`}
                  className="cm-btn cm-btn--primary cm-btn--sm"
                  style={{ textDecoration: "none", fontWeight: 700 }}
                >
                  Book Service
                </a>
                {!m.is_self && (
                  <button
                    type="button"
                    onClick={() => handleDelete(m.id)}
                    style={{
                      padding: "6px 10px", borderRadius: "var(--cm-radius)", border: "1px solid var(--cm-urgent-line)",
                      cursor: "pointer", backgroundColor: "var(--cm-urgent-surface)", color: "var(--cm-urgent)",
                      display: "inline-flex", alignItems: "center"
                    }}
                    title="Remove member"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
