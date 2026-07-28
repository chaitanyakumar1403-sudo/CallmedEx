"""
Tube derivation — pure, no database.

One sample row per (booking subject x tube type). A patient booking
CBC + LFT + KFT gives two tubes: one lavender EDTA carrying the CBC, one SST
carrying both the LFT and the KFT. That is what actually leaves the house, so
that is what gets a barcode.
"""
from typing import Dict, List


def derive_tubes(subject_tests: List[dict]) -> List[dict]:
    """Group one subject's ordered tests into the physical tubes they require.

    Each entry of `subject_tests` is:
        {"booking_test_id": str, "home_service_id": str, "tube_type_codes": [str]}

    Returns, sorted by tube_type_code so label print order is stable:
        [{"tube_type_code": str, "booking_test_ids": [str]}]
    """
    grouped: Dict[str, List[str]] = {}

    for line in subject_tests:
        booking_test_id = line.get("booking_test_id")
        if not booking_test_id:
            continue
        # A service with no tube requirement (an ECG) draws no blood.
        for code in line.get("tube_type_codes") or []:
            ids = grouped.setdefault(code, [])
            if booking_test_id not in ids:
                ids.append(booking_test_id)

    return [
        {"tube_type_code": code, "booking_test_ids": grouped[code]}
        for code in sorted(grouped)
    ]
