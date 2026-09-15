/**
 * Prescriber identity helpers.
 *
 * A registration number is shown or sent only if it exists on the provider's
 * own profile (GET /api/auth/me). Never substitute a placeholder — NMC
 * guidelines require the real number on every prescription, and the backend
 * refuses to issue one without it.
 */

type ProviderProfile = Record<string, unknown> | null | undefined;

// Doctors keep it in medical_license_number; allied roles in their own column.
const REG_FIELDS = [
  "medical_license_number",
  "license_number",
  "dietitian_license_number",
  "physio_license_number",
  "dental_license_number",
  "registration_number",
] as const;

export function prescriberRegNumber(profile: ProviderProfile): string {
  if (!profile) return "";
  for (const f of REG_FIELDS) {
    const v = profile[f];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

export function formatDoctorName(name?: string | null, fallback = "Dr. Verified Medical Specialist"): string {
  if (!name) return fallback;
  const trimmed = name.trim();
  return /^Dr\.?\s+/i.test(trimmed) || /^Doctor\s+/i.test(trimmed) ? trimmed : `Dr. ${trimmed}`;
}

export const REG_MISSING_MESSAGE =
  "Your medical registration number is not on file. Add it in Doctor Profile before issuing e-prescriptions.";
