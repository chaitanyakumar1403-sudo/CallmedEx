# 13 — CONNECTOR & HOSPITAL LIMS FORENSICS

**Document Version:** 1.0.0  
**Commit SHA:** `a7e8478e0e39d6b7a215fc9b5458c1ce0a321736`  
**Classification:** Third-Party LIMS, EMR, & Automation Connector Audit  
**Verification Level:** STATICALLY VERIFIED against source tree, schema enums, and OpenAPI specs  

---

## 1. CONNECTOR ARCHITECTURE & SUPPORTED LIMS SYSTEMS

In Indian diagnostic and hospital workflows, laboratory instruments feed into Laboratory Information Management Systems (LIMS). CallMedex categorizes connectors in `backend/app/models/schemas.py` (`ConnectorType`):

```python
class ConnectorType(str, Enum):
    MOCDOC = "mocdoc"                # Dominant hospital/clinic SaaS in South India
    CRELIO = "crelio"                # CrelioHealth (formerly LiveHealth) cloud LIMS
    CLOUDLIMS = "cloudlims"          # Standard enterprise web LIMS
    FUTURE_CONNECTOR = "future_connector"
    PATIENT_UPLOAD = "patient_upload"# Patient mobile camera / PDF upload
    MANUAL = "manual"                # Lab technician manual result entry
```

---

## 2. THE MOCDOC AUTOMATION DISCOVERY & DELEGATION

### Historic Context vs Codebase Reality:
1. **Historic State:** The repository contains residual directory artifacts at `app/integrations/callmedex/browser/artifacts/downloads` reflecting early experiments with direct browser automation (Playwright/Puppeteer) to scrape MocDoc patient portals.
2. **Current Production Reality:**
   - **Playwright is NOT installed** in `backend/requirements.txt`.
   - The FastAPI backend does not run browser automation.
   - MocDoc automation was **fully outsourced to MediAssist AI** under the August 2026 contract.

### How MocDoc Ingestion Works Today (Mode 2 Pipeline):
```text
CallMedex API
  ↓ Submits report job with UHID & Hospital ID
MediAssist AI Platform (Executes external browser automation / API connector)
  ↓ Logs into hospital portal, navigates to UHID, downloads signed PDF report
MediAssist AI Callback to CallMedex:
  POST /api/v1/integrations/mediassist/callbacks/report-delivered OR /report-failed
```

### Specific MocDoc Failure Reasons Handled in Code:
In `backend/app/routers/mediassist_inbound.py` (lines 88–94), CallMedex explicitly handles three Mode 2 MocDoc automation failure codes:
- `"report_not_ready_timeout"`: Lab test still pending on hospital analyzer.
- `"bill_payment_pending"`: Hospital LIMS has locked report PDF due to pending patient hospital bill.
- `"download_automation_failed"`: Portal CAPTCHA, UI selector shift, or session expiration on MocDoc.

---

## 3. REPORT PDF PIPELINE & TEMPORARY STORAGE AUDIT

When diagnostic PDF reports are uploaded directly by CallMedex partner processing centers:

```text
Lab Technician / Center Admin
  ↓ Uploads PDF (multipart/form-data)
POST /api/reports/upload OR POST /api/pc/reports/upload
  ↓
Validation & Processing (app/services/report_submission.py):
  - Validates MIME type (application/pdf, image/jpeg, image/png).
  - Maximum upload size enforced: 10 MB.
  - File parsed in memory using PyMuPDF (fitz) — NO ephemeral disk writes to /tmp.
  ↓
Storage & Persistence:
  - File bytes uploaded to Supabase Private Storage bucket: lab-reports
  - Path structure: lab-reports/{booking_id}/{sample_id}_{timestamp}.pdf
  - Public access to bucket is DISABLED.
  - Record inserted into lab_reports table.
  ↓
Presigned URL Generation:
  - When patient or doctor views report: StorageService.get_signed_url(bucket="lab-reports", path=file_path, expires_in=900)
  - Time-to-Live (TTL): 15 minutes.
```

### Security Verdict on Storage & Connectors:
- **Zero Local Disk Leaks:** PDF parsing is memory-backed via `fitz.open(stream=file_bytes, filetype="pdf")`.
- **Zero Public S3 Bucket Exposure:** Buckets `verification-docs` and `lab-reports` are private; all access requires time-bounded presigned signatures.
- **SSRF & Arbitrary URL Protection:** Upload endpoints do not accept remote URLs to fetch; files must be uploaded directly via HTTP multipart payloads.
