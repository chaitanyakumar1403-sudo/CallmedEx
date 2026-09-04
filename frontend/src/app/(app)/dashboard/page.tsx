"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function UniversalDashboardDispatcher() {
  const router = useRouter();
  const [statusText, setStatusText] = useState("Connecting to CallMedex Command Center...");

  useEffect(() => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const userStr = typeof window !== "undefined" ? localStorage.getItem("user") : null;

      if (!token) {
        setStatusText("Authentication required. Redirecting to login...");
        router.replace("/auth/login?redirect=/dashboard");
        return;
      }

      let role = "patient";
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          role = user.role || "patient";
        } catch {
          // fallback default
        }
      }

      // Map canonical user roles to their dashboard routes
      const ROLE_ROUTE_MAP: Record<string, string> = {
        doctor: "/dashboard/doctor",
        dentist: "/dashboard/dentist",
        patient: "/dashboard/patient",
        phlebotomist: "/dashboard/phlebotomist",
        nurse: "/dashboard/nurse",
        dietitian: "/dashboard/dietitian",
        physiotherapist: "/dashboard/physiotherapist",
        organization: "/dashboard/organization",
        pharmacy: "/dashboard/pharmacy",
        staff: "/dashboard/staff",
        admin: "/dashboard/admin",
        supervisor: "/dashboard/supervisor",
        processing_center: "/dashboard/processing-center",
        "processing-center": "/dashboard/processing-center",
      };

      const targetPath = ROLE_ROUTE_MAP[role] || `/dashboard/${role}`;
      setStatusText(`Loading ${role.replace("_", " ").toUpperCase()} console...`);
      router.replace(targetPath);
    } catch {
      router.replace("/auth/login?redirect=/dashboard");
    }
  }, [router]);

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--cm-surface, #f8fafc)",
      fontFamily: "system-ui, -apple-system, sans-serif",
      padding: 24,
    }}>
      <div style={{
        background: "white",
        padding: "36px 44px",
        borderRadius: 16,
        border: "1px solid var(--cm-line, #e2e8f0)",
        boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
        textAlign: "center",
        maxWidth: 420,
        width: "100%",
      }}>
        <div style={{
          width: 52,
          height: 52,
          borderRadius: "50%",
          border: "3px solid #e2e8f0",
          borderTopColor: "var(--cm-active, #0284c7)",
          animation: "spin 0.8s linear infinite",
          margin: "0 auto 20px",
        }} />
        <h3 style={{
          margin: "0 0 8px",
          color: "var(--cm-navy, #0f172a)",
          fontSize: "1.15rem",
          fontWeight: 800,
          letterSpacing: "-0.02em",
        }}>
          CallMedex Provider Portal
        </h3>
        <p style={{
          margin: 0,
          color: "var(--cm-ink-2, #64748b)",
          fontSize: "0.85rem",
          lineHeight: 1.5,
        }}>
          {statusText}
        </p>
      </div>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
