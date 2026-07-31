'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AppBar } from "@/components/ui";
import { ToastProvider } from "@/components/ui/Toast";

/**
 * App routes layout with auth guard and toast notifications.
 *
 * Every dashboard route is protected: unauthenticated users are redirected
 * to /auth/login. Role-specific access is enforced by individual pages,
 * but the baseline auth check happens here to prevent page flashes.
 */
function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    if (!token || !userStr) {
      // Not authenticated — redirect to login, preserving the intended destination
      const redirect = encodeURIComponent(pathname || '/dashboard/patient');
      router.replace(`/auth/login?redirect=${redirect}`);
      return;
    }

    try {
      const user = JSON.parse(userStr);
      if (!user?.id || !user?.role) {
        throw new Error('Invalid user data');
      }
      setAuthorized(true);
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      router.replace('/auth/login');
    }
    setChecked(true);
  }, [router, pathname]);

  // Show nothing while checking auth — prevents flash of protected content
  if (!checked) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: '#f8fafc',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 40, height: 40, border: '3px solid #e2e8f0',
            borderTopColor: '#1a2b4a', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite', margin: '0 auto 16px',
          }} />
          <p style={{ color: '#64748b', fontSize: 14 }}>Loading...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!authorized) {
    return null;
  }

  return <>{children}</>;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AuthGuard>
        <AppBar role="" />
        <main id="main">{children}</main>
      </AuthGuard>
    </ToastProvider>
  );
}
