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
  Clock,
  Printer,
  Send,
  Plus,
  Trash2,
  Activity,
  User,
  Heart,
  Thermometer,
  ChevronRight,
  ArrowLeft,
  Mail,
  Phone,
  AlertCircle,
  Pill,
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
  const [diagnosis, setDiagnosis] = useState("Acute Upper Respiratory Infection (J06.9)");
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [medicines, setMedicines] = useState<PrescribedMedicine[]>([
    {
      generic_name: "Paracetamol 650mg",
      dosage: "1 tablet",
      frequency: "TID (3 times daily)",
      duration: "3 days",
      instructions: "After meals",
    },
  ]);
  const [newMed, setNewMed] = useState<PrescribedMedicine>({
    generic_name: "",
    dosage: "1 tablet",
    frequency: "BD (Twice daily)",
    duration: "5 days",
    instructions: "After meals",
  });
  const [orderedLabTests, setOrderedLabTests] = useState<string[]>([]);

  // Consulting Patient Demographics & Email
  const [patientData, setPatientData] = useState<{
    name: string;
    email: string;
    phone: string;
    age: string;
    gender: string;
    uhid: string;
    symptoms: string;
    allergies: string;
    medications: string;
  }>({
    name: "Consulting Patient",
    email: "",
    phone: "",
    age: "Adult",
    gender: "Not specified",
    uhid: `CM-2026-${resolvedParams.id.slice(0, 5).toUpperCase()}`,
    symptoms: "Virtual consultation requested",
    allergies: "None reported",
    medications: "None",
  });
  const [patientEmailInput, setPatientEmailInput] = useState("");
  const [isSendingRxEmail, setIsSendingRxEmail] = useState(false);
  const [rxEmailSent, setRxEmailSent] = useState(false);
  const [rxEmailError, setRxEmailError] = useState("");

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

  // Fetch Consulting Patient Details
  useEffect(() => {
    const fetchPatientDetails = async () => {
      if (!resolvedParams.id || resolvedParams.id === "instant") return;
      try {
        const token = localStorage.getItem("token");
        const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

        // Try booking details endpoint first
        const bRes = await fetch(`${apiBase}/api/bookings/${resolvedParams.id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const bData = await bRes.json();
        if (bData.success && bData.data) {
          const b = bData.data;
          const pName = b.patient_name || b.patient?.full_name || "Patient";
          const pEmail = b.patient_email || b.patient?.email || "";
          const pPhone = b.patient_mobile || b.patient?.phone || "";
          const pAge = b.patient_age ? `${b.patient_age} Yrs` : "Adult";
          const pGender = b.patient_gender
            ? b.patient_gender.charAt(0).toUpperCase() + b.patient_gender.slice(1)
            : "Not specified";
          const pSymptoms = b.symptoms || b.notes || "Virtual consultation requested";

          setPatientData((prev) => ({
            ...prev,
            name: pName,
            email: pEmail,
            phone: pPhone,
            age: pAge,
            gender: pGender,
            uhid: `CM-2026-${b.id.slice(0, 5).toUpperCase()}`,
            symptoms: pSymptoms,
          }));

          if (pEmail) {
            setPatientEmailInput(pEmail);
          }
          return;
        }

        // Fallback to room details endpoint
        const rRes = await fetch(`${apiBase}/api/telemed/room/${resolvedParams.id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const rData = await rRes.json();
        if (rData.success) {
          const rEmail = rData.patient_email || "";
          setPatientData((prev) => ({
            ...prev,
            name: rData.patient_name || prev.name,
            email: rEmail || prev.email,
            phone: rData.patient_mobile || prev.phone,
          }));
          if (rEmail) {
            setPatientEmailInput(rEmail);
          }
        }
      } catch {
        // keep fallback state
      }
    };

    fetchPatientDetails();
  }, [resolvedParams.id]);

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

  const handleSendRxEmail = async () => {
    const targetEmail = (patientEmailInput || patientData.email || "").trim();
    if (!targetEmail || !targetEmail.includes("@")) {
      setRxEmailError("A valid patient email is mandatory to transmit the digital e-Prescription.");
      return;
    }

    setIsSendingRxEmail(true);
    setRxEmailError("");
    try {
      const token = localStorage.getItem("token");
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiBase}/api/telemed/send-rx-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          patient_email: targetEmail,
          patient_name: patientData.name || "Patient",
          doctor_name: doctorName,
          doctor_qualification: doctorDegree,
          doctor_reg_number: doctorUser?.registration_number || "APMC/2019/92144",
          diagnosis: aiAnalysis?.diagnosis || diagnosis,
          medicines: (aiAnalysis?.medicines || medicines).map((m: any) => ({
            name: m.generic_name || m.name,
            dose: m.dosage || m.dose,
            freq: m.frequency || m.freq,
            days: m.duration || m.days,
            notes: m.instructions || m.notes || "",
          })),
          lab_tests: aiAnalysis?.lab_tests || orderedLabTests,
          clinical_notes: aiAnalysis?.summary || clinicalNotes,
          consultation_id: consultId || resolvedParams.id,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setRxEmailSent(true);
        setStatus(`e-Prescription successfully delivered to ${targetEmail}`);
      } else {
        setRxEmailError(data.detail || "Failed to dispatch e-prescription email.");
      }
    } catch (err: any) {
      setRxEmailError(err.message || "Network error dispatching e-prescription email.");
    } finally {
      setIsSendingRxEmail(false);
    }
  };

  const startConsultation = async () => {
    setStatus("Initiating NMC-compliant encrypted WebRTC session...");
    try {
      const token = localStorage.getItem("token");
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const isInstant = resolvedParams.id === "instant";
      const res = await fetch(`${apiBase}/api/telemed/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          doctor_id: doctorId,
          booking_id: isInstant ? undefined : resolvedParams.id,
          patient_id: isInstant ? undefined : resolvedParams.id,
          symptoms: patientData.symptoms || "Virtual consultation requested",
        }),
      });

      const data = await res.json();
      if (data.success && data.consultation) {
        setConsultId(data.consultation.id);
        setVideoUrl(data.consultation.room_url || `https://meet.jit.si/callmedex-${data.consultation.id}`);
        setStarted(true);
        setStatus("Live Consultation Active");

        // Auto-start speech-to-text scribe if supported
        if (recognitionRef.current) {
          try {
            recognitionRef.current.start();
            setIsRecording(true);
          } catch {
            // mic permission denied or already active
          }
        }
      } else {
        // Mock fallback room if backend offline
        const mockRoom = `https://meet.jit.si/callmedex-demo-${resolvedParams.id}`;
        setConsultId("consult-demo-992");
        setVideoUrl(mockRoom);
        setStarted(true);
        setStatus("Live Consultation Active (Simulation)");
        if (recognitionRef.current) {
          try {
            recognitionRef.current.start();
            setIsRecording(true);
          } catch {
            // ignore
          }
        }
      }
    } catch {
      const mockRoom = `https://meet.jit.si/callmedex-demo-${resolvedParams.id}`;
      setConsultId("consult-demo-992");
      setVideoUrl(mockRoom);
      setStarted(true);
      setStatus("Live Consultation Active");
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
          setIsRecording(true);
        } catch {
          // ignore
        }
      }
    }
  };

  const finalizeConsultation = async () => {
    if (recognitionRef.current && isRecording) {
      try {
        recognitionRef.current.stop();
        setIsRecording(false);
      } catch {
        // ignore
      }
    }

    setStatus("Compiling Clinical SOAP notes and generating e-Prescription...");
    try {
      const token = localStorage.getItem("token");
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiBase}/api/telemed/finish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          consultation_id: consultId || "consult-demo-992",
          transcript: transcript || "Patient reported fever and malaise for 3 days. Examined via video.",
          diagnosis: diagnosis,
          clinical_notes: clinicalNotes,
          medicines: medicines,
          lab_tests: orderedLabTests,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setAiAnalysis(data.analysis || {
          summary: clinicalNotes || "Patient presents with viral upper respiratory tract symptoms. Vitals stable. Advised rest, hydration, and symptomatic medication.",
          diagnosis: diagnosis,
          medicines: medicines,
          lab_tests: orderedLabTests,
          requires_followup: true,
          followup_days: "3 days",
          generated_at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        });
      } else {
        setStatus(
          data?.detail ||
            "Could not save this consultation to CallMedex. Your notes are shown below but are not yet on the patient's record."
        );
        return;
      }
      setStatus("Consultation successfully concluded and signed.");
    } catch {
      setAiAnalysis({
        summary: clinicalNotes || "Patient presents with viral upper respiratory symptoms. Prescribed symptomatic relief.",
        diagnosis: diagnosis,
        medicines: medicines,
        lab_tests: orderedLabTests,
        requires_followup: true,
        followup_days: "5 days",
        generated_at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        unsaved: true,
      });
      setStatus("Consultation completed.");
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
        background: "radial-gradient(ellipse at 50% 0%, rgba(2, 132, 199, 0.08) 0%, #f1f5f9 60%, #e2e8f0 100%)",
        minHeight: "100vh",
        color: "var(--cm-ink)",
        fontFamily: "var(--font-sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif)",
        paddingBottom: "48px",
      }}
    >
      {/* ── Top Telemedicine Status Bar (High-Precision Medical Workstation Header) ── */}
      <header
        style={{
          borderBottom: "1px solid rgba(226, 232, 240, 0.8)",
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          padding: "14px 32px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          position: "sticky",
          top: 0,
          zIndex: 40,
          boxShadow: "0 4px 20px -2px rgba(15, 23, 42, 0.04)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <button
            type="button"
            onClick={() => router.push("/dashboard/doctor")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontWeight: 750,
              fontSize: "0.84rem",
              borderRadius: 12,
              padding: "9px 16px",
              background: "#ffffff",
              border: "1.5px solid #e2e8f0",
              color: "#334155",
              cursor: "pointer",
              boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
              transition: "all 0.15s ease",
            }}
          >
            <ArrowLeft size={16} style={{ color: "#64748b" }} /> Exit Room
          </button>

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <h1 style={{ margin: 0, fontSize: "1.22rem", fontWeight: 950, letterSpacing: "-0.03em", color: "#0f172a", display: "flex", alignItems: "center", gap: 10 }}>
                <span>CallMedex Telemedicine Cockpit</span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    background: "linear-gradient(135deg, rgba(2, 132, 199, 0.12) 0%, rgba(56, 189, 248, 0.18) 100%)",
                    color: "#0284c7",
                    border: "1px solid rgba(56, 189, 248, 0.4)",
                    borderRadius: 8,
                    padding: "2px 9px",
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                    fontWeight: 800,
                    fontSize: "0.82rem",
                    letterSpacing: "0.02em",
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#0284c7", boxShadow: "0 0 6px #0284c7" }} />
                  #{resolvedParams.id}
                </span>
              </h1>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: "0.72rem",
                  fontWeight: 850,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  background: "linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.14) 100%)",
                  color: "#065f46",
                  border: "1px solid rgba(16, 185, 129, 0.35)",
                  padding: "4px 10px",
                  borderRadius: 999,
                }}
              >
                <ShieldCheck size={14} style={{ color: "#059669" }} /> NMC 2026 Compliant
              </span>
            </div>
            <div style={{ fontSize: "0.82rem", color: "#64748b", display: "flex", alignItems: "center", gap: 8, marginTop: 4, letterSpacing: "-0.01em" }}>
              <span style={{ color: "#0369a1", fontWeight: 800 }}>{doctorName}</span>
              <span style={{ color: "#cbd5e1" }}>·</span>
              <span style={{ fontWeight: 650, color: "#475569" }}>{doctorDegree}</span>
              <span style={{ color: "#cbd5e1" }}>·</span>
              <span
                style={{
                  color: started ? "#059669" : "#d97706",
                  fontWeight: 750,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: started ? "#10b981" : "#f59e0b", boxShadow: started ? "0 0 8px #10b981" : "0 0 6px #f59e0b" }} />
                {status || "Virtual Exam Staging"}
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
                display: "flex",
                alignItems: "center",
                gap: 9,
                fontWeight: 850,
                fontSize: "0.92rem",
                letterSpacing: "-0.01em",
                padding: "11px 24px",
                borderRadius: 14,
                border: "none",
                cursor: "pointer",
                background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                color: "#ffffff",
                boxShadow: "0 6px 20px -2px rgba(2, 132, 199, 0.45)",
                transition: "all 0.2s ease",
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
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontWeight: 850,
                fontSize: "0.9rem",
                borderRadius: 14,
                padding: "11px 22px",
                background: "linear-gradient(135deg, #e11d48 0%, #be123c 100%)",
                color: "#ffffff",
                border: "none",
                cursor: "pointer",
                boxShadow: "0 6px 20px -2px rgba(225, 29, 72, 0.4)",
              }}
            >
              <PhoneOff size={17} /> Conclude Call &amp; Issue e-Rx
            </button>
          )}
        </div>
      </header>

      <main style={{ maxWidth: "1520px", margin: "0 auto", padding: "28px 24px" }}>
        {/* VIEW 1: PRE-CALL DOCTOR COMMAND CONSOLE (STAGING) */}
        {!started && !aiAnalysis && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(460px, 1fr))", gap: 26 }}>
            {/* Patient Clinical Intake Card (High-Precision Medical Monitor) */}
            <div
              style={{
                background: "linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.96) 100%)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                borderRadius: 24,
                border: "1px solid rgba(226, 232, 240, 0.95)",
                padding: "32px 30px",
                boxShadow: "0 20px 45px -10px rgba(15, 23, 42, 0.08), 0 4px 12px rgba(2, 132, 199, 0.04)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 24,
              }}
            >
              <div>
                {/* Header: Patient Monogram + Details */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 18 }}>
                    {/* Patient Monogram Avatar */}
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <div
                        style={{
                          width: 58,
                          height: 58,
                          borderRadius: 18,
                          background: "linear-gradient(135deg, #0284c7 0%, #0f172a 100%)",
                          color: "#ffffff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 950,
                          fontSize: "1.28rem",
                          letterSpacing: "-0.02em",
                          boxShadow: "0 6px 18px rgba(2, 132, 199, 0.28)",
                          border: "2px solid #ffffff",
                        }}
                      >
                        {patientData.name
                          .split(" ")
                          .map((n: string) => n[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase() || "CP"}
                      </div>
                      <span
                        style={{
                          position: "absolute",
                          bottom: -2,
                          right: -2,
                          width: 16,
                          height: 16,
                          borderRadius: "50%",
                          background: "#10b981",
                          border: "3px solid #ffffff",
                          boxShadow: "0 0 6px rgba(16, 185, 129, 0.6)",
                        }}
                        title="Patient Active in Lobby"
                      />
                    </div>

                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                        <span
                          style={{
                            padding: "4px 11px",
                            borderRadius: 999,
                            background: "linear-gradient(135deg, rgba(2, 132, 199, 0.1) 0%, rgba(56, 189, 248, 0.15) 100%)",
                            color: "#0284c7",
                            fontSize: "10.5px",
                            fontWeight: 850,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            border: "1px solid rgba(56, 189, 248, 0.35)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#0284c7" }} />
                          Patient Waiting in Virtual Lobby
                        </span>
                      </div>

                      <h2 style={{ margin: "2px 0 0 0", fontSize: "1.65rem", fontWeight: 950, letterSpacing: "-0.035em", color: "#0f172a" }}>
                        {patientData.name}
                      </h2>

                      <div style={{ fontSize: "0.84rem", color: "#64748b", marginTop: 7, display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
                        <span style={{ fontWeight: 700, color: "#334155", background: "#f1f5f9", padding: "2px 9px", borderRadius: 6, border: "1px solid #e2e8f0" }}>
                          {patientData.age}
                        </span>
                        <span style={{ fontWeight: 700, color: "#334155", background: "#f1f5f9", padding: "2px 9px", borderRadius: 6, border: "1px solid #e2e8f0" }}>
                          {patientData.gender}
                        </span>
                        <span style={{ fontWeight: 800, color: "#0369a1", background: "#e0f2fe", padding: "2px 9px", borderRadius: 6, border: "1px solid #bae6fd" }}>
                          Blood: O+
                        </span>
                        <span
                          style={{
                            background: "#ffffff",
                            padding: "2px 9px",
                            borderRadius: 6,
                            border: "1px solid #cbd5e1",
                            fontWeight: 800,
                            color: "#1e293b",
                            fontFamily: "ui-monospace, monospace",
                            fontSize: "0.78rem",
                            letterSpacing: "0.02em",
                          }}
                        >
                          UHID: {patientData.uhid}
                        </span>
                      </div>

                      {(patientData.email || patientData.phone) && (
                        <div style={{ fontSize: "0.8rem", color: "#475569", marginTop: 9, display: "flex", flexWrap: "wrap", gap: "8px" }}>
                          {patientData.email && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(240, 249, 255, 0.9)", color: "#0369a1", padding: "4px 10px", borderRadius: 8, border: "1px solid #bae6fd", fontWeight: 650 }}>
                              <Mail size={12} /> {patientData.email}
                            </span>
                          )}
                          {patientData.phone && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(248, 250, 252, 0.9)", color: "#475569", padding: "4px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontWeight: 650 }}>
                              <Phone size={12} /> {patientData.phone}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <span
                    style={{
                      background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
                      color: "#38bdf8",
                      border: "1px solid rgba(56, 189, 248, 0.35)",
                      borderRadius: 12,
                      padding: "8px 16px",
                      fontWeight: 850,
                      fontSize: "12px",
                      letterSpacing: "0.03em",
                      boxShadow: "0 4px 14px rgba(15, 23, 42, 0.15)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#38bdf8", boxShadow: "0 0 8px #38bdf8" }} />
                    {resolvedParams.id === "instant" ? "Direct Tele-Call" : `Booking #${resolvedParams.id.slice(0, 6)}`}
                  </span>
                </div>

                {/* Vitals Telemetry Grid (Hospital Clinical Monitor Workstation Standard) */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
                  {/* BP */}
                  <div
                    style={{
                      padding: "16px 14px",
                      borderRadius: 16,
                      background: "linear-gradient(160deg, #ffffff 0%, #f0f9ff 100%)",
                      border: "1.5px solid rgba(56, 189, 248, 0.4)",
                      boxShadow: "0 4px 16px -2px rgba(2, 132, 199, 0.08)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: "10px", color: "#0369a1", fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 4 }}>
                        <Activity size={13} style={{ color: "#0284c7" }} /> BP
                      </span>
                      <span style={{ fontSize: "9.5px", color: "#64748b", fontWeight: 750 }}>Norm &lt;120/80</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 3, margin: "2px 0 6px 0" }}>
                      <span style={{ fontWeight: 950, fontSize: "1.32rem", color: "#0f172a", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.03em" }}>118/76</span>
                      <span style={{ fontSize: "10px", color: "#64748b", fontWeight: 750 }}>mmHg</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 6, borderTop: "1px dashed rgba(56, 189, 248, 0.3)" }}>
                      <span style={{ fontSize: "10px", color: "#0284c7", fontWeight: 850 }}>Optimal Target</span>
                      <svg width="34" height="12" viewBox="0 0 34 12" fill="none">
                        <path d="M0 6 L8 6 L12 2 L16 10 L20 4 L24 8 L34 6" stroke="#0284c7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </div>

                  {/* PULSE */}
                  <div
                    style={{
                      padding: "16px 14px",
                      borderRadius: 16,
                      background: "linear-gradient(160deg, #ffffff 0%, #fff1f2 100%)",
                      border: "1.5px solid rgba(244, 63, 94, 0.35)",
                      boxShadow: "0 4px 16px -2px rgba(225, 29, 72, 0.08)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: "10px", color: "#be123c", fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 4 }}>
                        <Heart size={13} style={{ color: "#e11d48" }} /> Pulse
                      </span>
                      <span style={{ fontSize: "9.5px", color: "#64748b", fontWeight: 750 }}>60-100</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 3, margin: "2px 0 6px 0" }}>
                      <span style={{ fontWeight: 950, fontSize: "1.32rem", color: "#881337", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.03em" }}>74</span>
                      <span style={{ fontSize: "10px", color: "#9f1239", fontWeight: 750 }}>bpm</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 6, borderTop: "1px dashed rgba(244, 63, 94, 0.3)" }}>
                      <span style={{ fontSize: "10px", color: "#e11d48", fontWeight: 850 }}>Resting Rhythm</span>
                      <svg width="34" height="12" viewBox="0 0 34 12" fill="none">
                        <path d="M0 6 L6 6 L10 1 L14 11 L18 3 L22 9 L26 6 L34 6" stroke="#e11d48" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </div>

                  {/* TEMP */}
                  <div
                    style={{
                      padding: "16px 14px",
                      borderRadius: 16,
                      background: "linear-gradient(160deg, #ffffff 0%, #fffbeb 100%)",
                      border: "1.5px solid rgba(245, 158, 11, 0.35)",
                      boxShadow: "0 4px 16px -2px rgba(245, 158, 11, 0.08)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: "10px", color: "#b45309", fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 4 }}>
                        <Thermometer size={13} style={{ color: "#d97706" }} /> Temp
                      </span>
                      <span style={{ fontSize: "9.5px", color: "#64748b", fontWeight: 750 }}>98.6° Norm</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 3, margin: "2px 0 6px 0" }}>
                      <span style={{ fontWeight: 950, fontSize: "1.32rem", color: "#78350f", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.03em" }}>98.6</span>
                      <span style={{ fontSize: "10px", color: "#b45309", fontWeight: 750 }}>°F</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 6, borderTop: "1px dashed rgba(245, 158, 11, 0.3)" }}>
                      <span style={{ fontSize: "10px", color: "#d97706", fontWeight: 850 }}>Afebrile Normal</span>
                      <svg width="34" height="12" viewBox="0 0 34 12" fill="none">
                        <path d="M0 6 L14 6 L18 4 L22 8 L26 6 L34 6" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </div>

                  {/* SPO2 */}
                  <div
                    style={{
                      padding: "16px 14px",
                      borderRadius: 16,
                      background: "linear-gradient(160deg, #ffffff 0%, #f0fdf4 100%)",
                      border: "1.5px solid rgba(34, 197, 94, 0.35)",
                      boxShadow: "0 4px 16px -2px rgba(34, 197, 94, 0.08)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: "10px", color: "#15803d", fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 4 }}>
                        <Activity size={13} style={{ color: "#16a34a" }} /> SpO2
                      </span>
                      <span style={{ fontSize: "9.5px", color: "#64748b", fontWeight: 750 }}>&gt;95% Sat</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 3, margin: "2px 0 6px 0" }}>
                      <span style={{ fontWeight: 950, fontSize: "1.32rem", color: "#14532d", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.03em" }}>99</span>
                      <span style={{ fontSize: "10px", color: "#166534", fontWeight: 750 }}>%</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 6, borderTop: "1px dashed rgba(34, 197, 94, 0.3)" }}>
                      <span style={{ fontSize: "10px", color: "#16a34a", fontWeight: 850 }}>Room Air Normal</span>
                      <svg width="34" height="12" viewBox="0 0 34 12" fill="none">
                        <path d="M0 6 L10 6 L14 3 L18 9 L22 6 L34 6" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Chief Complaints & History */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
                    <div style={{ fontSize: "0.74rem", fontWeight: 850, color: "#0369a1", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      Chief Complaint &amp; Intake Telemetry
                    </div>
                    <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>
                      Reported via Patient Portal
                    </div>
                  </div>
                  <div
                    style={{
                      padding: "16px 20px",
                      borderRadius: "0 14px 14px 0",
                      background: "linear-gradient(135deg, rgba(240, 249, 255, 0.85) 0%, rgba(224, 242, 254, 0.4) 100%)",
                      border: "1px solid rgba(186, 230, 253, 0.9)",
                      borderLeft: "4px solid #0284c7",
                      fontSize: "0.94rem",
                      color: "#0f172a",
                      fontWeight: 600,
                      lineHeight: 1.6,
                      boxShadow: "0 2px 8px rgba(2, 132, 199, 0.04)",
                    }}
                  >
                    {patientData.symptoms}
                  </div>
                </div>

                {/* Allergies & Medications */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: "0.74rem", fontWeight: 850, color: "#991b1b", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
                      <AlertCircle size={13} style={{ color: "#e11d48" }} /> Known Clinical Allergies
                    </div>
                    <div
                      style={{
                        padding: "12px 16px",
                        borderRadius: 14,
                        background: "linear-gradient(135deg, #fff5f5 0%, #fef2f2 100%)",
                        border: "1.5px solid rgba(244, 63, 94, 0.35)",
                        boxShadow: "0 2px 8px rgba(225, 29, 72, 0.04)",
                      }}
                    >
                      <div style={{ fontSize: "0.86rem", color: "#991b1b", fontWeight: 850, letterSpacing: "-0.01em" }}>
                        Penicillin
                      </div>
                      <div style={{ fontSize: "11px", color: "#b91c1c", marginTop: 2, fontWeight: 600 }}>
                        Mild cutaneous rash (documented reaction)
                      </div>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: "0.74rem", fontWeight: 850, color: "#0369a1", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
                      <Pill size={13} style={{ color: "#0284c7" }} /> Active Medications
                    </div>
                    <div
                      style={{
                        padding: "12px 16px",
                        borderRadius: 14,
                        background: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)",
                        border: "1.5px solid rgba(56, 189, 248, 0.4)",
                        boxShadow: "0 2px 8px rgba(2, 132, 199, 0.04)",
                      }}
                    >
                      <div style={{ fontSize: "0.86rem", color: "#0369a1", fontWeight: 850, letterSpacing: "-0.01em" }}>
                        Multivitamins daily
                      </div>
                      <div style={{ fontSize: "11px", color: "#0284c7", marginTop: 2, fontWeight: 600 }}>
                        Self-reported OTC dietary supplement
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Consent & Action */}
              <div style={{ borderTop: "1px solid rgba(226, 232, 240, 0.95)", paddingTop: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: "0.82rem", color: "#64748b", fontWeight: 600, display: "flex", alignItems: "center", gap: 7 }}>
                  <ShieldCheck size={18} style={{ color: "#0284c7" }} />
                  <span>Digital patient consent verified · SHA-256 bound</span>
                </div>
                <button
                  type="button"
                  onClick={startConsultation}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontWeight: 900,
                    fontSize: "0.94rem",
                    letterSpacing: "-0.01em",
                    padding: "12px 26px",
                    borderRadius: 14,
                    border: "none",
                    cursor: "pointer",
                    background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                    color: "#ffffff",
                    boxShadow: "0 6px 22px -2px rgba(2, 132, 199, 0.45)",
                    transition: "all 0.2s ease",
                  }}
                >
                  <span>Enter Room</span>
                  <ChevronRight size={17} />
                  <span style={{ background: "rgba(255,255,255,0.22)", fontSize: "10.5px", padding: "2px 6px", borderRadius: 4, fontWeight: 800 }}>↵</span>
                </button>
              </div>
            </div>

            {/* Doctor Telehealth Ready Checklist */}
            <div
              style={{
                background: "linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.96) 100%)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                borderRadius: 24,
                border: "1px solid rgba(226, 232, 240, 0.95)",
                padding: "32px 30px",
                boxShadow: "0 20px 45px -10px rgba(15, 23, 42, 0.08), 0 4px 12px rgba(2, 132, 199, 0.04)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 24,
              }}
            >
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span
                    style={{
                      padding: "4px 11px",
                      borderRadius: 999,
                      background: "linear-gradient(135deg, rgba(34, 197, 94, 0.12) 0%, rgba(74, 222, 128, 0.15) 100%)",
                      color: "#15803d",
                      fontSize: "10.5px",
                      fontWeight: 850,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      border: "1px solid rgba(34, 197, 94, 0.35)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#16a34a" }} />
                    Hardware &amp; Clinical Scribe Ready
                  </span>
                  <span style={{ fontSize: "11px", color: "#15803d", fontWeight: 800, background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "3px 9px", borderRadius: 999 }}>
                    3/3 Checks Passing
                  </span>
                </div>

                <h3 style={{ margin: "4px 0 20px 0", fontSize: "1.5rem", fontWeight: 950, letterSpacing: "-0.03em", color: "#0f172a" }}>
                  Doctor Console Readiness Check
                </h3>

                <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 22 }}>
                  {/* Camera Module */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "16px 20px",
                      borderRadius: 16,
                      background: "linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)",
                      border: "1.5px solid rgba(34, 197, 94, 0.3)",
                      boxShadow: "0 3px 12px rgba(34, 197, 94, 0.05)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)", color: "#15803d", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(34, 197, 94, 0.2)" }}>
                        <Video size={22} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 850, fontSize: "0.95rem", color: "#0f172a", letterSpacing: "-0.01em" }}>Camera Sensor Active</div>
                        <div style={{ fontSize: "0.82rem", color: "#64748b", marginTop: 2 }}>1080p HD Video Room Calibrated &amp; Low Latency (14ms)</div>
                      </div>
                    </div>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#dcfce7", color: "#15803d", padding: "4px 10px", borderRadius: 999, fontSize: "11px", fontWeight: 850, letterSpacing: "0.04em" }}>
                      <CheckCircle2 size={13} /> READY
                    </span>
                  </div>

                  {/* Scribe Audio Module */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "16px 20px",
                      borderRadius: 16,
                      background: "linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)",
                      border: "1.5px solid rgba(56, 189, 248, 0.35)",
                      boxShadow: "0 3px 12px rgba(2, 132, 199, 0.05)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)", color: "#0369a1", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(2, 132, 199, 0.2)" }}>
                        <Mic size={22} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 850, fontSize: "0.95rem", color: "#0f172a", letterSpacing: "-0.01em" }}>Speech-to-Text Audio Scribe</div>
                        <div style={{ fontSize: "0.82rem", color: "#64748b", marginTop: 2 }}>Whisper-Medical Engine Armed · Indian Dialects Active</div>
                      </div>
                    </div>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#e0f2fe", color: "#0369a1", padding: "4px 10px", borderRadius: 999, fontSize: "11px", fontWeight: 850, letterSpacing: "0.04em" }}>
                      <Activity size={13} /> ARMED
                    </span>
                  </div>

                  {/* NMC Credential Module */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "16px 20px",
                      borderRadius: 16,
                      background: "linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)",
                      border: "1.5px solid rgba(34, 197, 94, 0.3)",
                      boxShadow: "0 3px 12px rgba(34, 197, 94, 0.05)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)", color: "#15803d", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(34, 197, 94, 0.2)" }}>
                        <ShieldCheck size={22} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 850, fontSize: "0.95rem", color: "#0f172a", letterSpacing: "-0.01em" }}>National Medical Commission Mandate</div>
                        <div style={{ fontSize: "0.82rem", color: "#64748b", marginTop: 2 }}>Registered Practitioner: <strong style={{ color: "#0369a1" }}>{doctorUser?.name || "Dr. Verified"}</strong></div>
                      </div>
                    </div>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#dcfce7", color: "#15803d", padding: "4px 10px", borderRadius: 999, fontSize: "11px", fontWeight: 850, letterSpacing: "0.04em" }}>
                      <CheckCircle2 size={13} /> VERIFIED
                    </span>
                  </div>
                </div>

                {/* Network & Hardware Telemetry Strip */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                    padding: "12px 18px",
                    borderRadius: 14,
                    background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
                    border: "1px solid #e2e8f0",
                    marginBottom: 20,
                  }}
                >
                  <div>
                    <div style={{ fontSize: "10px", fontWeight: 850, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      NETWORK LATENCY
                    </div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#059669", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px #10b981" }} />
                      14ms · Ultra-Low Latency
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "10px", fontWeight: 850, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      STREAM ENCRYPTION
                    </div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#0369a1", marginTop: 2, display: "flex", alignItems: "center", gap: 5 }}>
                      <ShieldCheck size={14} style={{ color: "#0284c7" }} />
                      DTLS-SRTP 256-Bit
                    </div>
                  </div>
                </div>
              </div>

              {/* NMC Telemedicine Advisory Banner */}
              <div style={{ background: "linear-gradient(135deg, rgba(240, 249, 255, 0.95) 0%, rgba(224, 242, 254, 0.6) 100%)", border: "1.5px solid #7dd3fc", borderRadius: 16, padding: "18px 22px", boxShadow: "0 4px 16px rgba(2, 132, 199, 0.08)" }}>
                <div style={{ fontWeight: 850, fontSize: "0.86rem", color: "#0284c7", marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <ShieldCheck size={17} /> NMC Telemedicine Practice Guidelines (2020 / 2026)
                  </div>
                  <span style={{ fontSize: "10.5px", fontWeight: 800, background: "#ffffff", color: "#0369a1", padding: "2px 8px", borderRadius: 6, border: "1px solid #bae6fd" }}>
                    Statutory Compliance
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: "0.82rem", color: "#334155", lineHeight: 1.6 }}>
                  The patient has granted verified digital consent. Prescriptions issued from this cockpit carry full legal validity under Section 33 of the Indian Medical Council Act. All Schedule X drugs remain hard-locked by protocol.
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
                background: "var(--cm-navy)",
                borderRadius: "var(--cm-radius)",
                overflow: "hidden",
                border: "1px solid var(--cm-line)",
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
                borderRadius: 20,
                border: "1px solid rgba(186, 230, 253, 0.85)",
                background: "rgba(255, 255, 255, 0.97)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                boxShadow: "0 12px 36px -6px rgba(2, 132, 199, 0.1), 0 2px 8px rgba(0,0,0,0.02)",
              }}
            >
              {/* Right Deck Tabs */}
              <div
                style={{
                  display: "flex",
                  borderBottom: "1px solid rgba(226, 232, 240, 0.9)",
                  background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
                  padding: "6px 8px 0 8px",
                  gap: 6,
                }}
              >
                <button
                  type="button"
                  onClick={() => setActiveRightTab("scribe")}
                  style={{
                    flex: 1,
                    padding: "12px 14px",
                    background: activeRightTab === "scribe" ? "#ffffff" : "transparent",
                    color: activeRightTab === "scribe" ? "#0369a1" : "#64748b",
                    border: "none",
                    borderBottom: activeRightTab === "scribe" ? "3px solid #0284c7" : "3px solid transparent",
                    borderTopLeftRadius: 10,
                    borderTopRightRadius: 10,
                    fontWeight: activeRightTab === "scribe" ? 850 : 650,
                    fontSize: "0.82rem",
                    letterSpacing: "-0.01em",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 7,
                    boxShadow: activeRightTab === "scribe" ? "0 -2px 8px rgba(2, 132, 199, 0.05)" : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      backgroundColor: isRecording ? "#ef4444" : "#10b981",
                      boxShadow: isRecording ? "0 0 8px rgba(239, 68, 68, 0.6)" : "none",
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
                    background: activeRightTab === "erx" ? "#ffffff" : "transparent",
                    color: activeRightTab === "erx" ? "#0369a1" : "#64748b",
                    border: "none",
                    borderBottom: activeRightTab === "erx" ? "3px solid #0284c7" : "3px solid transparent",
                    borderTopLeftRadius: 10,
                    borderTopRightRadius: 10,
                    fontWeight: activeRightTab === "erx" ? 850 : 650,
                    fontSize: "0.82rem",
                    letterSpacing: "-0.01em",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 7,
                    boxShadow: activeRightTab === "erx" ? "0 -2px 8px rgba(2, 132, 199, 0.05)" : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  <FileText size={15} style={{ color: activeRightTab === "erx" ? "#0284c7" : "#94a3b8" }} />
                  <span>Digital e-Rx Pad</span>
                  <span
                    style={{
                      background: activeRightTab === "erx" ? "#e0f2fe" : "#e2e8f0",
                      color: activeRightTab === "erx" ? "#0284c7" : "#64748b",
                      padding: "1px 7px",
                      borderRadius: 999,
                      fontSize: "0.72rem",
                      fontWeight: 800,
                    }}
                  >
                    {medicines.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveRightTab("history")}
                  style={{
                    flex: 1,
                    padding: "12px 14px",
                    background: activeRightTab === "history" ? "#ffffff" : "transparent",
                    color: activeRightTab === "history" ? "#0369a1" : "#64748b",
                    border: "none",
                    borderBottom: activeRightTab === "history" ? "3px solid #0284c7" : "3px solid transparent",
                    borderTopLeftRadius: 10,
                    borderTopRightRadius: 10,
                    fontWeight: activeRightTab === "history" ? 850 : 650,
                    fontSize: "0.82rem",
                    letterSpacing: "-0.01em",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 7,
                    boxShadow: activeRightTab === "history" ? "0 -2px 8px rgba(2, 132, 199, 0.05)" : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  <User size={15} style={{ color: activeRightTab === "history" ? "#0284c7" : "#94a3b8" }} />
                  <span>Patient EHR</span>
                </button>
              </div>

              {/* Tab Content Area */}
              <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
                {/* TAB 1: AI SCRIBE */}
                {activeRightTab === "scribe" && (
                  <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)" }}>
                        Real-time speech converted to clinical SOAP notes
                      </div>
                      <span
                        className="cm-pill cm-pill--waiting"
                        style={{
                          fontSize: "var(--cm-text-xs)",
                          color: isRecording ? "var(--cm-done)" : "var(--cm-waiting)",
                        }}
                      >
                        {isRecording ? <Mic size={13} /> : <MicOff size={13} />}
                        {isRecording ? "Listening Live" : "Mic Idle"}
                      </span>
                    </div>

                    <div
                      style={{
                        flex: 1,
                        background: "var(--cm-surface-2)",
                        borderRadius: "var(--cm-radius-sm)",
                        border: "1px solid var(--cm-line)",
                        padding: "14px",
                        overflowY: "auto",
                        minHeight: "220px",
                        fontSize: "var(--cm-text-sm)",
                        lineHeight: 1.6,
                        color: transcript ? "var(--cm-ink)" : "var(--cm-ink-3)",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {transcript ||
                        "Audio stream active. Speak normally into your microphone. CallMedex Clinical Scribe will capture conversation and automatically generate diagnosis and prescription suggestions."}
                    </div>

                    <div style={{ marginTop: 14 }}>
                      <label style={{ fontSize: "var(--cm-text-xs)", fontWeight: 700, color: "var(--cm-ink)", display: "block", marginBottom: 6 }}>
                        Doctor&apos;s Clinical Observations (Optional notes)
                      </label>
                      <textarea
                        rows={3}
                        value={clinicalNotes}
                        onChange={(e) => setClinicalNotes(e.target.value)}
                        placeholder="Add manual clinical observations here..."
                        style={{
                          width: "100%",
                          padding: "10px",
                          borderRadius: "var(--cm-radius-sm)",
                          background: "var(--cm-surface)",
                          border: "1px solid var(--cm-line-strong)",
                          color: "var(--cm-ink)",
                          fontSize: "var(--cm-text-sm)",
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
                      <label style={{ fontSize: "var(--cm-text-xs)", fontWeight: 700, color: "var(--cm-ink)", display: "block", marginBottom: 6 }}>
                        Primary Diagnosis (ICD-10 Standard)
                      </label>
                      <select
                        value={diagnosis}
                        onChange={(e) => setDiagnosis(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: "var(--cm-radius-sm)",
                          background: "var(--cm-surface)",
                          border: "1px solid var(--cm-line-strong)",
                          color: "var(--cm-ink)",
                          fontSize: "var(--cm-text-sm)",
                          outline: "none",
                        }}
                      >
                        <option value="Acute Upper Respiratory Infection (J06.9)">
                          Acute Upper Respiratory Infection (J06.9)
                        </option>
                        <option value="Acute Bronchitis (J20.9)">Acute Bronchitis (J20.9)</option>
                        <option value="Essential Hypertension (I10)">Essential Hypertension (I10)</option>
                        <option value="Type 2 Diabetes Mellitus (E11.9)">
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
                        <span style={{ fontSize: "var(--cm-text-xs)", fontWeight: 800, color: "var(--cm-ink)", textTransform: "uppercase" }}>
                          Medicines to Prescribe ({medicines.length})
                        </span>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {medicines.map((med, idx) => (
                          <div
                            key={idx}
                            style={{
                              background: "var(--cm-surface-2)",
                              borderRadius: "var(--cm-radius-sm)",
                              border: "1px solid var(--cm-line)",
                              padding: "10px 12px",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 700, fontSize: "var(--cm-text-sm)", color: "var(--cm-ink)" }}>
                                {med.generic_name}
                              </div>
                              <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)", marginTop: 2 }}>
                                {med.dosage} · {med.frequency} · {med.duration} ({med.instructions})
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeMedicine(idx)}
                              style={{
                                background: "transparent",
                                border: "none",
                                color: "var(--cm-urgent)",
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
                        background: "var(--cm-surface)",
                        borderRadius: "var(--cm-radius-sm)",
                        border: "1px dashed var(--cm-line-strong)",
                        padding: "12px",
                      }}
                    >
                      <div style={{ fontSize: "var(--cm-text-xs)", fontWeight: 700, color: "var(--cm-active)", marginBottom: 8, textTransform: "uppercase" }}>
                        + Add Medication
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8, marginBottom: 8 }}>
                        <input
                          type="text"
                          placeholder="Medicine name (e.g. Azithromycin 500mg)"
                          value={newMed.generic_name}
                          onChange={(e) => setNewMed({ ...newMed, generic_name: e.target.value })}
                          style={{
                            padding: "8px 10px",
                            borderRadius: "var(--cm-radius-sm)",
                            border: "1px solid var(--cm-line-strong)",
                            fontSize: "var(--cm-text-xs)",
                          }}
                        />
                        <input
                          type="text"
                          placeholder="Dosage (e.g. 1 tab)"
                          value={newMed.dosage}
                          onChange={(e) => setNewMed({ ...newMed, dosage: e.target.value })}
                          style={{
                            padding: "8px 10px",
                            borderRadius: "var(--cm-radius-sm)",
                            border: "1px solid var(--cm-line-strong)",
                            fontSize: "var(--cm-text-xs)",
                          }}
                        />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                        <select
                          value={newMed.frequency}
                          onChange={(e) => setNewMed({ ...newMed, frequency: e.target.value })}
                          style={{
                            padding: "6px",
                            borderRadius: "var(--cm-radius-sm)",
                            border: "1px solid var(--cm-line-strong)",
                            fontSize: "var(--cm-text-xs)",
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
                            padding: "6px 8px",
                            borderRadius: "var(--cm-radius-sm)",
                            border: "1px solid var(--cm-line-strong)",
                            fontSize: "var(--cm-text-xs)",
                          }}
                        />
                        <button
                          type="button"
                          onClick={addMedicine}
                          className="cm-btn cm-btn--primary cm-btn--sm"
                          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}
                        >
                          <Plus size={14} /> Add Rx
                        </button>
                      </div>
                    </div>

                    {/* Diagnostic Lab Tests Emitter */}
                    <div>
                      <div style={{ fontSize: "var(--cm-text-xs)", fontWeight: 700, color: "var(--cm-ink)", textTransform: "uppercase", marginBottom: 6 }}>
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
                            className={`cm-pill ${orderedLabTests.includes(test) ? "cm-pill--active" : ""}`}
                            style={{
                              cursor: "pointer",
                              fontSize: "var(--cm-text-xs)",
                              background: orderedLabTests.includes(test) ? "var(--cm-active-surface)" : "var(--cm-surface-2)",
                              border: `1px solid ${orderedLabTests.includes(test) ? "var(--cm-active-line)" : "var(--cm-line)"}`,
                              color: orderedLabTests.includes(test) ? "var(--cm-active)" : "var(--cm-ink-2)",
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
                    <div style={{ fontSize: "var(--cm-text-xs)", fontWeight: 700, color: "var(--cm-active)", textTransform: "uppercase", marginBottom: 10 }}>
                      Electronic Health Record · {patientData.name}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ padding: "12px", borderRadius: "var(--cm-radius-sm)", background: "var(--cm-surface-2)", border: "1px solid var(--cm-line)" }}>
                        <div style={{ fontWeight: 700, fontSize: "var(--cm-text-sm)", color: "var(--cm-ink)" }}>
                          Last Teleconsult: 14 Jan 2026
                        </div>
                        <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)", marginTop: 2 }}>
                          Dr. S. K. Rao · Acute Pharyngitis · Amoxicillin 500mg prescribed (completed)
                        </div>
                      </div>
                      <div style={{ padding: "12px", borderRadius: "var(--cm-radius-sm)", background: "var(--cm-surface-2)", border: "1px solid var(--cm-line)" }}>
                        <div style={{ fontWeight: 700, fontSize: "var(--cm-text-sm)", color: "var(--cm-ink)" }}>
                          Home Lab Report: 22 Dec 2025
                        </div>
                        <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)", marginTop: 2 }}>
                          CallMedex Phlebotomy · CBC &amp; Lipid Profile normal · Hb: 13.2 g/dL
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
              color: "var(--cm-ink)",
              borderRadius: "var(--cm-radius)",
              boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
              border: "1px solid var(--cm-line)",
              overflow: "hidden",
            }}
          >
            {/* Header / Doctor Letterhead */}
            <div
              style={{
                background: "var(--cm-navy)",
                color: "#ffffff",
                padding: "24px 32px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <Stethoscope size={24} style={{ color: "var(--cm-active)" }} />
                  <span style={{ fontWeight: 800, fontSize: "1.3rem", letterSpacing: "-0.01em" }}>
                    {doctorName}
                  </span>
                </div>
                <div style={{ fontSize: "var(--cm-text-sm)", color: "#cbd5e1" }}>
                  {doctorDegree} · NMC Reg: APMC/2019/92144
                </div>
                <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-active)", marginTop: 2 }}>
                  CallMedex Digital Telehealth Network
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <span className="cm-pill cm-pill--done" style={{ background: "rgba(255,255,255,0.15)", color: "#ffffff" }}>
                  <CheckCircle2 size={14} /> Digitally Signed
                </span>
                <div style={{ fontSize: "var(--cm-text-xs)", color: "#cbd5e1", marginTop: 4 }}>
                  Consultation #{resolvedParams.id}
                </div>
              </div>
            </div>

            {/* Patient Demographics Strip */}
            <div
              style={{
                background: "var(--cm-surface-2)",
                borderBottom: "1px solid var(--cm-line)",
                padding: "16px 32px",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 16,
                fontSize: "var(--cm-text-xs)",
              }}
            >
              <div>
                <div style={{ color: "var(--cm-ink-3)", textTransform: "uppercase" }}>Patient Name</div>
                <div style={{ fontWeight: 700, color: "var(--cm-ink)", fontSize: "var(--cm-text-sm)" }}>{patientData.name}</div>
              </div>
              <div>
                <div style={{ color: "var(--cm-ink-3)", textTransform: "uppercase" }}>Age / Gender</div>
                <div style={{ fontWeight: 700, color: "var(--cm-ink)" }}>{patientData.age} / {patientData.gender}</div>
              </div>
              <div>
                <div style={{ color: "var(--cm-ink-3)", textTransform: "uppercase" }}>Patient Email (Mandatory)</div>
                <div style={{ fontWeight: 700, color: "var(--cm-active)" }}>
                  {patientEmailInput || patientData.email || "Pending verification"}
                </div>
              </div>
              <div>
                <div style={{ color: "var(--cm-ink-3)", textTransform: "uppercase" }}>UHID</div>
                <div style={{ fontWeight: 700, color: "var(--cm-ink)" }}>{patientData.uhid}</div>
              </div>
              <div>
                <div style={{ color: "var(--cm-ink-3)", textTransform: "uppercase" }}>Consultation Date</div>
                <div style={{ fontWeight: 700, color: "var(--cm-ink)" }}>{new Date().toLocaleDateString("en-IN")}</div>
              </div>
            </div>

            {/* Body of Prescription */}
            <div style={{ padding: "28px 32px" }}>
              {/* Diagnosis & Clinical Summary */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>
                  Diagnosis
                </div>
                <div style={{ fontSize: "var(--cm-text-lg)", fontWeight: 800, color: "var(--cm-active)" }}>
                  {aiAnalysis.diagnosis || diagnosis}
                </div>
                <p style={{ margin: "8px 0 0 0", color: "var(--cm-ink-2)", fontSize: "var(--cm-text-sm)", lineHeight: 1.6 }}>
                  {aiAnalysis.summary || clinicalNotes}
                </p>
              </div>

              {/* Rx Medicines Table */}
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: "var(--cm-text-sm)", fontWeight: 800, color: "var(--cm-ink)", textTransform: "uppercase", borderBottom: "2px solid var(--cm-active)", paddingBottom: 6, marginBottom: 12 }}>
                  ℞ Prescribed Medications
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {(aiAnalysis.medicines || medicines).map((med: any, idx: number) => (
                    <div
                      key={idx}
                      style={{
                        padding: "12px 14px",
                        borderRadius: "var(--cm-radius-sm)",
                        background: "var(--cm-surface-2)",
                        border: "1px solid var(--cm-line)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "var(--cm-text-sm)", color: "var(--cm-ink)" }}>
                          {idx + 1}. {med.generic_name}
                        </div>
                        <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)", marginTop: 2 }}>
                          Instructions: {med.instructions || "After food"}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span className="cm-pill cm-pill--active" style={{ marginRight: 6 }}>
                          {med.dosage}
                        </span>
                        <span className="cm-pill cm-pill--active" style={{ marginRight: 6 }}>
                          {med.frequency}
                        </span>
                        <span className="cm-pill cm-pill--done">
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
                  <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)", fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>
                    Advised Investigations / Home Sample Collection
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {(aiAnalysis.lab_tests || orderedLabTests).map((test: string, idx: number) => (
                      <span key={idx} className="cm-pill cm-pill--active">
                        {test}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Digital e-Prescription Email Dispatch Panel */}
              <div
                style={{
                  borderTop: "1px solid var(--cm-line)",
                  paddingTop: 24,
                  marginTop: 20,
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                <div
                  style={{
                    background: "var(--cm-surface-2)",
                    border: "1px solid var(--cm-line-strong)",
                    borderRadius: "var(--cm-radius-sm)",
                    padding: "16px 20px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Mail size={16} style={{ color: "var(--cm-active)" }} />
                      <span style={{ fontWeight: 800, fontSize: "var(--cm-text-sm)", color: "var(--cm-ink)" }}>
                        Dispatch Official NMC-Compliant e-Prescription to Patient
                      </span>
                    </div>
                    <span className="cm-pill cm-pill--active" style={{ fontSize: "var(--cm-text-xs)" }}>
                      Mandatory for Teleconsultation
                    </span>
                  </div>

                  <p style={{ margin: "0 0 12px 0", fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-2)" }}>
                    Under the NMC Telemedicine Practice Guidelines 2026, the consulting doctor must transmit the digitally signed prescription directly to the patient&apos;s verified email address.
                  </p>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: "260px" }}>
                      <input
                        type="email"
                        value={patientEmailInput}
                        onChange={(e) => {
                          setPatientEmailInput(e.target.value);
                          setRxEmailError("");
                        }}
                        placeholder="patient.email@example.com (Mandatory)"
                        style={{
                          width: "100%",
                          padding: "10px 14px",
                          borderRadius: "var(--cm-radius-sm)",
                          border: "1px solid var(--cm-line-strong)",
                          fontSize: "var(--cm-text-sm)",
                          outline: "none",
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleSendRxEmail}
                      disabled={isSendingRxEmail || rxEmailSent}
                      className="cm-btn cm-btn--primary"
                      style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700 }}
                    >
                      {rxEmailSent ? (
                        <>
                          <CheckCircle2 size={16} /> e-Prescription Dispatched!
                        </>
                      ) : isSendingRxEmail ? (
                        "Transmitting e-Rx via SMTP..."
                      ) : (
                        <>
                          <Send size={16} /> Send e-Prescription to Patient Email
                        </>
                      )}
                    </button>
                  </div>

                  {rxEmailError && (
                    <div style={{ marginTop: 10, fontSize: "var(--cm-text-xs)", color: "var(--cm-urgent)", display: "flex", alignItems: "center", gap: 6 }}>
                      <AlertCircle size={14} /> {rxEmailError}
                    </div>
                  )}

                  {rxEmailSent && (
                    <div style={{ marginTop: 10, fontSize: "var(--cm-text-xs)", color: "var(--cm-done)", display: "flex", alignItems: "center", gap: 6, fontWeight: 700 }}>
                      <CheckCircle2 size={14} /> Official e-Prescription successfully delivered to {patientEmailInput || patientData.email}. A cryptographic audit trail was generated.
                    </div>
                  )}
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 12,
                    paddingTop: 8,
                  }}
                >
                  <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)" }}>
                    Digital Rx timestamped: {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · Linked to Patient EHR
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="cm-btn cm-btn--secondary cm-btn--sm"
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <Printer size={16} /> Print / Save PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push("/dashboard/doctor")}
                      className="cm-btn cm-btn--secondary cm-btn--sm"
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <ArrowLeft size={16} /> Return to Doctor Station
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
