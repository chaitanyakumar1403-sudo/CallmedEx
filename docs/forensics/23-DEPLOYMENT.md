# CallMedex Forensic Intelligence: Deployment Topology & Infrastructure Analysis

> **Analysis Scope**: Comprehensive forensic audit of deployment configurations, containerization (`docker-compose.yml`, `backend/Dockerfile`), PaaS specification (`render.yaml`), edge reverse proxy (`nginx.conf`), CI/CD pipelines, and runtime infrastructure topology across staging and production environments.

---

## 1. Infrastructure Topology Overview

CallMedex employs a **split-tier hybrid cloud architecture**:
- **API & Background Compute**: Containerized Python ASGI and Celery workers hosted on **Render (Singapore Region)** or on-premise Docker hosts.
- **Reverse Proxy & Ingress**: **Nginx** handling SSL termination, rate-limiting zones, WebSocket upgrade, and scanner blocking.
- **Database & Object Storage**: Managed **Supabase (PostgreSQL 15 + PostgREST + S3 Storage)**.
- **In-Memory Broker & Cache**: **Redis 7 (Alpine)** acting as Celery broker, rate-limit counter, and session/token cache.
- **Frontend Presentation**: **Vercel** hosting Next.js 16 App Router.
- **Mobile Distribution**: **Expo EAS** delivering OTA updates and standalone APK / IPA binaries.

```
                  ┌────────────────────────┐
                  │   Internet Traffic     │
                  └───────────┬────────────┘
                              │
            ┌─────────────────┴─────────────────┐
            │                                   │
     (Browser / Next.js)                 (Mobile / API)
            ▼                                   ▼
┌───────────────────────┐           ┌───────────────────────┐
│     Vercel Edge       │           │     Nginx Ingress     │
│ (callmedex-frontend)  │           │   (Rate Limiting/SSL) │
└───────────────────────┘           └───────────┬───────────┘
                                                │
                                    ┌───────────┴───────────┐
                                    ▼                       ▼
                        ┌───────────────────────┐ ┌───────────────────┐
                        │   FastAPI Web API     │ │  WebSocket (/ws/) │
                        │  (callmedex-api:8000) │ └───────────────────┘
                        └───────────┬───────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          ▼                         ▼                         ▼
┌───────────────────┐     ┌───────────────────┐     ┌───────────────────┐
│  Redis 7 (Broker) │     │ Celery Worker     │     │ Celery Beat       │
│  (port 6379)      │◄───►│ (Async Execution) │◄────│ (Cron Scheduler)  │
└───────────────────┘     └─────────┬─────────┘     └───────────────────┘
                                    │
                                    ▼
                        ┌───────────────────────┐
                        │  Supabase Cloud (SG)  │
                        │  Postgres 15 + S3     │
                        └───────────────────────┘
```

---

## 2. Docker & Containerization Architecture (`docker-compose.yml`)

The local/production containerized setup defines 5 interconnected services on an isolated bridge network (`callmedex-net`).

### 2.1 Service Breakdown & Health Check Hierarchy

| Service Name | Base Image / Build Context | CPU Limit / Res. | Memory Limit / Res. | Healthcheck Definition | Critical Role |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `backend` | `./backend/Dockerfile` | 2.0 / 0.5 CPU | 1024M / 256M | `curl -f http://localhost:8000/api/health` | Primary REST API server; handles all synchronous requests. |
| `celery-worker`| `./backend/Dockerfile` | 1.0 / 0.25 CPU| 512M / 128M | None (Depends on healthy `redis`) | Consumes tasks from Redis; executes dispatch loops, payouts, emails. |
| `celery-beat` | `./backend/Dockerfile` | 0.5 / 0.1 CPU | 256M / 64M | None (Depends on healthy `redis`) | Periodic tick scheduler; enqueues 8 periodic tasks onto Redis. |
| `redis` | `redis:7-alpine` | 0.5 / 0.1 CPU | 384M / 64M | `redis-cli ping` | Message broker for Celery; ephemeral cache for rate limits. |
| `nginx` | `nginx:alpine` | 0.5 / 0.1 CPU | 128M / 32M | `wget -q -S http://localhost:80/api/health` | Edge reverse proxy, SSL termination, and rate limiting. |

### 2.2 Bootstrapping Dependency Chain
1. `redis` boots and achieves healthy status via `redis-cli ping` within 5 seconds.
2. `backend`, `celery-worker`, and `celery-beat` initialize concurrently once `redis` is healthy.
3. `backend` runs internal connection tests and becomes healthy when `/api/health` returns HTTP 200.
4. `nginx` starts only after `backend` is fully healthy (`condition: service_healthy`), preventing 502 Bad Gateway responses to incoming client traffic during cold starts.

---

## 3. Render PaaS Specification (`render.yaml`)

The production/staging infrastructure on Render Cloud is orchestrated via Infrastructure-as-Code (`render.yaml`):

### 3.1 Managed Services Overview

| Resource | Service Type | Runtime | Plan / Sizing | Region | Scaling Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `callmedex-api` | `web` | `docker` | `starter` | `singapore` | Horizontal manual scaling; healthcheck path `/api/health`. |
| `callmedex-redis` | `redis` | Native Redis | `starter` | `singapore` | Managed Redis 7; internal-only access (`ipAllowList: []`), policy `allkeys-lru`. |
| `callmedex-celery-worker` | `worker` | `docker` | `starter` | `singapore` | Concurrency 2 (`celery -A app.workers.celery_app worker --concurrency=2`). |
| `callmedex-celery-beat` | `worker` | `docker` | `starter` | `singapore` | Single-instance scheduler (`celery -A app.workers.celery_app beat`). |

### 3.2 Key Architectural Guarantee: Worker Decoupling
- **Failure Mode Handled**: If `callmedex-api` crashes or is restarted during deployment, Celery workers continue processing background home collection dispatches and appointment reminders without disruption.
- **Celery Beat Singleton**: Exactly one `celery-beat` container is provisioned. Having multiple beat instances would cause duplicate dispatches and duplicate payouts.

---

## 4. Edge Ingress & Reverse Proxy (`nginx.conf`)

The edge Nginx configuration provides multi-tiered rate limiting, request routing, connection pooling, and attack surface hardening.

### 4.1 Rate Limiting Zones

| Zone Identifier | Allocated Memory | Request Rate Limit | Burst Allowance | Target Endpoints | Security / Operational Objective |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `api_general` | 10 MB | 30 req/sec | N/A | Default `/` | Protects API from basic DDoS and scraping. |
| `api_auth` | 10 MB | 5 req/min | 3 requests (`nodelay`) | `/api/auth/` | Prevents credential stuffing, brute-force OTP attempts, and token exhaustion. |
| `api_upload` | 10 MB | 10 req/min | 5 requests (`nodelay`) | `/api/reports/` | Caps large multipart file uploads (15MB limit) to preserve bandwidth and disk. |
| `api_telemed` | 10 MB | 10 req/min | 5 requests (`nodelay`) | `/api/telemed/` | Protects compute-intensive AI clinical summary endpoints. |
| `conn_per_ip` | 10 MB | 50 concurrent conns | Hard cap | All endpoints | Thwarts Slowloris and connection starvation attacks. |

### 4.2 Endpoint-Specific Timeout Tuning
- **Standard Endpoints**: `proxy_read_timeout 60s`, `proxy_send_timeout 60s`.
- **AI & Report Endpoints** (`/api/telemed/`, `/api/reports/`, `/api/verification/`): Extended to `300s` (`proxy_read_timeout 300s`) to prevent HTTP 504 Gateway Timeouts while Groq or Gemini executes large multimodal medical analyses.
- **WebSocket Gateway** (`/ws/`): Configured with `proxy_read_timeout 86400s` (24 hours) with `Upgrade` and `Connection "upgrade"` headers for persistent phlebotomist telemetry.

### 4.3 Scanner & Attack Surface Hardening
```nginx
# Block dotfiles (.git, .env, etc.)
location ~ /\.(git|svn|env|htaccess|htpasswd) {
    deny all;
    return 404;
}

# Block WordPress probes
location ~ /wp-(admin|login|content|includes) {
    deny all;
    return 404;
}

# Block phpMyAdmin
location ~ /phpmyadmin {
    deny all;
    return 404;
}

# Block common vulnerability scanners (Actuator, Swagger)
location ~ /(\.well-known/|actuator|api-docs|swagger) {
    deny all;
    return 404;
}
```

---

## 5. Deployment Gaps & Operational Vulnerabilities

1. **Missing Production SSL in Active Nginx**:
   - In `nginx.conf`, lines 190-224 (HTTPS server on port 443 with HSTS) are **commented out**. Port 80 is serving traffic directly. In production, Let's Encrypt / Certbot or an upstream Cloudflare/ALB SSL cert must terminate TLS.
2. **Missing Frontend in Docker Compose**:
   - `docker-compose.yml` does not contain a service for `frontend`. Developers running `docker compose up` only get the backend, workers, and proxy. The Next.js frontend must be run separately via `npm run dev` or deployed to Vercel.
3. **No Automatic Database Migration Step**:
   - The deployment pipeline lacks an automated migration tool (such as Flyway or Liquibase). Database schema files (`database/*.sql`) must be applied manually through the Supabase SQL Editor.
