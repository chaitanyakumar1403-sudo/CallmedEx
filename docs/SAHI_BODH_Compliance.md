# SAHI & BODH Compliance Statement
**CallMedex: Strategy for Artificial Intelligence in Healthcare for India**

## 1. Introduction
CallMedex employs cutting-edge AI (powered by Groq/Llama-3) to bridge the healthcare gap in Tier 2/3 Indian cities. In alignment with the **SAHI (Strategy for Artificial Intelligence in Healthcare for India)** framework launched in February 2026, we have implemented strict ethical AI guidelines and transparency protocols.

## 2. Ethical AI Usage
Our AI models are strictly utilized as **Decision-Support Systems (DSS)**. CallMedex AI does not autonomously diagnose or treat patients.
- **Consultation Summaries & E-Prescriptions:** Our speech-to-text and NLP pipeline auto-generates structured clinical notes and prescriptions from video consultations. *Safeguard: A licensed medical professional MUST review, edit, and cryptographically sign the prescription before it is finalized.*
- **Report Interpretation:** Lab report interpretations translate complex jargon into vernacular languages for patients. *Safeguard: All AI outputs carry a mandatory disclaimer ("This is an AI interpretation and does not replace medical advice").*

## 3. Data Privacy & BODH Alignment
In alignment with **BODH (Benchmarking Open Data Platform for Health AI)**:
- CallMedex strictly anonymizes and sanitizes all Personally Identifiable Information (PII) before it touches any third-party LLM APIs.
- Patient health data is never used to train generalized foundation models without explicit, opt-in consent from the Data Principal.

## 4. Bias Mitigation
CallMedex serves diverse regional demographics. Our NLP pipelines are continuously benchmarked against vernacular language sets (Telugu, Hindi, Bengali) to ensure equitable accuracy across rural and urban dialects, preventing diagnostic disparity based on language.
