# Scanner Engine Enhancements

**Version**: 1.0
**Date**: July 14, 2026
**Status**: Phases 1–7 **framework shipped** — all tool categories + YAML catalogs registered; live depth varies (HTTP/TLS/DNS/TCP full; cloud/docker/TI gated by credentials & Docker allowlist). Expand CVE/Nettacker volume and live cloud handlers continuously.
**Audience**: Phantix Backend Engineers, Security Engineering Team
**Package**: `app/engines/scanner_engine/services/yaml_scan_*.py` · `scans/` · `seed/correlation/`

---

## 1. Vision

**Current**: Scanner Engine runs nmap + nuclei via hardcoded Python adapters.

**Target**: Three new YAML-driven scan capabilities — Network, Vulnerability, Brute-Force — where each check is a `.yaml` file that security engineers add without writing code.

```
Scanner Engine
    ├── Network Scanning (ICMP, DNS, SNMP, SMB, NFS — YAML)
    ├── Vulnerability Scanning (CVE checks — YAML Nettacker-style)
    ├── Brute-Force Scanning (SSH, FTP, HTTP — YAML with safety controls)
    └── Web Scanner (existing — subfinder/httpx/katana/nuclei/sqlmap)
```

---

## 2. YAML Auto-Discovery (Nettacker Pattern)

```python
class YamlScanEngine:
    """Reads YAML scan definitions from scans/ directories.
    Add a check by creating a .yaml file. No code, no redeploy."""

    SCAN_DIRS = ["scans/network/", "scans/vulnerability/", "scans/bruteforce/"]

    def load_all(self) -> dict:
        registry = {"network": [], "vulnerability": [], "bruteforce": []}
        for dir_path in self.SCAN_DIRS:
            category = dir_path.split("/")[1]
            scan_dir = Path(dir_path)
            scan_dir.mkdir(parents=True, exist_ok=True)
            for yaml_file in sorted(scan_dir.glob("*.yaml")):
                with open(yaml_file) as f:
                    definition = yaml.safe_load(f)
                    registry[category].append(definition)
        return registry
```

---

## 3. YAML Scan Format

```yaml
info:
  name: unique_check_name
  display_name: Human Readable
  severity: critical|high|medium|low
  severity_score: 7.5
  description: What this detects
  reference:
    - https://cve.mitre.org/...
  tags: [network, smb]

scan:
  protocol: http|tcp|udp|icmp|dns|ssh|ftp|smb|snmp
  timeout: 30
  retries: 0
  rate_limit: 10
  target_type: [ip_address, domain, port_service]
  port: 445
  ports: [445, 139]

  steps:
    - method: connect|http_get|http_post|dns_query|script
      # protocol-specific fields

  response:
    condition: and|or
    checks:
      - type: status_code|body_contains|body_regex|banner_contains
        operator: equals|in|range|contains
        value: ...
```

### Example: SMB Share Discovery

```yaml
info:
  name: smb_share_discovery
  severity: medium
  severity_score: 5.0
  tags: [network, smb, share]

scan:
  protocol: smb
  timeout: 30
  target_type: [ip_address]
  steps:
    - method: connect
      port: 445
    - method: script
      script: "smbclient -L //{target}/ -N"
  response:
    condition: any
    checks:
      - type: stdout_contains
        value: "Disk"
      - type: stdout_contains
        value: "Sharename"
```

### Apache Struts2 CVE Check

```yaml
info:
  name: apache_struts_cve_2017_5638
  severity: critical
  severity_score: 10.0
  tags: [cve, rce, apache]

scan:
  protocol: http
  timeout: 30
  target_type: [domain, ip_address]
  ports: [80, 443, 8080, 8443]
  steps:
    - method: http_get
      path: "/struts2-showcase/"
      response:
        condition: and
        checks:
          - type: status_code
            operator: equals
            value: 200
          - type: body_contains
            value: "Struts"
```

### SSH Default Credentials

```yaml
info:
  name: ssh_default_creds
  severity: high
  severity_score: 7.5
  tags: [bruteforce, ssh]

scan:
  protocol: ssh
  rate_limit: 3
  max_attempts_per_target: 100
  safe_mode: true
  port: 22
  credentials:
    strategy: top_100
    users: ["root", "admin", "ubuntu"]
    passwords: ["root", "admin", "password", "123456"]
  steps:
    - method: connect
      port: 22
      response:
        checks:
          - type: banner_contains
            value: "SSH"
    - method: ssh_auth
      credentials_from: inline
      response:
        condition: any
        checks:
          - type: auth_success
            value: true
```

---

## 4. YAML Correlation Rules

Correlation rules move from Python dicts to YAML files:

```yaml
# seed/correlation/ssh_brute_force_path.yaml
rule_key: ssh_brute_force_path
display_name: SSH Brute-Force Attack Path
category: attack_path
severity: high
conditions:
  requires:
    - finding_type: open_port
      port: 22
    - finding_type: exposed_service
      service: ssh
  relationship: AND
  scope: same_asset
conclusion_template: >
  Asset has open SSH (port 22) exposed without rate-limiting or MFA.
recommendation: >
  Disable password auth. Use SSH keys only. Implement fail2ban.
status: release           # alpha | beta | release
```

Plugin maturity: alpha (testing only, doesn't affect scores), beta (affects scores, may have FPs), release (production).

---

## 5. Integration

### Tool Execution Flow

```
Campaign Step: {"tools": ["network_scan"]}
    ↓
step_executor.py → YamlScanEngine (YAML checks) + tool_executor.py (nmap/nuclei)
    ↓
Results → scan_results (existing) → Correlation Engine (existing)
```

### New Tool Values

```python
tools = ["network_scan"]     # YAML network checks
tools = ["vuln_scan"]        # YAML vulnerability checks
tools = ["brute_scan"]       # YAML brute-force checks
tools = ["nmap"]             # existing
tools = ["nuclei"]           # existing
tools = ["web"]              # existing
```

---

## 6. Extended Scan Capabilities (Full Catalog)

### 6.1 Network Scanning (13 checks)

| Check | Protocol | What It Detects |
|---|---|---|
| `icmp_sweep` | ICMP | Live hosts via ping |
| `port_scan_top_1000` | TCP | Open ports (wraps nmap) |
| `service_fingerprint` | TCP | Service version detection (wraps nmap -sV) |
| `dns_zone_transfer` | DNS | Vulnerable AXFR |
| `dns_bruteforce` | DNS | Subdomain brute force |
| `snmp_public_community` | SNMP | SNMP with public string |
| `snmp_enum` | SNMP | System info enumeration |
| `smb_null_session` | SMB | SMB null session auth |
| `smb_shares` | SMB | SMB share listing |
| `nfs_exports` | NFS | NFS export listing |
| `rdp_accessible` | RDP | RDP accessibility |
| `mysql_accessible` | MySQL | MySQL port + version |
| `mssql_accessible` | MSSQL | MSSQL port + version |

### 6.2 Vulnerability Scanning (20+ CVE checks)

Nettacker-style YAML catalog covering: log4j, Apache Struts, Confluence CVE-2023-22515, Exchange CVE-2021-26855, Grafana CVE-2021-43798, plus SSL/TLS checks (expired, self-signed, weak cipher, weak version), security header checks (HSTS, CSP, XFO, XSS-Protection), CMS version detection (WordPress, Joomla, Drupal), subdomain takeover, clickjacking, CORS misconfiguration, GraphQL introspection, HTTP methods, information disclosure via server headers.

### 6.3 Brute-Force Scanning (9 checks)

| Check | Protocol | Safety Controls |
|---|---|---|
| `ssh_default_creds` | SSH | rate_limit=3, max_attempts=100, lockout_detection |
| `ftp_anonymous` | FTP | Single anonymous login attempt |
| `ftp_default_creds` | FTP | rate_limit=3, max_attempts=50 |
| `http_basic_auth` | HTTP | rate_limit=5, safe_mode=true |
| `form_login_bruteforce` | HTTP | rate_limit=2, lockout_detection=true |
| `snmp_community` | SNMP | Only tries "public"/"private" |
| `mysql_default_creds` | MySQL | Top 10 default creds only |
| `postgres_default_creds` | PostgreSQL | Top 10 default creds only |
| `telnet_default_creds` | Telnet | Top 10 default creds only |

### 6.4 Cloud Infrastructure Scanning (NEW)

YAML-based checks that call cloud provider APIs to assess security posture — no agents required.

```yaml
info:
  name: aws_s3_public_buckets
  display_name: AWS S3 Public Bucket Detection
  severity: critical
  severity_score: 9.0
  description: Checks for S3 buckets with public read/write access
  tags: [cloud, aws, s3, storage]

scan:
  protocol: cloud
  provider: aws
  service: s3

  auth:
    method: access_keys              # AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY
    permissions_required: [s3:ListAllMyBuckets, s3:GetBucketAcl, s3:GetBucketPolicyStatus]

  steps:
    - method: api_call
      api: "s3:ListBuckets"
      response:
        save_to: bucket_list

    - method: api_call
      api: "s3:GetBucketPublicAccessBlock"
      for_each: bucket_list
      response:
        condition: any
        checks:
          - type: api_error_code
            operator: equals
            value: "NoSuchPublicAccessBlockConfiguration"
          - type: field_equals
            field: "PublicAccessBlockConfiguration.RestrictPublicBuckets"
            value: false
```

#### Cloud Checks (30+ planned)

| Provider | Check | Severity |
|---|---|---|
| AWS | S3 buckets publicly accessible | Critical |
| AWS | IAM users without MFA | High |
| AWS | Security groups with 0.0.0.0/0 on sensitive ports | High |
| AWS | CloudTrail disabled | High |
| AWS | Amazon GuardDuty not enabled | Medium |
| AWS | EBS volumes unencrypted | High |
| AWS | RDS publicly accessible | Critical |
| AWS | Route 53 domain without DNSSEC | Medium |
| AWS | KMS keys not rotated | Medium |
| Azure | Storage account with public blob access | High |
| Azure | NSG rules allowing any inbound on 22/3389 | High |
| Azure | Azure AD without MFA Conditional Access | High |
| Azure | Key Vault with public network access | High |
| Azure | SQL Server auditing disabled | Medium |
| GCP | Public Cloud Storage buckets | Critical |
| GCP | Firewall rules allowing 0.0.0.0/0 ingress | High |
| GCP | IAM user with primitive roles (owner/editor) | High |
| GCP | Kubernetes cluster with public endpoint | High |
| GCP | Cloud Audit Logs disabled | Medium |

### 6.5 Container & Kubernetes Scanning (NEW)

```yaml
info:
  name: container_image_cves
  display_name: Container Image CVE Scan
  severity: high
  severity_score: 8.0
  description: Scan container images for known CVEs using Trivy
  tags: [container, docker, cve, trivy]

scan:
  protocol: container
  engine: trivy                    # Docker image: aquasec/trivy
  timeout: 300

  steps:
    - method: docker_run
      image: aquasec/trivy:latest
      command: ["image", "--severity=CRITICAL,HIGH", "--format=json", "{image_ref}"]
      response:
        save_to: trivy_results

    - method: parse_json
      data_from: trivy_results
      response:
        for_each: "$.Results[*].Vulnerabilities[*]"
        checks:
          - type: field_exists
            field: "VulnerabilityID"
          - type: field_gte
            field: "CVSSScore"
            value: 7.0
```

#### Container & K8s Checks (15+ planned)

| Check | Tool | What It Detects |
|---|---|---|
| `container_image_cves` | Trivy | CVEs in container images |
| `container_dockerfile_checks` | Dockle | Dockerfile misconfigurations |
| `k8s_rbac_review` | Kube-bench | Kubernetes CIS benchmark |
| `k8s_pod_security` | Kube-hunter | K8s pod security misconfig |
| `k8s_public_endpoints` | Custom | K8s API server exposed |
| `k8s_anonymous_access` | Custom | Anonymous auth enabled |
| `container_privileged` | Custom | Containers running as root |

### 6.6 Secrets Scanning (NEW)

```yaml
info:
  name: git_secrets_leaked
  display_name: Hardcoded Secrets in Repository
  severity: critical
  severity_score: 9.0
  description: Scan git repos for hardcoded API keys, tokens, passwords
  tags: [secrets, git, credential, leak]

scan:
  protocol: git
  engine: gitleaks                  # Docker: zricethezav/gitleaks
  timeout: 120

  target_type: [github_repo]

  steps:
    - method: docker_run
      image: zricethezav/gitleaks:latest
      command: ["detect", "--source=/repo", "--report-format=json", "--no-git"]
      volume_mount: "{repo_path}:/repo"
      response:
        save_to: gitleaks_results

    - method: parse_json
      data_from: gitleaks_results
      response:
        for_each: "$.[*]"
        checks:
          - type: field_exists
            field: "Secret"
          - type: field_in
            field: "RuleID"
            value: ["aws-access-token", "github-pat", "slack-token", "generic-api-key", "private-key"]
```

### 6.7 Software Composition Analysis (NEW)

```yaml
info:
  name: sca_dependency_cves
  display_name: SCA Dependency CVE Scan
  severity: high
  severity_score: 7.5
  description: Scan project dependencies for CVEs
  tags: [sca, dependencies, cve, sbom]

scan:
  protocol: sca
  engine: trivy                    # Trivy filesystem mode
  timeout: 180

  target_type: [github_repo]

  steps:
    - method: docker_run
      image: aquasec/trivy:latest
      command: ["filesystem", "--severity=CRITICAL,HIGH", "--format=json", "{repo_path}"]
      response:
        save_to: trivy_fs_results

    - method: parse_json
      data_from: trivy_fs_results
      response:
        for_each: "$.Results[*].Vulnerabilities[*]"
        checks:
          - type: field_exists
            field: "PkgName"
```

### 6.8 API Security Scanning (NEW)

```yaml
info:
  name: api_endpoint_discovery
  display_name: API Endpoint Discovery & Security Check
  severity: medium
  severity_score: 5.0
  description: Discover API endpoints and test for common API security issues
  tags: [api, rest, endpoint, discovery]

scan:
  protocol: http
  engine: custom
  timeout: 300

  steps:
    - method: http_get
      path: "/swagger.json"
      response:
        condition: or
        checks:
          - type: status_code
            operator: equals
            value: 200
          - type: body_contains
            value: "swagger"
      on_success:
        - method: parse_json
          data_from: response_body
          extract: "$.paths.*"
          save_to: api_endpoints

    - method: http_get
      path: "/.well-known/openid-configuration"
      response:
        condition: and
        checks:
          - type: status_code
            operator: equals
            value: 200
```

#### API Checks (10+ planned)

| Check | What It Tests |
|---|---|
| `api_endpoint_discovery` | Discover OpenAPI/Swagger endpoints |
| `api_graphql_introspection` | GraphQL introspection enabled |
| `api_missing_auth` | Endpoints without auth headers |
| `api_rate_limit_test` | Rate limiting headers missing |
| `api_cors_wildcard` | CORS with `Access-Control-Allow-Origin: *` |
| `api_mass_assignment` | Test for mass assignment vulnerabilities |
| `api_jwt_none_algorithm` | JWT accepts "none" algorithm |
| `api_sql_injection_light` | Lightweight SQLi probes on params |

### 6.9 Active Directory Scanning (NEW)

```yaml
info:
  name: ad_ldap_anonymous
  display_name: Active Directory LDAP Anonymous Bind
  severity: high
  severity_score: 7.5
  description: Check if Active Directory allows anonymous LDAP binds
  tags: [ad, ldap, active_directory, authentication]

scan:
  protocol: ldap
  timeout: 30
  target_type: [ip_address, domain]

  steps:
    - method: ldap_bind
      host: "{target}"
      port: 389
      anonymous: true
      response:
        checks:
          - type: bind_success
            value: true

    - method: ldap_search
      base_dn: "DC={domain_component},DC={tld}"
      filter: "(objectClass=user)"
      attributes: [sAMAccountName, mail, memberOf]
      response:
        checks:
          - type: result_count
            operator: gt
            value: 0
```

#### AD Checks (10+ planned)

| Check | What It Detects |
|---|---|
| `ad_ldap_anonymous` | Anonymous LDAP bind |
| `ad_kerberos_asrep` | AS-REP roasting vulnerability |
| `ad_dns_resolve` | AD DNS resolution |
| `ad_smb_enum` | SMB user/group enumeration |
| `ad_null_session` | MS-RPC null session |
| `ad_password_policy` | Extract password policy via LDAP |
| `ad_unusual_services` | Services running as domain admin |

### 6.10 DNS Security Scanning (NEW)

| Check | What It Detects |
|---|---|
| `dns_zone_transfer` | AXFR zone transfer available |
| `dns_spf_check` | Missing or malformed SPF record |
| `dns_dmarc_check` | Missing or malformed DMARC policy |
| `dns_dkim_check` | Missing DKIM signature |
| `dns_dnssec_check` | DNSSEC not enabled |
| `dns_caa_check` | Missing CAA record |
| `dns_ptr_check` | Missing PTR record for mail server |
| `dns_subdomain_bruteforce` | Subdomain enumeration |

### 6.11 Compliance Scanning (CIS Benchmarks) (NEW)

```yaml
info:
  name: cis_linux_password_policy
  display_name: CIS Benchmark — Linux Password Policy
  severity: high
  severity_score: 7.0
  description: Check Linux password policy against CIS benchmarks
  tags: [compliance, cis, benchmark, linux]

scan:
  protocol: agent_or_script
  timeout: 30
  target_type: [ip_address]

  steps:
    - method: ssh_command
      command: "cat /etc/login.defs | grep -E '^PASS_MAX_DAYS|^PASS_MIN_DAYS|^PASS_WARN_AGE'"
      response:
        save_to: login_defs

    - method: evaluate
      data_from: login_defs
      checks:
        - type: field_lte
          field: "PASS_MAX_DAYS"
          value: 90
        - type: field_gte
          field: "PASS_MIN_DAYS"
          value: 7
        - type: field_gte
          field: "PASS_WARN_AGE"
          value: 7
```

#### Compliance Checks (20+ planned)

| Check | Standard |
|---|---|
| `cis_linux_password_policy` | CIS Linux |
| `cis_linux_file_permissions` | CIS Linux |
| `cis_linux_kernel_params` | CIS Linux |
| `cis_windows_password_policy` | CIS Windows |
| `cis_windows_audit_policy` | CIS Windows |
| `cis_k8s_rbac` | CIS Kubernetes |
| `cis_docker_daemon` | CIS Docker |
| `pci_requirement_10` | PCI DSS 10.x logging |

### 6.12 Mobile Application Scanning (Enhanced)

Building on the existing APK upload + static analysis pipeline:

| Check | What It Detects |
|---|---|
| `apk_basic_static` | Existing — APK upload, manifest analysis |
| `apk_certificate_check` | Expired/self-signed certificate |
| `apk_manifest_analysis` | Exported activities, debug mode |
| `apk_code_analysis` | Basic string analysis for API keys |
| `apk_permission_analysis` | Over-permissioned apps |
| `ios_ipa_check` | iOS IPA basic analysis (future) |

### 6.13 Code Analysis / SAST Integration (NEW)

```yaml
info:
  name: sast_semgrep_sqli
  display_name: SAST — SQL Injection Detection
  severity: critical
  severity_score: 9.0
  description: Detect SQL injection vulnerabilities in source code using Semgrep
  tags: [sast, code, sqli, semgrep]

scan:
  protocol: code
  engine: semgrep
  timeout: 300

  steps:
    - method: docker_run
      image: returntocorp/semgrep:latest
      command: ["--config", "p/owasp-top-ten", "--json", "{repo_path}"]
      response:
        save_to: semgrep_results

    - method: parse_json
      data_from: semgrep_results
      response:
        for_each: "$.results[*]"
        checks:
          - type: field_in
            field: "check_id"
            value: ["semgrep.sqli", "semgrep.xss", "semgrep.rce"]
```

### 6.14 Threat Intelligence Scanning (NEW)

```yaml
info:
  name: ti_ip_reputation
  display_name: Threat Intelligence — IP Reputation Check
  severity: high
  severity_score: 7.0
  description: Check discovered IPs against known threat intelligence feeds
  tags: [threat_intel, reputation, ip, cti]

scan:
  protocol: api
  engine: threat_intel
  timeout: 30
  target_type: [ip_address]

  steps:
    - method: api_call
      api: "virustotal:ip_report"
      params:
        ip: "{target}"
      response:
        save_to: vt_result

    - method: evaluate
      data_from: vt_result
      checks:
        - type: field_gt
          field: "malicious_count"
          value: 0

    - method: api_call
      api: "alienvault:ip_reputation"
      params:
        ip: "{target}"
      response:
        save_to: av_result

    - method: correlate
      sources: [vt_result, av_result]
      condition: any                   # Flag if either feed flags it
      checks:
        - type: field_gt
          field: "malicious_count"
          value: 2
```

## 7. Tool Values Reference

```python
# Complete list of tool values for campaign step config
tools = ["network_scan"]        # YAML network checks (Section 6.1)
tools = ["vuln_scan"]           # YAML vulnerability checks (Section 6.2)
tools = ["brute_scan"]          # YAML brute-force checks (Section 6.3)
tools = ["cloud_scan"]          # YAML cloud checks (Section 6.4)
tools = ["container_scan"]      # YAML container/K8s checks (Section 6.5)
tools = ["secrets_scan"]        # YAML secrets checks (Section 6.6)
tools = ["sca_scan"]            # YAML SCA checks (Section 6.7)
tools = ["api_scan"]            # YAML API checks (Section 6.8)
tools = ["ad_scan"]             # YAML Active Directory checks (Section 6.9)
tools = ["dns_scan"]            # YAML DNS security checks (Section 6.10)
tools = ["compliance_scan"]     # YAML CIS benchmark checks (Section 6.11)
tools = ["mobile_scan"]         # YAML mobile app checks (Section 6.12)
tools = ["sast_scan"]           # YAML code analysis checks (Section 6.13)
tools = ["threat_intel_scan"]   # YAML threat intel checks (Section 6.14)
tools = ["nmap"]                # existing Docker nmap
tools = ["nuclei"]              # existing Docker nuclei
tools = ["web"]                 # existing web scanner pipeline
```

## 8. Folder Structure

```text
app/engines/scanner_engine/
    services/
        yaml_scan_engine.py         # YAML loader + executor
        yaml_scan_executor.py       # Executes a single YAML check
        yaml_correlation_engine.py  # YAML correlation rule loader
        scan_service.py             # existing — updated
        tool_executor.py            # existing
    scans/                          # YAML scan definitions
        network/*.yaml              # 13 checks
        vulnerability/*.yaml        # 20+ CVE checks
        bruteforce/*.yaml           # 9 checks
        cloud/
            aws/*.yaml              # 15+ AWS checks
            azure/*.yaml            # 10+ Azure checks
            gcp/*.yaml              # 10+ GCP checks
        container/*.yaml            # 15+ container/K8s checks
        secrets/*.yaml              # 5+ secrets checks
        sca/*.yaml                  # 3+ SCA checks
        api/*.yaml                  # 10+ API checks
        ad/*.yaml                   # 10+ AD checks
        dns/*.yaml                  # 8 DNS checks
        compliance/*.yaml           # 20+ CIS checks
        mobile/*.yaml               # 5+ mobile checks
        sast/*.yaml                 # 5+ SAST checks
        threat_intel/*.yaml         # 5+ threat intel checks
    seed/correlation/*.yaml         # YAML correlation rules
```

## 9. Implementation Phases

**Phase 1 — YAML Foundation (1 week)**: YamlScanEngine, YamlScanExecutor, HTTP/TCP/SMB executors, YAML correlation rule loader, plugin maturity tiers.

**Phase 2 — Network + DNS + Brute-Force (2 weeks)**: Network checks, DNS security checks, brute-force checks with safety controls.

**Phase 3 — Vulnerability + API (2 weeks)**: 20+ CVE YAML files from Nettacker's catalog, SSL/TLS checks, security headers, API security checks.

**Phase 4 — Cloud + Containers (2 weeks)**: Cloud provider YAML checks (AWS/Azure/GCP), container image scanning (Trivy), K8s checks (Kube-bench).

**Phase 5 — Secrets + SCA + SAST (1 week)**: Git secrets scanning (Gitleaks), dependency CVE scanning (Trivy filesystem mode), SAST via Semgrep.

**Phase 6 — Mobile + AD + Compliance (2 weeks)**: Mobile app analysis enhancement, AD/LDAP checks, CIS benchmark checks via SSH.

**Phase 7 — Threat Intelligence (1 week)**: IP/domain/hash reputation checks against VirusTotal, AlienVault, MISP feeds.
