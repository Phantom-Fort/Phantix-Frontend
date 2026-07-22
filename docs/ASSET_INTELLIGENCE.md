# Asset Intelligence

**Spec**: Phantix Asset Intelligence Specification v0.1 (July 21, 2026)  
**Package**: `app/engines/asset_engine/services/asset_intelligence_service.py`  
**Status**: **Phase 2 implemented** (REST + SSE; GraphQL-ready payloads)  
**Schema**: security DB `1.5.1` — enrichment + relationships + posture summaries

---

## What it does

Turns inventory + scan results + risks into an **operator-friendly** view:

- Current risk score / level (from Risk Engine, with finding-derived fallback)
- Previous risk score / delta (change detection)
- Open findings counts by severity (verification-aware)
- Last scanned time, exposure, priority score
- Relationship graph (domain↔subdomain, host↔IP, IP↔port, API, repo, DB, cloud)
- Recommended next actions (deterministic)
- Plain-language posture summary (+ optional AI rephrase of known facts only)
- Realtime SSE for live dashboards

All data stays in the **customer Dedicated Security Database**.

---

## REST API (org JWT / app dual-token)

Base: `/api/v1/assets`

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/intelligence/dashboard` | Org posture score + critical lists + unscanned |
| `GET` | `/intelligence/prioritized` | Sorted asset list with filters |
| `POST` | `/intelligence/refresh` | Recompute all active assets (batch) |
| `GET` | `/intelligence/graph` | Org relationship graph (nodes + edges) |
| `GET` | `/intelligence/stream` | **SSE** realtime feed |
| `GET` | `/intelligence/events/recent` | Ring-buffer recent events |
| `GET` | `/{id}/intelligence` | Full intelligence context (`?ai=true` for AI narrative) |
| `POST` | `/{id}/intelligence/refresh` | Recompute one asset |
| `POST` | `/{id}/intelligence/ai-summary` | On-demand AI posture narrative |
| `GET` | `/{id}/related` | One-hop neighbors |
| `GET` | `/{id}/graph` | Ego-network multi-hop graph (`depth` 1–4) |

### Realtime SSE

```http
GET /api/v1/assets/intelligence/stream?replay=10
Authorization: Bearer <token>
Accept: text/event-stream
```

| Event | When |
|-------|------|
| `connected` | Stream opened |
| `assetUpdated` | Asset enrichment ran |
| `intelligenceUpdated` | Same payload family as assetUpdated |
| `riskScoreChanged` | Risk score or level changed vs previous |
| `assetDiscovered` | First intelligence enrich (new asset) |
| `newFindingOnAsset` | Bus `FindingCreated` |
| `heartbeat` | Keep-alive (~25s) |

Shared hub: `app.shared.realtime` — also used by the SOC monitoring dashboard scaffold.

### AI posture

AI **only rephrases facts already on the asset** (risk, findings counts, tags, actions).  
It never invents CVEs or scores. On failure → deterministic summary.

```http
GET /api/v1/assets/77/intelligence?ai=true
POST /api/v1/assets/77/intelligence/ai-summary
```

Response fields: `postureSummary`, `whyPrioritized`, `summarySource` (`deterministic` | `ai` | `ai_cached`).

### Graph

```http
GET /api/v1/assets/intelligence/graph?max_nodes=150
GET /api/v1/assets/77/graph?depth=2&max_nodes=100
```

```json
{
  "nodes": [{ "id": 1, "value": "…", "assetType": "domain", "riskLevel": "High", … }],
  "edges": [{ "source": 1, "target": 2, "relationshipType": "domain_to_subdomain" }],
  "rootAssetId": 77,
  "depth": 2,
  "truncated": false
}
```

---

## Enrichment triggers

| Event | Action |
|-------|--------|
| `ScanCompleted` | Re-enrich affected / top assets + SSE |
| `FindingCreated` | `newFindingOnAsset` SSE + re-enrich |
| `RiskCreated` / `RiskUpdated` | Re-enrich + possible `riskScoreChanged` |
| `AssetCreated` / `AssetUpdated` | Initial enrich + relationships |
| Manual | `POST …/intelligence/refresh` |

---

## Schema (security DB)

**On `assets`:**  
Phase 1 fields + `posture_summary`, `ai_posture_summary`, `why_prioritized`,  
`previous_risk_score`, `previous_risk_level`

**Table `asset_relationships`:**  
`source_asset_id`, `target_asset_id`, `relationship_type`, `confidence`, `evidence`

Bootstrap applies `SCHEMA_VERSION = 1.5.1` (idempotent).

---

## SOC monitoring dashboard

Scaffold under **SOC Engine** (`/api/v1/soc/dashboard`). Live asset/risk panels use
Asset Intelligence endpoints today; SOC detections come later.

See `app/engines/soc_engine/docs/README.md` and Architecture Vault `18 - SOC Engine.md`.

---

## Phase roadmap

| Phase | Status |
|-------|--------|
| 1 MVP enrich + relationships + prioritize + REST | **Done** |
| 2 Full graph UX + SSE realtime + AI summaries | **Done** |
| 3 Attack-path hints + deeper temporal analysis | Planned |

---

## Frontend

- Dashboard cards: `/assets/intelligence/dashboard`
- Asset detail: `/assets/{id}/intelligence`
- Graph viz: `/assets/intelligence/graph` or `/{id}/graph`
- Live updates: `EventSource` on `/assets/intelligence/stream`
- Monitoring shell: `/soc/dashboard` (scaffold)
