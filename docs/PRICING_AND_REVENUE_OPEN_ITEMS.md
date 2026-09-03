# Pricing & Revenue — Current State and Open Items

**Purpose:** a single place to record what the pricing engine does today, which
numbers are real versus placeholder, and what must change once the complete
payment structure is supplied.

**Last updated:** 2026-09-03
**Status:** the commercial split is confirmed and enforced — 20% platform / 80%
provider, computed on the amount the patient pays, for every provider category
except phlebotomists (per verified collection or salaried). Do not treat any
figure still marked 🟡 or 🔴 below as agreed commercial terms.

---

## 1. What is confirmed

Sourced from the signed MOUs in `mous/` (gitignored) and owner instruction.

| Term | Value | Source |
|---|---|---|
| Platform fee | **20% of the amount the patient pays** | Owner, 2026-09-03; DOCTOR ("gross consultation fee paid by the patient"), Nursing, Dietetic, Dental, Physiotherapy, ECG/X-ray MOUs |
| Partner share | **80% of the amount the patient pays** | Same |
| Applies to | Doctors, dental, dietitians, nursing, physiotherapy, diagnostic centres, ECG/X-ray | Every MOU in `mous/` |
| Does **not** apply to | Phlebotomists — ₹150 per verified collection (part time) or salaried (full time) | PART TIME / FULL TIME PHLEBO MOUs |
| Patient discount funding | **Shared in proportion** — an advertised discount lowers both shares | Owner, 2026-09-03 (supersedes the earlier dental §3.3 reading) |
| Max possible discount | **20%** — a policy ceiling, no longer a solvency limit | `provider_settings` DB CHECK |
| Phlebotomist — part time | **₹150** per *verified* collection, wallet, monthly settlement | PART TIME PHLEBO MOU §9–10 |
| Phlebotomist — full time | Salaried; **no** per-collection accrual | FULL TIME PHLEBO MOU §8 |
| Offer acceptance window | **10 minutes** | Both phlebotomist MOUs |
| Urgent booking | Carries an **extra charge**; ranks **first** in dispatch | Owner instruction |

---

## 2. What is NOT confirmed

🔴 **Blocking** — a patient or partner could see a wrong number.
🟡 **Placeholder** — safe today because it is inert, but must be set before launch.

| # | Item | Current state | Where it lives |
|---|---|---|---|
| 🔴 1 | **Urgent surcharge amount** | Quotes **₹0**. Config marked `confirmed: false`, so no figure is ever shown. Priority ordering works regardless. | `platform_settings.urgent_surcharge` |
| 🔴 2 | **Dental offer prices** | Sheet ships Offer Price **blank** — 298 services have MRP only. Marketplace shows **no saving**. | `service_catalog.reference_offer_price` |
| 🔴 3 | **Physiotherapy offer prices** | Same — 94 services, MRP only. Home Service Price column also blank. | `service_catalog.reference_offer_price` |
| 🟡 4 | **Per-partner discount** | Every partner sits at **0%**. Nobody shows a saving yet. | `provider_settings.partner_discount_pct` |
| 🟡 5 | **Full-time phlebo salary** | **₹0** placeholder. | `phlebotomists.monthly_salary` |
| 🟡 6 | **Upsell incentive rate** | **5%** — my assumption, not from any document. | `incentive_rules.reward_value` |
| 🟡 7 | **Nursing scope & prices** | No sheet supplied. Nursing MOU exists; service list does not. | `service_catalog` (absent) |
| 🟡 8 | **Doctor consultation fees** | Per-doctor, self-entered. No platform floor or cap. | `consultation_fees`, `doctors.consultation_fee` |

---

## 3. Two structural questions needing a decision

These are not missing numbers — they are model choices that change how money moves.

### 3.1 Lab economics net to zero

The lab master sheet prices every test at **exactly 20% off** MRP. If the partner
also keeps 80% per the MOU, **CallMedex retains nothing** on a lab booking:

```
CBC   MRP ₹400 → offer ₹320 (20% off)
      partner takes 80% = ₹320
      CallMedex retains  = ₹0
```

**ANSWERED (2026-09-03, owner).** The fee is 20% of the sum the patient actually
pays, for every provider category — "₹100 from one patient is ₹80 for the doctor
and ₹20 for CallMedex". The MOUs word it the same way: "20% on the **gross
consultation fee paid by the patient**" (DOCTOR), "on the **gross billing amount
paid by the client**" (Nursing), "Platform Fee (20%) / Provider Share (80%)"
(Dietetic tariff sheet).

So the base of the split is the price paid, never MRP:

```
CBC   MRP ₹400 → offer ₹320 (20% off)
      provider takes 80% of ₹320 = ₹256
      CallMedex retains 20%       = ₹64
```

`PricingService.quote()` was changed to match. The earlier reading of dental MOU
§3.3 — partner paid 80% of MRP so the discount came wholly from CallMedex's
share — is superseded; a discount now lowers both shares in proportion. That is
the one clause this trades against, and it is a deliberate, owner-made choice.

### 3.2 Which payment method is actually in force

The MOUs describe two, and they are very different cash flows:

- **Method 1 — Wallet settlement:** platform collects **100%**, deducts 20%,
  credits 80% to the partner wallet, settles monthly to their bank.
- **Method 2 — Confirmation fee:** platform collects **only its 20%** at booking;
  the partner collects the remaining 80% directly from the patient.

The **dental MOU describes Method 2** ("balance amount collected directly by the
Dental Clinic/Hospital"). But `provider_settings.payout_model` currently defaults
to **`wallet`** (Method 1) for everyone.

This matters well beyond bookkeeping: Method 1 means CallMedex holds patient
money and owes partners a monthly payout — a float, a reconciliation duty and a
settlement integration. Method 2 means it never touches the 80% at all.

**Still open.** Needs a decision per provider category, not one global default.
The 80/20 split above is settled and applies either way — this is only about who
holds the money in between.

---

## 4. Where every number lives

Everything below is **data, not code** — supplying real figures needs no deploy.

### Platform-wide — `platform_settings` (key/value)

| Key | Current | Meaning |
|---|---|---|
| `default_platform_fee_pct` | `{"percent": 20}` | Platform fee |
| `urgent_surcharge` | `{"confirmed": false, ...}` | Priority charge; `confirmed:true` + a real amount turns it on |
| `phlebo_offer_window_minutes` | `{"minutes": 10}` | MOU accept window |
| `phlebo_attendance_deadline` | `{"time": "05:15"}` | Selfie cut-off driving payment holds |

### Per partner — `provider_settings`

| Column | Current | Meaning |
|---|---|---|
| `commission_pct` | `20.00` | Platform fee for this partner |
| `partner_discount_pct` | `0.00` | Patient discount; **DB CHECK caps it at `commission_pct`** |
| `payout_model` | `wallet` | `wallet` or `confirmation_fee` — see §3.2 |

### Per service

| Table.column | Meaning |
|---|---|
| `service_catalog.reference_mrp` | Indicative regular price from the master sheets |
| `service_catalog.reference_offer_price` | CallMedex rate where supplied (lab only today) |
| `provider_services.mrp` | This partner's own walk-in price |
| `provider_services.base_price` | Legacy; treated as MRP when `mrp` is null |

### Field staff

| Table.column | Current |
|---|---|
| `phlebotomists.per_collection_rate` | `150.00` part-time, `0.00` full-time |
| `phlebotomists.monthly_salary` | `0.00` |
| `incentive_rules.reward_value` | `5.00` percent, two seeded rules |

### The one piece of logic

`backend/app/services/marketplace.py` → `PricingService.quote()` is the **single**
place a patient price is computed. It enforces the two MOU invariants:

```
discount          = min(requested, platform_fee_pct)     ← policy ceiling on any offer
patient_price     = MRP × (1 − discount/100)
provider_payout   = patient_price × (1 − platform_fee_pct/100)   ← 80% of what is PAID
platform_retained = patient_price − provider_payout              ← always 20% of it
```

₹100 collected is ₹80 to the provider and ₹20 to CallMedex, at any price and any
discount. `PaymentService.create_order` computes the same split from the same
base, so the payout a partner is *shown* is the payout they are *paid*.

Covered by `backend/tests/test_marketplace.py`. If the model in §3 changes,
**this function and those tests are what change** — not the rest of the app.

---

## 5. What to send, and what it unblocks

Rough priority. Nothing here needs to be perfectly formatted; messy columns can
be mapped.

1. **Revenue model per provider category** — fee %, who collects what, Method 1
   vs Method 2. *Unblocks §3.1, §3.2, item 🟡4.*
2. **Dental + physiotherapy offer prices** (the blank columns). *Unblocks 🔴2, 🔴3.*
3. **Urgent surcharge rate** — flat ₹ or %, and whether it varies by service type.
   *Unblocks 🔴1.*
4. **Full-time phlebo salary bands + real incentive rules.** *Unblocks 🟡5, 🟡6.*
5. **Nursing scope of services + prices.** *Unblocks 🟡7.*
6. **Doctor consultation fee policy** — floor/cap, or fully doctor-set. *Unblocks 🟡8.*

Most useful shape, one row per **partner × service**:

```
partner (name or email) · service · category · MRP · offer price OR discount %
· home collection Y/N · urgent available Y/N · turnaround hours
```

---

## 6. Also missing: a bulk import path

There is **no CSV/Excel import anywhere in the codebase** — services and prices
go in one at a time through the org dashboard. The 879 catalogue rows were loaded
by a generated SQL migration, which works for platform-owned master data but not
for partners maintaining their own price lists.

When the full sheets arrive, the accompanying build is an importer:
upload → validate → **preview the diff** → commit, with rejected rows reported
rather than silently skipped. A price list that half-applies is worse than one
that fails loudly.

---

## 7. Change log

| Date | Change |
|---|---|
| 2026-07-25 | Master data loaded: 487 lab, 94 physiotherapy, 298 dental. |
| 2026-07-25 | Pricing aligned to dental MOU: partner payout fixed at 80%, discount capped at platform fee, `provider_payout` / `platform_retained` returned on every quote. |
| 2026-07-25 | `commission_pct` default corrected 15% → 20% (only rows still on the old default). |
| 2026-07-25 | Urgent surcharge marked unconfirmed; quotes ₹0 until a rate is agreed. |
| 2026-07-25 | Health packages removed from the site — hardcoded prices with no partner behind them. |

> Source spreadsheets and MOUs live in `pricing_details/` and `mous/`, both
> gitignored. Only derived catalogue data is version-controlled.
