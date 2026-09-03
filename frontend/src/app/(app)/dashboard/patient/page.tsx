"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { customConfirm } from "@/lib/customConfirm";
import DashboardProfile from "../components/DashboardProfile";
import InteractiveBodyMap from "@/app/components/InteractiveBodyMap";
import AIVoiceIntakeModal from "@/app/components/AIVoiceIntakeModal";
import DashboardShell from "../components/DashboardShell";
import SampleStatusRail from "../components/SampleStatusRail";
import DrugShieldModal from "@/app/components/DrugShieldModal";
import FamilyMembersPanel from "../components/FamilyMembersPanel";
import { bookingsAPI, dispatchAPI } from "@/lib/api";
import { FEATURE_FLAGS } from "@/config/featureFlags";
import { BiomarkerMatrix } from "../components/BiomarkerMatrix";
import { DoctorBriefingModal } from "../components/DoctorBriefingModal";
import { FamilySwiperWheel } from "../components/FamilySwiperWheel";
import { EmergencySOSWidget } from "../components/EmergencySOSWidget";
import { MedicineCabinetGrid } from "../components/MedicineCabinetGrid";
import { PhlebotomistRadar } from "../components/PhlebotomistRadar";
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
} from "lucide-react";

interface UserData {
  full_name: string;
  role: string;
}

export default function PatientDashboard() {
  const [user, setUser] = useState<UserData | null>(null);
  const [lang, setLang] = useState<'en' | 'te' | 'hi'>('en');
  const [bookings, setBookings] = useState<any[]>([]);
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

  // Industry-First Feature Modals
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [showDrugShieldModal, setShowDrugShieldModal] = useState(false);
  const [showBriefingModal, setShowBriefingModal] = useState(false);

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

  const dict = {
    en: {
      welcome: "Welcome",
      greeting: "Here's your health overview for today",
      bookTest: "Book a Service",
      upcoming: "Upcoming Appointments",
      completed: "Completed Services",
      prescriptions: "Active Prescriptions",
      records: "Health Records",
      quick: "Quick Actions",
      bookLab: "Book Lab Test",
      video: "Video Consultation",
      medicine: "Order Medicine",
      pmjay: "AB-PMJAY Cashless"
    },
    te: {
      welcome: "స్వాగతం",
      greeting: "ఈ రోజు మీ ఆరోగ్య స్థూలదృష్టి ఇక్కడ ఉంది",
      bookTest: "సేవను బుక్ చేయండి",
      upcoming: "రాబోయే నియామకాలు",
      completed: "పూర్తయిన సేవలు",
      prescriptions: "క్రియాశీల ప్రిస్క్రిప్షన్లు",
      records: "ఆరోగ్య రికార్డులు",
      quick: "త్వరిత చర్యలు",
      bookLab: "ల్యాబ్ టెస్ట్ బుక్ చేయండి",
      video: "వీడియో కన్సల్టేషన్",
      medicine: "మందులను ఆర్డర్ చేయండి",
      pmjay: "ఆయుష్మాన్ భారత్ ఉచిత బుకింగ్"
    },
    hi: {
      welcome: "स्वागत है",
      greeting: "यहाँ आज के लिए आपका स्वास्थ्य अवलोकन है",
      bookTest: "सेवा बुक करें",
      upcoming: "आगामी अपॉइंटमेंट",
      completed: "पूर्ण की गई सेवाएँ",
      prescriptions: "सक्रिय नुस्खे",
      records: "स्वास्थ्य रिकॉर्ड",
      quick: "त्वरित कार्य",
      bookLab: "लैब टेस्ट बुक करें",
      video: "वीडियो परामर्श",
      medicine: "दवा ऑर्डर करें",
      pmjay: "आयुष्मान भारत मुफ्त बुकिंग"
    }
  };
  const t = dict[lang];

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
        if (data.success) {
          setProfile(data.data);
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

    // Fetch all in parallel
    Promise.all([fetchBookings(), fetchMe(), fetchPatientUpgradeData()]);
  }, []);

  // Discover the dispatch_id for a scheduled (slot-booked) appointment once
  // the backend's Celery task creates it. On-demand dispatches already know
  // their dispatch_id at creation time (localStorage, set below) — a
  // scheduled booking's dispatch_requests row appears later, asynchronously,
  // with nothing to tell this tab it now exists.
  useEffect(() => {
    if (activeDispatchId) return;
    const candidates = bookings.filter(
      (b) => b.status === "confirmed" && b.booking_kind === "home_collection"
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
        // Refresh bookings
        const bRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/bookings/my`, {
          headers: { 'Authorization': `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('token') : ''}` }
        });
        if (bRes.ok) {
          const bData = await bRes.json();
          setBookings(bData.bookings || []);
        }
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
        // Refresh bookings
        const bRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/bookings/my`, {
          headers: { 'Authorization': `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('token') : ''}` }
        });
        if (bRes.ok) {
          const bData = await bRes.json();
          setBookings(bData.bookings || []);
        }
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
        // Refresh bookings
        const bRes = await fetch(`${apiBase}/api/bookings/my`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const bData = await bRes.json();
        if (bData.success) setBookings(bData.data.bookings || []);
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


  const upcomingCount = bookings.filter(b => ["confirmed", "pending_review", "slot_allotted"].includes(b.status)).length;
  const completedCount = bookings.filter(b => b.status === "completed").length;
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
        // Refresh bookings
        const bRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/bookings/my-bookings`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const bData = await bRes.json();
        if (bData.success) setBookings(bData.data.bookings || []);
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
        </>
      }
    >

        {/* ── Patient Dashboard Upgrade Subsystems ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 24 }}>
          {FEATURE_FLAGS.ENABLE_FAMILY_SWIPER && <FamilySwiperWheel />}
          {FEATURE_FLAGS.ENABLE_EMERGENCY_SOS && <EmergencySOSWidget />}
          {FEATURE_FLAGS.ENABLE_PREVENTIVE_BIOMARKERS && <BiomarkerMatrix />}
          {FEATURE_FLAGS.ENABLE_SMART_MEDICINE_CABINET && <MedicineCabinetGrid />}
          {FEATURE_FLAGS.ENABLE_PHLEBO_RADAR && activeDispatchId && (
            <PhlebotomistRadar otpPin={patientOtp || "4829"} />
          )}
        </div>

        {/* ── Sample Status Tracking (Spec 3) ──────────────────── */}
        <div style={{ marginBottom: 24 }}>
          <SampleStatusRail />
        </div>

        {/* Industry-First Features Quick-Action Bar */}
        <div className="cm-action-rail" style={{ marginBottom: 24 }}>
          <button
            type="button"
            className="cm-action-chip"
            style={{ borderColor: "var(--cm-active-line)", color: "var(--cm-active)", fontWeight: 700 }}
            onClick={() => setShowVoiceModal(true)}
          >
            <Mic size={16} />
            AI Voice Scribe & Triage
          </button>
          <button
            type="button"
            className="cm-action-chip"
            style={{ borderColor: "var(--cm-done-line)", color: "var(--cm-done)", fontWeight: 700 }}
            onClick={() => setShowDrugShieldModal(true)}
          >
            <Shield size={16} />
            DrugShield AI (80% Generic Savings)
          </button>
          {FEATURE_FLAGS.ENABLE_DEMO_DISPATCH_TRACKER && (
            <button
              type="button"
              className="cm-action-chip"
              style={{
                borderColor: showLiveTracker ? "var(--cm-active)" : "var(--cm-line-strong)",
                background: showLiveTracker ? "var(--cm-active-surface)" : "var(--cm-surface)",
                color: showLiveTracker ? "var(--cm-active)" : "var(--cm-ink)",
                fontWeight: 700
              }}
              onClick={() => setShowLiveTracker(!showLiveTracker)}
            >
              <Bike size={16} />
              {showLiveTracker ? "Hide Demo Tracker" : "Phlebo Dispatch (Demo)"}
            </button>
          )}
          {FEATURE_FLAGS.ENABLE_DOCTOR_BRIEFING && (
            <button
              type="button"
              className="cm-action-chip"
              style={{ borderColor: "var(--cm-line-strong)", color: "var(--cm-ink)", fontWeight: 700 }}
              onClick={() => setShowBriefingModal(true)}
            >
              <FileText size={16} />
              AI Doctor Briefing (PDF / QR)
            </button>
          )}
        </div>

        {/* Doctor Briefing Modal */}
        {FEATURE_FLAGS.ENABLE_DOCTOR_BRIEFING && (
          <DoctorBriefingModal isOpen={showBriefingModal} onClose={() => setShowBriefingModal(false)} />
        )}

        {/* ─── RAPIDO-STYLE LIVE PHLEBOTOMIST DISPATCH & ORDER TRACKER ─── */}
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
                      CallMedex Rapido Phlebo Dispatch
                    </h3>
                    {!isReal && (
                      <span style={{ fontSize: "0.68rem", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", background: "var(--cm-warn-surface, #FBF0DC)", color: "var(--cm-warn, #8A5606)", border: "1px solid var(--cm-warn-line, #E4C88C)", padding: "3px 8px", borderRadius: 4 }}>
                        Sample data
                      </span>
                    )}
                  </div>
                  <p style={{ margin: "4px 0 0 0", fontSize: "0.82rem", color: "var(--cm-ink-3)" }}>
                    {isSearching
                      ? "Connecting with verified phlebotomists in your immediate delivery radius..."
                      : isArrived
                      ? "Phlebotomist is at your doorstep. Please share the sterile OTP to begin."
                      : "Phlebotomist is en route with temperature-controlled cold chain sample kit."}
                  </p>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  {/* Status Badge */}
                  <span className={`cm-rapido-badge ${
                    isSearching ? "cm-rapido-badge--searching" : isArrived ? "cm-rapido-badge--arrived" : "cm-rapido-badge--enroute"
                  }`}>
                    {isSearching ? "Broadcasting Request" : isArrived ? "Arrived at Doorstep" : "Phlebo En Route"}
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
                  <div className="cm-rapido-step__label">Confirmed</div>
                </div>
                <div className={`cm-rapido-step ${isSearching ? "cm-rapido-step--current" : "cm-rapido-step--completed"}`}>
                  <div className="cm-rapido-step__bar" />
                  <div className="cm-rapido-step__label">Phlebo Search</div>
                </div>
                <div className={`cm-rapido-step ${isEnRoute ? "cm-rapido-step--current" : isArrived ? "cm-rapido-step--completed" : ""}`}>
                  <div className="cm-rapido-step__bar" />
                  <div className="cm-rapido-step__label">En Route</div>
                </div>
                <div className={`cm-rapido-step ${isArrived ? "cm-rapido-step--current" : ""}`}>
                  <div className="cm-rapido-step__bar" />
                  <div className="cm-rapido-step__label">Doorstep Arrival</div>
                </div>
                <div className="cm-rapido-step">
                  <div className="cm-rapido-step__bar" />
                  <div className="cm-rapido-step__label">Sample in Lab</div>
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
                    Broadcasting to Nearby Certified Phlebotomists...
                  </h4>
                  <p style={{ margin: "0 0 16px 0", fontSize: "0.85rem", color: "var(--cm-ink-3)", maxWidth: 500 }}>
                    Scanning 8 verified NABL phlebotomists within 4.5 km of your location. Typical assignment takes under 2 minutes.
                  </p>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
                    <span style={{ fontSize: "0.78rem", background: "var(--cm-surface)", border: "1px solid var(--cm-line)", padding: "4px 12px", borderRadius: 9999, color: "var(--cm-ink-2)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <CheckCircle2 size={12} style={{ color: "var(--cm-done)" }} /> 100% Vaccinated
                    </span>
                    <span style={{ fontSize: "0.78rem", background: "var(--cm-surface)", border: "1px solid var(--cm-line)", padding: "4px 12px", borderRadius: 9999, color: "var(--cm-ink-2)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <CheckCircle2 size={12} style={{ color: "var(--cm-done)" }} /> Sterile Single-Use Vacutainer Kits
                    </span>
                    <span style={{ fontSize: "0.78rem", background: "var(--cm-surface)", border: "1px solid var(--cm-line)", padding: "4px 12px", borderRadius: 9999, color: "var(--cm-ink-2)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <CheckCircle2 size={12} style={{ color: "var(--cm-done)" }} /> 2°C–8°C Temperature Monitored Box
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
                          {isArrived ? "At Your Doorstep" : `~${provider.eta_minutes || 12} mins`}
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "var(--cm-ink-3)" }}>
                          {isArrived ? "Ring Bell / Meet Provider" : `${provider.distance_km || 1.8} km away`}
                        </div>
                      </div>

                      <div className="cm-rapido-captain__actions">
                        <a
                          href={`tel:${provider.mobile || "+919849023145"}`}
                          className="cm-btn cm-btn--primary cm-btn--sm"
                          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700, textDecoration: "none" }}
                        >
                          <Phone size={14} /> Call Phlebo
                        </a>
                        <a
                          href={`https://wa.me/${(provider.mobile || "919849023145").replace(/[^0-9]/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="cm-btn cm-btn--secondary cm-btn--sm"
                          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700, textDecoration: "none" }}
                        >
                          <MessageCircle size={14} /> WhatsApp
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
                          Share this OTP with Phlebotomist
                        </h4>
                        <p style={{ margin: 0, fontSize: "0.85rem", color: "rgba(255,255,255,0.85)", maxWidth: 460 }}>
                          Share this secure code only when the phlebotomist arrives at your doorstep with sterile, tamper-evident vacutainer tubes.
                        </p>
                      </div>

                      <div style={{ textAlign: "center" }}>
                        <div className="cm-rapido-otp-code">
                          {otp}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "#38bdf8", marginTop: 4, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <CheckCircle2 size={12} style={{ color: "#38bdf8" }} /> Sterile Vacuum Seal Assured
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* ─── INTERACTIVE ORGAN BODY MAP & HEALTH TWIN ─── */}
        <InteractiveBodyMap />

        {/* Modern KPI Stats */}
        <div className="cm-kpi-grid">
          <div className="cm-kpi-card">
            <div className="cm-kpi-card__accent cm-kpi-card__accent--active" />
            <div>
              <div className="cm-kpi-card__label">{t.upcoming}</div>
              <div className="cm-kpi-card__value">{upcomingCount}</div>
              <div className="cm-kpi-card__subtitle">Scheduled bookings</div>
            </div>
            <div className="cm-kpi-card__icon" style={{ background: "var(--cm-active-surface)", color: "var(--cm-active)" }}>
              <Calendar size={22} />
            </div>
          </div>

          <div className="cm-kpi-card">
            <div className="cm-kpi-card__accent cm-kpi-card__accent--done" />
            <div>
              <div className="cm-kpi-card__label">{t.completed}</div>
              <div className="cm-kpi-card__value">{completedCount}</div>
              <div className="cm-kpi-card__subtitle">Past appointments</div>
            </div>
            <div className="cm-kpi-card__icon" style={{ background: "var(--cm-done-surface)", color: "var(--cm-done)" }}>
              <CheckCircle2 size={22} />
            </div>
          </div>

          <div className="cm-kpi-card">
            <div className="cm-kpi-card__accent cm-kpi-card__accent--waiting" />
            <div>
              <div className="cm-kpi-card__label">{t.prescriptions}</div>
              <div className="cm-kpi-card__value">0</div>
              <div className="cm-kpi-card__subtitle">Active prescriptions</div>
            </div>
            <div className="cm-kpi-card__icon" style={{ background: "var(--cm-waiting-surface)", color: "var(--cm-waiting)" }}>
              <Pill size={22} />
            </div>
          </div>

          <div className="cm-kpi-card">
            <div className="cm-kpi-card__accent" />
            <div>
              <div className="cm-kpi-card__label">{t.records}</div>
              <div className="cm-kpi-card__value">0</div>
              <div className="cm-kpi-card__subtitle">Health documents</div>
            </div>
            <div className="cm-kpi-card__icon" style={{ background: "var(--cm-surface-3)", color: "var(--cm-navy)" }}>
              <BarChart3 size={22} />
            </div>
          </div>
        </div>

        {/* Slot Allotment Notifications */}
        {allottedBookings.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ marginBottom: 12, fontFamily: "var(--font-body)", fontSize: "1.05rem", display: "flex", alignItems: "center", gap: 8, color: "var(--cm-ink)" }}>
              <Bell size={18} style={{ color: "var(--cm-waiting)" }} />
              Slot Allotment Notifications
              <span style={{ backgroundColor: "var(--cm-waiting-surface)", color: "var(--cm-waiting)", border: "1px solid var(--cm-waiting-line)", borderRadius: 20, padding: "2px 10px", fontSize: "0.72rem", fontWeight: 700 }}>
                {allottedBookings.length} pending
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
                        <Clock size={16} /> Time Slot Allotted
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
                        <CheckCircle2 size={16} /> Accept
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
                        <XCircle size={16} /> Decline
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Quick Actions */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontFamily: "var(--font-body)", fontSize: "1.2rem", color: "var(--cm-ink)", fontWeight: 800 }}>
            {t.quick}
          </h3>
          <span style={{ fontSize: "0.82rem", color: "var(--cm-ink-3)", fontWeight: 600 }}>
            Instant Doorstep Healthcare & Telemedicine
          </span>
        </div>

        <div className="cm-quick-grid">
          {/* Urgent Home Collection */}
          <button
            type="button"
            onClick={() => openDispatchModal("phlebotomist", "home_collection", "Blood Collection")}
            disabled={requestingDispatch !== null}
            className="cm-quick-card"
          >
            <div className="cm-quick-card__stripe" style={{ background: "linear-gradient(90deg, #10b981, #06b6d4)" }} />
            <div>
              <div className="cm-quick-card__icon-disc" style={{ background: "rgba(16, 185, 129, 0.12)", color: "#10b981" }}>
                <Droplet size={24} />
              </div>
              <h4 className="cm-quick-card__title">
                {requestingDispatch === "phlebotomist" ? "Requesting..." : "Urgent Home Collection"}
              </h4>
              <p className="cm-quick-card__subtitle">
                Certified Phlebotomist at your doorstep in 15–30 mins.
              </p>
            </div>
            <span className="cm-quick-card__tag" style={{ background: "rgba(16, 185, 129, 0.1)", color: "#059669", border: "1px solid rgba(16, 185, 129, 0.25)" }}>
              Free Home Visit · NABL Lab
            </span>
          </button>

          {/* Urgent Home Doctor */}
          <button
            type="button"
            onClick={() => openDispatchModal("doctor", "home_visit", "Home Doctor")}
            disabled={requestingDispatch !== null}
            className="cm-quick-card"
          >
            <div className="cm-quick-card__stripe" style={{ background: "linear-gradient(90deg, #3b82f6, #6366f1)" }} />
            <div>
              <div className="cm-quick-card__icon-disc" style={{ background: "rgba(59, 130, 246, 0.12)", color: "#3b82f6" }}>
                <Stethoscope size={24} />
              </div>
              <h4 className="cm-quick-card__title">
                {requestingDispatch === "doctor" ? "Requesting..." : "Urgent Home Doctor"}
              </h4>
              <p className="cm-quick-card__subtitle">
                MBBS / MD Physician physical examination & prescription.
              </p>
            </div>
            <span className="cm-quick-card__tag" style={{ background: "rgba(59, 130, 246, 0.1)", color: "#2563eb", border: "1px solid rgba(59, 130, 246, 0.25)" }}>
              Verified Physician
            </span>
          </button>

          {/* Urgent Home Nurse */}
          <button
            type="button"
            onClick={() => openDispatchModal("nurse", "nursing_care", "Home Nurse")}
            disabled={requestingDispatch !== null}
            className="cm-quick-card"
          >
            <div className="cm-quick-card__stripe" style={{ background: "linear-gradient(90deg, #f43f5e, #e11d48)" }} />
            <div>
              <div className="cm-quick-card__icon-disc" style={{ background: "rgba(244, 63, 94, 0.12)", color: "#f43f5e" }}>
                <HeartHandshake size={24} />
              </div>
              <h4 className="cm-quick-card__title">
                {requestingDispatch === "nurse" ? "Requesting..." : "Urgent Home Nurse"}
              </h4>
              <p className="cm-quick-card__subtitle">
                IV drip, wound dressing, vitals check & post-op nursing.
              </p>
            </div>
            <span className="cm-quick-card__tag" style={{ background: "rgba(244, 63, 94, 0.1)", color: "#e11d48", border: "1px solid rgba(244, 63, 94, 0.25)" }}>
              B.Sc Nursing Certified
            </span>
          </button>

          {/* Urgent Medicine Delivery */}
          <button
            type="button"
            onClick={() => openDispatchModal("pharmacy_delivery", "medicine_delivery", "Pharmacy Delivery")}
            disabled={requestingDispatch !== null}
            className="cm-quick-card"
          >
            <div className="cm-quick-card__stripe" style={{ background: "linear-gradient(90deg, #f59e0b, #ea580c)" }} />
            <div>
              <div className="cm-quick-card__icon-disc" style={{ background: "rgba(245, 158, 11, 0.12)", color: "#f59e0b" }}>
                <Truck size={24} />
              </div>
              <h4 className="cm-quick-card__title">
                {requestingDispatch === "pharmacy_delivery" ? "Requesting..." : "Urgent Medicine Delivery"}
              </h4>
              <p className="cm-quick-card__subtitle">
                Hyperlocal pharmacy delivery with 80% generic savings.
              </p>
            </div>
            <span className="cm-quick-card__tag" style={{ background: "rgba(245, 158, 11, 0.1)", color: "#d97706", border: "1px solid rgba(245, 158, 11, 0.25)" }}>
              Under 45 Mins
            </span>
          </button>

          {/* Urgent Home Dietitian */}
          <button
            type="button"
            onClick={() => openDispatchModal("dietitian", "nutritional_assessment", "Home Dietitian")}
            disabled={requestingDispatch !== null}
            className="cm-quick-card"
          >
            <div className="cm-quick-card__stripe" style={{ background: "linear-gradient(90deg, #10b981, #059669)" }} />
            <div>
              <div className="cm-quick-card__icon-disc" style={{ background: "rgba(16, 185, 129, 0.12)", color: "#059669" }}>
                <Apple size={24} />
              </div>
              <h4 className="cm-quick-card__title">
                {requestingDispatch === "dietitian" ? "Requesting..." : "Home Dietitian & Nutrition"}
              </h4>
              <p className="cm-quick-card__subtitle">
                Bedside nutritional audit, diabetes MNT &amp; tailored diet chart.
              </p>
            </div>
            <span className="cm-quick-card__tag" style={{ background: "rgba(16, 185, 129, 0.1)", color: "#059669", border: "1px solid rgba(16, 185, 129, 0.25)" }}>
              IDA Certified · ₹800 Visit
            </span>
          </button>

          {/* Urgent Home Physiotherapist */}
          <button
            type="button"
            onClick={() => openDispatchModal("physiotherapist", "physiotherapy", "Home Physiotherapist")}
            disabled={requestingDispatch !== null}
            className="cm-quick-card"
          >
            <div className="cm-quick-card__stripe" style={{ background: "linear-gradient(90deg, #0284c7, #4f46e5)" }} />
            <div>
              <div className="cm-quick-card__icon-disc" style={{ background: "rgba(2, 132, 199, 0.12)", color: "#0284c7" }}>
                <Activity size={24} />
              </div>
              <h4 className="cm-quick-card__title">
                {requestingDispatch === "physiotherapist" ? "Requesting..." : "Home Physiotherapist"}
              </h4>
              <p className="cm-quick-card__subtitle">
                Bedside joint mobilization, spine rehab &amp; stroke recovery.
              </p>
            </div>
            <span className="cm-quick-card__tag" style={{ background: "rgba(2, 132, 199, 0.1)", color: "#0284c7", border: "1px solid rgba(2, 132, 199, 0.25)" }}>
              MIAP Certified · ₹800 Visit
            </span>
          </button>

          {/* Video Consultation */}
          <a href="/booking?type=video_consult" className="cm-quick-card">
            <div className="cm-quick-card__stripe" style={{ background: "linear-gradient(90deg, #8b5cf6, #a855f7)" }} />
            <div>
              <div className="cm-quick-card__icon-disc" style={{ background: "rgba(139, 92, 246, 0.12)", color: "#8b5cf6" }}>
                <Video size={24} />
              </div>
              <h4 className="cm-quick-card__title">{t.video}</h4>
              <p className="cm-quick-card__subtitle">
                Connect with specialist doctor in 60 seconds with AI summary.
              </p>
            </div>
            <span className="cm-quick-card__tag" style={{ background: "rgba(139, 92, 246, 0.1)", color: "#7c3aed", border: "1px solid rgba(139, 92, 246, 0.25)" }}>
              Instant HD Connect
            </span>
          </a>

          {/* AB-PMJAY Cashless */}
          <a href="/dashboard/patient/pmjay" className="cm-quick-card">
            <div className="cm-quick-card__stripe" style={{ background: "linear-gradient(90deg, #10b981, #f59e0b)" }} />
            <div>
              <div className="cm-quick-card__icon-disc" style={{ background: "rgba(16, 185, 129, 0.12)", color: "#059669" }}>
                <Building2 size={24} />
              </div>
              <h4 className="cm-quick-card__title">{t.pmjay}</h4>
              <p className="cm-quick-card__subtitle">
                Government Ayushman Bharat ₹5 Lakh Cashless Coverage.
              </p>
            </div>
            <span className="cm-quick-card__tag" style={{ background: "rgba(16, 185, 129, 0.1)", color: "#059669", border: "1px solid rgba(16, 185, 129, 0.25)" }}>
              Zero Out-of-Pocket
            </span>
          </a>

          {/* AI Reports */}
          <a href="/dashboard/patient/reports" className="cm-quick-card">
            <div className="cm-quick-card__stripe" style={{ background: "linear-gradient(90deg, #06b6d4, #8b5cf6)" }} />
            <div>
              <div className="cm-quick-card__icon-disc" style={{ background: "rgba(6, 182, 212, 0.12)", color: "#06b6d4" }}>
                <Sparkles size={24} />
              </div>
              <h4 className="cm-quick-card__title">AI Reports & Insights</h4>
              <p className="cm-quick-card__subtitle">
                Instant plain-language translation of complex lab reports.
              </p>
            </div>
            <span className="cm-quick-card__tag" style={{ background: "rgba(6, 182, 212, 0.1)", color: "#0284c7", border: "1px solid rgba(6, 182, 212, 0.25)" }}>
              NextGen Liquid AI
            </span>
          </a>
        </div>

        {/* Family Members */}
        <FamilyMembersPanel />

        {/* Recent Bookings */}
        <h3 style={{ marginBottom: 16, fontFamily: "var(--font-body)", fontSize: "1.1rem", color: "var(--cm-ink)" }}>Recent Bookings</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {loading ? (
            <div className="card" style={{ padding: "32px", textAlign: "center", color: "var(--cm-ink-3)" }}>Loading...</div>
          ) : bookings?.length > 0 ? (
            bookings.map((booking: any) => (
              <div key={booking.id} className="card" style={{ padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid var(--cm-line)", borderRadius: "var(--cm-radius)", background: "var(--cm-surface)" }}>
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
                      Cancel
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
                        <Bike size={13} /> Track Phlebo
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
                      <RefreshCw size={13} /> Quick Re-Order
                    </button>
                  </div>
                </div>
              </div>

            ))
          ) : (
            <div className="card" style={{ padding: "32px", textAlign: "center", color: "var(--color-gray-500)" }}>
              <p>No recent bookings found.</p>
              <a href="/booking" className="btn btn-primary" style={{ marginTop: 12, display: "inline-block" }}>Book Your First Service</a>
            </div>
          )}
          {bookings?.length > 0 && (
            <a href="/dashboard/patient/bookings" className="btn btn-outline" style={{ marginTop: 8, display: 'block', textAlign: 'center' }}>
              View All Bookings History
            </a>
          )}
        </div>

        {/* Health Records Placeholder */}
        <div className="card" style={{ marginTop: 32, padding: 32, textAlign: "center", border: abhaLinkedNumber ? "2px solid var(--cm-done-line)" : "2px dashed var(--cm-line)", backgroundColor: abhaLinkedNumber ? "var(--cm-done-surface)" : "var(--cm-surface)" }}>
          <div style={{ display: "inline-flex", padding: 12, borderRadius: "50%", background: "var(--cm-surface-3)", color: "var(--cm-navy)", marginBottom: 8 }}>
            <ShieldCheck size={30} />
          </div>
          <h3 style={{ fontFamily: "var(--font-body)", fontSize: "1.1rem", marginBottom: 8, color: "var(--cm-ink)" }}>ABHA Health Records</h3>
          {abhaLinkedNumber ? (
            <div>
              <p style={{ color: "var(--cm-done)", fontSize: "1rem", fontWeight: "bold", margin: "16px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <CheckCircle2 size={16} /> ABHA Linked: <span style={{ letterSpacing: 1.5 }}>{abhaLinkedNumber}</span>
              </p>
              <p style={{ color: "var(--cm-ink-3)", fontSize: "0.9rem", maxWidth: 400, margin: "0 auto 16px" }}>
                Your health records are synced with ABDM.
              </p>
            </div>
          ) : (
            <div>
              <p style={{ color: "var(--color-gray-500)", fontSize: "0.9rem", maxWidth: 400, margin: "0 auto 16px" }}>
                Link your ABHA (Ayushman Bharat Health Account) to access your complete health history from any ABDM-registered facility.
              </p>
              <button className="btn btn-teal" onClick={() => setShowAbhaModal(true)}>Manage ABHA Account</button>
            </div>
          )}
        </div>

        {/* ─── Profile Details ─── */}
        <DashboardProfile profile={profile} role="patient" />
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

      {/* Floating Emergency SOS Button */}
      <button
        className="sos-floating-btn"
        onClick={async () => {
          if (!await customConfirm("EMERGENCY SOS ALERT: This will broadcast a high-priority beacon to nearby emergency doctors and ambulance services. Your current location will be shared. Continue?")) return;

          try {
            // Get actual GPS coordinates from the browser
            let lat: number;
            let lng: number;
            let address = "Emergency Location";

            try {
              const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                if (!navigator.geolocation) {
                  reject(new Error("Geolocation not available"));
                  return;
                }
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                  enableHighAccuracy: true,
                  timeout: 10000,
                  maximumAge: 60000,
                });
              });
              lat = position.coords.latitude;
              lng = position.coords.longitude;
              address = `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
            } catch (geoErr) {
              // Geolocation failed — prompt user for manual input
              const manualLat = prompt("Could not get your GPS location. Please enter your latitude:");
              const manualLng = prompt("Please enter your longitude:");
              if (!manualLat || !manualLng) {
                toast("Emergency SOS cancelled — location is required.");
                return;
              }
              lat = parseFloat(manualLat);
              lng = parseFloat(manualLng);
              if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                toast("Invalid coordinates. Emergency SOS cancelled.");
                return;
              }
              address = `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
            }

            const token = localStorage.getItem("token");
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/dispatch/emergency-sos`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
              body: JSON.stringify({ lat, lng, address }),
            });
            const data = await res.json();
            if (res.ok && data.dispatch_id) {
              localStorage.setItem("activeDispatchId", data.dispatch_id);
              setActiveDispatchId(data.dispatch_id);
              toast(data.message || "EMERGENCY BEACON DISPATCHED!");
            } else {
              toast(data.detail || data.message || "Failed to send emergency SOS. Please call emergency services directly.");
            }
          } catch (e) {
            toast("Failed to send emergency SOS. Please call emergency services directly (108 for ambulance).");
          }
        }}
      >
        <AlertTriangle size={18} style={{ marginRight: 6 }} /> EMERGENCY SOS
      </button>

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
              <RefreshCw size={20} style={{ color: "var(--cm-active)" }} /> Quick Re-Order Confirmation
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--cm-ink-3)", marginBottom: 16 }}>
              Re-book your past test package or prescription order with 1 click:
            </p>

            <div style={{ backgroundColor: "var(--cm-surface-2)", borderRadius: 10, padding: 16, marginBottom: 20, border: "1px solid var(--cm-line)" }}>
              <div style={{ fontWeight: 700, color: "var(--cm-ink)", fontSize: "0.95rem", textTransform: "capitalize", marginBottom: 4 }}>
                {reorderBooking.service_type.replace('_', ' ')}
              </div>
              <div style={{ fontSize: "0.82rem", color: "var(--cm-ink-3)", marginBottom: 8 }}>
                {reorderBooking.notes || `Previous Booking ID: ${reorderBooking.id?.slice(0, 8)}`}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", fontWeight: 700, color: "var(--cm-active)", borderTop: "1px dashed var(--cm-line)", paddingTop: 8 }}>
                <span>Estimated Price:</span>
                <span>₹{reorderBooking.total_price || 350}</span>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setShowReorderModal(false)}
                style={{ flex: 1, padding: "12px", borderRadius: 8, border: "1px solid var(--cm-line)", background: "var(--cm-surface)", cursor: "pointer", fontWeight: 600, color: "var(--cm-ink)" }}
              >
                Cancel
              </button>
              <button
                onClick={confirmQuickReorder}
                disabled={reorderLoading}
                style={{ flex: 1, padding: "12px", borderRadius: 8, border: "none", background: "var(--cm-active)", color: "white", fontWeight: 700, cursor: reorderLoading ? "wait" : "pointer" }}
              >
                {reorderLoading ? "Processing..." : "Confirm & Re-Order"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

