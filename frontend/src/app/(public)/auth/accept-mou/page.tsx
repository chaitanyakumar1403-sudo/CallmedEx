"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function AcceptMOUContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [stage, setStage] = useState<"loading" | "display" | "accepting" | "success" | "error" | "already_accepted">("loading");
  const [message, setMessage] = useState("Loading MOU document...");
  const [mouDocument, setMouDocument] = useState<{
    title: string;
    content_text: string;
    version: string;
    effective_date: string;
  } | null>(null);
  const [userInfo, setUserInfo] = useState<{
    email: string;
    full_name: string;
    role: string;
  } | null>(null);
  const [hasScrolledToEnd, setHasScrolledToEnd] = useState(false);

  useEffect(() => {
    if (!token) {
      setStage("error");
      setMessage("Invalid or missing registration token. Please sign up again.");
      return;
    }

    const fetchMOU = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/auth/mou/preview?token=${encodeURIComponent(token)}`);
        const data = await response.json();

        if (!response.ok) {
          setStage("error");
          setMessage(data.detail || "Failed to load MOU. The link may have expired.");
          return;
        }

        if (data.already_accepted) {
          setStage("already_accepted");
          setMessage("This account has already been activated.");
          return;
        }

        setMouDocument(data.document);
        setUserInfo(data.user_info);
        setStage("display");
      } catch {
        setStage("error");
        setMessage("A network error occurred while connecting to the server.");
      }
    };

    fetchMOU();
  }, [token]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    // Consider "scrolled to end" when within 50px of the bottom
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 50) {
      setHasScrolledToEnd(true);
    }
  };

  const handleAccept = async () => {
    if (!token) return;
    setStage("accepting");

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/auth/accept-mou`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          ip_address: "client-side",
          user_agent: navigator.userAgent,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setStage("success");
        setMessage(data.message || "Account successfully activated!");
        setTimeout(() => {
          router.push("/auth/login");
        }, 4000);
      } else {
        setStage("error");
        setMessage(data.detail || "MOU acceptance failed. The token may have expired.");
      }
    } catch {
      setStage("error");
      setMessage("A network error occurred. Please try again.");
    }
  };

  const roleDisplay = userInfo?.role?.replace("_", " ")?.replace(/\b\w/g, l => l.toUpperCase()) || "Provider";

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#f1f5f9",
      padding: "20px",
    }}>
      <div style={{
        backgroundColor: "white",
        borderRadius: "16px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.1)",
        maxWidth: "700px",
        width: "100%",
        overflow: "hidden",
      }}>
        {/* ─── Header ─── */}
        <div style={{
          background: "linear-gradient(135deg, #1a2b4a 0%, #2d4a7a 100%)",
          padding: "30px 40px",
          color: "white",
        }}>
          <div style={{ fontSize: "1.6rem", fontWeight: "bold", marginBottom: 4 }}>
            📋 CallMedex — {roleDisplay} MOU
          </div>
          {userInfo && (
            <div style={{ opacity: 0.85, fontSize: "0.9rem" }}>
              For: {userInfo.full_name} ({userInfo.email})
            </div>
          )}
        </div>

        <div style={{ padding: "30px 40px" }}>
          {/* ─── LOADING STATE ─── */}
          {stage === "loading" && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ fontSize: "3rem", marginBottom: "16px" }}>⏳</div>
              <h3 style={{ color: "#1f2937" }}>Loading MOU Document...</h3>
              <p style={{ color: "#6b7280" }}>{message}</p>
            </div>
          )}

          {/* ─── DISPLAY MOU STATE ─── */}
          {stage === "display" && mouDocument && (
            <>
              <div style={{
                backgroundColor: "#fefce8",
                border: "1px solid #fde68a",
                borderRadius: 8,
                padding: "12px 16px",
                marginBottom: 20,
                fontSize: "0.85rem",
                color: "#92400e",
              }}>
                ⚠️ Please read the entire MOU below carefully before accepting. Scroll to the bottom to enable the accept button.
              </div>

              <h3 style={{ color: "#1a2b4a", marginBottom: 8 }}>
                {mouDocument.title}
              </h3>
              <div style={{
                display: "flex",
                gap: 16,
                marginBottom: 16,
                fontSize: "0.8rem",
                color: "#6b7280",
              }}>
                <span>📄 Version: {mouDocument.version}</span>
                <span>📅 Effective: {mouDocument.effective_date}</span>
              </div>

              {/* MOU Content — Scrollable */}
              <div
                onScroll={handleScroll}
                style={{
                  maxHeight: "350px",
                  overflowY: "auto",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  padding: "20px",
                  backgroundColor: "#fafafa",
                  fontSize: "0.9rem",
                  lineHeight: 1.8,
                  whiteSpace: "pre-wrap",
                  color: "#374151",
                  marginBottom: 24,
                }}
              >
                {mouDocument.content_text}
              </div>

              {/* Legal Notice */}
              <div style={{
                backgroundColor: "#f0f9ff",
                border: "1px solid #bae6fd",
                borderRadius: 8,
                padding: "14px 16px",
                marginBottom: 24,
                fontSize: "0.82rem",
                lineHeight: 1.6,
                color: "#0c4a6e",
              }}>
                🔒 <strong>Legal Notice:</strong> By clicking the button below, you legally agree to the terms 
                outlined in this MOU. Your acceptance will be recorded with your IP address, browser information, 
                and timestamp for compliance purposes.
              </div>

              {/* Accept Button */}
              <button
                onClick={handleAccept}
                disabled={!hasScrolledToEnd}
                style={{
                  width: "100%",
                  padding: "16px",
                  fontSize: "1.05rem",
                  fontWeight: "bold",
                  border: "none",
                  borderRadius: 10,
                  cursor: hasScrolledToEnd ? "pointer" : "not-allowed",
                  backgroundColor: hasScrolledToEnd ? "#059669" : "#d1d5db",
                  color: hasScrolledToEnd ? "white" : "#9ca3af",
                  transition: "all 0.3s ease",
                  boxShadow: hasScrolledToEnd ? "0 4px 14px rgba(5, 150, 105, 0.4)" : "none",
                }}
              >
                {hasScrolledToEnd ? "✅ I Agree & Activate My Account" : "📜 Please scroll to the end of the MOU to continue"}
              </button>

              <p style={{
                textAlign: "center",
                marginTop: 16,
                fontSize: "0.8rem",
                color: "#9ca3af",
              }}>
                Don&apos;t agree? Simply close this page. No account will be created.
              </p>
            </>
          )}

          {/* ─── ACCEPTING STATE ─── */}
          {stage === "accepting" && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ fontSize: "3rem", marginBottom: "16px" }}>🔄</div>
              <h3 style={{ color: "#1f2937" }}>Activating Your Account...</h3>
              <p style={{ color: "#6b7280" }}>Recording your acceptance and creating your account. Please wait.</p>
            </div>
          )}

          {/* ─── SUCCESS STATE ─── */}
          {stage === "success" && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ fontSize: "4rem", marginBottom: "16px" }}>🎉</div>
              <h2 style={{ color: "#059669", marginBottom: 8 }}>Account Activated!</h2>
              <p style={{ color: "#4b5563", marginBottom: 24 }}>{message}</p>
              <div style={{
                backgroundColor: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: 10,
                padding: "20px",
                marginBottom: 24,
                textAlign: "left",
              }}>
                <p style={{ fontWeight: 600, color: "#166534", marginBottom: 8 }}>✅ What&apos;s next:</p>
                <ul style={{ margin: 0, paddingLeft: 20, color: "#15803d", lineHeight: 1.8 }}>
                  <li>Log in to your {roleDisplay} dashboard</li>
                  <li>Complete your profile and upload verification documents</li>
                  <li>Start receiving bookings from patients</li>
                </ul>
              </div>
              <p style={{ color: "#6b7280", fontSize: "0.9rem" }}>Redirecting to login page in 4 seconds...</p>
              <button
                onClick={() => router.push("/auth/login")}
                style={{
                  marginTop: 12,
                  padding: "10px 24px",
                  backgroundColor: "#1a2b4a",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                Go to Login Now →
              </button>
            </div>
          )}

          {/* ─── ALREADY ACCEPTED STATE ─── */}
          {stage === "already_accepted" && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ fontSize: "3rem", marginBottom: "16px" }}>ℹ️</div>
              <h2 style={{ color: "#2563eb", marginBottom: 8 }}>Already Activated</h2>
              <p style={{ color: "#4b5563", marginBottom: 24 }}>{message}</p>
              <button
                onClick={() => router.push("/auth/login")}
                style={{
                  padding: "10px 24px",
                  backgroundColor: "#2563eb",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                Go to Login
              </button>
            </div>
          )}

          {/* ─── ERROR STATE ─── */}
          {stage === "error" && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ fontSize: "3rem", marginBottom: "16px" }}>❌</div>
              <h2 style={{ color: "#dc2626", marginBottom: 8 }}>Verification Failed</h2>
              <p style={{ color: "#4b5563", marginBottom: 24 }}>{message}</p>
              <button
                onClick={() => router.push("/auth/signup")}
                style={{
                  padding: "10px 24px",
                  backgroundColor: "#2563eb",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                Back to Sign Up
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AcceptMOU() {
  return (
    <Suspense fallback={<div style={{ textAlign: "center", padding: "40px" }}>Loading...</div>}>
      <AcceptMOUContent />
    </Suspense>
  );
}
