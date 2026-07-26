"use client";

import { Icon, Panel, Pill } from "@/components/ui";
import {
  Building2, Clock, FileText, FlaskConical, GraduationCap, Mail,
  MapPin, Package, Phone, Stethoscope, Syringe, User,
} from "@/components/ui/icons";
import type { LucideIcon } from "@/components/ui/icons";

interface DashboardProfileProps {
  profile: any;
  role: string;
}

export default function DashboardProfile({ profile, role }: DashboardProfileProps) {
  if (!profile) return null;

  const field = (icon: LucideIcon, label: string, value: unknown, capitalize = false) => {
    const valText = value ? String(value) : "N/A";
    return (
      <div className="cm-profile__item">
        <dt className="cm-profile__label">
          <Icon as={icon} size={14} />
          {label}
        </dt>
        <dd className={`cm-profile__value${capitalize ? " cm-profile__value--cap" : ""}`}>
          {valText}
        </dd>
      </div>
    );
  };

  return (
    <Panel>
      <div className="cm-profile__head">
        <h2 className="cm-profile__title">
          <Icon as={User} size={20} />
          Registration &amp; Service Profile
        </h2>
        <Pill tone="done">{role.toUpperCase()} VERIFIED</Pill>
      </div>

      <dl className="cm-profile">
        {/* Common account fields */}
        {field(User, "Full Name", profile.full_name || profile.organization_name || profile.pharmacy_name)}
        {field(Mail, "Email Address", profile.email)}
        {field(Phone, "Phone Number", profile.mobile || profile.mobile_number || profile.phone)}

        {/* Doctor specific details */}
        {role === "doctor" && (
          <>
            {field(Stethoscope, "Specialization", profile.specialization || "General Medicine")}
            {field(FileText, "Medical License Number", profile.medical_license_number)}
            {field(GraduationCap, "Qualification", profile.qualification || "MBBS, MD")}
          </>
        )}

        {/* Nurse specific details */}
        {role === "nurse" && (
          <>
            {field(Stethoscope, "Nursing Specialization", profile.specialization || "General Nursing & Home Care")}
            {field(FileText, "Nursing Council Reg No", profile.license_number || profile.registration_number || "NC-2026-REG")}
            {field(MapPin, "Service City", profile.city || "Visakhapatnam")}
          </>
        )}

        {/* Phlebotomist specific details */}
        {role === "phlebotomist" && (
          <>
            {field(Syringe, "Employment Type", profile.phleb_type?.replace("_", " "), true)}
            {field(FileText, "Certification Number", profile.certification_number)}
            {field(FlaskConical, "Specimen Handling", "Cold-Chain Certified (2°C–8°C)")}
          </>
        )}

        {/* Pharmacy specific details */}
        {role === "pharmacy" && (
          <>
            {field(FileText, "Pharmacy Reg Number", profile.registration_number)}
            {field(Package, "Home Medicine Delivery", profile.home_delivery ? "Enabled (30-Min Express)" : "Store Pick-Up Only")}
            {field(MapPin, "Delivery Radius", `${profile.service_radius_km || 5} km Radius`)}
          </>
        )}

        {/* Organization specific details */}
        {role === "organization" && (
          <>
            {field(Building2, "Organization Type", profile.organization_type, true)}
            {field(FileText, "Hospital License No", profile.license_number)}
            {field(Clock, "Operating Hours", profile.operating_hours || "24x7 Emergency OPD")}
          </>
        )}
      </dl>
    </Panel>
  );
}
