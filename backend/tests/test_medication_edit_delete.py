"""Edit and delete for the medicine cabinet: owner-scoped, and an edited pill
count restarts the burn-down anchor just as a refill does."""
import asyncio

import pytest
from fastapi import HTTPException

from app.routers import patient_sos


class _Res:
    def __init__(self, data):
        self.data = data


class _Query:
    def __init__(self, db, op=None, payload=None):
        self.db, self.op, self.payload, self.filters = db, op, payload, {}

    def select(self, *_a, **_k): return self
    def limit(self, *_a): return self
    def update(self, payload): self.op, self.payload = "update", payload; return self
    def delete(self): self.op = "delete"; return self
    def eq(self, col, val): self.filters[col] = val; return self

    def execute(self):
        rows = [r for r in self.db.rows if all(r.get(k) == v for k, v in self.filters.items())]
        if self.op == "update":
            self.db.updates.append(self.payload)
            for r in rows:
                r.update(self.payload)
        elif self.op == "delete":
            self.db.rows = [r for r in self.db.rows if r not in rows]
            return _Res([])
        return _Res([dict(r) for r in rows])


class _DB:
    def __init__(self, rows):
        self.rows, self.updates = rows, []

    def table(self, _name):
        return _Query(self)


@pytest.fixture
def db(monkeypatch):
    fake = _DB([{"id": "m1", "patient_id": "p1", "medicine_name": "Paracetamol",
                 "dosage": "1 tablet", "total_pills": 10, "remaining_pills": 0, "pills_per_day": 2}])
    monkeypatch.setattr(patient_sos, "supabase", fake)
    return fake


def test_edit_updates_fields_and_resets_the_count_anchor(db):
    payload = patient_sos.MedicationUpdate(dosage=" 2 tablets ", remaining_pills=20, pills_per_day=4)
    out = asyncio.run(patient_sos.update_patient_medication("m1", payload, user={"sub": "p1"}))
    assert out["status"] == "updated"
    assert out["medication"]["dosage"] == "2 tablets"
    assert out["medication"]["days_left"] == 5
    assert "last_counted_at" in db.updates[0]


def test_edit_without_count_leaves_the_anchor_alone(db):
    asyncio.run(patient_sos.update_patient_medication(
        "m1", patient_sos.MedicationUpdate(medicine_name="Dolo 650"), user={"sub": "p1"}))
    assert "last_counted_at" not in db.updates[0]


def test_another_patient_cannot_edit_or_delete(db):
    with pytest.raises(HTTPException) as e:
        asyncio.run(patient_sos.update_patient_medication(
            "m1", patient_sos.MedicationUpdate(dosage="x"), user={"sub": "intruder"}))
    assert e.value.status_code == 404
    with pytest.raises(HTTPException):
        asyncio.run(patient_sos.delete_patient_medication("m1", user={"sub": "intruder"}))
    assert len(db.rows) == 1


def test_blank_name_is_rejected(db):
    with pytest.raises(HTTPException) as e:
        asyncio.run(patient_sos.update_patient_medication(
            "m1", patient_sos.MedicationUpdate(medicine_name="   "), user={"sub": "p1"}))
    assert e.value.status_code == 400


def test_delete_removes_only_the_owners_row(db):
    out = asyncio.run(patient_sos.delete_patient_medication("m1", user={"sub": "p1"}))
    assert out["status"] == "deleted"
    assert db.rows == []
