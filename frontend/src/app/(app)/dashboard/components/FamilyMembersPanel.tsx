"use client";

import { useEffect, useState } from "react";

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
  const [form, setForm] = useState({ full_name: "", relationship: "", gender: "", date_of_birth: "", mobile: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

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
      setMsg("Name and relationship are required.");
      return;
    }
    setSaving(true);
    setMsg("");
    const token = getToken();
    try {
      const res = await fetch(`${apiBase}/api/family-members`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setMsg("✅ Member added!");
        setForm({ full_name: "", relationship: "", gender: "", date_of_birth: "", mobile: "" });
        setShowForm(false);
        fetchMembers();
      } else {
        const d = await res.json();
        setMsg(`❌ ${d.detail || "Failed"}`);
      }
    } catch { setMsg("❌ Network error"); } finally { setSaving(false); }
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
    return <div className="card" style={{ padding: 32, textAlign: "center", color: "#9ca3af" }}>Loading family members…</div>;
  }

  return (
    <div className="cm-stack">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, color: "#1a2b4a", fontSize: "1.1rem" }}>👨‍👩‍👧‍👦 Family Members</h3>
          <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: "0.85rem" }}>
            Add family members to book services on their behalf
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            padding: "10px 20px", borderRadius: 10, border: "none", cursor: "pointer",
            backgroundColor: showForm ? "#e2e8f0" : "#0284c7", color: showForm ? "#334155" : "white",
            fontWeight: 700, fontSize: "0.85rem", transition: "all 0.2s",
          }}
        >
          {showForm ? "✕ Cancel" : "+ Add Member"}
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="card" style={{ padding: 24, marginBottom: 16, borderLeft: "4px solid #0284c7" }}>
          <form onSubmit={handleAdd}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Full Name *</label>
                <input
                  value={form.full_name}
                  onChange={e => setForm({ ...form, full_name: e.target.value })}
                  placeholder="Family member's full name"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: "0.9rem" }}
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Relationship *</label>
                <select
                  value={form.relationship}
                  onChange={e => setForm({ ...form, relationship: e.target.value })}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: "0.9rem" }}
                  required
                >
                  <option value="">Select relationship</option>
                  {relationships.map(r => <option key={r} value={r.toLowerCase()}>{r}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Gender</label>
                <select
                  value={form.gender}
                  onChange={e => setForm({ ...form, gender: e.target.value })}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: "0.9rem" }}
                >
                  <option value="">Select gender</option>
                  {genders.map(g => <option key={g} value={g.toLowerCase()}>{g}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Date of Birth</label>
                <input
                  type="date"
                  value={form.date_of_birth}
                  onChange={e => setForm({ ...form, date_of_birth: e.target.value })}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: "0.9rem" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Mobile</label>
                <input
                  value={form.mobile}
                  onChange={e => setForm({ ...form, mobile: e.target.value })}
                  placeholder="Mobile number"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: "0.9rem" }}
                />
              </div>
            </div>
            {msg && <p style={{ marginBottom: 12, fontSize: "0.85rem", color: msg.startsWith("✅") ? "#059669" : "#dc2626" }}>{msg}</p>}
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "10px 24px", borderRadius: 8, border: "none", cursor: saving ? "not-allowed" : "pointer",
                backgroundColor: "#0284c7", color: "white", fontWeight: 700, fontSize: "0.9rem",
              }}
            >
              {saving ? "Saving..." : "Add Family Member"}
            </button>
          </form>
        </div>
      )}

      {/* Members List */}
      {members.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
          <div style={{ fontSize: "3rem", marginBottom: 12 }}>👨‍👩‍👧</div>
          <p>No family members added yet. Add members to book services on their behalf.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {members.map(m => (
            <div
              key={m.id}
              className="card"
              style={{
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderLeft: m.is_self ? "4px solid #059669" : "4px solid #e2e8f0",
                transition: "transform 0.15s",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: "1rem", color: "#1e293b" }}>{m.full_name}</span>
                  {m.is_self && (
                    <span style={{
                      padding: "2px 8px", borderRadius: 12, fontSize: "0.7rem",
                      fontWeight: 700, backgroundColor: "#d1fae5", color: "#065f46",
                    }}>YOU</span>
                  )}
                  {m.relationship && m.relationship !== "self" && (
                    <span style={{
                      padding: "2px 8px", borderRadius: 12, fontSize: "0.7rem",
                      fontWeight: 600, backgroundColor: "#e0e7ff", color: "#3730a3",
                      textTransform: "capitalize",
                    }}>{m.relationship}</span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 16, fontSize: "0.8rem", color: "#6b7280" }}>
                  {m.gender && <span style={{ textTransform: "capitalize" }}>⚧ {m.gender}</span>}
                  {m.date_of_birth && <span>🎂 {m.date_of_birth}</span>}
                  {m.mobile && <span>📱 {m.mobile}</span>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <a
                  href={`/booking?for=${m.id}&name=${encodeURIComponent(m.full_name)}`}
                  style={{
                    padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer",
                    backgroundColor: "#0284c7", color: "white", fontWeight: 600, fontSize: "0.8rem",
                    textDecoration: "none", display: "inline-block",
                  }}
                >
                  Book Service
                </a>
                {!m.is_self && (
                  <button
                    onClick={() => handleDelete(m.id)}
                    style={{
                      padding: "8px 12px", borderRadius: 8, border: "1px solid #fca5a5",
                      cursor: "pointer", backgroundColor: "#fef2f2", color: "#dc2626",
                      fontWeight: 600, fontSize: "0.8rem",
                    }}
                  >
                    🗑
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
