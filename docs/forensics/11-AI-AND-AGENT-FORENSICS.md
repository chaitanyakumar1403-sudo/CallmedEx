# 11 — AI & AGENT FORENSICS

**Document Version:** 1.0.0  
**Commit SHA:** `a7e8478e0e39d6b7a215fc9b5458c1ce0a321736`  
**Classification:** Artificial Intelligence, LLM & Vision Pipeline Audit  
**Verification Level:** STATICALLY VERIFIED against prompt templates, SDK invocations, and schemas  

---

## 1. AI SUBSYSTEM ARCHITECTURE OVERVIEW

CallMedex employs a **hybrid multi-provider AI strategy** designed to balance speed, cost, and medical accuracy across three specialized clinical tasks:

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                        CALLMEDEX AI ORCHESTRATION                          │
└─────────────────────────────────────┬──────────────────────────────────────┘
                                      │
       ┌──────────────────────────────┼──────────────────────────────┐
       │                              │                              │
┌──────▼──────────────────────┐┌──────▼──────────────────────┐┌──────▼──────────────────────┐
│ GOOGLE GEMINI VISION        ││ OPENROUTER GATEWAY          ││ GROQ CLOUD ACCELERATOR      │
│ (ai_ocr.py)                 ││ (openrouter_client.py)      ││ (ai_voice_scribe.py)        │
├─────────────────────────────┤├─────────────────────────────┤├─────────────────────────────┤
│ • Provider Certificate OCR  ││ • Diagnostic Lab Report OCR ││ • Telemed Voice Scribing    │
│ • Doctor/Nurse License Regs ││ • Qwen 3.7 Flash Vision     ││ • Llama 3.3-70b-versatile   │
│ • Aadhaar Card Parsing      ││ • DeepSeek v4 Flash Extract ││ • Real-time Clinical Triage │
│ • Selfie Liveness Check     ││ • Automated Fallback Logic  ││ • Rx Entity Extraction      │
└─────────────────────────────┘└─────────────────────────────┘└─────────────────────────────┘
```

---

## 2. DETAILED AI PIPELINES & PROMPTS

### A. Provider Credential Verification (Google Gemini Vision)
- **Source File:** `backend/app/services/ai_ocr.py` (390 lines).
- **SDK:** `google-generativeai` (`genai.configure(api_key=settings.GEMINI_API_KEY)`).
- **Model Hierarchy:** `["gemini-2.0-flash", "gemini-1.5-flash", "gemini-2.5-flash", "gemini-flash-latest"]`.
- **Role-Specific Prompt Architecture:**
  - **Doctor License Prompt:** Instructs the vision model to extract `doctor_name`, `registration_number`, `state_medical_council`, `qualification`, and `year_of_passing`.
  - **Pharmacy Drug License Prompt:** Extracts `pharmacy_name`, `license_numbers` (Form 20/21), `validity_date`, and `pharmacist_name`.
  - **Nursing Council Prompt:** Extracts `nurse_name`, `registration_number`, `nursing_council`, and `valid_until`.
  - **Aadhaar OCR & Liveness:** Validates card integrity, extracts masked Aadhaar number, and evaluates selfie photo for eye-contact, natural lighting, and anti-spoofing indicators (`is_live: true/false`).
- **Resilience Engineering:**
  - Gemini responses frequently enclose JSON in markdown backticks (` ```json ... ``` `). `ai_ocr.py` strips wrappers via regex before parsing.
  - If primary model fails or encounters rate limits, it iterates through fallback flash models before throwing a structured error.

### B. Diagnostic Lab Report Interpretation (OpenRouter Gateway)
- **Source Files:** `backend/app/services/groq_report_analyzer.py`, `backend/app/services/openrouter_client.py`.
- **Vision Model:** `qwen/qwen3.7-flash` (Fallback: `google/gemini-3.5-flash-lite`).
- **Reasoning / Extraction Model:** `deepseek/deepseek-v4-flash-0731` (Fallback: `deepseek/deepseek-v4-pro`).
- **Extraction Schema (`ReportAnalysisPayload`):**
  - `plain_language_summary`: 6th-grade reading level explanation for the patient.
  - `doctor_clinical_summary`: Technical summary for healthcare professionals.
  - `health_score`: Numeric index (0–100) based on biomarker health.
  - `abnormal_flags`: Array of `{ marker, value, status ('high'|'low'|'critical'), reference_range }`.
  - `recommendations`: Actionable lifestyle and physician consultation guidance.

### C. Voice Consultation Scribing (Groq Accelerator)
- **Source File:** `backend/app/services/ai_voice_scribe.py`.
- **SDK:** `groq` (`Groq(api_key=settings.GROQ_API_KEY)`).
- **Model:** `llama-3.3-70b-versatile`.
- **Execution:** Takes the raw speech-to-text transcript of a completed telemedicine session and executes few-shot extraction to populate:
  - Chief Complaints, History of Present Illness (HPI).
  - Physical Examination Findings.
  - Differential Diagnosis.
  - Drug Prescriptions (Drug name, Dosage, Route, Frequency, Duration, Special Instructions).

---

## 3. HALLUCINATION SAFEGUARDS & CLINICAL BOUNDARIES

1. **Human-in-the-Loop Prescription Gate:**
   AI is **strictly prohibited from issuing e-prescriptions autonomously**.
   The AI scribe populates a draft in the doctor's workstation (`/consultation/[doctorId]`). The doctor must review, edit, and digitally sign the prescription before it can be generated or sent to the patient.
2. **Clinical Threshold Guardrails:**
   Any lab test marker classified as `"critical"` (e.g. Potassium > 6.0 mEq/L, Troponin positive) automatically bypasses standard report queuing and raises an emergency notification flag in `ops_alerts`.
3. **Request Timeout Protection:**
   In `backend/app/main.py` (`RequestTimeoutMiddleware`), AI endpoints (`/api/reports/analyze`, `/api/telemed/finalize`, `/api/verification/verify`) are allocated an extended **300-second timeout** (5 minutes), while all normal API requests are capped at 60 seconds to prevent hung worker threads.
