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
        {(() => {
          // This pill used to read "<ROLE> VERIFIED" unconditionally, for
          // everyone, including a doctor whose provider profile did not exist
          // at all. A provider who believes they are verified has no reason to
          // chase why no patient can find them — say what the record says.
          const status = String(profile.verification_status || "").toLowerCase();
          if (status === "verified") return <Pill tone="done">{role.toUpperCase()} VERIFIED</Pill>;
          if (status === "rejected") return <Pill tone="urgent">VERIFICATION REJECTED</Pill>;
          if (!profile.profile_exists && profile.profile_exists !== undefined) {
            return <Pill tone="urgent">PROFILE INCOMPLETE</Pill>;
          }
          return <Pill tone="waiting">VERIFICATION PENDING</Pill>;
        })()}
      </div>

      {String(profile.verification_status || "").toLowerCase() !== "verified" && (
        <p className="cm-profile__notice">
          Patients cannot find you in search until this profile is complete and
          verified. Fill in any field showing “N/A” below, then contact CallMedex
          support to complete verification.
        </p>
      )}

      <dl className="cm-profile">
        {/* Common account fields */}
        {field(User, "Full Name", profile.full_name || profile.organization_name || profile.pharmacy_name)}
        {field(Mail, "Email Address", profile.email)}
        {field(Phone, "Phone Number", profile.mobile || profile.mobile_number || profile.phone)}

        {/* Doctor specific details */}
        {role === "doctor" && (
          <>
            {/* No placeholder credentials. Showing "General Medicine" and
                "MBBS, MD" to a doctor whose record held neither made a missing
                profile look like a complete one. */}
            {field(Stethoscope, "Specialization", profile.specialization)}
            {field(FileText, "Medical License Number", profile.medical_license_number)}
            {field(GraduationCap, "Qualification", profile.qualification)}
          </>
        )}

        {/* Nurse specific details */}
        {role === "nurse" && (
          <>
            {field(Stethoscope, "Nursing Specialization", profile.specialization)}
            {/* "NC-2026-REG" was a literal placeholder rendered as if it were
                this nurse's council registration number. */}
            {field(FileText, "Nursing Council Reg No", profile.license_number || profile.registration_number)}
            {field(MapPin, "Service City", profile.district || profile.city)}
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

        {/* Dentist specific details */}
        {role === "dentist" && (
          <>
            {field(Building2, "Dental Clinic Name", profile.clinic_name || profile.hospital_clinic_name)}
            {field(FileText, "Dental Council Reg No", profile.dental_council_reg || profile.registration_number || profile.license_number)}
            {field(GraduationCap, "Dental Qualification", profile.qualification || "BDS / MDS")}
          </>
        )}

        {/* Dietitian specific details */}
        {role === "dietitian" && (
          <>
            {field(Stethoscope, "Dietetic Specialization", profile.specialization || "Clinical Nutrition & Dietetics")}
            {field(FileText, "IDA / Council Reg No", profile.license_number || profile.registration_number)}
            {field(GraduationCap, "Nutrition Qualification", profile.qualification || "M.Sc. Clinical Nutrition / RD")}
          </>
        )}

        {/* Physiotherapist specific details */}
        {role === "physiotherapist" && (
          <>
            {field(Stethoscope, "Therapy Specialization", profile.specialization || "Orthopaedic & Neuro Rehabilitation")}
            {field(FileText, "Physiotherapy Reg No", profile.license_number || profile.registration_number)}
            {field(GraduationCap, "Clinical Qualification", profile.qualification || "BPT / MPT Physical Therapy")}
          </>
        )}
      </dl>
    </Panel>
  );
}
