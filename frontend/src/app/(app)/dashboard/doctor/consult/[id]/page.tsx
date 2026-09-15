"use client";

import { useState, useEffect, use, useRef, useCallback } from "react";
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
  RefreshCw,
} from "lucide-react";
import { formatDoctorName, prescriberRegNumber, REG_MISSING_MESSAGE } from "@/lib/prescriber";

type CheckLevel = "ok" | "warn" | "fail" | "pending";
interface ReadinessCheck { level: CheckLevel; detail: string }

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
    allergies: "Not recorded",
    medications: "Not recorded",
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

  // The signed-in provider's real profile — name, qualification, registration
  // number and verification status. localStorage "user" carries none of these.
  const [doctorProfile, setDoctorProfile] = useState<any>(null);
  const [profileError, setProfileError] = useState(false);
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    fetch(`${apiBase}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        if (d?.success && d.data) setDoctorProfile(d.data);
        else setProfileError(true);
      })
      .catch(() => setProfileError(true));
  }, []);

  // Readiness checks — each reflects something actually measured in this browser.
  const [mediaCheck, setMediaCheck] = useState<ReadinessCheck>({ level: "pending", detail: "Checking camera and microphone…" });
  const [networkCheck, setNetworkCheck] = useState<ReadinessCheck>({ level: "pending", detail: "Measuring connection…" });
  const [scribeSupported, setScribeSupported] = useState<boolean | null>(null);

  const checkMedia = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
      setMediaCheck({ level: "fail", detail: "This browser can't access a camera here. Use a current Chrome, Edge or Safari over HTTPS." });
      return;
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasCam = devices.some((d) => d.kind === "videoinput");
      const hasMic = devices.some((d) => d.kind === "audioinput");
      if (!hasCam || !hasMic) {
        const missing = !hasCam && !hasMic ? "camera or microphone" : !hasCam ? "camera" : "microphone";
        setMediaCheck({ level: "fail", detail: `No ${missing} detected. Connect one and run the checks again.` });
        return;
      }
      const permission = async (name: string) => {
        try {
          return (await navigator.permissions.query({ name } as PermissionDescriptor)).state;
        } catch {
          return "unknown";
        }
      };
      const [cam, mic] = await Promise.all([permission("camera"), permission("microphone")]);
      // Device labels are only exposed once access has been granted.
      const labelled = devices.some((d) => d.kind === "videoinput" && d.label);
      if (cam === "denied" || mic === "denied") {
        setMediaCheck({ level: "fail", detail: "Camera or microphone access is blocked. Allow it in this site's browser settings." });
      } else if (labelled || (cam === "granted" && mic === "granted")) {
        setMediaCheck({ level: "ok", detail: "Camera and microphone detected, access allowed." });
      } else {
        setMediaCheck({ level: "warn", detail: "Camera and microphone detected. Test them now or allow access when the browser asks." });
      }
    } catch {
      setMediaCheck({ level: "fail", detail: "Couldn't read your media devices." });
    }
  }, []);

  const testMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      // checkMedia reports the resulting state (denied / missing)
    }
    checkMedia();
  }, [checkMedia]);

  const checkNetwork = useCallback(async () => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setNetworkCheck({ level: "fail", detail: "You're offline." });
      return;
    }
    setNetworkCheck({ level: "pending", detail: "Measuring connection…" });
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const ping = async () => {
      const t0 = performance.now();
      const res = await fetch(`${apiBase}/api/health`, { cache: "no-store" });
      return { ok: res.ok, status: res.status, ms: Math.round(performance.now() - t0) };
    };
    try {
      // The first request pays for connection setup; the second is the real round-trip.
      await ping();
      const r = await ping();
      if (!r.ok) setNetworkCheck({ level: "warn", detail: `CallMedex servers returned an error (${r.status}).` });
      else if (r.ms < 400) setNetworkCheck({ level: "ok", detail: `${r.ms} ms round-trip to CallMedex servers.` });
      else setNetworkCheck({ level: "warn", detail: `${r.ms} ms round-trip — video may lag or freeze.` });
    } catch {
      setNetworkCheck({ level: "fail", detail: "Can't reach CallMedex servers." });
    }
  }, []);

  useEffect(() => {
    checkMedia();
    checkNetwork();
    setScribeSupported(
      typeof window !== "undefined" &&
        Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    );
  }, [checkMedia, checkNetwork]);

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

  const doctorName = formatDoctorName(doctorProfile?.full_name || doctorUser?.full_name, "Doctor");
  const doctorDegree = [doctorProfile?.qualification, doctorProfile?.specialization].filter(Boolean).join(" · ");
  const regNumber = prescriberRegNumber(doctorProfile);
  const isVerified = String(doctorProfile?.verification_status || "").toLowerCase() === "verified";
  const regCheck: ReadinessCheck = profileError
    ? { level: "fail", detail: "Couldn't load your profile. Refresh the page." }
    : !doctorProfile
    ? { level: "pending", detail: "Loading your profile…" }
    : !regNumber
    ? { level: "fail", detail: "Not on file — add it in Doctor Profile before issuing e-prescriptions." }
    : isVerified
    ? { level: "ok", detail: `${regNumber} · verified by CallMedex` }
    : { level: "warn", detail: `${regNumber} · verification pending` };
  const scribeCheck: ReadinessCheck =
    scribeSupported === null
      ? { level: "pending", detail: "Checking browser support…" }
      : scribeSupported
      ? { level: "ok", detail: "Browser speech recognition is available for live notes." }
      : { level: "warn", detail: "Not supported in this browser — use Chrome or Edge, or type notes manually." };
  const doctorId = doctorUser?.id || "doc-callmedex-active";

  const handleSendRxEmail = async () => {
    const targetEmail = (patientEmailInput || patientData.email || "").trim();
    if (!targetEmail || !targetEmail.includes("@")) {
      setRxEmailError("A valid patient email is mandatory to transmit the digital e-Prescription.");
      return;
    }

    if (!regNumber) {
      setRxEmailError(REG_MISSING_MESSAGE);
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
        background: "var(--cm-surface-2)",
        minHeight: "100vh",
        color: "var(--cm-ink)",
        fontFamily: "var(--cm-font-ui)",
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
              fontWeight: 600,
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
              <h1 style={{ margin: 0, fontSize: "1.22rem", fontWeight: 700, letterSpacing: "-0.03em", color: "#0f172a", display: "flex", alignItems: "center", gap: 10 }}>
                <span>CallMedex Telemedicine Cockpit</span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    background: "var(--cm-active-bg)",
                    color: "var(--cm-active)",
                    border: "1px solid rgba(255, 255, 255, 0.28)",
                    borderRadius: 8,
                    padding: "2px 9px",
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                    fontWeight: 600,
                    fontSize: "0.82rem",
                    letterSpacing: "0.02em",
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--cm-navy)", boxShadow: "0 0 6px rgba(15, 29, 51, 0.12)" }} />
                  #{resolvedParams.id}
                </span>
              </h1>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  background: "var(--cm-done-bg)",
                  color: "#065f46",
                  border: "1px solid rgba(16, 185, 129, 0.35)",
                  padding: "4px 10px",
                  borderRadius: 999,
                }}
              >
                <ShieldCheck size={14} style={{ color: "#059669" }} /> NMC telemedicine guidelines
              </span>
            </div>
            <div style={{ fontSize: "0.82rem", color: "#64748b", display: "flex", alignItems: "center", gap: 8, marginTop: 4, letterSpacing: "-0.01em" }}>
              <span style={{ color: "var(--cm-active)", fontWeight: 600 }}>{doctorName}</span>
              {doctorDegree && (
                <>
                  <span style={{ color: "#cbd5e1" }}>·</span>
                  <span style={{ fontWeight: 600, color: "#475569" }}>{doctorDegree}</span>
                </>
              )}
              <span style={{ color: "#cbd5e1" }}>·</span>
              <span
                style={{
                  color: started ? "#059669" : "#d97706",
                  fontWeight: 600,
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
                fontWeight: 600,
                fontSize: "0.92rem",
                letterSpacing: "-0.01em",
                padding: "11px 24px",
                borderRadius: 14,
                border: "none",
                cursor: "pointer",
                background: "var(--cm-navy)",
                color: "#ffffff",
                boxShadow: "0 6px 20px -2px rgba(15, 29, 51, 0.12)",
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
                fontWeight: 600,
                fontSize: "0.9rem",
                borderRadius: 14,
                padding: "11px 22px",
                background: "var(--cm-urgent)",
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
                background: "var(--cm-surface)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                borderRadius: 24,
                border: "1px solid rgba(226, 232, 240, 0.95)",
                padding: "32px 30px",
                boxShadow: "0 20px 45px -10px rgba(15, 23, 42, 0.08), 0 4px 12px rgba(15, 23, 42, 0.04)",
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
                          background: "var(--cm-navy)",
                          color: "#ffffff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          fontSize: "1.28rem",
                          letterSpacing: "-0.02em",
                          boxShadow: "0 6px 18px rgba(15, 29, 51, 0.12)",
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
                            background: "var(--cm-active-bg)",
                            color: "var(--cm-active)",
                            fontSize: "10.5px",
                            fontWeight: 600,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            border: "1px solid rgba(255, 255, 255, 0.28)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--cm-navy)" }} />
                          Patient Waiting in Virtual Lobby
                        </span>
                      </div>

                      <h2 style={{ margin: "2px 0 0 0", fontSize: "1.65rem", fontWeight: 700, letterSpacing: "-0.035em", color: "#0f172a" }}>
                        {patientData.name}
                      </h2>

                      <div style={{ fontSize: "0.84rem", color: "#64748b", marginTop: 7, display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
                        <span style={{ fontWeight: 600, color: "#334155", background: "#f1f5f9", padding: "2px 9px", borderRadius: 6, border: "1px solid #e2e8f0" }}>
                          {patientData.age}
                        </span>
                        <span style={{ fontWeight: 600, color: "#334155", background: "#f1f5f9", padding: "2px 9px", borderRadius: 6, border: "1px solid #e2e8f0" }}>
                          {patientData.gender}
                        </span>
                        <span
                          style={{
                            background: "#ffffff",
                            padding: "2px 9px",
                            borderRadius: 6,
                            border: "1px solid #cbd5e1",
                            fontWeight: 600,
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
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "var(--cm-surface-2)", color: "var(--cm-active)", padding: "4px 10px", borderRadius: 8, border: "1px solid var(--cm-line)", fontWeight: 600 }}>
                              <Mail size={12} /> {patientData.email}
                            </span>
                          )}
                          {patientData.phone && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(248, 250, 252, 0.9)", color: "#475569", padding: "4px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontWeight: 600 }}>
                              <Phone size={12} /> {patientData.phone}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <span
                    style={{
                      background: "var(--cm-navy-deep)",
                      color: "#ffffff",
                      border: "1px solid rgba(255, 255, 255, 0.28)",
                      borderRadius: 12,
                      padding: "8px 16px",
                      fontWeight: 600,
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
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80" }} />
                    {resolvedParams.id === "instant" ? "Direct Tele-Call" : `Booking #${resolvedParams.id.slice(0, 6)}`}
                  </span>
                </div>

                {/* Vitals — no device feed exists yet, so nothing is shown as measured.
                    Reference ranges stay as a prompt for the doctor to ask. */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
                  {[
                    { label: "BP", icon: Activity, unit: "mmHg", ref: "Norm <120/80" },
                    { label: "Pulse", icon: Heart, unit: "bpm", ref: "60–100" },
                    { label: "Temp", icon: Thermometer, unit: "°F", ref: "98.6° norm" },
                    { label: "SpO2", icon: Activity, unit: "%", ref: ">95% sat" },
                  ].map((v) => (
                    <div
                      key={v.label}
                      style={{
                        padding: "14px 16px",
                        borderRadius: 14,
                        background: "var(--cm-surface)",
                        border: "1px solid var(--cm-line)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      <span style={{ fontSize: "11px", color: "var(--cm-ink-3)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 5 }}>
                        <v.icon size={13} /> {v.label}
                      </span>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: "1.3rem", color: "var(--cm-ink-faint)", fontVariantNumeric: "tabular-nums" }}>—</span>
                        <span style={{ fontSize: "11px", color: "var(--cm-ink-faint)" }}>{v.unit}</span>
                      </div>
                      <span style={{ fontSize: "11px", color: "var(--cm-ink-3)" }}>Not recorded</span>
                      <span style={{ fontSize: "11px", color: "var(--cm-ink-faint)", whiteSpace: "nowrap" }}>Ref {v.ref}</span>
                    </div>
                  ))}
                </div>

                {/* Chief Complaints & History */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
                    <div style={{ fontSize: "0.74rem", fontWeight: 600, color: "var(--cm-active)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
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
                      background: "var(--cm-surface)",
                      border: "1px solid var(--cm-line)",
                      borderLeft: "4px solid var(--cm-active)",
                      fontSize: "0.94rem",
                      color: "#0f172a",
                      fontWeight: 600,
                      lineHeight: 1.6,
                      boxShadow: "0 2px 8px rgba(15, 23, 42, 0.04)",
                    }}
                  >
                    {patientData.symptoms}
                  </div>
                </div>

                {/* Allergies & Medications — shown exactly as recorded; never assumed. */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 20 }}>
                  {[
                    { label: "Known allergies", icon: AlertCircle, value: patientData.allergies },
                    { label: "Active medications", icon: Pill, value: patientData.medications },
                  ].map((f) => (
                    <div key={f.label}>
                      <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--cm-ink-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
                        <f.icon size={13} /> {f.label}
                      </div>
                      <div style={{ padding: "12px 16px", borderRadius: 12, background: "var(--cm-surface-2)", border: "1px solid var(--cm-line)" }}>
                        <div style={{ fontSize: "0.9rem", color: "var(--cm-ink)", fontWeight: 600 }}>{f.value}</div>
                        <div style={{ fontSize: "12px", color: "var(--cm-ink-3)", marginTop: 2 }}>
                          Confirm with the patient before prescribing
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer Consent & Action */}
              <div style={{ borderTop: "1px solid rgba(226, 232, 240, 0.95)", paddingTop: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: "0.82rem", color: "#64748b", fontWeight: 600, display: "flex", alignItems: "center", gap: 7 }}>
                  <ShieldCheck size={18} style={{ color: "var(--cm-active)" }} />
                  <span>Confirm the patient's identity and consent at the start of the call</span>
                </div>
                <button
                  type="button"
                  onClick={startConsultation}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontWeight: 700,
                    fontSize: "0.94rem",
                    letterSpacing: "-0.01em",
                    padding: "12px 26px",
                    borderRadius: 14,
                    border: "none",
                    cursor: "pointer",
                    background: "var(--cm-navy)",
                    color: "#ffffff",
                    boxShadow: "0 6px 22px -2px rgba(15, 29, 51, 0.12)",
                    transition: "all 0.2s ease",
                  }}
                >
                  <span>Enter Room</span>
                  <ChevronRight size={17} />
                  <span style={{ background: "rgba(255,255,255,0.22)", fontSize: "10.5px", padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>↵</span>
                </button>
              </div>
            </div>

            {/* Doctor console readiness — every row is a live check, not a label. */}
            {(() => {
              const tone: Record<CheckLevel, { bg: string; line: string; fg: string; label: string }> = {
                ok: { bg: "var(--cm-done-bg)", line: "var(--cm-done-line)", fg: "var(--cm-done)", label: "Ready" },
                warn: { bg: "var(--cm-waiting-bg)", line: "var(--cm-waiting-line)", fg: "var(--cm-waiting)", label: "Review" },
                fail: { bg: "var(--cm-urgent-bg)", line: "var(--cm-urgent-line)", fg: "var(--cm-urgent)", label: "Action needed" },
                pending: { bg: "var(--cm-surface-2)", line: "var(--cm-line)", fg: "var(--cm-ink-3)", label: "Checking" },
              };
              const checks = [
                { key: "media", title: "Camera & microphone", icon: Video, check: mediaCheck },
                { key: "scribe", title: "Live speech-to-text notes", icon: Mic, check: scribeCheck },
                { key: "reg", title: "Medical registration", icon: ShieldCheck, check: regCheck },
                { key: "net", title: "Connection", icon: Activity, check: networkCheck },
              ];
              const ready = checks.filter((c) => c.check.level === "ok").length;
              const failing = checks.filter((c) => c.check.level === "fail").length;
              const pending = checks.some((c) => c.check.level === "pending");
              const summary: { level: CheckLevel; text: string } = pending
                ? { level: "pending", text: "Running checks" }
                : failing > 0
                ? { level: "fail", text: `${failing} need${failing === 1 ? "s" : ""} action` }
                : ready === checks.length
                ? { level: "ok", text: "All checks passed" }
                : { level: "warn", text: `${checks.length - ready} to review` };

              return (
                <div
                  style={{
                    background: "var(--cm-surface)",
                    borderRadius: 24,
                    border: "1px solid var(--cm-line)",
                    padding: "32px 30px",
                    boxShadow: "0 20px 45px -10px rgba(15, 23, 42, 0.08), 0 4px 12px rgba(15, 23, 42, 0.04)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 22,
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 8 }}>
                      <span
                        style={{
                          padding: "4px 11px",
                          borderRadius: 999,
                          background: tone[summary.level].bg,
                          color: tone[summary.level].fg,
                          border: `1px solid ${tone[summary.level].line}`,
                          fontSize: "11px",
                          fontWeight: 600,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                        role="status"
                        aria-live="polite"
                      >
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />
                        {summary.text}
                      </span>
                      <span style={{ fontSize: "12px", color: "var(--cm-ink-3)", fontVariantNumeric: "tabular-nums" }}>
                        {ready}/{checks.length} ready
                      </span>
                    </div>
                    <h3 style={{ margin: "4px 0 0", fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--cm-ink)" }}>
                      Console readiness
                    </h3>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {checks.map(({ key, title, icon: Glyph, check }) => (
                      <div
                        key={key}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 14,
                          padding: "14px 18px",
                          borderRadius: 16,
                          background: check.level === "ok" || check.level === "pending" ? "var(--cm-surface)" : tone[check.level].bg,
                          border: `1px solid ${check.level === "ok" || check.level === "pending" ? "var(--cm-line)" : tone[check.level].line}`,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
                          <div style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 11, background: tone[check.level].bg, color: tone[check.level].fg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Glyph size={20} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--cm-ink)" }}>{title}</div>
                            <div style={{ fontSize: "0.82rem", color: "var(--cm-ink-3)", marginTop: 2, overflowWrap: "anywhere" }}>{check.detail}</div>
                            {key === "media" && check.level === "warn" && (
                              <button
                                type="button"
                                onClick={testMedia}
                                className="cm-btn cm-btn--secondary cm-btn--sm"
                                style={{ marginTop: 8 }}
                              >
                                <Video size={14} /> Test camera &amp; mic
                              </button>
                            )}
                          </div>
                        </div>
                        <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 4, color: tone[check.level].fg, fontSize: "12px", fontWeight: 600 }}>
                          {check.level === "ok" ? <CheckCircle2 size={14} /> : check.level === "pending" ? <Clock size={14} /> : <AlertCircle size={14} />}
                          {tone[check.level].label}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.8rem", color: "var(--cm-ink-3)", display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <ShieldCheck size={14} /> Video is encrypted in transit (WebRTC DTLS-SRTP)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        checkMedia();
                        checkNetwork();
                      }}
                      className="cm-btn cm-btn--ghost cm-btn--sm"
                    >
                      <RefreshCw size={14} /> Run checks again
                    </button>
                  </div>

                  <div style={{ background: "var(--cm-surface-2)", border: "1px solid var(--cm-line)", borderRadius: 16, padding: "16px 20px" }}>
                    <div style={{ fontWeight: 600, fontSize: "0.86rem", color: "var(--cm-ink)", marginBottom: 6, display: "flex", alignItems: "center", gap: 7 }}>
                      <ShieldCheck size={16} /> NMC Telemedicine Practice Guidelines
                    </div>
                    <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--cm-ink-2)", lineHeight: 1.6 }}>
                      Confirm the patient&apos;s identity and consent before you begin, and include your registration number on every prescription. Medicines on the guidelines&apos; prohibited list (for example Schedule X and NDPS drugs) must not be prescribed by teleconsultation.
                    </p>
                  </div>
                </div>
              );
            })()}
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
                border: "1px solid var(--cm-line)",
                background: "rgba(255, 255, 255, 0.97)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                boxShadow: "0 12px 36px -6px rgba(15, 23, 42, 0.04), 0 2px 8px rgba(0,0,0,0.02)",
              }}
            >
              {/* Right Deck Tabs */}
              <div
                style={{
                  display: "flex",
                  borderBottom: "1px solid rgba(226, 232, 240, 0.9)",
                  background: "var(--cm-surface-3)",
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
                    color: activeRightTab === "scribe" ? "var(--cm-active)" : "#64748b",
                    border: "none",
                    borderBottom: activeRightTab === "scribe" ? "3px solid var(--cm-active)" : "3px solid transparent",
                    borderTopLeftRadius: 10,
                    borderTopRightRadius: 10,
                    fontWeight: activeRightTab === "scribe" ? 600 : 600,
                    fontSize: "0.82rem",
                    letterSpacing: "-0.01em",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 7,
                    boxShadow: activeRightTab === "scribe" ? "0 -2px 8px rgba(15, 23, 42, 0.04)" : "none",
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
                    color: activeRightTab === "erx" ? "var(--cm-active)" : "#64748b",
                    border: "none",
                    borderBottom: activeRightTab === "erx" ? "3px solid var(--cm-active)" : "3px solid transparent",
                    borderTopLeftRadius: 10,
                    borderTopRightRadius: 10,
                    fontWeight: activeRightTab === "erx" ? 600 : 600,
                    fontSize: "0.82rem",
                    letterSpacing: "-0.01em",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 7,
                    boxShadow: activeRightTab === "erx" ? "0 -2px 8px rgba(15, 23, 42, 0.04)" : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  <FileText size={15} style={{ color: activeRightTab === "erx" ? "var(--cm-active)" : "#94a3b8" }} />
                  <span>Digital e-Rx Pad</span>
                  <span
                    style={{
                      background: activeRightTab === "erx" ? "#e0f2fe" : "#e2e8f0",
                      color: activeRightTab === "erx" ? "var(--cm-active)" : "#64748b",
                      padding: "1px 7px",
                      borderRadius: 999,
                      fontSize: "0.72rem",
                      fontWeight: 600,
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
                    color: activeRightTab === "history" ? "var(--cm-active)" : "#64748b",
                    border: "none",
                    borderBottom: activeRightTab === "history" ? "3px solid var(--cm-active)" : "3px solid transparent",
                    borderTopLeftRadius: 10,
                    borderTopRightRadius: 10,
                    fontWeight: activeRightTab === "history" ? 600 : 600,
                    fontSize: "0.82rem",
                    letterSpacing: "-0.01em",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 7,
                    boxShadow: activeRightTab === "history" ? "0 -2px 8px rgba(15, 23, 42, 0.04)" : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  <User size={15} style={{ color: activeRightTab === "history" ? "var(--cm-active)" : "#94a3b8" }} />
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
                      <label style={{ fontSize: "var(--cm-text-xs)", fontWeight: 600, color: "var(--cm-ink)", display: "block", marginBottom: 6 }}>
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
                      <label style={{ fontSize: "var(--cm-text-xs)", fontWeight: 600, color: "var(--cm-ink)", display: "block", marginBottom: 6 }}>
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
                        <span style={{ fontSize: "var(--cm-text-xs)", fontWeight: 600, color: "var(--cm-ink)", textTransform: "uppercase" }}>
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
                              <div style={{ fontWeight: 600, fontSize: "var(--cm-text-sm)", color: "var(--cm-ink)" }}>
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
                      <div style={{ fontSize: "var(--cm-text-xs)", fontWeight: 600, color: "var(--cm-active)", marginBottom: 8, textTransform: "uppercase" }}>
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
                      <div style={{ fontSize: "var(--cm-text-xs)", fontWeight: 600, color: "var(--cm-ink)", textTransform: "uppercase", marginBottom: 6 }}>
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
                    <div style={{ fontSize: "var(--cm-text-xs)", fontWeight: 600, color: "var(--cm-active)", textTransform: "uppercase", marginBottom: 10 }}>
                      Electronic Health Record · {patientData.name}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ padding: "12px", borderRadius: "var(--cm-radius-sm)", background: "var(--cm-surface-2)", border: "1px solid var(--cm-line)" }}>
                        <div style={{ fontWeight: 600, fontSize: "var(--cm-text-sm)", color: "var(--cm-ink)" }}>
                          Last Teleconsult: 14 Jan 2026
                        </div>
                        <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)", marginTop: 2 }}>
                          Dr. S. K. Rao · Acute Pharyngitis · Amoxicillin 500mg prescribed (completed)
                        </div>
                      </div>
                      <div style={{ padding: "12px", borderRadius: "var(--cm-radius-sm)", background: "var(--cm-surface-2)", border: "1px solid var(--cm-line)" }}>
                        <div style={{ fontWeight: 600, fontSize: "var(--cm-text-sm)", color: "var(--cm-ink)" }}>
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
                  <Stethoscope size={24} style={{ color: "var(--cm-active-line)" }} />
                  <span style={{ fontWeight: 600, fontSize: "1.3rem", letterSpacing: "-0.01em" }}>
                    {doctorName}
                  </span>
                </div>
                <div style={{ fontSize: "var(--cm-text-sm)", color: "#cbd5e1" }}>
                  {[doctorDegree, `NMC Reg: ${regNumber || "not on file"}`].filter(Boolean).join(" · ")}
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
                <div style={{ fontWeight: 600, color: "var(--cm-ink)", fontSize: "var(--cm-text-sm)" }}>{patientData.name}</div>
              </div>
              <div>
                <div style={{ color: "var(--cm-ink-3)", textTransform: "uppercase" }}>Age / Gender</div>
                <div style={{ fontWeight: 600, color: "var(--cm-ink)" }}>{patientData.age} / {patientData.gender}</div>
              </div>
              <div>
                <div style={{ color: "var(--cm-ink-3)", textTransform: "uppercase" }}>Patient Email (Mandatory)</div>
                <div style={{ fontWeight: 600, color: "var(--cm-active)" }}>
                  {patientEmailInput || patientData.email || "Pending verification"}
                </div>
              </div>
              <div>
                <div style={{ color: "var(--cm-ink-3)", textTransform: "uppercase" }}>UHID</div>
                <div style={{ fontWeight: 600, color: "var(--cm-ink)" }}>{patientData.uhid}</div>
              </div>
              <div>
                <div style={{ color: "var(--cm-ink-3)", textTransform: "uppercase" }}>Consultation Date</div>
                <div style={{ fontWeight: 600, color: "var(--cm-ink)" }}>{new Date().toLocaleDateString("en-IN")}</div>
              </div>
            </div>

            {/* Body of Prescription */}
            <div style={{ padding: "28px 32px" }}>
              {/* Diagnosis & Clinical Summary */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>
                  Diagnosis
                </div>
                <div style={{ fontSize: "var(--cm-text-lg)", fontWeight: 600, color: "var(--cm-active)" }}>
                  {aiAnalysis.diagnosis || diagnosis}
                </div>
                <p style={{ margin: "8px 0 0 0", color: "var(--cm-ink-2)", fontSize: "var(--cm-text-sm)", lineHeight: 1.6 }}>
                  {aiAnalysis.summary || clinicalNotes}
                </p>
              </div>

              {/* Rx Medicines Table */}
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: "var(--cm-text-sm)", fontWeight: 600, color: "var(--cm-ink)", textTransform: "uppercase", borderBottom: "2px solid var(--cm-active)", paddingBottom: 6, marginBottom: 12 }}>
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
                        <div style={{ fontWeight: 600, fontSize: "var(--cm-text-sm)", color: "var(--cm-ink)" }}>
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
                  <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)", fontWeight: 600, textTransform: "uppercase", marginBottom: 6 }}>
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
                      <span style={{ fontWeight: 600, fontSize: "var(--cm-text-sm)", color: "var(--cm-ink)" }}>
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
                      style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 600 }}
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
                    <div style={{ marginTop: 10, fontSize: "var(--cm-text-xs)", color: "var(--cm-done)", display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
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
