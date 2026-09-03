"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  FileText,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Lock,
  DollarSign,
  Percent,
  Sliders,
  Sparkles,
  Info,
  Check,
} from "lucide-react";

interface ScopeItem {
  id: string;
  service_name: string;
  category: string;
  modality: string;
  benchmark_price: number;
  custom_price: number;
  platform_fee_amount: number;
  provider_share_amount: number;
  is_active: boolean;
}

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
  const [scopeCatalog, setScopeCatalog] = useState<ScopeItem[]>([]);
  const [hasScrolledToEnd, setHasScrolledToEnd] = useState(false);
  const [isAgreed, setIsAgreed] = useState(false);
  const [activeTab, setActiveTab] = useState<"mou" | "scope">("mou");

  const checkScroll = (el: HTMLDivElement | null) => {
    if (!el) return;
    const { scrollHeight, scrollTop, clientHeight } = el;
    const isAtBottom =
      scrollHeight <= clientHeight + 50 ||
      scrollHeight - scrollTop - clientHeight <= 100 ||
      (scrollTop + clientHeight) / Math.max(scrollHeight, 1) >= 0.8;

    if (isAtBottom && !hasScrolledToEnd) {
      setHasScrolledToEnd(true);
      setIsAgreed(true);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    checkScroll(e.currentTarget);
  };

  const scrollRefCallback = (node: HTMLDivElement | null) => {
    if (node) {
      setTimeout(() => checkScroll(node), 100);
    }
  };

  useEffect(() => {
    if (!token) {
      setStage("error");
      setMessage("Invalid or missing registration token. Please sign up again.");
      return;
    }

    const fetchMOU = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/auth/mou/preview?token=${encodeURIComponent(token)}`
        );
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

        if (Array.isArray(data.scope_catalog) && data.scope_catalog.length > 0) {
          setScopeCatalog(
            data.scope_catalog.map((item: any) => ({
              ...item,
              custom_price: item.custom_price || item.benchmark_price || 400,
              platform_fee_amount: (item.custom_price || item.benchmark_price || 400) * 0.2,
              provider_share_amount: (item.custom_price || item.benchmark_price || 400) * 0.8,
              is_active: item.is_active !== false,
            }))
          );
        }

        setStage("display");
      } catch {
        setStage("error");
        setMessage("A network error occurred while connecting to the server.");
      }
    };

    fetchMOU();
  }, [token]);

  const handlePriceChange = (index: number, newPrice: number) => {
    const validPrice = Math.max(0, isNaN(newPrice) ? 0 : newPrice);
    setScopeCatalog((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        custom_price: validPrice,
        platform_fee_amount: Math.round(validPrice * 0.2),
        provider_share_amount: Math.round(validPrice * 0.8),
      };
      return updated;
    });
  };

  const handleToggleService = (index: number) => {
    setScopeCatalog((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        is_active: !updated[index].is_active,
      };
      return updated;
    });
  };

  const handleAccept = async () => {
    if (!token) return;
    setStage("accepting");

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/auth/accept-mou`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            ip_address: "client-side",
            user_agent: navigator.userAgent,
            selected_scope: scopeCatalog.length > 0 ? scopeCatalog : undefined,
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        setStage("success");
        setMessage(data.message || "Account successfully activated!");
        setTimeout(() => {
          router.push("/auth/login");
        }, 3500);
      } else {
        setStage("error");
        setMessage(data.detail || "MOU acceptance failed. The token may have expired.");
      }
    } catch {
      setStage("error");
      setMessage("A network error occurred. Please try again.");
    }
  };

  const roleDisplay = userInfo?.role?.replace("_", " ")?.replace(/\b\w/g, (l) => l.toUpperCase()) || "Healthcare Provider";
  const canAccept = hasScrolledToEnd || isAgreed;
  const activeServicesCount = scopeCatalog.filter((s) => s.is_active).length;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f8fafc", padding: "32px 16px", display: "flex", justifyContent: "center" }}>
      <div style={{ maxWidth: "900px", width: "100%" }}>
        {/* ─── Premium Header ─── */}
        <div
          style={{
            background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0369a1 100%)",
            borderRadius: "16px 16px 0 0",
            padding: "32px 36px",
            color: "white",
            boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.2)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <ShieldCheck size={22} color="#38bdf8" />
                <span style={{ fontSize: "0.85rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#7dd3fc" }}>
                  Official Partner Agreement
                </span>
              </div>
              <h1 style={{ fontSize: "1.75rem", fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
                CallMedex — {roleDisplay} Onboarding
              </h1>
              {userInfo && (
                <p style={{ margin: "6px 0 0", fontSize: "0.92rem", color: "#cbd5e1" }}>
                  Registered Practitioner: <strong>{userInfo.full_name}</strong> ({userInfo.email})
                </p>
              )}
            </div>

            {/* Commercial Split Pill */}
            <div
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.1)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                borderRadius: "12px",
                padding: "10px 18px",
                textAlign: "right",
              }}
            >
              <div style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "#94a3b8", fontWeight: 600 }}>Commercial Share</div>
              <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#38bdf8" }}>
                80% Provider <span style={{ color: "#94a3b8", fontSize: "0.9rem" }}>/ 20% CallMedex</span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs (if scope is available) */}
          {stage === "display" && scopeCatalog.length > 0 && (
            <div style={{ display: "flex", gap: 12, marginTop: 24, borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: 16 }}>
              <button
                type="button"
                onClick={() => setActiveTab("mou")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  backgroundColor: activeTab === "mou" ? "#0284c7" : "transparent",
                  color: activeTab === "mou" ? "white" : "#cbd5e1",
                  transition: "all 0.2s ease",
                }}
              >
                <FileText size={16} /> Legal MOU Terms
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("scope")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  backgroundColor: activeTab === "scope" ? "#0284c7" : "transparent",
                  color: activeTab === "scope" ? "white" : "#cbd5e1",
                  transition: "all 0.2s ease",
                }}
              >
                <Sliders size={16} /> Scope of Services &amp; Tariffs ({activeServicesCount})
              </button>
            </div>
          )}
        </div>

        {/* ─── Main Content Box ─── */}
        <div
          style={{
            backgroundColor: "white",
            borderRadius: "0 0 16px 16px",
            boxShadow: "0 20px 40px -15px rgba(0, 0, 0, 0.08)",
            padding: "32px 36px",
            border: "1px solid #e2e8f0",
            borderTop: "none",
          }}
        >
          {/* Loading */}
          {stage === "loading" && (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <div style={{ display: "inline-flex", padding: 16, borderRadius: "50%", background: "#f0f9ff", marginBottom: 16 }}>
                <Clock size={36} color="#0284c7" className="animate-spin" />
              </div>
              <h3 style={{ color: "#1e293b", margin: "0 0 8px" }}>Loading Agreement &amp; Scope Catalog...</h3>
              <p style={{ color: "#64748b", margin: 0 }}>{message}</p>
            </div>
          )}

          {/* Display MOU & Scope */}
          {stage === "display" && mouDocument && (
            <>
              {/* TAB 1: Legal MOU */}
              {activeTab === "mou" && (
                <div>
                  <div
                    style={{
                      backgroundColor: "#f0f9ff",
                      border: "1px solid #bae6fd",
                      borderRadius: 10,
                      padding: "14px 18px",
                      marginBottom: 20,
                      fontSize: "0.88rem",
                      color: "#0369a1",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <Info size={18} color="#0284c7" style={{ flexShrink: 0 }} />
                    <div>
                      Please scroll through the official memorandum below. Once reviewed, you can customize your scope of services and agree to proceed.
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <h3 style={{ color: "#0f172a", margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>
                      {mouDocument.title}
                    </h3>
                    <div style={{ display: "flex", gap: 12, fontSize: "0.8rem", color: "#64748b" }}>
                      <span>Version: <strong>{mouDocument.version}</strong></span>
                      <span>Effective: <strong>{mouDocument.effective_date}</strong></span>
                    </div>
                  </div>

                  {/* Scrollable Document Container */}
                  <div
                    ref={scrollRefCallback}
                    onScroll={handleScroll}
                    style={{
                      maxHeight: "380px",
                      overflowY: "auto",
                      border: "1.5px solid #cbd5e1",
                      borderRadius: 12,
                      padding: "24px",
                      backgroundColor: "#f8fafc",
                      fontSize: "0.92rem",
                      lineHeight: 1.8,
                      whiteSpace: "pre-wrap",
                      color: "#334155",
                      marginBottom: 24,
                      WebkitOverflowScrolling: "touch",
                      boxShadow: "inset 0 2px 4px rgba(0,0,0,0.02)",
                    }}
                  >
                    {mouDocument.content_text}
                  </div>
                </div>
              )}

              {/* TAB 2: Scope of Services & Tariffs */}
              {activeTab === "scope" && scopeCatalog.length > 0 && (
                <div>
                  <div
                    style={{
                      backgroundColor: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                      borderRadius: 10,
                      padding: "16px 20px",
                      marginBottom: 24,
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                    }}
                  >
                    <Sparkles size={20} color="#16a34a" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div style={{ fontSize: "0.88rem", color: "#166534", lineHeight: 1.6 }}>
                      <strong>Your Clinical Services &amp; Tariff Schedule:</strong>
                      <br />
                      You have full discretion to offer, pause, or customize the consultation fee for each service.
                      CallMedex automatically deducts a <strong>20% platform management fee</strong>; <strong>80% is credited directly to your account</strong>.
                    </div>
                  </div>

                  {/* Services List */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: "440px", overflowY: "auto", paddingRight: 6 }}>
                    {scopeCatalog.map((item, idx) => (
                      <div
                        key={item.id}
                        style={{
                          border: item.is_active ? "1.5px solid #0284c7" : "1px solid #e2e8f0",
                          borderRadius: 12,
                          padding: "16px",
                          backgroundColor: item.is_active ? "#ffffff" : "#f8fafc",
                          opacity: item.is_active ? 1 : 0.65,
                          transition: "all 0.2s ease",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                          {/* Checkbox and info */}
                          <div style={{ display: "flex", gap: 12, flex: "1 1 340px" }}>
                            <input
                              type="checkbox"
                              checked={item.is_active}
                              onChange={() => handleToggleService(idx)}
                              style={{ width: 20, height: 20, marginTop: 3, accentColor: "#0284c7", cursor: "pointer" }}
                            />
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "0.95rem" }}>
                                  {item.service_name}
                                </span>
                                <span
                                  style={{
                                    fontSize: "0.72rem",
                                    fontWeight: 700,
                                    textTransform: "uppercase",
                                    padding: "2px 8px",
                                    borderRadius: 999,
                                    backgroundColor: item.modality === "online" ? "#eff6ff" : item.modality === "home" ? "#fef3c7" : "#f1f5f9",
                                    color: item.modality === "online" ? "#1d4ed8" : item.modality === "home" ? "#92400e" : "#475569",
                                  }}
                                >
                                  {item.modality}
                                </span>
                              </div>
                              <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: 2 }}>
                                Category: {item.category} • CallMedex Reference: ₹{item.benchmark_price}
                              </div>
                            </div>
                          </div>

                          {/* Fee input & split breakdown */}
                          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                            <div>
                              <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#475569", marginBottom: 2 }}>
                                Patient Fee (₹)
                              </label>
                              <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: 8, padding: "4px 8px", backgroundColor: "white" }}>
                                <span style={{ color: "#64748b", fontSize: "0.85rem", marginRight: 4 }}>₹</span>
                                <input
                                  type="number"
                                  disabled={!item.is_active}
                                  value={item.custom_price}
                                  onChange={(e) => handlePriceChange(idx, parseFloat(e.target.value))}
                                  style={{ width: 75, border: "none", outline: "none", fontSize: "0.95rem", fontWeight: 700, color: "#0f172a" }}
                                />
                              </div>
                            </div>

                            <div style={{ textAlign: "right", minWidth: 120 }}>
                              <div style={{ fontSize: "0.72rem", color: "#64748b" }}>
                                Platform Fee (20%): <span style={{ color: "#dc2626" }}>₹{item.platform_fee_amount}</span>
                              </div>
                              <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#16a34a" }}>
                                Your Take-Home (80%): ₹{item.provider_share_amount}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Agreement Checkbox */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: "16px 20px",
                  backgroundColor: canAccept ? "#f0fdf4" : "#f8fafc",
                  border: `1.5px solid ${canAccept ? "#86efac" : "#e2e8f0"}`,
                  borderRadius: 12,
                  marginTop: 24,
                  marginBottom: 20,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onClick={() => {
                  const newVal = !isAgreed;
                  setIsAgreed(newVal);
                  if (newVal) setHasScrolledToEnd(true);
                }}
              >
                <input
                  type="checkbox"
                  id="agree-mou-checkbox"
                  checked={canAccept}
                  onChange={(e) => {
                    setIsAgreed(e.target.checked);
                    if (e.target.checked) setHasScrolledToEnd(true);
                  }}
                  style={{ width: 20, height: 20, marginTop: 2, cursor: "pointer", accentColor: "#16a34a" }}
                />
                <label
                  htmlFor="agree-mou-checkbox"
                  style={{
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    color: canAccept ? "#166534" : "#334155",
                    cursor: "pointer",
                    userSelect: "none",
                    lineHeight: 1.5,
                  }}
                >
                  I have read, understood, and solemnly accept the Memorandum of Understanding (MOU), terms of clinical service, 80/20 commercial split, and the customized scope of services above.
                </label>
              </div>

              {/* Legal Notice */}
              <div
                style={{
                  backgroundColor: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  padding: "12px 16px",
                  marginBottom: 24,
                  fontSize: "0.8rem",
                  color: "#64748b",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Lock size={16} color="#64748b" style={{ flexShrink: 0 }} />
                <div>
                  <strong>Legal Audit Trail:</strong> Your digital signature will record your IP address, browser footprint, and UTC timestamp in the CallMedex audit repository.
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: 12 }}>
                {scopeCatalog.length > 0 && activeTab === "mou" && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("scope")}
                    style={{
                      padding: "14px 24px",
                      fontSize: "0.95rem",
                      fontWeight: 700,
                      border: "1px solid #cbd5e1",
                      borderRadius: 10,
                      cursor: "pointer",
                      backgroundColor: "white",
                      color: "#334155",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Sliders size={18} /> Review Tariffs &amp; Scope
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleAccept}
                  disabled={!canAccept}
                  style={{
                    flex: 1,
                    padding: "16px 28px",
                    fontSize: "1.05rem",
                    fontWeight: 700,
                    border: "none",
                    borderRadius: 10,
                    cursor: canAccept ? "pointer" : "not-allowed",
                    backgroundColor: canAccept ? "#16a34a" : "#cbd5e1",
                    color: canAccept ? "white" : "#64748b",
                    transition: "all 0.25s ease",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    boxShadow: canAccept ? "0 4px 14px rgba(22, 163, 74, 0.35)" : "none",
                  }}
                >
                  {canAccept ? (
                    <>
                      <CheckCircle2 size={20} /> I Agree &amp; Activate My Account
                    </>
                  ) : (
                    <>
                      <FileText size={18} /> Please review terms &amp; check agreement above
                    </>
                  )}
                </button>
              </div>
            </>
          )}

          {/* Accepting */}
          {stage === "accepting" && (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <div style={{ display: "inline-flex", padding: 16, borderRadius: "50%", background: "#eff6ff", marginBottom: 16 }}>
                <Clock size={36} color="#2563eb" className="animate-spin" />
              </div>
              <h3 style={{ color: "#1e293b", margin: "0 0 8px" }}>Activating Your Healthcare Account...</h3>
              <p style={{ color: "#64748b", margin: 0 }}>Registering credentials and legal agreement audit trail. Please wait.</p>
            </div>
          )}

          {/* Success */}
          {stage === "success" && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ display: "inline-flex", padding: 20, borderRadius: "50%", background: "#f0fdf4", border: "2px solid #bbf7d0", marginBottom: 20 }}>
                <CheckCircle2 size={48} color="#16a34a" />
              </div>
              <h2 style={{ color: "#166534", margin: "0 0 8px", fontSize: "1.75rem", fontWeight: 800 }}>
                Account Successfully Activated!
              </h2>
              <p style={{ color: "#4b5563", marginBottom: 24, fontSize: "0.95rem" }}>{message}</p>
              <div
                style={{
                  backgroundColor: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: "20px 24px",
                  marginBottom: 28,
                  textAlign: "left",
                  maxWidth: "500px",
                  margin: "0 auto 28px",
                }}
              >
                <p style={{ fontWeight: 700, color: "#1e293b", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <Sparkles size={16} color="#0284c7" /> Next Steps:
                </p>
                <ul style={{ margin: 0, paddingLeft: 20, color: "#475569", lineHeight: 1.8, fontSize: "0.9rem" }}>
                  <li>Log in to your {roleDisplay} dashboard</li>
                  <li>Review active appointments and doorstep dispatch tasks</li>
                  <li>Adjust your service availability and tariffs anytime from Settings</li>
                </ul>
              </div>
              <button
                type="button"
                onClick={() => router.push("/auth/login")}
                style={{
                  padding: "14px 32px",
                  backgroundColor: "#0f172a",
                  color: "white",
                  border: "none",
                  borderRadius: 10,
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: "1rem",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                Go to Login Now <ArrowRight size={18} />
              </button>
            </div>
          )}

          {/* Already Accepted */}
          {stage === "already_accepted" && (
            <div style={{ textAlign: "center", padding: "50px 0" }}>
              <div style={{ display: "inline-flex", padding: 18, borderRadius: "50%", background: "#eff6ff", marginBottom: 16 }}>
                <CheckCircle2 size={40} color="#2563eb" />
              </div>
              <h2 style={{ color: "#1e40af", margin: "0 0 8px" }}>Already Activated</h2>
              <p style={{ color: "#475569", marginBottom: 24 }}>{message}</p>
              <button
                type="button"
                onClick={() => router.push("/auth/login")}
                style={{
                  padding: "12px 28px",
                  backgroundColor: "#2563eb",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Go to Login
              </button>
            </div>
          )}

          {/* Error */}
          {stage === "error" && (
            <div style={{ textAlign: "center", padding: "50px 0" }}>
              <div style={{ display: "inline-flex", padding: 18, borderRadius: "50%", background: "#fef2f2", marginBottom: 16 }}>
                <AlertCircle size={40} color="#dc2626" />
              </div>
              <h2 style={{ color: "#991b1b", margin: "0 0 8px" }}>Verification Link Error</h2>
              <p style={{ color: "#4b5563", marginBottom: 24 }}>{message}</p>
              <button
                type="button"
                onClick={() => router.push("/auth/signup")}
                style={{
                  padding: "12px 28px",
                  backgroundColor: "#0f172a",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontWeight: 700,
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
    <Suspense fallback={<div style={{ textAlign: "center", padding: "60px" }}>Loading Agreement...</div>}>
      <AcceptMOUContent />
    </Suspense>
  );
}
