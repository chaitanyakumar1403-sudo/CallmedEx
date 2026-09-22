from app.services.doctor_branches import resolve_branch, doctor_branch_shifts

ORG = "org-1"
NAME = "Visakha Multispeciality Clinics"
BRANCHES = [
    {"id": "main", "name": f"{NAME} (Main Facility)"},
    {"id": "b-mrp", "name": f"{NAME} (Maharanipeta)"},
]


def test_org_modal_row_uses_branch_uuid():
    av = {"organization_id": ORG, "template_group_id": "b-mrp", "location_name": "x"}
    assert resolve_branch(av, ORG, NAME, BRANCHES) == "b-mrp"


def test_org_modal_main_row_has_no_branch_uuid():
    av = {"organization_id": ORG, "template_group_id": None, "location_name": "Main Facility"}
    assert resolve_branch(av, ORG, NAME, BRANCHES) == "main"


def test_doctor_published_row_resolves_by_name_not_group_uuid():
    # template_group_id is a random group id, not a branch — the old readers
    # treated it as a branch id and the doctor matched nothing.
    av = {"template_group_id": "random-group", "location_name": f"{NAME} (Maharanipeta)"}
    assert resolve_branch(av, ORG, NAME, BRANCHES) == "b-mrp"
    av = {"template_group_id": "random-group", "location_name": f"{NAME} (Main Facility)"}
    assert resolve_branch(av, ORG, NAME, BRANCHES) == "main"


def test_other_org_and_private_clinic_rows_are_excluded():
    assert resolve_branch({"organization_id": "org-2", "location_name": NAME}, ORG, NAME, BRANCHES) is None
    assert resolve_branch({"location_name": "Dr Rao Home Clinic"}, ORG, NAME, BRANCHES) is None


def test_shift_listing_skips_online_and_foreign_rows():
    avails = [
        {"organization_id": ORG, "template_group_id": "b-mrp", "consultation_mode": "in_person",
         "day_of_week": 1, "start_time": "13:30:00", "end_time": "17:00:00", "slot_duration_minutes": 10},
        {"organization_id": ORG, "consultation_mode": "online", "day_of_week": 1,
         "start_time": "20:00", "end_time": "21:00"},
        {"location_name": "Elsewhere", "consultation_mode": "in_person", "day_of_week": 2,
         "start_time": "09:00", "end_time": "10:00"},
    ]
    assigned, shifts = doctor_branch_shifts(avails, ORG, NAME, BRANCHES)
    assert assigned == ["b-mrp"]
    assert shifts == [{
        "branch_id": "b-mrp", "branch_name": f"{NAME} (Maharanipeta)", "day_of_week": 1,
        "start_time": "13:30", "end_time": "17:00", "slot_duration_minutes": 10,
    }]
