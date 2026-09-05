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
import CollectionKitWidget from "./CollectionKitWidget";

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
  /** Scheduled slot start time (ISO), attached by _attach_slot_times on the backend */
  slot_start?: string;
  /** Raw slot_id (e.g. "|2026-08-06|15:00"), attached by _attach_slot_times */
  slot_id?: string;
  /** Present on home-collection runs; keys the collection-kit lookup. */
  booking_id?: string;
}

/** Format a slot_start ISO string into a compact human-readable form for the dashboard. */
function formatSlotTime(iso?: string): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (isToday) return `Today at ${time}`;
    const date = d.toLocaleDateString([], { month: "short", day: "numeric" });
    return `${date} at ${time}`;
  } catch {
    return null;
  }
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
}

export default function ProviderDispatchTracker({ title, providerType, embedded = false }: ProviderDispatchTrackerProps) {
  const router = useRouter();
  const [onDuty, setOnDuty] = useState(false);
  const [tasks, setTasks] = useState<DispatchTask[]>([]);
  // Separate state for pending offers (dispatch_offers, not yet accepted)
  const [offers, setOffers] = useState<any[]>([]);
  const [completedToday, setCompletedToday] = useState(0);
  // null = not known (the earnings call failed); never a fabricated figure.
  const [earnings, setEarnings] = useState<number | null>(null);
  const [earningsNote, setEarningsNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [dutyLoading, setDutyLoading] = useState(false);
  // Drives both the error banner and the "GPS live" pill: the pill used to be
  // driven by duty state alone, so it claimed a live fix directly above a
  // banner reporting a GPS failure.
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
  // Was hardcoded to a real competitor's brand name, which every collector
  // then submitted their run against. Resolved from /samples/my-lab below.
  const [labHubName, setLabHubName] = useState("");
  const [sampleBarcodes, setSampleBarcodes] = useState("");
  const [labNotes, setLabNotes] = useState("");

  // Nurse Clinical Vitals State
  const [showVitalsModal, setShowVitalsModal] = useState(false);
  const [vitals, setVitals] = useState<Vitals>({ bp: "120/80", pulse: "72", temp: "98.6", spo2: "99" });
  const [procedureNotes, setProcedureNotes] = useState("");

  const locationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const taskIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const prevOfferCountRef = useRef(0);

  // ─── Incoming-offer alert (browser notification + audio) ─────────────
  // The old design relied entirely on email, which phlebotomists don't
  // watch in real-time. This adds a push-alert the moment a dispatch offer
  // lands in their pending queue, so they never miss a request.
  const playOfferAlert = useCallback(() => {
    try {
      // Short high-pitched beep — works on mobile too
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880; // A5 — cuts through background noise
      osc.type = "sine";
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } catch { /* audio not available — silent fallback */ }
  }, []);

  useEffect(() => {
    if (prevOfferCountRef.current === 0 && offers.length > 0) {
      // New offer(s) arrived
      playOfferAlert();
      // Browser notification (permission requested on first duty toggle)
      if (Notification.permission === "granted") {
        const n = new Notification("New Dispatch Request", {
          body: offers.length === 1
            ? `${offers[0].distance_km?.toFixed(1) || "?"} km away — tap to respond`
            : `${offers.length} pending requests in your area`,
          icon: "/favicon.ico",
          tag: "dispatch-offer",
          requireInteraction: true,
        });
        n.onclick = () => {
          window.focus();
          n.close();
        };
      }
    }
    prevOfferCountRef.current = offers.length;
  }, [offers, playOfferAlert]);

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
        if (providerType === "phlebotomist") {
          setSalaried((data.data.phleb_type || "full_time") === "full_time");
        }
      } else {
        router.push("/auth/login");
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [router, providerType]);

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
        // Filter out stale tasks older than 24 hours that are stuck in any
        // pre-completion status ("provider_accepted", "en_route", "arrived",
        // "in_progress") — these were never completed or cancelled, likely
        // test data or orphans from the 18/07/2026 batch.
        const STALE_AGE_MS = 24 * 60 * 60 * 1000;
        const now = Date.now();
        const staleStatuses = new Set(["provider_accepted", "en_route", "arrived", "in_progress"]);
        const filtered = all.filter((t: DispatchTask) => {
          if (["completed", "cancelled"].includes(t.status)) return false;
          if (staleStatuses.has(t.status) && t.created_at) {
            const age = now - new Date(t.created_at).getTime();
            if (age > STALE_AGE_MS) return false; // older than 24h
          }
          return true;
        });
        setTasks(filtered);
        const done = all.filter((t: DispatchTask) => t.status === "completed");
        setCompletedToday(done.length);
        // Find current in-progress task (using filtered array so stale tasks are excluded)
        const active = filtered.find((t: DispatchTask) =>
          ["provider_accepted", "en_route", "arrived", "in_progress"].includes(t.status)
        );
        setActiveTask(active || null);
      }
    } catch (e) { console.error(e); }
  }, []);

  // ─── Real earnings ────────────────────────────────────────────────────
  // This used to be completedToday x a flat per-dashboard constant (640 for a
  // dietitian, 350 for a nurse...), presented to the provider as "Today's
  // earnings" in rupees. Payout is 80% of what the patient actually paid and
  // every service in scope_catalogs carries its own price, so the figure was
  // fiction that never errored. /payments/my-earnings is the server's own
  // computed payout; when it cannot be read the stat shows nothing rather
  // than a number nobody can stand behind.
  const fetchEarnings = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${apiBase}/api/payments/my-earnings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setEarnings(null); return; }
      const data = await res.json();
      const total = data?.earnings?.total_earned;
      setEarnings(typeof total === "number" ? total : null);
      const pending = data?.earnings?.pending_settlement;
      setEarningsNote(
        typeof pending === "number" && pending > 0
          ? `₹${pending.toLocaleString("en-IN")} awaiting settlement`
          : "settled to date"
      );
    } catch {
      setEarnings(null);
    }
  }, []);

  // The collector's real handover destination — the processing centre an
  // admin attached them to. Until this loaded, the modal defaulted to a
  // hardcoded competitor brand name that every run was then filed against.
  const [assignedCentre, setAssignedCentre] = useState<{
    name?: string; code?: string; city?: string; kind?: string;
  } | null>(null);
  // Salaried collectors accrue nothing per tube, so the earnings stat and the
  // /my-earnings call are both meaningless for them.
  const [salaried, setSalaried] = useState(false);

  const fetchAssignedCentre = useCallback(async () => {
    const token = getToken();
    if (!token || providerType !== "phlebotomist") return;
    try {
      const res = await fetch(`${apiBase}/api/samples/my-lab`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const name = data.processing_center_name || data.home_lab_name;
      if (name) {
        setAssignedCentre({
          name,
          code: data.processing_center_code,
          city: data.processing_center_city,
          kind: data.destination_kind,
        });
        setLabHubName(name);
      }
    } catch { /* the modal falls back to a typed name */ }
  }, [providerType]);

  const fetchOffers = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${apiBase}/api/dispatch/offers/pending`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setOffers(data.offers || []);
      }
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    fetchDutyStatus();
    fetchTasks();
    fetchOffers();
    fetchEarnings();
    fetchAssignedCentre();
    taskIntervalRef.current = setInterval(() => { fetchTasks(); fetchOffers(); }, 5000);
    return () => {
      if (taskIntervalRef.current) clearInterval(taskIntervalRef.current);
      if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
    };
  }, [fetchDutyStatus, fetchTasks, fetchOffers, fetchEarnings, fetchAssignedCentre]);

  // ─── GPS Location Broadcasting ────────────────────────────────────────
  // A single high-accuracy fix with an 8s deadline and no cache allowance is
  // the "GPS error" collectors kept hitting: indoors, on a cold start, or on
  // a laptop with no GPS radio at all, it times out every 30s forever and the
  // provider's coordinates are never sent. Now: try high accuracy briefly,
  // fall back to a coarse/cached fix, and say something actionable when the
  // fix genuinely cannot be had. Dispatch also falls back to the collector's
  // registered base location server-side, so a missing fix no longer makes
  // them invisible — but it does make them less accurately ranked, which is
  // what the banner says.
  const postLocation = useCallback(async (pos: GeolocationPosition) => {
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
    } catch { /* a dropped ping is retried on the next tick */ }
  }, [providerType]);

  const startLocationBroadcast = useCallback(() => {
    if (locationIntervalRef.current) return; // already broadcasting
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationError(
        "This device has no location service. Dispatch will rank you from your registered base address."
      );
      return;
    }

    const describe = (err: GeolocationPositionError) => {
      switch (err.code) {
        case err.PERMISSION_DENIED:
          return "Location permission is blocked. Enable it for this site in your browser settings, then toggle duty off and on.";
        case err.POSITION_UNAVAILABLE:
          return "No GPS fix right now — dispatch is using your registered base address. Step outside or enable Wi-Fi/mobile data for a precise fix.";
        default:
          return "GPS is taking too long to respond — dispatch is using your registered base address for now.";
      }
    };

    const sendLoc = () => {
      navigator.geolocation.getCurrentPosition(
        postLocation,
        () => {
          // Second chance without the high-accuracy demand, and accepting a
          // fix up to 5 minutes old — this is what actually succeeds indoors.
          navigator.geolocation.getCurrentPosition(
            postLocation,
            (err) => {
              setLocationError(describe(err));
              if (err.code === err.PERMISSION_DENIED && locationIntervalRef.current) {
                // Re-prompting every 30s cannot fix a denied permission; it
                // just burns battery and keeps the error flashing.
                clearInterval(locationIntervalRef.current);
                locationIntervalRef.current = null;
              }
            },
            { enableHighAccuracy: false, timeout: 20000, maximumAge: 300000 }
          );
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
      );
    };
    sendLoc(); // Send immediately
    locationIntervalRef.current = setInterval(sendLoc, 30000); // Every 30s
  }, [postLocation]);

  const stopLocationBroadcast = useCallback(() => {
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }
  }, []);

  // ─── Broadcast GPS whenever on duty ───────────────────────────────────
  // Starting the broadcast inside handleToggleDuty was the only trigger, so a
  // provider who was already on duty and simply reloaded the dashboard — or
  // navigated away and back — stopped sending their position entirely. Nothing
  // said so: fetchDutyStatus restored the toggle from the server, DutyBar kept
  // showing "GPS live", and dispatch went on ranking them from a frozen
  // location while the patient's tracking map watched a stationary dot.
  // Duty state is the single source of truth for this now.
  useEffect(() => {
    if (onDuty) startLocationBroadcast();
    else stopLocationBroadcast();
  }, [onDuty, startLocationBroadcast, stopLocationBroadcast]);

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
          // The effect above starts/stops the GPS broadcast off this state.
          // Request browser notification permission so offer alerts work
          if (typeof Notification !== "undefined" && Notification.permission === "default") {
            Notification.requestPermission();
          }
          setStatusMsg({ tone: "done", text: "You're now on duty — accepting dispatch requests" });
        } else {
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
  const handleTaskAction = async (taskId: string, action: "accept" | "reject", isOffer: boolean = false) => {
    setActionLoading(taskId + action);
    const token = getToken();
    try {
      // Offers use the respond endpoint; accepted dispatches use the legacy accept endpoint
      const url = isOffer
        ? `${apiBase}/api/dispatch/respond/${taskId}`
        : `${apiBase}/api/dispatch/${taskId}/${action}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: isOffer ? JSON.stringify({ accepted: action === "accept" }) : undefined,
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg(action === "accept"
          ? { tone: "done", text: "Task accepted! Head to the patient's location." }
          : { tone: "active", text: "Request declined." });
        fetchTasks();
        fetchOffers();
      } else {
        setStatusMsg({ tone: "urgent", text: data.detail || data.message || `Failed to ${action}` });
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
        if (newStatus === "completed") fetchEarnings();
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
    if (!labHubName.trim()) {
      setStatusMsg({ tone: "urgent", text: "No destination centre — contact your centre admin." });
      return;
    }
    // "BAR-DEFAULT-001" used to be substituted when this was left blank,
    // writing a barcode that matches no tube into a chain-of-custody record.
    if (!sampleBarcodes.trim()) {
      setStatusMsg({ tone: "urgent", text: "Enter the barcode of every tube you are handing over." });
      return;
    }
    setActionLoading("lab_handover");
    const token = getToken();
    try {
      // Move the tubes to in_transit so the centre sees the run coming. The
      // dispatch note below is the narrative record; this is the state change.
      const submit = await fetch(`${apiBase}/api/samples/submit-run`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ notes: labNotes }),
      });
      if (!submit.ok) {
        const err = await submit.json().catch(() => ({}));
        setStatusMsg({ tone: "urgent", text: err.detail || "Could not submit your tubes." });
        setActionLoading("");
        return;
      }

      const res = await fetch(`${apiBase}/api/dispatch/${activeTask.id}/lab-handover`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          hub_name: labHubName,
          sample_barcodes: sampleBarcodes,
          notes: labNotes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ tone: "done", text: `Samples submitted to ${labHubName}.` });
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

  // Pending offers from dispatch_offers (phlebotomist has not yet accepted)
  const pendingOffers = offers
    .sort((a, b) => (a.priority === "urgent" ? 0 : 1) - (b.priority === "urgent" ? 0 : 1));
  // Legacy pending tasks (from dispatch_requests with status "pending")
  const pendingTasks = tasks
    .filter(t => t.status === "pending")
    .sort((a, b) => (a.priority === "urgent" ? 0 : 1) - (b.priority === "urgent" ? 0 : 1));
  // Combined: show offers first, then legacy pending tasks
  const allPending = [...pendingOffers.map(o => {
    const rawNotes = (o as any).notes || "";
    const distStr = o.distance_km ? `${o.distance_km.toFixed(1)} km away` : "";
    let finalNotes = rawNotes;
    if (distStr) {
        finalNotes = finalNotes ? `${finalNotes} · ${distStr}` : distStr;
    }
    return {
      id: o.offer_id,
      patient_address: o.patient_address,
      patient_lat: 0, patient_lng: 0,
      status: "pending",
      service_type: o.service_subtype || o.provider_type || "",
      estimated_distance_km: o.distance_km || 0,
      created_at: o.expires_at || "",
      priority: o.priority || "normal",
      notes: finalNotes,
      _isOffer: true,
      _dispatch_request_id: o.dispatch_request_id,
    };
  }), ...pendingTasks];

  return (
    <div className={embedded ? undefined : "cm-tracker--standalone"}>
      <DutyBar
        title={embedded ? undefined : title}
        onDuty={onDuty}
        dutyLoading={dutyLoading || verifyingSelfie}
        gpsLive={onDuty && !locationError}
        activeCount={tasks.length}
        completedToday={completedToday}
        earnings={earnings}
        earningsNote={earningsNote}
        centreName={assignedCentre?.name}
        centreCode={assignedCentre?.code}
        salaried={salaried}
        onToggle={onToggleClick}
        onShowAllTasks={() => setShowAllTasks(true)}
      />

      <div className={embedded ? undefined : "cm-tracker__body"}>
        {/* What to physically carry, before anything else on the screen: the
            collector reads this while still at the centre. */}
        {/* Show the kit for the run in hand, or — when nothing is accepted yet
            — for the nearest pending offer, so the collector knows what the
            job needs BEFORE deciding to take it. */}
        {providerType === "phlebotomist" && (activeTask?.booking_id || offers[0]?.booking_id) && (
          <CollectionKitWidget
            bookingId={activeTask?.booking_id || offers[0].booking_id}
            serviceLabel={serviceLabel(
              activeTask?.service_type || offers[0]?.service_subtype,
            )}
          />
        )}

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
        {onDuty && allPending.length > 0 && (
          <div className="cm-tracker__section">
            <h3 className="cm-tracker__section-title cm-tracker__section-title--pulse">
              <Icon as={ClipboardList} size={16} />
              Incoming requests ({allPending.length})
            </h3>
            <TaskListPanel
              tasks={allPending}
              actionLoading={actionLoading}
              onAccept={(id) => {
                const item = allPending.find(t => t.id === id);
                if (item && (item as any)._isOffer) {
                  handleTaskAction(id, "accept", true);
                } else {
                  handleTaskAction(id, "accept");
                }
              }}
              onReject={(id) => {
                const item = allPending.find(t => t.id === id);
                if (item && (item as any)._isOffer) {
                  handleTaskAction(id, "reject", true);
                } else {
                  handleTaskAction(id, "reject");
                }
              }}
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
              {tasks.map(task => {
                const slotLabel = formatSlotTime(task.slot_start);
                return (
                  <Card
                    key={task.id}
                    interactive
                    className={task.id === activeTask?.id ? "cm-alltasks__item--current" : undefined}
                    onClick={() => {
                      setActiveTask(task);
                      setShowAllTasks(false);
                    }}
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
                    {slotLabel && (
                      <p className="cm-alltasks__slot">
                        <Icon as={Clock} size={14} />
                        {slotLabel}
                      </p>
                    )}
                    <div className="cm-alltasks__row">
                      <span className="cm-alltasks__meta">Created: {new Date(task.created_at).toLocaleString()}</span>
                      <a
                        className="cm-alltasks__map"
                        href={`https://maps.google.com/?q=${task.patient_lat},${task.patient_lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Icon as={Navigation} size={14} />
                        Map
                      </a>
                    </div>
                  </Card>
                );
              })}
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
          centreAssigned={!!assignedCentre?.name}
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
