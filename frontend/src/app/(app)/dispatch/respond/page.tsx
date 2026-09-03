"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import TaskTracker from "./components/TaskTracker";
import { AlertTriangle, UserX, Loader2 } from "lucide-react";

function MagicRespondContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const action = searchParams.get("action");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [taskData, setTaskData] = useState<any>(null);

  useEffect(() => {
    if (!token || !action) {
      setError("Invalid link. Missing token or action parameters.");
      setLoading(false);
      return;
    }

    const processResponse = async () => {
      // Demo bypass for testing
      if (token === "demo") {
        setTimeout(() => {
          setTaskData({
            dispatch_id: "demo_123",
            task_session_token: "demo_token",
            patient_lat: 17.7296,
            patient_lng: 83.3086,
            patient_address: "123 Vizag Beach Road, Visakhapatnam, AP",
          });
          setLoading(false);
        }, 1200);
        return;
      }

      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const res = await fetch(`${apiBase}/api/dispatch/magic-respond`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, token }),
        });

        const data = await res.json();
        
        if (!res.ok || !data.success) {
          setError(data.detail || data.error || "Failed to process the response. This offer may have expired or been assigned to another provider.");
        } else {
          if (action === "accept") {
            setTaskData({
              dispatch_id: data.dispatch_id,
              task_session_token: data.task_session_token,
              patient_lat: data.patient_lat,
              patient_lng: data.patient_lng,
              patient_address: data.patient_address,
            });
          }
        }
      } catch (err) {
        console.error(err);
        setError("Network error. Please check your connection and try again.");
      } finally {
        setLoading(false);
      }
    };
    
    processResponse();
  }, [token, action]);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", background: "var(--cm-surface)" }}>
        <Loader2 size={36} className="cm-spinner" style={{ color: "var(--cm-active)", animation: "spin 1s linear infinite" }} />
        <h2 style={{ marginTop: "20px", color: "var(--cm-ink)", fontSize: "var(--cm-text-base)", fontWeight: 800 }}>Processing Dispatch Response...</h2>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", background: "var(--cm-surface)", padding: 20 }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--cm-urgent-surface)", color: "var(--cm-urgent)", display: "grid", placeItems: "center", marginBottom: 16 }}>
          <AlertTriangle size={32} />
        </div>
        <h2 style={{ color: "var(--cm-urgent)", marginBottom: 8, fontSize: "var(--cm-text-lg)", fontWeight: 800 }}>Action Incomplete</h2>
        <p style={{ color: "var(--cm-ink-3)", textAlign: "center", maxWidth: "420px", fontSize: "var(--cm-text-sm)", lineHeight: 1.5 }}>{error}</p>
      </div>
    );
  }

  if (action === "decline") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", background: "var(--cm-surface)", padding: 20 }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--cm-surface-2)", color: "var(--cm-ink-3)", display: "grid", placeItems: "center", marginBottom: 16 }}>
          <UserX size={32} />
        </div>
        <h2 style={{ color: "var(--cm-ink)", marginBottom: 8, fontSize: "var(--cm-text-lg)", fontWeight: 800 }}>Offer Declined</h2>
        <p style={{ color: "var(--cm-ink-3)", textAlign: "center", maxWidth: "420px", fontSize: "var(--cm-text-sm)", lineHeight: 1.5 }}>
          Thank you for letting us know. We will assign this request to the next available provider. You may safely close this tab.
        </p>
      </div>
    );
  }

  if (action === "accept" && taskData) {
    return <TaskTracker data={taskData} />;
  }

  return null;
}

export default function MagicRespondPage() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", background: "var(--cm-surface)" }}>
        <Loader2 size={36} className="cm-spinner" style={{ color: "var(--cm-active)", animation: "spin 1s linear infinite" }} />
        <h2 style={{ marginTop: "20px", color: "var(--cm-ink)", fontSize: "var(--cm-text-base)", fontWeight: 800 }}>Loading Dispatch Portal...</h2>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <MagicRespondContent />
    </Suspense>
  );
}
