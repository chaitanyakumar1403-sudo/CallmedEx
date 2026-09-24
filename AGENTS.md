# CallMedex Agent Guide & System Manual

> **Welcome Agent**: This document provides immediate orientation, hard architectural constraints, and operational guidelines for working in the CallMedex codebase.
> **Full Forensic Manual**: See [docs/forensics/32-AGENT-HANDOFF.md](file:///docs/forensics/32-AGENT-HANDOFF.md) and the complete 33-file forensic catalog in [docs/forensics/](file:///docs/forensics/).

---

## 1. Five Non-Negotiable Ground Truths

1. **NO DIRECT SQL WIRE PROTOCOL**: The backend does NOT use `psycopg2` or `asyncpg`. All database interactions travel via HTTP/REST through `supabase-py` (`postgrest-py`).
2. **DATABASE RLS IS BYPASSED**: `backend/app/database.py` connects with `SUPABASE_SERVICE_KEY`. PostgreSQL RLS policies **do not isolate tenant data at runtime**. You MUST explicitly filter by `patient_id`, `organization_id`, or `processing_center_id` in Python code.
3. **WHATSAPP & MOCDOC ARE DELEGATED**: Direct Meta WhatsApp APIs and browser scraping are handled externally by **MediAssist AI**. The backend communicates with MediAssist via signed HMAC-SHA256 endpoints (`/api/v1/integrations/mediassist/`).
4. **CELERY WORKER & BEAT ARE REQUIRED**: Phlebotomist dispatches, appointment reminders, and offer expiration sweeps run exclusively in Celery Beat (`backend/app/workers/celery_app.py`).
5. **MISSING RAZORPAY WEBHOOK**: There is currently no server-side handler for `/webhooks/razorpay`. Online payments are captured synchronously via the client calling `/api/payments/verify`.

---

## 2. Repository Structure

```
├── backend/                  # FastAPI Application, Celery Workers, Database Client
│   ├── app/
│   │   ├── main.py           # Application entrypoint & middleware stack
│   │   ├── config.py         # Pydantic Settings & environment guards
│   │   ├── database.py       # Supabase service-role client
│   │   ├── routers/          # 37 REST API routers
│   │   ├── services/         # 48 business logic services
│   │   ├── middleware/       # Auth, RateLimiter, Security, MediAssist
│   │   └── workers/          # Celery app, tasks, beat schedule
│   ├── tests/                # 74 pytest test suites (FakeQuery in-memory mocks)
│   └── requirements.txt      # Python dependencies
├── frontend/                 # Next.js 16 (React 19) App Router Web Application
│   ├── src/app/(app)/        # Authenticated role-based dashboards & booking
│   ├── src/app/(public)/     # Public landing, doctor directory, login
│   ├── e2e/                  # Playwright browser test suites
│   └── package.json          # Node dependencies
├── mobile/                   # React Native (Expo SDK 52) Mobile Application
│   ├── app/                  # Expo Router file-based screens
│   └── package.json          # Expo & native module dependencies
├── database/                 # PostgreSQL SQL schemas, RLS policies, migrations
├── docs/forensics/           # Complete 33-file Forensic Repository Intelligence Suite
├── docker-compose.yml        # 5-container topology (Backend, Celery Worker, Beat, Redis, Nginx)
├── render.yaml               # Staging & Production Infrastructure-as-Code (Singapore)
└── nginx.conf                # Reverse proxy, rate limiting, and SSL configuration
```

---

## 3. Quick Reference & Commands

- **Backend Dev Server**: `uvicorn app.main:app --reload --port 8000 --app-dir backend`
- **Run Backend Tests**: `pytest backend/tests/ -v`
- **Run Full Docker Stack**: `docker compose up -d`
- **Web Frontend**: `cd frontend && npm run dev`
- **Mobile Client**: `cd mobile && npx expo start`

---

## 4. Forensic Intelligence Index

When investigating bugs, security issues, or architectural decisions, consult the indexed forensic documentation in `docs/forensics/`:

- **Architecture & Pipeline**: [02-ARCHITECTURE.md](file:///docs/forensics/02-ARCHITECTURE.md)
- **API Catalog & Schemas**: [05-API-FORENSICS.md](file:///docs/forensics/05-API-FORENSICS.md)
- **Database & Tables (86)**: [07-DATABASE-FORENSICS.md](file:///docs/forensics/07-DATABASE-FORENSICS.md)
- **Multi-Tenancy & RLS**: [08-RLS-AND-MULTI-TENANCY.md](file:///docs/forensics/08-RLS-AND-MULTI-TENANCY.md)
- **Security Audit (SEC-01 to SEC-05)**: [19-SECURITY-FORENSICS.md](file:///docs/forensics/19-SECURITY-FORENSICS.md)
- **12-Domain Production Readiness**: [29-PRODUCTION-READINESS.md](file:///docs/forensics/29-PRODUCTION-READINESS.md)
- **Ranked Threat Catalog**: [30-KNOWN-RISKS.md](file:///docs/forensics/30-KNOWN-RISKS.md)
- **Agent Handoff & Troubleshooting**: [32-AGENT-HANDOFF.md](file:///docs/forensics/32-AGENT-HANDOFF.md)
