"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import TaskTracker from "./components/TaskTracker";

function MagicRespondContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const action = searchParams.get("action");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [taskData, setTaskData] = useState<any>(null);

  useEffect(() => {
    if (!token || !action) {
      setError("Invalid link. Missing token or action parameters.");
      setLoading(false);
      return;
    }

    const processResponse = async () => {
      // 🚀 DEMO BYPASS FOR VISUAL TESTING
      if (token === "demo") {
        setTimeout(() => {
          setSuccess(true);
          setTaskData({
            dispatch_id: "demo_123",
            task_session_token: "demo_token",
            patient_lat: 17.7296,
            patient_lng: 83.3086,
            patient_address: "123 Vizag Beach Road, Visakhapatnam, AP"
          });
          setLoading(false);
        }, 1500); // 1.5s fake loading
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
          setError(data.detail || data.error || "Failed to process the response. This offer may have expired or been taken by someone else.");
        } else {
          setSuccess(true);
          if (action === "accept") {
            setTaskData({
              dispatch_id: data.dispatch_id,
              task_session_token: data.task_session_token,
              patient_lat: data.patient_lat,
              patient_lng: data.patient_lng,
              patient_address: data.patient_address
            });
          }
        }
      } catch (err) {
        console.error(err);
        setError("Network error. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    
    processResponse();
  }, [token, action]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f8fafc' }}>
        <div style={{ width: '40px', height: '40px', border: '4px solid #cbd5e1', borderTop: '4px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <h2 style={{ marginTop: '20px', color: '#334155' }}>Processing your response...</h2>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#fef2f2' }}>
        <div style={{ fontSize: '4rem', marginBottom: '20px' }}>⚠️</div>
        <h2 style={{ color: '#991b1b', marginBottom: '10px' }}>Action Failed</h2>
        <p style={{ color: '#b91c1c', textAlign: 'center', maxWidth: '400px' }}>{error}</p>
      </div>
    );
  }

  if (action === "decline") {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f8fafc' }}>
        <div style={{ fontSize: '4rem', marginBottom: '20px' }}>👋</div>
        <h2 style={{ color: '#334155', marginBottom: '10px' }}>Offer Declined</h2>
        <p style={{ color: '#64748b', textAlign: 'center', maxWidth: '400px' }}>
          Thank you for letting us know. We will assign this request to the next available provider. You may close this page.
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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f8fafc' }}>
        <div style={{ width: '40px', height: '40px', border: '4px solid #cbd5e1', borderTop: '4px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <h2 style={{ marginTop: '20px', color: '#334155' }}>Loading...</h2>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <MagicRespondContent />
    </Suspense>
  );
}
