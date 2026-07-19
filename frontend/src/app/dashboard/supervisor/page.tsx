"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SupervisorDashboard() {
  const router = useRouter();
  const [metrics, setMetrics] = useState({ total_users: 0, total_bookings: 0 });
  const [verifications, setVerifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [supervisorCity, setSupervisorCity] = useState("Your City");

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    if (!token || !userStr) {
      router.push('/auth/login');
      return;
    }

    const user = JSON.parse(userStr);
    if (user.role !== 'admin') {
      router.push('/'); 
      return;
    }

    const fetchData = async () => {
      try {
        const metricsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/admin/metrics`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const verifRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/admin/verifications`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (metricsRes.ok) {
          const mData = await metricsRes.json();
          setMetrics(mData.metrics);
          setSupervisorCity(mData.city_scope);
        }
        if (verifRes.ok) {
          const vData = await verifRes.json();
          setVerifications(vData.verifications);
        }
      } catch (err) {
        console.error('Error fetching supervisor data', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  if (loading) {
    return <div style={{ padding: '50px', textAlign: 'center' }}>Loading Supervisor Dashboard...</div>;
  }

  return (
    <div style={{ backgroundColor: '#f0f4f8', minHeight: '100vh', padding: '40px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <div>
            <h1 style={{ color: '#1a2b4a', margin: '0 0 5px 0' }}>City Supervisor Dashboard</h1>
            <p style={{ color: '#4a5568', margin: '0' }}>Managing territory: <strong style={{ color: '#e53e3e' }}>{supervisorCity}</strong></p>
          </div>
          <div>
            <button style={{ backgroundColor: '#1a2b4a', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer' }}>
              Dispatch Command Center (Live Map)
            </button>
          </div>
        </div>

        {/* Verification Queue */}
        <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ color: '#1a2b4a', margin: '0' }}>Pending Verifications Queue</h2>
            <span style={{ backgroundColor: '#fed7d7', color: '#c53030', padding: '5px 12px', borderRadius: '20px', fontSize: '14px', fontWeight: 'bold' }}>
              {verifications.length} Requires Action
            </span>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#718096' }}>
                <th style={{ padding: '12px' }}>Provider Name</th>
                <th style={{ padding: '12px' }}>Role</th>
                <th style={{ padding: '12px' }}>License/Reg #</th>
                <th style={{ padding: '12px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {verifications.map((v: any, idx: number) => (
                <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '12px', fontWeight: 'bold' }}>{v.user.full_name}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '12px', backgroundColor: '#e2e8f0', color: '#4a5568' }}>
                      {v.role.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '12px', color: '#4a5568' }}>
                    {v.data.medical_license_number || v.data.drug_license_number || v.data.certification_number || v.data.license_number || 'N/A'}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <button style={{ backgroundColor: '#48bb78', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', marginRight: '8px', cursor: 'pointer' }}>Approve</button>
                    <button style={{ backgroundColor: '#e53e3e', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>Reject</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {verifications.length === 0 && <p style={{ textAlign: 'center', color: '#718096', marginTop: '30px' }}>No pending verifications in {supervisorCity}.</p>}
        </div>

      </div>
    </div>
  );
}
