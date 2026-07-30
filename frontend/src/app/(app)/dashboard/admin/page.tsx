"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import DashboardShell from '../components/DashboardShell';

// ─── Types ───────────────────────────────────────────────────────────────

interface Metrics {
  total_users: number;
  total_patients: number;
  total_doctors: number;
  total_nurses: number;
  total_phlebotomists: number;
  total_organizations: number;
  total_pharmacys: number;
  total_staffs: number;
  total_bookings: number;
  bookings_today: number;
  active_dispatches: number;
  pending_kyc: number;
  pending_mou: number;
  active_users_30d: number;
}

interface LiveOps {
  online_providers: Record<string, number>;
  total_online: number;
  active_dispatches: any[];
  recent_bookings: any[];
}

// ─── KPI Card Component ─────────────────────────────────────────────────

function KPICard({ icon, label, value, color, subtitle, onClick }: {
  icon: string; label: string; value: number | string; color: string; subtitle?: string; onClick?: () => void;
}) {
  const clickable = !!onClick;
  return (
    <div
      className="cm-stat-card"
      style={{
        borderLeft: `4px solid ${color}`,
        cursor: clickable ? 'pointer' : 'default',
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
      onClick={onClick}
      onMouseEnter={e => { if (clickable) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; } }}
      onMouseLeave={e => { if (clickable) { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; } }}
    >
      <div style={{ flex: 1 }}>
        <div className="cm-stat-card__label">{label}</div>
        <div className="cm-stat-card__value">{typeof value === 'number' ? value.toLocaleString() : value}</div>
        {subtitle && <div style={{ fontSize: 'var(--cm-text-xs)', color: 'var(--cm-ink-faint)', marginTop: 2 }}>{subtitle}</div>}
      </div>
      <div style={{ fontSize: '2rem', opacity: 0.7 }}>{icon}</div>
      {clickable && <div style={{ fontSize: '0.65rem', color: '#9ca3af', position: 'absolute', bottom: 6, right: 10 }}>Click to view →</div>}
    </div>
  );
}

// ─── Status Badge ────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    searching: { bg: '#fef3c7', text: '#92400e' },
    provider_accepted: { bg: '#d1fae5', text: '#065f46' },
    en_route: { bg: '#dbeafe', text: '#1e40af' },
    arrived: { bg: '#e0e7ff', text: '#3730a3' },
    in_progress: { bg: '#fce7f3', text: '#9d174d' },
    completed: { bg: '#d1fae5', text: '#065f46' },
    confirmed: { bg: '#d1fae5', text: '#065f46' },
    cancelled: { bg: '#fee2e2', text: '#991b1b' },
    pending: { bg: '#fef3c7', text: '#92400e' },
    verified: { bg: '#d1fae5', text: '#065f46' },
  };
  const c = colors[status] || { bg: '#f3f4f6', text: '#374151' };
  return (
    <span style={{
      padding: '3px 10px',
      borderRadius: 20,
      fontSize: '0.7rem',
      fontWeight: 600,
      backgroundColor: c.bg,
      color: c.text,
      textTransform: 'uppercase',
    }}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

// ─── Main Dashboard Component ────────────────────────────────────────────

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [liveOps, setLiveOps] = useState<LiveOps | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [bookingAnalytics, setBookingAnalytics] = useState<any>(null);
  const [providers, setProviders] = useState<any[]>([]);
  const [registrationTrends, setRegistrationTrends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateSupervisor, setShowCreateSupervisor] = useState(false);
  const [supervisorForm, setSupervisorForm] = useState({ full_name: '', email: '', mobile: '', password: '', managed_city: '' });
  const [formMsg, setFormMsg] = useState('');

  // User Management: role filter + bulk selection
  const [userRoleFilter, setUserRoleFilter] = useState<string>('all');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // Weekly Report State
  const [showWeeklyReportModal, setShowWeeklyReportModal] = useState(false);
  const [weeklyReportData, setWeeklyReportData] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);

  // Processing Centres State
  const [centres, setCentres] = useState<any[]>([]);
  const [pcLoading, setPcLoading] = useState(false);
  const [showPcForm, setShowPcForm] = useState(false);
  const [pcForm, setPcForm] = useState({ code: '', name: '', city: '', state: '', address: '', pincode: '', daily_capacity: 0 });
  const [pcFormMsg, setPcFormMsg] = useState('');
  const [selectedCentre, setSelectedCentre] = useState<any>(null);
  const [staffEmail, setStaffEmail] = useState('');
  const [staffRole, setStaffRole] = useState('technician');
  const [staffMsg, setStaffMsg] = useState('');
  const [areaForm, setAreaForm] = useState({ city: '', pincode: '', radius_km: '', priority: 100 });
  const [areaMsg, setAreaMsg] = useState('');

  const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const fetchData = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    const headers = { 'Authorization': `Bearer ${token}` };

    try {
      const [metricsRes, liveRes, usersRes, bookingsRes, providersRes, trendsRes] = await Promise.allSettled([
        fetch(`${apiBase}/api/admin/analytics/executive`, { headers }),
        fetch(`${apiBase}/api/admin/analytics/live`, { headers }),
        fetch(`${apiBase}/api/admin/users`, { headers }),
        fetch(`${apiBase}/api/admin/analytics/appointments`, { headers }),
        fetch(`${apiBase}/api/admin/analytics/providers`, { headers }),
        fetch(`${apiBase}/api/admin/analytics/registrations?days=14`, { headers }),
      ]);

      if (metricsRes.status === 'fulfilled' && metricsRes.value.ok) {
        const d = await metricsRes.value.json();
        setMetrics(d.metrics);
      }
      if (liveRes.status === 'fulfilled' && liveRes.value.ok) {
        const d = await liveRes.value.json();
        setLiveOps(d.live);
      }
      if (usersRes.status === 'fulfilled' && usersRes.value.ok) {
        const d = await usersRes.value.json();
        setUsers(d.users || []);
      }
      if (bookingsRes.status === 'fulfilled' && bookingsRes.value.ok) {
        const d = await bookingsRes.value.json();
        setBookingAnalytics(d.analytics);
      }
      if (providersRes.status === 'fulfilled' && providersRes.value.ok) {
        const d = await providersRes.value.json();
        setProviders(d.providers || []);
      }
      if (trendsRes.status === 'fulfilled' && trendsRes.value.ok) {
        const d = await trendsRes.value.json();
        setRegistrationTrends(d.trends || []);
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = getToken();
    const userStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
    if (!token || !userStr) { router.push('/auth/login'); return; }
    const user = JSON.parse(userStr);
    if (user.role !== 'admin') { router.push('/'); return; }
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [router, fetchData]);

  // ─── Processing Centre: fetch on tab switch ───────────────────────────

  const fetchCentres = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setPcLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/admin/processing-centers`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCentres(data.centers || []);
      }
    } catch { /* silent */ } finally {
      setPcLoading(false);
    }
  }, [apiBase]);

  // Fetch centres when the Processing Centres tab becomes active
  useEffect(() => {
    if (activeTab === 'processing-centres') {
      fetchCentres();
    }
  }, [activeTab, fetchCentres]);

  const handleCreateSupervisor = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMsg('Creating...');
    try {
      const token = getToken();
      const res = await fetch(`${apiBase}/api/admin/supervisors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(supervisorForm),
      });
      const data = await res.json();
      if (res.ok) {
        setFormMsg(`✅ ${data.message}`);
        setSupervisorForm({ full_name: '', email: '', mobile: '', password: '', managed_city: '' });
      } else {
        setFormMsg(`❌ ${data.detail || 'Failed'}`);
      }
    } catch { setFormMsg('❌ Error creating supervisor'); }
  };

  const handleUpdateUser = async (userId: string, updateData: any) => {
    try {
      const token = getToken();
      const res = await fetch(`${apiBase}/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(updateData),
      });
      if (res.ok) setUsers(users.map((u: any) => u.id === userId ? { ...u, ...updateData } : u));
    } catch { /* silent */ }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to completely delete this user? This action cannot be undone.")) return;
    try {
      const token = getToken();
      const res = await fetch(`${apiBase}/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        setUsers(users.filter((u: any) => u.id !== userId));
      } else {
        const data = await res.json();
        alert(data.detail || "Failed to delete user");
      }
    } catch {
      alert("Network error");
    }
  };

  const handleGenerateWeeklyReport = async () => {

    setReportLoading(true);
    const token = getToken();
    try {
      const res = await fetch(`${apiBase}/api/admin/analytics/weekly-summary-report`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setWeeklyReportData(data.report);
        setShowWeeklyReportModal(true);
      } else {
        alert(data.detail || "Failed to generate weekly report");
      }
    } catch (e) {
      alert("Error contacting server for weekly report.");
    } finally {
      setReportLoading(false);
    }
  };

  // ─── Processing Centre handlers ────────────────────────────────────────

  const handleCreateCentre = async (e: React.FormEvent) => {
    e.preventDefault();
    setPcFormMsg('Creating...');
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${apiBase}/api/admin/processing-centers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(pcForm),
      });
      const data = await res.json();
      if (res.ok) {
        setPcFormMsg(`✅ Created ${pcForm.code}`);
        setPcForm({ code: '', name: '', city: '', state: '', address: '', pincode: '', daily_capacity: 0 });
        setShowPcForm(false);
        fetchCentres();
      } else {
        setPcFormMsg(`❌ ${data.detail || 'Failed'}`);
      }
    } catch { setPcFormMsg('❌ Error creating centre'); }
  };

  const handleUpdateCentreStatus = async (centreId: string, status: string) => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${apiBase}/api/admin/processing-centers/${centreId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      if (res.ok) fetchCentres();
    } catch { /* silent */ }
  };

  const handleAddStaff = async (centreId: string) => {
    if (!staffEmail.trim()) return;
    setStaffMsg('Looking up user...');
    const token = getToken();
    if (!token) return;
    try {
      // First, find the user by email
      const userRes = await fetch(`${apiBase}/api/admin/users?q=${encodeURIComponent(staffEmail.trim())}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!userRes.ok) { setStaffMsg('❌ Failed to search users'); return; }
      const userData = await userRes.json();
      const matched = (userData.users || []).filter((u: any) => u.email.toLowerCase() === staffEmail.trim().toLowerCase());
      if (matched.length === 0) { setStaffMsg('❌ No user found with that email'); return; }
      const userId = matched[0].id;

      // Add staff
      const addRes = await fetch(`${apiBase}/api/admin/processing-centers/${centreId}/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ user_id: userId, pc_role: staffRole }),
      });
      if (addRes.ok) {
        setStaffMsg(`✅ ${matched[0].full_name} added as ${staffRole}`);
        setStaffEmail('');
        fetchCentres();
      } else {
        const d = await addRes.json();
        setStaffMsg(`❌ ${d.detail || 'Failed'}`);
      }
    } catch { setStaffMsg('❌ Error adding staff'); }
  };

  const handleRemoveStaff = async (centreId: string, userId: string) => {
    if (!confirm('Remove this staff member from the centre?')) return;
    const token = getToken();
    if (!token) return;
    try {
      await fetch(`${apiBase}/api/admin/processing-centers/${centreId}/staff/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      fetchCentres();
    } catch { /* silent */ }
  };

  const handleAddArea = async (centreId: string) => {
    setAreaMsg('Adding area...');
    const token = getToken();
    if (!token) return;
    try {
      const body: any = {};
      if (areaForm.city.trim()) body.city = areaForm.city.trim();
      if (areaForm.pincode.trim()) body.pincode = areaForm.pincode.trim();
      if (areaForm.radius_km) body.radius_km = parseFloat(areaForm.radius_km);
      if (areaForm.priority !== 100) body.priority = areaForm.priority;

      const res = await fetch(`${apiBase}/api/admin/processing-centers/${centreId}/areas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setAreaMsg('✅ Area added');
        setAreaForm({ city: '', pincode: '', radius_km: '', priority: 100 });
        fetchCentres();
      } else {
        const d = await res.json();
        setAreaMsg(`❌ ${d.detail || 'Failed'}`);
      }
    } catch { setAreaMsg('❌ Error adding area'); }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>⚡</div>
          <h2 style={{ color: '#1a2b4a' }}>Loading Command Center...</h2>
        </div>
      </div>
    );
  }

  const m = metrics || {} as Metrics;

  const tabs = [
    { id: 'overview', label: 'Executive Overview', icon: '📊' },
    { id: 'operations', label: 'Live Operations', icon: '🔴' },
    { id: 'analytics', label: 'Analytics', icon: '📈' },
    { id: 'providers', label: 'Providers', icon: '👥' },
    { id: 'users', label: 'User Management', icon: '🗂️' },
    { id: 'processing-centres', label: 'Processing Centres', icon: '🏭' },
    { id: 'delegation', label: 'Delegation', icon: '🏛️' },
  ];

  return (
    <DashboardShell
      role="admin"
      title="Operations Center"
      subtitle="Real-time platform oversight"
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      aside={
        <button
          onClick={handleGenerateWeeklyReport}
          style={{
            padding: "10px 18px", borderRadius: 999, cursor: "pointer",
            border: "1px solid rgba(255,255,255,0.35)",
            background: "rgba(255,255,255,0.12)", color: "#fff",
            fontWeight: 700, fontSize: "0.85rem",
          }}
        >
          📄 Weekly report
        </button>
      }
    >
      {/* ─── Content Area ─── */}
      <div>

        {/* ════════════════════════════════════════════════════════════ */}
        {/* EXECUTIVE OVERVIEW TAB */}
        {/* ════════════════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <>
            {/* KPI Grid */}
            <div className="cm-stats-grid">
              <KPICard icon="👥" label="Total Users" value={m.total_users || 0} color="#2563eb" onClick={() => { setActiveTab('users'); setUserRoleFilter('all'); }} />
              <KPICard icon="🧑‍🦱" label="Patients" value={m.total_patients || 0} color="#059669" onClick={() => { setActiveTab('users'); setUserRoleFilter('patient'); }} />
              <KPICard icon="👨‍⚕️" label="Doctors" value={m.total_doctors || 0} color="#7c3aed" onClick={() => { setActiveTab('users'); setUserRoleFilter('doctor'); }} />
              <KPICard icon="👩‍⚕️" label="Nurses" value={m.total_nurses || 0} color="#db2777" onClick={() => { setActiveTab('users'); setUserRoleFilter('nurse'); }} />
              <KPICard icon="💉" label="Phlebotomists" value={m.total_phlebotomists || 0} color="#ea580c" onClick={() => { setActiveTab('users'); setUserRoleFilter('phlebotomist'); }} />
              <KPICard icon="🏥" label="Organizations" value={m.total_organizations || 0} color="#0891b2" onClick={() => { setActiveTab('users'); setUserRoleFilter('organization'); }} />
              <KPICard icon="💊" label="Pharmacies" value={m.total_pharmacys || 0} color="#65a30d" onClick={() => { setActiveTab('users'); setUserRoleFilter('pharmacy'); }} />
              <KPICard icon="📋" label="Total Bookings" value={m.total_bookings || 0} color="#1d4ed8" onClick={() => { setActiveTab('analytics'); }} />
              <KPICard icon="📅" label="Bookings Today" value={m.bookings_today || 0} color="#059669" subtitle="Last 24 hours" onClick={() => { setActiveTab('analytics'); }} />
              <KPICard icon="🚀" label="Active Dispatches" value={m.active_dispatches || 0} color="#dc2626" subtitle="In progress" onClick={() => { setActiveTab('operations'); }} />
              <KPICard icon="⏳" label="Pending KYC" value={m.pending_kyc || 0} color="#d97706" subtitle="Awaiting verification" onClick={() => { setActiveTab('users'); setUserRoleFilter('all'); }} />
              <KPICard icon="📝" label="Pending MOU" value={m.pending_mou || 0} color="#9333ea" subtitle="Awaiting acceptance" onClick={() => { setActiveTab('users'); setUserRoleFilter('all'); }} />
            </div>

            {/* Registration Trends (simple bar visualization) */}
            {registrationTrends.length > 0 && (
              <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <h3 style={{ margin: '0 0 16px 0', color: '#1a2b4a', fontSize: '1rem' }}>📈 Registration Trends (Last 14 Days)</h3>
                <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 120 }}>
                  {registrationTrends.map((day, i) => {
                    const total = (day.patient || 0) + (day.doctor || 0) + (day.nurse || 0) + (day.organization || 0) + (day.pharmacy || 0);
                    const maxHeight = 100;
                    const maxTotal = Math.max(...registrationTrends.map(d => (d.patient || 0) + (d.doctor || 0) + (d.nurse || 0) + (d.organization || 0) + (d.pharmacy || 0)), 1);
                    const height = (total / maxTotal) * maxHeight;
                    return (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ fontSize: '0.65rem', color: '#9ca3af', marginBottom: 4 }}>{total}</div>
                        <div style={{
                          width: '100%',
                          height: `${height}px`,
                          background: 'linear-gradient(180deg, #3b82f6, #1d4ed8)',
                          borderRadius: '4px 4px 0 0',
                          minHeight: 4,
                        }} />
                        <div style={{ fontSize: '0.55rem', color: '#9ca3af', marginTop: 4, transform: 'rotate(-45deg)', whiteSpace: 'nowrap' }}>
                          {day.date?.slice(5)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* ════════════════════════════════════════════════════════════ */}
        {/* LIVE OPERATIONS TAB */}
        {/* ════════════════════════════════════════════════════════════ */}
        {activeTab === 'operations' && (
          <>
            {/* Online Providers */}
            <div className="cm-stats-grid">
              {Object.entries(liveOps?.online_providers || {}).map(([type, count]) => (
                <div key={type} className="cm-stat-card" style={{ cursor: 'default' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#22c55e', boxShadow: '0 0 8px #22c55e', flexShrink: 0 }} />
                  <div>
                    <div className="cm-stat-card__value">{count as number}</div>
                    <div className="cm-stat-card__label" style={{ textTransform: 'capitalize' }}>{type.replace('_', ' ')}s Online</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Active Dispatches Table */}
            <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 24 }}>
              <h3 style={{ margin: '0 0 16px 0', color: '#1a2b4a' }}>🚀 Active Dispatches</h3>
              {(liveOps?.active_dispatches || []).length === 0 ? (
                <p style={{ color: '#9ca3af', textAlign: 'center', padding: 20 }}>No active dispatches at the moment.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                      <th style={{ padding: 10, textAlign: 'left', color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase' }}>ID</th>
                      <th style={{ padding: 10, textAlign: 'left', color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase' }}>Patient</th>
                      <th style={{ padding: 10, textAlign: 'left', color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase' }}>Type</th>
                      <th style={{ padding: 10, textAlign: 'left', color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase' }}>Status</th>
                      <th style={{ padding: 10, textAlign: 'left', color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase' }}>Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(liveOps?.active_dispatches || []).map((d: any, i: number) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: 10, fontSize: '0.85rem', fontFamily: 'monospace' }}>{(d.id || d.dispatch_id || '').slice(0, 8)}...</td>
                        <td style={{ padding: 10, fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>{d.patient_name || 'N/A'}</td>
                        <td style={{ padding: 10, fontSize: '0.85rem', textTransform: 'capitalize' }}>{(d.provider_type || '').replace('_', ' ')}</td>
                        <td style={{ padding: 10 }}><StatusBadge status={d.status} /></td>
                        <td style={{ padding: 10, fontSize: '0.85rem', color: '#4b5563' }}>{d.patient_address || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Recent Bookings */}
            <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <h3 style={{ margin: '0 0 16px 0', color: '#1a2b4a' }}>📋 Recent Bookings (Last Hour)</h3>
              {(liveOps?.recent_bookings || []).length === 0 ? (
                <p style={{ color: '#9ca3af', textAlign: 'center', padding: 20 }}>No bookings in the last hour.</p>
              ) : (
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {(liveOps?.recent_bookings || []).map((b: any, i: number) => (
                    <div key={i} style={{
                      padding: '10px 16px', borderRadius: 8, border: '1px solid #e5e7eb',
                      display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.85rem',
                    }}>
                      <span style={{ textTransform: 'capitalize' }}>{(b.service_type || '').replace('_', ' ')}</span>
                      <StatusBadge status={b.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════ */}
        {/* ANALYTICS TAB */}
        {/* ════════════════════════════════════════════════════════════ */}
        {activeTab === 'analytics' && bookingAnalytics && (
          <>
            {/* Summary Cards */}
            <div className="cm-stats-grid">
              <KPICard icon="📊" label="Total Bookings" value={bookingAnalytics.total} color="#2563eb" />
              <KPICard icon="✅" label="Completion Rate" value={`${bookingAnalytics.completion_rate}%`} color="#059669" />
              <KPICard icon="❌" label="Cancellation Rate" value={`${bookingAnalytics.cancellation_rate}%`} color="#dc2626" />
              <KPICard icon="📈" label="Active Period" value="30 days" color="#7c3aed" />
            </div>

            {/* By Service Type */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <h3 style={{ margin: '0 0 16px 0', color: '#1a2b4a', fontSize: '1rem' }}>By Service Type</h3>
                {Object.entries(bookingAnalytics.by_service_type || {}).sort((a: any, b: any) => b[1] - a[1]).map(([service, count]: [string, any]) => {
                  const max = Math.max(...Object.values(bookingAnalytics.by_service_type || {}).map(Number));
                  const pct = max > 0 ? (count / max) * 100 : 0;
                  return (
                    <div key={service} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.8rem' }}>
                        <span style={{ textTransform: 'capitalize', color: '#374151' }}>{service.replace(/_/g, ' ')}</span>
                        <span style={{ fontWeight: 600, color: '#111827' }}>{count}</span>
                      </div>
                      <div style={{ height: 6, backgroundColor: '#f3f4f6', borderRadius: 3 }}>
                        <div style={{ height: '100%', width: `${pct}%`, backgroundColor: '#3b82f6', borderRadius: 3, transition: 'width 0.5s' }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <h3 style={{ margin: '0 0 16px 0', color: '#1a2b4a', fontSize: '1rem' }}>By Status</h3>
                {Object.entries(bookingAnalytics.by_status || {}).map(([status, count]: [string, any]) => (
                  <div key={status} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <StatusBadge status={status} />
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════ */}
        {/* PROVIDERS TAB */}
        {/* ════════════════════════════════════════════════════════════ */}
        {activeTab === 'providers' && (
          <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#1a2b4a' }}>Provider Directory</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  {['Type', 'Name', 'City', 'Specialization', 'Rating', 'Completed', 'Status'].map(h => (
                    <th key={h} style={{ padding: 10, textAlign: 'left', color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {providers.map((p: any, i: number) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: 10 }}>
                      <span style={{ 
                        padding: '3px 10px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 600,
                        backgroundColor: p.type === 'doctor' ? '#ede9fe' : p.type === 'nurse' ? '#fce7f3' : '#dbeafe',
                        color: p.type === 'doctor' ? '#5b21b6' : p.type === 'nurse' ? '#9d174d' : '#1e40af',
                        textTransform: 'capitalize',
                      }}>{p.type}</span>
                    </td>
                    <td style={{ padding: 10, fontWeight: 600, fontSize: '0.85rem' }}>{p.name}</td>
                    <td style={{ padding: 10, fontSize: '0.85rem', color: '#6b7280' }}>{p.city || 'N/A'}</td>
                    <td style={{ padding: 10, fontSize: '0.85rem' }}>{p.specialization || '-'}</td>
                    <td style={{ padding: 10, fontSize: '0.85rem' }}>{p.rating ? `⭐ ${p.rating}` : '-'}</td>
                    <td style={{ padding: 10, fontSize: '0.85rem' }}>{p.total_completed || '-'}</td>
                    <td style={{ padding: 10 }}><StatusBadge status={p.verification_status || 'pending'} /></td>
                  </tr>
                ))}
                {providers.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>No providers found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════ */}
        {/* USER MANAGEMENT TAB */}
        {/* ════════════════════════════════════════════════════════════ */}
        {activeTab === 'users' && (() => {
          // Compute role counts
          const roleCounts: Record<string, number> = {};
          users.forEach((u: any) => {
            roleCounts[u.role] = (roleCounts[u.role] || 0) + 1;
          });

          const ROLE_CARDS = [
            { role: 'all', label: 'All Users', icon: '👥', color: '#2563eb', count: users.length },
            { role: 'doctor', label: 'Doctors', icon: '👨‍⚕️', color: '#7c3aed', count: roleCounts['doctor'] || 0 },
            { role: 'nurse', label: 'Nurses', icon: '👩‍⚕️', color: '#db2777', count: roleCounts['nurse'] || 0 },
            { role: 'patient', label: 'Patients', icon: '🧑‍🦱', color: '#059669', count: roleCounts['patient'] || 0 },
            { role: 'phlebotomist', label: 'Phlebotomists', icon: '💉', color: '#ea580c', count: roleCounts['phlebotomist'] || 0 },
            { role: 'pharmacy', label: 'Pharmacies', icon: '💊', color: '#65a30d', count: roleCounts['pharmacy'] || 0 },
            { role: 'organization', label: 'Organizations', icon: '🏥', color: '#0891b2', count: roleCounts['organization'] || 0 },
            { role: 'staff', label: 'Staff', icon: '📋', color: '#6366f1', count: roleCounts['staff'] || 0 },
            { role: 'admin', label: 'Admins', icon: '🛡️', color: '#dc2626', count: roleCounts['admin'] || 0 },
          ].filter(rc => rc.role === 'all' || rc.count > 0);

          // Filter users by selected role and search
          let displayedUsers = userRoleFilter === 'all' ? users : users.filter((u: any) => u.role === userRoleFilter);
          if (userSearchQuery.trim()) {
            const q = userSearchQuery.toLowerCase();
            displayedUsers = displayedUsers.filter((u: any) =>
              (u.full_name || '').toLowerCase().includes(q) ||
              (u.email || '').toLowerCase().includes(q) ||
              (u.city || '').toLowerCase().includes(q)
            );
          }

          const allVisibleIds = displayedUsers.map((u: any) => u.id);
          const allSelected = allVisibleIds.length > 0 && allVisibleIds.every((id: string) => selectedUserIds.has(id));

          const toggleSelectAll = () => {
            if (allSelected) {
              setSelectedUserIds(new Set());
            } else {
              setSelectedUserIds(new Set(allVisibleIds));
            }
          };

          const toggleSelectUser = (userId: string) => {
            setSelectedUserIds(prev => {
              const next = new Set(prev);
              if (next.has(userId)) next.delete(userId);
              else next.add(userId);
              return next;
            });
          };

          const handleBulkAction = async (action: 'suspend' | 'activate' | 'delete') => {
            const ids = Array.from(selectedUserIds);
            if (ids.length === 0) return;
            if (action === 'delete' && !confirm(`Are you sure you want to DELETE ${ids.length} user(s)? This action cannot be undone.`)) return;
            if (action === 'suspend' && !confirm(`Suspend ${ids.length} user(s)?`)) return;

            setBulkActionLoading(true);
            const token = getToken();
            const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

            try {
              if (action === 'delete') {
                await Promise.allSettled(
                  ids.map(id => fetch(`${apiBase}/api/admin/users/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }))
                );
                setUsers(users.filter((u: any) => !selectedUserIds.has(u.id)));
              } else {
                const isActive = action === 'activate';
                await Promise.allSettled(
                  ids.map(id => fetch(`${apiBase}/api/admin/users/${id}`, {
                    method: 'PATCH', headers, body: JSON.stringify({ is_active: isActive })
                  }))
                );
                setUsers(users.map((u: any) => selectedUserIds.has(u.id) ? { ...u, is_active: isActive } : u));
              }
              setSelectedUserIds(new Set());
            } catch { /* silent */ } finally {
              setBulkActionLoading(false);
            }
          };

          return (
            <div>
              {/* ── Role Summary Cards ───────────────────────────────── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 20 }}>
                {ROLE_CARDS.map(rc => {
                  const active = userRoleFilter === rc.role;
                  return (
                    <button
                      key={rc.role}
                      onClick={() => { setUserRoleFilter(rc.role); setSelectedUserIds(new Set()); }}
                      style={{
                        padding: '14px 12px', borderRadius: 12, cursor: 'pointer',
                        border: active ? `2px solid ${rc.color}` : '1px solid #e5e7eb',
                        backgroundColor: active ? `${rc.color}10` : 'white',
                        textAlign: 'center', transition: 'all 0.2s ease',
                        boxShadow: active ? `0 4px 12px ${rc.color}25` : '0 1px 3px rgba(0,0,0,0.04)',
                      }}
                    >
                      <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>{rc.icon}</div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: rc.color }}>{rc.count}</div>
                      <div style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', marginTop: 2 }}>{rc.label}</div>
                    </button>
                  );
                })}
              </div>

              {/* ── Search within role ────────────────────────────────── */}
              <div style={{ marginBottom: 16 }}>
                <input
                  type="text"
                  placeholder={`🔍 Search ${userRoleFilter === 'all' ? 'all users' : ROLE_CARDS.find(r => r.role === userRoleFilter)?.label || 'users'}...`}
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 16px', borderRadius: 10,
                    border: '1px solid #e5e7eb', fontSize: '0.85rem',
                  }}
                />
              </div>

              {/* ── Bulk Action Bar ──────────────────────────────────── */}
              {selectedUserIds.size > 0 && (
                <div style={{
                  display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 18px', borderRadius: 12, marginBottom: 16,
                  background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                  color: 'white', flexWrap: 'wrap',
                  boxShadow: '0 4px 16px rgba(15,23,42,0.3)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      background: 'rgba(255,255,255,0.2)', padding: '3px 10px',
                      borderRadius: 20, fontSize: '0.78rem', fontWeight: 700,
                    }}>
                      {selectedUserIds.size} selected
                    </span>
                    <button
                      onClick={() => setSelectedUserIds(new Set())}
                      style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.8rem' }}
                    >
                      Clear
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => handleBulkAction('suspend')}
                      disabled={bulkActionLoading}
                      style={{
                        padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.3)',
                        background: 'rgba(255,255,255,0.1)', color: '#fbbf24',
                        fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer',
                      }}
                    >
                      ⏸ Suspend ({selectedUserIds.size})
                    </button>
                    <button
                      onClick={() => handleBulkAction('activate')}
                      disabled={bulkActionLoading}
                      style={{
                        padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.3)',
                        background: 'rgba(255,255,255,0.1)', color: '#4ade80',
                        fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer',
                      }}
                    >
                      ✅ Activate ({selectedUserIds.size})
                    </button>
                    <button
                      onClick={() => handleBulkAction('delete')}
                      disabled={bulkActionLoading}
                      style={{
                        padding: '6px 14px', borderRadius: 8, border: '1px solid #fca5a5',
                        background: '#dc2626', color: 'white',
                        fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer',
                      }}
                    >
                      🗑 Delete ({selectedUserIds.size})
                    </button>
                  </div>
                </div>
              )}

              {/* ── User Table ───────────────────────────────────────── */}
              <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ margin: 0, color: '#1a2b4a' }}>
                    {userRoleFilter === 'all' ? 'All Users' : ROLE_CARDS.find(r => r.role === userRoleFilter)?.label || 'Users'}
                    <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: '0.85rem', marginLeft: 8 }}>({displayedUsers.length})</span>
                  </h3>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                      <th style={{ padding: 10, textAlign: 'left', width: 40 }}>
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleSelectAll}
                          style={{ cursor: 'pointer', width: 16, height: 16 }}
                        />
                      </th>
                      {['Name', 'Email', 'Role', 'City', 'Status', 'Actions'].map(h => (
                        <th key={h} style={{ padding: 10, textAlign: 'left', color: '#6b7280', fontSize: '0.7rem', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {displayedUsers.map((u: any) => {
                      const isChecked = selectedUserIds.has(u.id);
                      const roleBadgeColors: Record<string, { bg: string; text: string }> = {
                        admin: { bg: '#ede9fe', text: '#5b21b6' },
                        doctor: { bg: '#f3e8ff', text: '#7c3aed' },
                        nurse: { bg: '#fce7f3', text: '#db2777' },
                        patient: { bg: '#f0fdf4', text: '#166534' },
                        phlebotomist: { bg: '#fff7ed', text: '#ea580c' },
                        pharmacy: { bg: '#ecfdf5', text: '#065f46' },
                        organization: { bg: '#ecfeff', text: '#0891b2' },
                        staff: { bg: '#eef2ff', text: '#4f46e5' },
                      };
                      const badge = roleBadgeColors[u.role] || { bg: '#f3f4f6', text: '#374151' };
                      return (
                        <tr key={u.id} style={{
                          borderBottom: '1px solid #f3f4f6',
                          backgroundColor: isChecked ? '#f0f9ff' : 'transparent',
                          transition: 'background-color 0.15s',
                        }}>
                          <td style={{ padding: 8 }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleSelectUser(u.id)}
                              style={{ cursor: 'pointer', width: 16, height: 16 }}
                            />
                          </td>
                          <td style={{ padding: 8, fontWeight: 600 }}>{u.full_name}</td>
                          <td style={{ padding: 8, color: '#6b7280' }}>{u.email}</td>
                          <td style={{ padding: 8 }}>
                            <span style={{
                              padding: '3px 10px', borderRadius: 20, fontSize: '0.65rem', fontWeight: 600,
                              backgroundColor: badge.bg, color: badge.text, textTransform: 'uppercase',
                            }}>{u.role}</span>
                          </td>
                          <td style={{ padding: 8, color: '#6b7280' }}>{u.city || 'N/A'}</td>
                          <td style={{ padding: 8, color: u.is_active ? '#059669' : '#dc2626', fontWeight: 600 }}>
                            {u.is_active ? '● Active' : '● Suspended'}
                          </td>
                          <td style={{ padding: 8 }}>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                onClick={() => handleUpdateUser(u.id, { is_active: !u.is_active })}
                                style={{
                                  fontSize: '0.7rem', padding: '4px 10px', cursor: 'pointer',
                                  border: '1px solid #e5e7eb', borderRadius: 6, backgroundColor: 'white',
                                }}
                              >{u.is_active ? 'Suspend' : 'Activate'}</button>
                              <button
                                onClick={() => handleDeleteUser(u.id)}
                                style={{
                                  fontSize: '0.7rem', padding: '4px 10px', cursor: 'pointer',
                                  border: '1px solid #fecaca', borderRadius: 6, backgroundColor: '#fef2f2',
                                  color: '#dc2626', fontWeight: 600
                                }}
                              >Delete</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {displayedUsers.length === 0 && <p style={{ textAlign: 'center', color: '#9ca3af', marginTop: 20 }}>No users found{userRoleFilter !== 'all' ? ` with role "${userRoleFilter}"` : ''}.</p>}
              </div>
            </div>
          );
        })()}

        {/* ════════════════════════════════════════════════════════════ */}
        {/* DELEGATION TAB */}
        {/* ════════════════════════════════════════════════════════════ */}
        {activeTab === 'delegation' && (
          <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, color: '#1a2b4a' }}>🏛️ City Supervisor Management</h3>
              <button
                onClick={() => setShowCreateSupervisor(!showCreateSupervisor)}
                style={{
                  backgroundColor: '#1a2b4a', color: 'white', border: 'none',
                  padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600,
                }}
              >{showCreateSupervisor ? 'Close' : '+ Create Supervisor'}</button>
            </div>

            {showCreateSupervisor && (
              <form onSubmit={handleCreateSupervisor} style={{
                display: 'grid', gap: 12, backgroundColor: '#f8fafc',
                padding: 20, borderRadius: 8, marginBottom: 24,
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[
                    { key: 'full_name', placeholder: 'Full Name', type: 'text' },
                    { key: 'email', placeholder: 'Email', type: 'email' },
                    { key: 'mobile', placeholder: 'Mobile Number', type: 'text' },
                    { key: 'password', placeholder: 'Password', type: 'password' },
                  ].map(f => (
                    <input
                      key={f.key}
                      required
                      type={f.type}
                      placeholder={f.placeholder}
                      value={(supervisorForm as any)[f.key]}
                      onChange={e => setSupervisorForm({ ...supervisorForm, [f.key]: e.target.value })}
                      style={{ padding: 10, borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.85rem' }}
                    />
                  ))}
                  <input
                    required
                    placeholder="Target City (e.g. Hyderabad)"
                    value={supervisorForm.managed_city}
                    onChange={e => setSupervisorForm({ ...supervisorForm, managed_city: e.target.value })}
                    style={{ padding: 10, borderRadius: 6, border: '1px solid #d1d5db', gridColumn: 'span 2', fontSize: '0.85rem' }}
                  />
                </div>
                <button
                  type="submit"
                  style={{
                    backgroundColor: '#059669', color: 'white', border: 'none',
                    padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 700,
                  }}
                >Create Supervisor Account</button>
                {formMsg && <p style={{ color: formMsg.startsWith('✅') ? '#059669' : '#dc2626', fontWeight: 600, margin: 0 }}>{formMsg}</p>}
              </form>
            )}

            <div style={{ color: '#6b7280', fontSize: '0.9rem', lineHeight: 1.8 }}>
              <p><strong>How it works:</strong></p>
              <ul>
                <li>City Supervisors can only see users, bookings, and verifications within their assigned city.</li>
                <li>They cannot create other admins, delete users, or access global analytics.</li>
                <li>Super Admins have full access across all regions.</li>
              </ul>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════ */}
        {/* PROCESSING CENTRES TAB */}
        {/* ════════════════════════════════════════════════════════════ */}
        {activeTab === 'processing-centres' && (
          <div>
            {/* ── Explainer ───────────────────────────────────────────── */}
            <div style={{
              backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10,
              padding: '14px 18px', marginBottom: 20, fontSize: '0.85rem', color: '#0369a1', lineHeight: 1.6,
            }}>
              <strong>🏭 How it works:</strong> Centres are created by CallMedex (no self-signup).
              Create → Activate → Add staff → Add areas. Active centres receive bookings
              automatically by pincode / city / district / radius.
            </div>

            {/* ── Header + Create button ──────────────────────────────── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#1a2b4a' }}>
                Processing Centres
                <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: '0.85rem', marginLeft: 8 }}>
                  ({centres.length})
                </span>
              </h3>
              <button
                onClick={() => { setShowPcForm(!showPcForm); setPcFormMsg(''); }}
                style={{
                  backgroundColor: '#1a2b4a', color: 'white', border: 'none',
                  padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600,
                }}
              >{showPcForm ? 'Close' : '+ New Centre'}</button>
            </div>

            {/* ── New Centre Form ─────────────────────────────────────── */}
            {showPcForm && (
              <form onSubmit={handleCreateCentre} style={{
                display: 'grid', gap: 12, backgroundColor: '#f8fafc',
                padding: 20, borderRadius: 8, marginBottom: 24,
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <input required placeholder="Code (e.g. HYD-01)" value={pcForm.code}
                    onChange={e => setPcForm({ ...pcForm, code: e.target.value })}
                    style={{ padding: 10, borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.85rem' }} />
                  <input required placeholder="Name" value={pcForm.name}
                    onChange={e => setPcForm({ ...pcForm, name: e.target.value })}
                    style={{ padding: 10, borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.85rem' }} />
                  <input required placeholder="City" value={pcForm.city}
                    onChange={e => setPcForm({ ...pcForm, city: e.target.value })}
                    style={{ padding: 10, borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.85rem' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
                  <input placeholder="State" value={pcForm.state}
                    onChange={e => setPcForm({ ...pcForm, state: e.target.value })}
                    style={{ padding: 10, borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.85rem' }} />
                  <input placeholder="Pincode" value={pcForm.pincode}
                    onChange={e => setPcForm({ ...pcForm, pincode: e.target.value })}
                    style={{ padding: 10, borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.85rem' }} />
                  <input placeholder="Address" value={pcForm.address}
                    onChange={e => setPcForm({ ...pcForm, address: e.target.value })}
                    style={{ padding: 10, borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.85rem' }} />
                  <input type="number" placeholder="Daily Capacity" value={pcForm.daily_capacity || ''}
                    onChange={e => setPcForm({ ...pcForm, daily_capacity: parseInt(e.target.value) || 0 })}
                    style={{ padding: 10, borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.85rem' }} />
                </div>
                <button type="submit" style={{
                  backgroundColor: '#059669', color: 'white', border: 'none',
                  padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 700,
                }}>Create Processing Centre</button>
                {pcFormMsg && <p style={{ color: pcFormMsg.startsWith('✅') ? '#059669' : '#dc2626', fontWeight: 600, margin: 0 }}>{pcFormMsg}</p>}
              </form>
            )}

            {/* ── Centres Table ───────────────────────────────────────── */}
            {pcLoading ? (
              <p style={{ textAlign: 'center', color: '#9ca3af', padding: 40 }}>Loading centres...</p>
            ) : centres.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#9ca3af', padding: 40 }}>
                No processing centres yet. Create one to get started.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {centres.map((c: any) => {
                  const statusColor = c.status === 'active' ? '#059669' : c.status === 'paused' ? '#d97706' : '#6b7280';
                  const statusBg = c.status === 'active' ? '#d1fae5' : c.status === 'paused' ? '#fef3c7' : '#f3f4f6';
                  const staffList = c.staff || [];
                  const areaList = c.areas || [];
                  return (
                    <div key={c.id} style={{
                      backgroundColor: 'white', borderRadius: 12, padding: 20,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #e5e7eb',
                    }}>
                      {/* ── Centre header row ─────────────────────────── */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                            <strong style={{ fontSize: '1rem', color: '#1a2b4a' }}>{c.code}</strong>
                            <span style={{
                              padding: '3px 10px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 600,
                              backgroundColor: statusBg, color: statusColor, textTransform: 'uppercase',
                            }}>{c.status}</span>
                          </div>
                          <div style={{ fontSize: '0.85rem', color: '#4b5563' }}>
                            {c.name} &middot; {c.city}{c.state ? `, ${c.state}` : ''}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {c.status === 'onboarding' && (
                            <button onClick={() => handleUpdateCentreStatus(c.id, 'active')}
                              style={{
                                fontSize: '0.7rem', padding: '5px 12px', cursor: 'pointer',
                                border: '1px solid #059669', borderRadius: 6, backgroundColor: '#d1fae5',
                                color: '#065f46', fontWeight: 600,
                              }}>Activate</button>
                          )}
                          {c.status === 'active' && (
                            <button onClick={() => handleUpdateCentreStatus(c.id, 'paused')}
                              style={{
                                fontSize: '0.7rem', padding: '5px 12px', cursor: 'pointer',
                                border: '1px solid #d97706', borderRadius: 6, backgroundColor: '#fef3c7',
                                color: '#92400e', fontWeight: 600,
                              }}>Pause</button>
                          )}
                          {c.status === 'paused' && (
                            <button onClick={() => handleUpdateCentreStatus(c.id, 'active')}
                              style={{
                                fontSize: '0.7rem', padding: '5px 12px', cursor: 'pointer',
                                border: '1px solid #059669', borderRadius: 6, backgroundColor: '#d1fae5',
                                color: '#065f46', fontWeight: 600,
                              }}>Reactivate</button>
                          )}
                        </div>
                      </div>

                      {/* ── Staff section ─────────────────────────────── */}
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                          Staff ({staffList.length})
                        </div>
                        {staffList.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                            {staffList.map((s: any) => (
                              <span key={s.id || s.user_id} style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                padding: '3px 10px', borderRadius: 20, fontSize: '0.7rem',
                                backgroundColor: '#eef2ff', color: '#4f46e5',
                              }}>
                                {s.user_id?.slice(0, 8)}...
                                <button onClick={() => handleRemoveStaff(c.id, s.user_id)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '0.7rem', padding: 0, marginLeft: 2 }}
                                  title="Remove staff">✕</button>
                              </span>
                            ))}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input
                            placeholder="Staff email"
                            value={selectedCentre === c.id ? staffEmail : ''}
                            onChange={e => { setSelectedCentre(c.id); setStaffEmail(e.target.value); setStaffMsg(''); }}
                            onFocus={() => setSelectedCentre(c.id)}
                            style={{
                              flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db',
                              fontSize: '0.8rem', maxWidth: 240,
                            }}
                          />
                          <select
                            value={selectedCentre === c.id ? staffRole : 'technician'}
                            onChange={e => { setSelectedCentre(c.id); setStaffRole(e.target.value); }}
                            style={{
                              padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db',
                              fontSize: '0.8rem', backgroundColor: 'white',
                            }}
                          >
                            <option value="technician">Technician</option>
                            <option value="admin">Admin</option>
                          </select>
                          <button onClick={() => { setSelectedCentre(c.id); handleAddStaff(c.id); }}
                            style={{
                              fontSize: '0.7rem', padding: '6px 12px', cursor: 'pointer',
                              border: '1px solid #6366f1', borderRadius: 6, backgroundColor: '#eef2ff',
                              color: '#4f46e5', fontWeight: 600,
                            }}>Add Staff</button>
                        </div>
                        {selectedCentre === c.id && staffMsg && (
                          <p style={{ fontSize: '0.78rem', color: staffMsg.startsWith('✅') ? '#059669' : '#dc2626', margin: '4px 0 0' }}>{staffMsg}</p>
                        )}
                      </div>

                      {/* ── Areas section ─────────────────────────────── */}
                      <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                          Service Areas ({areaList.length})
                        </div>
                        {areaList.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                            {areaList.map((a: any) => (
                              <span key={a.id} style={{
                                padding: '3px 10px', borderRadius: 20, fontSize: '0.7rem',
                                backgroundColor: '#f0fdf4', color: '#166534',
                              }}>
                                {a.city || a.pincode || `${a.radius_km}km`} {a.priority !== 100 ? `(p${a.priority})` : ''}
                              </span>
                            ))}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <input placeholder="City" value={selectedCentre === c.id ? areaForm.city : ''}
                            onChange={e => { setSelectedCentre(c.id); setAreaForm({ ...areaForm, city: e.target.value }); setAreaMsg(''); }}
                            onFocus={() => setSelectedCentre(c.id)}
                            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.8rem', width: 120 }} />
                          <input placeholder="Pincode" value={selectedCentre === c.id ? areaForm.pincode : ''}
                            onChange={e => { setSelectedCentre(c.id); setAreaForm({ ...areaForm, pincode: e.target.value }); }}
                            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.8rem', width: 100 }} />
                          <input placeholder="Radius (km)" value={selectedCentre === c.id ? areaForm.radius_km : ''}
                            onChange={e => { setSelectedCentre(c.id); setAreaForm({ ...areaForm, radius_km: e.target.value }); }}
                            type="number" style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.8rem', width: 100 }} />
                          <input placeholder="Priority" value={selectedCentre === c.id ? areaForm.priority : 100}
                            onChange={e => { setSelectedCentre(c.id); setAreaForm({ ...areaForm, priority: parseInt(e.target.value) || 100 }); }}
                            type="number" style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.8rem', width: 80 }} />
                          <button onClick={() => { setSelectedCentre(c.id); handleAddArea(c.id); }}
                            style={{
                              fontSize: '0.7rem', padding: '6px 12px', cursor: 'pointer',
                              border: '1px solid #059669', borderRadius: 6, backgroundColor: '#d1fae5',
                              color: '#065f46', fontWeight: 600,
                            }}>Add Area</button>
                        </div>
                        {selectedCentre === c.id && areaMsg && (
                          <p style={{ fontSize: '0.78rem', color: areaMsg.startsWith('✅') ? '#059669' : '#dc2626', margin: '4px 0 0' }}>{areaMsg}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── WEEKLY EXECUTIVE SUMMARY REPORT MODAL ─── */}
        {showWeeklyReportModal && weeklyReportData && (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0,0,0,0.7)", zIndex: 1000,
            display: "flex", justifyContent: "center", alignItems: "center", padding: 20
          }}>
            <div style={{
              backgroundColor: "white", borderRadius: 16, padding: 30,
              width: "100%", maxWidth: 550, color: "#1e293b",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4)", maxHeight: "90vh", overflowY: "auto"
            }}>
              <div style={{ borderBottom: "2px solid #e2e8f0", paddingBottom: 16, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <span style={{ backgroundColor: "#dbeafe", color: "#1e40af", fontSize: "0.7rem", fontWeight: 800, padding: "2px 8px", borderRadius: 12, textTransform: "uppercase" }}>
                      📊 Executive Platform Summary Report
                    </span>
                    <h3 style={{ margin: "6px 0 2px", color: "#0f172a", fontSize: "1.3rem" }}>
                      Weekly CallMedex Health & Growth Digest
                    </h3>
                    <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                      Period: {weeklyReportData.report_period}
                    </div>
                  </div>
                  <button onClick={() => setShowWeeklyReportModal(false)} style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer" }}>✕</button>
                </div>
              </div>

              {/* KPI Matrix */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                <div style={{ backgroundColor: "#f8fafc", padding: 14, borderRadius: 10, border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: "0.75rem", color: "#64748b" }}>New Registrations</div>
                  <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#2563eb" }}>{weeklyReportData.kpis?.new_registrations}</div>
                </div>
                <div style={{ backgroundColor: "#f8fafc", padding: 14, borderRadius: 10, border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Active Providers Online</div>
                  <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#16a34a" }}>{weeklyReportData.kpis?.active_providers_online}</div>
                </div>
                <div style={{ backgroundColor: "#f8fafc", padding: 14, borderRadius: 10, border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Completed Dispatches</div>
                  <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#7c3aed" }}>{weeklyReportData.kpis?.completed_home_dispatches}</div>
                </div>
                <div style={{ backgroundColor: "#f8fafc", padding: 14, borderRadius: 10, border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Gross Platform Volume</div>
                  <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#059669" }}>₹{weeklyReportData.kpis?.total_platform_volume_inr?.toLocaleString()}</div>
                </div>
              </div>

              {/* Highlights */}
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ margin: "0 0 10px", fontSize: "0.9rem", color: "#0f172a" }}>🌟 Platform Security & Operational Highlights</h4>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: "0.82rem", color: "#475569", lineHeight: 1.6 }}>
                  {weeklyReportData.highlights?.map((h: string, idx: number) => (
                    <li key={idx}>{h}</li>
                  ))}
                </ul>
              </div>

              <div style={{ backgroundColor: "#f0fdf4", padding: 12, borderRadius: 8, border: "1px solid #bbf7d0", fontSize: "0.8rem", color: "#166534", marginBottom: 20 }}>
                ✅ Email summary report dispatched to administrator inbox ({weeklyReportData.email_dispatched_to?.join(", ")})
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => setShowWeeklyReportModal(false)}
                  style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#f1f5f9", cursor: "pointer", fontWeight: 700 }}
                >
                  Close
                </button>
                <button
                  onClick={() => window.print()}
                  style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: "#4f46e5", color: "white", fontWeight: 800, cursor: "pointer" }}
                >
                  🖨️ Print Executive Report
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

