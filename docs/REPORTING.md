# Reporting Engine

**Guide**: [REPORTING_ENGINE_IMPLEMENTATION_GUIDE.md](../Phantix%20Architecture%20Vault/Engineering%20Docs/REPORTING_ENGINE_IMPLEMENTATION_GUIDE.md)  
**Package**: `app/engines/reporting_engine/`  
**Status**: **Implemented (Phases 1–4)** — consolidation, CVSS, tracker, AI narratives, multi-format render (MD/JSON/CSV/XLSX/PDF/DOCX), charts, compliance sections, ad hoc exports.

---

## Role

**Consolidate** sections from other engines → **Enrich** (CVSS + narratives) → **Produce** multi-format reports.

**MUST NOT**: scan, score risk, **perform** compliance mapping (Compliance Engine maps; Reporting only embeds sections), send channel alerts, own raw scan results.

### Compliance sections

Reports with `compliance_engine` included (default for `vapt_campaign` / `compliance` types) pull `COMPLIANCE_MAPPING` from:

- `app/engines/compliance_engine/services/report_sections.py`
- Frameworks: **NDPR**, **ISO 27001**, **SOC 2** (MVP control catalogs)

Standalone compliance API: `GET/POST /api/v1/compliance/*`

---

## Platform tables

| Table | Purpose |
|-------|---------|
| `reports` | Persisted reports (max `REPORT_MAX_VERSIONS` per type/org) |
| `report_cve_cache` | NVD/CVSS cache |
| `report_finding_tracker` | Cross-campaign finding lifecycle |
| `report_tracker_history` | Tracker change history |

```bash
alembic upgrade head   # includes k1f2a3b4c5d6 reporting tables
```

---

## API (org JWT)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/reports` | Generate report (`run_inline` or Celery) |
| `GET` | `/api/v1/reports` | List |
| `GET` | `/api/v1/reports/{id}` | Metadata + sections |
| `GET` | `/api/v1/reports/{id}/download?format=markdown` | Download artifact |
| `POST` | `/api/v1/reports/export` | Ad hoc risks/audit/vapt/tracker/compliance export |
| `GET` | `/api/v1/reports/tracker` | Finding tracker |
| `PATCH` | `/api/v1/reports/tracker/{finding_key}` | Update status/owner |
| `GET` | `/api/v1/engines/reporting/status` | Engine status |

### Generate example

```json
POST /api/v1/reports
{
  "report_type": "vapt_campaign",
  "campaign_id": 12,
  "formats": ["markdown", "json", "xlsx", "pdf", "docx"],
  "run_inline": true
}
```

| `report_type` | Use |
|---------------|-----|
| `vapt_campaign` | Full campaign package (default) |
| `executive` | Board-oriented summary sections |
| `compliance` | Compliance-first structure |
| `tracker` | Tracker snapshot focused |

**Formats**: `markdown`, `json`, `csv`, `xlsx`, `pdf`, `docx`

| Format | Library |
|--------|---------|
| markdown / json / csv | stdlib |
| xlsx | openpyxl |
| docx | python-docx (VAPT structured template) |
| pdf | WeasyPrint + Jinja2 `vapt_report_template.html` + matplotlib charts |

Artifacts are stored via `storage_manager` (local filesystem or S3) under bucket `phantix-reports`.

### Verification gate (false-positive control)

Client reports **do not collate unverified findings** by default.

| Status | Included in executive report? |
|--------|-------------------------------|
| `auto_verified` / `manually_verified` | Yes |
| `unverified` (heuristic probes, bare open ports, …) | No — optional appendix |
| `rejected` / `false_positive` / reachability | No |

Intelligence stats on the report package:

- `after_dedupe` — unique rows after fingerprinting  
- `after_verification` — rows that passed the gate  
- `excluded_from_report` — held out of severity rollups / priority themes  

Shared classifier: `app/shared/findings/verification.py`.  
Config: `REPORT_REQUIRE_VERIFIED_FINDINGS`, `REPORT_INCLUDE_UNVERIFIED_APPENDIX`.

---

## Auto-generation

| Event | Action |
|-------|--------|
| `CampaignCompleted` | Celery `phantix.reporting.generate_report` (markdown, json, xlsx, pdf) |
| `ComplianceReportReady` | Compliance report generation |
| `AIReportNarrativesCompleted` / `AICompleted` | Attach AI narratives when `report_id` present |

Publishes: `ReportGenerated`, `ReportFailed`, `ReportArchived`.

Celery beat:

- `phantix.reporting.refresh_cve_cache` — stale NVD cache refresh  
- `phantix.reporting.enforce_retention` — purge archived reports past `remove_after`

---

## Config

```env
REPORT_MAX_VERSIONS=3
REPORT_REQUIRE_VERIFIED_FINDINGS=true
REPORT_INCLUDE_UNVERIFIED_APPENDIX=true
NVD_API_KEY=                 # optional; higher NVD rate limit
NVD_CACHE_TTL_DAYS=30
OBJECT_STORAGE_BACKEND=local # or s3
OBJECT_STORAGE_ROOT=./data/object_storage
# OBJECT_STORAGE_BUCKET_REPORTS used conceptually as phantix-reports
```

### Dependencies

```bash
pip install -r requirements.txt
# includes: openpyxl python-docx Jinja2 matplotlib weasyprint
# system: libcairo2 libpango-1.0-0 libgdk-pixbuf-2.0-0 (Ubuntu packages usually present)
```

---

## Pipeline

1. Enforce retention (archive oldest if ≥ max versions; alert via `ReportArchived`)
2. Collect sections (VAPT, Risk, Scanner, Asset, Audit, Compliance)
3. **Intelligence layer** (`finding_intelligence` + `report_presenter`):
   - Fingerprint dedupe (title/host/port/CVE)
   - Prefer correlated VAPT over raw scanner rows
   - Recalibrate baseline scan severities (open ports / ICMP / DNS resolve)
   - **Verification gate** — only auto/manual-verified findings collated
   - Unverified candidates → optional appendix section (not executive severity)
   - Clean campaign overview (strip Celery/async noise)
   - Present compliance as executive markdown + tables (not raw JSON only)
4. CVSS enrich findings (cache + NVD API)
5. Upsert finding tracker + snapshot section
6. Intelligent template narratives (+ bus `AIRequested` — AI Engine may replace prose)
7. Assemble structure by report type + `vapt_template_context` for PDF/DOCX
8. Generate severity charts (matplotlib)
9. Render formats → object storage (PDF/DOCX use Phantix VAPT template structure)
10. Persist report + publish `ReportGenerated` (Alert Engine notifies)

### Executive PDF/DOCX (VAPT campaign)

`format=pdf` / `docx` use the standardized VAPT deliverable template:

Cover · Document Control · §§1–9 (exec, scope, priority findings with **confidence**, attack paths, technical catalogue, risk split, compliance, roadmap + retest tracker, methodology) · Appendix A (evidence IDs).

Templates live under `app/engines/reporting_engine/templates/pdfs/`.

---

## Frontend notes

Full FE contract: [frontend/02_PLATFORM_IMPLEMENTATION.md](./frontend/02_PLATFORM_IMPLEMENTATION.md) §10 · [frontend/03_APPLICATION_IMPLEMENTATION.md](./frontend/03_APPLICATION_IMPLEMENTATION.md) §4.6.

- Prefer `run_inline: false` for large campaigns (PDF/DOCX) to avoid gateway timeouts; poll `GET /reports/{id}` until `status=complete`.
- Download with `format=` query; response is the file bytes with `Content-Disposition`.
- Tracker is org-scoped and survives campaigns — use for remediation UI.
- Surface verification stats (`after_verification`, `excluded_from_report`) so users understand FP filtering.
- Tracker statuses `verified` / `false_positive` feed future classification.
- Empty campaigns still produce a complete report package for audit evidence.
