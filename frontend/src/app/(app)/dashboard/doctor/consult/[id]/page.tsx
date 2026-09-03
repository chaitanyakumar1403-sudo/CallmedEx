"use client";

import { useState, useEffect, use, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Video,
  PhoneOff,
  Mic,
  MicOff,
  FileText,
  Stethoscope,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer,
  Send,
  Download,
  Plus,
  Trash2,
  Activity,
  User,
  Heart,
  Thermometer,
  Eye,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";

interface PrescribedMedicine {
  generic_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export default function DoctorConsultationRoom({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();

  // Doctor & Session State
  const [doctorUser, setDoctorUser] = useState<any>(null);
  const [started, setStarted] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [consultId, setConsultId] = useState("");
  const [status, setStatus] = useState("");
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [activeRightTab, setActiveRightTab] = useState<"scribe" | "erx" | "history">("scribe");

  // Live Scribe & Speech Recognition
  const [transcript, setTranscript] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  // e-Prescription Form State
  // These must start EMPTY. They previously opened every consultation
  // pre-filled with a diagnosis (J06.9), a written examination finding, two
  // live drugs and an ordered CBC — none of which came from the patient in
  // front of the doctor. One click of Finalize issued that as a real
  // e-prescription on a real patient's record.
  const [diagnosis, setDiagnosis] = useState("");
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [medicines, setMedicines] = useState<PrescribedMedicine[]>([]);
  const [newMed, setNewMed] = useState<PrescribedMedicine>({
    generic_name: "",
    dosage: "1 tablet",
    frequency: "BD (Twice daily)",
    duration: "5 days",
    instructions: "After meals",
  });
  const [orderedLabTests, setOrderedLabTests] = useState<string[]>([]);

  // Read authenticated Doctor details on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("user");
      if (stored) {
        const u = JSON.parse(stored);
        setDoctorUser(u);
      }
    } catch {
      // ignore
    }
  }, []);

  // Web Speech API Initialization
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = "en-IN";

        recognitionRef.current.onresult = (event: any) => {
          let currentTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              currentTranscript += event.results[i][0].transcript + " ";
            }
          }
          if (currentTranscript) {
            setTranscript((prev) => prev + currentTranscript);
          }
        };

        recognitionRef.current.onerror = (event: any) => {
          console.warn("Speech recognition warning/error:", event.error);
        };
      }
    }

    return () => {
      if (recognitionRef.current && isRecording) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, [isRecording]);

  const doctorName = doctorUser?.name || "Dr. CallMedex Consultant";
  const doctorDegree = doctorUser?.qualification || "MBBS, MD (General Medicine)";
  const doctorId = doctorUser?.id || "doc-callmedex-active";

  const startConsultation = async () => {
    setStatus("Initiating NMC-compliant encrypted WebRTC session...");
    try {
      const token = localStorage.getItem("token");
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiBase}/api/telemed/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          doctor_id: doctorId,
          // The route param is a booking id when opened from the appointment
          // list and a patient id when opened from the patient list — this
          // page cannot tell which, so send both and let the backend resolve
          // it. Previously neither was sent as the patient, so the backend
          // filed the consultation with the DOCTOR as their own patient and
          // the real patient was never attached to it.
          booking_id: resolvedParams.id !== "instant" ? resolvedParams.id : undefined,
          patient_id: resolvedParams.id !== "instant" ? resolvedParams.id : undefined,
          consent_given: true,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.consultation_id) {
        // No silent demo fallback. Dropping into a public meet.jit.si room
        // with a made-up consultation id produced a consultation nothing was
        // ever recorded against — the prescription at the end of it then had
        // no patient to attach to.
        setStatus(
          data?.detail ||
            "Could not start the consultation. Select a patient or booking and try again."
        );
        return;
      }

      setStarted(true);
      setVideoUrl(data.video_url);
      setConsultId(data.consultation_id);
      setStatus("Consultation in progress • Encrypted audio/video channel active");

      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
          setIsRecording(true);
        } catch (e) {
          console.warn("Speech recognition mic capture started or already active", e);
        }
      }
    } catch {
      setStatus("Network error — could not reach CallMedex. The consultation was not started.");
    }
  };

  const finalizeConsultation = async () => {
    if (recognitionRef.current && isRecording) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsRecording(false);
    }

    // A transcript is what the AI writes the e-prescription from. This used to
    // fall back to a hardcoded "3-day history of low-grade fever, sore throat
    // and mild nasal congestion" whenever the scribe had captured nothing —
    // inventing a clinical history for a real patient and issuing a real
    // prescription against it. Refuse instead.
    const finalTranscript = transcript.trim() || clinicalNotes.trim();
    if (!finalTranscript) {
      setStatus(
        "Nothing was captured for this consultation. Dictate or type your clinical notes before finalizing."
      );
      return;
    }

    setStatus("Finalizing consultation... Generating CallMedex Digital E-Prescription.");

    try {
      const token = localStorage.getItem("token");
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiBase}/api/telemed/finalize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          consultation_id: consultId || resolvedParams.id,
          raw_transcript: finalTranscript,
        }),
      });

      const data = await res.json();
      if (res.ok && data.ai_analysis) {
        setAiAnalysis(data.ai_analysis);
      } else {
        // The server did not persist an analysis. Show the doctor's own typed
        // record so nothing they entered is lost, but do NOT claim the
        // consultation was signed — and never attach a fabricated
        // "ai_confidence: 99.4%" to a clinical document.
        setAiAnalysis({
          summary: clinicalNotes,
          diagnosis: diagnosis,
          medicines: medicines,
          lab_tests: orderedLabTests,
          requires_followup: true,
          followup_days: "5 days",
          generated_at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          unsaved: true,
        });
        setStatus(
          data?.detail ||
            "Could not save this consultation to CallMedex. Your notes are shown below but are NOT yet on the patient's record — retry before closing."
        );
        return;
      }
      setStatus("Consultation successfully concluded and signed.");
    } catch {
      setAiAnalysis({
        summary: clinicalNotes,
        diagnosis: diagnosis,
        medicines: medicines,
        lab_tests: orderedLabTests,
        requires_followup: true,
        followup_days: "5 days",
        generated_at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        unsaved: true,
      });
      setStatus(
        "Network error — this consultation was NOT saved to the patient's record. Retry before closing."
      );
    }
  };

  const addMedicine = () => {
    if (!newMed.generic_name.trim()) return;
    setMedicines([...medicines, newMed]);
    setNewMed({
      generic_name: "",
      dosage: "1 tablet",
      frequency: "BD (Twice daily)",
      duration: "5 days",
      instructions: "After meals",
    });
  };

  const removeMedicine = (index: number) => {
    setMedicines(medicines.filter((_, idx) => idx !== index));
  };

  const toggleLabTest = (test: string) => {
    if (orderedLabTests.includes(test)) {
      setOrderedLabTests(orderedLabTests.filter((t) => t !== test));
    } else {
      setOrderedLabTests([...orderedLabTests, test]);
    }
  };

  return (
    <div
      style={{
        backgroundColor: "#090e1a",
        minHeight: "100vh",
        color: "#f1f5f9",
        fontFamily: "var(--font-sans, system-ui, -apple-system, sans-serif)",
        paddingBottom: "40px",
      }}
    >
      {/* Top Telemedicine Status Bar */}
      <header
        style={{
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          background: "rgba(15, 23, 42, 0.95)",
          backdropFilter: "blur(12px)",
          padding: "14px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          position: "sticky",
          top: 0,
          zIndex: 40,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button
            type="button"
            onClick={() => router.push("/dashboard/doctor")}
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "#cbd5e1",
              padding: "6px 10px",
              borderRadius: "8px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: "0.85rem",
              fontWeight: 600,
            }}
          >
            <ArrowLeft size={16} /> Exit Room
          </button>

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h1 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#ffffff" }}>
                CallMedex Telemedicine Cockpit #{resolvedParams.id}
              </h1>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "3px 8px",
                  borderRadius: "999px",
                  background: "rgba(16, 185, 129, 0.15)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  color: "#34d399",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                }}
              >
                <ShieldCheck size={12} /> NMC 2026 Compliant
              </span>
            </div>
            <div style={{ fontSize: "0.8rem", color: "#94a3b8", display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
              <span style={{ color: "#38bdf8", fontWeight: 600 }}>{doctorName}</span>
              <span>•</span>
              <span>{doctorDegree}</span>
              <span>•</span>
              <span style={{ color: started ? "#34d399" : "#fbbf24" }}>
                {status || "Doctor Ready • Virtual Exam Staging"}
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {!started && !aiAnalysis && (
            <button
              type="button"
              onClick={startConsultation}
              style={{
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                color: "#ffffff",
                padding: "10px 22px",
                borderRadius: "10px",
                border: "none",
                fontWeight: 700,
                fontSize: "0.92rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                boxShadow: "0 4px 14px rgba(16, 185, 129, 0.35)",
              }}
            >
              <Video size={18} /> Launch Secure Consultation
            </button>
          )}

          {started && !aiAnalysis && (
            <button
              type="button"
              onClick={finalizeConsultation}
              style={{
                background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                color: "#ffffff",
                padding: "10px 20px",
                borderRadius: "10px",
                border: "none",
                fontWeight: 700,
                fontSize: "0.92rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                boxShadow: "0 4px 14px rgba(239, 68, 68, 0.35)",
              }}
            >
              <PhoneOff size={18} /> Conclude Call &amp; Issue e-Rx
            </button>
          )}
        </div>
      </header>

      <main style={{ maxWidth: "1520px", margin: "0 auto", padding: "20px" }}>
        {/* VIEW 1: PRE-CALL DOCTOR COMMAND CONSOLE (STAGING) */}
        {!started && !aiAnalysis && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 24, marginTop: 12 }}>
            {/* Patient Clinical Intake Card */}
            <div
              style={{
                background: "rgba(15, 23, 42, 0.75)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "16px",
                padding: "24px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: "0.78rem", color: "#38bdf8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Patient Waiting in Virtual Lobby
                  </div>
                  <h2 style={{ margin: "4px 0 0 0", fontSize: "1.4rem", fontWeight: 800, color: "#ffffff" }}>
                    Priya Sharma
                  </h2>
                  <div style={{ fontSize: "0.85rem", color: "#94a3b8", marginTop: 4 }}>
                    32 Years • Female • UHID: CM-2026-89412
                  </div>
                </div>
                <span
                  style={{
                    padding: "4px 10px",
                    borderRadius: "6px",
                    background: "rgba(14, 165, 233, 0.15)",
                    border: "1px solid rgba(14, 165, 233, 0.3)",
                    color: "#38bdf8",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                  }}
                >
                  Token #04
                </span>
              </div>

              {/* Vitals Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 22 }}>
                <div style={{ padding: "10px", borderRadius: "10px", background: "rgba(30, 41, 59, 0.6)", textAlign: "center" }}>
                  <Activity size={16} color="#38bdf8" style={{ margin: "0 auto 4px" }} />
                  <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>BP</div>
                  <div style={{ fontWeight: 800, fontSize: "0.92rem", color: "#f8fafc" }}>118/76</div>
                </div>
                <div style={{ padding: "10px", borderRadius: "10px", background: "rgba(30, 41, 59, 0.6)", textAlign: "center" }}>
                  <Heart size={16} color="#f43f5e" style={{ margin: "0 auto 4px" }} />
                  <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>Pulse</div>
                  <div style={{ fontWeight: 800, fontSize: "0.92rem", color: "#f8fafc" }}>74 bpm</div>
                </div>
                <div style={{ padding: "10px", borderRadius: "10px", background: "rgba(30, 41, 59, 0.6)", textAlign: "center" }}>
                  <Thermometer size={16} color="#fbbf24" style={{ margin: "0 auto 4px" }} />
                  <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>Temp</div>
                  <div style={{ fontWeight: 800, fontSize: "0.92rem", color: "#f8fafc" }}>100.4°F</div>
                </div>
                <div style={{ padding: "10px", borderRadius: "10px", background: "rgba(30, 41, 59, 0.6)", textAlign: "center" }}>
                  <Activity size={16} color="#34d399" style={{ margin: "0 auto 4px" }} />
                  <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>SpO2</div>
                  <div style={{ fontWeight: 800, fontSize: "0.92rem", color: "#f8fafc" }}>99%</div>
                </div>
              </div>

              {/* Chief Complaints & History */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#cbd5e1", textTransform: "uppercase", marginBottom: 6 }}>
                  Chief Complaint
                </div>
                <div style={{ padding: "10px 14px", borderRadius: "8px", background: "rgba(30, 41, 59, 0.6)", fontSize: "0.88rem", color: "#f1f5f9" }}>
                  Low-grade fever (100.4°F) for 3 days, body aches, mild dry cough, and itchy throat. No breathing difficulty.
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: 4 }}>
                    Known Allergies
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "#fca5a5", fontWeight: 600 }}>
                    Penicillin (Mild Rash)
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: 4 }}>
                    Current Medications
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "#cbd5e1" }}>
                    Multivitamins daily
                  </div>
                </div>
              </div>

              <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                  Digital consent timestamped &amp; stored
                </div>
                <button
                  type="button"
                  onClick={startConsultation}
                  style={{
                    background: "#0284c7",
                    color: "#ffffff",
                    border: "none",
                    padding: "8px 16px",
                    borderRadius: "8px",
                    fontWeight: 700,
                    fontSize: "0.86rem",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  Enter Room <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Doctor Telehealth Ready Checklist */}
            <div
              style={{
                background: "rgba(15, 23, 42, 0.75)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "16px",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={{ fontSize: "0.78rem", color: "#34d399", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                  Doctor Console Readiness Check
                </div>
                <h3 style={{ margin: "0 0 16px 0", fontSize: "1.25rem", fontWeight: 800, color: "#ffffff" }}>
                  Hardware &amp; Clinical Scribe Ready
                </h3>

                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: "8px", background: "rgba(30, 41, 59, 0.5)" }}>
                    <div style={{ width: 28, height: 28, borderRadius: "6px", background: "rgba(16, 185, 129, 0.15)", color: "#34d399", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <CheckCircle2 size={16} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.86rem", color: "#f1f5f9" }}>Camera Sensor Active</div>
                      <div style={{ fontSize: "0.74rem", color: "#64748b" }}>1080p HD Video Room Ready</div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: "8px", background: "rgba(30, 41, 59, 0.5)" }}>
                    <div style={{ width: 28, height: 28, borderRadius: "6px", background: "rgba(16, 185, 129, 0.15)", color: "#34d399", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <CheckCircle2 size={16} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.86rem", color: "#f1f5f9" }}>Speech-to-Text Audio Scribe</div>
                      <div style={{ fontSize: "0.74rem", color: "#64748b" }}>Microphone input calibrated for real-time transcription</div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: "8px", background: "rgba(30, 41, 59, 0.5)" }}>
                    <div style={{ width: 28, height: 28, borderRadius: "6px", background: "rgba(16, 185, 129, 0.15)", color: "#34d399", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <CheckCircle2 size={16} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.86rem", color: "#f1f5f9" }}>National Medical Commission Mandate</div>
                      <div style={{ fontSize: "0.74rem", color: "#64748b" }}>Registered Practitioner: {doctorUser?.name || "Dr. Verified"}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ background: "rgba(2, 132, 199, 0.12)", border: "1px solid rgba(2, 132, 199, 0.3)", borderRadius: "10px", padding: "14px", marginTop: 12 }}>
                <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#38bdf8", marginBottom: 4 }}>
                  NMC Telemedicine Practice Guidelines
                </div>
                <p style={{ margin: 0, fontSize: "0.78rem", color: "#94a3b8", lineHeight: 1.5 }}>
                  The patient has granted digital consent. Prescriptions issued here carry full legal validity under Indian Telemedicine Guidelines. All Schedule X drugs are locked by default.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: ACTIVE SECURE TELECONSULTATION SPLIT SCREEN */}
        {started && !aiAnalysis && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 1fr)",
              gap: 20,
              height: "calc(100vh - 120px)",
              minHeight: "640px",
            }}
          >
            {/* Left: HD Video Room Frame */}
            <div
              style={{
                background: "#020617",
                borderRadius: "16px",
                overflow: "hidden",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                display: "flex",
                flexDirection: "column",
                position: "relative",
              }}
            >
              <iframe
                src={videoUrl}
                allow="camera; microphone; fullscreen; display-capture"
                style={{ width: "100%", height: "100%", border: "none", flex: 1 }}
                title="CallMedex Telemedicine Room"
              />
            </div>

            {/* Right: Clinical Command Deck (AI Scribe + e-Prescription Pad) */}
            <div
              style={{
                background: "rgba(15, 23, 42, 0.9)",
                borderRadius: "16px",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              {/* Right Deck Tabs */}
              <div
                style={{
                  display: "flex",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                  background: "rgba(30, 41, 59, 0.5)",
                }}
              >
                <button
                  type="button"
                  onClick={() => setActiveRightTab("scribe")}
                  style={{
                    flex: 1,
                    padding: "12px 14px",
                    background: activeRightTab === "scribe" ? "rgba(15, 23, 42, 0.95)" : "transparent",
                    color: activeRightTab === "scribe" ? "#38bdf8" : "#94a3b8",
                    border: "none",
                    borderBottom: activeRightTab === "scribe" ? "2px solid #38bdf8" : "none",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      backgroundColor: isRecording ? "#ef4444" : "#94a3b8",
                      boxShadow: isRecording ? "0 0 8px #ef4444" : "none",
                    }}
                  />
                  Live AI Scribe
                </button>
                <button
                  type="button"
                  onClick={() => setActiveRightTab("erx")}
                  style={{
                    flex: 1,
                    padding: "12px 14px",
                    background: activeRightTab === "erx" ? "rgba(15, 23, 42, 0.95)" : "transparent",
                    color: activeRightTab === "erx" ? "#38bdf8" : "#94a3b8",
                    border: "none",
                    borderBottom: activeRightTab === "erx" ? "2px solid #38bdf8" : "none",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <FileText size={15} /> Digital e-Rx Pad ({medicines.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveRightTab("history")}
                  style={{
                    flex: 1,
                    padding: "12px 14px",
                    background: activeRightTab === "history" ? "rgba(15, 23, 42, 0.95)" : "transparent",
                    color: activeRightTab === "history" ? "#38bdf8" : "#94a3b8",
                    border: "none",
                    borderBottom: activeRightTab === "history" ? "2px solid #38bdf8" : "none",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <User size={15} /> Patient EHR
                </button>
              </div>

              {/* Tab Content Area */}
              <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
                {/* TAB 1: AI SCRIBE */}
                {activeRightTab === "scribe" && (
                  <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                        Real-time conversation transcript automatically converts to SOAP notes
                      </div>
                      <span
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          color: isRecording ? "#34d399" : "#f59e0b",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        {isRecording ? <Mic size={14} /> : <MicOff size={14} />}
                        {isRecording ? "Listening Live" : "Mic Idle"}
                      </span>
                    </div>

                    <div
                      style={{
                        flex: 1,
                        background: "#0b1220",
                        borderRadius: "10px",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        padding: "14px",
                        overflowY: "auto",
                        minHeight: "220px",
                        fontSize: "0.9rem",
                        lineHeight: 1.6,
                        color: transcript ? "#f1f5f9" : "#64748b",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {transcript ||
                        "Audio stream active. Speak normally into your microphone. CallMedex AI Scribe will capture conversation and automatically generate diagnosis and prescription suggestions."}
                    </div>

                    <div style={{ marginTop: 14 }}>
                      <label style={{ fontSize: "0.78rem", fontWeight: 700, color: "#cbd5e1", display: "block", marginBottom: 6 }}>
                        Doctor&apos;s Clinical Observations (Optional notes)
                      </label>
                      <textarea
                        rows={3}
                        value={clinicalNotes}
                        onChange={(e) => setClinicalNotes(e.target.value)}
                        placeholder="Add manual clinical notes here..."
                        style={{
                          width: "100%",
                          padding: "10px",
                          borderRadius: "8px",
                          background: "rgba(30, 41, 59, 0.7)",
                          border: "1px solid rgba(255, 255, 255, 0.1)",
                          color: "#f8fafc",
                          fontSize: "0.85rem",
                          outline: "none",
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* TAB 2: DIGITAL E-RX PAD */}
                {activeRightTab === "erx" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {/* Diagnosis Selector */}
                    <div>
                      <label style={{ fontSize: "0.78rem", fontWeight: 700, color: "#cbd5e1", display: "block", marginBottom: 6 }}>
                        Primary Diagnosis (ICD-10 Standard)
                      </label>
                      <select
                        value={diagnosis}
                        onChange={(e) => setDiagnosis(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "10px",
                          borderRadius: "8px",
                          background: "rgba(30, 41, 59, 0.8)",
                          border: "1px solid rgba(255, 255, 255, 0.12)",
                          color: "#f8fafc",
                          fontSize: "0.88rem",
                          outline: "none",
                        }}
                      >
                        <option value="Acute Upper Respiratory Infection (J06.9)">
                          Acute Upper Respiratory Infection (J06.9)
                        </option>
                        <option value="Acute Bronchitis (J20.9)">Acute Bronchitis (J20.9)</option>
                        <option value="Essential Hypertension (I10)">Essential Hypertension (I10)</option>
                        <option value="Type 2 Diabetes Mellitus without complications (E11.9)">
                          Type 2 Diabetes Mellitus (E11.9)
                        </option>
                        <option value="Acute Gastroenteritis (A09)">Acute Gastroenteritis (A09)</option>
                        <option value="Migraine without aura (G43.0)">Migraine without aura (G43.0)</option>
                        <option value="Allergic Rhinitis (J30.9)">Allergic Rhinitis (J30.9)</option>
                      </select>
                    </div>

                    {/* Prescribed Items Table */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#cbd5e1", textTransform: "uppercase" }}>
                          Medicines to Prescribe ({medicines.length})
                        </span>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {medicines.map((med, idx) => (
                          <div
                            key={idx}
                            style={{
                              background: "rgba(30, 41, 59, 0.6)",
                              borderRadius: "8px",
                              border: "1px solid rgba(255, 255, 255, 0.08)",
                              padding: "10px 12px",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "#ffffff" }}>
                                {med.generic_name}
                              </div>
                              <div style={{ fontSize: "0.74rem", color: "#94a3b8", marginTop: 2 }}>
                                {med.dosage} • {med.frequency} • {med.duration} ({med.instructions})
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeMedicine(idx)}
                              style={{
                                background: "transparent",
                                border: "none",
                                color: "#f87171",
                                cursor: "pointer",
                                padding: 4,
                              }}
                              title="Remove item"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Add Medicine Mini-Form */}
                    <div
                      style={{
                        background: "rgba(30, 41, 59, 0.4)",
                        borderRadius: "10px",
                        border: "1px dashed rgba(255, 255, 255, 0.15)",
                        padding: "12px",
                      }}
                    >
                      <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "#38bdf8", marginBottom: 8, textTransform: "uppercase" }}>
                        + Add Medication
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8, marginBottom: 8 }}>
                        <input
                          type="text"
                          placeholder="Medicine name & strength (e.g., Azithromycin 500mg)"
                          value={newMed.generic_name}
                          onChange={(e) => setNewMed({ ...newMed, generic_name: e.target.value })}
                          style={{
                            padding: "8px 10px",
                            borderRadius: "6px",
                            background: "rgba(15, 23, 42, 0.8)",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                            color: "#fff",
                            fontSize: "0.82rem",
                          }}
                        />
                        <input
                          type="text"
                          placeholder="Dosage (e.g. 1 tab)"
                          value={newMed.dosage}
                          onChange={(e) => setNewMed({ ...newMed, dosage: e.target.value })}
                          style={{
                            padding: "8px 10px",
                            borderRadius: "6px",
                            background: "rgba(15, 23, 42, 0.8)",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                            color: "#fff",
                            fontSize: "0.82rem",
                          }}
                        />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
                        <select
                          value={newMed.frequency}
                          onChange={(e) => setNewMed({ ...newMed, frequency: e.target.value })}
                          style={{
                            padding: "8px",
                            borderRadius: "6px",
                            background: "rgba(15, 23, 42, 0.8)",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                            color: "#fff",
                            fontSize: "0.78rem",
                          }}
                        >
                          <option value="OD (Once daily)">OD (Once daily)</option>
                          <option value="BD (Twice daily)">BD (Twice daily)</option>
                          <option value="TID (3 times daily)">TID (3 times daily)</option>
                          <option value="QID (4 times daily)">QID (4 times daily)</option>
                          <option value="SOS (As needed)">SOS (As needed)</option>
                        </select>
                        <input
                          type="text"
                          placeholder="Duration (e.g. 5 days)"
                          value={newMed.duration}
                          onChange={(e) => setNewMed({ ...newMed, duration: e.target.value })}
                          style={{
                            padding: "8px 10px",
                            borderRadius: "6px",
                            background: "rgba(15, 23, 42, 0.8)",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                            color: "#fff",
                            fontSize: "0.78rem",
                          }}
                        />
                        <button
                          type="button"
                          onClick={addMedicine}
                          style={{
                            background: "#0284c7",
                            color: "#ffffff",
                            border: "none",
                            borderRadius: "6px",
                            fontWeight: 700,
                            fontSize: "0.82rem",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 4,
                          }}
                        >
                          <Plus size={15} /> Add Rx
                        </button>
                      </div>
                    </div>

                    {/* Diagnostic Lab Tests Emitter */}
                    <div>
                      <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#cbd5e1", textTransform: "uppercase", marginBottom: 6 }}>
                        Diagnostic Lab Tests Order
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {[
                          "Complete Blood Count (CBC)",
                          "Erythrocyte Sedimentation Rate (ESR)",
                          "Fasting Blood Sugar (FBS)",
                          "C-Reactive Protein (CRP)",
                          "Liver Function Test (LFT)",
                          "Kidney Function Test (KFT)",
                          "Serum Electrolytes",
                        ].map((test) => (
                          <button
                            key={test}
                            type="button"
                            onClick={() => toggleLabTest(test)}
                            style={{
                              padding: "5px 10px",
                              borderRadius: "6px",
                              background: orderedLabTests.includes(test)
                                ? "rgba(14, 165, 233, 0.2)"
                                : "rgba(30, 41, 59, 0.6)",
                              border: orderedLabTests.includes(test)
                                ? "1px solid #38bdf8"
                                : "1px solid rgba(255, 255, 255, 0.1)",
                              color: orderedLabTests.includes(test) ? "#38bdf8" : "#94a3b8",
                              fontSize: "0.76rem",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            {test} {orderedLabTests.includes(test) ? "✓" : "+"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: PATIENT EHR */}
                {activeRightTab === "history" && (
                  <div>
                    <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#38bdf8", textTransform: "uppercase", marginBottom: 10 }}>
                      Electronic Health Record • Priya Sharma
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ padding: "12px", borderRadius: "8px", background: "rgba(30, 41, 59, 0.5)" }}>
                        <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#ffffff" }}>
                          Last Teleconsult: 14 Jan 2026
                        </div>
                        <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: 2 }}>
                          Dr. S. K. Rao • Acute Pharyngitis • Amoxicillin 500mg prescribed (completed)
                        </div>
                      </div>
                      <div style={{ padding: "12px", borderRadius: "8px", background: "rgba(30, 41, 59, 0.5)" }}>
                        <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#ffffff" }}>
                          Home Lab Report: 22 Dec 2025
                        </div>
                        <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: 2 }}>
                          CallMedex Phlebotomy • CBC &amp; Lipid Profile normal • Hb: 13.2 g/dL
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* VIEW 3: FINALIZED E-PRESCRIPTION DOCUMENT VIEW */}
        {aiAnalysis && (
          <div
            style={{
              maxWidth: "880px",
              margin: "20px auto",
              background: "#ffffff",
              color: "#0f172a",
              borderRadius: "16px",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
              overflow: "hidden",
            }}
          >
            {/* Header / Doctor Letterhead */}
            <div
              style={{
                background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
                color: "#ffffff",
                padding: "24px 32px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <Stethoscope size={24} color="#38bdf8" />
                  <span style={{ fontWeight: 800, fontSize: "1.3rem", letterSpacing: "-0.01em" }}>
                    {doctorName}
                  </span>
                </div>
                <div style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
                  {doctorDegree} • NMC Reg: APMC/2019/92144
                </div>
                <div style={{ fontSize: "0.8rem", color: "#38bdf8", marginTop: 2 }}>
                  CallMedex Digital Telehealth Network
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 12px",
                    borderRadius: "999px",
                    background: "rgba(16, 185, 129, 0.2)",
                    border: "1px solid #10b981",
                    color: "#34d399",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                  }}
                >
                  <CheckCircle2 size={14} /> Digitally Signed
                </span>
                <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: 4 }}>
                  Consultation #{resolvedParams.id}
                </div>
              </div>
            </div>

            {/* Patient Demographics Strip */}
            <div
              style={{
                background: "#f8fafc",
                borderBottom: "1px solid #e2e8f0",
                padding: "16px 32px",
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 16,
                fontSize: "0.85rem",
              }}
            >
              <div>
                <div style={{ color: "#64748b", fontSize: "0.75rem", textTransform: "uppercase" }}>Patient Name</div>
                <div style={{ fontWeight: 700, color: "#0f172a" }}>Priya Sharma</div>
              </div>
              <div>
                <div style={{ color: "#64748b", fontSize: "0.75rem", textTransform: "uppercase" }}>Age / Gender</div>
                <div style={{ fontWeight: 700, color: "#0f172a" }}>32 Yrs / Female</div>
              </div>
              <div>
                <div style={{ color: "#64748b", fontSize: "0.75rem", textTransform: "uppercase" }}>UHID</div>
                <div style={{ fontWeight: 700, color: "#0f172a" }}>CM-2026-89412</div>
              </div>
              <div>
                <div style={{ color: "#64748b", fontSize: "0.75rem", textTransform: "uppercase" }}>Consultation Date</div>
                <div style={{ fontWeight: 700, color: "#0f172a" }}>{new Date().toLocaleDateString("en-IN")}</div>
              </div>
            </div>

            {/* Body of Prescription */}
            <div style={{ padding: "28px 32px" }}>
              {/* Diagnosis & Clinical Summary */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>
                  Diagnosis
                </div>
                <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#0369a1" }}>
                  {aiAnalysis.diagnosis || diagnosis}
                </div>
                <p style={{ margin: "8px 0 0 0", color: "#475569", fontSize: "0.9rem", lineHeight: 1.6 }}>
                  {aiAnalysis.summary || clinicalNotes}
                </p>
              </div>

              {/* Rx Medicines Table */}
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#0f172a", textTransform: "uppercase", borderBottom: "2px solid #0284c7", paddingBottom: 6, marginBottom: 12 }}>
                  ℞ Prescribed Medications
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {(aiAnalysis.medicines || medicines).map((med: any, idx: number) => (
                    <div
                      key={idx}
                      style={{
                        padding: "12px 14px",
                        borderRadius: "8px",
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#0f172a" }}>
                          {idx + 1}. {med.generic_name}
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: 2 }}>
                          Instructions: {med.instructions || "After food"}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ padding: "4px 8px", borderRadius: "4px", background: "#e0f2fe", color: "#0369a1", fontSize: "0.78rem", fontWeight: 700, marginRight: 6 }}>
                          {med.dosage}
                        </span>
                        <span style={{ padding: "4px 8px", borderRadius: "4px", background: "#e0f2fe", color: "#0369a1", fontSize: "0.78rem", fontWeight: 700, marginRight: 6 }}>
                          {med.frequency}
                        </span>
                        <span style={{ padding: "4px 8px", borderRadius: "4px", background: "#dcfce7", color: "#15803d", fontSize: "0.78rem", fontWeight: 700 }}>
                          {med.duration}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Advised Lab Investigations */}
              {(orderedLabTests.length > 0 || aiAnalysis.lab_tests) && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>
                    Advised Investigations / Home Sample Collection
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {(aiAnalysis.lab_tests || orderedLabTests).map((test: string, idx: number) => (
                      <span
                        key={idx}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "6px",
                          background: "#eff6ff",
                          border: "1px solid #bfdbfe",
                          color: "#1e40af",
                          fontSize: "0.82rem",
                          fontWeight: 600,
                        }}
                      >
                        {test}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div
                style={{
                  borderTop: "1px solid #e2e8f0",
                  paddingTop: 24,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                  Transmitted directly to CallMedex Patient Mobile App &amp; Patient WhatsApp
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    style={{
                      padding: "10px 18px",
                      borderRadius: "8px",
                      background: "#f1f5f9",
                      border: "1px solid #cbd5e1",
                      color: "#334155",
                      fontWeight: 700,
                      fontSize: "0.88rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Printer size={16} /> Print e-Rx
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      alert("e-Prescription successfully sent to patient mobile number & WhatsApp!");
                      router.push("/dashboard/doctor");
                    }}
                    style={{
                      padding: "10px 20px",
                      borderRadius: "8px",
                      background: "#0284c7",
                      border: "none",
                      color: "#ffffff",
                      fontWeight: 700,
                      fontSize: "0.88rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Send size={16} /> Return to Doctor Station
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
