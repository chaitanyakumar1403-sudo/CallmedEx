"use client";

import { useState, useRef, useEffect, useCallback } from "react";

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const getToken = () => typeof window !== "undefined" ? localStorage.getItem("token") : null;

/**
 * Utility to convert data URI to a binary Blob (synchronous fallback for canvas.toBlob).
 */
function dataURItoBlob(dataURI: string): Blob {
  const byteString = atob(dataURI.split(",")[1]);
  const mimeString = dataURI.split(",")[0].split(":")[1].split(";")[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeString });
}

/**
 * SelfieVerificationCard — post-registration identity liveness verification.
 * Supports:
 *  1. Live WebRTC camera viewfinder with progressive constraint fallbacks and guaranteed DOM mounting.
 *  2. Native direct device camera (`capture="user"`).
 *  3. Photo file upload.
 * Verified with backend /api/verification/verify-selfie.
 */
export default function SelfieVerificationCard({ onVerified }: { onVerified?: () => void } = {}) {
  const [status, setStatus] = useState<"idle" | "capturing" | "uploading" | "verified" | "failed">("idle");
  const [message, setMessage] = useState("");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [startingCamera, setStartingCamera] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Sync ref with state
  streamRef.current = stream;

  // ─── Initial Verification Status Check ──────────────────────────────────────
  const checkInitialStatus = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    try {
      const res = await fetch(`${apiBase}/api/verification/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.data?.documents) {
        const hasVerifiedSelfie = data.data.documents.some(
          (d: any) => d.document_type === "live_selfie" && d.verification_status === "verified"
        );
        if (hasVerifiedSelfie) {
          setStatus("verified");
          setMessage("Selfie identity liveness is active and verified.");
        }
      }
    } catch {
      // Non-blocking background check
    }
  }, []);

  useEffect(() => {
    checkInitialStatus();
  }, [checkInitialStatus]);

  // ─── Video Stream DOM Binding Effect ────────────────────────────────────────
  useEffect(() => {
    if (status === "capturing" && videoRef.current && stream) {
      const video = videoRef.current;
      if (video.srcObject !== stream) {
        video.srcObject = stream;
      }

      const handleLoadedMetadata = () => {
        setCameraReady(true);
        video.play().catch((err) => {
          console.warn("Autoplay was prevented by browser policy:", err);
        });
      };

      video.addEventListener("loadedmetadata", handleLoadedMetadata);

      if (video.readyState >= 1) {
        handleLoadedMetadata();
      }

      return () => {
        video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      };
    }
  }, [status, stream]);

  // Clean up media tracks on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // ─── Progressive Camera Constraint Ladder ──────────────────────────────────
  const startCamera = async () => {
    setMessage("");
    setCameraReady(false);
    setStartingCamera(true);

    let mediaStream: MediaStream | null = null;
    let lastError: any = null;

    // Constraint Ladder
    const attempts = [
      { video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } } },
      { video: { facingMode: "user" } },
      { video: true },
    ];

    for (const constraint of attempts) {
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia(constraint);
        if (mediaStream) break;
      } catch (err) {
        lastError = err;
      }
    }

    setStartingCamera(false);

    if (mediaStream) {
      setStream(mediaStream);
      streamRef.current = mediaStream;
      setStatus("capturing");
    } else {
      let friendlyError = "Camera access was denied or is unavailable. Please use Direct Camera or Upload Photo below.";
      if (lastError instanceof DOMException) {
        if (lastError.name === "NotAllowedError" || lastError.name === "PermissionDeniedError") {
          friendlyError = "Camera permission was denied. Please allow camera permissions in your browser or use Direct Camera / Upload Photo.";
        } else if (lastError.name === "NotFoundError" || lastError.name === "DevicesNotFoundError") {
          friendlyError = "No camera hardware detected on this device. Please upload a photo instead.";
        }
      }
      setStatus("failed");
      setMessage(friendlyError);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setStream(null);
    setCameraReady(false);
    setStatus("idle");
  };

  // ─── Resilient Frame Capture & Post-Blob Teardown ────────────────────────────
  const captureAndVerify = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    const width = video.videoWidth > 0 ? video.videoWidth : (video.clientWidth || 640);
    const height = video.videoHeight > 0 ? video.videoHeight : (video.clientHeight || 480);

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setStatus("failed");
      setMessage("Could not initialize camera canvas context.");
      return;
    }

    // Mirror horizontal display for natural selfie capture
    ctx.save();
    ctx.drawImage(video, 0, 0, width, height);
    ctx.restore();

    const proceedWithBlob = async (blob: Blob) => {
      // Safe teardown: only stop hardware tracks AFTER blob is fully generated
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setStream(null);
      setCameraReady(false);

      setStatus("uploading");
      setMessage("");
      await uploadSelfie(blob);
    };

    // 1. Try standard async canvas.toBlob
    try {
      canvas.toBlob((blob) => {
        if (blob && blob.size > 0) {
          proceedWithBlob(blob);
        } else {
          // 2. Synchronous fallback via dataURL if toBlob returns null (e.g. 0x0 canvas bug on older drivers)
          try {
            const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
            const fallbackBlob = dataURItoBlob(dataUrl);
            if (fallbackBlob && fallbackBlob.size > 0) {
              proceedWithBlob(fallbackBlob);
            } else {
              setStatus("failed");
              setMessage("Failed to capture photo frame. Please try again or upload a photo.");
            }
          } catch {
            setStatus("failed");
            setMessage("Failed to capture photo frame. Please try again or upload a photo.");
          }
        }
      }, "image/jpeg", 0.92);
    } catch {
      // Fallback if toBlob throws
      try {
        const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
        const fallbackBlob = dataURItoBlob(dataUrl);
        proceedWithBlob(fallbackBlob);
      } catch {
        setStatus("failed");
        setMessage("Failed to capture photo frame. Please try again or upload a photo.");
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("uploading");
    setMessage("");
    await uploadSelfie(file);
  };

  const uploadSelfie = async (file: Blob) => {
    const token = getToken();
    if (!token) {
      setStatus("failed");
      setMessage("Session expired. Please log in to complete verification.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file, "live_selfie.jpg");

    try {
      const res = await fetch(`${apiBase}/api/verification/verify-selfie`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        setStatus("verified");
        setMessage("✅ Live selfie verified successfully! Your practitioner identity is confirmed.");
        onVerified?.();
      } else {
        setStatus("failed");
        setMessage(`❌ ${data.message || "Liveness check failed. Please ensure your face is well-lit and clearly visible."}`);
      }
    } catch {
      setStatus("failed");
      setMessage("❌ Network communication error during verification. Please check connection and try again.");
    }
  };

  return (
    <div
      className="card"
      style={{
        padding: "20px 24px",
        borderLeft: "4px solid #8b5cf6",
        borderRadius: "12px",
        background: "#ffffff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        marginBottom: 20,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <h4 style={{ margin: 0, color: "#1e293b", fontSize: "1.05rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
            📸 Live Selfie Identity Verification
          </h4>
          <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "#64748b" }}>
            Real-time biometric liveness check required for practitioner directory listing and clinical dispatch.
          </p>
        </div>
        {status === "verified" && (
          <span
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              fontSize: "0.8rem",
              fontWeight: 700,
              backgroundColor: "#d1fae5",
              color: "#065f46",
              border: "1px solid #a7f3d0",
            }}
          >
            ✅ Verified
          </span>
        )}
      </div>

      {status === "idle" && (
        <div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            <button
              onClick={startCamera}
              disabled={startingCamera}
              style={{
                padding: "10px 20px",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                backgroundColor: "#8b5cf6",
                color: "white",
                fontWeight: 700,
                fontSize: "0.86rem",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                boxShadow: "0 2px 4px rgba(139, 92, 246, 0.25)",
              }}
            >
              📷 {startingCamera ? "Opening Camera..." : "Open Camera Viewfinder"}
            </button>

            <label
              style={{
                padding: "10px 18px",
                borderRadius: 8,
                border: "1px solid #c4b5fd",
                cursor: "pointer",
                backgroundColor: "#f5f3ff",
                fontWeight: 700,
                fontSize: "0.86rem",
                color: "#6d28d9",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              📱 Direct Camera (Mobile / Tablet)
              <input
                type="file"
                accept="image/*"
                capture="user"
                onChange={handleFileUpload}
                style={{ display: "none" }}
              />
            </label>

            <label
              style={{
                padding: "10px 18px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                cursor: "pointer",
                backgroundColor: "white",
                fontWeight: 700,
                fontSize: "0.86rem",
                color: "#374151",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              📁 Upload Photo File
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                style={{ display: "none" }}
              />
            </label>
          </div>

          <div style={{ fontSize: "0.78rem", color: "#94a3b8", display: "flex", gap: 16 }}>
            <span>• Face well-lit and directly centered</span>
            <span>• No dark sunglasses or excessive glare</span>
            <span>• Single practitioner in frame</span>
          </div>
        </div>
      )}

      {status === "capturing" && (
        <div style={{ maxWidth: 440 }}>
          <div
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: "4/3",
              background: "#0f172a",
              borderRadius: 12,
              overflow: "hidden",
              marginBottom: 14,
              border: "2px solid #8b5cf6",
            }}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: "scaleX(-1)", // Mirror effect for natural selfie preview
              }}
            />
            <canvas ref={canvasRef} style={{ display: "none" }} />

            {!cameraReady && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(15, 23, 42, 0.8)",
                  color: "#ffffff",
                  fontSize: "0.85rem",
                  gap: 8,
                }}
              >
                <div style={{ fontSize: "1.5rem" }}>⏳</div>
                <span>Initializing camera sensor...</span>
              </div>
            )}

            {cameraReady && (
              <div
                style={{
                  position: "absolute",
                  top: 10,
                  right: 10,
                  background: "rgba(0,0,0,0.6)",
                  color: "#34d399",
                  padding: "4px 10px",
                  borderRadius: 999,
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#10b981",
                    display: "inline-block",
                    boxShadow: "0 0 6px #10b981",
                  }}
                />
                LIVE FEED
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={captureAndVerify}
              disabled={!cameraReady}
              style={{
                padding: "10px 24px",
                borderRadius: 8,
                border: "none",
                cursor: cameraReady ? "pointer" : "not-allowed",
                backgroundColor: cameraReady ? "#059669" : "#9ca3af",
                color: "white",
                fontWeight: 700,
                fontSize: "0.9rem",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                boxShadow: cameraReady ? "0 2px 4px rgba(5, 150, 105, 0.25)" : "none",
              }}
            >
              📸 Capture &amp; Verify
            </button>
            <button
              onClick={stopCamera}
              style={{
                padding: "10px 20px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                cursor: "pointer",
                backgroundColor: "white",
                fontWeight: 600,
                fontSize: "0.86rem",
                color: "#4b5563",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {status === "uploading" && (
        <div style={{ textAlign: "center", padding: "28px 16px" }}>
          <div style={{ fontSize: "2.2rem", marginBottom: 10 }}>🤖</div>
          <p style={{ color: "#1e293b", fontWeight: 700, fontSize: "0.95rem", margin: "0 0 6px" }}>
            Running AI Biometric Liveness Verification...
          </p>
          <p style={{ color: "#64748b", fontSize: "0.82rem", margin: 0 }}>
            Analyzing face landmarks, environmental lighting, and anti-spoofing criteria.
          </p>
        </div>
      )}

      {status === "failed" && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "14px 18px", marginTop: 8 }}>
          <p style={{ color: "#dc2626", fontWeight: 600, fontSize: "0.88rem", margin: "0 0 12px", lineHeight: 1.4 }}>
            {message}
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={() => {
                setStatus("idle");
                setMessage("");
              }}
              style={{
                padding: "8px 18px",
                borderRadius: 6,
                border: "1px solid #f87171",
                cursor: "pointer",
                backgroundColor: "#ffffff",
                color: "#b91c1c",
                fontWeight: 700,
                fontSize: "0.82rem",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              🔄 Try Again
            </button>

            <label
              style={{
                padding: "8px 16px",
                borderRadius: 6,
                border: "1px solid #d1d5db",
                cursor: "pointer",
                backgroundColor: "white",
                fontWeight: 600,
                fontSize: "0.82rem",
                color: "#374151",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              📁 Upload Photo File Instead
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                style={{ display: "none" }}
              />
            </label>
          </div>
        </div>
      )}

      {status === "verified" && (
        <div style={{ marginTop: 4 }}>
          {message && (
            <p style={{ color: "#059669", fontWeight: 600, fontSize: "0.88rem", margin: "0 0 10px" }}>
              {message}
            </p>
          )}
          <button
            onClick={() => {
              setStatus("idle");
              setMessage("");
            }}
            style={{
              padding: "6px 14px",
              borderRadius: 6,
              border: "1px solid #d1d5db",
              cursor: "pointer",
              backgroundColor: "#f9fafb",
              fontWeight: 600,
              fontSize: "0.78rem",
              color: "#4b5563",
            }}
          >
            🔄 Retake Selfie / Update Verification
          </button>
        </div>
      )}
    </div>
  );
}
