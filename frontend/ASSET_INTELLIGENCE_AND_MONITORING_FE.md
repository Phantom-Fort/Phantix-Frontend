# Frontend Guide: Asset Intelligence Phase 2 + Monitoring Dashboard Scaffold

**Audience**: Platform / Application frontend engineers  
**Date**: 21 July 2026  
**Backend status**: Asset Intelligence **Phase 2 live**; SOC monitoring dashboard **scaffold only**  
**API base**: `{API_BASE}/api/v1` (e.g. `https://dev.phantix.site/api/v1` or `http://localhost:8000/api/v1`)  
**Auth**: Same as existing asset routes — company JWT **or** org-user JWT **or** app dual-token (`Authorization: Bearer …`). Dual-control session is **not** required for these **GET** reads; use dual-control only for mutating operate flows elsewhere.

---

## 1. What changed (product summary)

Backend now exposes an **Asset Intelligence** layer that turns raw inventory + scans + risks into operator-friendly data:

| Capability | FE impact |
|------------|-----------|
| Enriched asset context | Risk, findings, exposure, priority, actions, plain-language summary |
| Prioritized / dashboard lists | Home security posture without security expertise |
| Relationship graph | Domain ↔ subdomain ↔ IP ↔ ports; repo / API / DB links |
| **Realtime SSE stream** | Live dashboard updates without polling |
| Optional AI posture text | Rephrases known facts only — never invents CVEs/scores |
| **SOC dashboard scaffold** | Panel map + stream wiring; detections not built yet |

**Primary users**: IT admin / founder (non-experts). Prefer plain language, priority, and next actions over raw scan dumps.

---

## 2. Screens to build

Suggested product mapping:

| Screen / component | Primary APIs | Priority |
|--------------------|--------------|----------|
| **Security posture home** | `GET …/intelligence/dashboard` + SSE | P0 |
| **Assets at risk list** | `GET …/intelligence/prioritized` | P0 |
| **Asset detail drawer** | `GET …/assets/{id}/intelligence` | P0 |
| **Never scanned / unverified queues** | prioritized filters | P0 |
| **Relationship graph** | `GET …/intelligence/graph` or `…/{id}/graph` | P1 |
| **Live event feed** | `GET …/intelligence/stream` (SSE) | P1 |
| **Monitoring dashboard shell** | `GET …/soc/dashboard` + Asset Intel live panels | P1 (scaffold) |
| **AI “explain this asset”** | `?ai=true` or `POST …/ai-summary` | P2 |

---

## 3. Auth & headers

```http
Authorization: Bearer <jwt>
Accept: application/json
```

Application surface may also send:

```http
X-Device-Token: <device_jwt>
```

SSE (see §7) needs the same auth. Browser `EventSource` **cannot set custom headers** — use one of:

1. **Cookie session** if your gateway already attaches the JWT (preferred if available), or  
2. **`fetch` + `ReadableStream`** with `Authorization` header (recommended for SPA), or  
3. Short-lived query token only if backend adds it later (**not available today**).

Do **not** put long-lived JWTs in URL query strings.

---

## 4. Endpoint catalog (complete)

Base for assets: `/api/v1/assets`  
Base for SOC shell: `/api/v1/soc`

### 4.1 Asset Intelligence

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/assets/intelligence/dashboard` | Org posture score + critical lists |
| `GET` | `/assets/intelligence/prioritized` | Sorted list with filters |
| `POST` | `/assets/intelligence/refresh` | Recompute all active assets (batch) |
| `GET` | `/assets/intelligence/graph` | Org-wide nodes + edges |
| `GET` | `/assets/intelligence/stream` | **SSE** live feed |
| `GET` | `/assets/intelligence/events/recent` | Ring buffer (no long-poll) |
| `GET` | `/assets/{id}/intelligence` | Full asset intelligence |
| `POST` | `/assets/{id}/intelligence/refresh` | Recompute one asset |
| `POST` | `/assets/{id}/intelligence/ai-summary` | On-demand AI narrative |
| `GET` | `/assets/{id}/related` | One-hop neighbors |
| `GET` | `/assets/{id}/graph` | Ego multi-hop graph |

### 4.2 SOC monitoring scaffold

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/soc/status` | Engine scaffold metadata |
| `GET` | `/soc/dashboard` | Panel layout shell |
| `GET` | `/soc/dashboard/events/recent` | Same hub buffer (monitoring shell) |
| `GET` | `/soc/dashboard/stream-info` | Stream URL + event type list |

> **Important**: SOC panels with `"ready": false` have **no backend data yet**. Wire UI shells as “Coming soon”; only Asset Intelligence panels are live.

---

## 5. Query parameters

### Prioritized list — `GET /assets/intelligence/prioritized`

| Param | Type | Description |
|-------|------|-------------|
| `risk_level` | string | `critical` \| `high` \| `medium` \| `low` |
| `exposure` | string | `external` \| `internal` \| `unknown` |
| `tag` | string | Tag name (e.g. `production`) |
| `verified` | bool | Filter verification |
| `unscanned_only` | bool | `true` → never scanned |
| `limit` | int | 1–200 (default 50) |
| `offset` | int | Pagination |

### Single asset intelligence — `GET /assets/{id}/intelligence`

| Param | Type | Description |
|-------|------|-------------|
| `refresh` | bool | Force re-enrich before read (slower) |
| `ai` | bool | Generate AI posture narrative (facts only; may take seconds) |

### Graph

| Path | Params |
|------|--------|
| `/assets/intelligence/graph` | `max_nodes` (5–500, default 150), `relationship_type` (optional filter) |
| `/assets/{id}/graph` | `depth` (1–4, default 2), `max_nodes` (5–300, default 100) |

### SSE stream — `GET /assets/intelligence/stream`

| Param | Type | Description |
|-------|------|-------------|
| `replay` | int | 0–50 last buffered events on connect |

### Batch refresh — `POST /assets/intelligence/refresh`

| Param | Type | Description |
|-------|------|-------------|
| `limit` | int | Max assets to recompute (1–2000, default 500) |

---

## 6. Response shapes (camelCase — use as-is)

Backend returns **camelCase** for intelligence payloads so a future GraphQL layer can wrap without reshaping. Prefer these field names in TypeScript types.

### 6.1 Dashboard — `GET /assets/intelligence/dashboard`

```ts
type IntelligenceDashboard = {
  organizationId: number;
  postureScore: number; // 0–100 (higher = healthier)
  totals: {
    activeAssets: number;
    verified: number;
    unverified: number;
    neverScanned: number;
    highRiskAssets: number;
    externalAssets: number;
    openFindings: number;
  };
  criticalAssetsAtRisk: Array<{
    id: number;
    value: string | null;
    assetType: string | null;
    riskLevel: string | null;
    riskScore: number | null;
    openFindingsCount: number | null;
    priorityScore: number;
    exposureLevel: string | null;
    isVerified: boolean | null;
  }>;
  newlyDiscoveredUnscanned: Array<{
    id: number;
    value: string | null;
    assetType: string | null;
    firstSeenAt: string | null;
    isVerified: boolean | null;
    source: string | null;
  }>;
  generatedAt: string; // ISO
};
```

**UI tips**

- Large `postureScore` gauge + short explanation (“based on high-risk assets, open findings, scan coverage”).
- Table for `criticalAssetsAtRisk` → click opens asset intelligence drawer.
- Banner for `newlyDiscoveredUnscanned` → “Run a scan” CTA.

### 6.2 Prioritized list — `GET /assets/intelligence/prioritized`

```ts
type PrioritizedAssetList = {
  items: Array<{
    id: number;
    value: string | null;
    name: string | null;
    assetType: string | null;
    tags: string[];
    riskScore: number | null;
    riskLevel: string | null;
    openFindingsCount: number;
    criticalFindingsCount: number;
    highFindingsCount: number;
    lastScannedAt: string | null;
    isVerified: boolean;
    exposureLevel: string; // external | internal | unknown
    criticality: string | null;
    priorityScore: number; // sort key (higher = more attention)
    relatedAssetCount: number;
  }>;
  total: number;
  limit: number;
  offset: number;
};
```

### 6.3 Full asset intelligence — `GET /assets/{id}/intelligence`

```ts
type RecommendedAction = {
  title: string;
  priority: "critical" | "high" | "medium" | "low" | string;
  reason: string;
  action_key: string; // e.g. verify_asset | scan_asset | triage_findings | treat_risk | maintain
};

type AssetIntelligence = {
  id: number;
  value: string | null;
  name: string | null;
  assetType: string | null;
  tags: string[];
  riskScore: number | null;
  riskLevel: string | null;
  previousRiskScore: number | null;
  previousRiskLevel: string | null;
  riskScoreDelta: number | null; // current - previous (positive = worse if score is “risk”)
  openFindingsCount: number;
  criticalFindingsCount: number;
  highFindingsCount: number;
  mediumFindingsCount: number;
  lowFindingsCount: number;
  infoFindingsCount: number;
  lastScannedAt: string | null;
  isVerified: boolean;
  verificationMethod: string | null;
  exposureLevel: string;
  criticality: string | null;
  owner: string | null;
  source: string | null;
  isActive: boolean;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  relatedAssetCount: number;
  priorityScore: number;
  intelligenceUpdatedAt: string | null;
  relatedAssets: Array<{
    id: number;
    value: string | null;
    name: string | null;
    assetType: string | null;
    relationshipType: string | null;
    riskLevel: string | null;
    openFindingsCount: number | null;
    isVerified: boolean | null;
    confidence: number;
  }>;
  openFindings: Array<{
    id: number;
    title: string | null;
    severity: string | null;
    tool: string | null;
    createdAt: string | null;
    verificationStatus: string | null;
    reportable: boolean | null;
  }>;
  risks: Array<{
    id: number;
    title: string | null;
    riskScore: number | null;
    riskLevel: string | null;
    status: string | null;
    treatmentStatus: string | null;
  }>;
  recommendedActions: RecommendedAction[];
  postureSummary: string;       // plain language
  whyPrioritized: string;       // why this asset is ranked high
  summarySource: "deterministic" | "ai" | "ai_cached" | string;
};
```

**UI tips**

- Lead with `postureSummary` + `recommendedActions` (not raw findings).
- Badge `riskLevel` / `exposureLevel` / verified state.
- Show `riskScoreDelta` as “risk up/down” when non-null and non-zero.
- Map `action_key` to in-app navigation:

| `action_key` | Suggested FE action |
|--------------|---------------------|
| `verify_asset` | Open verify ownership flow |
| `scan_asset` | Start scan / VAPT target this asset |
| `triage_findings` | Open findings for asset |
| `review_findings` | Open findings list |
| `treat_risk` | Open risk detail / treatment |
| `harden_edge` | Show hardening checklist (static copy OK) |
| `maintain` | Soft “all clear” state |

### 6.4 Graph — `GET /assets/intelligence/graph` or `GET /assets/{id}/graph`

```ts
type RelationshipGraph = {
  nodes: Array<{
    id: number;
    value: string | null;
    name: string | null;
    assetType: string | null;
    riskLevel: string | null;
    riskScore: number | null;
    openFindingsCount: number;
    isVerified: boolean;
    exposureLevel: string;
    priorityScore: number;
  }>;
  edges: Array<{
    id: number;
    source: number; // asset id
    target: number;
    relationshipType: string;
    confidence: number;
  }>;
  rootAssetId: number | null; // set for ego graph
  depth: number;
  truncated: boolean;
  nodeCount: number;
  edgeCount: number;
};
```

**Relationship types** (edge labels — humanize in UI):

| `relationshipType` | Label idea |
|--------------------|------------|
| `domain_to_subdomain` | Domain → subdomain |
| `host_to_ip` | Host → IP |
| `ip_to_port_service` | IP → port/service |
| `host_to_port_service` | Host → port/service |
| `api_to_host` | API → host |
| `parent_of` | Parent |
| `repo_to_service` | Repo → service |
| `database_to_application` | Database → app |
| `subdomain_sibling` | Sibling subdomains |
| `cloud_to_resource` | Cloud account → resource |

If `truncated: true`, show “Showing top N assets — zoom into a node for more.”

### 6.5 AI summary — `POST /assets/{id}/intelligence/ai-summary`

```ts
type AiPostureSummary = {
  assetId: number;
  postureSummary: string;
  whyPrioritized: string;
  summarySource: string;
  recommendedActions: RecommendedAction[];
};
```

- Call on user action (“Explain in plain language”), not on every list row.
- Show loading state; fallback text is always valid even if `summarySource === "deterministic"`.
- **Never** present AI text as a vulnerability verdict. Subtitle: “Summary of known data only.”

### 6.6 Refresh responses

```ts
// POST /assets/intelligence/refresh
type IntelligenceRefreshResponse = {
  organization_id: number; // snake_case on this response only
  updated: number;
  errors: number;
  total_candidates: number;
};

// POST /assets/{id}/intelligence/refresh
// { ok: true, asset_id, risk_score, risk_level, priority_score, ... }
```

### 6.7 SOC dashboard shell — `GET /soc/dashboard`

```ts
type SocDashboardScaffold = {
  organizationId: number;
  status: "scaffold";
  generatedAt: string;
  panels: Array<{
    id: string;
    title: string;
    source: string;
    ready: boolean;
    endpoint: string | null;
    stream?: string;
    note?: string;
  }>;
  liveSubscribers: number;
  message: string;
};
```

Render each panel:

- `ready: true` → fetch `endpoint` / connect `stream`.
- `ready: false` → disabled card + “Available when SOC detections ship.”

---

## 7. Realtime (SSE) — implementation guide

### 7.1 Endpoint

```
GET {API_BASE}/api/v1/assets/intelligence/stream?replay=10
Authorization: Bearer <jwt>
Accept: text/event-stream
```

### 7.2 Event types

| SSE `event:` name | Meaning | FE reaction |
|-------------------|---------|-------------|
| `connected` | Stream opened; includes `eventTypes` list | Mark “live” indicator green |
| `assetUpdated` | Asset enrichment finished | Patch row / detail cache by `payload.assetId` |
| `intelligenceUpdated` | Same family as assetUpdated | Same as above |
| `riskScoreChanged` | Score/level changed vs previous | Highlight risk delta; toast optional |
| `assetDiscovered` | First enrich on new asset | Prepend to “new assets” list |
| `newFindingOnAsset` | New finding on asset | Increment findings badge; toast |
| `heartbeat` | Keep-alive (~25s) | Ignore (or refresh last-seen clock) |

### 7.3 Event payload shape

```ts
type RealtimeEvent = {
  type: string;
  organizationId: number;
  eventId: string;
  ts: string; // ISO
  payload: {
    assetId?: number;
    value?: string | null;
    assetType?: string | null;
    riskScore?: number | null;
    riskLevel?: string | null;
    previousRiskScore?: number | null;
    previousRiskLevel?: string | null;
    openFindingsCount?: number | null;
    priorityScore?: number | null;
    exposureLevel?: string | null;
    findingId?: number | string | null;
    title?: string | null;
    severity?: string | null;
    tool?: string | null;
    source?: string | null;
    [key: string]: unknown;
  };
};
```

### 7.4 Recommended client (fetch stream — supports Authorization)

```ts
async function connectAssetIntelStream(
  apiBase: string,
  token: string,
  onEvent: (type: string, data: RealtimeEvent | unknown) => void,
  signal?: AbortSignal,
) {
  const url = `${apiBase}/api/v1/assets/intelligence/stream?replay=10`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "text/event-stream",
    },
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`SSE failed: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventName = "message";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() || "";
    for (const chunk of chunks) {
      const lines = chunk.split("\n");
      let dataLine = "";
      for (const line of lines) {
        if (line.startsWith("event:")) eventName = line.slice(6).trim();
        if (line.startsWith("data:")) dataLine += line.slice(5).trim();
      }
      if (!dataLine) continue;
      try {
        onEvent(eventName, JSON.parse(dataLine));
      } catch {
        onEvent(eventName, dataLine);
      }
      eventName = "message";
    }
  }
}
```

**Lifecycle**

- Connect when dashboard mounts; `AbortController` on unmount.
- On disconnect: exponential backoff reconnect (1s → 30s).
- After reconnect, optionally `GET /assets/intelligence/dashboard` once to resync.
- `GET /assets/intelligence/events/recent?limit=30` for cold start without holding a stream.

### 7.5 State update strategy

Do **not** refetch the entire list on every event.

```
on assetUpdated | intelligenceUpdated:
  if row in prioritized cache → patch fields from payload
  if detail drawer open for assetId → invalidate that detail query

on riskScoreChanged:
  flash risk badge; show delta if previousRiskScore present

on assetDiscovered:
  invalidate dashboard.newlyDiscoveredUnscanned

on newFindingOnAsset:
  bump openFindingsCount for assetId if known
```

---

## 8. Suggested page compositions

### 8.1 Security home (P0)

```
┌─────────────────────────────────────────────────────────┐
│  Posture score (postureScore)     [Live ●]               │
│  totals: assets | unverified | never scanned | high risk │
├──────────────────────┬──────────────────────────────────┤
│ Critical at risk     │ Newly discovered, not scanned    │
│ (criticalAssets…)    │ (newlyDiscoveredUnscanned)        │
├──────────────────────┴──────────────────────────────────┤
│ Live feed (SSE)  riskScoreChanged / newFinding / …      │
└─────────────────────────────────────────────────────────┘
```

Load sequence:

1. `GET /assets/intelligence/dashboard`
2. Connect SSE
3. Optional: `GET /assets/intelligence/prioritized?limit=10`

### 8.2 Asset inventory (enhanced)

Keep existing `GET /assets` for inventory CRUD. **Add** intelligence columns via:

- Join client-side with prioritized list, **or**
- Open drawer → `GET /assets/{id}/intelligence` (preferred for detail)

Filters that map cleanly to prioritized:

- “High risk” → `risk_level=high` (and/or critical)
- “External” → `exposure=external`
- “Unverified” → `verified=false`
- “Never scanned” → `unscanned_only=true`

### 8.3 Asset detail drawer (P0)

```
Header: value + assetType + riskLevel + exposure + verified
Body:
  postureSummary
  whyPrioritized (collapsible)
  recommendedActions (primary buttons)
  openFindings (table)
  relatedAssets (chips → open graph or navigate)
Footer:
  [Refresh intel] [Explain with AI] [Scan] [Verify]
```

### 8.4 Graph view (P1)

- Org overview: `GET /assets/intelligence/graph`
- Focus mode: `GET /assets/{id}/graph?depth=2`
- Node color by `riskLevel`; size by `priorityScore` or findings
- Click node → open intelligence drawer

### 8.5 Monitoring dashboard (scaffold)

1. `GET /soc/dashboard` → render panel grid from `panels[]`
2. For `ready` panels, use their `endpoint` / `stream` fields (do not hardcode only if you want future flexibility)
3. Hide or gray out `ready: false` (detections / triage)

Until SOC is built, this screen can be titled **“Security monitoring (preview)”** and still deliver value via Asset Intelligence.

---

## 9. Error handling

| HTTP | Typical cause | FE handling |
|------|---------------|-------------|
| 401 | Missing/expired JWT | Re-auth |
| 404 | Unknown asset id | “Asset not found” |
| 409 | Security DB not configured / not bootstrapped | Show setup CTA: connect customer DB / bootstrap schema |
| 400 | Bad query / business error | Show `detail` string |
| 502 | Security DB connectivity | Retry + ops message |

Always read FastAPI `detail` (string or validation array).

If intelligence columns are missing (org on old schema), ops must re-bootstrap security schema to **1.5.1**. FE can surface: “Asset intelligence not ready — contact support / re-run security DB bootstrap.”

---

## 10. Performance & product rules

1. **Do not** call `?ai=true` or `/ai-summary` in list loops.
2. **Do not** call `POST …/intelligence/refresh` on every page load (use after discovery/scan campaigns or admin button).
3. Prefer SSE over polling the dashboard every few seconds.
4. Graph `max_nodes` / `depth` defaults are fine for first paint; increase carefully.
5. AI text is **narrative only** — never treat it as a scanner result.
6. Data residency: all intelligence is per-org security DB; no cross-tenant fields in responses.

---

## 11. TypeScript API helper sketch

```ts
const intel = {
  dashboard: () => api.get("/assets/intelligence/dashboard"),
  prioritized: (q: Record<string, string | number | boolean>) =>
    api.get("/assets/intelligence/prioritized", { params: q }),
  graph: (q?: { max_nodes?: number; relationship_type?: string }) =>
    api.get("/assets/intelligence/graph", { params: q }),
  recentEvents: (limit = 30) =>
    api.get("/assets/intelligence/events/recent", { params: { limit } }),
  one: (id: number, opts?: { refresh?: boolean; ai?: boolean }) =>
    api.get(`/assets/${id}/intelligence`, { params: opts }),
  refreshOne: (id: number) => api.post(`/assets/${id}/intelligence/refresh`),
  refreshAll: (limit = 500) =>
    api.post("/assets/intelligence/refresh", null, { params: { limit } }),
  aiSummary: (id: number) => api.post(`/assets/${id}/intelligence/ai-summary`),
  related: (id: number) => api.get(`/assets/${id}/related`),
  egoGraph: (id: number, depth = 2) =>
    api.get(`/assets/${id}/graph`, { params: { depth } }),
};

const soc = {
  status: () => api.get("/soc/status"),
  dashboard: () => api.get("/soc/dashboard"),
  streamInfo: () => api.get("/soc/dashboard/stream-info"),
};
```

---

## 12. Acceptance checklist (FE)

### Must ship (P0)

- [ ] Posture dashboard page using `/assets/intelligence/dashboard`
- [ ] Prioritized asset table with risk / exposure / unscanned filters
- [ ] Asset intelligence drawer with summary, actions, findings, related chips
- [ ] Correct camelCase typing (no snake_case assumptions on intel payloads)
- [ ] 409 security-DB empty state

### Should ship (P1)

- [ ] SSE live indicator + patch prioritized/detail on events
- [ ] Risk delta display when `riskScoreDelta` present
- [ ] Org or ego relationship graph
- [ ] Monitoring shell page from `/soc/dashboard` (ready panels live; others stubbed)

### Nice (P2)

- [ ] “Explain with AI” button → `/ai-summary` with loading + source badge
- [ ] Event feed panel with recent + live
- [ ] Deep-link action_key → verify / scan / risk routes

---

## 13. What is **not** ready yet

| Item | Status |
|------|--------|
| GraphQL server / GraphQL subscriptions | Not in backend — use REST + SSE |
| SOC detections / triage queue data | Scaffold only (`ready: false`) |
| Attack-path analysis (Intelligence Phase 3) | Not implemented |
| Guaranteed multi-instance SSE fan-out | In-process hub today (single API process); reconnect still works |

---

## 14. Quick curl smoke tests

Replace `$TOKEN` and `$API`.

```bash
# Dashboard
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API/api/v1/assets/intelligence/dashboard" | jq .

# Prioritized external high-attention
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API/api/v1/assets/intelligence/prioritized?exposure=external&limit=10" | jq .

# One asset
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API/api/v1/assets/77/intelligence" | jq '{id, riskLevel, postureSummary, recommendedActions}'

# Graph
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API/api/v1/assets/intelligence/graph?max_nodes=50" | jq '{nodeCount, edgeCount}'

# SOC shell
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API/api/v1/soc/dashboard" | jq '{status, panels}'

# SSE (Ctrl+C to stop)
curl -N -H "Authorization: Bearer $TOKEN" \
  -H "Accept: text/event-stream" \
  "$API/api/v1/assets/intelligence/stream?replay=5"
```

---

## 15. Related backend docs (optional deep dives)

| Doc | Content |
|-----|---------|
| [../ASSET_INTELLIGENCE.md](../ASSET_INTELLIGENCE.md) | Backend intelligence design |
| [02_PLATFORM_IMPLEMENTATION.md](./02_PLATFORM_IMPLEMENTATION.md) | Platform auth + assets section |
| [API_ENDPOINT_CATALOG.md](./API_ENDPOINT_CATALOG.md) | Full route list |
| [../ENGINES.md](../ENGINES.md) | Engine maturity (asset v0.3, soc scaffold) |

---

**Document owner**: Phantix Backend  
**Hand-off purpose**: Single source for FE to implement Asset Intelligence Phase 2 and the monitoring dashboard scaffold without reading backend code.
