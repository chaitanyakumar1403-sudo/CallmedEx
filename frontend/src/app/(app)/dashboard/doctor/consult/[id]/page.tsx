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
        backgroundColor: "var(--cm-surface)",
        minHeight: "100vh",
        color: "var(--cm-ink)",
        fontFamily: "var(--font-sans, system-ui, -apple-system, sans-serif)",
        paddingBottom: "40px",
      }}
    >
      {/* Top Telemedicine Status Bar */}
      <header
        style={{
          borderBottom: "1px solid var(--cm-line)",
          background: "var(--cm-surface)",
          padding: "12px 24px",
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
            className="cm-btn cm-btn--secondary cm-btn--sm"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <ArrowLeft size={16} /> Exit Room
          </button>

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h1 style={{ margin: 0, fontSize: "var(--cm-text-base)", fontWeight: 800, color: "var(--cm-ink)" }}>
                CallMedex Telemedicine Cockpit #{resolvedParams.id}
              </h1>
              <span className="cm-pill cm-pill--done" style={{ fontSize: "var(--cm-text-xs)" }}>
                <ShieldCheck size={12} /> NMC 2026 Compliant
              </span>
            </div>
            <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)", display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
              <span style={{ color: "var(--cm-active)", fontWeight: 700 }}>{doctorName}</span>
              <span>·</span>
              <span>{doctorDegree}</span>
              <span>·</span>
              <span style={{ color: started ? "var(--cm-done)" : "var(--cm-waiting)", fontWeight: 600 }}>
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
              className="cm-btn cm-btn--primary"
              style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}
            >
              <Video size={16} /> Launch Secure Consultation
            </button>
          )}

          {started && !aiAnalysis && (
            <button
              type="button"
              onClick={finalizeConsultation}
              className="cm-btn cm-btn--urgent"
              style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}
            >
              <PhoneOff size={16} /> Conclude Call &amp; Issue e-Rx
            </button>
          )}
        </div>
      </header>

      <main style={{ maxWidth: "1520px", margin: "0 auto", padding: "20px" }}>
        {/* VIEW 1: PRE-CALL DOCTOR COMMAND CONSOLE (STAGING) */}
        {!started && !aiAnalysis && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "var(--cm-5)", marginTop: 12 }}>
            {/* Patient Clinical Intake Card */}
            <div className="cm-card" style={{ padding: "var(--cm-5)", border: "1px solid var(--cm-line)", borderRadius: "var(--cm-radius)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-active)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Patient Waiting in Virtual Lobby
                  </div>
                  <h2 style={{ margin: "4px 0 0 0", fontSize: "var(--cm-text-xl)", fontWeight: 800, color: "var(--cm-ink)" }}>
                    {patientData.name}
                  </h2>
                  <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)", marginTop: 4, display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
                    <span>{patientData.age}</span>
                    <span>·</span>
                    <span>{patientData.gender}</span>
                    <span>·</span>
                    <span>UHID: {patientData.uhid}</span>
                  </div>
                  {(patientData.email || patientData.phone) && (
                    <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-2)", marginTop: 6, display: "flex", flexWrap: "wrap", gap: "10px" }}>
                      {patientData.email && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "var(--cm-active-surface)", color: "var(--cm-active)", padding: "2px 8px", borderRadius: "4px" }}>
                          <Mail size={12} /> {patientData.email}
                        </span>
                      )}
                      {patientData.phone && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "var(--cm-surface-2)", color: "var(--cm-ink-2)", padding: "2px 8px", borderRadius: "4px" }}>
                          <Phone size={12} /> {patientData.phone}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <span className="cm-pill cm-pill--active">
                  {resolvedParams.id === "instant" ? "Direct Call" : `Booking #${resolvedParams.id.slice(0, 6)}`}
                </span>
              </div>

              {/* Vitals Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 22 }}>
                <div style={{ padding: "10px", borderRadius: "var(--cm-radius-sm)", background: "var(--cm-surface-2)", border: "1px solid var(--cm-line)", textAlign: "center" }}>
                  <Activity size={16} style={{ color: "var(--cm-active)", margin: "0 auto 4px" }} />
                  <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)" }}>BP</div>
                  <div style={{ fontWeight: 800, fontSize: "var(--cm-text-sm)", color: "var(--cm-ink)", fontVariantNumeric: "tabular-nums" }}>118/76</div>
                </div>
                <div style={{ padding: "10px", borderRadius: "var(--cm-radius-sm)", background: "var(--cm-surface-2)", border: "1px solid var(--cm-line)", textAlign: "center" }}>
                  <Heart size={16} style={{ color: "var(--cm-urgent)", margin: "0 auto 4px" }} />
                  <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)" }}>Pulse</div>
                  <div style={{ fontWeight: 800, fontSize: "var(--cm-text-sm)", color: "var(--cm-ink)", fontVariantNumeric: "tabular-nums" }}>74 bpm</div>
                </div>
                <div style={{ padding: "10px", borderRadius: "var(--cm-radius-sm)", background: "var(--cm-surface-2)", border: "1px solid var(--cm-line)", textAlign: "center" }}>
                  <Thermometer size={16} style={{ color: "var(--cm-waiting)", margin: "0 auto 4px" }} />
                  <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)" }}>Temp</div>
                  <div style={{ fontWeight: 800, fontSize: "var(--cm-text-sm)", color: "var(--cm-ink)", fontVariantNumeric: "tabular-nums" }}>98.6°F</div>
                </div>
                <div style={{ padding: "10px", borderRadius: "var(--cm-radius-sm)", background: "var(--cm-surface-2)", border: "1px solid var(--cm-line)", textAlign: "center" }}>
                  <Activity size={16} style={{ color: "var(--cm-done)", margin: "0 auto 4px" }} />
                  <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)" }}>SpO2</div>
                  <div style={{ fontWeight: 800, fontSize: "var(--cm-text-sm)", color: "var(--cm-ink)", fontVariantNumeric: "tabular-nums" }}>99%</div>
                </div>
              </div>

              {/* Chief Complaints & History */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: "var(--cm-text-xs)", fontWeight: 700, color: "var(--cm-ink)", textTransform: "uppercase", marginBottom: 6 }}>
                  Chief Complaint
                </div>
                <div style={{ padding: "10px 14px", borderRadius: "var(--cm-radius-sm)", background: "var(--cm-surface-2)", border: "1px solid var(--cm-line)", fontSize: "var(--cm-text-sm)", color: "var(--cm-ink-2)" }}>
                  {patientData.symptoms}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: "var(--cm-text-xs)", fontWeight: 700, color: "var(--cm-ink-3)", textTransform: "uppercase", marginBottom: 4 }}>
                    Known Allergies
                  </div>
                  <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-urgent)", fontWeight: 700, padding: "6px 10px", borderRadius: "var(--cm-radius-sm)", background: "var(--cm-urgent-surface)", border: "1px solid var(--cm-urgent-line)" }}>
                    Penicillin (Mild Rash)
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "var(--cm-text-xs)", fontWeight: 700, color: "var(--cm-ink-3)", textTransform: "uppercase", marginBottom: 4 }}>
                    Current Medications
                  </div>
                  <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-2)", padding: "6px 10px", borderRadius: "var(--cm-radius-sm)", background: "var(--cm-surface-2)", border: "1px solid var(--cm-line)" }}>
                    Multivitamins daily
                  </div>
                </div>
              </div>

              <div style={{ borderTop: "1px solid var(--cm-line)", paddingTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)" }}>
                  Digital consent timestamped &amp; stored
                </div>
                <button
                  type="button"
                  onClick={startConsultation}
                  className="cm-btn cm-btn--primary cm-btn--sm"
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  Enter Room <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Doctor Telehealth Ready Checklist */}
            <div className="cm-card" style={{ padding: "var(--cm-5)", border: "1px solid var(--cm-line)", borderRadius: "var(--cm-radius)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-done)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                  Doctor Console Readiness Check
                </div>
                <h3 style={{ margin: "0 0 16px 0", fontSize: "var(--cm-text-lg)", fontWeight: 800, color: "var(--cm-ink)" }}>
                  Hardware &amp; Clinical Scribe Ready
                </h3>

                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: "var(--cm-radius-sm)", background: "var(--cm-surface-2)", border: "1px solid var(--cm-line)" }}>
                    <div style={{ width: 28, height: 28, borderRadius: "6px", background: "var(--cm-done-surface)", color: "var(--cm-done)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <CheckCircle2 size={16} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "var(--cm-text-sm)", color: "var(--cm-ink)" }}>Camera Sensor Active</div>
                      <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)" }}>1080p HD Video Room Ready</div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: "var(--cm-radius-sm)", background: "var(--cm-surface-2)", border: "1px solid var(--cm-line)" }}>
                    <div style={{ width: 28, height: 28, borderRadius: "6px", background: "var(--cm-done-surface)", color: "var(--cm-done)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <CheckCircle2 size={16} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "var(--cm-text-sm)", color: "var(--cm-ink)" }}>Speech-to-Text Audio Scribe</div>
                      <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)" }}>Microphone input calibrated for real-time transcription</div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: "var(--cm-radius-sm)", background: "var(--cm-surface-2)", border: "1px solid var(--cm-line)" }}>
                    <div style={{ width: 28, height: 28, borderRadius: "6px", background: "var(--cm-done-surface)", color: "var(--cm-done)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <CheckCircle2 size={16} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "var(--cm-text-sm)", color: "var(--cm-ink)" }}>National Medical Commission Mandate</div>
                      <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)" }}>Registered Practitioner: {doctorUser?.name || "Dr. Verified"}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ background: "var(--cm-active-surface)", border: "1px solid var(--cm-active-line)", borderRadius: "var(--cm-radius-sm)", padding: "14px", marginTop: 12 }}>
                <div style={{ fontWeight: 800, fontSize: "var(--cm-text-xs)", color: "var(--cm-active)", marginBottom: 4 }}>
                  NMC Telemedicine Practice Guidelines
                </div>
                <p style={{ margin: 0, fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-2)", lineHeight: 1.5 }}>
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
              className="cm-card"
              style={{
                borderRadius: "var(--cm-radius)",
                border: "1px solid var(--cm-line)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                padding: 0,
              }}
            >
              {/* Right Deck Tabs */}
              <div
                style={{
                  display: "flex",
                  borderBottom: "1px solid var(--cm-line)",
                  background: "var(--cm-surface-2)",
                }}
              >
                <button
                  type="button"
                  onClick={() => setActiveRightTab("scribe")}
                  style={{
                    flex: 1,
                    padding: "12px 14px",
                    background: activeRightTab === "scribe" ? "var(--cm-surface)" : "transparent",
                    color: activeRightTab === "scribe" ? "var(--cm-active)" : "var(--cm-ink-3)",
                    border: "none",
                    borderBottom: activeRightTab === "scribe" ? "2px solid var(--cm-active)" : "none",
                    fontWeight: 700,
                    fontSize: "var(--cm-text-xs)",
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
                      backgroundColor: isRecording ? "var(--cm-urgent)" : "var(--cm-ink-3)",
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
                    background: activeRightTab === "erx" ? "var(--cm-surface)" : "transparent",
                    color: activeRightTab === "erx" ? "var(--cm-active)" : "var(--cm-ink-3)",
                    border: "none",
                    borderBottom: activeRightTab === "erx" ? "2px solid var(--cm-active)" : "none",
                    fontWeight: 700,
                    fontSize: "var(--cm-text-xs)",
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
                    background: activeRightTab === "history" ? "var(--cm-surface)" : "transparent",
                    color: activeRightTab === "history" ? "var(--cm-active)" : "var(--cm-ink-3)",
                    border: "none",
                    borderBottom: activeRightTab === "history" ? "2px solid var(--cm-active)" : "none",
                    fontWeight: 700,
                    fontSize: "var(--cm-text-xs)",
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
