"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Web Speech API is vendor-prefixed in Chromium and absent in some browsers.
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
};

function getRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  return Ctor ? (new Ctor() as SpeechRecognitionLike) : null;
}

// Indian locales: generic "hi"/"te" often fall back to a poorer acoustic model.
const SPEECH_LOCALE: Record<string, string> = {
  en: "en-IN",
  te: "te-IN",
  hi: "hi-IN",
};

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
  const [error, setError] = useState("");
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // Use a ref for accumulating final text to avoid closure stacking issues
  const finalTextRef = useRef("");

  useEffect(() => {
    setSupported(getRecognition() !== null);
  }, []);

  // Stop the microphone if the modal closes mid-recording, otherwise the browser
  // keeps the mic indicator on after the dialog has gone.
  useEffect(() => {
    if (!isOpen && recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* already stopped */ }
      recognitionRef.current = null;
      setIsRecording(false);
    }
  }, [isOpen]);

  const stopRecording = useCallback(() => {
    try { recognitionRef.current?.stop(); } catch { /* already stopped */ }
    recognitionRef.current = null;
    setIsRecording(false);
  }, []);

  const handleStartRecording = useCallback(() => {
    setError("");
    setTriageResult(null);

    const recognition = getRecognition();
    if (!recognition) {
      // Firefox and some mobile browsers have no Web Speech API. Typing is a
      // real fallback, not a dead end — the triage runs on the text either way.
      setSupported(false);
      setError("Speech input isn't available in this browser. Please type your symptoms below.");
      setTranscript((t) => t || " ");
      return;
    }

    recognition.lang = SPEECH_LOCALE[lang] || "en-IN";
    // Use non-continuous mode to avoid duplicate final results. Each utterance
    // fires one final result, then we restart if the user is still recording.
    recognition.continuous = false;
    recognition.interimResults = true;

    // Reset the accumulated final text for a fresh recording session
    finalTextRef.current = transcript.trim() === "" ? "" : transcript.trim() + " ";

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const chunk = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          // Deduplicate: only add if the chunk isn't already at the end of finalText
          const trimmedChunk = chunk.trim();
          if (trimmedChunk && !finalTextRef.current.trimEnd().endsWith(trimmedChunk)) {
            finalTextRef.current += trimmedChunk + " ";
          }
        } else {
          interim = chunk;
        }
      }
      setTranscript((finalTextRef.current + interim).trim());
    };

    recognition.onerror = (event: any) => {
      const kind = event?.error;
      // "no-speech" is normal in non-continuous mode, just restart silently
      if (kind === "no-speech") {
        // Restart recognition if still in recording mode
        if (recognitionRef.current) {
          try { recognitionRef.current.start(); } catch { /* ignore */ }
        }
        return;
      }
      setError(
        kind === "not-allowed" || kind === "service-not-allowed"
          ? "Microphone permission was denied. Allow it in your browser, or type your symptoms below."
          : "Speech recognition failed. Please type your symptoms below."
      );
      stopRecording();
    };

    // In non-continuous mode, recognition ends after each utterance.
    // Auto-restart to keep listening until user clicks stop.
    recognition.onend = () => {
      if (recognitionRef.current) {
        // Still in recording mode — restart to keep listening
        try {
          recognitionRef.current.start();
        } catch {
          // If restart fails, stop recording
          setIsRecording(false);
          recognitionRef.current = null;
        }
      } else {
        setIsRecording(false);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsRecording(true);
    } catch {
      setError("Could not start the microphone. Please type your symptoms below.");
      setIsRecording(false);
    }
  }, [lang, stopRecording, transcript]);

  if (!isOpen) return null;

  const handleAnalyzeTriage = async () => {
    if (!transcript.trim()) return;
    setLoading(true);
    setError("");
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

      // Use guest endpoint if no token to avoid 401 errors
      const endpoint = token ? "/api/ai/voice-triage" : "/api/ai/voice-triage-guest";
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(`${apiBase}${endpoint}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ transcript: transcript.trim(), language: lang })
      });

      // If auth endpoint returns 401, retry with guest endpoint
      if (res.status === 401 && token) {
        const guestRes = await fetch(`${apiBase}/api/ai/voice-triage-guest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: transcript.trim(), language: lang })
        });
        const data = await guestRes.json();
        if (guestRes.ok && data.success) {
          setTriageResult(data);
        } else {
          setError(data.detail || "Could not analyse that. Try rephrasing your symptoms.");
        }
        return;
      }

      const data = await res.json();
      if (res.ok && data.success) {
        setTriageResult(data);
      } else {
        // Provide a friendlier message for auth errors
        if (res.status === 401) {
          setError("Session expired. The triage still works — please try again.");
        } else {
          setError(data.detail || "Could not analyse that. Try rephrasing your symptoms.");
        }
      }
    } catch {
      setError("Network error contacting the triage service. Please try again.");
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
              <p style={{ color: "#ef4444", fontWeight: 700, margin: "0 0 12px 0" }}>🔴 Listening… speak clearly</p>
              <button
                onClick={stopRecording}
                style={{
                  padding: "8px 22px", borderRadius: 20, border: "none",
                  background: "#ef4444", color: "white", fontWeight: 700,
                  cursor: "pointer", fontSize: "0.85rem",
                }}
              >
                ⏹ Stop &amp; use this
              </button>
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
          {!isRecording && (
            <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
              {supported ? "Tap the mic and describe your symptoms" : "Type your symptoms below"}
            </span>
          )}
        </div>

        {error && (
          <div style={{
            padding: "10px 14px", borderRadius: 10, marginBottom: 16,
            background: "#fef2f2", border: "1px solid #fca5a5",
            color: "#991b1b", fontSize: "0.83rem",
          }}>
            {error}
          </div>
        )}

        {!transcript && !isRecording && (
          <button
            onClick={() => setTranscript(" ")}
            style={{
              background: "none", border: "none", color: "#0d9488",
              cursor: "pointer", fontWeight: 600, fontSize: "0.82rem",
              display: "block", margin: "0 auto 16px auto",
            }}
          >
            ⌨️ Prefer to type instead?
          </button>
        )}

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
              <span className="badge badge-info">Score: {Math.round((triageResult.confidence_score || 0) * 100)}%</span>
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
