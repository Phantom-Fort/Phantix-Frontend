# Post-Testing Production Setup Checklist

**Date**: July 14, 2026
**Audience**: Phantix Backend Engineers, Infrastructure Engineers

---

## 1. Infrastructure & Deployment

### 1.1 Production Database
- [ ] Provision PostgreSQL (managed: RDS, Cloud SQL, or Hetzner) — minimum 2 vCPU, 4GB RAM for 50 orgs
- [ ] Configure `max_connections = 200` on PostgreSQL
- [ ] Set `statement_timeout = '30s'`
- [ ] Set `idle_in_transaction_session_timeout = '30s'`
- [ ] Enable SSL/TLS on the database connection
- [ ] Set up automated backups (daily + WAL archiving for point-in-time recovery)
- [ ] Set up pgbouncer or similar connection pooler in transaction mode

### 1.2 Redis
- [ ] Provision Redis (managed: ElastiCache, Upstash, or self-hosted) — minimum 1GB for 50 orgs
- [ ] Enable Redis AOF persistence (append-only file for durability)
- [ ] Configure `maxmemory-policy allkeys-lru` for cache eviction
- [ ] Set up Redis Sentinel or Cluster for HA (at least 2 replicas)
- [ ] Enable Redis ACL for access control
- [ ] Configure TLS for Redis connections

### 1.3 Object Storage
- [ ] Provision S3-compatible storage (AWS S3, MinIO, DigitalOcean Spaces, or Hetzner Object Storage)
- [ ] Create buckets: `phantix-apk-uploads`, `phantix-reports`, `phantix-screenshots`
- [ ] Set bucket policies: private, no public access
- [ ] Enable bucket versioning (retain last N versions)
- [ ] Configure lifecycle policies (delete APKs older than 90 days, reports older than 1 year)
- [ ] Set up IAM credentials with least-privilege (ListBucket, PutObject, GetObject, DeleteObject)

### 1.4 API Servers
- [ ] Set up load balancer (nginx, HAProxy, or cloud LB) in front of API servers
- [ ] Configure health check on `/health` (interval: 10s, unhealthy threshold: 3)
- [ ] Enable SSL termination at load balancer
- [ ] Set up at least 2 API server instances behind the LB (start with 2 × 2 vCPU, 4GB RAM)
- [ ] Configure nginx rate limiting (global: 10,000 req/min, per-IP: 500 req/min)
- [ ] Set up auto-scaling policy: CPU > 70% for 5 minutes → add instance (max 10)

### 1.5 Celery Workers
- [ ] Deploy dedicated Celery workers per queue type:
  - [ ] `scans` queue: 4 workers, 2 concurrency each — run on hosts with Docker
  - [ ] `vapt` queue: 2 workers, 4 concurrency each
  - [ ] `alerts` queue: 2 workers, 4 concurrency each
  - [ ] `reports` queue: 1 worker, 1 concurrency — heavy PDF generation
  - [ ] `celery` (default) queue: 2 workers, 4 concurrency each
- [ ] Configure `worker_max_tasks_per_child = 50` (prevent memory leaks)
- [ ] Configure `worker_max_memory_per_child = 500000` (500MB per child process)
- [ ] Deploy Celery Beat on a dedicated instance (singleton — use Redis scheduler for HA)
- [ ] Set up worker auto-scaling based on queue depth (>100 backlogged → add worker)

### 1.6 Docker
- [ ] Install Docker on scan worker hosts
- [ ] Pre-pull all scanner images:
  ```bash
  docker pull instrumentisto/nmap:latest
  docker pull projectdiscovery/nuclei:latest
  docker pull projectdiscovery/subfinder:latest
  docker pull projectdiscovery/httpx:latest
  docker pull projectdiscovery/katana:latest
  docker pull secsi/sqlmap:latest
  docker pull leonjza/gowitness:latest
  docker pull aquasec/trivy:latest
  docker pull zricethezav/gitleaks:latest
  docker pull returntocorp/semgrep:latest
  docker pull mcr.microsoft.com/playwright:latest
  ```
- [ ] Create Docker network: `phantix_scan_network` (isolated)
- [ ] Configure Docker daemon with resource limits (default 2GB RAM per container, 2 CPUs)
- [ ] Set up Docker image update automation (weekly cron to pull latest tags)
- [ ] Configure Docker daemon logging (max 100MB per container, max 3 files)

### 1.7 CI/CD Pipeline
- [ ] Set up GitHub Actions / GitLab CI:
  - [ ] Lint: `ruff check app tests`
  - [ ] Type check: `mypy app`
  - [ ] Test: `pytest -q` (against PostgreSQL service container)
  - [ ] Build: Docker image build
  - [ ] Deploy: automatic on merge to `main` (staging), manual approval for production
- [ ] Configure Docker image registry (Docker Hub, GitHub Container Registry, or Hetzner)
- [ ] Set up database migration step in pipeline (`alembic upgrade head`)
- [ ] Add security scanning to pipeline (Trivy on Docker image, Gitleaks on repo)

---

## 2. Configuration & Secrets

### 2.1 Environment Variables — Production
- [ ] Set `ENVIRONMENT=production` (rejects SQLite, enables strict mode)
- [ ] Set `SECRET_KEY` to a strong random value (64+ chars)
- [ ] Set `ENCRYPTION_KEY` using Fernet key generation
- [ ] Set `STAFF_BOOTSTRAP_EMAIL` and `STAFF_BOOTSTRAP_PASSWORD` (used once)
- [ ] Set `STAFF_BOOTSTRAP_NAME` to admin name
- [ ] Set `OTP_DEV_EXPOSE=false` (CRITICAL — must never be true in production)
- [ ] Set `RATE_LIMIT_ENABLED=true`
- [ ] Set `TOOL_LOCK_REDIS_ENABLED=true`
- [ ] Set `BUS_DEAD_LETTER_ENABLED=true`
- [ ] Set `SMTP_*` for email OTP delivery
- [ ] Set `OBJECT_STORAGE_BACKEND=s3`
- [ ] Set `OBJECT_STORAGE_*` with real S3 credentials and endpoint
- [ ] Set `NVD_API_KEY` for CVSS enrichment (free from NVD)
- [ ] Set `BURP_MCP_ENDPOINT` and `BURP_LICENSE_KEY` (if using Burp)
- [ ] Set `AI_*` provider API keys (OpenAI, Anthropic) if AI Engine is enabled

### 2.2 Secrets Management
- [ ] Use a secrets manager (AWS Secrets Manager, HashiCorp Vault, or Coolify secrets)
- [ ] Never store secrets in `.env` files in production
- [ ] Rotate `SECRET_KEY` and `ENCRYPTION_KEY` quarterly
- [ ] Rotate cloud provider credentials monthly

### 2.3 DNS & Domains
- [ ] Provision domain (e.g., `api.phantix.io`)
- [ ] Set up A record(s) pointing to load balancer IP
- [ ] Provision SSL certificate (Let's Encrypt via Certbot or LB-managed)
- [ ] Set up SPF, DKIM, and DMARC for email delivery (OTP + alert emails)

---

## 3. Security Hardening

### 3.1 Application Security
- [ ] Run migration: `alembic stamp head` to baseline the database
- [ ] Run all migrations: `alembic upgrade head`
- [ ] Verify `OTP_DEV_EXPOSE=false`
- [ ] Verify staff bootstrap secrets are removed or disabled
- [ ] Add CORS origins: `BACKEND_CORS_ORIGINS=https://app.phantix.io,https://admin.phantix.io`
- [ ] Configure rate limits on unauthenticated endpoints (5/min register, 10/min login)
- [ ] Enable request size limits (nginx: `client_max_body_size 250M` for APK uploads)
- [ ] Set up Web Application Firewall (Cloudflare, AWS WAF, or nginx ModSecurity) — block SQLi, XSS, path traversal at the edge

### 3.2 Docker Security
- [ ] All scanner containers run with: `--security-opt no-new-privileges --read-only --cap-drop ALL`
- [ ] Scan workers have no outbound internet access except to customer security DBs
- [ ] Docker socket is not mounted into any container
- [ ] Container images are scanned weekly for CVEs
- [ ] Only pre-approved images can run (no user-provided images)

### 3.3 Network Security
- [ ] API servers only accessible via load balancer (no direct public IP)
- [ ] Celery workers in private subnet, outbound access to customer DBs only
- [ ] Database accessible only from API servers + Celery workers (security group / firewall)
- [ ] Redis accessible only from API servers + Celery workers
- [ ] SSH access restricted to bastion host or Tailscale VPN
- [ ] All inter-service communication over TLS

### 3.4 Data Security
- [ ] Verify `ENCRYPTION_KEY` is set and decryption works
- [ ] Verify per-org credential cache does not persist across instance restarts (Redis TTL-based)
- [ ] Verify PII redaction in AI Engine is active (it is — must stay that way)
- [ ] Confirm no raw findings are sent to LLM providers (metadata-only principle)
- [ ] Set up automated security scanning for the platform DB (monitor for unusual queries)

---

## 4. Monitoring & Observability

### 4.1 Metrics to Track

| Metric | Tool | Alert Threshold |
|---|---|---|
| API latency p95 > 500ms | Prometheus + Grafana | Warning at 500ms, Critical at 1s |
| API error rate > 1% | Prometheus + Grafana | Warning at 1%, Critical at 5% |
| Platform DB connection pool > 80% | Operations Engine | Warning at 70%, Critical at 90% |
| Celery queue depth > 100 | Celery inspect + Prometheus | Warning at 100, Critical at 500 |
| Scan worker failure rate > 5% | Scan logs | Warning at 5%, Critical at 20% |
| Security DB connection failures > 5/min | Operations Engine | Warning at 5, Critical at 20 |
| AI Engine cost > 80% monthly budget | AI Engine cost_manager | Warning at 80%, Critical at 100% |
| Per-org rate limit violations > 100/day | Redis + Prometheus | Warning at 100 per org, email to admin |
| Docker container restarts > 3 in 1 hour | Docker events | Critical — probable scan worker crash |

### 4.2 Logging
- [ ] Set up centralized logging (ELK, Grafana Loki, or Axiom)
- [ ] Ensure every log line includes `org_id`, `correlation_id`, and `engine`
- [ ] Set up log retention: 30 days hot, 90 days warm, 1 year cold archive
- [ ] Configure alert rules in the logging system (error rate spikes, 5xx surges)

### 4.3 Alerting
- [ ] Set up incident response channels (email, Slack, PagerDuty)
- [ ] Critical alerts (SMS/call):
  - [ ] Platform DB down
  - [ ] Redis down
  - [ ] API completely unreachable (all instances down)
  - [ ] Security breach detected (unusual auth patterns, data exfiltration)
- [ ] Warning alerts (email/chat):
  - [ ] High latency
  - [ ] Elevated error rates
  - [ ] Disk usage > 80%
  - [ ] Memory usage > 80%
  - [ ] Celery queue backlog

### 4.4 Dashboards
- [ ] Operations Dashboard: server stats, DB pool, Celery queues, active scans
- [ ] Business Dashboard: org signups, active campaigns, assessments completed
- [ ] Security Dashboard: rate limit violations, auth failures, scan findings trend
- [ ] Cost Dashboard: AI spending per org, total infra cost, projected monthly

---

## 5. Compliance & Business Readiness

### 5.1 Legal & Policy
- [ ] Privacy notice published at `GET /api/v1/organizations/privacy` — verify content
- [ ] Terms of service published
- [ ] Data Processing Agreement (DPA) template ready for enterprise clients
- [ ] Consent flow for AI features working (opt-in per org)
- [ ] Consent flow for correlation mining working (opt-in per org)

### 5.2 Staff Onboarding
- [ ] Create initial staff accounts (admin, support)
- [ ] Configure staff bootstrap: set `STAFF_BOOTSTRAP_EMAIL`, `STAFF_BOOTSTRAP_PASSWORD` in `.env` (removed after first startup)
- [ ] Staff login tested and working
- [ ] Admin dashboard accessible
- [ ] Support ticket management workflow tested

### 5.3 Client Onboarding Flow
- [ ] Verify complete registration flow: register → login → privacy → OTP → setup complete
- [ ] Create sample new org and walk through the full flow manually
- [ ] Test password reset / account recovery
- [ ] Verify email OTP delivery via SMTP (not just console log)
- [ ] Test with `OTP_DEV_EXPOSE=false`

### 5.4 Billing
- [ ] Pricing page accessible at `GET /api/v1/billing/pricing`
- [ ] Subscription creation workflow tested
- [ ] Payment simulation tested (simulated provider)
- [ ] Subscription cancellation tested
- [ ] Renewal invoicing tested (`POST /admin/billing/run-renewals`)
- [ ] Billing settings configurable via admin

---

## 6. Performance & Load Testing

### 6.1 Before Going Live
- [ ] Run load test with 50 concurrent simulated orgs (locust or k6):
  - [ ] API endpoints respond within 200ms p95
  - [ ] Platform DB pool stays < 50 connections
  - [ ] No request timeouts
  - [ ] Rate limiting triggers correctly
- [ ] Run scan test with 3 concurrent VAPT campaigns:
  - [ ] Campaign step transitions work correctly
  - [ ] Correlation engine produces findings
  - [ ] Report generation completes
- [ ] Verify all Celery queues drain within expected timeframes
- [ ] Test concurrent report generation (PDF, XLSX, DOCX simultaneously)

### 6.2 Key Sizing Limits (50 Org Target)

| Resource | Limit | Monitored By |
|---|---|---|
| Platform DB connections | 60 (pool 30 + overflow 30) | Operations Engine |
| Concurrent scans (global) | 5 Docker containers | Global semaphore |
| Concurrent scans per org | 1 scan job | DB constraint |
| Concurrent VAPT campaigns per org | 1 campaign | DB constraint |
| Concurrent reports | 2 (1 worker, 1 concurrency) | Celery queue |
| API requests per org | 500/min (standard), 2000/min (enterprise) | Redis rate limiter |
| APK upload size | 200 MB | Request body limit |
| AI monthly spend per org | Configurable (default $50) | AI Engine cost_manager |

---

## 7. Backup & Disaster Recovery

### 7.1 Backup Schedule
- [ ] Platform DB: daily full backup (pg_dump), continuous WAL archiving
- [ ] Object storage: cross-region replication for critical buckets
- [ ] Redis: RDB snapshots every hour (AOF log for point-in-time)
- [ ] Configuration: version-controlled in Git (`.env.example` only, no secrets)

### 7.2 Recovery Plan
- [ ] **Scenario 1: API server crash** — Auto-healing via Docker Compose restart or K8s pod restart
- [ ] **Scenario 2: Database corruption** — Restore from latest backup, apply WAL to point before corruption
- [ ] **Scenario 3: Full region outage** — Deploy to secondary region using RDS cross-region replica + DNS failover
- [ ] **Scenario 4: Secrets compromise** — Rotate ALL keys immediately, invalidate all sessions, force password reset for all staff

### 7.3 Runbooks
- [ ] Document: How to restart a failed Celery worker
- [ ] Document: How to clear a stuck scan job
- [ ] Document: How to rollback a database migration
- [ ] Document: How to manually trigger a report re-generation
- [ ] Document: How to force-reset a stuck campaign

---

## 8. Engineering Docs — Final Cleanup

### 8.1 Repository Cleanup
- [ ] Remove `phantix.db` (SQLite dev database — should not be in repo)
- [ ] Clean up `.mypy_cache/`, `.pytest_cache/`, `.ruff_cache/` (add to `.gitignore`)
- [ ] Verify `.env` is in `.gitignore`
- [ ] Remove `Phantix_Hetzner_Coolify_Tailscale_Staging_Setup.md:Zone.Identifier` and similar zone identifier files
- [ ] Clean up leftover `__pycache__` directories

### 8.2 Documentation Review
- [ ] Run `pytest -q` — all tests passing
- [ ] Run `ruff check app tests` — no lint errors
- [ ] Run `mypy app` — no type errors
- [ ] Verify API docs at `/docs` are complete and accurate
- [ ] Seed database with sample data for demo purposes

---

**End of Production Setup Checklist**

*This document covers everything required to go from a tested development backend to a production-ready deployment. Estimated setup time: 2-3 days for infrastructure provisioning + 2 days for configuration and testing with 1-2 engineers.*
