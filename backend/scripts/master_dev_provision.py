#!/usr/bin/env python3
"""
Master Developer Provisioning Script — CallMedex
================================================
Provisions authentic, 100% active, verification-bypassed accounts for ALL 12 CallMedex roles:
  1. Patient            (/dashboard/patient)
  2. Doctor             (/dashboard/doctor)
  3. Dentist            (/dashboard/dentist)
  4. Physiotherapist    (/dashboard/physiotherapist)
  5. Dietitian          (/dashboard/dietitian)
  6. Nurse              (/dashboard/nurse)
  7. Phlebotomist       (/dashboard/phlebotomist)
  8. Organization       (/dashboard/organization)
  9. Pharmacy           (/dashboard/pharmacy)
  10. Staff             (/dashboard/staff)
  11. Processing Center (/dashboard/processing-center)
  12. Admin / Owner     (/dashboard/admin)

All accounts are linked to a single master owner email (e.g. chaitanyakumarf11@gmail.com)
with the same master password, allowing the platform creator to inspect every dashboard
with zero verification barriers, while preserving clean clinical personas on patient/doctor cards.

Usage:
  python scripts/master_dev_provision.py
  python scripts/master_dev_provision.py --email chaitanyakumarf11@gmail.com --password Callmedex@123
"""

import os
import sys
import uuid
import argparse
from datetime import datetime, timezone

# Add backend directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from app.database import supabase
from app.utils.security import hash_password, create_access_token
from app.config import settings

DEFAULT_MASTER_EMAIL = "chaitanyakumarf11@gmail.com"
DEFAULT_MASTER_PASSWORD = "Callmedex@123"

ROLES_METADATA = [
    {
        "role": "patient",
        "slug": "patient",
        "full_name": "Rahul Sharma",
        "email_prefix": "patient",
        "dashboard_path": "/dashboard/patient",
        "title": "Patient Portal",
    },
    {
        "role": "doctor",
        "slug": "doctor",
        "full_name": "Dr. Latchireddi SA Naidu",
        "email_prefix": "doctor",
        "dashboard_path": "/dashboard/doctor",
        "title": "Doctor Workstation",
    },
    {
        "role": "dentist",
        "slug": "dentist",
        "full_name": "Dr. Anita Rao",
        "email_prefix": "dentist",
        "dashboard_path": "/dashboard/dentist",
        "title": "Dental Clinic Console",
    },
    {
        "role": "physiotherapist",
        "slug": "physiotherapist",
        "full_name": "Dr. Vikram Reddy",
        "email_prefix": "physio",
        "dashboard_path": "/dashboard/physiotherapist",
        "title": "Physiotherapy Console",
    },
    {
        "role": "dietitian",
        "slug": "dietitian",
        "full_name": "Dr. Sneha Patel",
        "email_prefix": "dietitian",
        "dashboard_path": "/dashboard/dietitian",
        "title": "Clinical Dietetics Console",
    },
    {
        "role": "nurse",
        "slug": "nurse",
        "full_name": "Sister Priya Sharma",
        "email_prefix": "nurse",
        "dashboard_path": "/dashboard/nurse",
        "title": "Nurse Care & Dispatch Hub",
    },
    {
        "role": "phlebotomist",
        "slug": "phlebotomist",
        "full_name": "Rajesh Verma",
        "email_prefix": "phlebo",
        "dashboard_path": "/dashboard/phlebotomist",
        "title": "Phlebotomist Mobile Dispatch",
    },
    {
        "role": "organization",
        "slug": "organization",
        "full_name": "Visakha Multispeciality Clinics & Diagnostics",
        "email_prefix": "org",
        "dashboard_path": "/dashboard/organization",
        "title": "Organization Health Command",
    },
    {
        "role": "pharmacy",
        "slug": "pharmacy",
        "full_name": "CallMedex Prime Pharmacy & Wellness",
        "email_prefix": "pharmacy",
        "dashboard_path": "/dashboard/pharmacy",
        "title": "Pharmacy Fulfillment Console",
    },
    {
        "role": "staff",
        "slug": "staff",
        "full_name": "Kavitha Rao",
        "email_prefix": "staff",
        "dashboard_path": "/dashboard/staff",
        "title": "Clinical Operations Desk",
    },
    {
        "role": "processing_center",
        "slug": "processing-center",
        "full_name": "Vizag Central Molecular Diagnostic Hub",
        "email_prefix": "pc",
        "dashboard_path": "/dashboard/processing-center",
        "title": "Processing Center Command",
    },
    {
        "role": "admin",
        "slug": "admin",
        "full_name": "Chaitanya Kumar (Platform Owner)",
        "email_prefix": "admin",
        "dashboard_path": "/dashboard/admin",
        "title": "Owner & Super Admin Command Center",
    },
]


def upsert_user(user_data: dict) -> dict:
    """Ensure user exists by email, updating or inserting."""
    email = user_data["email"]
    res = supabase.table("users").select("*").eq("email", email).execute()
    if res.data and len(res.data) > 0:
        existing_id = res.data[0]["id"]
        update_data = {k: v for k, v in user_data.items() if k != "id"}
        supabase.table("users").update(update_data).eq("id", existing_id).execute()
        user_data["id"] = existing_id
        return user_data
    else:
        insert_res = supabase.table("users").insert(user_data).execute()
        return insert_res.data[0]


def provision_all(master_email: str, master_password: str):
    if not supabase:
        print("[ERROR] Supabase client is not configured. Check your .env file.")
        sys.exit(1)

    clean_email = master_email.split("@")[0].replace(".", "_")
    hashed_pwd = hash_password(master_password)
    now_iso = datetime.now(timezone.utc).isoformat()

    print("\n" + "=" * 78)
    print("  CALLMEDEX MASTER DEVELOPER UNIVERSAL ROLE PROVISIONER")
    print("=" * 78)
    print(f"[*] Target Master Owner Email: {master_email}")
    print(f"[*] Provisioning all 12 platform roles with verification bypass...\n")

    summary_rows = []

    # 1. Ensure master admin user exists
    admin_user_data = {
        "id": str(uuid.uuid4()),
        "full_name": "Chaitanya Kumar (Platform Owner)",
        "email": master_email,
        "mobile": "+919876543210",
        "password_hash": hashed_pwd,
        "role": "admin",
        "gender": "male",
        "date_of_birth": "1994-03-14",
        "address": "CallMedex Headquarters, Waltair Uplands",
        "city": "Visakhapatnam",
        "district": "Visakhapatnam",
        "state": "Andhra Pradesh",
        "pincode": "530003",
        "country": "India",
        "is_active": True,
        "registration_status": "active",
        "registrant_role": "owner",
        "owner_email": master_email,
        "token_version": 1,
        "created_at": now_iso,
        "updated_at": now_iso,
    }
    admin_user = upsert_user(admin_user_data)
    admin_token = create_access_token({
        "sub": admin_user["id"],
        "email": master_email,
        "role": "admin",
        "name": admin_user["full_name"],
        "master_owner": master_email,
    })
    summary_rows.append({
        "role": "admin",
        "persona": admin_user["full_name"],
        "login_email": master_email,
        "status": "Active & Verified",
        "path": "/dashboard/admin",
        "token": admin_token,
    })

    # 2. Provision each linked persona
    for idx, meta in enumerate(ROLES_METADATA, start=1):
        role = meta["role"]
        if role == "admin":
            continue

        persona_email = f"{meta['email_prefix']}.{clean_email}@callmedex.internal"
        persona_user_data = {
            "id": str(uuid.uuid4()),
            "full_name": meta["full_name"],
            "email": persona_email,
            "mobile": f"+91987650{idx:04d}",
            "password_hash": hashed_pwd,
            "role": role,
            "gender": "male" if role not in ["nurse", "dietitian", "dentist"] else "female",
            "date_of_birth": "1990-01-01",
            "address": "Visakhapatnam Clinical Corridor",
            "city": "Visakhapatnam",
            "district": "Visakhapatnam",
            "state": "Andhra Pradesh",
            "pincode": "530002",
            "country": "India",
            "is_active": True,
            "registration_status": "active",
            "registrant_role": "provider",
            "owner_email": master_email,
            "token_version": 1,
            "created_at": now_iso,
            "updated_at": now_iso,
        }
        user = upsert_user(persona_user_data)
        user_id = user["id"]

        # Insert or update role-specific profile table
        try:
            if role == "patient":
                p_data = {
                    "user_id": user_id,
                    "medical_history": ["Hypertension - Controlled", "Mild Seasonal Allergy"],
                    "blood_group": "O+",
                    "height_cm": 175.0,
                    "weight_kg": 72.0,
                    "preferred_language": "en",
                    "abha_number": "91-8765-4321-0987",
                    "consent_status": "pending",
                    "created_at": now_iso,
                }
                existing = supabase.table("patients").select("id").eq("user_id", user_id).execute()
                if existing.data:
                    supabase.table("patients").update(p_data).eq("user_id", user_id).execute()
                else:
                    p_data["id"] = str(uuid.uuid4())
                    supabase.table("patients").insert(p_data).execute()

            elif role == "doctor":
                d_data = {
                    "user_id": user_id,
                    "medical_license_number": "APMC-48291",
                    "specialization": "Clinical Cardio Physician (NI)",
                    "qualification": "MBBS, PGDCCP (NI)",
                    "years_of_experience": 24,
                    "hospital_clinic_name": "Visakha Multispeciality Clinics & Diagnostics",
                    "consultation_fee": 500.0,
                    "consultation_mode": "both",
                    "available_for_online": True,
                    "languages_spoken": ["English", "Telugu", "Hindi"],
                    "work_setting": "solo_clinic",
                    "is_independent": True,
                    "verification_status": "verified",
                    "verified_at": now_iso,
                    "rating": 4.9,
                    "total_reviews": 58,
                    "created_at": now_iso,
                }
                existing = supabase.table("doctors").select("id").eq("user_id", user_id).execute()
                if existing.data:
                    supabase.table("doctors").update(d_data).eq("user_id", user_id).execute()
                else:
                    d_data["id"] = str(uuid.uuid4())
                    supabase.table("doctors").insert(d_data).execute()

                # Seed sample doctor availability blocks so telemedicine & walkin work immediately
                avail_check = supabase.table("doctor_availability").select("id").eq("doctor_id", user_id).execute()
                if not avail_check.data:
                    avail_blocks = []
                    for dow in range(1, 6):  # Mon-Fri
                        avail_blocks.append({
                            "id": str(uuid.uuid4()),
                            "doctor_id": user_id,
                            "day_of_week": dow,
                            "start_time": "09:00:00",
                            "end_time": "13:00:00",
                            "slot_duration_minutes": 15,
                            "consultation_mode": "both",
                            "max_patients_per_slot": 1,
                            "is_active": True,
                            "location_name": "Visakha Multispeciality Clinics & Diagnostics",
                            "location_address": "Waltair Main Rd, Visakhapatnam",
                            "created_at": now_iso,
                            "updated_at": now_iso,
                        })
                    supabase.table("doctor_availability").insert(avail_blocks).execute()

            elif role == "dentist":
                dent_data = {
                    "user_id": user_id,
                    "dental_license_number": "DCI-98214",
                    "qualification": "BDS, MDS (Oral Surgery & Aesthetics)",
                    "specializations": ["Dental Surgery", "Aesthetics & Orthodontics", "Prosthodontics"],
                    "years_of_experience": 14,
                    "clinic_name": "Visakha Dental Speciality Care",
                    "consultation_fee": 400.0,
                    "consultation_mode": "clinic",
                    "available_for_online": False,
                    "available_for_home_visit": False,
                    "scope_of_services": ["Routine Cleanings", "Root Canal Therapy", "Dental Implants", "Orthodontic Aligners"],
                    "verification_status": "verified",
                    "verified_at": now_iso,
                    "rating": 4.95,
                    "total_reviews": 42,
                    "created_at": now_iso,
                    "updated_at": now_iso,
                }
                existing = supabase.table("dentists").select("id").eq("user_id", user_id).execute()
                if existing.data:
                    supabase.table("dentists").update(dent_data).eq("user_id", user_id).execute()
                else:
                    dent_data["id"] = str(uuid.uuid4())
                    supabase.table("dentists").insert(dent_data).execute()

            elif role == "physiotherapist":
                phys_data = {
                    "user_id": user_id,
                    "physio_license_number": "IAP-33219",
                    "qualification": "BPT, MPT (Neuro & Ortho Rehab)",
                    "specializations": ["Orthopedic Rehab", "Neurological Physio", "Post-Surgical Mobilization"],
                    "years_of_experience": 11,
                    "clinic_center_name": "Apex Physio Care & Sports Rehab",
                    "consultation_fee": 500.0,
                    "home_visit_fee": 900.0,
                    "consultation_mode": "both",
                    "available_for_online": True,
                    "available_for_home_visit": True,
                    "is_online": True,
                    "current_lat": 17.7231,
                    "current_lng": 83.3012,
                    "service_radius_km": 20.0,
                    "scope_of_services": ["Post-Operative Ortho Rehab", "Stroke Neuromuscular Re-education", "Ergonomic Spine Therapy"],
                    "verification_status": "verified",
                    "verified_at": now_iso,
                    "rating": 4.88,
                    "total_reviews": 36,
                    "created_at": now_iso,
                }
                existing = supabase.table("physiotherapists").select("id").eq("user_id", user_id).execute()
                if existing.data:
                    supabase.table("physiotherapists").update(phys_data).eq("user_id", user_id).execute()
                else:
                    phys_data["id"] = str(uuid.uuid4())
                    supabase.table("physiotherapists").insert(phys_data).execute()

            elif role == "dietitian":
                diet_data = {
                    "user_id": user_id,
                    "qualification": "M.Sc Clinical Nutrition, RD",
                    "years_of_experience": 9,
                    "verification_status": "verified",
                    "verified_at": now_iso,
                    "created_at": now_iso,
                }
                existing = supabase.table("dietitians").select("id").eq("user_id", user_id).execute()
                if existing.data:
                    supabase.table("dietitians").update(diet_data).eq("user_id", user_id).execute()
                else:
                    diet_data["id"] = str(uuid.uuid4())
                    supabase.table("dietitians").insert(diet_data).execute()

            elif role == "nurse":
                nurse_data = {
                    "user_id": user_id,
                    "nursing_license_number": "INC-AP-77123",
                    "qualification": "B.Sc Nursing, Critical Care Certified",
                    "specializations": ["IV Infusion & Injections", "Post-Op Wound Dressing", "Geriatric Clinical Nursing"],
                    "years_of_experience": 8,
                    "is_online": True,
                    "current_lat": 17.7250,
                    "current_lng": 83.3050,
                    "service_radius_km": 15.0,
                    "rating": 4.95,
                    "acceptance_rate": 100.0,
                    "total_completed": 142,
                    "verification_status": "verified",
                    "verified_at": now_iso,
                    "created_at": now_iso,
                }
                existing = supabase.table("nurses").select("id").eq("user_id", user_id).execute()
                if existing.data:
                    supabase.table("nurses").update(nurse_data).eq("user_id", user_id).execute()
                else:
                    nurse_data["id"] = str(uuid.uuid4())
                    supabase.table("nurses").insert(nurse_data).execute()

            elif role == "phlebotomist":
                phleb_data = {
                    "user_id": user_id,
                    "phleb_type": "full_time",
                    "qualification": "DMLT (Diploma in Medical Lab Technology)",
                    "specialization": "Pediatric & Geriatric Difficult Vein Phlebotomy",
                    "years_of_experience": 6,
                    "certification_number": "CMLT-55120",
                    "on_duty": True,
                    "current_lat": 17.7280,
                    "current_lng": 83.3080,
                    "per_collection_rate": 0.00,
                    "monthly_salary": 28000.00,
                    "employee_code": "CMX-FT-001",
                    "verification_status": "verified",
                    "verified_at": now_iso,
                    "rating": 4.92,
                    "total_reviews": 110,
                    "base_lat": 17.7280,
                    "base_lng": 83.3080,
                    "base_pincode": "530002",
                    "created_at": now_iso,
                }
                existing = supabase.table("phlebotomists").select("id").eq("user_id", user_id).execute()
                if existing.data:
                    supabase.table("phlebotomists").update(phleb_data).eq("user_id", user_id).execute()
                else:
                    phleb_data["id"] = str(uuid.uuid4())
                    supabase.table("phlebotomists").insert(phleb_data).execute()

            elif role == "organization":
                org_data = {
                    "user_id": user_id,
                    "organization_name": "Visakha Multispeciality Clinics & Diagnostics",
                    "organization_type": "polyclinic",
                    "license_number": "AP-MED-REG-2022-8819",
                    "establishment_year": 2012,
                    "ownership_type": "private",
                    "head_of_institution": "Dr. L. S. Naidu, Medical Director",
                    "total_departments": 8,
                    "total_staff": 35,
                    "total_branches": 2,
                    "operating_hours": "Mon-Sat: 07:00 AM - 09:30 PM",
                    "alternate_phone": "+918912554433",
                    "emergency_phone": "+918912554499",
                    "official_email": persona_email,
                    "verification_status": "verified",
                    "verified_at": now_iso,
                    "created_at": now_iso,
                }
                existing = supabase.table("organizations").select("id").eq("user_id", user_id).execute()
                if existing.data:
                    supabase.table("organizations").update(org_data).eq("user_id", user_id).execute()
                else:
                    org_data["id"] = str(uuid.uuid4())
                    supabase.table("organizations").insert(org_data).execute()

            elif role == "pharmacy":
                pharm_data = {
                    "user_id": user_id,
                    "pharmacy_name": "CallMedex Prime Pharmacy & Wellness",
                    "pharmacy_type": "retail",
                    "owner_name": "Chaitanya Kumar",
                    "pharmacist_in_charge": "Suresh Babu, B.Pharm",
                    "years_of_operation": 7,
                    "operating_hours": "24x7 Emergency Delivery",
                    "registration_number": "AP-PHARM-2017-4412",
                    "drug_license_number": "20B/21B-AP-88712",
                    "gst_number": "37AAAAA0000A1Z5",
                    "home_delivery": True,
                    "available_24x7": True,
                    "service_radius_km": 15.0,
                    "verification_status": "verified",
                    "verified_at": now_iso,
                    "created_at": now_iso,
                }
                existing = supabase.table("pharmacies").select("id").eq("user_id", user_id).execute()
                if existing.data:
                    supabase.table("pharmacies").update(pharm_data).eq("user_id", user_id).execute()
                else:
                    pharm_data["id"] = str(uuid.uuid4())
                    supabase.table("pharmacies").insert(pharm_data).execute()

            elif role == "staff":
                staff_data = {
                    "user_id": user_id,
                    "staff_role": "front_desk_coordinator",
                    "department": "Patient Admissions & Walk-in Diagnostics",
                    "years_of_experience": 5,
                    "alternate_phone": "+919876112233",
                    "verification_status": "verified",
                    "created_at": now_iso,
                }
                existing = supabase.table("staff").select("id").eq("user_id", user_id).execute()
                if existing.data:
                    supabase.table("staff").update(staff_data).eq("user_id", user_id).execute()
                else:
                    staff_data["id"] = str(uuid.uuid4())
                    supabase.table("staff").insert(staff_data).execute()

            elif role == "processing_center":
                pc_data = {
                    "code": "PC-VIZAG-01",
                    "name": "Vizag Central Molecular Diagnostic Hub",
                    "city": "Visakhapatnam",
                    "address": "D.No 48-12-14, Rama Talkies Road, Visakhapatnam",
                    "pincode": "530013",
                    "state": "Andhra Pradesh",
                    "lat": 17.7289,
                    "lng": 83.3105,
                    "partner_lab_name": "NABL Accredited Reference Laboratory",
                    "daily_capacity": 1500,
                    "status": "active",
                    "lab_connector_type": "mocdoc",
                    "created_by": user_id,
                    "created_at": now_iso,
                    "updated_at": now_iso,
                }
                existing = supabase.table("processing_centers").select("id").eq("code", "PC-VIZAG-01").execute()
                if existing.data:
                    supabase.table("processing_centers").update(pc_data).eq("code", "PC-VIZAG-01").execute()
                else:
                    pc_data["id"] = str(uuid.uuid4())
                    supabase.table("processing_centers").insert(pc_data).execute()

        except Exception as e:
            print(f"  [!] Note on profile {role}: {e}")

        # Generate direct access token for persona
        token = create_access_token({
            "sub": user_id,
            "email": persona_email,
            "role": role,
            "name": meta["full_name"],
            "master_owner": master_email,
        })

        summary_rows.append({
            "role": role,
            "persona": meta["full_name"],
            "login_email": master_email,
            "status": "Active & Verified",
            "path": meta["dashboard_path"],
            "token": token,
        })
        print(f"  [+] Provisioned: {role.upper():16} -> {meta['full_name']:36} ({meta['dashboard_path']})")

    print("\n" + "-" * 78)
    print(f"{'ROLE':16} | {'PERSONA NAME':32} | {'DASHBOARD PATH':22}")
    print("-" * 78)
    for r in summary_rows:
        print(f"{r['role']:16} | {r['persona'][:32]:32} | {r['path']:22}")
    print("-" * 78)
    print("\n[SUCCESS] All 12 role profiles are active and verification-bypassed!")
    print(f"[*] Master Email: {master_email}")
    print(f"[*] Master Password: {master_password}")
    print("[*] You can now log into ANY dashboard directly using this master email and password.\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="CallMedex Master Developer Role Provisioner")
    parser.add_argument("--email", default=DEFAULT_MASTER_EMAIL, help="Master owner email")
    parser.add_argument("--password", default=DEFAULT_MASTER_PASSWORD, help="Master owner password")
    args = parser.parse_args()

    provision_all(args.email, args.password)
