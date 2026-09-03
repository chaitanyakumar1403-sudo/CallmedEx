export const FEATURE_FLAGS = {
  ENABLE_PREVENTIVE_BIOMARKERS: true,
  ENABLE_DOCTOR_BRIEFING: true,
  ENABLE_FAMILY_SWIPER: true,
  ENABLE_EMERGENCY_SOS: true,
  ENABLE_SMART_MEDICINE_CABINET: true,
  ENABLE_PHLEBO_RADAR: true,

  // Demo-only. Renders a fictional phlebotomist ("Ramesh Kumar") and a fixed
  // OTP against no real dispatch — a patient reads that as a real collector on
  // the way. Off unless a pitch build opts in with
  // NEXT_PUBLIC_ENABLE_DEMO_DISPATCH_TRACKER=true. Live tracking of a real
  // dispatch does not go through this flag.
  ENABLE_DEMO_DISPATCH_TRACKER:
    process.env.NEXT_PUBLIC_ENABLE_DEMO_DISPATCH_TRACKER === "true",
} as const;
