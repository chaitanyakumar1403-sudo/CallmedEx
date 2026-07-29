"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Banner, Card, EmptyState, Icon, Modal, Panel, Pill, SkeletonRows } from "@/components/ui";
import { ClipboardList, Clock, MapPin, Navigation } from "@/components/ui/icons";
import { StatusPill } from "@/app/components/StatusSpine";
import { DutyBar } from "./dispatch/DutyBar";
import { OffDutyPanel } from "./dispatch/OffDutyPanel";
import { ActiveTaskPanel, type ActiveTaskProviderType } from "./dispatch/ActiveTaskPanel";
import { TaskListPanel } from "./dispatch/TaskListPanel";
import { SelfieModal } from "./dispatch/SelfieModal";
import { LabHandoverModal } from "./dispatch/LabHandoverModal";
import { VitalsModal, type Vitals } from "./dispatch/VitalsModal";
import { serviceLabel } from "./dispatch/serviceLabel";

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const getToken = () => typeof window !== "undefined" ? localStorage.getItem("token") : null;

export interface DispatchTask {
  id: string;
  patient_address: string;
  patient_lat: number;
  patient_lng: number;
  status: string;
  service_type: string;
  estimated_distance_km: number;
  notes?: string;
  created_at: string;
  priority?: string;
  booking_id?: string;
}

type StatusMsg = { tone: "done" | "urgent" | "active"; text: string } | null;

interface ProviderDispatchTrackerProps {
  title: string;
  /**
   * Set when the tracker is rendered inside DashboardShell. The shell already
   * supplies the page title, name and background, so repeating them here
   * produced two stacked headers on the nurse and phlebotomist dashboards.
   * Embedded mode keeps what only this component has — the duty toggle, the GPS
   * indicator and the day's stats — and drops the duplicated chrome.
   */
  embedded?: boolean;
  providerType: string;
  earningsRate: number;
}

export default function ProviderDispatchTracker({ title, providerType, earningsRate, embedded = false }: ProviderDispatchTrackerProps) {
  const router = useRouter();
  const [onDuty, setOnDuty] = useState(false);
  const [tasks, setTasks] = useState<DispatchTask[]>([]);
  const [completedToday, setCompletedToday] = useState(0);
  const [earnings, setEarnings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dutyLoading, setDutyLoading] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [activeTask, setActiveTask] = useState<DispatchTask | null>(null);
  const [actionLoading, setActionLoading] = useState("");
  const [statusMsg, setStatusMsg] = useState<StatusMsg>(null);
  const [otp, setOtp] = useState("");
  const [showAllTasks, setShowAllTasks] = useState(false);

  // Selfie Verification State
  const [showSelfieModal, setShowSelfieModal] = useState(false);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [verifyingSelfie, setVerifyingSelfie] = useState(false);

  // Phlebotomist Lab Handover State
  const [showLabModal, setShowLabModal] = useState(false);
  const [labHubName, setLabHubName] = useState("Apollo Diagnostics Central Hub");
  const [sampleBarcodes, setSampleBarcodes] = useState("");
  const [labNotes, setLabNotes] = useState("");

  // Nurse Clinical Vitals State
  const [showVitalsModal, setShowVitalsModal] = useState(false);
  const [vitals, setVitals] = useState<Vitals>({ bp: "120/80", pulse: "72", temp: "98.6", spo2: "99" });
  const [procedureNotes, setProcedureNotes] = useState("");

  const locationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const taskIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ─── Fetch duty status ────────────────────────────────────────────────
  // `profile` was dead (flagged in Task 12 review) — nothing here ever read
  // it, only `DashboardProfile` at the page level does. `is_online` is not:
  // it seeds `onDuty` on mount so duty state survives a reload, matching the
  // `is_online: true` Playwright mock in e2e/provider-dispatch.spec.ts and
  // the backend's duty-toggle route. So the fetch and redirect guards stay;
  // only the unused `profile` state is gone.
  const fetchDutyStatus = useCallback(async () => {
    const token = getToken();
    if (!token) { router.push("/auth/login"); return; }
    try {
      const res = await fetch(`${apiBase}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setOnDuty(data.data.is_online || false);
      } else {
        router.push("/auth/login");
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [router]);

  const fetchTasks = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${apiBase}/api/dispatch/my-tasks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const all = data.tasks || [];
        setTasks(all.filter((t: DispatchTask) => !["completed", "cancelled"].includes(t.status)));
        const done = all.filter((t: DispatchTask) => t.status === "completed");
        setCompletedToday(done.length);
        setEarnings(done.length * earningsRate);
        // Find current in-progress task
        const active = all.find((t: DispatchTask) =>
          ["provider_accepted", "en_route", "arrived", "in_progress"].includes(t.status)
        );
        setActiveTask(active || null);
      }
    } catch (e) { console.error(e); }
  }, [earningsRate]);

  useEffect(() => {
    fetchDutyStatus();
    fetchTasks();
    taskIntervalRef.current = setInterval(fetchTasks, 12000);
    return () => {
      if (taskIntervalRef.current) clearInterval(taskIntervalRef.current);
      if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
    };
  }, [fetchDutyStatus, fetchTasks]);

  // ─── GPS Location Broadcasting ────────────────────────────────────────
  const startLocationBroadcast = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError("GPS not available on this device.");
      return;
    }
    const sendLoc = () => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const token = getToken();
          if (!token) return;
          try {
            await fetch(`${apiBase}/api/dispatch/update-location`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                provider_type: providerType,
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                heading: pos.coords.heading || null,
                speed_kmh: pos.coords.speed ? pos.coords.speed * 3.6 : null,
              }),
            });
            setLocationError("");
          } catch { /* silent */ }
        },
        (err) => { setLocationError(`GPS error: ${err.message}`); },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    };
    sendLoc(); // Send immediately
    locationIntervalRef.current = setInterval(sendLoc, 30000); // Every 30s
  }, [providerType]);

  const stopLocationBroadcast = useCallback(() => {
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }
  }, []);

  // ─── Toggle Duty ──────────────────────────────────────────────────────
  const onToggleClick = () => {
    if (!onDuty && providerType === "phlebotomist") {
      setShowSelfieModal(true);
    } else {
      handleToggleDuty();
    }
  };

  const handleToggleDuty = async () => {
    setDutyLoading(true);
    const token = getToken();
    const newStatus = !onDuty;

    try {
      const res = await fetch(`${apiBase}/api/dispatch/toggle-duty`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ is_online: newStatus }),
      });
      if (res.ok) {
        setOnDuty(newStatus);
        if (newStatus) {
          startLocationBroadcast();
          setStatusMsg({ tone: "done", text: "You're now on duty — accepting dispatch requests" });
        } else {
          stopLocationBroadcast();
          setStatusMsg({ tone: "active", text: "You're now off duty" });
        }
      } else {
        // A silent failure here is worse than an error banner: the provider
        // believes the tap worked and expects dispatch requests that will
        // never arrive, with nothing telling them why.
        setStatusMsg({
          tone: "urgent",
          text: newStatus
            ? "Could not go on duty — please try again."
            : "Could not go off duty — please try again.",
        });
      }
    } catch (e) {
      setStatusMsg({ tone: "urgent", text: "Failed to update duty status" });
    } finally {
      setDutyLoading(false);
    }
  };

  const handleSelfieSubmit = async () => {
    if (!selfieFile) {
      setStatusMsg({ tone: "urgent", text: "Please upload your duty selfie first." });
      return;
    }
    setVerifyingSelfie(true);
    // Simulate AI verification delay
    setTimeout(() => {
      setVerifyingSelfie(false);
      setShowSelfieModal(false);
      setSelfieFile(null);
      handleToggleDuty(); // Proceed to go on duty
    }, 1500);
  };

  // ─── Accept / Reject Task ─────────────────────────────────────────────
  const handleTaskAction = async (taskId: string, action: "accept" | "reject") => {
    setActionLoading(taskId + action);
    const token = getToken();
    try {
      const res = await fetch(`${apiBase}/api/dispatch/${taskId}/${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg(action === "accept"
          ? { tone: "done", text: "Task accepted! Head to the patient's location." }
          : { tone: "active", text: "Task declined — you will receive the next request." });
        fetchTasks();
      } else {
        setStatusMsg({ tone: "urgent", text: data.detail || `Failed to ${action} task` });
      }
    } catch (e) {
      setStatusMsg({ tone: "urgent", text: "Network error" });
    } finally {
      setActionLoading("");
    }
  };

  // ─── Update Task Status ───────────────────────────────────────────────
  const handleUpdateStatus = async (taskId: string, newStatus: string) => {
    setActionLoading(taskId + newStatus);
    const token = getToken();
    try {
      const res = await fetch(`${apiBase}/api/dispatch/${taskId}/update-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ tone: "done", text: `Status updated to: ${newStatus}` });
        fetchTasks();
      } else {
        setStatusMsg({ tone: "urgent", text: data.detail || "Update failed" });
      }
    } catch (e) {
      setStatusMsg({ tone: "urgent", text: "Network error" });
    } finally {
      setActionLoading("");
    }
  };

  // ─── Verify OTP ────────────────────────────────────────────────────────
  const handleVerifyOtp = async (taskId: string) => {
    if (!otp || otp.length < 6) {
      setStatusMsg({ tone: "urgent", text: "Please enter the 6-digit OTP from the patient" });
      return;
    }
    setActionLoading("verify_otp");
    const token = getToken();
    try {
      const res = await fetch(`${apiBase}/api/dispatch/${taskId}/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ otp }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ tone: "done", text: "OTP Verified! Starting service." });
        setOtp("");
        fetchTasks();
      } else {
        setStatusMsg({ tone: "urgent", text: data.detail || "Invalid OTP" });
      }
    } catch (e) {
      setStatusMsg({ tone: "urgent", text: "Network error verifying OTP" });
    } finally {
      setActionLoading("");
    }
  };

  // ─── Lab Handover Submit ────────────────────────────────────────────────
  const handleLabHandoverSubmit = async () => {
    if (!activeTask) return;
    setActionLoading("lab_handover");
    const token = getToken();
    try {
      const res = await fetch(`${apiBase}/api/dispatch/${activeTask.id}/lab-handover`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          hub_name: labHubName,
          sample_barcodes: sampleBarcodes || "BAR-DEFAULT-001",
          notes: labNotes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ tone: "done", text: `Samples Handed Over to ${labHubName}!` });
        setShowLabModal(false);
        fetchTasks();
      } else {
        setStatusMsg({ tone: "urgent", text: data.detail || "Handover failed" });
      }
    } catch (e) {
      setStatusMsg({ tone: "urgent", text: "Network error saving lab handover" });
    } finally {
      setActionLoading("");
    }
  };

  const handleLabFieldChange = (field: "labHubName" | "barcodes" | "notes", value: string) => {
    if (field === "labHubName") setLabHubName(value);
    else if (field === "barcodes") setSampleBarcodes(value);
    else setLabNotes(value);
  };

  // ─── Clinical Notes Submit ──────────────────────────────────────────────
  const handleClinicalNotesSubmit = async () => {
    if (!activeTask) return;
    setActionLoading("clinical_notes");
    const token = getToken();
    try {
      const res = await fetch(`${apiBase}/api/dispatch/${activeTask.id}/clinical-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          blood_pressure: vitals.bp,
          pulse_rate: vitals.pulse,
          temperature_f: vitals.temp,
          spo2_percent: vitals.spo2,
          procedure_notes: procedureNotes || "Standard nursing procedure completed with full infection control protocol.",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ tone: "done", text: "Clinical Vitals & Notes recorded successfully!" });
        setShowVitalsModal(false);
        // Complete the task
        handleUpdateStatus(activeTask.id, "completed");
      } else {
        setStatusMsg({ tone: "urgent", text: data.detail || "Submission failed" });
      }
    } catch (e) {
      setStatusMsg({ tone: "urgent", text: "Network error saving clinical notes" });
    } finally {
      setActionLoading("");
    }
  };

  if (loading) {
    return (
      <div className={embedded ? "cm-tracker__loading" : "cm-tracker__loading--standalone"}>
        <SkeletonRows rows={3} />
      </div>
    );
  }

  const pendingTasks = tasks
    .filter(t => t.status === "pending")
    .sort((a, b) => (a.priority === "urgent" ? 0 : 1) - (b.priority === "urgent" ? 0 : 1));

  return (
    <div className={embedded ? undefined : "cm-tracker--standalone"}>
      <DutyBar
        title={embedded ? undefined : title}
        onDuty={onDuty}
        dutyLoading={dutyLoading || verifyingSelfie}
        gpsLive={onDuty}
        activeCount={tasks.length}
        completedToday={completedToday}
        earnings={earnings}
        earningsRate={earningsRate}
        onToggle={onToggleClick}
        onShowAllTasks={() => setShowAllTasks(true)}
      />

      <div className={embedded ? undefined : "cm-tracker__body"}>
        {statusMsg && (
          <Banner tone={statusMsg.tone} onDismiss={() => setStatusMsg(null)}>
            {statusMsg.text}
          </Banner>
        )}

        {locationError && <Banner tone="urgent">{locationError}</Banner>}

        {!onDuty && <OffDutyPanel onGoOnDuty={onToggleClick} />}

        {/* ─── ACTIVE TASK TRACKER ─── */}
        {onDuty && activeTask && (
          <ActiveTaskPanel
            task={activeTask}
            otp={otp}
            onOtpChange={setOtp}
            actionLoading={actionLoading}
            onAdvance={handleUpdateStatus}
            onVerifyOtp={handleVerifyOtp}
            onOpenVitals={() => setShowVitalsModal(true)}
            onOpenLab={() => setShowLabModal(true)}
            // ActiveTaskPanel's handover branch only ever fires for these two
            // — doctor/pharmacy_delivery dispatch through this same tracker
            // but never hit that branch, so this narrows without changing
            // what actually renders.
            providerType={providerType as ActiveTaskProviderType}
          />
        )}

        {/* ─── PENDING TASKS (Accept/Reject) ─── */}
        {onDuty && pendingTasks.length > 0 && (
          <div className="cm-tracker__section">
            <h3 className="cm-tracker__section-title">
              <Icon as={ClipboardList} size={16} />
              Incoming requests ({pendingTasks.length})
            </h3>
            <TaskListPanel
              tasks={pendingTasks}
              actionLoading={actionLoading}
              onAccept={(id) => handleTaskAction(id, "accept")}
              onReject={(id) => handleTaskAction(id, "reject")}
            />
          </div>
        )}

        {/* ─── ON DUTY but no tasks ─── */}
        {onDuty && tasks.length === 0 && !activeTask && (
          <Panel>
            <EmptyState
              icon={Clock}
              title="Waiting for requests"
              body="You're live on the platform. New field requests will appear here automatically."
              action={<Pill tone="active">GPS active — visible to patients</Pill>}
            />
          </Panel>
        )}

        {/* ─── ALL TASKS MODAL ─── */}
        <Modal open={showAllTasks} onClose={() => setShowAllTasks(false)} title="All active tasks">
          {tasks.length === 0 ? (
            <p className="cm-alltasks__empty">No active tasks in your queue.</p>
          ) : (
            <div className="cm-tasklist">
              {tasks.map(task => (
                <Card
                  key={task.id}
                  className={task.id === activeTask?.id ? "cm-alltasks__item--current" : undefined}
                >
                  <div className="cm-alltasks__row">
                    <span className="cm-alltasks__type">
                      {serviceLabel(task.service_type)}
                    </span>
                    <StatusPill status={task.status} />
                  </div>
                  <p className="cm-alltasks__address">
                    <Icon as={MapPin} size={14} />
                    {task.patient_address}
                  </p>
                  <div className="cm-alltasks__row">
                    <span className="cm-alltasks__meta">Created: {new Date(task.created_at).toLocaleString()}</span>
                    <a
                      className="cm-alltasks__map"
                      href={`https://maps.google.com/?q=${task.patient_lat},${task.patient_lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Icon as={Navigation} size={14} />
                      Map
                    </a>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Modal>

        {/* ─── SELFIE VERIFICATION MODAL ─── */}
        <SelfieModal
          open={showSelfieModal}
          onClose={() => { setShowSelfieModal(false); setSelfieFile(null); }}
          file={selfieFile}
          onFileChange={setSelfieFile}
          verifying={verifyingSelfie}
          onSubmit={handleSelfieSubmit}
        />

        {/* ─── LAB HANDOVER MODAL (Phlebotomist) ─── */}
        <LabHandoverModal
          open={showLabModal}
          onClose={() => setShowLabModal(false)}
          labHubName={labHubName}
          barcodes={sampleBarcodes}
          notes={labNotes}
          onChange={handleLabFieldChange}
          onSubmit={handleLabHandoverSubmit}
          loading={actionLoading === "lab_handover"}
        />

        {/* ─── CLINICAL VITALS & NOTES MODAL (Nurse) ─── */}
        <VitalsModal
          open={showVitalsModal}
          onClose={() => setShowVitalsModal(false)}
          vitals={vitals}
          onChange={setVitals}
          notes={procedureNotes}
          onNotesChange={setProcedureNotes}
          onSubmit={handleClinicalNotesSubmit}
          loading={actionLoading === "clinical_notes"}
        />
      </div>
    </div>
  );
}
