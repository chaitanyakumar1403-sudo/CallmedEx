"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

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

function KPICard({ icon, label, value, color, subtitle }: {
  icon: string; label: string; value: number | string; color: string; subtitle?: string;
}) {
  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: 12,
      padding: '20px 24px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
      borderLeft: `4px solid ${color}`,
      transition: 'transform 0.2s, box-shadow 0.2s',
      cursor: 'default',
    }}
    onMouseEnter={e => {
      (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
      (e.currentTarget as HTMLDivElement).style.boxShadow = '0 10px 25px rgba(0,0,0,0.08)';
    }}
    onMouseLeave={e => {
      (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
      (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)';
    }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{label}</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#111827', marginTop: 4 }}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
          {subtitle && <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 2 }}>{subtitle}</div>}
        </div>
        <div style={{ fontSize: '2rem', opacity: 0.7 }}>{icon}</div>
      </div>
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

  const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const apiBase = 'http://localhost:8000';

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
    { id: 'delegation', label: 'Delegation', icon: '🏛️' },
  ];

  return (
    <div style={{ backgroundColor: '#f1f5f9', minHeight: '100vh' }}>
      {/* ─── Header ─── */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)',
        padding: '24px 40px',
        color: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em' }}>
            ⚡ CallMedex Operations Center
          </h1>
          <p style={{ margin: '4px 0 0 0', color: 'rgba(255,255,255,0.75)', fontSize: '0.85rem', fontWeight: 400 }}>
            Real-time Healthcare Platform Dashboard • v2.0
          </p>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{
            backgroundColor: 'rgba(255,255,255,0.1)',
            borderRadius: 8,
            padding: '8px 16px',
            fontSize: '0.85rem',
          }}>
            🟢 {liveOps?.total_online || 0} Providers Online
          </div>
          <div style={{
            backgroundColor: 'rgba(255,255,255,0.1)',
            borderRadius: 8,
            padding: '8px 16px',
            fontSize: '0.85rem',
          }}>
            🔄 Auto-refresh: 30s
          </div>
        </div>
      </div>

      {/* ─── Tab Navigation ─── */}
      <div style={{
        backgroundColor: 'white',
        borderBottom: '1px solid #e2e8f0',
        padding: '0 40px',
        display: 'flex',
        gap: 0,
        overflowX: 'auto',
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '14px 20px',
              border: 'none',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: activeTab === tab.id ? 700 : 500,
              color: activeTab === tab.id ? '#1a2b4a' : '#6b7280',
              borderBottom: activeTab === tab.id ? '3px solid #2563eb' : '3px solid transparent',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ─── Content Area ─── */}
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 40px' }}>

        {/* ════════════════════════════════════════════════════════════ */}
        {/* EXECUTIVE OVERVIEW TAB */}
        {/* ════════════════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <>
            {/* KPI Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginBottom: 32 }}>
              <KPICard icon="👥" label="Total Users" value={m.total_users || 0} color="#2563eb" />
              <KPICard icon="🧑‍🦱" label="Patients" value={m.total_patients || 0} color="#059669" />
              <KPICard icon="👨‍⚕️" label="Doctors" value={m.total_doctors || 0} color="#7c3aed" />
              <KPICard icon="👩‍⚕️" label="Nurses" value={m.total_nurses || 0} color="#db2777" />
              <KPICard icon="💉" label="Phlebotomists" value={m.total_phlebotomists || 0} color="#ea580c" />
              <KPICard icon="🏥" label="Organizations" value={m.total_organizations || 0} color="#0891b2" />
              <KPICard icon="💊" label="Pharmacies" value={m.total_pharmacys || 0} color="#65a30d" />
              <KPICard icon="📋" label="Total Bookings" value={m.total_bookings || 0} color="#1d4ed8" />
              <KPICard icon="📅" label="Bookings Today" value={m.bookings_today || 0} color="#059669" subtitle="Last 24 hours" />
              <KPICard icon="🚀" label="Active Dispatches" value={m.active_dispatches || 0} color="#dc2626" subtitle="In progress" />
              <KPICard icon="⏳" label="Pending KYC" value={m.pending_kyc || 0} color="#d97706" subtitle="Awaiting verification" />
              <KPICard icon="📝" label="Pending MOU" value={m.pending_mou || 0} color="#9333ea" subtitle="Awaiting acceptance" />
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
              {Object.entries(liveOps?.online_providers || {}).map(([type, count]) => (
                <div key={type} style={{
                  backgroundColor: 'white', borderRadius: 12, padding: '16px 20px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#22c55e', boxShadow: '0 0 8px #22c55e' }} />
                  <div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#111827' }}>{count as number}</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'capitalize' }}>{type.replace('_', ' ')}s Online</div>
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
                      <th style={{ padding: 10, textAlign: 'left', color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase' }}>Type</th>
                      <th style={{ padding: 10, textAlign: 'left', color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase' }}>Status</th>
                      <th style={{ padding: 10, textAlign: 'left', color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase' }}>Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(liveOps?.active_dispatches || []).map((d: any, i: number) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: 10, fontSize: '0.85rem', fontFamily: 'monospace' }}>{(d.id || d.dispatch_id || '').slice(0, 8)}...</td>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
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
        {activeTab === 'users' && (
          <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#1a2b4a' }}>Master User Directory</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  {['Name', 'Email', 'Role', 'City', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: 10, textAlign: 'left', color: '#6b7280', fontSize: '0.7rem', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u: any) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: 8, fontWeight: 600 }}>{u.full_name}</td>
                    <td style={{ padding: 8, color: '#6b7280' }}>{u.email}</td>
                    <td style={{ padding: 8 }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: 20, fontSize: '0.65rem', fontWeight: 600,
                        backgroundColor: u.role === 'admin' ? '#ede9fe' : '#f0fdf4',
                        color: u.role === 'admin' ? '#5b21b6' : '#166534',
                        textTransform: 'uppercase',
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
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && <p style={{ textAlign: 'center', color: '#9ca3af', marginTop: 20 }}>No users found.</p>}
          </div>
        )}

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

      </div>
    </div>
  );
}
