# CallMedex Forensic Intelligence: Test Coverage, Mocking Architecture & Test Verification

> **Analysis Scope**: Exhaustive audit of the testing infrastructure across Backend (`backend/tests/` — 74 test modules), Web Frontend (`frontend/e2e/`, `frontend/scripts/`), and Mobile Client (`mobile/__tests__/`), analyzing test execution fidelity, mocking paradigms (`FakeQuery`), live integration vs unit boundaries, and testing blind spots.

---

## 1. Test Suite Topology & Summary

| Test Layer | Test Runner / Engine | Number of Test Suites | Dominant Mocking Strategy | Execution Speed | Real External I/O |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Backend API & Logic** | `pytest` | **74 files** (~350+ test cases) | `FakeQuery` / `FakeResult` in-memory stand-in for PostgREST | Fast (< 15s total) | None (100% Mocked) |
| **Frontend Unit & Lint**| Node Test Runner (`node --test`) | 2 test suites + UI linter | Synthetic React DOM / AST analysis | Instant (< 2s) | None |
| **Frontend E2E** | `@playwright/test` | 6 `.spec.ts` files | Live or Staging API server | Slow (~60-120s) | Network HTTP |
| **Mobile Client** | `jest` + `jest-expo` | Native Jest suites | React Native mock renderer | Fast (< 10s) | None |

---

## 2. Backend Mocking Architecture: The `FakeQuery` Pattern

### 2.1 Implementation Mechanics

Because CallMedex interacts with PostgreSQL through the `supabase-py` PostgREST client rather than direct raw SQL, test suites construct a lightweight in-memory query simulator (`FakeQuery` / `FakeResult`).

```python
class FakeResult:
    def __init__(self, data):
        self.data = data

class FakeQuery:
    def __init__(self, db, table):
        self.db, self.table_name = db, table
        self.filters = []
        self._op = "select"

    def select(self, *_a, **_k): self._op = "select"; return self
    def insert(self, payload): self._op, self._payload = "insert", payload; return self
    def update(self, payload): self._op, self._payload = "update", payload; return self
    def eq(self, col, val): self.filters.append((col, "eq", val)); return self
    def execute(self):
        # In-memory dict evaluation against self.db[self.table_name]
        return FakeResult(filtered_records)
```

### 2.2 Forensic Benefits of `FakeQuery`
- **Deterministic State**: State machine assertions (e.g. `test_sample_lifecycle.py`, `test_visit_completion_and_payment_integrity.py`) can step through all 13 specimen custody states deterministically.
- **Financial Rule Verification**: Payout calculations (part-time per-tube vs salaried full-time) and 80/20 platform fee splits are rigorously validated without touching live Razorpay or Stripe accounts.
- **Zero Cloud Footprint**: Backend tests can run in any offline CI environment without Supabase access tokens.

---

## 3. High-Fidelity Forensic Coverage Catalog (Top 10 Test Modules)

| Test File | Lines of Code | Key Verification Scenarios Covered |
| :--- | :--- | :--- |
| `test_processing_center.py` | 30,202 B (~700 lines) | Barcode accessioning, tube rack placement, centrifuge timing, sample rejection workflows, and batch dispatch. |
| `test_mediassist_inbound_routes.py` | 28,528 B (~680 lines) | HMAC signature validation, timestamp replay protection (300s window), booking sync, catalog queries, and phlebotomist availability callbacks. |
| `test_marketplace.py` | 26,707 B (~650 lines) | Universal provider discovery, distance matrix geofiltering, fee schedules, and doctor specialty indexing. |
| `test_sample_lifecycle.py` | 24,331 B (~590 lines) | Complete specimen custody chain from bedside collection to lab accessioning; duplicate payout prevention on retries. |
| `test_roster.py` | 22,134 B (~550 lines) | Daily phlebotomist auto-assignment, multi-centre coverage, shift attendance matching, and supervisor overrides. |
| `test_urgent_dispatch.py` | 20,873 B (~500 lines) | High-priority SOS dispatches, radius-expanding fan-out rounds (3km -> 6km -> 10km), and timeout expirations. |
| `test_end_to_end_flow_gaps.py` | 16,314 B (~400 lines) | Integration across patient booking, slot allocation, phlebotomist dispatch, sample handover, and PDF report delivery. |
| `test_liquid_health_endpoints.py` | 16,345 B (~400 lines) | Rapid home nursing, IV therapy booking, and urgent home emergency flows. |
| `test_phlebo_stock.py` | 15,291 B (~380 lines) | Phlebotomist vacutainer inventory tracking, kit replenishment, and expiry alerts. |
| `test_visit_completion_and_payment_integrity.py` | 14,949 B (~370 lines) | Proof-of-collection OTP verification, razorpay capture confirmation, and phlebotomist wallet ledger credits. |

---

## 4. Frontend & E2E Testing Topology

### 4.1 Playwright End-to-End Suites (`frontend/e2e/`)
1. `booking.spec.ts`: Patient diagnostic test selection, slot picking, address input, and Razorpay checkout modal initiation.
2. `provider-dispatch.spec.ts`: Phlebotomist offer acceptance, turn-by-turn simulation, and tube barcode scanning.
3. `pharmacy.spec.ts`: Prescription upload, pharmacist item matching, and order fulfillment.
4. `ui-wave1.spec.ts`: Cross-browser responsive regression testing across mobile viewports (375px) and desktop viewports (1440px).

### 4.2 Accessibility & Lint Verification
- `scripts/lint-ui.mjs`: Scans React components for unstyled elements, missing accessible label attributes (`aria-label`), and contrast tokens.
- `@axe-core/playwright`: Executes automated WCAG 2.1 AA audits during Playwright runs.

---

## 5. Critical Testing Blind Spots & Limitations

1. **No Live Database Integration Tests**:
   - **Blind Spot**: Because tests run against `FakeQuery` rather than real PostgreSQL, Postgres-specific triggers, generated columns, foreign key cascade constraints, and custom SQL functions (`database/*.sql`) are never exercised in automated CI.
   - **Risk**: A valid PostgREST filter that references a non-existent database column will pass `FakeQuery` if the mock doesn't strictly validate schemas against PostgreSQL DDL.
2. **Missing Concurrency & Race-Condition Tests**:
   - Tests run synchronously in a single thread. Race conditions during simultaneous phlebotomist offer acceptance (`idx_bookings_unique_active_slot`) are not tested with concurrent worker threads.
3. **No Webhook E2E with Real Providers**:
   - Razorpay, Daily.co, and MSG91 webhook testing relies on synthetic payload injection; live gateway sandbox callbacks are not part of automated CI.
