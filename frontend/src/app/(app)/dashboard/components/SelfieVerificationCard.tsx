"use client";

import { useState, useRef } from "react";

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const getToken = () => typeof window !== "undefined" ? localStorage.getItem("token") : null;

/**
 * SelfieVerificationCard — post-registration liveness verification.
 * Renders a card that allows providers to take a selfie (camera) or upload a photo.
 * Uses the backend /api/verification/verify-selfie endpoint.
 */
export default function SelfieVerificationCard() {
  const [status, setStatus] = useState<"idle" | "capturing" | "uploading" | "verified" | "failed">("idle");
  const [message, setMessage] = useState("");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
      });
      setStream(mediaStream);
      setStatus("capturing");
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (e) {
      setMessage("Camera access denied. Please upload a selfie photo instead.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
    setStatus("idle");
  };

  const captureAndVerify = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);

    stopCamera();
    setStatus("uploading");
    setMessage("");

    canvas.toBlob(async (blob) => {
      if (!blob) { setStatus("failed"); setMessage("Failed to capture photo."); return; }
      await uploadSelfie(blob);
    }, "image/jpeg", 0.9);
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
    if (!token) { setStatus("failed"); setMessage("Not logged in."); return; }

    const formData = new FormData();
    formData.append("file", file, "selfie.jpg");

    try {
      const res = await fetch(`${apiBase}/api/verification/verify-selfie`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        setStatus("verified");
        setMessage("✅ Selfie liveness verified successfully!");
      } else {
        setStatus("failed");
        setMessage(`❌ ${data.message || "Liveness check failed."}`);
      }
    } catch {
      setStatus("failed");
      setMessage("❌ Network error. Please try again.");
    }
  };

  return (
    <div className="card" style={{
      padding: 20, borderLeft: "4px solid #8b5cf6",
      marginBottom: 16,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <h4 style={{ margin: 0, color: "#1e293b", fontSize: "1rem" }}>📸 Live Selfie Verification</h4>
          <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "#6b7280" }}>
            Take a selfie or upload a photo for identity liveness verification
          </p>
        </div>
        {status === "verified" && (
          <span style={{
            padding: "6px 14px", borderRadius: 999, fontSize: "0.8rem", fontWeight: 700,
            backgroundColor: "#d1fae5", color: "#065f46",
          }}>✅ Verified</span>
        )}
      </div>

      {status === "idle" && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button
            onClick={startCamera}
            style={{
              padding: "10px 20px", borderRadius: 8, border: "none", cursor: "pointer",
              backgroundColor: "#8b5cf6", color: "white", fontWeight: 700, fontSize: "0.85rem",
            }}
          >
            📷 Open Camera
          </button>
          <label style={{
            padding: "10px 20px", borderRadius: 8, border: "1px solid #d1d5db",
            cursor: "pointer", backgroundColor: "white", fontWeight: 700, fontSize: "0.85rem",
            color: "#374151", display: "inline-flex", alignItems: "center",
          }}>
            📁 Upload Photo
            <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: "none" }} />
          </label>
        </div>
      )}

      {status === "capturing" && (
        <div>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ width: "100%", maxWidth: 400, borderRadius: 12, marginBottom: 12 }}
          />
          <canvas ref={canvasRef} style={{ display: "none" }} />
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={captureAndVerify}
              style={{
                padding: "10px 24px", borderRadius: 8, border: "none", cursor: "pointer",
                backgroundColor: "#059669", color: "white", fontWeight: 700, fontSize: "0.9rem",
              }}
            >
              📸 Capture & Verify
            </button>
            <button
              onClick={stopCamera}
              style={{
                padding: "10px 20px", borderRadius: 8, border: "1px solid #d1d5db",
                cursor: "pointer", backgroundColor: "white", fontWeight: 600, fontSize: "0.85rem",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {status === "uploading" && (
        <div style={{ textAlign: "center", padding: 20 }}>
          <div style={{ fontSize: "2rem", marginBottom: 8 }}>⏳</div>
          <p style={{ color: "#6b7280", fontWeight: 600 }}>Verifying selfie liveness...</p>
        </div>
      )}

      {status === "failed" && (
        <div>
          <p style={{ color: "#dc2626", fontWeight: 600, marginBottom: 12 }}>{message}</p>
          <button
            onClick={() => { setStatus("idle"); setMessage(""); }}
            style={{
              padding: "8px 16px", borderRadius: 8, border: "1px solid #d1d5db",
              cursor: "pointer", backgroundColor: "white", fontWeight: 600, fontSize: "0.85rem",
            }}
          >
            🔄 Try Again
          </button>
        </div>
      )}

      {status === "verified" && message && (
        <p style={{ color: "#059669", fontWeight: 600, marginTop: 8 }}>{message}</p>
      )}
    </div>
  );
}
