"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { customConfirm } from "@/lib/customConfirm";
import PatientNavSidebar from "../components/PatientNavSidebar";
import PatientAIAdvisor from "../components/PatientAIAdvisor";
import InteractiveBodyMap from "@/app/components/InteractiveBodyMap";
import AIVoiceIntakeModal from "@/app/components/AIVoiceIntakeModal";
import DashboardShell from "../components/DashboardShell";
import { SampleTrackerModal } from "../components/SampleStatusRail";
import DrugShieldModal from "@/app/components/DrugShieldModal";
import FamilyMembersPanel from "../components/FamilyMembersPanel";
import { bookingsAPI, dispatchAPI, patientSamplesAPI } from "@/lib/api";
import { FEATURE_FLAGS } from "@/config/featureFlags";
import { BiomarkerMatrix } from "../components/BiomarkerMatrix";
import { DoctorBriefingModal } from "../components/DoctorBriefingModal";
import { FamilySwiperWheel } from "../components/FamilySwiperWheel";
import { MedicineCabinetGrid } from "../components/MedicineCabinetGrid";
import { PhlebotomistRadar } from "../components/PhlebotomistRadar";
import { PATIENT_TRANSLATIONS, PatientLang } from "./patientTranslations";
import Clinical3DIcon from "@/components/ui/Clinical3DIcon";
import { useFamilyHubStore } from "@/store/useFamilyHubStore";
import { useHealthMatrixStore } from "@/store/useHealthMatrixStore";
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
} from "lucide-react";

interface UserData {
  full_name: string;
  role: string;
}

export default function PatientDashboard() {
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
  const healthState = useHealthMatrixStore();

  // Industry-First Feature Modals
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [showDrugShieldModal, setShowDrugShieldModal] = useState(false);
  const [showBriefingModal, setShowBriefingModal] = useState(false);
  const [showSampleModal, setShowSampleModal] = useState(false);
  const [activeSampleCount, setActiveSampleCount] = useState<number>(0);

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
    const candidates = bookings.filter(
      (b) =>
        ["confirmed", "provider_accepted", "in_progress"].includes(b.status) &&
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
  const upcomingBookings = bookings.filter(b => {
    if (!["confirmed", "pending_review", "slot_allotted", "provider_accepted", "in_progress"].includes(b.status)) {
      return false;
    }
    if (b.scheduled_date && b.scheduled_date < todayIST && !["provider_accepted", "in_progress"].includes(b.status)) {
      return false;
    }
    return true;
  });
  const upcomingCount = upcomingBookings.length;
  const completedBookings = bookings.filter(b => b.status === "completed");
  const completedCount = completedBookings.length;
  const prescriptionsCount = familyState.medications?.length || 0;
  const conductedRecords = bookings.filter(b =>
    b.status === "completed" ||
    Boolean(b.report_url) ||
    ["lab_test", "diagnostic", "radiology", "health_package"].includes(b.booking_type || b.service_type)
  );
  const recordsCount = conductedRecords.length || completedCount || (healthState.biomarkers?.length || 0);
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
              <div className="cm-kpi-card__accent cm-kpi-card__accent--active" />
              <div>
                <div className="cm-kpi-card__label">{t.kpi.upcoming}</div>
                <div className="cm-kpi-card__value">{upcomingCount}</div>
                <div className="cm-kpi-card__subtitle">{t.kpi.upcomingSub}</div>
              </div>
              <div className="cm-kpi-card__icon" style={{ background: "transparent", padding: 0 }}>
                <Clinical3DIcon name="calendar" size={36} glow />
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
              <div className="cm-kpi-card__accent cm-kpi-card__accent--done" />
              <div>
                <div className="cm-kpi-card__label">{t.kpi.completed}</div>
                <div className="cm-kpi-card__value">{completedCount}</div>
                <div className="cm-kpi-card__subtitle">{t.kpi.completedSub}</div>
              </div>
              <div className="cm-kpi-card__icon" style={{ background: "transparent", padding: 0 }}>
                <Clinical3DIcon name="check" size={36} glow />
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
              <div className="cm-kpi-card__accent cm-kpi-card__accent--waiting" />
              <div>
                <div className="cm-kpi-card__label">{t.kpi.prescriptions}</div>
                <div className="cm-kpi-card__value">{prescriptionsCount}</div>
                <div className="cm-kpi-card__subtitle">{t.kpi.prescriptionsSub}</div>
              </div>
              <div className="cm-kpi-card__icon" style={{ background: "transparent", padding: 0 }}>
                <Clinical3DIcon name="pill" size={36} glow />
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
              <div className="cm-kpi-card__icon" style={{ background: "transparent", padding: 0 }}>
                <Clinical3DIcon name="chart" size={36} glow />
              </div>
            </div>
          </div>

          {/* Interactive KPI Glassmorphic Modal */}
          {activeKpiModal && (
            <div
              className="cm-overlay"
              onClick={() => setActiveKpiModal(null)}
              style={{ zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
            >
              <div
                className="cm-modal cm-modal--kpi"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                style={{
                  background: "linear-gradient(135deg, #0b1329 0%, #172554 100%)",
                  border: "1px solid rgba(56, 189, 248, 0.3)",
                  boxShadow: "0 25px 60px -12px rgba(0, 0, 0, 0.8), 0 0 35px rgba(56, 189, 248, 0.15)",
                  borderRadius: "20px",
                  maxWidth: "840px",
                  width: "94vw",
                  maxHeight: "90vh",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                  color: "#f8fafc",
                }}
              >
                {/* Modal Header */}
                <div
                  style={{
                    padding: "20px 24px",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "rgba(15, 23, 42, 0.4)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        background:
                          activeKpiModal === "upcoming"
                            ? "rgba(2, 132, 199, 0.2)"
                            : activeKpiModal === "completed"
                            ? "rgba(34, 197, 94, 0.2)"
                            : activeKpiModal === "prescriptions"
                            ? "rgba(245, 158, 11, 0.2)"
                            : "rgba(139, 92, 246, 0.2)",
                        border: `1px solid ${
                          activeKpiModal === "upcoming"
                            ? "rgba(56, 189, 248, 0.4)"
                            : activeKpiModal === "completed"
                            ? "rgba(74, 222, 128, 0.4)"
                            : activeKpiModal === "prescriptions"
                            ? "rgba(251, 191, 36, 0.4)"
                            : "rgba(167, 139, 250, 0.4)"
                        }`,
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      {activeKpiModal === "upcoming" && <Clinical3DIcon name="calendar" size={26} glow />}
                      {activeKpiModal === "completed" && <Clinical3DIcon name="check" size={26} glow />}
                      {activeKpiModal === "prescriptions" && <Clinical3DIcon name="pill" size={26} glow />}
                      {activeKpiModal === "records" && <Clinical3DIcon name="chart" size={26} glow />}
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "#fff" }}>
                        {activeKpiModal === "upcoming" && "Upcoming Consultations & Doorstep Healthcare"}
                        {activeKpiModal === "completed" && "Completed Healthcare Services & History"}
                        {activeKpiModal === "prescriptions" && "Active Prescriptions & Medicine Regimen"}
                        {activeKpiModal === "records" && "Clinical Health Records & Diagnostic Biomarkers"}
                      </h3>
                      <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: 2 }}>
                        {activeKpiModal === "upcoming" && `${upcomingCount} active appointment${upcomingCount === 1 ? "" : "s"} scheduled`}
                        {activeKpiModal === "completed" && `${completedCount} completed session${completedCount === 1 ? "" : "s"} verified`}
                        {activeKpiModal === "prescriptions" && `${prescriptionsCount} tracked prescription item${prescriptionsCount === 1 ? "" : "s"}`}
                        {activeKpiModal === "records" && `${recordsCount} diagnostic reading${recordsCount === 1 ? "" : "s"} on file`}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveKpiModal(null)}
                    style={{
                      background: "rgba(255, 255, 255, 0.08)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      color: "#cbd5e1",
                      borderRadius: "50%",
                      width: 32,
                      height: 32,
                      display: "grid",
                      placeItems: "center",
                      cursor: "pointer",
                    }}
                    aria-label="Close modal"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Modal Body */}
                <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "16px" }}>
                  {/* Mode 1: Upcoming Appointments */}
                  {activeKpiModal === "upcoming" && (
                    <>
                      {upcomingBookings.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          {upcomingBookings.map((b) => (
                            <div
                              key={b.id}
                              style={{
                                background: "rgba(15, 23, 42, 0.7)",
                                border: "1px solid rgba(56, 189, 248, 0.2)",
                                borderRadius: 14,
                                padding: "16px 18px",
                                display: "flex",
                                flexDirection: "column",
                                gap: 10,
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  <span
                                    style={{
                                      padding: "3px 10px",
                                      borderRadius: 999,
                                      fontSize: "0.75rem",
                                      fontWeight: 700,
                                      textTransform: "uppercase",
                                      background:
                                        b.status === "confirmed"
                                          ? "rgba(34, 197, 94, 0.2)"
                                          : b.status === "slot_allotted"
                                          ? "rgba(245, 158, 11, 0.2)"
                                          : "rgba(2, 132, 199, 0.2)",
                                      color:
                                        b.status === "confirmed"
                                          ? "#4ade80"
                                          : b.status === "slot_allotted"
                                          ? "#fbbf24"
                                          : "#38bdf8",
                                      border: `1px solid ${
                                        b.status === "confirmed"
                                          ? "rgba(74, 222, 128, 0.3)"
                                          : b.status === "slot_allotted"
                                          ? "rgba(251, 191, 36, 0.3)"
                                          : "rgba(56, 189, 248, 0.3)"
                                      }`,
                                    }}
                                  >
                                    {b.status.replace("_", " ")}
                                  </span>
                                  <span style={{ fontWeight: 700, fontSize: "1rem", color: "#fff" }}>
                                    {b.service_title || b.service_type?.replace(/_/g, " ").toUpperCase() || "Doctor Consultation"}
                                  </span>
                                </div>
                                <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                                  ID: <span style={{ fontFamily: "monospace", color: "#e2e8f0" }}>{b.id?.slice(0, 8)}</span>
                                </div>
                              </div>

                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, fontSize: "0.85rem", color: "#cbd5e1" }}>
                                <div>
                                  <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Date &amp; Slot</div>
                                  <div style={{ fontWeight: 600, color: "#f1f5f9" }}>
                                    {b.booking_date || b.scheduled_date || "Today"} · {b.slot_id?.split("|")[2] || b.time_slot || "Assigned Slot"}
                                  </div>
                                </div>
                                <div>
                                  <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Mode of Care</div>
                                  <div style={{ fontWeight: 600, color: "#f1f5f9", textTransform: "capitalize" }}>
                                    {b.consultation_mode || b.booking_kind || (b.notes?.includes("Home Visit") ? "Home Visit" : "In-Person Clinic")}
                                  </div>
                                </div>
                                <div>
                                  <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Assigned Provider</div>
                                  <div style={{ fontWeight: 600, color: "#f1f5f9" }}>{b.provider_name || b.doctor_name || "CallMedex Clinician"}</div>
                                </div>
                              </div>

                              {b.status === "slot_allotted" && (
                                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                                  <button
                                    type="button"
                                    onClick={() => handleRespondSlot(b.id, true)}
                                    style={{
                                      padding: "6px 14px",
                                      borderRadius: 8,
                                      background: "var(--cm-done)",
                                      color: "#fff",
                                      border: "none",
                                      fontWeight: 700,
                                      fontSize: "0.8rem",
                                      cursor: "pointer",
                                    }}
                                  >
                                    ✓ Accept Allotted Slot
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRespondSlot(b.id, false, "Reschedule requested by patient")}
                                    style={{
                                      padding: "6px 14px",
                                      borderRadius: 8,
                                      background: "rgba(255, 255, 255, 0.1)",
                                      color: "#f87171",
                                      border: "1px solid rgba(248, 113, 113, 0.3)",
                                      fontWeight: 600,
                                      fontSize: "0.8rem",
                                      cursor: "pointer",
                                    }}
                                  >
                                    Request Different Time
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ textAlign: "center", padding: "40px 16px", color: "#94a3b8" }}>
                          <Clinical3DIcon name="calendar" size={48} glow />
                          <div style={{ marginTop: 14, fontSize: "1rem", fontWeight: 700, color: "#e2e8f0" }}>No upcoming appointments scheduled</div>
                          <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: 4 }}>Need medical care, home nursing, or diagnostic blood tests?</div>
                          <a
                            href="/booking"
                            style={{
                              display: "inline-block",
                              marginTop: 18,
                              padding: "10px 22px",
                              borderRadius: 999,
                              background: "linear-gradient(135deg, #0284c7 0%, #2563eb 100%)",
                              color: "#fff",
                              textDecoration: "none",
                              fontWeight: 700,
                              fontSize: "0.85rem",
                            }}
                          >
                            Book Doctor Consultation or Test →
                          </a>
                        </div>
                      )}
                    </>
                  )}

                  {/* Mode 2: Completed Services */}
                  {activeKpiModal === "completed" && (
                    <>
                      {completedBookings.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          {completedBookings.map((b) => (
                            <div
                              key={b.id}
                              style={{
                                background: "rgba(15, 23, 42, 0.7)",
                                border: "1px solid rgba(74, 222, 128, 0.2)",
                                borderRadius: 14,
                                padding: "16px 18px",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                flexWrap: "wrap",
                                gap: 12,
                              }}
                            >
                              <div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <span
                                    style={{
                                      padding: "2px 8px",
                                      borderRadius: 999,
                                      fontSize: "0.7rem",
                                      fontWeight: 700,
                                      background: "rgba(34, 197, 94, 0.2)",
                                      color: "#4ade80",
                                      border: "1px solid rgba(74, 222, 128, 0.3)",
                                    }}
                                  >
                                    ✓ COMPLETED
                                  </span>
                                  <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "#fff" }}>
                                    {b.service_title || b.service_type?.replace(/_/g, " ").toUpperCase() || "Healthcare Session"}
                                  </span>
                                </div>
                                <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: 4 }}>
                                  Completed on:{" "}
                                  {b.completed_at
                                    ? new Date(b.completed_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                                    : b.booking_date || "Past Session"}{" "}
                                  · Provider: {b.provider_name || "Verified Practitioner"}
                                </div>
                              </div>

                              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                <a
                                  href="/dashboard/patient/reports"
                                  style={{
                                    padding: "7px 14px",
                                    borderRadius: 8,
                                    background: "rgba(2, 132, 199, 0.2)",
                                    color: "#38bdf8",
                                    border: "1px solid rgba(56, 189, 248, 0.3)",
                                    textDecoration: "none",
                                    fontSize: "0.8rem",
                                    fontWeight: 600,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                  }}
                                >
                                  <FileText size={14} /> View Report
                                </a>
                                <a
                                  href={`/booking?service=${b.service_type || ""}`}
                                  style={{
                                    padding: "7px 14px",
                                    borderRadius: 8,
                                    background: "rgba(255, 255, 255, 0.08)",
                                    color: "#fff",
                                    border: "1px solid rgba(255, 255, 255, 0.15)",
                                    textDecoration: "none",
                                    fontSize: "0.8rem",
                                    fontWeight: 600,
                                  }}
                                >
                                  Rebook Service
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ textAlign: "center", padding: "40px 16px", color: "#94a3b8" }}>
                          <Clinical3DIcon name="check" size={48} glow />
                          <div style={{ marginTop: 14, fontSize: "1rem", fontWeight: 700, color: "#e2e8f0" }}>No completed sessions yet</div>
                          <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: 4 }}>
                            Your past medical consultations, diagnostic lab results, and home healthcare history will be safely cataloged here.
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Mode 3: Active Prescriptions */}
                  {activeKpiModal === "prescriptions" && (
                    <>
                      {familyState.medications?.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          {familyState.medications.map((m) => (
                            <div
                              key={m.id}
                              style={{
                                background: "rgba(15, 23, 42, 0.7)",
                                border: "1px solid rgba(245, 158, 11, 0.2)",
                                borderRadius: 14,
                                padding: "16px 18px",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                flexWrap: "wrap",
                                gap: 12,
                              }}
                            >
                              <div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <span style={{ fontWeight: 800, fontSize: "1rem", color: "#fff" }}>{m.medicineName}</span>
                                  <span
                                    style={{
                                      padding: "2px 8px",
                                      borderRadius: 999,
                                      fontSize: "0.7rem",
                                      fontWeight: 600,
                                      background: "rgba(255, 255, 255, 0.1)",
                                      color: "#e2e8f0",
                                    }}
                                  >
                                    {m.dosage}
                                  </span>
                                  {m.needsRefill && (
                                    <span
                                      style={{
                                        padding: "2px 8px",
                                        borderRadius: 999,
                                        fontSize: "0.7rem",
                                        fontWeight: 700,
                                        background: "rgba(239, 68, 68, 0.2)",
                                        color: "#f87171",
                                        border: "1px solid rgba(239, 68, 68, 0.3)",
                                      }}
                                    >
                                      Refill Needed
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: 4 }}>
                                  Remaining supply: <strong style={{ color: "#f1f5f9" }}>{m.remainingPills} pills</strong> ·{" "}
                                  {m.daysLeft !== null && m.daysLeft !== undefined ? `~${m.daysLeft} days remaining` : `${m.pillsPerDay} dose/day`}
                                </div>
                              </div>

                              <div style={{ display: "flex", gap: 8 }}>
                                <a
                                  href="/dashboard/patient/pharmacy"
                                  style={{
                                    padding: "7px 14px",
                                    borderRadius: 8,
                                    background: "rgba(245, 158, 11, 0.2)",
                                    color: "#fbbf24",
                                    border: "1px solid rgba(251, 191, 36, 0.3)",
                                    textDecoration: "none",
                                    fontSize: "0.8rem",
                                    fontWeight: 700,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                  }}
                                >
                                  <Pill size={14} /> 1-Click Refill
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ textAlign: "center", padding: "40px 16px", color: "#94a3b8" }}>
                          <Clinical3DIcon name="pill" size={48} glow />
                          <div style={{ marginTop: 14, fontSize: "1rem", fontWeight: 700, color: "#e2e8f0" }}>No active medication regimens recorded</div>
                          <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: 4 }}>
                            Keep track of your dosages, schedules, and prescription refills seamlessly.
                          </div>
                          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 18, flexWrap: "wrap" }}>
                            <a
                              href="/dashboard/patient/pharmacy"
                              style={{
                                padding: "10px 20px",
                                borderRadius: 999,
                                background: "linear-gradient(135deg, #d97706 0%, #b45309 100%)",
                                color: "#fff",
                                textDecoration: "none",
                                fontWeight: 700,
                                fontSize: "0.85rem",
                              }}
                            >
                              Order from Partner Pharmacy →
                            </a>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveKpiModal(null);
                                setShowDrugShieldModal(true);
                              }}
                              style={{
                                padding: "10px 18px",
                                borderRadius: 999,
                                background: "rgba(255, 255, 255, 0.1)",
                                color: "#fff",
                                border: "1px solid rgba(255, 255, 255, 0.2)",
                                fontWeight: 600,
                                fontSize: "0.85rem",
                                cursor: "pointer",
                              }}
                            >
                              CDSCO Drug Safety Guard
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Mode 4: Health Records & Diagnostic Test Reports (Self vs Family Segmented) */}
                  {activeKpiModal === "records" && (() => {
                    const allTestRecords = bookings.filter(b =>
                      b.status === "completed" ||
                      Boolean(b.report_url) ||
                      ["lab_test", "diagnostic", "radiology", "health_package"].includes(b.booking_type || b.service_type)
                    );

                    const selfRecords = allTestRecords.filter(b => b.is_self !== false && !b.family_member_id);
                    const familyRecords = allTestRecords.filter(b => b.is_self === false || Boolean(b.family_member_id));

                    const displayedRecords = recordsTab === "self"
                      ? selfRecords
                      : (selectedFamilyMemberId === "all"
                          ? familyRecords
                          : familyRecords.filter(b => b.family_member_id === selectedFamilyMemberId));

                    return (
                      <div>
                        {/* Segmented Control: Self vs Family Member */}
                        <div style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                          marginBottom: 16,
                          background: "rgba(15, 23, 42, 0.7)",
                          padding: "6px",
                          borderRadius: 12,
                          border: "1px solid rgba(255, 255, 255, 0.08)"
                        }}>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              type="button"
                              onClick={() => setRecordsTab("self")}
                              style={{
                                padding: "8px 18px",
                                borderRadius: 8,
                                border: "none",
                                fontSize: "0.85rem",
                                fontWeight: 700,
                                cursor: "pointer",
                                transition: "all 0.2s ease",
                                background: recordsTab === "self" ? "linear-gradient(135deg, #0ea5e9, #2563eb)" : "transparent",
                                color: recordsTab === "self" ? "#fff" : "#94a3b8",
                                boxShadow: recordsTab === "self" ? "0 4px 12px rgba(14, 165, 233, 0.3)" : "none"
                              }}
                            >
                              My Records ({selfRecords.length})
                            </button>
                            <button
                              type="button"
                              onClick={() => setRecordsTab("family")}
                              style={{
                                padding: "8px 18px",
                                borderRadius: 8,
                                border: "none",
                                fontSize: "0.85rem",
                                fontWeight: 700,
                                cursor: "pointer",
                                transition: "all 0.2s ease",
                                background: recordsTab === "family" ? "linear-gradient(135deg, #8b5cf6, #6366f1)" : "transparent",
                                color: recordsTab === "family" ? "#fff" : "#94a3b8",
                                boxShadow: recordsTab === "family" ? "0 4px 12px rgba(139, 92, 246, 0.3)" : "none"
                              }}
                            >
                              Family Records ({familyRecords.length})
                            </button>
                          </div>

                          {recordsTab === "family" && familyState.members.length > 0 && (
                            <select
                              value={selectedFamilyMemberId}
                              onChange={(e) => setSelectedFamilyMemberId(e.target.value)}
                              style={{
                                background: "rgba(30, 41, 59, 0.9)",
                                color: "#e2e8f0",
                                border: "1px solid rgba(148, 163, 184, 0.2)",
                                borderRadius: 8,
                                padding: "6px 12px",
                                fontSize: "0.8rem",
                                outline: "none"
                              }}
                            >
                              <option value="all">All Family Members</option>
                              {familyState.members.map((m: any) => (
                                <option key={m.id} value={m.id}>{m.fullName} ({m.relationship})</option>
                              ))}
                            </select>
                          )}
                        </div>

                        {/* Health Summary Strip */}
                        <div
                          style={{
                            background: "rgba(14, 165, 233, 0.08)",
                            border: "1px solid rgba(14, 165, 233, 0.2)",
                            borderRadius: 14,
                            padding: "14px 18px",
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                            gap: 12,
                            marginBottom: 16,
                          }}
                        >
                          <div>
                            <div style={{ fontSize: "0.72rem", color: "#38bdf8", textTransform: "uppercase", fontWeight: 700 }}>
                              Conducted Tests
                            </div>
                            <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#fff", marginTop: 2 }}>
                              {displayedRecords.length}
                            </div>
                            <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
                              {recordsTab === "self" ? "Personal records" : "Dependent records"}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: "0.72rem", color: "#38bdf8", textTransform: "uppercase", fontWeight: 700 }}>
                              Available Reports
                            </div>
                            <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#fff", marginTop: 2 }}>
                              {displayedRecords.filter(b => b.report_url || b.status === "completed").length}
                            </div>
                            <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>NABL &amp; CAP Verified</div>
                          </div>
                          <div>
                            <div style={{ fontSize: "0.72rem", color: "#38bdf8", textTransform: "uppercase", fontWeight: 700 }}>
                              ABDM PHR Sync
                            </div>
                            <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#4ade80", marginTop: 2 }}>Active</div>
                            <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>HIP/HIU Connected</div>
                          </div>
                        </div>

                        {/* Conducted Lab Tests & Diagnostic Reports List */}
                        {displayedRecords.length > 0 ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: "380px", overflowY: "auto", paddingRight: 4 }}>
                            {displayedRecords.map((rec) => {
                              const title = rec.test_names || rec.package_name || rec.service_name || rec.notes || "Comprehensive Lab Test";
                              const center = rec.hospital_name || "CallMedex Pathology & Diagnostic Network";
                              const date = rec.scheduled_date || (rec.created_at ? rec.created_at.split("T")[0] : "Recent");
                              const isCompleted = rec.status === "completed";

                              return (
                                <div
                                  key={rec.id}
                                  style={{
                                    background: "rgba(15, 23, 42, 0.7)",
                                    border: "1px solid rgba(255, 255, 255, 0.08)",
                                    borderRadius: 12,
                                    padding: "14px 16px",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    gap: 16,
                                    transition: "border-color 0.2s ease",
                                  }}
                                >
                                  <div style={{ flex: 1 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                      <span style={{ fontWeight: 700, fontSize: "0.92rem", color: "#fff" }}>
                                        {title}
                                      </span>
                                      {rec.subject_name && !rec.is_self && (
                                        <span style={{
                                          fontSize: "0.68rem",
                                          padding: "2px 8px",
                                          borderRadius: 6,
                                          background: "rgba(139, 92, 246, 0.2)",
                                          color: "#c4b5fd",
                                          border: "1px solid rgba(139, 92, 246, 0.3)"
                                        }}>
                                          {rec.subject_name} ({rec.subject_relationship || "Family"})
                                        </span>
                                      )}
                                    </div>
                                    <div style={{ fontSize: "0.78rem", color: "#94a3b8", display: "flex", alignItems: "center", gap: 12 }}>
                                      <span>{center}</span>
                                      <span>•</span>
                                      <span>Date: {date}</span>
                                    </div>
                                  </div>

                                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <span style={{
                                      fontSize: "0.72rem",
                                      fontWeight: 600,
                                      padding: "4px 10px",
                                      borderRadius: 20,
                                      background: isCompleted ? "rgba(34, 197, 94, 0.15)" : "rgba(14, 165, 233, 0.15)",
                                      color: isCompleted ? "#4ade80" : "#38bdf8",
                                      border: isCompleted ? "1px solid rgba(34, 197, 94, 0.3)" : "1px solid rgba(14, 165, 233, 0.3)"
                                    }}>
                                      {isCompleted ? "Completed & Verified" : (rec.status || "Conducted")}
                                    </span>

                                    {/* Action 1: View / Download Report */}
                                    {rec.report_url ? (
                                      <a
                                        href={rec.report_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                          padding: "6px 12px",
                                          borderRadius: 8,
                                          background: "rgba(255, 255, 255, 0.08)",
                                          color: "#e2e8f0",
                                          border: "1px solid rgba(255, 255, 255, 0.15)",
                                          textDecoration: "none",
                                          fontSize: "0.78rem",
                                          fontWeight: 600,
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 5
                                        }}
                                      >
                                        <Download size={13} /> Report
                                      </a>
                                    ) : (
                                      <a
                                        href={`/dashboard/patient/reports`}
                                        style={{
                                          padding: "6px 12px",
                                          borderRadius: 8,
                                          background: "rgba(255, 255, 255, 0.08)",
                                          color: "#cbd5e1",
                                          border: "1px solid rgba(255, 255, 255, 0.12)",
                                          textDecoration: "none",
                                          fontSize: "0.78rem",
                                          fontWeight: 600,
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 5
                                        }}
                                      >
                                        <FileText size={13} /> View
                                      </a>
                                    )}

                                    {/* Action 2: Book Again CTA */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setReorderBooking(rec);
                                        setShowReorderModal(true);
                                      }}
                                      style={{
                                        padding: "6px 14px",
                                        borderRadius: 8,
                                        background: "linear-gradient(135deg, #0ea5e9, #0284c7)",
                                        color: "#fff",
                                        border: "none",
                                        fontSize: "0.78rem",
                                        fontWeight: 700,
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 5
                                      }}
                                    >
                                      <RefreshCw size={12} /> Book Again
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div style={{ textAlign: "center", padding: "36px 16px", color: "#94a3b8" }}>
                            <Clinical3DIcon name="chart" size={44} glow />
                            <div style={{ marginTop: 12, fontSize: "0.95rem", fontWeight: 700, color: "#e2e8f0" }}>
                              {recordsTab === "self" ? "No conducted test records found for Self" : "No test records found for Family Member"}
                            </div>
                            <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: 4, maxWidth: "420px", margin: "4px auto 16px auto" }}>
                              Book diagnostic panels, preventative full-body scans, or home sample collection to build your digital clinical health chart.
                            </div>
                            <a
                              href="/booking"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "8px 18px",
                                borderRadius: 8,
                                background: "linear-gradient(135deg, #0ea5e9, #2563eb)",
                                color: "#fff",
                                textDecoration: "none",
                                fontSize: "0.85rem",
                                fontWeight: 600,
                              }}
                            >
                              <FlaskConical size={14} /> Book a Diagnostic Test
                            </a>
                          </div>
                        )}

                        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
                          <a
                            href="/dashboard/patient/reports"
                            style={{
                              padding: "8px 16px",
                              borderRadius: 8,
                              background: "rgba(14, 165, 233, 0.15)",
                              color: "#38bdf8",
                              border: "1px solid rgba(56, 189, 248, 0.3)",
                              textDecoration: "none",
                              fontSize: "0.85rem",
                              fontWeight: 600,
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <FileText size={14} /> Open Full Reports Archive
                          </a>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Modal Footer */}
                <div
                  style={{
                    padding: "16px 24px",
                    borderTop: "1px solid rgba(255, 255, 255, 0.1)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "rgba(15, 23, 42, 0.5)",
                  }}
                >
                  <div style={{ fontSize: "0.8rem", color: "#94a3b8", display: "flex", alignItems: "center", gap: 6 }}>
                    <ShieldCheck size={14} color="#38bdf8" />
                    <span>CallMedex Verified Healthcare Protocol</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveKpiModal(null)}
                    style={{
                      padding: "8px 18px",
                      borderRadius: 8,
                      background: "linear-gradient(135deg, #0284c7 0%, #2563eb 100%)",
                      color: "#fff",
                      border: "none",
                      fontWeight: 700,
                      fontSize: "0.85rem",
                      cursor: "pointer",
                    }}
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}



          {/* Interactive 2-Step Sample Tracker Modal */}
          <SampleTrackerModal
            isOpen={showSampleModal}
            onClose={() => setShowSampleModal(false)}
            lang={lang}
          />

          {/* Phlebotomist Cold-Chain Radar */}
          {FEATURE_FLAGS.ENABLE_PHLEBO_RADAR && activeDispatchId && trackingData
            && ["searching", "provider_notified", "provider_accepted", "en_route", "arrived", "in_progress"]
              .includes(trackingData.status)
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
            />
          )}

          {/* ── AI Preventive Care Advisor (OpenRouter AI) ────── */}
          <PatientAIAdvisor />

          {/* ── Patient Dashboard Upgrade Subsystems ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {FEATURE_FLAGS.ENABLE_FAMILY_SWIPER && (
              <div id="family-circle">
                <FamilySwiperWheel lang={lang} />
              </div>
            )}
            {FEATURE_FLAGS.ENABLE_PREVENTIVE_BIOMARKERS && (
              <div id="biomarkers">
                <BiomarkerMatrix lang={lang} />
              </div>
            )}
            {FEATURE_FLAGS.ENABLE_SMART_MEDICINE_CABINET && (
              <div id="medicine-cabinet">
                <MedicineCabinetGrid lang={lang} />
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
        {((activeDispatchId && trackingData && ["searching", "provider_notified", "provider_accepted", "en_route", "arrived", "in_progress"].includes(trackingData.status))
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
            <div className="cm-rapido-panel" style={{ animation: "fadeIn 0.4s ease-out" }}>
              {/* Header */}
              <div className="cm-rapido-panel__header">
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className="cm-pulse-indicator">
                      <span className="cm-pulse-ring" />
                      <span className="cm-pulse-dot" />
                    </span>
                    <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "var(--cm-ink)", display: "flex", alignItems: "center", gap: 8 }}>
                      <Bike size={20} style={{ color: "var(--cm-active)" }} />
                      {t.rapido.title}
                    </h3>
                    {!isReal && (
                      <span style={{ fontSize: "0.68rem", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", background: "var(--cm-warn-surface, #FBF0DC)", color: "var(--cm-warn, #8A5606)", border: "1px solid var(--cm-warn-line, #E4C88C)", padding: "3px 8px", borderRadius: 4 }}>
                        {t.rapido.sampleData}
                      </span>
                    )}
                  </div>
                  <p style={{ margin: "4px 0 0 0", fontSize: "0.82rem", color: "var(--cm-ink-3)" }}>
                    {isSearching
                      ? t.rapido.searchingSubtitle
                      : isArrived
                      ? t.rapido.arrivedSubtitle
                      : t.rapido.enRouteSubtitle}
                  </p>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
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
                          padding: "4px 10px", borderRadius: 9999, border: "none",
                          fontSize: "0.72rem", fontWeight: 700, cursor: "pointer",
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
                          padding: "4px 10px", borderRadius: 9999, border: "none",
                          fontSize: "0.72rem", fontWeight: 700, cursor: "pointer",
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
                          padding: "4px 10px", borderRadius: 9999, border: "none",
                          fontSize: "0.72rem", fontWeight: 700, cursor: "pointer",
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
                        fontSize: "0.85rem", cursor: "pointer", textDecoration: "underline"
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
                        borderRadius: "var(--cm-radius)", padding: "4px 10px", fontSize: "0.78rem",
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
                    <Bike size={36} />
                  </div>
                  <h4 style={{ margin: "0 0 6px 0", fontSize: "1.1rem", fontWeight: 800, color: "var(--cm-ink)" }}>
                    Broadcasting to nearby {providerLabel}...
                  </h4>
                  <p style={{ margin: "0 0 16px 0", fontSize: "0.85rem", color: "var(--cm-ink-3)", maxWidth: 500 }}>
                    {/* The old line quoted "8 verified NABL phlebotomists within
                        4.5 km" and "under 2 minutes" — none of which this page
                        is told; the tracking payload carries no candidate count
                        and no radius. */}
                    We are contacting verified providers near your location. You
                    will see their name and live ETA here as soon as one accepts.
                  </p>
                  <div style={{ display: isCollection ? "flex" : "none", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
                    <span style={{ fontSize: "0.78rem", background: "var(--cm-surface)", border: "1px solid var(--cm-line)", padding: "4px 12px", borderRadius: 9999, color: "var(--cm-ink-2)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <CheckCircle2 size={12} style={{ color: "var(--cm-done)" }} /> {t.rapido.vaccinated}
                    </span>
                    <span style={{ fontSize: "0.78rem", background: "var(--cm-surface)", border: "1px solid var(--cm-line)", padding: "4px 12px", borderRadius: 9999, color: "var(--cm-ink-2)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <CheckCircle2 size={12} style={{ color: "var(--cm-done)" }} /> {t.rapido.sterileKits}
                    </span>
                    <span style={{ fontSize: "0.78rem", background: "var(--cm-surface)", border: "1px solid var(--cm-line)", padding: "4px 12px", borderRadius: 9999, color: "var(--cm-ink-2)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
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
                        {provider.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                        <span className="cm-rapido-captain__online-badge" />
                      </div>
                      <div>
                        <div className="cm-rapido-captain__name">
                          {provider.name}
                          {/* Rating, vehicle, collection count and the NABL
                              badge render only when the tracking payload
                              actually carries them. The live endpoint returns
                              none of these today, so the old `|| "4.9"` /
                              `|| "1,200+"` fallbacks were showing every patient
                              invented credentials for a real phlebotomist. */}
                          {provider.rating && (
                            <span className="cm-rapido-captain__rating">
                              <Star size={12} fill="currentColor" /> {provider.rating}
                            </span>
                          )}
                          {provider.nabl_verified && (
                            <span style={{ fontSize: "0.72rem", background: "var(--cm-done-surface)", color: "var(--cm-done)", border: "1px solid var(--cm-done-line)", padding: "2px 8px", borderRadius: 9999, fontWeight: 700 }}>
                              <ShieldCheck size={11} style={{ display: "inline", marginRight: 3 }} /> NABL Verified
                            </span>
                          )}
                        </div>
                        {(provider.vehicle || provider.collections) && (
                          <div className="cm-rapido-captain__vehicle">
                            <Bike size={14} style={{ color: "var(--cm-active)" }} />
                            {provider.vehicle}
                            {provider.vehicle && provider.collections ? " · " : ""}
                            {provider.collections ? `${provider.collections} collections` : ""}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Distance & Contact Actions */}
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "1.2rem", fontWeight: 900, color: isArrived ? "var(--cm-done)" : "var(--cm-ink)" }}>
                          {isArrived ? t.rapido.atDoorstep : t.rapido.minsAway(provider.eta_minutes || 12)}
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "var(--cm-ink-3)" }}>
                          {isArrived ? "Ring Bell / Meet Provider" : t.rapido.kmAway(provider.distance_km || 1.8)}
                        </div>
                      </div>

                      <div className="cm-rapido-captain__actions">
                        <a
                          href={`tel:${provider.mobile || "+919849023145"}`}
                          className="cm-btn cm-btn--primary cm-btn--sm"
                          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700, textDecoration: "none" }}
                        >
                          <Phone size={14} /> {t.rapido.callPhlebo}
                        </a>
                        <a
                          href={`https://wa.me/${(provider.mobile || "919849023145").replace(/[^0-9]/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="cm-btn cm-btn--secondary cm-btn--sm"
                          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700, textDecoration: "none" }}
                        >
                          <MessageCircle size={14} /> {t.rapido.whatsapp}
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* High-Contrast Doorstep OTP Card (Shown when Arrived or Previewing) */}
                  {(isArrived || simStage === "arrived") && (
                    <div className="cm-rapido-otp-card">
                      <div>
                        <div style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.75)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700 }}>
                          Doorstep Sample Verification
                        </div>
                        <h4 style={{ margin: "2px 0 6px 0", fontSize: "1.2rem", color: "#fff", fontWeight: 800 }}>
                          {t.rapido.otpTitle}
                        </h4>
                        <p style={{ margin: 0, fontSize: "0.85rem", color: "rgba(255,255,255,0.85)", maxWidth: 460 }}>
                          {t.rapido.otpDesc}
                        </p>
                      </div>

                      <div style={{ textAlign: "center" }}>
                        <div className="cm-rapido-otp-code">
                          {otp}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "#38bdf8", marginTop: 4, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <CheckCircle2 size={12} style={{ color: "#38bdf8" }} /> {t.rapido.sterileSeal}
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
                      <div style={{ fontSize: "0.82rem", color: "var(--cm-ink-3)" }}>{b.notes || b.service_type?.replace('_', ' ')}</div>
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

        {/* Interactive 3D Anatomical Twin Stage */}
        <div style={{ marginBottom: 24 }}>
          <InteractiveBodyMap />
        </div>



        {/* Family Members */}
        <div id="family-circle">
          <FamilyMembersPanel />
        </div>

        {/* Recent Bookings */}
        <div id="recent-bookings">
          <h3 style={{ marginBottom: 16, fontFamily: "var(--font-body)", fontSize: "1.1rem", color: "var(--cm-ink)" }}>{t.bookings.title}</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {loading ? (
            <div className="cm-booking-glass-card card" style={{ padding: "32px", textAlign: "center", color: "var(--cm-ink-3)", justifyContent: "center" }}>{t.bookings.loading}</div>
          ) : bookings?.length > 0 ? (
            bookings.map((booking: any) => (
              <div key={booking.id} className="cm-booking-glass-card card">
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 10,
                    background: booking.service_type === "lab_test" ? "var(--cm-active-surface)" : booking.service_type === "video_consult" ? "var(--cm-done-surface)" : "var(--cm-waiting-surface)",
                    color: booking.service_type === "lab_test" ? "var(--cm-active)" : booking.service_type === "video_consult" ? "var(--cm-done)" : "var(--cm-waiting)",
                    display: "flex", alignItems: "center", justifyContent: "center"
                  }}>
                    {booking.service_type === "lab_test" ? <Activity size={22} /> : booking.service_type === "video_consult" ? <Video size={22} /> : <Stethoscope size={22} />}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.95rem", textTransform: 'capitalize', color: "var(--cm-ink)" }}>
                      {booking.service_type.replace('_', ' ')}
                    </div>
                    <div style={{ fontSize: "0.82rem", color: "var(--color-gray-500)" }}>
                      {booking.notes || `Provider ID: ${booking.provider_id}`} · {new Date(booking.slot_start).toLocaleDateString()} at {new Date(booking.slot_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "4px 12px", borderRadius: 999, fontWeight: 700, fontSize: "0.75rem",
                    backgroundColor: booking.status === "cancelled" || booking.status === "slot_rejected" ? "var(--cm-urgent-surface)"
                      : booking.status === "pending_review" ? "var(--cm-active-surface)"
                        : booking.status === "slot_allotted" ? "var(--cm-waiting-surface)"
                          : "var(--cm-done-surface)",
                    color: booking.status === "cancelled" || booking.status === "slot_rejected" ? "var(--cm-urgent)"
                      : booking.status === "pending_review" ? "var(--cm-active)"
                        : booking.status === "slot_allotted" ? "var(--cm-waiting)"
                          : "var(--cm-done)",
                    border: `1px solid ${
                      booking.status === "cancelled" || booking.status === "slot_rejected" ? "var(--cm-urgent-line)"
                        : booking.status === "pending_review" ? "var(--cm-active-line)"
                          : booking.status === "slot_allotted" ? "var(--cm-waiting-line)"
                            : "var(--cm-done-line)"
                    }`,
                  }}>
                    {booking.status === "pending_review" ? <><Clock size={13} /> Pending Review</>
                      : booking.status === "slot_allotted" ? <><Bell size={13} /> Slot Allotted</>
                        : booking.status === "slot_rejected" ? <><XCircle size={13} /> Slot Declined</>
                          : <><CheckCircle2 size={13} /> {booking.status.replace('_', ' ')}</>}
                  </span>
                  {booking.status !== "arrived" && booking.status !== "in_progress" && booking.status !== "completed" && booking.status !== "cancelled" && booking.status !== "slot_allotted" && (
                    <button
                      type="button"
                      onClick={() => handleCancelBooking(booking.id, booking.status)}
                      style={{
                        background: 'none', border: 'none', color: 'var(--cm-urgent)', fontWeight: 600,
                        fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline', padding: 0
                      }}
                    >
                      {t.bookings.cancel}
                    </button>
                  )}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {(booking.service_type === "lab_test" || booking.service_type === "home_collection") && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowLiveTracker(true);
                          window.scrollTo({ top: 320, behavior: "smooth" });
                        }}
                        style={{
                          padding: "5px 12px", borderRadius: "var(--cm-radius)", border: "1px solid var(--cm-done-line)",
                          backgroundColor: "var(--cm-done-surface)", color: "var(--cm-done)", fontWeight: 700,
                          fontSize: "0.75rem", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
                          transition: "all 0.15s ease"
                        }}
                      >
                        <Bike size={13} /> {t.bookings.trackPhlebo}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleQuickReorder(booking)}
                      style={{
                        padding: "5px 12px", borderRadius: "var(--cm-radius)", border: "1px solid var(--cm-active-line)",
                        backgroundColor: "var(--cm-active-surface)", color: "var(--cm-active)", fontWeight: 700,
                        fontSize: "0.75rem", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
                        transition: "all 0.15s ease"
                      }}
                    >
                      <RefreshCw size={13} /> {t.bookings.quickReorder}
                    </button>
                  </div>
                </div>
              </div>

            ))
          ) : (
            <div className="card" style={{ padding: "32px", textAlign: "center", color: "var(--color-gray-500)" }}>
              <p>{t.bookings.noBookings}</p>
              <a href="/booking" className="btn btn-primary" style={{ marginTop: 12, display: "inline-block" }}>{t.bookings.bookFirst}</a>
            </div>
          )}
          {bookings?.length > 0 && (
            <a href="/dashboard/patient/bookings" className="btn btn-outline" style={{ marginTop: 8, display: 'block', textAlign: 'center' }}>
              {t.bookings.viewAllHistory}
            </a>
          )}
        </div>
      </div>

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
              <div style={{ fontWeight: 700, color: "var(--cm-ink)", fontSize: "0.95rem", textTransform: "capitalize", marginBottom: 4 }}>
                {reorderBooking.service_type.replace('_', ' ')}
              </div>
              <div style={{ fontSize: "0.82rem", color: "var(--cm-ink-3)", marginBottom: 8 }}>
                {reorderBooking.notes || `Previous Booking ID: ${reorderBooking.id?.slice(0, 8)}`}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", fontWeight: 700, color: "var(--cm-active)", borderTop: "1px dashed var(--cm-line)", paddingTop: 8 }}>
                <span>{t.reorderModal.estimatedPrice}</span>
                <span>₹{reorderBooking.total_price || 350}</span>
              </div>
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
    </div>
  );
}

