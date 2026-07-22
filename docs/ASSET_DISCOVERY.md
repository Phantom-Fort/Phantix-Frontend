# Asset Discovery Module

**Status**: MVP + tags/history/scan_jobs + **mobile APK** + **expanded scan targets** + **domain_enum recon** + **dedupe** (security schema **1.4.2**, July 2026)  
**Frontend guide**: [FRONTEND_INTEGRATION.md](./FRONTEND_INTEGRATION.md)  
**Engineering**: [ASSET_ENGINE_ENHANCEMENTS.md](../Phantix%20Architecture%20Vault/Engineering%20Docs/ASSET_ENGINE_ENHANCEMENTS.md)  
**Storage rule**: All asset, tag, history, and scan rows live in the org’s **Dedicated Security Database**
(`connection_purpose = security_data_storage`, schema default `phantix`).
APK **binaries** are stored in object storage (S3-compatible bucket or local filesystem fallback); inventory metadata lives in the security DB.

### Deduplication

- Create/upsert **normalizes** values (host lowercasing, URL cleanup, IP/port stripping).
- Active uniqueness: `(organization_id, asset_type, value)` and case-insensitive `(…, lower(trim(value)))`.
- Same hostname as **domain** and **subdomain** → treated as one inventory item (domain wins).
- Ops purge (all ready security DBs):

```bash
PYTHONPATH=. .venv/bin/python scripts/purge_duplicate_assets.py
PYTHONPATH=. .venv/bin/python scripts/purge_duplicate_assets.py --org 11
PYTHONPATH=. .venv/bin/python scripts/purge_duplicate_assets.py --dry-run
```

### Verification & 404 gate

Only **verified** assets are written to the inventory.

| Check | Behaviour |
|-------|-----------|
| Ownership | Domain name tokens / GitHub match / `confirm_ownership=true` |
| HTTP probe | Domain / subdomain / IP / web_app / api probed over HTTP(S) |
| **HTTP 404** | **Never stored** for domain, subdomain, IP, or URL assets |
| Dead domain | Domain/subdomain with no HTTP response → rejected |
| IP without HTTP | Allowed if ownership/discovery verification passes (no HTTP ≠ 404) |

Discovery (`domain_enum`, DNS IP upserts) uses the same gate — soft-404 and 404 paths are not inventory rows.

### Tagging: automatic + manual

**Automatic (on every successful create/upsert):** system tags such as  
`type:domain`, `source:manual`, `verified`, `criticality:medium`, `priority:high` (when applicable).

**Manual (optional):** create custom tags and assign via API:

```http
POST /api/v1/asset-tags
POST /api/v1/asset-tags/assets/{asset_id}/assign
GET  /api/v1/asset-tags/assets/{asset_id}
```

You do **not** need to tag for basic inventory/reporting — auto-tags cover type, source, and verification. Manual tags are for org-specific labels (e.g. `pci-scope`, `crown-jewel`).

---

## Prerequisites

1. Org has a primary `security_data_storage` connection.
2. Schema bootstrapped to **v1.4.2+**:

```http
POST /api/v1/db-connections/{id}/bootstrap
```

If the connection was previously on 1.0.0, bootstrap upgrades automatically when `SCHEMA_VERSION` differs (adds columns + `discovery_jobs`).

---

## Asset types

| Type | Description |
|------|-------------|
| `domain` | Root domains |
| `subdomain` | Subdomains |
| `ip_address` | IPv4/IPv6 |
| `github_repo` | GitHub repositories |
| `api` | API services (OpenAPI/Postman) |
| `port_service` | Open ports / services |
| `mobile_apk` | Android application packages (uploaded APK) |
| `cloud_resource` | Generic cloud resource |
| `database_connection` | Security evaluation of DB connections |
| `aws_account` | AWS account target for cloud scans |
| `azure_subscription` | Azure subscription target |
| `gcp_project` | GCP project target |
| `container_image` | Docker/OCI image for CVE scan |
| `k8s_cluster` | Kubernetes cluster audit target |
| `domain_controller` | Active Directory DC |
| `ldap_server` | LDAP endpoint |
| `windows_server` / `linux_server` | CIS / compliance hosts |
| `network_device` | Routers, firewalls, switches |
| `dns_server` | DNS security posture target |
| `wazuh_agent` | Compliance evidence collector |
| `web_app` | Discovered web application |
| `saas_tenant` | SaaS tenant (O365, Slack, …) |
| `other` | Catch-all |

---

## API surface (org JWT)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/assets` | Manual create + ownership verification (**async domain_enum** for domain/subdomain) |
| `GET` | `/api/v1/assets` | List / filter |
| `GET` | `/api/v1/assets/{id}` | Get one |
| `PATCH` | `/api/v1/assets/{id}` | Update |
| `DELETE` | `/api/v1/assets/{id}` | Soft-delete (`?hard=true` hard) |
| `POST` | `/api/v1/assets/{id}/verify` | Re-verify ownership |
| `POST` | `/api/v1/assets/integrations/github` | Validate + store GitHub PAT (encrypted on platform DB) |
| `GET` | `/api/v1/assets/integrations/github` | List integrations (login only; never the PAT) |
| `POST` | `/api/v1/assets/import/github` | Import one or all visible repos as `github_repo` assets |
| `POST` | `/api/v1/assets/import/api` | OpenAPI / Postman → `api` asset |
| `POST` | `/api/v1/assets/upload/apk` | Upload APK → `mobile_apk` asset + analysis |
| `POST` | `/api/v1/assets/{id}/apk/reanalyze` | Re-run static analysis on stored APK |
| `POST` | `/api/v1/assets/discovery/jobs` | Start discovery job (`domain_enum`, `dns_enrich`, `nmap`, …) |
| `GET` | `/api/v1/assets/discovery/jobs` | List jobs |
| `GET` | `/api/v1/assets/discovery/jobs/{id}` | Job detail |
| `POST` | `/api/v1/assets/discovery/jobs/{id}/run` | Run pending job |

Mutating routes require dual-control session when configured — see [FRONTEND_INTEGRATION.md](./FRONTEND_INTEGRATION.md).

---

## Manual entry + verification

- **Domains / subdomains**: verified if org name/slug tokens appear in the host
  (e.g. org “Acme Corp” → `api.acme-corp.com`).
- **GitHub**: verified if repo owner matches linked GitHub login or org naming.
- **API / IP / other**: require `confirm_ownership=true` (stored, usually unverified).
- `force_verify=true` marks verified without checks (discovery jobs use gated paths).

Unverified assets are still stored when confirmation is provided; `is_verified=false`.

---

## GitHub (PAT)

Full flow, scopes, and security notes: **[CONNECTIONS.md §6 — GitHub PAT connection](./CONNECTIONS.md#6-github-pat-connection-asset-discovery)**.

### Quick reference

```http
POST /api/v1/assets/integrations/github
{ "personal_access_token": "ghp_…", "label": "default" }

GET /api/v1/assets/integrations/github
# → login + token_configured (never the PAT)

POST /api/v1/assets/import/github
{ "discover_all": true }
# or { "repo": "owner/name" } or full github.com URL
```

**What happens**

1. Backend validates the PAT with GitHub `GET /user` and stores it **encrypted** on the platform DB (`organization_integrations`).
2. Import lists repos via `/user/repos` (or one `/repos/{owner}/{repo}`).
3. Each repo becomes a `github_repo` asset in the **security DB** only (`value` = HTML URL, rich `metadata`).
4. Verification: owner login matches linked `github_login` → `is_verified=true`.

**Scopes**: classic `repo` / `public_repo`, or fine-grained Contents Read on target repos.

GitHub App installation tokens are not supported yet (PAT only).

---

## API import

```http
POST /api/v1/assets/import/api
{
  "format": "openapi",
  "content": "{ … OpenAPI JSON … }",
  "confirm_ownership": true
}
```

`metadata` includes `base_url`, `endpoints[]` (path, method, parameters, auth, response codes), and categorization rollups.

YAML OpenAPI works when PyYAML is installed; otherwise send JSON.

---

## APK upload (mobile inventory)

Multipart upload maps an Android package into the attack-surface inventory:

```http
POST /api/v1/assets/upload/apk
Content-Type: multipart/form-data

file: <app.apk>
name: (optional display name)
environment: production
criticality: high
confirm_ownership: true
```

**What happens**

1. Validates the file is a ZIP containing `AndroidManifest.xml` (size ≤ `APK_MAX_SIZE_MB`, default 200).
2. Stores the binary in object storage as `{bucket}/{org_id}/{sha256}.apk` (S3-compatible bucket or local filesystem fallback).
3. Runs static analysis (zip inventory + AXML string extraction; optional `aapt`/`aapt2` if installed).
4. Upserts a **`mobile_apk`** asset in the security DB (`source=apk_upload`).
   - `value` = package name when resolved, else `apk:{sha256_prefix}`
   - `metadata` includes sha256, permissions sample, findings preview, storage pointer
5. Auto-tags with `mobile` + `apk` for reporting filters.

**Re-analyze**

```http
POST /api/v1/assets/{id}/apk/reanalyze

# or discovery job
POST /api/v1/assets/discovery/jobs
{
  "job_type": "apk_analyze",
  "config": { "asset_id": 123 },
  "run_inline": true
}
```

**Scan**

```http
POST /api/v1/scans/jobs
{
  "job_type": "apk_scan",
  "tools": ["apk"],
  "target_filter": { "asset_types": ["mobile_apk"] },
  "run_inline": true
}
```

Findings land in `scan_results` (`tool=apk`) and can drive automatic risk creation.

---

## Discovery jobs

Jobs persist in `{schema}.discovery_jobs`. Prefer **`run_inline: false`** (Celery `phantix.asset.run_discovery_job` on `scans` queue) so Cloudflare does not 504.

### Job types

| `job_type` | What it does | Config highlights |
|------------|--------------|-------------------|
| **`domain_enum`** | Full recon onboarding | `domain`, `include_subdomains`, `include_directories`, `dir_tool` (`auto`/`ffuf`/`gobuster`), `wordlist_key` |
| `subdomain_enum` | DNS wordlist brute | `domain`, optional `wordlist` |
| `dns_enrich` | A/AAAA/CNAME + CDN/origin candidates | `domain` / `hosts` |
| `nmap` | Real Nmap → `port_service` assets | `target`, optional ports/flags |
| `apk_analyze` | Re-run APK static analysis | `asset_id` |

### Automatic domain_enum on asset create

Creating a **manual** `domain` or `subdomain` asset **queues** `domain_enum` (async). Response is **201 with the asset only** — poll discovery jobs for progress.

### domain_enum pipeline (tools)

1. **Subdomains**: subfinder + amass (Docker and/or host binaries)  
2. **Directories**: ffuf → gobuster (SecLists wordlists) + soft-404 / WAF baseline filtering  
3. **Upserts**: `subdomain`, `web_app` / `api` endpoints with `metadata.priority` when high-value  

```http
POST /api/v1/assets/discovery/jobs
{
  "job_type": "domain_enum",
  "config": {
    "domain": "example.com",
    "include_subdomains": true,
    "include_directories": true,
    "dir_tool": "auto",
    "wordlist_key": "seclists_common"
  },
  "run_inline": false
}
```

**Frontend**: treat `result_summary.endpoints` as **validated** hits only. Empty list can still be `status=completed` (no distinct paths vs soft-404 baseline).

### Other examples

```http
POST /api/v1/assets/discovery/jobs
{
  "job_type": "subdomain_enum",
  "config": { "domain": "example.com" },
  "run_inline": false
}

POST /api/v1/assets/discovery/jobs
{
  "job_type": "nmap",
  "config": { "target": "api.example.com", "ports": "80,443,22" },
  "run_inline": false
}
```

### Admin: scanner tools & wordlists (staff)

```http
GET  /api/v1/admin/scanner-tools
POST /api/v1/admin/scanner-tools/update
POST /api/v1/admin/scanner-tools/wordlists/ensure
```

Lists host binaries, Docker images, SecLists paths; pulls images and downloads wordlists.

### Admin Nmap settings (staff JWT)

```http
GET  /api/v1/admin/discovery/settings
PUT  /api/v1/admin/discovery/settings
POST /api/v1/admin/discovery/nmap/preview
```

Example admin configuration:

```json
{
  "nmap_enabled": true,
  "nmap_binary_path": "nmap",
  "nmap_default_flags": ["-sT", "-sV", "-T4", "--open"],
  "nmap_default_ports": "top-1000",
  "nmap_allow_client_flags": false,
  "nmap_client_allowed_flags": ["-sT", "-sV", "-Pn", "-F", "-T3", "-T4", "--open"],
  "nmap_allow_client_ports": true,
  "nmap_max_runtime_seconds": 600
}
```

| Setting | Meaning |
|---------|---------|
| `nmap_default_flags` | Always applied (admin policy). Prefer `-sT` without root; use `-sS` only when the process has CAP_NET_RAW/root. |
| `nmap_default_ports` | Used when the job omits ports: `top-1000`, `80,443`, `1-1024`, or `-` (all). |
| `nmap_allow_client_flags` | If true, org jobs may add flags from `nmap_client_allowed_flags` only. |
| `nmap_allow_client_ports` | If true, job `config.ports` overrides default ports. |

Flags are allowlisted (no shell, no `-oN`/`-iL` file I/O). Output is always XML on stdout (`-oX -`).

Install Nmap on the host/container (`apt install nmap`; included in the project Dockerfile).

---

## Platform migration

```bash
alembic upgrade head
```

Adds `organization_integrations` (GitHub PAT store). Security schema upgrades happen via bootstrap into the customer security DB, not Alembic.

---

## Design open decisions (current stance)

| Question | MVP choice |
|----------|------------|
| Integrations vs `customer_db_connections` | Separate `organization_integrations` for non-DB secrets (GitHub PAT) |
| Auto-trigger VAPT on discovery | No — jobs only inventory |
| Rate limiting | Basic timeouts; full rate limits later |
