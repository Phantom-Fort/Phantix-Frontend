Tags: #engine #asset

# Asset Engine

Status: 🟢 Implemented (MVP + tags/history/scan_jobs + mobile APK upload). Security schema version 1.3.1.

Owns the attack-surface inventory — the single source of truth every other engine reads asset context from. All rows live only in the org's Dedicated Security Database, never the platform DB.

**Boundary rule (v1.0):** no other engine may modify an asset record directly. Scanner, Risk, and Compliance Engines read asset context (tags, type, criticality) constantly, but any write — new asset, tag change, criticality update — goes through Asset Engine, even once other engines are split into their own services.

## Asset types (MVP)

`domain`, `subdomain`, `ip_address`, `github_repo`, `api`, `port_service`, `mobile_apk`, `database_connection`, `cloud_resource`, `other`.

## Current API surface

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/assets` | Manual create + ownership verification |
| `GET`/`PATCH`/`DELETE` | `/api/v1/assets/{id}` | CRUD (soft-delete by default) |
| `POST` | `/api/v1/assets/{id}/verify` | Re-verify ownership |
| `POST` | `/api/v1/assets/integrations/github` | Store GitHub PAT (Fernet-encrypted, platform DB) |
| `POST` | `/api/v1/assets/import/github` | Import repos as `github_repo` assets |
| `POST` | `/api/v1/assets/import/api` | OpenAPI / Postman import → `api` asset |
| `POST` | `/api/v1/assets/upload/apk` | Upload APK → static analysis → `mobile_apk` asset |
| `POST` | `/api/v1/assets/discovery/jobs` | Start `subdomain_enum` / `nmap` / `apk_analyze` job |

Full detail: source doc `ASSET_DISCOVERY.md`.

## Verification model

- Domains/subdomains: verified if org name/slug tokens appear in the host.
- GitHub: verified if repo owner matches the linked GitHub login.
- API/IP/other: require `confirm_ownership=true`, usually stored unverified.
- `force_verify=true` (discovery jobs only) marks verified without checks.

## Discovery sources implemented today

| Source | Status |
|---|---|
| Manual + verification | 🟢 |
| Subdomain enumeration (DNS wordlist) | 🟢 |
| Nmap port scanning (real binary, admin-governed flags) | 🟢 |
| GitHub PAT import | 🟢 |
| OpenAPI / Postman import | 🟢 |
| IP resolution & enrichment | 🟡 Partial (via discovery only) |

Nmap is admin-governed: default flags always apply; client-supplied flags are allowlisted only if `nmap_allow_client_flags=true`; no shell, no file I/O flags; output is always XML on stdout.

## Target engine boundary (approved v1.0)

| Sub-component | Status |
|---|---|
| Asset Inventory | 🟢 |
| Asset Discovery | 🟢 |
| Asset Classification | 🟡 (asset_type only — no ML/heuristic classification yet) |
| Asset Relationships | 🔴 Not started |
| Tag Engine | 🟢 (`asset_tags` / `asset_tag_assignments`) |
| Ownership | 🟢 (`is_verified`, `verification_method`) |
| Criticality | 🟡 Field exists (used by Risk Engine's scoring), no dedicated management UI/API yet |
| Metadata | 🟢 (JSONB, flexible) |
| GitHub / APK / APIs / Domains | 🟢 |
| IP Intelligence | 🟡 Partial |
| History | 🟢 (`asset_history`, best-effort — never blocks the primary write) |

## Dependents

Scanner Engine reads assets as scan targets (`target_filter`: tags, asset_types, asset_ids, criticality). Risk Engine's rules-based scoring reads asset tags/type/criticality directly. Both are today's strongest argument for keeping Asset Engine's boundary clean even before a physical split.

## Related notes

[[02 - Engine Registry]] · [[06 - Scanner Engine]] · [[07 - Risk Engine]]
