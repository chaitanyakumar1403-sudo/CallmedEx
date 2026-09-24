"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { customConfirm } from "@/lib/customConfirm";
import PatientNavSidebar from "../components/PatientNavSidebar";
import PatientAIAdvisor from "../components/PatientAIAdvisor";
import InteractiveBodyMap from "@/app/components/InteractiveBodyMap";
import AIVoiceIntakeModal from "@/app/components/AIVoiceIntakeModal";
import DashboardShell from "../components/DashboardShell";
import { SampleTrackerModal } from "../components/SampleStatusRail";
import DrugShieldModal from "@/app/components/DrugShieldModal";
import DeleteAccountModal from "@/app/components/DeleteAccountModal";
import FamilyMembersPanel from "../components/FamilyMembersPanel";
import PatientAppointmentAlertWidget from "../components/PatientAppointmentAlertWidget";
import { bookingsAPI, dispatchAPI, patientSamplesAPI } from "@/lib/api";
import { FEATURE_FLAGS } from "@/config/featureFlags";
import { BiomarkerMatrix } from "../components/BiomarkerMatrix";
import { DoctorBriefingModal } from "../components/DoctorBriefingModal";
import { MedicineCabinetGrid } from "../components/MedicineCabinetGrid";
import { PhlebotomistRadar } from "../components/PhlebotomistRadar";
import { PATIENT_TRANSLATIONS, PatientLang } from "./patientTranslations";
import { useFamilyHubStore } from "@/store/useFamilyHubStore";
import { parseBookingNotes, bookingKindLabel, formatINR, formatSlot } from "@/lib/bookingDisplay.mjs";
import {
  Mic,
  Shield,
  FileText,
  Droplet,
  Stethoscope,
  HeartHandshake,
  Truck,
  Video,
  Apple,
  Building2,
  Sparkles,
  Navigation,
  Clock,
  Phone,
  CheckCircle2,
  XCircle,
  Activity,
  Calendar,
  Pill,
  BarChart3,
  Bell,
  RefreshCw,
  Bike,
  ShieldCheck,
  MapPin,
  MessageCircle,
  Star,
  AlertTriangle,
  X,
  Download,
  ArrowRight,
  ExternalLink,
  TestTube,
  FlaskConical,
  ChevronRight,
  Trash2,
} from "lucide-react";

interface UserData {
  full_name: string;
  role: string;
  email?: string;
  id?: string;
}

const todayInIST = () => {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().split("T")[0];
  }
};

/** A booking the patient can still expect a visit for: open, and not on a
 *  past date unless the visit is already under way. The "Upcoming" count and
 *  live tracking both use this, so tracking can never show for a booking the
 *  dashboard itself does not count. */
const isLiveBooking = (b: any, today: string) => {
  if (!["confirmed", "pending_review", "slot_allotted", "provider_accepted", "in_progress"].includes(b.status)) return false;
  if (b.scheduled_date && b.scheduled_date < today && !["provider_accepted", "in_progress"].includes(b.status)) return false;
  return true;
};

const TRACKABLE_DISPATCH = ["searching", "provider_notified", "provider_accepted", "en_route", "arrived", "in_progress"];

export default function PatientDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [lang, setLangState] = useState<PatientLang>('en');

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("callmedex_patient_lang");
      if (saved === "te" || saved === "hi" || saved === "en") {
        setLangState(saved);
      }
    }
  }, []);

  const setLang = (newLang: PatientLang) => {
    setLangState(newLang);
    if (typeof window !== "undefined") {
      localStorage.setItem("callmedex_patient_lang", newLang);
    }
  };
  const [bookings, setBookings] = useState<any[]>([]);

  // Single source of truth for reloading the booking list.
  //
  // This was open-coded at four call sites and three of them were wrong: two
  // read `bData.bookings` when the endpoint returns
  // `{success, data:{bookings}}` (so the list silently emptied after cancelling
  // a booking or a dispatch), and one hit `/api/bookings/my-bookings`, which is
  // not a route — the list never refreshed after responding to an allotted
  // slot. Keeping the fetch in one place is what stops that drifting again.
  const refreshBookings = async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) return;
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/bookings/my`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) setBookings(data.data?.bookings || []);
    } catch (e) {
      console.error(e);
    }
  };
  const [loading, setLoading] = useState(true);
  const [showAbhaModal, setShowAbhaModal] = useState(false);
  const [abhaTab, setAbhaTab] = useState<'link' | 'create'>('link');
  const [abhaInput, setAbhaInput] = useState('');
  const [aadhaarInput, setAadhaarInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [abhaStep, setAbhaStep] = useState(1); // 1 = enter aadhaar, 2 = enter otp
  const [abhaLinkedNumber, setAbhaLinkedNumber] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);

  // Live Tracking State
  const [activeDispatchId, setActiveDispatchId] = useState<string | null>(null);
  const [trackingData, setTrackingData] = useState<any>(null);
  const [requestingDispatch, setRequestingDispatch] = useState<string | null>(null);
  const [patientOtp, setPatientOtp] = useState<string | null>(null);
  const [showLiveTracker, setShowLiveTracker] = useState(false);
  const [simStage, setSimStage] = useState<"searching" | "en_route" | "arrived">("en_route");

  // KPI Interactive Modals
  const [activeKpiModal, setActiveKpiModal] = useState<'upcoming' | 'completed' | 'prescriptions' | 'records' | null>(null);
  const [recordsTab, setRecordsTab] = useState<"self" | "family">("self");
  const [selectedFamilyMemberId, setSelectedFamilyMemberId] = useState<string>("all");
  const familyState = useFamilyHubStore();

  // Industry-First Feature Modals
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [showDrugShieldModal, setShowDrugShieldModal] = useState(false);
  const [showBriefingModal, setShowBriefingModal] = useState(false);
  const [showSampleModal, setShowSampleModal] = useState(false);
  const [activeSampleCount, setActiveSampleCount] = useState<number>(0);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Quick Reorder State
  const [showReorderModal, setShowReorderModal] = useState(false);
  const [reorderBooking, setReorderBooking] = useState<any>(null);
  const [reorderLoading, setReorderLoading] = useState(false);

  // Dispatch Modal State
  const [showDispatchModal, setShowDispatchModal] = useState(false);

  const [dispatchProviderType, setDispatchProviderType] = useState("");
  const [dispatchServiceType, setDispatchServiceType] = useState("");
  const [dispatchSpecificReason, setDispatchSpecificReason] = useState<string[]>([]);
  const [dispatchOtherText, setDispatchOtherText] = useState("");
  const [dispatchLabel, setDispatchLabel] = useState("");

  const dispatchOptions: Record<string, string[]> = {
    phlebotomist: ["Blood Sample Collection", "Urine Sample Collection", "ECG", "Routine Health Checkup", "Other"],
    nurse: ["Injection", "Wound Dressing", "IV Fluid Administration", "Catheterization", "Other"],
    doctor: ["General Checkup", "High Fever", "Minor Injury", "Post-Op Consultation", "Other"],
    dietitian: ["Doorstep Nutritional Assessment", "Pantry Audit & Meal Plan", "Geriatric Bedside MNT", "BCA Body Composition", "Other"],
    physiotherapist: ["Bedside Joint Mobilization", "Post-Op Knee/Hip Rehab", "Stroke Neuro-Rehab", "Spine & Sciatica Therapy", "Chest Physiotherapy", "Other"],
    pharmacy_delivery: ["Prescription Medicines", "OTC Medicines", "First Aid Supplies", "Other"]
  };

  const t = PATIENT_TRANSLATIONS[lang] || PATIENT_TRANSLATIONS.en;

  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).__setShowLiveTracker = setShowLiveTracker;
      (window as any).__setSimStage = setSimStage;
    }
    const stored = localStorage.getItem("user");
    if (stored) {
      setUser(JSON.parse(stored));
    }

    // Fetch bookings
    const fetchBookings = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/bookings/my`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          setBookings(data.data.bookings || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    const fetchMe = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/auth/me`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success && data.data) {
          setProfile(data.data);
          if (data.data.full_name) {
            setUser({ full_name: data.data.full_name, role: data.data.role || "patient" });
            try {
              const stored = localStorage.getItem("user");
              const currentObj = stored ? JSON.parse(stored) : {};
              currentObj.full_name = data.data.full_name;
              currentObj.role = data.data.role || "patient";
              localStorage.setItem("user", JSON.stringify(currentObj));
            } catch {}
          }
          if (data.data?.abha_number) {
            setAbhaLinkedNumber(data.data.abha_number);
          }
        }
      } catch (e) {
        console.error(e);
      }
    };

    const fetchPatientUpgradeData = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const headers = { Authorization: `Bearer ${token}` };

      // 1. Fetch real Family Members
      try {
        const famRes = await fetch(`${apiBase}/api/family-members`, { headers });
        if (famRes.ok) {
          const famData = await famRes.json();
          const mappedMembers = (famData.members || []).map((m: any) => ({
            id: m.id,
            fullName: m.full_name,
            relationship: m.relationship || (m.is_self ? 'Self' : 'Family'),
            hasActiveAlert: false,
            alertCount: 0,
            healthStatus: 'optimal',
          }));
          const { familyHubStore } = await import('@/store/useFamilyHubStore');
          familyHubStore.setMembers(mappedMembers);
        }
      } catch (e) {
        console.error("Family members fetch error:", e);
      }

      // 2. Fetch real Biomarkers & Risk Score
      try {
        const bioRes = await fetch(`${apiBase}/api/v1/patient/biomarkers/matrix`, { headers });
        if (bioRes.ok) {
          const bioData = await bioRes.json();
          const { healthMatrixStore } = await import('@/store/useHealthMatrixStore');
          if (bioData.biomarkers) {
            const mappedPoints = bioData.biomarkers.map((b: any) => ({
              recordedAt: b.recorded_at ? b.recorded_at.split('T')[0] : '',
              observationCode: b.observation_code,
              observationName: b.observation_name,
              valueNumber: b.value_number,
              unit: b.unit,
            }));
            healthMatrixStore.setBiomarkers(mappedPoints);
            if (mappedPoints.length > 0 && !healthMatrixStore.getState().selectedCode) {
              healthMatrixStore.setSelectedCode(mappedPoints[0].observationCode);
            }
          }
          if (bioData.risk_compass) {
            healthMatrixStore.setRiskScore({
              totalReadings: bioData.risk_compass.total_readings,
              distinctBiomarkers: bioData.risk_compass.distinct_biomarkers,
              latestRecordedAt: bioData.risk_compass.latest_recorded_at,
              trends: (bioData.risk_compass.trends || []).map((t: any) => ({
                observationCode: t.observation_code,
                observationName: t.observation_name,
                latestValue: t.latest_value,
                unit: t.unit,
                direction: t.direction,
              })),
              summaryText: bioData.risk_compass.summary_text,
            });
          }
        }
      } catch (e) {
        console.error("Biomarkers fetch error:", e);
      }

      // 3. Fetch real Medications
      try {
        const medRes = await fetch(`${apiBase}/api/v1/patient/medications`, { headers });
        if (medRes.ok) {
          const medData = await medRes.json();
          if (medData.medications) {
            const mappedMeds = medData.medications.map((m: any) => ({
              id: m.id,
              medicineName: m.medicine_name,
              dosage: m.dosage,
              totalPills: m.total_pills,
              remainingPills: m.remaining_pills,
              pillsPerDay: m.pills_per_day,
              refillDate: m.refill_date,
              daysLeft: m.days_left,
              needsRefill: m.needs_refill,
              outOfStock: m.out_of_stock,
              // Dropping these made every card fall back to "N pill/day"
              // even for a twice-daily schedule.
              reminderFrequency: m.reminder_frequency,
              reminderTimes: m.reminder_times,
            }));
            const { familyHubStore } = await import('@/store/useFamilyHubStore');
            familyHubStore.setMedications(mappedMeds);
          }
        }
      } catch (e) {
        console.error("Medications fetch error:", e);
      }

      // 4. Fetch real Emergency Contacts
      try {
        const sosRes = await fetch(`${apiBase}/api/v1/patient/sos/contacts`, { headers });
        if (sosRes.ok) {
          const sosData = await sosRes.json();
          if (sosData.contacts) {
            const mappedContacts = sosData.contacts.map((c: any) => ({
              id: c.id,
              contactName: c.contact_name,
              phone: c.phone,
              relationship: c.relationship,
              isActive: c.is_active,
            }));
            const { familyHubStore } = await import('@/store/useFamilyHubStore');
            familyHubStore.setEmergencyContacts(mappedContacts);
          }
        }
      } catch (e) {
        console.error("Emergency contacts fetch error:", e);
      }
    };

    const fetchSampleCount = async () => {
      try {
        const data = await patientSamplesAPI.getMySamples();
        const active = (data.samples || []).filter((s: any) =>
          s.is_active === true &&
          !["cancelled", "completed", "delivered", "failed", "rejected"].includes(s.status) &&
          !s.report_url
        );
        setActiveSampleCount(active.length);
      } catch {
        setActiveSampleCount(0);
      }
    };

    // Fetch all in parallel
    Promise.all([fetchBookings(), fetchMe(), fetchPatientUpgradeData(), fetchSampleCount()]);
  }, []);

  // Discover the dispatch_id for a scheduled (slot-booked) appointment once
  // the backend's Celery task creates it. On-demand dispatches already know
  // their dispatch_id at creation time (localStorage, set below) — a
  // scheduled booking's dispatch_requests row appears later, asynchronously,
  // with nothing to tell this tab it now exists.
  useEffect(() => {
    if (activeDispatchId) return;
    // Home COLLECTION was the only kind looked for, so a home VISIT — a
    // physiotherapist, dietitian, nurse or doctor coming to the patient — was
    // never discovered here. Its dispatch_id reached this page only via the
    // localStorage entry the booking page writes, so booking on a phone and
    // opening the dashboard on a laptop (or clearing site data, or booking
    // over WhatsApp) left the patient with no tracking card and, worse, no
    // arrival OTP — and the provider cannot start a visit without that OTP.
    //
    // Statuses past "confirmed" are included for the same reason: once the
    // provider accepts, the booking moves to provider_accepted/in_progress,
    // and a reload at that point must still find the visit in flight.
    const today = todayInIST();
    const candidates = bookings.filter(
      (b) =>
        ["confirmed", "provider_accepted", "in_progress"].includes(b.status) &&
        isLiveBooking(b, today) &&
        (b.booking_kind === "home_collection" ||
          b.consultation_mode === "home_visit")
    );
    if (candidates.length === 0) return;

    const token = localStorage.getItem("token");
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

    const discover = async () => {
      for (const b of candidates) {
        try {
          const res = await fetch(`${apiBase}/api/dispatch/for-booking/${b.id}`, {
            headers: { "Authorization": `Bearer ${token}` }
          });
          const data = await res.json();
          if (data.success && data.dispatch_id) {
            localStorage.setItem("activeDispatchId", data.dispatch_id);
            setActiveDispatchId(data.dispatch_id);
            return;
          }
        } catch (e) {
          console.error("Dispatch discovery error", e);
        }
      }
    };

    discover();
    const interval = setInterval(discover, 15000);
    return () => clearInterval(interval);
  }, [bookings, activeDispatchId]);

  // Poll for live tracking if active dispatch exists
  useEffect(() => {
    // If we just loaded, try fetching from localStorage first
    if (!activeDispatchId) {
      const stored = localStorage.getItem("activeDispatchId");
      if (stored) {
        setActiveDispatchId(stored);
      }
      return;
    }

    const fetchTracking = async () => {
      const token = localStorage.getItem("token");
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/dispatch/track/${activeDispatchId}`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.status === 403 || res.status === 404) {
          // Not this account's dispatch (another login on this browser left
          // its id in localStorage) or it no longer exists. Stop polling it.
          localStorage.removeItem("activeDispatchId");
          setActiveDispatchId(null);
          setTrackingData(null);
          return;
        }
        const data = await res.json();
        setTrackingData(data);

        // If arrived, fetch OTP so patient can tell the provider
        if (data.status === "arrived") {
          const otpRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/dispatch/${activeDispatchId}/patient-otp`, {
            headers: { "Authorization": `Bearer ${token}` }
          });
          const otpData = await otpRes.json();
          if (otpData.success && otpData.otp) {
            setPatientOtp(otpData.otp);
          }
        } else {
          setPatientOtp(null);
        }

        // Clear tracking immediately if the dispatch is completed, cancelled, or missing
        if (data.status === "completed" || data.status === "cancelled" || data.status === "no_provider" || data.status === "not_found") {
          localStorage.removeItem("activeDispatchId");
          setActiveDispatchId(null);
          setTrackingData(null);
        }
      } catch (e) {
        console.error("Tracking error", e);
      }
    };

    fetchTracking();
    // Poll only when tab is visible to save battery/bandwidth
    const interval = setInterval(() => {
      if (document.visibilityState !== "hidden") fetchTracking();
    }, 5000);
    return () => clearInterval(interval);
  }, [activeDispatchId]);

  const openDispatchModal = (providerType: string, serviceType: string, label: string) => {
    setDispatchProviderType(providerType);
    setDispatchServiceType(serviceType);
    setDispatchLabel(label);
    setDispatchSpecificReason([]);
    setShowDispatchModal(true);
  };

  const confirmDispatchRequest = () => {
    setShowDispatchModal(false);
    setRequestingDispatch(dispatchProviderType);

    const executeDispatch = async (lat: number, lng: number, address: string) => {
      const token = localStorage.getItem("token");
      try {
        const now = new Date();
        const yyyymmdd = now.toISOString().split("T")[0];
        const hhmm = now.toTimeString().split(" ")[0].substring(0, 5); // local time HH:MM
        const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

        let createdBookingId = null;
        try {
          const bookingRes = await fetch(`${apiBase}/api/bookings`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({
              provider_id: "on_demand",
              provider_type: dispatchProviderType,
              service_type: dispatchServiceType,
              slot_id: `on_demand|${yyyymmdd}|${hhmm}`,
              notes: `Urgent ${dispatchLabel} Request: ${dispatchSpecificReason.join(", ")}${dispatchOtherText ? ' - ' + dispatchOtherText : ''}`,
              priority: "urgent",
              total_price: 0
            })
          });
          if (bookingRes.ok) {
            const bData = await bookingRes.json();
            createdBookingId = bData.data?.id;
          }
        } catch (e) {
          console.warn("Failed to log booking, proceeding with dispatch", e);
        }

        const res = await fetch(`${apiBase}/api/dispatch/request`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            // These entry points are presented to the patient as "Urgent"; the
            // request must actually carry that priority or the label is a lie.
            priority: "urgent",
            patient_lat: lat,
            patient_lng: lng,
            patient_address: address,
            provider_type: dispatchProviderType,
            service_subtype: dispatchServiceType,
            notes: `Urgent ${dispatchLabel} Request: ${dispatchSpecificReason.join(", ")}${dispatchOtherText ? '\nDetails: ' + dispatchOtherText : ''}`,
            booking_id: createdBookingId
          })
        });

        if (res.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          toast("Your login session has expired. Please log in again to continue.");
          window.location.href = "/auth/login";
          return;
        }

        const data = await res.json();
        if (res.ok && data.dispatch_id) {
          localStorage.setItem("activeDispatchId", data.dispatch_id);
          setActiveDispatchId(data.dispatch_id);
          // Tracking renders only against a booking in the list, so pull the
          // booking this request just created.
          refreshBookings();
          toast(data.message || "Dispatch request created! Searching for nearby providers.");
        } else {
          if (data.detail === "Invalid or expired token") {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            toast("Your login session has expired. Please log in again to continue.");
            window.location.href = "/auth/login";
            return;
          }
          toast(data.detail || data.message || "Failed to request dispatch.");
        }
      } catch (e: any) {
        console.error("Dispatch request network error:", e);
        toast(e?.message === "Failed to fetch" ? "Unable to connect to CallMedex server (http://localhost:8000). Please check your backend connection." : (e?.message || "Failed to request dispatch."));
      } finally {
        setRequestingDispatch(null);
      }
    };

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => executeDispatch(pos.coords.latitude, pos.coords.longitude, "Current GPS Location"),
        (err) => {
          console.warn("Geolocation fallback activated:", err.message);
          executeDispatch(17.7231, 83.3013, "Visakhapatnam (Default)");
        },
        { enableHighAccuracy: false, timeout: 4000 }
      );
    } else {
      executeDispatch(17.7231, 83.3013, "Visakhapatnam (Default)");
    }
  };

  const handleLinkAbha = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/auth/link-abha`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ abha_number: abhaInput })
    });
    const data = await res.json();
    if (data.success) {
      setAbhaLinkedNumber(data.data.abha_number);
      setShowAbhaModal(false);
    }
  };

  const handleCreateAbha = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/auth/create-abha`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ aadhaar_number: aadhaarInput, otp: otpInput })
    });
    const data = await res.json();
    if (data.success) {
      setAbhaLinkedNumber(data.data.abha_number);
      setShowAbhaModal(false);
    }
  };

  const handleCancelRequest = async (dispatchId: string | undefined, currentStatus: string) => {
    if (!dispatchId) {
      toast("Unable to cancel: Missing dispatch ID. Please contact support.");
      return;
    }
    let msg = "Are you sure you want to cancel this request?";
    if (currentStatus === "provider_accepted" || currentStatus === "en_route" || currentStatus === "confirmed") {
      msg = "Are you sure? If the provider is already on the way or it has been more than 5 minutes since acceptance, a cancellation fee may apply.";
    }
    if (!await customConfirm(msg)) return;

    try {
      const res = await dispatchAPI.cancelDispatch(dispatchId);
      // Immediately purge tracking state and local storage
      localStorage.removeItem("activeDispatchId");
      setActiveDispatchId(null);
      setTrackingData(null);

      if (res.success || res.message?.includes("cancelled")) {
        toast(res.message || "Request cancelled successfully.");
        await refreshBookings();
      } else {
        toast(res.message || "Failed to cancel");
      }
    } catch (e: any) {
      localStorage.removeItem("activeDispatchId");
      setActiveDispatchId(null);
      setTrackingData(null);
      toast(e.message || "Request cancelled.");
    }
  };

  const handleCancelBooking = async (bookingId: string, currentStatus: string) => {
    let msg = "Are you sure you want to cancel this booking?";
    if (currentStatus === "provider_accepted" || currentStatus === "en_route" || currentStatus === "confirmed") {
      msg = "Are you sure? If the provider is already on the way or it has been more than 5 minutes since acceptance, a cancellation fee may apply.";
    }
    if (!await customConfirm(msg)) return;

    try {
      const res = await bookingsAPI.cancelBooking(bookingId);
      if (res.success) {
        toast(res.message);
        await refreshBookings();
      } else {
        toast(res.message || "Failed to cancel booking");
      }
    } catch (e: any) {
      toast(e.message || "Failed to cancel booking");
    }
  };

  const handleQuickReorder = (booking: any) => {
    setReorderBooking(booking);
    setShowReorderModal(true);
  };

  const confirmQuickReorder = async () => {
    if (!reorderBooking) return;
    setReorderLoading(true);
    const token = localStorage.getItem("token");
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const now = new Date();
    const yyyymmdd = now.toISOString().split("T")[0];
    const hhmm = now.toTimeString().split(" ")[0].substring(0, 5);

    try {
      const res = await fetch(`${apiBase}/api/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          provider_id: reorderBooking.provider_id || "on_demand",
          provider_type: reorderBooking.provider_type || "phlebotomist",
          service_type: reorderBooking.service_type || "lab_test",
          slot_id: `reorder|${yyyymmdd}|${hhmm}`,
          notes: `Quick Re-Order of ${reorderBooking.notes || reorderBooking.service_type}`,
          total_price: reorderBooking.total_price || 0
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast("Quick Re-Order placed successfully! Check active dispatches & bookings.");
        setShowReorderModal(false);
        await refreshBookings();
      } else {
        toast(data.detail || data.message || "Failed to re-order");
      }
    } catch (e) {
      toast("Network error processing re-order.");
    } finally {
      setReorderLoading(false);
    }
  };

  const name = user?.full_name || "Patient";

  // Calculate India Standard Time (Asia/Kolkata) date string YYYY-MM-DD
  const getTodayIST = () => {
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
    } catch {
      return new Date().toISOString().split("T")[0];
    }
  };
  const todayIST = getTodayIST();

  // Forensically exclude stale bookings that passed their scheduled date without being serviced
  const upcomingBookings = bookings.filter(b => isLiveBooking(b, todayIST));
  const upcomingCount = upcomingBookings.length;

  // Live tracking shows only for a dispatch that belongs to one of the
  // patient's own open bookings. It used to render for any dispatch id found
  // in localStorage whose row was still "active" — including dispatches left
  // behind by cancelled or expired bookings — so a patient with nothing booked
  // watched a collector approach.
  const liveBookingIds = new Set(upcomingBookings.map((b) => b.id));
  const trackingLive = Boolean(
    activeDispatchId && trackingData
    && TRACKABLE_DISPATCH.includes(trackingData.status)
    && trackingData.booking_id && liveBookingIds.has(trackingData.booking_id)
  );
  // Pre-assigned to a collector for a scheduled slot, not yet travelling.
  const trackingScheduled = trackingLive
    && trackingData.assignment_mode === "advance" && trackingData.status === "provider_accepted";
  const completedBookings = bookings.filter(b => b.status === "completed");
  const completedCount = completedBookings.length;
  const prescriptionsCount = familyState.medications?.length || 0;
  // A record is a visit or test that finished or has a report. Every lab
  // booking used to count, so cancelled tests showed up as "4 reports".
  const conductedRecords = bookings.filter(b => b.status === "completed" || Boolean(b.report_url));
  const recordsCount = conductedRecords.length;
  const allottedBookings = bookings.filter(b => b.status === "slot_allotted");

  // Respond to an allotted slot
  const handleRespondSlot = async (bookingId: string, accepted: boolean, reason?: string) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/bookings/${bookingId}/respond-slot`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ accepted, reason: reason || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        toast(data.message);
        await refreshBookings();
      } else {
        toast(data.detail || "Failed to respond");
      }
    } catch (e) {
      toast("Network error");
    }
  };

  // Filter out any active dispatch/home visits for Swiggy-style tracking
  const activeDispatches = bookings.filter(b =>
    b.status === "confirmed" &&
    (b.service_type === "home_collection" || (b.notes && b.notes.includes("Home Visit")))
  );

  const triggerEmergencySOS = async () => {
    if (!await customConfirm(t.emergencyConfirm)) return;
    try {
      let lat = 12.9716;
      let lng = 77.5946;
      let address = "Emergency Patient Location";
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          if (!navigator.geolocation) return reject(new Error("no geo"));
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000, maximumAge: 60000 });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
        address = `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
      } catch {}
      const res = await dispatchAPI.triggerEmergencySOS({ lat, lng, address, note: "Patient 1-Tap SOS Beacon" });
      if (res.data?.success || res.status === 200) {
        toast.error("EMERGENCY BEACON BROADCAST: All nearby responders notified.");
      } else {
        toast.error("Emergency alert triggered. Please call 108/112 immediately.");
      }
    } catch {
      toast.error("Emergency alert triggered. Please call 108/112.");
    }
  };

  return (
    // lang drives the :lang(te) rule that switches to Noto Sans Telugu and its
    // looser leading. Without it the selector changed strings but left Telugu
    // rendering in a Latin face that has no Telugu glyphs.
    <div lang={lang}>
    <DashboardShell
      role="patient"
      title={`${t.welcome}, ${name}`}
      subtitle={t.greeting}
      tabs={[]}
      activeTab=""
      onTabChange={() => {}}
      aside={
        <>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as any)}
            aria-label="Language"
            style={{
              padding: "8px 14px", borderRadius: 999, cursor: "pointer",
              border: "1px solid rgba(255,255,255,0.35)",
              background: "rgba(255,255,255,0.12)", color: "#fff",
              fontWeight: 600, fontSize: "0.85rem",
            }}
          >
            <option value="en" style={{ color: "#0f172a" }}>English</option>
            <option value="te" style={{ color: "#0f172a" }}>తెలుగు</option>
            <option value="hi" style={{ color: "#0f172a" }}>हिंदी</option>
          </select>
          <a
            href="/booking"
            style={{
              padding: "10px 18px", borderRadius: 999, textDecoration: "none",
              background: "#fff", color: "var(--cm-accent)", fontWeight: 800,
              fontSize: "0.85rem",
            }}
          >
            {t.bookTest}
          </a>
          <button
            type="button"
            onClick={triggerEmergencySOS}
            style={{
              padding: "10px 18px", borderRadius: 999, border: "none",
              background: "var(--cm-urgent)", color: "#ffffff", fontWeight: 800,
              fontSize: "0.85rem", cursor: "pointer", display: "inline-flex",
              alignItems: "center", gap: 6,
              boxShadow: "0 2px 10px rgba(220, 38, 38, 0.35)",
            }}
          >
            <AlertTriangle size={15} /> Emergency SOS
          </button>
        </>
      }
    >

      {/* ── Two-Column Layout: Left Sticky Navigation + Main Dashboard Content ── */}
      <div className="cm-patient-layout">
        <aside className="cm-patient-sidebar">
          <PatientNavSidebar />
        </aside>

        <main className="cm-patient-content">
          {/* Modern KPI Stats — Top of Dashboard */}
          {/* Modern KPI Stats — Top of Dashboard */}
          <div className="cm-kpi-grid">
            <div
              className="cm-kpi-card"
              onClick={() => setActiveKpiModal("upcoming")}
              style={{ cursor: "pointer" }}
              role="button"
              tabIndex={0}
              title="Click to view upcoming appointments"
            >
              <div className="cm-kpi-card__accent" />
              <div>
                <div className="cm-kpi-card__label">{t.kpi.upcoming}</div>
                <div className="cm-kpi-card__value">{upcomingCount}</div>
                <div className="cm-kpi-card__subtitle">{t.kpi.upcomingSub}</div>
              </div>
              <div className="cm-kpi-card__icon cm-icon3d" aria-hidden>
                <Calendar size={20} />
              </div>
            </div>

            <div
              className="cm-kpi-card"
              onClick={() => setActiveKpiModal("completed")}
              style={{ cursor: "pointer" }}
              role="button"
              tabIndex={0}
              title="Click to view completed services & history"
            >
              <div className="cm-kpi-card__accent" />
              <div>
                <div className="cm-kpi-card__label">{t.kpi.completed}</div>
                <div className="cm-kpi-card__value">{completedCount}</div>
                <div className="cm-kpi-card__subtitle">{t.kpi.completedSub}</div>
              </div>
              <div className="cm-kpi-card__icon cm-icon3d" aria-hidden>
                <CheckCircle2 size={20} />
              </div>
            </div>

            <div
              className="cm-kpi-card"
              onClick={() => setActiveKpiModal("prescriptions")}
              style={{ cursor: "pointer" }}
              role="button"
              tabIndex={0}
              title="Click to view active prescriptions & refills"
            >
              <div className="cm-kpi-card__accent" />
              <div>
                <div className="cm-kpi-card__label">{t.kpi.prescriptions}</div>
                <div className="cm-kpi-card__value">{prescriptionsCount}</div>
                <div className="cm-kpi-card__subtitle">{t.kpi.prescriptionsSub}</div>
              </div>
              <div className="cm-kpi-card__icon cm-icon3d" aria-hidden>
                <Pill size={20} />
              </div>
            </div>

            <div
              className="cm-kpi-card"
              onClick={() => setActiveKpiModal("records")}
              style={{ cursor: "pointer" }}
              role="button"
              tabIndex={0}
              title="Click to view health records & vitals"
            >
              <div className="cm-kpi-card__accent" />
              <div>
                <div className="cm-kpi-card__label">{t.kpi.records}</div>
                <div className="cm-kpi-card__value">{recordsCount}</div>
                <div className="cm-kpi-card__subtitle">{t.kpi.recordsSub}</div>
              </div>
              <div className="cm-kpi-card__icon cm-icon3d" aria-hidden>
                <FileText size={20} />
              </div>
            </div>
          </div>

          {/* KPI detail sheet — same light surface as the rest of the dashboard */}
          {activeKpiModal && (() => {
            const KPI_HEAD = {
              upcoming: { icon: <Calendar size={20} />, title: "Upcoming appointments", sub: upcomingCount === 0 ? "Nothing scheduled" : `${upcomingCount} scheduled` },
              completed: { icon: <CheckCircle2 size={20} />, title: "Completed visits", sub: completedCount === 0 ? "None yet" : `${completedCount} completed` },
              prescriptions: { icon: <Pill size={20} />, title: "Your medicines", sub: prescriptionsCount === 0 ? "None added" : `${prescriptionsCount} being tracked` },
              records: { icon: <FileText size={20} />, title: "Health records", sub: recordsCount === 0 ? "No reports yet" : `${recordsCount} on file` },
            } as const;
            const head = KPI_HEAD[activeKpiModal];
            const STATUS_TEXT: Record<string, [string, string]> = {
              confirmed: ["Confirmed", "done"],
              slot_allotted: ["New time proposed", "waiting"],
              pending_review: ["Awaiting confirmation", "active"],
              provider_accepted: ["Provider assigned", "active"],
              in_progress: ["In progress", "active"],
              completed: ["Completed", "done"],
              cancelled: ["Cancelled", "halted"],
            };
            const statusPill = (s: string) => {
              const [label, tone] = STATUS_TEXT[s] || [String(s || "").replace(/_/g, " "), "active"];
              return <span className={`cm-pill cm-pill--${tone}`}>{label}</span>;
            };
            const whenOf = (b: any) =>
              formatSlot(b.slot_start) || b.booking_date || b.scheduled_date || "";
            const titleOf = (b: any) =>
              b.service_title || b.test_names || b.package_name || parseBookingNotes(b.notes, b.service_type).title;
            const closeTo = (id: string) => {
              setActiveKpiModal(null);
              setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
            };

            return (
              <div className="cm-overlay" onClick={() => setActiveKpiModal(null)} style={{ zIndex: 99999 }}>
                <div
                  className="cm-modal cm-modal--wide cm-kpim"
                  onClick={(e) => e.stopPropagation()}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="kpim-title"
                >
                  <div className="cm-modal__head">
                    <span className="cm-kpim__icon cm-icon3d" aria-hidden>{head.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 className="cm-modal__title" id="kpim-title">{head.title}</h3>
                      <div className="cm-kpim__sub">{head.sub}</div>
                    </div>
                    <button type="button" className="cm-modal__x" onClick={() => setActiveKpiModal(null)} aria-label="Close">
                      <X size={20} />
                    </button>
                  </div>

                  <div className="cm-modal__body cm-kpim__body">
                    {/* Upcoming */}
                    {activeKpiModal === "upcoming" && (upcomingBookings.length > 0 ? (
                      <ul className="cm-kpim__list">
                        {upcomingBookings.map((b) => (
                          <li key={b.id} className="cm-kpim-row">
                            <div className="cm-kpim-row__main">
                              <div className="cm-kpim-row__kind">{bookingKindLabel(b.service_type)}</div>
                              <div className="cm-kpim-row__title">{titleOf(b)}</div>
                              <div className="cm-kpim-row__meta">
                                {[whenOf(b), b.provider_name || b.doctor_name].filter(Boolean).join(" · ")}
                              </div>
                            </div>
                            <div className="cm-kpim-row__side">
                              {statusPill(b.status)}
                              {b.status === "slot_allotted" && (
                                <div className="cm-kpim-row__actions">
                                  <button type="button" className="cm-btn cm-btn--primary cm-btn--sm" onClick={() => handleRespondSlot(b.id, true)}>
                                    Accept time
                                  </button>
                                  <button type="button" className="cm-btn cm-btn--secondary cm-btn--sm" onClick={() => handleRespondSlot(b.id, false, "Reschedule requested by patient")}>
                                    Ask for another
                                  </button>
                                </div>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="cm-empty">
                        <span className="cm-empty__icon"><Calendar size={26} /></span>
                        <p className="cm-empty__title">No upcoming appointments</p>
                        <p className="cm-empty__body">Book a doctor, a lab test or a home visit and it will show up here.</p>
                        <a href="/booking" className="cm-btn cm-btn--primary cm-btn--sm cm-empty__action">Book a service</a>
                      </div>
                    ))}

                    {/* Completed */}
                    {activeKpiModal === "completed" && (completedBookings.length > 0 ? (
                      <ul className="cm-kpim__list">
                        {completedBookings.map((b) => (
                          <li key={b.id} className="cm-kpim-row">
                            <div className="cm-kpim-row__main">
                              <div className="cm-kpim-row__kind">{bookingKindLabel(b.service_type)}</div>
                              <div className="cm-kpim-row__title">{titleOf(b)}</div>
                              <div className="cm-kpim-row__meta">
                                {[
                                  b.completed_at
                                    ? new Date(b.completed_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                                    : whenOf(b),
                                  b.provider_name,
                                ].filter(Boolean).join(" · ")}
                              </div>
                            </div>
                            <div className="cm-kpim-row__actions">
                              {b.report_url ? (
                                <a href={b.report_url} target="_blank" rel="noopener noreferrer" className="cm-btn cm-btn--secondary cm-btn--sm">
                                  <Download size={14} /> Report
                                </a>
                              ) : (
                                <a href="/dashboard/patient/reports" className="cm-btn cm-btn--secondary cm-btn--sm">
                                  <FileText size={14} /> Reports
                                </a>
                              )}
                              <button type="button" className="cm-btn cm-btn--ghost cm-btn--sm" onClick={() => { setActiveKpiModal(null); setReorderBooking(b); setShowReorderModal(true); }}>
                                <RefreshCw size={14} /> Book again
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="cm-empty">
                        <span className="cm-empty__icon"><CheckCircle2 size={26} /></span>
                        <p className="cm-empty__title">No completed visits yet</p>
                        <p className="cm-empty__body">Finished consultations, tests and home visits will be listed here with their reports.</p>
                      </div>
                    ))}

                    {/* Medicines */}
                    {activeKpiModal === "prescriptions" && (familyState.medications?.length > 0 ? (
                      <>
                        <ul className="cm-kpim__list">
                          {familyState.medications.map((m) => (
                            <li key={m.id} className="cm-kpim-row">
                              <div className="cm-kpim-row__main">
                                <div className="cm-kpim-row__title">{m.medicineName}</div>
                                <div className="cm-kpim-row__meta">
                                  {[m.dosage, `${m.remainingPills} of ${m.totalPills} left`,
                                    m.daysLeft != null ? `${m.daysLeft} day${m.daysLeft === 1 ? "" : "s"} of supply` : ""]
                                    .filter(Boolean).join(" · ")}
                                </div>
                              </div>
                              <div className="cm-kpim-row__side">
                                {(m.needsRefill || m.outOfStock) && (
                                  <span className={`cm-pill ${m.outOfStock ? "cm-pill--urgent" : "cm-pill--waiting"}`}>
                                    {m.outOfStock ? "Supply finished" : "Refill soon"}
                                  </span>
                                )}
                                <a href="/dashboard/patient/pharmacy" className="cm-btn cm-btn--secondary cm-btn--sm">
                                  <Pill size={14} /> Order refill
                                </a>
                              </div>
                            </li>
                          ))}
                        </ul>
                        <div className="cm-kpim__foot">
                          <button type="button" className="cm-btn cm-btn--ghost cm-btn--sm" onClick={() => closeTo("medicine-cabinet")}>
                            Edit or remove medicines <ArrowRight size={14} />
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="cm-empty">
                        <span className="cm-empty__icon"><Pill size={26} /></span>
                        <p className="cm-empty__title">No medicines added</p>
                        <p className="cm-empty__body">Add what you take to get dose reminders and a heads-up before you run out.</p>
                        <div className="cm-empty__action" style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                          <button type="button" className="cm-btn cm-btn--primary cm-btn--sm" onClick={() => closeTo("medicine-cabinet")}>
                            Add a medicine
                          </button>
                          <button type="button" className="cm-btn cm-btn--secondary cm-btn--sm" onClick={() => { setActiveKpiModal(null); setShowDrugShieldModal(true); }}>
                            Check a medicine
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Records */}
                    {activeKpiModal === "records" && (() => {
                      const selfRecords = conductedRecords.filter(b => b.is_self !== false && !b.family_member_id);
                      const familyRecords = conductedRecords.filter(b => b.is_self === false || Boolean(b.family_member_id));
                      const displayed = recordsTab === "self"
                        ? selfRecords
                        : (selectedFamilyMemberId === "all" ? familyRecords : familyRecords.filter(b => b.family_member_id === selectedFamilyMemberId));
                      const ready = displayed.filter(b => b.report_url).length;

                      return (
                        <>
                          <div className="cm-kpim__toolbar">
                            <div className="cm-seg" role="tablist" aria-label="Whose records">
                              <button type="button" role="tab" aria-selected={recordsTab === "self"} className={`cm-seg__opt${recordsTab === "self" ? " is-on" : ""}`} onClick={() => setRecordsTab("self")}>
                                Mine ({selfRecords.length})
                              </button>
                              <button type="button" role="tab" aria-selected={recordsTab === "family"} className={`cm-seg__opt${recordsTab === "family" ? " is-on" : ""}`} onClick={() => setRecordsTab("family")}>
                                Family ({familyRecords.length})
                              </button>
                            </div>
                            {recordsTab === "family" && familyState.members.length > 0 && (
                              <select className="cm-kpim__select" value={selectedFamilyMemberId} onChange={(e) => setSelectedFamilyMemberId(e.target.value)} aria-label="Family member">
                                <option value="all">Everyone</option>
                                {familyState.members.map((m: any) => (
                                  <option key={m.id} value={m.id}>{m.fullName} ({m.relationship})</option>
                                ))}
                              </select>
                            )}
                          </div>

                          <div className="cm-kpim__stats">
                            <div>
                              <span>Visits &amp; tests</span>
                              <strong>{displayed.length}</strong>
                            </div>
                            <div>
                              <span>Reports ready</span>
                              <strong>{ready}</strong>
                            </div>
                            <div>
                              <span>ABHA</span>
                              {abhaLinkedNumber ? (
                                <strong className="cm-kpim__ok"><CheckCircle2 size={15} /> Linked</strong>
                              ) : (
                                <button type="button" className="cm-kpim__link" onClick={() => { setActiveKpiModal(null); setShowAbhaModal(true); }}>
                                  Not linked · Link now
                                </button>
                              )}
                            </div>
                          </div>

                          {displayed.length > 0 ? (
                            <ul className="cm-kpim__list">
                              {displayed.map((rec) => (
                                <li key={rec.id} className="cm-kpim-row">
                                  <div className="cm-kpim-row__main">
                                    <div className="cm-kpim-row__kind">
                                      {bookingKindLabel(rec.service_type)}
                                      {rec.subject_name && !rec.is_self && <> · {rec.subject_name}</>}
                                    </div>
                                    <div className="cm-kpim-row__title">{titleOf(rec)}</div>
                                    <div className="cm-kpim-row__meta">
                                      {[rec.hospital_name, whenOf(rec) || (rec.created_at ? new Date(rec.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "")].filter(Boolean).join(" · ")}
                                    </div>
                                  </div>
                                  <div className="cm-kpim-row__side">
                                    {rec.report_url
                                      ? <span className="cm-pill cm-pill--done">Report ready</span>
                                      : statusPill(rec.status)}
                                    <div className="cm-kpim-row__actions">
                                      {rec.report_url ? (
                                        <a href={rec.report_url} target="_blank" rel="noopener noreferrer" className="cm-btn cm-btn--secondary cm-btn--sm">
                                          <Download size={14} /> Report
                                        </a>
                                      ) : (
                                        <a href="/dashboard/patient/reports" className="cm-btn cm-btn--secondary cm-btn--sm">
                                          <FileText size={14} /> View
                                        </a>
                                      )}
                                      <button type="button" className="cm-btn cm-btn--ghost cm-btn--sm" onClick={() => { setActiveKpiModal(null); setReorderBooking(rec); setShowReorderModal(true); }}>
                                        <RefreshCw size={14} /> Book again
                                      </button>
                                    </div>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="cm-empty">
                              <span className="cm-empty__icon"><FileText size={26} /></span>
                              <p className="cm-empty__title">{recordsTab === "self" ? "No reports yet" : "No family reports yet"}</p>
                              <p className="cm-empty__body">Reports from tests and visits booked on CallMedex will be kept here.</p>
                              <a href="/booking" className="cm-btn cm-btn--primary cm-btn--sm cm-empty__action">
                                <FlaskConical size={14} /> Book a test
                              </a>
                            </div>
                          )}

                          <div className="cm-kpim__foot">
                            <a href="/dashboard/patient/reports" className="cm-btn cm-btn--ghost cm-btn--sm">
                              All reports <ArrowRight size={14} />
                            </a>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Interactive 2-Step Sample Tracker Modal */}
          <SampleTrackerModal
            isOpen={showSampleModal}
            onClose={() => setShowSampleModal(false)}
            lang={lang}
          />

          {/* Phlebotomist Cold-Chain Radar */}
          {FEATURE_FLAGS.ENABLE_PHLEBO_RADAR && trackingLive
            && (trackingData.provider_type || "phlebotomist") === "phlebotomist" && (
            <PhlebotomistRadar
              status={trackingData.status}
              phleboName={trackingData.provider?.name}
              etaMinutes={trackingData.provider?.eta_minutes}
              distanceKm={trackingData.provider?.distance_km}
              speedKmh={trackingData.provider?.speed_kmh}
              candidates={trackingData.searching_candidates || []}
              locationSource={trackingData.provider?.location_source}
              otpPin={patientOtp ?? undefined}
              scheduled={trackingScheduled ? {
                date: trackingData.scheduled_for,
                time: trackingData.slot_time,
              } : undefined}
            />
          )}

          {/* ── AI Preventive Care Advisor (OpenRouter AI) ────── */}
          <PatientAIAdvisor />

          {/* ── Body Explorer → My Medicines → Biomarker Matrix ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 24 }}>
            <InteractiveBodyMap />
            {FEATURE_FLAGS.ENABLE_SMART_MEDICINE_CABINET && (
              <div id="medicine-cabinet">
                <MedicineCabinetGrid lang={lang} />
              </div>
            )}
            {FEATURE_FLAGS.ENABLE_PREVENTIVE_BIOMARKERS && (
              <div id="biomarkers">
                <BiomarkerMatrix lang={lang} />
              </div>
            )}
          </div>

        {/* Doctor Briefing Modal */}
        {FEATURE_FLAGS.ENABLE_DOCTOR_BRIEFING && (
          <DoctorBriefingModal isOpen={showBriefingModal} onClose={() => setShowBriefingModal(false)} />
        )}

        {/* ─── CALLMEDEX ON-DEMAND LIVE PHLEBOTOMIST DISPATCH & ORDER TRACKER ─── */}
        {/* Real dispatch always renders. The simulated run renders only in a
            demo build — otherwise a patient with no collection booked could
            open a tracker showing a phlebotomist who does not exist. */}
        {/* A pre-assigned collector who has not set off yet has no route or
            ETA to show — the radar card above carries the scheduled visit. */}
        {((trackingLive && !trackingScheduled)
          || (FEATURE_FLAGS.ENABLE_DEMO_DISPATCH_TRACKER && showLiveTracker)) && (() => {
          const isReal = !!(activeDispatchId && trackingData);
          const currentStatus = isReal ? trackingData.status : simStage;
          const isSearching = currentStatus === "searching" || currentStatus === "provider_notified";
          const isEnRoute = currentStatus === "provider_accepted" || currentStatus === "en_route" || currentStatus === "in_progress";
          const isArrived = currentStatus === "arrived";

          const provider = isReal && trackingData.provider ? trackingData.provider : {
            name: "Ramesh Kumar",
            mobile: "+91 98490 23145",
            distance_km: 1.8,
            eta_minutes: 12,
            vehicle: "Hero Splendor Plus · Temperature Carrier Box",
            rating: "4.9",
            collections: "1,240+",
            nabl_verified: true,
          };

          const otp = isReal ? patientOtp : "4829";

          // Every string in this card used to say "phlebotomist". The card now
          // also carries physiotherapy, dietetics, nursing and home-visit
          // doctor dispatches, so a physiotherapy patient was being told we
          // were "broadcasting to nearby certified phlebotomists" and shown
          // NABL cold-chain badges for a session with no sample in it.
          const PROVIDER_LABEL: Record<string, string> = {
            phlebotomist: "Certified Phlebotomists",
            nurse: "Home Nurses",
            doctor: "Home-Visit Doctors",
            dietitian: "Dietitians",
            physiotherapist: "Physiotherapists",
            ambulance: "Ambulances",
            pharmacy_delivery: "Delivery Partners",
          };
          const providerType = isReal ? (trackingData.provider_type || "phlebotomist") : "phlebotomist";
          const providerLabel = PROVIDER_LABEL[providerType] || "Providers";
          const isCollection = providerType === "phlebotomist";

          return (
            <div id="sample-tracking" className="cm-rapido-panel" style={{ animation: "fadeIn 0.4s ease-out" }}>
              {/* Header */}
              <div className="cm-rapido-panel__header">
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="cm-pulse-indicator">
                      <span className="cm-pulse-ring" />
                      <span className="cm-pulse-dot" />
                    </span>
                    <h3 style={{ margin: 0, fontSize: "1.02rem", fontWeight: 800, color: "var(--cm-ink)", display: "flex", alignItems: "center", gap: 6 }}>
                      <Bike size={18} style={{ color: "var(--cm-active)" }} />
                      {t.rapido.title}
                    </h3>
                    {!isReal && (
                      <span style={{ fontSize: "0.65rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", background: "var(--cm-warn-surface, #FBF0DC)", color: "var(--cm-warn, #8A5606)", border: "1px solid var(--cm-warn-line, #E4C88C)", padding: "2px 6px", borderRadius: 4 }}>
                        {t.rapido.sampleData}
                      </span>
                    )}
                  </div>
                  <p style={{ margin: "2px 0 0 0", fontSize: "0.78rem", color: "var(--cm-ink-3)" }}>
                    {isSearching
                      ? t.rapido.searchingSubtitle
                      : isArrived
                      ? t.rapido.arrivedSubtitle
                      : t.rapido.enRouteSubtitle}
                  </p>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {/* Status Badge */}
                  <span className={`cm-rapido-badge ${
                    isSearching ? "cm-rapido-badge--searching" : isArrived ? "cm-rapido-badge--arrived" : "cm-rapido-badge--enroute"
                  }`}>
                    {isSearching ? t.rapido.broadcastingBadge : isArrived ? t.rapido.arrivedBadge : t.rapido.enRouteBadge}
                  </span>

                  {/* Demo Stage Switcher */}
                  {!isReal && (
                    <div style={{ display: "flex", background: "var(--cm-surface-2)", borderRadius: 9999, padding: 2, border: "1px solid var(--cm-line)" }}>
                      <button
                        type="button"
                        onClick={() => setSimStage("searching")}
                        style={{
                          padding: "3px 8px", borderRadius: 9999, border: "none",
                          fontSize: "0.68rem", fontWeight: 700, cursor: "pointer",
                          background: simStage === "searching" ? "var(--cm-waiting)" : "transparent",
                          color: simStage === "searching" ? "#fff" : "var(--cm-ink-3)"
                        }}
                      >
                        Search
                      </button>
                      <button
                        type="button"
                        onClick={() => setSimStage("en_route")}
                        style={{
                          padding: "3px 8px", borderRadius: 9999, border: "none",
                          fontSize: "0.68rem", fontWeight: 700, cursor: "pointer",
                          background: simStage === "en_route" ? "var(--cm-active)" : "transparent",
                          color: simStage === "en_route" ? "#fff" : "var(--cm-ink-3)"
                        }}
                      >
                        En Route
                      </button>
                      <button
                        type="button"
                        onClick={() => setSimStage("arrived")}
                        style={{
                          padding: "3px 8px", borderRadius: 9999, border: "none",
                          fontSize: "0.68rem", fontWeight: 700, cursor: "pointer",
                          background: simStage === "arrived" ? "var(--cm-done)" : "transparent",
                          color: simStage === "arrived" ? "#fff" : "var(--cm-ink-3)"
                        }}
                      >
                        Arrived & OTP
                      </button>
                    </div>
                  )}

                  {/* Close / Cancel Button */}
                  {isReal ? (
                    <button
                      type="button"
                      onClick={() => handleCancelRequest(activeDispatchId || trackingData?.dispatch_id, trackingData?.status)}
                      style={{
                        background: "none", border: "none", color: "var(--cm-urgent)", fontWeight: 700,
                        fontSize: "0.8rem", cursor: "pointer", textDecoration: "underline"
                      }}
                    >
                      Cancel Request
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowLiveTracker(false)}
                      style={{
                        background: "var(--cm-surface-2)", border: "1px solid var(--cm-line)",
                        borderRadius: "var(--cm-radius)", padding: "3px 8px", fontSize: "0.74rem",
                        color: "var(--cm-ink-2)", fontWeight: 700, cursor: "pointer"
                      }}
                    >
                      Close Tracker
                    </button>
                  )}
                </div>
              </div>

              {/* 5-Step Progress Stepper */}
              <div className="cm-rapido-stepper">
                <div className="cm-rapido-step cm-rapido-step--completed">
                  <div className="cm-rapido-step__bar" />
                  <div className="cm-rapido-step__label">{t.rapido.steps.confirmed}</div>
                </div>
                <div className={`cm-rapido-step ${isSearching ? "cm-rapido-step--current" : "cm-rapido-step--completed"}`}>
                  <div className="cm-rapido-step__bar" />
                  <div className="cm-rapido-step__label">{t.rapido.steps.search}</div>
                </div>
                <div className={`cm-rapido-step ${isEnRoute ? "cm-rapido-step--current" : isArrived ? "cm-rapido-step--completed" : ""}`}>
                  <div className="cm-rapido-step__bar" />
                  <div className="cm-rapido-step__label">{t.rapido.steps.enRoute}</div>
                </div>
                <div className={`cm-rapido-step ${isArrived ? "cm-rapido-step--current" : ""}`}>
                  <div className="cm-rapido-step__bar" />
                  <div className="cm-rapido-step__label">{t.rapido.steps.arrived}</div>
                </div>
                <div className="cm-rapido-step">
                  <div className="cm-rapido-step__bar" />
                  <div className="cm-rapido-step__label">{t.rapido.steps.inLab}</div>
                </div>
              </div>

              {/* VIEW 1: Searching for Phlebotomist */}
              {isSearching && (
                <div className="cm-rapido-radar-box">
                  <div className="cm-rapido-radar-anim">
                    <div className="cm-rapido-radar-wave" />
                    <div className="cm-rapido-radar-ring" />
                    <Bike size={24} />
                  </div>
                  <h4 style={{ margin: "0 0 4px 0", fontSize: "0.95rem", fontWeight: 800, color: "var(--cm-ink)" }}>
                    Broadcasting to nearby {providerLabel}...
                  </h4>
                  <p style={{ margin: "0 0 12px 0", fontSize: "0.8rem", color: "var(--cm-ink-3)", maxWidth: 460 }}>
                    We are contacting verified providers near your location. You
                    will see their name and live ETA here as soon as one accepts.
                  </p>
                  <div style={{ display: isCollection ? "flex" : "none", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                    <span style={{ fontSize: "0.72rem", background: "var(--cm-surface)", border: "1px solid var(--cm-line)", padding: "3px 10px", borderRadius: 9999, color: "var(--cm-ink-2)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <CheckCircle2 size={12} style={{ color: "var(--cm-done)" }} /> {t.rapido.vaccinated}
                    </span>
                    <span style={{ fontSize: "0.72rem", background: "var(--cm-surface)", border: "1px solid var(--cm-line)", padding: "3px 10px", borderRadius: 9999, color: "var(--cm-ink-2)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <CheckCircle2 size={12} style={{ color: "var(--cm-done)" }} /> {t.rapido.sterileKits}
                    </span>
                    <span style={{ fontSize: "0.72rem", background: "var(--cm-surface)", border: "1px solid var(--cm-line)", padding: "3px 10px", borderRadius: 9999, color: "var(--cm-ink-2)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <CheckCircle2 size={12} style={{ color: "var(--cm-done)" }} /> {t.rapido.tempBox}
                    </span>
                  </div>
                </div>
              )}

              {/* VIEW 2 & 3: Phlebotomist Assigned / En Route / Arrived */}
              {!isSearching && (
                <div>
                  {/* Captain Card */}
                  <div className="cm-rapido-captain">
                    <div className="cm-rapido-captain__profile">
                      <div className="cm-rapido-captain__avatar">
                        {provider.profile_photo_url || provider.photo_url ? (
                          <img
                            src={provider.profile_photo_url || provider.photo_url}
                            alt={provider.name}
                            className="cm-rapido-captain__avatar-img"
                          />
                        ) : (
                          provider.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)
                        )}
                        <span className="cm-rapido-captain__online-badge" />
                      </div>
                      <div>
                        <div className="cm-rapido-captain__name">
                          {provider.name}
                          {provider.rating && (
                            <span className="cm-rapido-captain__rating">
                              <Star size={11} fill="currentColor" /> {provider.rating}
                            </span>
                          )}
                          {provider.nabl_verified && (
                            <span style={{ fontSize: "0.68rem", background: "var(--cm-done-surface)", color: "var(--cm-done)", border: "1px solid var(--cm-done-line)", padding: "1px 6px", borderRadius: 9999, fontWeight: 700 }}>
                              <ShieldCheck size={10} style={{ display: "inline", marginRight: 3 }} /> NABL Verified
                            </span>
                          )}
                        </div>
                        {(provider.vehicle || provider.collections) && (
                          <div className="cm-rapido-captain__vehicle">
                            <Bike size={13} style={{ color: "var(--cm-active)" }} />
                            {provider.vehicle}
                            {provider.vehicle && provider.collections ? " · " : ""}
                            {provider.collections ? `${provider.collections} collections` : ""}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Distance & Contact Actions */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "1.05rem", fontWeight: 800, color: isArrived ? "var(--cm-done)" : "var(--cm-ink)" }}>
                          {isArrived ? t.rapido.atDoorstep : t.rapido.minsAway(provider.eta_minutes || 12)}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--cm-ink-3)" }}>
                          {isArrived ? "Ring Bell / Meet Provider" : t.rapido.kmAway(provider.distance_km || 1.8)}
                        </div>
                      </div>

                      <div className="cm-rapido-captain__actions">
                        <a
                          href={`tel:${provider.mobile || "+919849023145"}`}
                          className="cm-btn cm-btn--primary cm-btn--sm"
                          style={{ display: "inline-flex", alignItems: "center", gap: 5, fontWeight: 700, textDecoration: "none", padding: "5px 10px", fontSize: "0.75rem" }}
                        >
                          <Phone size={13} /> {t.rapido.callPhlebo}
                        </a>
                        <a
                          href={`https://wa.me/${(provider.mobile || "919849023145").replace(/[^0-9]/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="cm-btn cm-btn--secondary cm-btn--sm"
                          style={{ display: "inline-flex", alignItems: "center", gap: 5, fontWeight: 700, textDecoration: "none", padding: "5px 10px", fontSize: "0.75rem" }}
                        >
                          <MessageCircle size={13} /> {t.rapido.whatsapp}
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* High-Contrast Doorstep OTP Card (Shown when Arrived or Previewing) - Medium Proportions */}
                  {(isArrived || simStage === "arrived") && (
                    <div className="cm-rapido-otp-card">
                      <div>
                        <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.75)", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: 700 }}>
                          Doorstep Sample Verification
                        </div>
                        <h4 style={{ margin: "1px 0 4px 0", fontSize: "0.98rem", color: "#fff", fontWeight: 800 }}>
                          {t.rapido.otpTitle}
                        </h4>
                        <p style={{ margin: 0, fontSize: "0.78rem", color: "rgba(255,255,255,0.85)", maxWidth: 440, lineHeight: 1.4 }}>
                          {t.rapido.otpDesc}
                        </p>
                      </div>

                      <div style={{ textAlign: "center" }}>
                        <div className="cm-rapido-otp-code">
                          {otp}
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "#38bdf8", marginTop: 3, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <CheckCircle2 size={11} style={{ color: "#38bdf8" }} /> {t.rapido.sterileSeal}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* Slot Allotment Notifications */}
        {allottedBookings.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ marginBottom: 12, fontFamily: "var(--font-body)", fontSize: "1.05rem", display: "flex", alignItems: "center", gap: 8, color: "var(--cm-ink)" }}>
              <Bell size={18} style={{ color: "var(--cm-waiting)" }} />
              {t.allottedSlots.title}
              <span style={{ backgroundColor: "var(--cm-waiting-surface)", color: "var(--cm-waiting)", border: "1px solid var(--cm-waiting-line)", borderRadius: 20, padding: "2px 10px", fontSize: "0.72rem", fontWeight: 700 }}>
                {t.allottedSlots.pendingCount(allottedBookings.length)}
              </span>
            </h3>
            {allottedBookings.map((b: any) => {
              const slotStart = new Date(b.slot_start);
              const slotEnd = new Date(b.slot_end);
              return (
                <div key={b.id} className="card" style={{
                  padding: "16px 24px", marginBottom: 10, border: "1px solid var(--cm-waiting-line)",
                  background: "var(--cm-waiting-surface)", borderRadius: "var(--cm-radius)"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 800, color: "var(--cm-waiting)", fontSize: "0.95rem", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                        <Clock size={16} /> {t.allottedSlots.timeAllotted}
                      </div>
                      <div style={{ fontSize: "0.88rem", color: "var(--cm-ink)", marginBottom: 4 }}>
                        <strong>{slotStart.toLocaleDateString()}</strong> • {slotStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {slotEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div style={{ fontSize: "0.82rem", color: "var(--cm-ink-3)" }}>{parseBookingNotes(b.notes, b.service_type).title}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => handleRespondSlot(b.id, true)}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          padding: "8px 18px", borderRadius: 8, border: "none",
                          backgroundColor: "var(--cm-done)", color: "white", fontWeight: 700,
                          fontSize: "0.85rem", cursor: "pointer",
                        }}
                      >
                        <CheckCircle2 size={16} /> {t.allottedSlots.accept}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const reason = prompt("Reason for declining (optional):");
                          handleRespondSlot(b.id, false, reason || undefined);
                        }}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          padding: "8px 18px", borderRadius: 8, border: "1px solid var(--cm-urgent-line)",
                          backgroundColor: "var(--cm-surface)", color: "var(--cm-urgent)", fontWeight: 700,
                          fontSize: "0.85rem", cursor: "pointer",
                        }}
                      >
                        <XCircle size={16} /> {t.allottedSlots.decline}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}




        {/* Family Members */}
        <div id="family-circle">
          <FamilyMembersPanel />
        </div>

        {/* Today's & Upcoming Appointment Glassmorphic Alert Widget */}
        <PatientAppointmentAlertWidget bookings={bookings} onRefresh={refreshBookings} lang={lang} />

        {/* Recent Bookings */}
        <section id="recent-bookings" className="cm-pbk" aria-labelledby="pbk-title">
          <div className="cm-pbk__head">
            <h3 className="cm-pbk__title" id="pbk-title">{t.bookings.title}</h3>
            {bookings?.length > 0 && (
              <a href="/dashboard/patient/bookings" className="cm-pbk__all">
                {t.bookings.viewAllHistory} <ChevronRight size={15} />
              </a>
            )}
          </div>
        <div className="cm-pbk__list">
          {loading ? (
            <div className="cm-pbk-card cm-pbk-card--muted">{t.bookings.loading}</div>
          ) : bookings?.length > 0 ? (
            bookings.map((booking: any) => {
              const isPastSlot = booking.slot_start && (new Date(booking.slot_start).getTime() < (Date.now() - 3600000));
              const shown = parseBookingNotes(booking.notes, booking.service_type);
              const isAutoExpired = booking.status === "cancelled" && (shown.autoExpired || booking.notes?.includes("Automatically cancelled"));
              const isDoctorSvc = booking.service_type === "doctor_appointment" || booking.service_type === "video_consult" || booking.service_type === "consultation" || booking.provider_type === "doctor";
              const statusTone = isAutoExpired ? "halted"
                : booking.status === "cancelled" || booking.status === "slot_rejected" ? "urgent"
                : booking.status === "pending_review" ? "active"
                  : booking.status === "slot_allotted" ? "waiting"
                    : "done";
              const kindTone = booking.service_type === "lab_test" ? "lab" : booking.service_type === "video_consult" ? "video" : "visit";
              const isClosed = isAutoExpired || booking.status === "cancelled" || booking.status === "completed" || booking.status === "slot_rejected";

              return (
              <article key={booking.id} className="cm-pbk-card">
                <div className="cm-pbk-card__main">
                  <div className={`cm-pbk-card__icon cm-pbk-card__icon--${kindTone}`}>
                    {booking.service_type === "lab_test" ? <Activity size={20} /> : booking.service_type === "video_consult" ? <Video size={20} /> : <Stethoscope size={20} />}
                  </div>
                  <div className="cm-pbk-card__text">
                    <div className="cm-pbk-card__kind">{bookingKindLabel(booking.service_type)}</div>
                    <div className="cm-pbk-card__name">{shown.title}</div>
                    <div className="cm-pbk-card__meta">
                      {[formatSlot(booking.slot_start), shown.total != null ? formatINR(shown.total) : ""].filter(Boolean).join(" · ")}
                    </div>
                    {shown.statusNote && <div className="cm-pbk-card__note">{shown.statusNote}</div>}
                  </div>
                </div>
                <div className="cm-pbk-card__side">
                  <span className={`cm-pbk-status cm-pbk-status--${statusTone}`}>
                    {isAutoExpired ? <><XCircle size={13} /> Expired</>
                      : booking.status === "pending_review" ? <><Clock size={13} /> Pending Review</>
                      : booking.status === "slot_allotted" ? <><Bell size={13} /> Slot Allotted</>
                        : booking.status === "slot_rejected" ? <><XCircle size={13} /> Slot Declined</>
                          : booking.status === "cancelled" ? <><XCircle size={13} /> Cancelled</>
                            : <><CheckCircle2 size={13} /> {booking.status.replace(/_/g, ' ')}</>}
                  </span>
                  <div className="cm-pbk-card__actions">
                    {isDoctorSvc && booking.status === "confirmed" && !isPastSlot && (
                      <button
                        type="button"
                        onClick={() => {
                          const docName = booking.notes?.match(/Doctor:\s*([^·\n]+)/i)?.[1]?.trim() || "Doctor";
                          router.push(`/consultation/${booking.provider_id || "doc"}?booking_id=${booking.id}&name=${encodeURIComponent(docName)}`);
                        }}
                        className="cm-pbk-btn cm-pbk-btn--primary"
                      >
                        <Video size={14} /> Join Consult
                      </button>
                    )}
                    {(booking.service_type === "lab_test" || booking.service_type === "home_collection") && !isClosed && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowLiveTracker(true);
                          window.scrollTo({ top: 320, behavior: "smooth" });
                        }}
                        className="cm-pbk-btn"
                      >
                        <Bike size={14} /> {t.bookings.trackPhlebo}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleQuickReorder(booking)}
                      className="cm-pbk-btn"
                    >
                      <RefreshCw size={14} /> {t.bookings.quickReorder}
                    </button>
                    {!isPastSlot && !isAutoExpired && booking.status !== "arrived" && booking.status !== "in_progress" && booking.status !== "completed" && booking.status !== "cancelled" && booking.status !== "slot_allotted" && (
                      <button
                        type="button"
                        onClick={() => handleCancelBooking(booking.id, booking.status)}
                        className="cm-pbk-btn cm-pbk-btn--quiet"
                      >
                        {t.bookings.cancel}
                      </button>
                    )}
                  </div>
                </div>
              </article>
              );
            })
          ) : (
            <div className="cm-pbk-card cm-pbk-card--empty">
              <p>{t.bookings.noBookings}</p>
              <a href="/booking" className="cm-pbk-btn cm-pbk-btn--primary">{t.bookings.bookFirst}</a>
            </div>
          )}
        </div>
      </section>

        {/* Health Records Placeholder */}
        <div className="card" style={{ marginTop: 32, padding: 32, textAlign: "center", border: abhaLinkedNumber ? "2px solid var(--cm-done-line)" : "2px dashed var(--cm-line)", backgroundColor: abhaLinkedNumber ? "var(--cm-done-surface)" : "var(--cm-surface)" }}>
          <div style={{ display: "inline-flex", padding: 12, borderRadius: "50%", background: "var(--cm-surface-3)", color: "var(--cm-navy)", marginBottom: 8 }}>
            <ShieldCheck size={30} />
          </div>
          <h3 style={{ fontFamily: "var(--font-body)", fontSize: "1.1rem", marginBottom: 8, color: "var(--cm-ink)" }}>{t.abha.title}</h3>
          {abhaLinkedNumber ? (
            <div>
              <p style={{ color: "var(--cm-done)", fontSize: "1rem", fontWeight: "bold", margin: "16px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <CheckCircle2 size={16} /> {t.abha.linked} <span style={{ letterSpacing: 1.5 }}>{abhaLinkedNumber}</span>
              </p>
              <p style={{ color: "var(--cm-ink-3)", fontSize: "0.9rem", maxWidth: 400, margin: "0 auto 16px" }}>
                {t.abha.synced}
              </p>
            </div>
          ) : (
            <div>
              <p style={{ color: "var(--color-gray-500)", fontSize: "0.9rem", maxWidth: 400, margin: "0 auto 16px" }}>
                {t.abha.notLinkedDesc}
              </p>
              <button className="btn btn-teal" onClick={() => setShowAbhaModal(true)}>{t.abha.manageBtn}</button>
            </div>
          )}
        </div>

        {/* Account & Privacy Settings / Danger Zone */}
        <section id="account-settings" className="cm-pacct" aria-labelledby="pacct-title">
          <div className="cm-pacct__row">
            <div className="cm-pacct__lead">
              <div className="cm-pacct__icon">
                <ShieldCheck size={22} />
              </div>
              <div>
                <h3 className="cm-pacct__title" id="pacct-title">Account &amp; privacy</h3>
                <p className="cm-pacct__desc">
                  Close your CallMedex account and permanently erase your data.
                </p>
              </div>
            </div>
            <button type="button" onClick={() => setIsDeleteModalOpen(true)} className="cm-pacct__delete">
              <Trash2 size={15} /> Delete Account
            </button>
          </div>
          {(profile?.email || user?.email) && (
            <div className="cm-pacct__foot">
              <span>Signed in as <strong>{profile?.email || user?.email}</strong></span>
            </div>
          )}
        </section>

        </main>
      </div>
    </DashboardShell>

      {showAbhaModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card" style={{ padding: 32, maxWidth: 400, width: "100%" }}>
            <h2 style={{ marginBottom: 24, fontSize: "1.25rem", fontFamily: "var(--font-body)" }}>Manage ABHA</h2>

            <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
              <button className={`btn ${abhaTab === 'link' ? 'btn-primary' : 'btn-outline'}`} style={{ flex: 1 }} onClick={() => setAbhaTab('link')}>Link Existing</button>
              <button className={`btn ${abhaTab === 'create' ? 'btn-primary' : 'btn-outline'}`} style={{ flex: 1 }} onClick={() => { setAbhaTab('create'); setAbhaStep(1); }}>Create New</button>
            </div>

            {abhaTab === 'link' && (
              <div>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>Enter 14-digit ABHA Number</label>
                <input type="text" className="input" placeholder="e.g. 12-3456-7890-1234" value={abhaInput} onChange={(e) => setAbhaInput(e.target.value)} style={{ width: "100%", marginBottom: 24 }} />
                <button className="btn btn-teal" style={{ width: "100%" }} onClick={handleLinkAbha}>Link Account</button>
              </div>
            )}

            {abhaTab === 'create' && (
              <div>
                {abhaStep === 1 ? (
                  <div>
                    <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>Enter Aadhaar Number</label>
                    <input type="text" className="input" placeholder="12-digit Aadhaar" value={aadhaarInput} onChange={(e) => setAadhaarInput(e.target.value)} style={{ width: "100%", marginBottom: 24 }} />
                    <button className="btn btn-teal" style={{ width: "100%" }} onClick={() => setAbhaStep(2)}>Send OTP</button>
                  </div>
                ) : (
                  <div>
                    <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>Enter OTP Sent to Mobile</label>
                    <input type="text" className="input" placeholder="6-digit OTP" value={otpInput} onChange={(e) => setOtpInput(e.target.value)} style={{ width: "100%", marginBottom: 24 }} />
                    <button className="btn btn-teal" style={{ width: "100%" }} onClick={handleCreateAbha}>Verify & Create</button>
                  </div>
                )}
              </div>
            )}

            <button className="btn btn-outline" style={{ width: "100%", marginTop: 12 }} onClick={() => setShowAbhaModal(false)}>Cancel</button>
          </div>
        </div>
      )}
      {/* Dispatch Reason Modal */}
      {showDispatchModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn 0.2s" }}>
          <div style={{ backgroundColor: "white", padding: "32px", borderRadius: "16px", width: "90%", maxWidth: "450px", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ margin: 0, fontSize: "1.25rem", color: "#1f2937" }}>Select Service Needed</h2>
              <button onClick={() => setShowDispatchModal(false)} style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "#9ca3af" }}>&times;</button>
            </div>

            <p style={{ color: "#4b5563", fontSize: "0.95rem", marginBottom: "20px" }}>
              Please specify the exact requirement so we can match you with the right provider.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
              {(dispatchOptions[dispatchProviderType] || ["Other"]).map((opt) => (
                <label key={opt} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px", borderRadius: "8px", border: dispatchSpecificReason.includes(opt) ? "2px solid #3182ce" : "1px solid #e5e7eb", backgroundColor: dispatchSpecificReason.includes(opt) ? "#ebf8ff" : "white", cursor: "pointer", transition: "all 0.2s" }}>
                  <input
                    type="checkbox"
                    name="dispatchReason"
                    value={opt}
                    checked={dispatchSpecificReason.includes(opt)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setDispatchSpecificReason([...dispatchSpecificReason, opt]);
                      } else {
                        setDispatchSpecificReason(dispatchSpecificReason.filter(r => r !== opt));
                      }
                    }}
                    style={{ cursor: "pointer", width: "18px", height: "18px" }}
                  />
                  <span style={{ fontWeight: dispatchSpecificReason.includes(opt) ? 600 : 400, color: dispatchSpecificReason.includes(opt) ? "#2b6cb0" : "#374151" }}>{opt}</span>
                </label>
              ))}
            </div>

            {(dispatchSpecificReason.includes("Other") || dispatchSpecificReason.includes("Prescription Medicines") || dispatchSpecificReason.includes("OTC Medicines")) && (
              <div style={{ marginBottom: "24px", animation: "fadeIn 0.3s" }}>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: 500, color: "#374151", fontSize: "0.95rem" }}>
                  {dispatchSpecificReason.includes("Other") ? "Please specify your requirement:" : "List the medicines you need (e.g. Paracetamol 500mg x2, Dolo 650 x1):"}
                </label>
                <textarea
                  value={dispatchOtherText}
                  onChange={(e) => setDispatchOtherText(e.target.value)}
                  placeholder="Enter details here..."
                  style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #d1d5db", minHeight: "80px", resize: "vertical", fontFamily: "inherit" }}
                />
              </div>
            )}

            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={() => { setShowDispatchModal(false); setDispatchOtherText(""); }} style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "1px solid #d1d5db", backgroundColor: "white", color: "#374151", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={confirmDispatchRequest} disabled={dispatchSpecificReason.length === 0} style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "none", backgroundColor: dispatchSpecificReason.length > 0 ? "#3182ce" : "#9ca3af", color: "white", fontWeight: 600, cursor: dispatchSpecificReason.length > 0 ? "pointer" : "not-allowed", transition: "background-color 0.2s" }}>Confirm Request</button>
            </div>
          </div>
        </div>
      )}



      {/* Industry-First Feature Modals */}
      <AIVoiceIntakeModal
        isOpen={showVoiceModal}
        onClose={() => setShowVoiceModal(false)}
        onSelectProvider={(prov, summary) => {
          setDispatchProviderType(prov);
          setDispatchServiceType("Urgent " + prov.toUpperCase() + " Visit");
          setDispatchLabel("AI Voice Triage Recommended Visit");
          setDispatchSpecificReason([summary]);
          setShowDispatchModal(true);
        }}
      />

      <DrugShieldModal
        isOpen={showDrugShieldModal}
        onClose={() => setShowDrugShieldModal(false)}
      />

      {/* ─── QUICK RE-ORDER MODAL ─── */}
      {showReorderModal && reorderBooking && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(0,0,0,0.6)", zIndex: 1000,
          display: "flex", justifyContent: "center", alignItems: "center", padding: 20
        }}>
          <div style={{
            backgroundColor: "white", borderRadius: 16, padding: 28,
            width: "100%", maxWidth: 480, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)"
          }}>
            <h3 style={{ margin: "0 0 12px", color: "var(--cm-ink)", fontSize: "1.2rem", display: "flex", alignItems: "center", gap: 8 }}>
              <RefreshCw size={20} style={{ color: "var(--cm-active)" }} /> {t.reorderModal.title}
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--cm-ink-3)", marginBottom: 16 }}>
              {t.reorderModal.subtitle}
            </p>

            <div style={{ backgroundColor: "var(--cm-surface-2)", borderRadius: 10, padding: 16, marginBottom: 20, border: "1px solid var(--cm-line)" }}>
              <div style={{ fontSize: "var(--cm-text-xs)", fontWeight: 600, color: "var(--cm-ink-3)", marginBottom: 2 }}>
                {bookingKindLabel(reorderBooking.service_type)}
              </div>
              <div style={{ fontWeight: 700, color: "var(--cm-ink)", fontSize: "0.95rem", marginBottom: 4 }}>
                {parseBookingNotes(reorderBooking.notes, reorderBooking.service_type).title}
              </div>
              {parseBookingNotes(reorderBooking.notes, reorderBooking.service_type).address && (
                <div style={{ fontSize: "0.82rem", color: "var(--cm-ink-3)", marginBottom: 8 }}>
                  {parseBookingNotes(reorderBooking.notes, reorderBooking.service_type).address}
                </div>
              )}
              {/* A made-up ₹350 used to stand in when the old booking had no
                  price; a patient must never be quoted a number we invented. */}
              {Number(reorderBooking.total_price) > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", fontWeight: 700, color: "var(--cm-ink)", borderTop: "1px dashed var(--cm-line)", paddingTop: 8, fontVariantNumeric: "tabular-nums" }}>
                  <span>{t.reorderModal.estimatedPrice}</span>
                  <span>{formatINR(reorderBooking.total_price)}</span>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setShowReorderModal(false)}
                style={{ flex: 1, padding: "12px", borderRadius: 8, border: "1px solid var(--cm-line)", background: "var(--cm-surface)", cursor: "pointer", fontWeight: 600, color: "var(--cm-ink)" }}
              >
                {t.reorderModal.cancel}
              </button>
              <button
                onClick={confirmQuickReorder}
                disabled={reorderLoading}
                style={{ flex: 1, padding: "12px", borderRadius: 8, border: "none", background: "var(--cm-active)", color: "white", fontWeight: 700, cursor: reorderLoading ? "wait" : "pointer" }}
              >
                {reorderLoading ? t.reorderModal.processing : t.reorderModal.confirm}
              </button>
            </div>
          </div>
        </div>
      )}

      <DeleteAccountModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        userRole="patient"
        userEmail={user?.email}
        userName={user?.full_name}
      />
    </div>
  );
}

