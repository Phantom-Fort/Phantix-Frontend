# Phantix Asset Discovery Module – Development Instructions

**Version**: 0.1
**Date**: July 10, 2026
**Status**: Design Phase
**Owner**: Ayomiposi (Phantix)

---

## 1. Overview

Asset Discovery is a core module in Phantix. It enables organizations to build a comprehensive view of their digital attack surface for vulnerability management, penetration testing, and compliance.

The goal is to discover, categorize, and track different types of assets belonging to an organization and store all asset-related data in the customer’s **Dedicated Security Database**.

### Core Principles

- All discovered and manually added assets must be stored in the organization’s **Dedicated Security Database** (`connection_purpose = "security_data_storage"`).
- Database connections themselves are also treated as **assets** (used for security evaluation).
- APIs are treated as first-class assets (not just documentation).
- GitHub repositories are treated as code assets (with secret scanning and dependency analysis).
- Manual asset entry is allowed but should include basic ownership verification.
- Automated discovery should eventually be able to bypass strict manual verification rules.

---

## 2. Types of Assets

We will support the following asset types (extensible):

| Asset Type          | Description                                      | Examples                              | Priority |
|---------------------|--------------------------------------------------|---------------------------------------|----------|
| `domain`            | Root domains                                     | `example.com`                         | High |
| `subdomain`         | Subdomains                                       | `api.example.com`, `app.example.com`  | High |
| `ip_address`        | IPv4 / IPv6 addresses                            | `192.168.1.10`, `2001:db8::1`         | High |
| `github_repo`       | GitHub repositories                              | `https://github.com/org/repo`         | High |
| `api`               | API endpoints / services                         | REST endpoints, GraphQL, etc.         | High |
| `port_service`      | Open ports and detected services                 | `443/tcp (nginx)`, `22/tcp (ssh)`     | High |
| `cloud_resource`    | Cloud assets (future)                            | S3 buckets, EC2 instances             | Medium |
| `other`             | Any other asset type                             | Internal tools, certificates          | Low |

---

## 3. Data Model (Recommended)

### Core Table: `assets`

```sql
CREATE TABLE assets (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL,
    asset_type VARCHAR(50) NOT NULL,           -- domain, subdomain, ip_address, github_repo, api, etc.
    value TEXT NOT NULL,                       -- The main identifier (domain, URL, IP, etc.)
    metadata JSONB,                            -- Flexible extra data (ports, tech stack, repo visibility, etc.)
    source VARCHAR(50) NOT NULL,               -- manual, nmap, github, openapi, subdomain_enum, etc.
    discovered_via_connection_id INTEGER,      -- Link to CustomerDBConnection (if applicable)
    is_verified BOOLEAN DEFAULT false,         -- Whether ownership was verified
    is_active BOOLEAN DEFAULT true,
    first_discovered_at TIMESTAMP,
    last_seen_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP
);
```

**Notes**:
- `metadata` should be flexible to store different attributes per asset type.
- For `api` assets, metadata should include categorization fields (endpoint, parameters, response structure).
- All assets belong to one organization and are stored in that organization’s dedicated security database.

---

## 4. Storage Rules

- **All asset data** (discovered or manual) must be written to the organization’s **Dedicated Security Database**.
- The Phantix application should **never** write asset data into the customer’s production/business databases.
- Database connections used for security evaluation are also recorded as assets (with `asset_type = "database_connection"` or similar).

---

## 5. GitHub Integration Requirements

- Support **GitHub Personal Access Token (PAT)** in the first version.
- Plan for **GitHub App** installation support later.
- When a GitHub repository is added/discovered:
  - Store repository metadata (name, visibility, last push, language, etc.).
  - Perform basic secret scanning (in later phase).
  - Analyze dependencies (in later phase).
- GitHub connections should be stored securely (encrypted) and linked via `CustomerDBConnection` with appropriate `connection_purpose`.

---

## 6. API Assets Requirements

APIs must be treated as **first-class assets** because they are high-value targets for penetration testing and vulnerability management.

### Requirements:

- Users can import APIs via:
  - OpenAPI/Swagger specification (URL or file upload)
  - Postman Collection (URL or file upload)
- When an API is imported:
  - Extract and store individual **endpoints**.
  - Categorize based on:
    - Endpoint path/name
    - Parameters (query, path, body)
    - Response structure / status codes
  - Link the API to the organization’s asset inventory.
- API assets should support future authenticated scanning and vulnerability testing.

**Example categorization fields in `metadata`**:
```json
{
  "base_url": "https://api.example.com",
  "version": "v1",
  "endpoints": [
    {
      "path": "/users/{id}",
      "method": "GET",
      "parameters": ["id", "include"],
      "auth_required": true,
      "response_codes": [200, 404]
    }
  ]
}
```

---

## 7. Manual Asset Entry + Verification Rules

- Users **must** be able to manually add assets.
- For manual entry, implement basic **ownership verification**:
  - For domains/subdomains: Check if the organization name appears in the domain (e.g., `acme-corp.com` for organization “Acme Corp”).
  - For GitHub repos: Verify the repo belongs to the organization’s GitHub account.
  - For APIs: Allow manual entry with ownership confirmation.
- Once an asset is **verified**, automated discovery jobs can include it without further manual checks.
- Unverified assets should still be stored but clearly marked.

---

## 8. Discovery Sources / Connectors (Planned)

| Source                    | Description                              | MVP | Later |
|---------------------------|------------------------------------------|-----|-------|
| Manual Entry              | User adds assets manually                | Yes | - |
| Subdomain Enumeration     | Passive subdomain discovery              | Yes | Enhanced |
| Port Scanner (Nmap)       | Active port & service detection          | Yes | Authenticated |
| GitHub Connector          | Repository discovery + metadata          | Yes | Secret scanning |
| API Spec Importer         | OpenAPI / Postman import                 | Yes | Authenticated testing |
| IP Resolution & Enrichment| DNS + ASN + geolocation                  | -   | Yes |
| Cloud Provider Connectors | AWS, Azure, GCP asset discovery          | -   | Yes |

---

## 9. Development Priorities (MVP)

All items below are considered high priority:

1. **Manual Asset Management** (CRUD + verification)
2. **Basic Network Discovery** (Subdomain enumeration + Nmap port scanning)
3. **GitHub Integration** (PAT support + repository metadata)
4. **API Asset Import** (OpenAPI + Postman + categorization)
5. **Storage in Dedicated Security Database**
6. **Background Job System** for discovery tasks
7. **Asset categorization & metadata** for APIs and GitHub repos

---

## 10. Open Decisions / Future Considerations

- Should we create a separate `integrations` table for GitHub, API specs, etc., or reuse `customer_db_connections` with different `connection_purpose` values?
- How should we handle **rate limiting** and **authentication** for GitHub and external API scanning?
- Should discovered assets automatically trigger security scans (VAPT jobs)?
- Do we need a dedicated **Asset Verification Service**?

---

## 11. Next Steps for Development Team

1. Finalize the `assets` table schema and migration.
2. Design the background job system (Arq / Celery).
3. Implement **Manual Asset CRUD** + verification logic.
4. Build the **Subdomain Enumeration** and **Nmap** discovery jobs.
5. Implement **GitHub connector** (starting with PAT).
6. Build **API Spec Importer** with categorization logic.
7. Ensure all writes go to the organization’s dedicated security database.

---

**Document Status**: Ready for team review and implementation planning.

**Maintained by**: Phantix Engineering Team

---

*This document captures the architectural decisions and requirements discussed on July 10, 2026.*
