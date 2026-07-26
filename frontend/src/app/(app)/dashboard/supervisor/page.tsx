"use client";

import { useState, useEffect } from 'react';
import DashboardShell, { SkeletonRows } from '../components/DashboardShell';
import { useRouter } from 'next/navigation';
import { Button, Card, EmptyState, Icon, Pill } from '@/components/ui';
import { CheckCircle2, Navigation } from '@/components/ui/icons';

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
    return (
      <DashboardShell role="admin" title="City Supervisor" subtitle="Loading territory…"
        tabs={[]} activeTab="" onTabChange={() => {}}>
        <SkeletonRows rows={3} />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      role="admin"
      title="City Supervisor"
      subtitle={`Territory: ${supervisorCity}`}
      tabs={[]}
      activeTab=""
      onTabChange={() => {}}
      aside={
        <Button variant="secondary">
          <Icon as={Navigation} size={16} />
          Dispatch command centre
        </Button>
      }
    >
      {/* Verification Queue */}
      <section className="cm-panel">
        <h2 className="cm-panel__title">Pending Verifications Queue</h2>
        <Pill tone="urgent">{verifications.length} Requires Action</Pill>

        {verifications.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="No pending verifications"
            body={`Nothing is waiting on you in ${supervisorCity} right now.`}
          />
        ) : (
          <div className="cm-tasklist">
            {verifications.map((v: any, idx: number) => (
              <Card key={idx}>
                <div className="cm-task">
                  <Pill tone="waiting">{v.role.toUpperCase()}</Pill>
                  <div className="cm-task__body">
                    <p className="cm-task__name">{v.user.full_name}</p>
                    <p className="cm-task__meta">
                      License/Reg #: {v.data.medical_license_number || v.data.drug_license_number || v.data.certification_number || v.data.license_number || 'N/A'}
                    </p>
                  </div>
                  <div className="cm-task__actions">
                    <Button variant="danger">Reject</Button>
                    <Button variant="primary">Approve</Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

    </DashboardShell>
  );
}
