---
name: video-consultation-spec
description: CallMedex's full video consultation spec -- core flow, NMC 2026 telemedicine compliance, live translated captions, AI summary/prescription pipeline, and additional features. Use when building or reviewing telemedicine, video calls, prescription generation, or consultation summaries.
---

# Video Consultation — Full Spec

## Core Flow
- Doctor sets "Available for Online Consultation" flag + available timings + languages spoken at signup/profile
- Patient books video slot → video session via **Daily.co or Twilio Video** (embeddable directly in CallMedex UI, no external app/account needed)
- Primary use case: NRI patients across timezones, plus general telemedicine convenience for domestic patients

## NMC 2026 Telemedicine Compliance (Mandatory)

The NMC's **Registered Medical Practitioners (Professional Conduct) Regulations, 2026** introduce stricter rules that directly affect CallMedex's video consultation module:

| Requirement | Impact on CallMedex |
|---|---|
| **Mandatory generic-name prescriptions** | AI prescription extraction must auto-flag brand names and suggest generic equivalents; e-prescription PDF must display generic names legibly |
| **Identity verification for Schedule H/H1 drugs** | If doctor prescribes Schedule H/H1 via teleconsult for a first-time patient, system must prompt patient to upload government-issued ID before prescription is finalized |
| **Digital consent — 3-year retention** | Explicit digital consent (recorded verbal or secure e-signature) must be captured before consultation starts and stored for minimum 3 years; build consent artifact storage tied to `consultation_id` |
| **Advertising ethics prohibition** | Doctor profiles on CallMedex must not include endorsements of commercial health products or nutraceuticals — enforce at profile review stage |
| **Prescription drug restrictions** | System must block prescribing Schedule X, narcotics, and psychotropic substances via teleconsult — hard-coded validation in the prescription pipeline |

## Real-Time Translated Captions (Option B — recommended MVP approach)
Rather than full speech-to-speech dubbing (higher latency, more disruptive), launch with **live translated captions**:
- Doctor speaks in English/Hindi/any language → streaming speech-to-text → Groq/Llama translation → translated caption overlay appears on **patient's** screen in their preferred language (set once in patient profile, no doctor-side setup needed)
- Patient still hears the doctor's actual voice — captions supplement rather than replace, which feels more natural and trustworthy than a synthesized dub
- **Bidirectional option:** doctor can also see live translated captions of what the patient says, if doctor doesn't share the patient's language — often more valuable than one-directional translation alone
- Architecture: audio stream from call → streaming STT → Groq/Llama translation → push translated text via WebSocket to the relevant client
- This same transcript pipeline (original + translated) feeds directly into the AI summary/prescription pipeline below — not throwaway infrastructure
- Speech-to-speech (full voice dubbing) can be evaluated as a v2 feature once live-caption demand is validated

## AI Summary + Prescription Pipeline
1. **Recording/transcription** during the call (Daily.co/Twilio session recording + transcript, reusing the streaming STT above)
2. **Post-call AI processing** (Groq/Llama):
   - Structured **consultation summary** — chief complaint, symptoms discussed, doctor's assessment, advice given
   - **Prescription extraction** — parses medicines mentioned into a structured list (generic name, dosage, frequency, duration), not just prose. **Must comply with NMC 2026 generic-name mandate** (see above)
   - **Follow-up flag** — auto-detects if doctor mentioned a follow-up date or a recommended test, converts into a suggested next action/reminder
3. **Doctor review/edit step (mandatory)** — AI drafts the summary + prescription; doctor reviews, edits, and confirms before anything is finalized and sent. AI never auto-sends an unverified prescription — this is a non-negotiable compliance/liability safeguard.
4. **Delivery** — finalized prescription + summary sent to patient via WhatsApp (PDF) in the patient's **preferred language**, and saved to their ABHA-linked health record

## Additional Features
- **E-prescription → pharmacy handoff:** patient taps "Order these medicines" directly from the prescription card, routing straight into the pharmacy delivery flow (see `pharmacy-delivery-model` skill)
- **Pre-consult intake form:** short symptom questionnaire sent via WhatsApp before the call so the doctor starts with context instead of history-taking from scratch
- **In-call vitals sharing:** patient can enter readings from a connected BP monitor/glucometer/oximeter during the call, timestamped into the record
- **Multi-language summary generation:** patient-facing summary generated in their preferred regional language regardless of the language the consult was conducted in
- **Consultation history timeline:** all past video consults, summaries, and prescriptions in one scrollable view on the patient dashboard, ABHA-linked
- **Second-opinion request:** patient can share a consult record with another doctor on the platform for review, with explicit consent
- **No-show/reschedule automation:** WhatsApp reminder ~30 min before the call, one-tap reschedule if either party can't make it
- **Consultation quality flagging:** if AI detects the call ended unusually short, or key fields (diagnosis/prescription) are empty, flag for admin follow-up — protects patients from a rushed/incomplete consult slipping through
