# 00 — FORENSIC MANIFEST & INVESTIGATION BASELINE

**Document Version:** 1.0.0  
**Audit Target:** CallMedex Healthcare Platform (`C:\Users\chait\OneDrive\Desktop\callmedex`)  
**Audit Date:** 2026-09-22T20:18:00+05:30  
**Investigation Classification:** Forensic Codebase Intelligence, Architecture Reconstruction, and Security Review  
**Author:** AI Senior Forensic Systems Engineer & Security Auditor  

---

## 1. REPOSITORY METADATA & BASELINE STATE

The following environment and repository parameters represent the exact, unaltered baseline state at the time of investigation:

| Attribute | Forensic Value | Verification Status |
| :--- | :--- | :--- |
| **Repository Root** | `C:\Users\chait\OneDrive\Desktop\callmedex` | STATICALLY VERIFIED |
| **Primary Git Branch** | `main` | STATICALLY VERIFIED |
| **Commit SHA** | `a7e8478e0e39d6b7a215fc9b5458c1ce0a321736` | STATICALLY VERIFIED |
| **Commit Author** | `chaitanyakumar1403-sudo` | STATICALLY VERIFIED |
| **Commit Timestamp** | `2026-09-22 17:51:10 +0530` | STATICALLY VERIFIED |
| **Commit Subject** | `feat(session-04): tracking gate, branch scheduling, home collection and pharmacy terminal` | STATICALLY VERIFIED |
| **Remote Origin** | `https://github.com/chaitanyakumar1403-sudo/CallmedEx.git` | STATICALLY VERIFIED |
| **Active Branches** | `main`, `feature/layer0-foundation`, `feature/ui-system-rework`, `fix/schema-sync-and-dispatch-bugs`, `worktree-processing-center-foundation` | STATICALLY VERIFIED |
| **Working Tree State** | Working tree contains uncommitted deletions in `images_ref/` and untracked `.codebase-memory/`, `install.ps1`. No application source code modified prior to forensic review. | STATICALLY VERIFIED |
| **Operating System Host** | Windows 11 (PowerShell environment) | STATICALLY VERIFIED |

---

## 2. CODEBASE METRICS & CODEBASE MEMORY KNOWLEDGE GRAPH

The repository has been indexed into Codebase Memory Knowledge Graph (`C-Users-chait-OneDrive-Desktop-callmedex`):

- **Total Graph Nodes:** 9,012
- **Total Graph Edges:** 30,706
- **Node Breakdown:**
  - `Function`: 2,989
  - `Variable`: 1,337
  - `Section`: 1,192
  - `File`: 767
  - `Module`: 764
  - `Route`: 505
  - `Method`: 387
  - `Interface`: 309
  - `Class`: 260
  - `Folder`: 164
  - `Table`: 133
  - `EnvVar`: 105
  - `Type`: 53
  - `Package`: 22
  - `Decorator`: 14
  - `View`: 5
  - `Channel`: 4
  - `Branch`: 1
  - `Project`: 1
- **Language Distribution by File Count:**
  - TypeScript: 335 files (`frontend/` and `mobile/`)
  - Python: 234 files (`backend/`)
  - SQL: 64 files (`database/`)
  - YAML: 6 files (OpenAPI and CI configs)
  - JavaScript / MJS: 4 files (custom test/lint scripts)
  - Bash: 4 files (`start.sh`, etc.)
  - CSS: 2 files
  - HTML: 1 file

---

## 3. ABSOLUTE INVESTIGATION RULES & AUTHORITY

1. **Source Code is the Sole Primary Authority:** Documentation, comments, and commit messages are treated as claims to be verified. Unimplemented documentation is classified as *Documentation Drift*, not functional software.
2. **Zero Code Changes:** No application source, database schemas, RLS policies, routing definitions, or configuration files were altered, cleaned, or stashed during this audit.
3. **Evidence Classification Taxonomy:** Every major finding and system capability is categorized under one of the following exact statuses:
   - **`VERIFIED`**: Confirmed directly by source implementation and matching tests/schemas.
   - **`IMPLEMENTED`**: Present in source code, but lacking complete test coverage or end-to-end runtime verification.
   - **`PARTIALLY IMPLEMENTED`**: Core logic exists, but edge cases, failure recoveries, or dependent subcomponents are incomplete or stubbed.
   - **`CONFIGURED ONLY`**: Referenced in `.env.example`, `config.py`, or middleware, but without underlying operational endpoints or listeners.
   - **`STUBBED / MOCKED`**: Returns hardcoded payloads, synthetic IDs, or bypasses live validation (e.g., mock verification of government registries, dev mock payment).
   - **`DEAD / UNUSED`**: Code or endpoint exists in the repository but has no callers, frontend consumers, or active routers.
   - **`BROKEN`**: Code contains syntax, logical, or structural contradictions that prevent intended operation.
   - **`INCONSISTENT`**: Contrasting assumptions between frontend, backend, or database layers.
   - **`UNKNOWN`**: Requires live production credentials, third-party network access, or staging hardware to determine.
   - **`REQUIRES RUNTIME VERIFICATION`**: Implementation appears syntactically coherent but has concurrency, performance, or external-dependent assumptions that must be validated under load.

---

## 4. VERIFICATION LEVEL CRITERIA

For each subsystem, two distinct confidence metrics are evaluated:
- **`STATIC CONFIDENCE`**: The degree to which source code AST, imports, queries, schemas, and logic prove the behavior.
- **`RUNTIME CONFIDENCE`**: The degree to which active tests, integration test harnesses, or staging validations prove real execution against live dependencies.

Static analysis is NEVER labeled as runtime verification.

---

## 5. REPOSITORY DIRECTORY INVENTORY (ROOT LEVEL)

| Directory / File | Type | Forensic Assessment |
| :--- | :--- | :--- |
| `backend/` | Application | FastAPI backend service (Python 3.11+). 37 routers, 48 services, 10 Celery background workers, 74 test suites. |
| `frontend/` | Application | Next.js 16.2.10 App Router web application (React 19, TypeScript 5, Tailwind CSS). |
| `mobile/` | Application | Expo 52 React Native mobile application (React 18.3, TypeScript 5, Expo Router 4). |
| `database/` | Infrastructure | 65 SQL migration and schema scripts, seeding files, PostGIS definitions, RLS rules. |
| `docs/` | Documentation | Historical audit reports, OpenAPI contracts, session progress runbooks, specifications. |
| `services/` | Assets | Non-code directory containing commercial pricing spreadsheets (`CALL MEDEX - DENTAL PROCEDURE.xlsx`, `DIAGNOSTIC CENTER SCOPE.xls`). |
| `app/` | Artifacts | Non-source directory generated by local browser connector runs (`app/integrations/callmedex/browser/artifacts/downloads`). |
| `docker-compose.yml` | Infrastructure | Multi-container orchestration (FastAPI, Celery Worker, Celery Beat, Redis 7, Nginx). |
| `nginx.conf` | Infrastructure | Reverse proxy, rate limiting, and SSL termination configuration. |
| `render.yaml` | Deployment | Infrastructure-as-Code specification for Render deployment (web, worker, beat, redis). |
| `CLAUDE.md` | Architecture Doc | Developer instruction manual and historic subsystem specifications. |
| `CALLMEDEX-LIQUID-HEALTH.md`| Specification | Comprehensive Next-Gen "Liquid Health" operational architecture design document. |

---

## 6. FORENSIC DOSSIER STRUCTURE

The complete audit is organized into the following 33 persistent documents:

```text
docs/forensics/
├── 00-FORENSIC-MANIFEST.md                 # Baseline metadata, commit SHA, graph metrics, audit taxonomy
├── 01-REPOSITORY-CURRENT-STATE.md          # High-level product reality, subsystem readiness matrix
├── 02-ARCHITECTURE.md                      # Reconstructed system architecture, tier relationships, topology
├── 03-COMPONENT-MAP.md                     # Deep inventory of routers, services, models, workers, utilities
├── 04-END-TO-END-FLOWS.md                  # Comprehensive lifecycle traces from HTTP ingress to DB commit
├── 05-API-FORENSICS.md                     # Exhaustive analysis of 260+ API routes, auth gates, mutations
├── 06-FRONTEND-FORENSICS.md                # Next.js App Router and Expo mobile client implementation audit
├── 07-DATABASE-FORENSICS.md                # 86+ PostgreSQL tables, schemas, relations, constraints, indexes
├── 08-RLS-AND-MULTI-TENANCY.md             # Supabase service-role bypass, tenant scoping and data isolation
├── 09-AUTHORIZATION-FORENSICS.md           # RBAC, JWT issuance, token revocation, role privilege boundaries
├── 10-WHATSAPP-FORENSICS.md                # Dual front-door reality, MediAssist AI boundary, template engine
├── 11-AI-AND-AGENT-FORENSICS.md            # Gemini Vision OCR, OpenRouter gateway, Groq Scribe, triage logic
├── 12-PAYMENT-FORENSICS.md                 # Razorpay flow, client verification, missing webhook risk, splits
├── 13-CONNECTOR-FORENSICS.md               # MocDoc / LIMS connectors, MediAssist offloading, PDF pipeline
├── 14-BACKGROUND-JOBS.md                   # Celery worker tasks, beat cron schedules, dispatch sweeps, roster
├── 15-WEBHOOK-FORENSICS.md                 # Inbound webhook validation, HMAC-SHA256 crypto, idempotency
├── 16-STATE-MACHINES.md                    # Booking FSM, Sample Custody FSM, Dispatch FSM, Verification FSM
├── 17-FAILURE-PATHS.md                     # Circuit breakers, retry policies, fail-open vs fail-closed analysis
├── 18-CONCURRENCY-AND-IDEMPOTENCY.md      # Double booking, concurrent callbacks, missing locks, race conditions
├── 19-SECURITY-FORENSICS.md                # OWASP Top 10, IDOR, injection vectors, secret exposure risks
├── 20-HEALTHCARE-DATA-FLOWS.md             # DPDP Act, ABHA / ABDM compliance, PHI/PII handling, consent audit
├── 21-CONFIGURATION.md                    # Environment variables audit, secret hygiene, mock mode toggles
├── 22-DEPENDENCIES.md                     # Python and Node dependency trees, vulnerabilities, unused packages
├── 23-DEPLOYMENT.md                        # Docker, Render, Vercel, Supabase, and Nginx production topology
├── 24-OBSERVABILITY.md                     # Structured logging, correlation IDs, audit trails, telemetry gaps
├── 25-TEST-COVERAGE.md                     # Evaluation of 74 backend test suites and frontend Playwright tests
├── 26-GIT-HISTORY-ANALYSIS.md              # Historical evolution, refactor archaeology, regression analysis
├── 27-DOCUMENTATION-DRIFT.md               # Master reconciliation: documented promises vs code truth
├── 28-DEAD-CODE-AND-DUPLICATION.md         # Redundant endpoints, legacy stubs, obsolete script inventory
├── 29-PRODUCTION-READINESS.md              # 12-domain production gate assessment and release scorecards
├── 30-KNOWN-RISKS.md                       # Comprehensive risk registry ranked by severity and exploitability
├── 31-UNKNOWN-AREAS.md                     # Unresolved items requiring live staging/production verification
└── 32-AGENT-HANDOFF.md                     # Rapid orientation manual for future AI agents and engineers
```
