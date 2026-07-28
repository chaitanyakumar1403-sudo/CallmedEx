"""
Tube derivation.

The barcode goes on a tube, so a sample row IS a tube. Getting this grain wrong
makes "tube type correct?" unanswerable and a partial rejection unrepresentable.
"""
import pytest

from app.services.tube_derivation import derive_tubes


def _t(bt_id, svc_id, tubes):
    return {"booking_test_id": bt_id, "home_service_id": svc_id, "tube_type_codes": tubes}


def test_the_worked_example_from_the_spec():
    """CBC + LFT + KFT for one person => 2 tubes, not 3."""
    tubes = derive_tubes([
        _t("bt1", "cbc", ["edta_lavender"]),
        _t("bt2", "lft", ["sst_gold"]),
        _t("bt3", "kft", ["sst_gold"]),
    ])
    assert len(tubes) == 2
    by_code = {t["tube_type_code"]: t for t in tubes}
    assert by_code["edta_lavender"]["booking_test_ids"] == ["bt1"]
    assert sorted(by_code["sst_gold"]["booking_test_ids"]) == ["bt2", "bt3"]


def test_one_test_needing_two_tubes_contributes_to_both():
    tubes = derive_tubes([_t("bt1", "panel", ["edta_lavender", "sst_gold"])])
    assert len(tubes) == 2
    for t in tubes:
        assert t["booking_test_ids"] == ["bt1"]


def test_no_tests_yields_no_tubes():
    assert derive_tubes([]) == []


def test_a_service_with_no_tube_requirement_is_skipped():
    """An ECG is a home service but draws no blood, so it produces no tube."""
    assert derive_tubes([_t("bt1", "ecg", [])]) == []


def test_output_is_deterministically_ordered():
    """Barcode label print order must not vary run to run."""
    a = derive_tubes([_t("bt1", "x", ["sst_gold"]), _t("bt2", "y", ["citrate_blue"])])
    b = derive_tubes([_t("bt2", "y", ["citrate_blue"]), _t("bt1", "x", ["sst_gold"])])
    assert [t["tube_type_code"] for t in a] == [t["tube_type_code"] for t in b]
    assert [t["tube_type_code"] for t in a] == ["citrate_blue", "sst_gold"]


def test_duplicate_test_lines_do_not_duplicate_a_booking_test_id():
    tubes = derive_tubes([
        _t("bt1", "cbc", ["edta_lavender"]),
        _t("bt1", "cbc", ["edta_lavender"]),
    ])
    assert len(tubes) == 1
    assert tubes[0]["booking_test_ids"] == ["bt1"]


def test_a_line_with_no_booking_test_id_is_skipped():
    """A malformed row must not be grouped into a tube it can never resolve to."""
    assert derive_tubes([{"booking_test_id": "", "home_service_id": "cbc",
                          "tube_type_codes": ["edta_lavender"]}]) == []
    assert derive_tubes([{"booking_test_id": None, "home_service_id": "cbc",
                          "tube_type_codes": ["edta_lavender"]}]) == []
    assert derive_tubes([{"home_service_id": "cbc",
                          "tube_type_codes": ["edta_lavender"]}]) == []


def test_a_malformed_line_does_not_poison_its_valid_siblings():
    """One bad row must not cost the patient a tube they legitimately need."""
    tubes = derive_tubes([
        {"booking_test_id": "", "home_service_id": "x", "tube_type_codes": ["sst_gold"]},
        {"booking_test_id": "bt1", "home_service_id": "cbc", "tube_type_codes": ["edta_lavender"]},
    ])
    assert tubes == [{"tube_type_code": "edta_lavender", "booking_test_ids": ["bt1"]}]
