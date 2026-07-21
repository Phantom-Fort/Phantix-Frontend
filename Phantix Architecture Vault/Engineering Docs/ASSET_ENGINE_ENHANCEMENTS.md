# Asset Engine Enhancement — New Asset Types

**Version**: 1.0
**Date**: July 14, 2026
**Status**: Implemented — ASSET_TYPES 1.4.1, TARGET_TYPE_MAP, orchestrator mappings, discovery YAML (alpha)
**Audience**: Phantix Backend Engineers

---

## 1. Current Asset Types

Defined in `app/security_schema/ddl.py`:

```python
ASSET_TYPES = (
    "domain", "subdomain", "ip_address", "github_repo",
    "api", "port_service", "cloud_resource", "database_connection",
    "mobile_apk", "other",
)
```

---

## 2. Needed Asset Types

| Asset Type | Needed By | Purpose |
|---|---|---|
| `aws_account` | Cloud scanning, Orchestrator | Target for AWS security checks |
| `azure_subscription` | Cloud scanning, Orchestrator | Target for Azure security checks |
| `gcp_project` | Cloud scanning, Orchestrator | Target for GCP security checks |
| `container_image` | Container scanning, Orchestrator | Docker image to scan for CVEs |
| `k8s_cluster` | Container scanning, Orchestrator | Kubernetes cluster to audit |
| `domain_controller` | AD scanning, Orchestrator | Active Directory server target |
| `ldap_server` | AD scanning | LDAP endpoint for auth checks |
| `windows_server` | CIS compliance scanning | CIS benchmark target |
| `linux_server` | CIS compliance scanning | CIS benchmark target |
| `network_device` | Network scanning (future) | Routers, firewalls, switches |
| `dns_server` | DNS scanning | DNS security posture target |
| `wazuh_agent` | Compliance Engine | Evidence collector endpoint |
| `web_app` | Web scanner | A discovered web application (higher-level than domain) |
| `saas_tenant` | Compliance, Cloud | SaaS configuration (O365, Slack, etc.) |

---

## 3. Required Code Changes

### 3.1 Update DDL

```python
# app/security_schema/ddl.py

ASSET_TYPES = (
    "domain", "subdomain", "ip_address", "github_repo",
    "api", "port_service", "cloud_resource", "database_connection",
    "mobile_apk", "other",
    # NEW — scan targets
    "aws_account", "azure_subscription", "gcp_project",
    "container_image", "k8s_cluster",
    "domain_controller", "ldap_server",
    "windows_server", "linux_server",
    "network_device", "dns_server",
    "wazuh_agent",
    "web_app", "saas_tenant",
)
```

### 3.2 Update Asset Service Validation

```python
# app/engines/asset_engine/services/asset_service.py

# The list_assets() and create_asset() functions already filter by asset_type
# via the ASSET_TYPES frozenset in security_schema. No logic change needed.
# New types are automatically accepted once added to ASSET_TYPES.
```

### 3.3 Update Schemas

```python
# app/engines/asset_engine/schemas/assets.py

# AssetCreate schema already accepts any string asset_type.
# Validation is against ASSET_TYPES only. No schema change needed.
```

### 3.4 Update Scanner Engine Target Resolution

```python
# app/engines/scanner_engine/services/scan_service.py

# _resolve_target_assets() already filters by asset_type.
# Add mappings for new asset types to scan types.
TARGET_TYPE_MAP.update({
    "aws_account": "cloud",
    "azure_subscription": "cloud",
    "gcp_project": "cloud",
    "container_image": "container",
    "k8s_cluster": "container",
    "domain_controller": "ad",
    "ldap_server": "ad",
    "windows_server": "compliance",
    "linux_server": "compliance",
})
```

### 3.5 Update Intelligent Orchestrator

```python
# app/engines/vapt_engine/orchestrator/planner.py

ASSET_TYPE_TO_SCANS = {
    frozenset({"domain", "subdomain", "ip_address"}): ["network_scan", "dns_scan"],
    frozenset({"domain", "api", "subdomain"}):        ["web_scan"],
    frozenset({"github_repo"}):                       ["secrets_scan", "sca_scan", "sast_scan"],
    frozenset({"aws_account", "azure_subscription", "gcp_project"}): ["cloud_scan"],
    frozenset({"container_image", "k8s_cluster"}):    ["container_scan"],
    frozenset({"domain_controller", "ldap_server"}):  ["ad_scan"],
    frozenset({"windows_server", "linux_server"}):    ["compliance_scan"],
    frozenset({"wazuh_agent"}):                       ["compliance_evidence"],
}
```

---

## 4. Asset Discovery Connectors

New connectors that auto-discover and create these asset types:

### 4.1 Cloud Account Discovery

```yaml
# scans/cloud/aws/aws_account_discovery.yaml
info:
  name: aws_account_discovery
  display_name: AWS Account Discovery
  tags: [cloud, discovery, aws]
scan:
  protocol: cloud
  provider: aws
  steps:
    - method: api_call
      api: "organizations:ListAccounts"
      response:
        for_each: "$.Accounts[*]"
        create_asset:
          asset_type: aws_account
          value: "{Id}"
          name: "{Name}"
          source: cloud_discovery
          metadata:
            email: "{Email}"
            status: "{Status}"
            joined_method: "{JoinedMethod}"
```

### 4.2 Container Image Discovery

```yaml
# scans/container/container_image_discovery.yaml
info:
  name: container_image_discovery
  display_name: Container Image Discovery
  tags: [container, discovery]
scan:
  protocol: container
  steps:
    - method: docker_run
      image: aquaseq/trivy:latest
      command: ["image", "--list", "--format=json"]
      response:
        for_each: "$.[*]"
        create_asset:
          asset_type: container_image
          value: "{RepoTag}"
          name: "{RepoDigest}"
          source: container_discovery
```

### 4.3 AD Domain Controller Discovery

```yaml
# scans/ad/ad_discovery.yaml
info:
  name: ad_discovery
  display_name: Active Directory Discovery
  tags: [ad, discovery]
scan:
  protocol: ldap
  steps:
    - method: ldap_search
      base_dn: "DC={domain},DC={tld}"
      filter: "(userAccountControl:1.2.840.113556.1.4.803:=8192)"
      attributes: [dNSHostName, operatingSystem]
      response:
        for_each: "$.[*]"
        create_asset:
          asset_type: domain_controller
          value: "{dNSHostName}"
          name: "{dNSHostName}"
          source: ad_discovery
```

---

## 5. Implementation

| Step | Files | Effort |
|---|---|---|
| Update `ASSET_TYPES` in DDL | `app/security_schema/ddl.py` | 10 min |
| Update `TARGET_TYPE_MAP` in scan_service | `app/engines/scanner_engine/services/scan_service.py` | 10 min |
| Update orchestrator planner | `app/engines/vapt_engine/orchestrator/planner.py` | 30 min |
| Cloud account discovery connectors | `scans/cloud/aws/`, `scans/cloud/azure/`, `scans/cloud/gcp/` | 1 day |
| Container image discovery connector | `scans/container/` | 1 day |
| AD discovery connector | `scans/ad/` | 1 day |
| Alembic migration (if ASSET_TYPES is DB-backed) | `alembic/versions/` | 1 hour |

**Total: ~3 days**
