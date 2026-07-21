# Elasticsearch Search Integration

**Status**: implemented (optional, fail-open)
**Package**: `app/shared/search/` · API: Operations Engine

---

## Role

Elasticsearch is a **search index**, not system of record:

| SoR (source of truth) | Search index |
|----------------------|--------------|
| Customer security DB (findings, assets, scans) | `phantix-finding`, `phantix-asset`, `phantix-scan_job` |
| Platform DB (audit, org logs) | `phantix-audit`, `phantix-log` |

Every document includes **`organization_id`**. Every query filters by that field (tenant isolation).

---

## Enable (local)

```bash
# Start ES
docker compose up elasticsearch -d

# .env
ELASTICSEARCH_ENABLED=true
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_INDEX_PREFIX=phantix
```

```bash
pip install 'elasticsearch[async]>=8.12.0,<9'
```

---

## API (org JWT)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/search?q=ssh` | Full-text search |
| GET | `/api/v1/search/status` | ES ping / config |

Query params: `q`, `doc_type` (repeatable: `finding`, `scan_job`, `asset`, `audit`, `log`), `severity`, `tool`, `limit`, `offset`.

When ES is disabled or down, the API returns **HTTP 200** with empty hits (`fail-open`).

---

## Indexing paths

1. **Scan completion** — `scan_service.execute_scan_job` indexes results; bus `ScanCompleted` also indexes
2. **AssetCreated** / **FindingCreated** / **RiskCreated** — bus subscribers

---

## Config

| Variable | Default |
|----------|---------|
| `ELASTICSEARCH_ENABLED` | `false` |
| `ELASTICSEARCH_URL` | `http://localhost:9200` |
| `ELASTICSEARCH_USERNAME` / `PASSWORD` | empty |
| `ELASTICSEARCH_API_KEY` | empty |
| `ELASTICSEARCH_INDEX_PREFIX` | `phantix` |
| `ELASTICSEARCH_VERIFY_CERTS` | `true` |

---

## Privacy note

Do not index raw request/response bodies or unredacted PII. Scan evidence is stored under `raw` for search only within the org boundary. For AI/RAG, continue to follow data-residency rules (customer security DB first).
