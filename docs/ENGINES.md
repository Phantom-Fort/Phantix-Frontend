# Phantix Modular Monolith — Engine Architecture

**Status**: Modular monolith — engines + bus + Shared SDK (July 2026)  
**Frontend API contracts**: [frontend/README.md](./frontend/README.md) · [FRONTEND_INTEGRATION.md](./FRONTEND_INTEGRATION.md)  
**Source of truth**: `ARCHITECTURE_MIGRATION_GUIDE.md` · `Phantix Architecture Vault/`  
**Tracking bugs / fixing code**: see [CONTRIBUTOR_GUIDE.md](./CONTRIBUTOR_GUIDE.md) (searchable ownership map)

---

## Official engines (core 10 + VAPT)

| ID | Name | Status | Product API |
|----|------|--------|-------------|
| `control_plane` | Control Plane | implemented | orgs, staff, billing, support, admin… |
| `asset_engine` | Asset Engine | implemented | `/assets`, `/asset-tags` |
| `scanner_engine` | Scanner Engine | implemented | `/scans` |
| `vapt_engine` | VAPT Engine | **implemented** | `/vapt/*`, `/admin/vapt/*` (+ subsidiaries `web_scanner/`, `orchestrator/` — not separate registry entries) |
| `risk_engine` | Risk Engine | implemented | `/risks` |
| `ai_engine` | AI Engine | **implemented** (P1–2; P3 partial; P4–5 pending) | `/ai/*`, `/admin/ai/*`, `/engines/ai/status` |
| `compliance_engine` | Compliance Engine | **implemented** v1.1 (KB + assessments + evidence connectors) | `/compliance/*` + staff `/admin/compliance/*` |
| `reporting_engine` | Reporting Engine | **implemented** (P1–4 + verification gate + VAPT templates) | `/reports`, `/reports/tracker`, `/reports/export`, `/engines/reporting/status` |
| `alert_engine` | Alert Engine | implemented | `/alerts` |
| `audit_engine` | Audit Engine | **implemented** | `/audit/events`, `/audit/export` (pending/roles via CP dual_control) |
| `operations_engine` | Operations Engine | implemented | `/admin/server/*`, `/admin/logs`, `/logs`, **`/search`** (Elasticsearch) |

---

## Layout

```text
app/
  engines/                 # All product engines (full folder standard each)
    registry.py            # register_engine — room for more
    meta.py                # GET /api/v1/engines
    <engine_id>/
      api/ services/ repositories/ models/ schemas/
      workers/ tasks/ adapters/ interfaces/ validators/
      events/ cache/ tests/ docs/
  bus/                     # Engine Bus + domain_events helpers
  shared/                  # Shared SDK (security_db, encryption, …)
  models/                  # Registry only — re-exports engine models for Alembic
  _engine_map.py           # Living ownership map
  main.py                  # Mounts engines via registry
  workers/                 # Celery + alert daemon
```

---

## Discovery API

```http
GET /api/v1/engines
GET /api/v1/engines/{engine_id}
GET /api/v1/engines/ai/status
GET /api/v1/admin/bus/events
```

`/status` includes `engines` payload and `architecture: modular_monolith_10_engines`.

---

## Adding an 11th engine

```python
from app.engines.registry import EngineDescriptor, register_engine

register_engine(EngineDescriptor(
    id="threat_intel_engine",
    name="Threat Intel Engine",
    description="…",
    status="scaffold",
))
```

Or add `app/engines/threat_intel_engine/` with `manifest.MANIFEST` and call
`load_official_engines()` after extending the import list in `registry.load_official_engines`.

---

## Rules

1. **Prefer bus over deep imports** for side-effects — use `app.bus` / `app.bus.domain_events` and engine subscribers.
2. **New cross-domain flows** use PascalCase events (`ScanCompleted`, not new dot.case).
3. **Shared infrastructure** lives in `app.shared` (never copy security DB clients per engine).
4. **Reporting consolidator** may read peer engines for assembly (read-only); do not write foreign SoR tables.
5. **Platform models** are defined under owning engines; import `app.models` only for Alembic / full metadata.

---

## Cross-engine: finding verification (false-positive control)

Shared module: `app/shared/findings/verification.py`

| Stage | Behavior |
|-------|----------|
| Scan write | Stamps `evidence.verification` on each `scan_results` row |
| Risk ingest | Skips non-reportable (heuristic / reachability) scan hits |
| Compliance map | Uses verified signals for control gaps |
| Report collation | **Only** `auto_verified` / `manually_verified` enter executive findings |

Config: `REPORT_REQUIRE_VERIFIED_FINDINGS=true` (default), `REPORT_INCLUDE_UNVERIFIED_APPENDIX=true`.

## Remaining polish

1. AI Engine — consensus multi-model (P3), remaining agents (P4), RAG (P5 deferred)
2. Compliance — live Azure Graph / AWS IAM collection beyond sample_mode
3. Scanner — OpenVAS / Naabu / Httpx / Subfinder first-class adapters; Burp live
4. Alert — WhatsApp / Telegram real providers (email live)

Full security + product backlog: [SECURITY_AND_BACKLOG.md](./SECURITY_AND_BACKLOG.md).
