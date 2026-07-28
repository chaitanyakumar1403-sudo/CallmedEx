"""
Sample lifecycle, batching and chain of custody.

The task ends when a verified sample is handed to the laboratory. Nothing here
knows anything about reports.
"""
from pathlib import Path

MIGRATION = Path(__file__).resolve().parents[2] / "database" / "task1_processing_center_foundation.sql"


def _sql() -> str:
    return MIGRATION.read_text(encoding="utf-8")


def test_samples_gains_every_new_column():
    sql = _sql()
    for col in ("processing_center_id", "booking_subject_id", "tube_type_code",
                "expected_tube_type_code", "tube_mismatch_ack", "batch_id",
                "verified_at", "verified_by", "verification", "rejection_code",
                "sent_to_lab_at", "lab_reference", "report_status"):
        assert col in sql, col


def test_barcode_becomes_nullable_with_a_partial_unique_index():
    """A sample exists from booking time; the barcode is bound at scan.

    The uniqueness must survive the change: two tubes sharing one barcode
    means two patients' blood sharing an identity.
    """
    sql = _sql()
    assert "ALTER COLUMN barcode DROP NOT NULL" in sql
    # The old inline UNIQUE must go by its real Postgres-assigned name, or it
    # silently survives and every NULL-barcode row after the first collides.
    assert "DROP CONSTRAINT IF EXISTS samples_barcode_key" in sql
    # Must stay UNIQUE — a plain CREATE INDEX would drop enforcement entirely.
    assert "CREATE UNIQUE INDEX IF NOT EXISTS uq_samples_barcode" in sql
    assert "WHERE barcode IS NOT NULL" in sql


def test_the_full_status_chain_is_allowed():
    sql = _sql()
    for status in ("'pending_collection'", "'collected'", "'in_transit'",
                   "'received'", "'verified'", "'rejected'",
                   "'batched'", "'sent_to_lab'"):
        assert status in sql, status


def test_every_rejection_reason_from_the_brief_is_representable():
    sql = _sql()
    for code in ("wrong_tube", "barcode_missing", "label_missing", "broken_tube",
                 "leaking_tube", "hemolyzed", "insufficient_sample", "other"):
        assert f"'{code}'" in sql, code


def test_the_custody_chain_covers_every_event():
    sql = _sql()
    for event in ("'registered'", "'barcode_bound'", "'verified'",
                  "'batched'", "'sent_to_lab'"):
        assert event in sql, event


def test_batches_are_created_and_sealable():
    sql = _sql()
    assert "CREATE TABLE IF NOT EXISTS sample_batches" in sql
    assert "CREATE TABLE IF NOT EXISTS sample_tests" in sql
    for status in ("'open'", "'sealed'", "'sent_to_lab'", "'acknowledged'"):
        assert status in sql, status


def test_report_tables_exist_for_the_future_task():
    sql = _sql()
    assert "CREATE TABLE IF NOT EXISTS lab_reports" in sql
    assert "CREATE TABLE IF NOT EXISTS report_fetch_jobs" in sql
    for status in ("'pending'", "'fetching'", "'ready'", "'failed'", "'manual'"):
        assert status in sql, status


def test_the_barcode_is_the_lookup_key_the_future_agent_will_use():
    sql = _sql()
    assert "barcode TEXT NOT NULL" in sql   # on report_fetch_jobs


def test_no_automation_is_implemented_in_this_task():
    """Tables only. The MocDoc agent is a later task and must not appear here."""
    from pathlib import Path
    backend = Path(__file__).resolve().parents[1] / "app"
    hits = [
        p for p in backend.rglob("*.py")
        if "mocdoc" in p.read_text(encoding="utf-8", errors="ignore").lower()
    ]
    assert hits == [], f"MocDoc automation leaked into: {hits}"
