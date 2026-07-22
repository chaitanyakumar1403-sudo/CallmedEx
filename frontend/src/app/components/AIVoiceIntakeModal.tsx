"use client";

import { useState } from "react";

interface AIVoiceIntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProvider: (providerType: string, summary: string) => void;
}

export default function AIVoiceIntakeModal({ isOpen, onClose, onSelectProvider }: AIVoiceIntakeModalProps) {
  const [lang, setLang] = useState<"en" | "te" | "hi">("en");
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [loading, setLoading] = useState(false);
  const [triageResult, setTriageResult] = useState<any>(null);

  if (!isOpen) return null;

  const handleStartRecording = () => {
    setIsRecording(true);
    setTriageResult(null);
    // Simulate web speech recording
    setTimeout(() => {
      setIsRecording(false);
      const sampleTranscripts = {
        en: "I have high fever 102F and a severe cough since 2 days.",
        te: "నాకు రెండు రోజుల నుండి తీవ్రమైన జ్వరం మరియు దగ్గు ఉంది.",
        hi: "मुझे दो दिनों से तेज़ बुखार और खांसी है।"
      };
      setTranscript(sampleTranscripts[lang]);
    }, 3000);
  };

  const handleAnalyzeTriage = async () => {
    if (!transcript) return;
    setLoading(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/ai/voice-triage`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ transcript, language: lang })
      });
      const data = await res.json();
      if (data.success) {
        setTriageResult(data);
      }
    } catch (e) {
      alert("Failed to analyze voice triage. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(15, 23, 42, 0.75)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div className="glass-card" style={{ maxWidth: 500, width: "100%", padding: 28, background: "white", borderRadius: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: "1.2rem", color: "#0f172a" }}>
            🎙️ AI Voice Triage & Scribe <span className="badge-ai">Multilingual AI</span>
          </h3>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button>
        </div>

        <p style={{ fontSize: "0.85rem", color: "#64748b", margin: "0 0 16px 0" }}>
          Speak your symptoms in Telugu, Hindi, or English. AI will predict clinical urgency and match you with the right healthcare provider instantly.
        </p>

        {/* Language Selector */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, justifyContent: "center" }}>
          {[
            { id: "en", label: "English 🇬🇧" },
            { id: "te", label: "తెలుగు (Telugu) 🇮🇳" },
            { id: "hi", label: "हिंदी (Hindi) 🇮🇳" }
          ].map(l => (
            <button
              key={l.id}
              onClick={() => setLang(l.id as any)}
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                border: lang === l.id ? "2px solid #0d9488" : "1px solid #cbd5e1",
                background: lang === l.id ? "#ccfbf1" : "#f8fafc",
                color: lang === l.id ? "#0f766e" : "#475569",
                fontWeight: 600,
                fontSize: "0.8rem",
                cursor: "pointer"
              }}
            >
              {l.label}
            </button>
          ))}
        </div>

        {/* Mic Recording Area */}
        <div style={{ textAlign: "center", padding: "20px 0", background: "#f8fafc", borderRadius: 16, border: "1px dashed #cbd5e1", marginBottom: 20 }}>
          {isRecording ? (
            <div>
              <div className="voice-wave" style={{ marginBottom: 12 }}>
                <span /><span /><span /><span /><span />
              </div>
              <p style={{ color: "#ef4444", fontWeight: 700, margin: 0 }}>🔴 Listening... Speak clearly now</p>
            </div>
          ) : (
            <button
              onClick={handleStartRecording}
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #0d9488 0%, #06b6d4 100%)",
                color: "white",
                border: "none",
                fontSize: "2rem",
                cursor: "pointer",
                boxShadow: "0 8px 20px rgba(13, 148, 136, 0.4)",
                margin: "0 auto 10px auto",
                display: "block"
              }}
            >
              🎙️
            </button>
          )}
          {!isRecording && <span style={{ fontSize: "0.8rem", color: "#64748b" }}>Tap mic to speak symptoms</span>}
        </div>

        {/* Transcript Input */}
        {transcript && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#334155" }}>Recorded Speech Transcript:</label>
            <textarea
              className="form-input"
              rows={3}
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
              style={{ width: "100%", marginTop: 6, fontSize: "0.9rem" }}
            />
            <button
              className="btn btn-teal"
              style={{ width: "100%", marginTop: 10, fontWeight: 700 }}
              onClick={handleAnalyzeTriage}
              disabled={loading}
            >
              {loading ? "Analyzing Clinical Triage..." : "⚡ Run AI Clinical Triage"}
            </button>
          </div>
        )}

        {/* Triage Output Card */}
        {triageResult && (
          <div style={{ background: triageResult.urgency === "emergency" ? "#fef2f2" : "#f0fdf4", border: `2px solid ${triageResult.urgency === "emergency" ? "#ef4444" : "#22c55e"}`, padding: 16, borderRadius: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <strong style={{ color: triageResult.urgency === "emergency" ? "#dc2626" : "#166534" }}>
                {triageResult.urgency === "emergency" ? "🚨 EMERGENCY TRIAGE" : "✅ ROUTINE TRIAGE"}
              </strong>
              <span className="badge badge-info">Score: {triageResult.confidence_score * 100}%</span>
            </div>
            <p style={{ fontSize: "0.85rem", color: "#334155", margin: "0 0 12px 0" }}>{triageResult.clinical_summary}</p>

            <button
              className={`btn ${triageResult.urgency === "emergency" ? "btn-emergency" : "btn-teal"}`}
              style={{ width: "100%", fontWeight: 700 }}
              onClick={() => {
                onSelectProvider(triageResult.recommended_provider, triageResult.clinical_summary);
                onClose();
              }}
            >
              ⚡ Proceed with {triageResult.recommended_provider.toUpperCase()} Booking
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
