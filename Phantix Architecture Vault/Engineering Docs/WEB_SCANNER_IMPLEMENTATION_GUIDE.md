# Web Application Scanner — Implementation Guide

**Version**: 1.0
**Date**: July 14, 2026
**Status**: Implemented (Phases 1–2 tool pipeline + campaign wiring). AI §8b stubs only (toggles accepted, not live).
**Audience**: Phantix Backend Engineers, Security Engineering Team
**Prerequisite Reading**: `VAPT_ENGINE_IMPLEMENTATION_GUIDE.md`, `Phantix Architecture Vault/05 - Asset Engine.md`, `Phantix Architecture Vault/06 - Scanner Engine.md`
**Package**: `app/engines/vapt_engine/web_scanner/` · **User docs**: `docs/VAPT.md`

---

## Table of Contents

1. [Overview](#1--overview)
2. [Architecture — Subsidiary of VAPT Engine](#2--architecture--subsidiary-of-vapt-engine)
3. [Tool Selection & Docker Images](#3--tool-selection--docker-images)
4. [Web Scanner Pipeline](#4--web-scanner-pipeline)
5. [Adapter Definitions](#5--adapter-definitions)
6. [Data Flow & Integration](#6--data-flow--integration)
7. [Procedure Integration](#7--procedure-integration)
8. [Security Controls](#8--security-controls)
9. [Implementation Phases](#9--implementation-phases)
10. [Edge Cases & Constraints](#10--edge-cases--constraints)
11. [Engineering Checks Prior to Implementation](#11--engineering-checks-prior-to-implementation)

---

## 1. — Overview

### What This Is

A **multi-tool web application scanning orchestrator** that runs a full OWASP Top 10, SQL injection, subdomain enumeration, and crawling pipeline against web targets. It lives inside the VAPT Engine and coordinates Scanner Engine tool execution, Asset Engine discovery, and the VAPT correlation engine.

### What This Is Not

- Not a standalone engine — it's a **service within the VAPT Engine**
- Not a replacement for Scanner Engine — it **uses** Scanner Engine's tool execution infrastructure
- Not a replacement for Asset Engine — it **uses** Asset Engine for subdomain discovery

### Architecture Decision

| Question | Decision |
|---|---|
| Where does it live? | `app/engines/vapt_engine/web_scanner/` — subsidiary of VAPT Engine |
| How does it scan? | Orchestrates multiple Docker-based OSS tools via Scanner Engine's `tool_executor.py` |
| How does it discover targets? | Reads from Asset Engine (existing subdomains + domains) |
| How does it fit campaigns? | Campaigns declare `step_type: "web_scan"` which triggers the pipeline |
| What tools does it use? | nuclei (OWASP Top 10), sqlmap (SQLi), katana (crawler), httpx (probe), gowitness (screenshots), subfinder (enum) |
| Engine subsidiary rule | Web Scanner inherits VAPT Engine's MUST NOT list. It never executes as a standalone API. |

---

## 2. — Architecture — Subsidiary of VAPT Engine

### 2.1 The "Subsidiary" Rule

The Web Scanner is **not a standalone engine**. It has no API routes, no engine manifest, no registry entry, and no direct bus subscriptions. It is a service within the VAPT Engine — the same way `campaign_manager.py` or `multi_party_approval.py` are services, not engines.

This means:
- The Web Scanner **inherits** VAPT Engine's MUST NOT list
- It cannot be invoked outside of a VAPT campaign
- It does not appear in `GET /api/v1/engines`
- It cannot subscribe to bus events directly
- It uses the VAPT Engine's existing infrastructure for event publishing, correlation, and campaign state management

### 2.2 Position in the Codebase

```
app/engines/vapt_engine/
    __init__.py
    api/                          # Campaign API
    services/
        campaign_manager.py       # State machine — unchanged
        step_executor.py          # Executes steps, including web_scan
        procedure_resolver.py     # Procedure definitions
        scheduler_service.py      # Campaign scheduling
        multi_party_approval.py   # Dual-control approvals
    web_scanner/                  # ← NEW: Web Application Scanner
        __init__.py
        orchestrator.py           # Main pipeline driver
        pipeline/
            __init__.py
            phase_discovery.py    # Subdomain enumeration + URL discovery
            phase_recon.py        # Technology detection + endpoint mapping
            phase_vuln.py         # OWASP Top 10 + general vuln scanning
            phase_sqli.py         # SQL injection testing
            phase_report.py       # Screenshots + evidence collection
        adapters/
            __init__.py
            subfinder_adapter.py  # Subdomain enumeration
            httpx_adapter.py      # HTTP probing + tech detection
            katana_adapter.py     # URL crawling
            nuclei_adapter.py     # Vulnerability scanning (OWASP templates)
            sqlmap_adapter.py     # SQL injection
            gowitness_adapter.py  # Screenshots
        findings.py               # Web-specific finding normalization
        config.py                 # Tool defaults, timeouts, template paths
    correlation/                  # Already exists — correlates web findings
    analysis/                     # Already exists — complexity classifier
    procedures/                   # Already exists — builtin procedure defs
    events/                       # Already exists — event publishers
    models/                       # VAPT campaign models (unchanged)
    schemas/                      # Campaign schemas (unchanged)
```

---

## 3. — Tool Selection & Docker Images

### 3.1 Tool Inventory

| Tool | Purpose | Docker Image | Approx Image Size | Typical Runtime |
|---|---|---|---|---|
| **subfinder** | Passive subdomain enumeration | `projectdiscovery/subfinder:latest` | ~30MB | 30-60s |
| **httpx** | HTTP probing + tech detection | `projectdiscovery/httpx:latest` | ~30MB | 10-30s per target |
| **katana** | Web crawler / URL discovery | `projectdiscovery/katana:latest` | ~35MB | 2-10min depending on site |
| **nuclei** | OWASP Top 10 + general vuln scan | `projectdiscovery/nuclei:latest` | ~200MB (includes templates) | 5-30min |
| **sqlmap** | SQL injection detection | `sqlmapproject/sqlmap:latest` | ~150MB | 2-20min per endpoint |
| **gowitness** | Web page screenshot capture | `six8/gowitness:latest` | ~20MB | 5-10s per page |

### 3.2 Docker Execution Pattern

Each tool follows the existing `tool_executor.py` pattern already used by nmap and nuclei in the Scanner Engine:

```python
# app/engines/vapt_engine/web_scanner/adapters/nuclei_adapter.py
# All adapters use the same pattern: build docker cmd, run_command(), parse output

from app.engines.scanner_engine.adapters.tool_executor import (
    docker_available,
    run_command,
    ToolRunResult,
)
```

---

## 4. — Web Scanner Pipeline

### 4.1 Pipeline Orchestrator

```python
# app/engines/vapt_engine/web_scanner/orchestrator.py

from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class WebScanConfig:
    """Configuration for a full web scan pipeline."""

    # Scope
    root_domains: list[str]
    include_subdomains: bool = True
    include_api: bool = True

    # Phase toggles
    run_discovery: bool = True
    run_recon: bool = True
    run_vuln_scan: bool = True
    run_sqli: bool = True
    run_screenshots: bool = True

    # Filtering
    severity_filter: str = "critical,high,medium"
    max_pages_to_crawl: int = 200
    max_sqli_endpoints: int = 20
    nuclei_templates: list[str] = field(
        default_factory=lambda: ["owasp-top-10", "cves", "exposures", "misconfigurations"]
    )

    # Performance
    concurrency: int = 3
    request_rate_limit: int = 150
    per_tool_timeout: int = 600


@dataclass
class WebScanResult:
    """Aggregated result from a full web scan pipeline."""

    assets_discovered: list[dict] = field(default_factory=list)
    live_endpoints: list[dict] = field(default_factory=list)
    crawled_urls: list[dict] = field(default_factory=list)
    vulnerabilities: list[dict] = field(default_factory=list)
    screenshots: list[dict] = field(default_factory=list)
    tech_stack: dict[str, list[str]] = field(default_factory=dict)
    scan_metadata: dict[str, Any] = field(default_factory=dict)


class WebScannerOrchestrator:
    """Orchestrates a full web application security scan pipeline."""

    def __init__(self, db, org, config: WebScanConfig):
        self._db = db
        self._org = org
        self.config = config
        self.result = WebScanResult()

    async def run(self) -> WebScanResult:
        if self.config.run_discovery:
            await self._phase_discovery()
        if self.config.run_recon:
            await self._phase_recon()
        if self.config.run_vuln_scan:
            await self._phase_vuln_scan()
        if self.config.run_sqli:
            await self._phase_sqli()
        if self.config.run_screenshots:
            await self._phase_screenshots()
        return self.result

    async def _phase_discovery(self):
        from app.engines.vapt_engine.web_scanner.adapters import subfinder_adapter, httpx_adapter
        # 1. Get existing subdomains from Asset Engine
        # 2. Discover new subdomains via subfinder
        # 3. Probe which are alive with httpx

    async def _phase_recon(self):
        from app.engines.vapt_engine.web_scanner.adapters import katana_adapter
        # Crawl live endpoints with katana

    async def _phase_vuln_scan(self):
        from app.engines.vapt_engine.web_scanner.adapters import nuclei_adapter
        # Run nuclei OWASP templates against live endpoints

    async def _phase_sqli(self):
        from app.engines.vapt_engine.web_scanner.adapters import sqlmap_adapter
        # Run sqlmap against parameterized endpoints

    async def _phase_screenshots(self):
        from app.engines.vapt_engine.web_scanner.adapters import gowitness_adapter
        # Capture screenshots to object storage
```

---

## 5. — Adapter Definitions

### 5.1 subfinder_adapter.py — Passive Subdomain Enumeration

```python
"""Subdomain enumeration via projectdiscovery/subfinder."""

from app.engines.scanner_engine.adapters.tool_executor import run_command

SUBFINDER_IMAGE = "projectdiscovery/subfinder:latest"

async def enumerate(
    domains: list[str],
    timeout: int = 120,
) -> list[dict]:
    """Discover subdomains via passive sources. No direct contact with target."""
    all_subs = []
    for domain in domains:
        cmd = ["docker", "run", "--rm", SUBFINDER_IMAGE, "-d", domain, "-silent", "-all"]
        result = await run_command(cmd, timeout_seconds=timeout)
        if result.returncode == 0:
            for sub in result.stdout.strip().split("\n"):
                sub = sub.strip()
                if sub:
                    all_subs.append({
                        "asset_type": "subdomain",
                        "value": sub,
                        "source": "web_scanner_subfinder",
                    })
    return all_subs
```

### 5.2 httpx_adapter.py — HTTP Probing & Tech Detection

```python
"""HTTP probing + technology detection via projectdiscovery/httpx."""

HTTPX_IMAGE = "projectdiscovery/httpx:latest"

async def probe(hosts: list[str], timeout: int = 120) -> list[dict]:
    """Probe hosts for HTTP/HTTPS and detect technologies."""
    if not hosts:
        return []
    input_data = "\n".join(hosts).encode()
    cmd = ["docker", "run", "--rm", "-i", HTTPX_IMAGE,
           "-json", "-status-code", "-title", "-tech-detect",
           "-follow-redirects", "-silent", "-timeout", "10"]
    import json
    result = await run_command(cmd, timeout_seconds=timeout, stdin=input_data)
    findings = []
    for line in result.stdout.strip().split("\n"):
        line = line.strip()
        if not line:
            continue
        try:
            rec = json.loads(line)
            findings.append({
                "url": rec.get("url", ""),
                "host": rec.get("host", ""),
                "status_code": rec.get("status-code"),
                "title": rec.get("title", ""),
                "technology": rec.get("tech", []),
                "webserver": rec.get("webserver", ""),
            })
        except json.JSONDecodeError:
            continue
    return findings
```

### 5.3 katana_adapter.py — Web Crawler

```python
"""Web crawler via projectdiscovery/katana."""

KATANA_IMAGE = "projectdiscovery/katana:latest"

async def crawl(url: str, max_pages: int = 200, depth: int = 3, timeout: int = 300) -> list[dict]:
    """Crawl a target URL and discover endpoints."""
    cmd = ["docker", "run", "--rm", KATANA_IMAGE, "-u", url,
           "-jc", "-k", "-d", str(depth), "-rl", "50",
           "-json", "-silent", "-o", "/dev/stdout"]
    import json
    result = await run_command(cmd, timeout_seconds=timeout)
    findings = []
    for line in result.stdout.strip().split("\n"):
        line = line.strip()
        if not line:
            continue
        try:
            rec = json.loads(line)
            findings.append({
                "url": rec.get("url", ""),
                "method": rec.get("method", "GET"),
                "status_code": rec.get("status-code"),
                "content_length": rec.get("content-length"),
                "endpoint": rec.get("endpoint", ""),
            })
        except json.JSONDecodeError:
            continue
    return findings
```

### 5.4 nuclei_adapter.py — OWASP Top 10 + General Vuln Scan

```python
"""Vulnerability scanning via projectdiscovery/nuclei."""

NUCLEI_IMAGE = "projectdiscovery/nuclei:latest"

async def run_nuclei_web_scan(
    targets: list[str],
    templates: list[str] | None = None,
    severity: str | None = None,
    timeout: int = 600,
) -> list[dict]:
    """Run nuclei with OWASP web templates against targets."""
    if not docker_available():
        return await _fallback_http_probe(targets)

    import json
    all_findings = []
    for target in targets:
        cmd = ["docker", "run", "--rm",
               "-v", "nuclei-templates:/home/nuclei/nuclei-templates",
               NUCLEI_IMAGE,
               "-target", target,
               "-json",
               "-severity", severity or "critical,high,medium",
               "-tags", ",".join(templates or ["owasp-top-10", "cves", "exposures", "misconfigurations"]),
               "-rate-limit", "150",
               "-timeout", "10",
               "-retries", "2"]
        result = await run_command(cmd, timeout_seconds=timeout)
        for line in result.stdout.strip().split("\n"):
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
                all_findings.append({
                    "tool": "nuclei",
                    "target": target,
                    "title": rec.get("info", {}).get("name", "Unknown"),
                    "severity": rec.get("info", {}).get("severity", "info"),
                    "description": rec.get("info", {}).get("description", ""),
                    "matched_at": rec.get("matched-at", ""),
                    "template_id": rec.get("template-id", ""),
                    "type": rec.get("type", ""),
                    "evidence": {
                        "request": rec.get("request", ""),
                        "response": rec.get("response", ""),
                        "curl_command": rec.get("curl-command", ""),
                    },
                })
            except json.JSONDecodeError:
                continue
    return all_findings
```

### 5.5 sqlmap_adapter.py — SQL Injection Testing

```python
"""SQL injection testing via sqlmap."""

SQLMAP_IMAGE = "sqlmapproject/sqlmap:latest"

async def scan(
    url: str,
    method: str = "GET",
    data: str | None = None,
    level: int = 3,
    risk: int = 2,
    timeout: int = 600,
) -> list[dict]:
    """Test a single URL for SQL injection vulnerabilities."""
    import json
    cmd = ["docker", "run", "--rm", SQLMAP_IMAGE,
           "-u", url, "--method", method,
           "--batch", "--random-agent",
           f"--level={level}", f"--risk={risk}",
           "--time-sec=5", "--threads=5",
           "--flush-session", "--output-dir=/tmp/sqlmap", "--json"]
    if data:
        cmd.extend(["--data", data])
    result = await run_command(cmd, timeout_seconds=timeout)
    findings = []
    try:
        if result.stdout.strip():
            data = json.loads(result.stdout)
            for vuln in data.get("data", []):
                findings.append({
                    "tool": "sqlmap",
                    "title": f"SQL Injection: {vuln.get('title', 'Unknown')}",
                    "severity": "critical",
                    "url": url,
                    "parameter": vuln.get("parameter", ""),
                    "technique": vuln.get("technique", ""),
                    "evidence": {"payload": vuln.get("payload", "")},
                })
    except json.JSONDecodeError:
        pass
    return findings
```

### 5.6 gowitness_adapter.py — Screenshots

```python
"""Screenshot capture via gowitness."""

import re
GOWITNESS_IMAGE = "six8/gowitness:latest"

async def capture(urls: list[str], org_id: int, timeout: int = 120) -> list[dict]:
    """Capture screenshots and upload to object storage."""
    from app.shared.storage import storage_manager

    results = []
    for url in urls:
        safe_name = re.sub(r"[^a-zA-Z0-9_-]", "_", url.split("//")[-1])[:80]
        key = f"screenshots/{org_id}/{safe_name}.png"
        cmd = ["docker", "run", "--rm", GOWITNESS_IMAGE, "single", "--url", url, "--format", "png"]
        result = await run_command(cmd, timeout_seconds=timeout)
        if result.returncode == 0 and len(result.stdout) > 1000:
            screenshot_url = await storage_manager.upload(
                bucket="phantix-screenshots",
                key=key,
                data=result.stdout.encode() if isinstance(result.stdout, str) else result.stdout,
                content_type="image/png",
            )
            results.append({"url": url, "screenshot_url": screenshot_url})
    return results
```

---

## 6. — Data Flow & Integration

### 6.1 Integration with VAPT Campaign Steps

The step executor dispatches to the web scanner when it encounters `step_type: "web_scan"`:

```python
# app/engines/vapt_engine/services/step_executor.py — add this branch

from app.engines.vapt_engine.web_scanner.orchestrator import WebScannerOrchestrator, WebScanConfig

async def _run_scan_step(db, org, campaign, step, *, run_inline=True):
    config = step.config or {}
    scan_type = config.get("scan_type") or (config.get("tools", [None])[0] if config.get("tools") else None)

    if scan_type == "web":
        web_config = WebScanConfig(
            root_domains=config.get("root_domains", []),
            include_subdomains=config.get("include_subdomains", True),
            run_sqli=config.get("run_sqli", True),
            nuclei_templates=config.get("nuclei_templates", ["owasp-top-10", "cves", "exposures"]),
        )
        orchestrator = WebScannerOrchestrator(db, org, web_config)
        result = await orchestrator.run()
        # Convert to standard findings and store
        findings = _web_findings_to_scan_findings(result)
        # store in security DB via scan_service
    else:
        # Existing tool execution path (nmap, nuclei, etc.)
        ...
```

### 6.2 Integration with Asset Engine

Discovered subdomains are fed back to Asset Engine via bus event:

```python
async def _ingest_new_assets(self, new_subs: list[dict]):
    from app.bus.publisher import publish
    for sub in new_subs:
        await publish("AssetCreated", self._org.id, {
            "asset_type": "subdomain",
            "value": sub["value"],
            "source": "web_scanner_subfinder",
        }, source_engine="vapt_engine")
```

### 6.3 Integration with VAPT Correlation

Web scan findings flow into the correlation engine alongside all other findings. The web scanner produces the same `ScanFinding` dataclass as any other tool adapter, so the existing correlation rules apply automatically.

---

## 7. — Procedure Integration

### 7.1 New Procedure: `web_app_scan_only`

```python
# app/engines/vapt_engine/procedures/builtin.py — add

BUILTIN_PROCEDURES["web_app_scan_only"] = {
    "display_name": "Web Application Scan Only",
    "description": "Focused web app assessment — no infrastructure scanning.",
    "steps": [
        {
            "step_type": "web_scan",
            "step_name": "Full Web App Security Assessment",
            "config": {
                "tools": ["web"],
                "include_subdomains": True,
                "run_discovery": True,
                "run_sqli": True,
                "run_screenshots": True,
                "severity_filter": "critical,high,medium,low",
            },
        },
        {"step_type": "correlate", "config": {"rule_ids": ["default_attack_path", "api_auth_bypass"]}},
        {"step_type": "analyze", "config": {"ai_threshold": "medium"}},
    ],
}
```

### 7.2 Updated `full_vapt` Procedure

Add a web scan step to the `full_vapt` procedure:

```python
BUILTIN_PROCEDURES["full_vapt"]["steps"].insert(1, {
    "step_type": "web_scan",
    "step_name": "Web Application Scan",
    "config": {
        "tools": ["web"],
        "include_subdomains": True,
        "run_discovery": True,
        "run_sqli": True,
        "nuclei_templates": ["owasp-top-10", "cves", "exposures", "misconfigurations"],
        "severity_filter": "critical,high,medium",
        "max_pages_to_crawl": 200,
    },
})
```

---

## 8. — Security Controls

### 8.1 SSRF Protection

All targets validated before scanning:

```python
from app.engines.scanner_engine.validators.ssrf_protection import validate_scan_target

for domain in config.root_domains:
    await validate_scan_target(domain)
```

### 8.2 Rate Limits

| Tool | Rate Limit |
|---|---|
| nuclei | 150 req/s |
| katana | 50 req/s |
| sqlmap | 5 threads |
| subfinder | Passive only |
| httpx | Sequential |

### 8.3 Tool Timeouts

| Tool | Timeout |
|---|---|
| subfinder | 120s |
| httpx | 120s |
| katana | 300s |
| nuclei | 600s |
| sqlmap | 600s |
| gowitness | 120s |

### 8.4 Docker Security

```bash
docker run --rm --security-opt no-new-privileges \
  --read-only --network phantix_scan_network \
  --memory 1g --cpus 2 \
  projectdiscovery/nuclei:latest ...
```

---

**End of Web Scanner Implementation Guide**

*The Web Application Scanner is a subsidiary of the VAPT Engine. It orchestrates six Docker-based OSS tools through a four-phase pipeline, augmented by three AI-powered capabilities (AI-assisted authentication, Flowmapper, ML Classifier) that are controlled via per-campaign billing toggles. Implementation should start with Phase 1 (subfinder + httpx + nuclei) and proceed through Phase 2 (katana + sqlmap + gowitness), with AI features added in Phase 3.*

---

## 8b. — AI-Enhanced Capabilities

Three AI-powered features augment the web scanner. Each is controlled by a per-campaign toggle, and each incurs additional compute cost (LLM calls + Playwright container). They default to OFF for standard campaigns and can be enabled individually.

### 8b.1 AI-Assisted Authentication

#### Problem

Many modern web applications use JavaScript-rendered login forms, OAuth redirect flows, or non-standard authentication patterns (API-key-based, modal-based, SSO). Standard DOM-based form detection misses these, so scans of authenticated portions of the app fail silently.

#### Solution

A two-phase authentication engine:

```
Phase 1: Standard form detection (always runs)
  └── Parse HTML for <form>, <input type="password">, <input type="email">
  └── Works for 80% of traditional login pages

Phase 2: AI fallback (runs if Phase 1 fails, or if AI auth is explicitly enabled)
  └── Launch Playwright headless Chromium
  └── Capture page screenshot + full DOM
  └── Send to LLM with prompt:
        "This is a webpage. Is there a login form? If yes, return the
         CSS selectors for username/email, password fields, and the
         submit button. If not, describe how authentication works."
  └── LLM returns selectors → Playwright fills credentials → submits
  └── Verify login success (check for session cookie, redirect, DOM change)
  └── Export cookies/tokens → inject into subsequent scan requests
```

#### Implementation

```
app/engines/vapt_engine/web_scanner/ai/
    __init__.py
    auth.py              # AIAuthAssist — two-phase login detection
    flowmapper.py        # Flowmapper — AI-guided endpoint discovery
    soft404_classifier.py # Soft404Classifier — two-stage ML filtering
```

```python
# app/engines/vapt_engine/web_scanner/ai/auth.py

class AIAuthAssist:
    """AI-assisted login form detection and authentication.

    Phase 1: Standard HTML form detection (always runs, no AI cost)
    Phase 2: Playwright + LLM fallback (runs when Phase 1 fails)
    """

    PLAYWRIGHT_IMAGE = "mcr.microsoft.com/playwright:latest"

    async def authenticate(
        self,
        target_url: str,
        credentials: dict,
        ai_available: bool = False,
        timeout: int = 120,
    ) -> dict:
        """Attempt to authenticate. Returns session cookies/tokens or failure reason."""
        # Phase 1: Standard form detection
        standard = await self._detect_standard_form(target_url)
        if standard.get("has_login_form"):
            return await self._standard_login(target_url, credentials, standard)

        # Phase 2: AI-assisted (requires LLM access)
        if not ai_available:
            return {"authenticated": False, "reason": "AI auth not available"}
        return await self._ai_assisted_login(target_url, credentials, timeout)

    async def _detect_standard_form(self, url: str) -> dict:
        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, timeout=10)
            html = resp.text.lower()
            return {
                "has_login_form": 'type="password"' in html,
                "html": html[:5000],
            }

    async def _ai_assisted_login(self, url: str, credentials: dict, timeout: int) -> dict:
        """Launch Playwright, capture page, send to LLM, execute login."""
        page_data = await self._capture_page(url, timeout)
        from app.bus.publisher import publish
        analysis = await publish("AIWebAnalysisRequested", 0, {
            "task": "detect_login_form",
            "screenshot": page_data.get("screenshot_b64"),
            "dom": page_data.get("dom"),
            "url": url,
        })
        if not analysis or not analysis.get("selectors"):
            return {"authenticated": False, "reason": "AI could not identify login form"}
        return await self._playwright_login(url, credentials, analysis["selectors"], timeout)

    async def _playwright_login(self, url: str, credentials: dict, selectors: dict, timeout: int) -> dict:
        """Use Playwright to fill form and submit."""
        import json
        script = json.dumps({
            "action": "login", "url": url,
            "email_selector": selectors.get("email", selectors.get("username")),
            "password_selector": selectors.get("password"),
            "submit_selector": selectors.get("submit"),
            "email": credentials.get("email", ""),
            "password": credentials.get("password", ""),
            "timeout_seconds": timeout,
        })
        cmd = ["docker", "run", "--rm", "--network", "host",
               self.PLAYWRIGHT_IMAGE, "node", "-e", f"""
                const {{ chromium }} = require('playwright');
                const config = {script};
                (async () => {{
                    const browser = await chromium.launch({{ headless: true }});
                    const page = await browser.newPage();
                    await page.goto(config.url, {{ waitUntil: 'networkidle' }});
                    if (config.email_selector) await page.fill(config.email_selector, config.email);
                    if (config.password_selector) await page.fill(config.password_selector, config.password);
                    if (config.submit_selector) await page.click(config.submit_selector);
                    await page.waitForTimeout(5000);
                    const cookies = await page.context().cookies();
                    console.log(JSON.stringify({{ cookies, currentUrl: page.url() }}));
                    await browser.close();
                }})();
            """]
        from app.engines.scanner_engine.adapters.tool_executor import run_command
        result = await run_command(cmd, timeout_seconds=timeout)
        if result.returncode != 0:
            return {"authenticated": False, "reason": "Playwright failed"}
        try:
            output = json.loads(result.stdout.strip())
            return {
                "authenticated": bool(output.get("cookies", [])),
                "cookies": {{c["name"]: c["value"] for c in output.get("cookies", [])}},
                "redirect_url": output.get("currentUrl", url),
            }
        except json.JSONDecodeError:
            return {"authenticated": False, "reason": "Could not parse output"}
```

### 8b.2 Flowmapper

#### Problem

Traditional spiders follow `<a href>` links. They miss multi-step forms, JS-rendered navigation, state-dependent endpoints, and API calls triggered by user interaction.

#### Solution

An AI agent that drives a real browser like a human tester:

```
Flowmapper agent session:
  1. Playwright launches Chromium, navigates to target
  2. Captures page state: DOM, visible links, forms, buttons, JS event handlers
  3. Sends page summary to LLM:
       "What interactions should I perform to discover hidden endpoints?"
  4. LLM decides next action → Playwright executes it
  5. Repeat until no new endpoints for 5 actions, max 50 steps, or timeout
  6. Returns all discovered URLs, API endpoints, and authentication states
```

```python
# app/engines/vapt_engine/web_scanner/ai/flowmapper.py

class Flowmapper:
    """AI-guided web crawler using Playwright + LLM."""

    MAX_STEPS = 50
    STALE_THRESHOLD = 5

    async def map_application(self, base_url: str, credentials: dict = None,
                               max_steps: int = 50, timeout: int = 600) -> dict:
        if not ai_available:
            return self._basic_crawl(base_url)

        discovered_endpoints = set()
        discovered_api = set()
        stale = 0

        session = await self._start_browser(base_url, credentials)
        for step in range(max_steps):
            state = await self._capture_state(session)
            new_urls = state.get("urls", []) - discovered_endpoints
            new_apis = state.get("api_calls", []) - discovered_api
            discovered_endpoints.update(new_urls)
            discovered_api.update(new_apis)
            stale = 0 if new_urls or new_apis else stale + 1
            if stale >= self.STALE_THRESHOLD:
                break
            action = await self._llm_decide(state)
            if not action or action.get("type") == "stop":
                break
            await self._execute(session, action)
        await self._close(session)
        return {"endpoints": sorted(discovered_endpoints),
                "api_endpoints": sorted(discovered_api),
                "steps_taken": step + 1}

    async def _llm_decide(self, page_state: dict) -> dict | None:
        from app.bus.publisher import publish
        resp = await publish("AIWebAnalysisRequested", 0, {
            "task": "flowmapper_decide",
            "page_state": page_state,
        })
        return resp.get("action") if resp else None

    def _basic_crawl(self, base_url: str) -> dict:
        """Fallback: standard link-based crawl. No AI cost."""
        ...
```

### 8b.3 ML Classifier (Soft-404 Detection)

Two-stage classifier that filters fake "not found" pages returning HTTP 200.

```
Stage 1: Fast in-process filter (~1ms per response)
  └── Title contains "404", "not found", "page doesn't exist"
  └── Content length matches known 404 template within 10%
  └── Body contains "not found", "error 404"
  └── Redirect chain > 3
  └── → 90%+ of soft-404s caught here

Stage 2: ML classifier (only on Stage 1 flagged responses)
  └── Sends features to AI Engine for deep NLP check
  └── Returns soft_404_probability (0.0 - 1.0)
  └── Threshold >0.7 → exclude from findings
```

```python
# app/engines/vapt_engine/web_scanner/ai/soft404_classifier.py

class Soft404Classifier:
    SOFT_404_KEYWORDS = frozenset({
        "not found", "page doesn't exist", "error 404", "nothing here",
        "this page could not be found", "page is missing", "no content",
    })

    async def filter_findings(self, responses: list[dict]) -> tuple[list[dict], list[dict]]:
        """Filter responses. Returns (real_findings, soft_404s)."""
        real, flagged = [], []
        for resp in responses:
            if self._stage1(resp):
                flagged.append(resp)
            else:
                real.append(resp)
        # Stage 2: ML on flagged
        for resp in flagged:
            ml = await self._stage2(resp)
            if not ml or ml.get("soft_404_probability", 0) <= 0.7:
                real.append(resp)
        return real, flagged

    def _stage1(self, resp: dict) -> bool:
        """Fast in-process check."""
        body = (resp.get("body") or "").lower()
        title = (resp.get("title") or "").lower()
        indicators = 0
        if any(kw in title for kw in self.SOFT_404_KEYWORDS):
            indicators += 1
        if sum(1 for kw in self.SOFT_404_KEYWORDS if kw in body) >= 2:
            indicators += 1
        if resp.get("redirect_chain") and len(resp["redirect_chain"]) > 3:
            indicators += 1
        return indicators >= 2

    async def _stage2(self, resp: dict) -> dict | None:
        from app.bus.publisher import publish
        try:
            return await publish("AIClassificationRequested", 0, {
                "task": "soft_404_classifier",
                "url": resp.get("url"),
                "title": resp.get("title", ""),
                "body_length": len(resp.get("body", "")),
            })
        except Exception:
            return None
```

### 8b.4 Billing & Per-Campaign Toggle

```python
# In WebScanConfig
@dataclass
class WebScanConfig:
    ...
    ai_auth_enabled: bool = False
    flowmapper_enabled: bool = False
    ml_classifier_enabled: bool = False
```

```http
POST /api/v1/vapt/campaigns
{
    "procedure_key": "web_app_scan_only",
    "ai_enhancements": {
        "ai_auth": true,
        "flowmapper": true,
        "ml_classifier": true
    },
    "ai_auth_credentials": {
        "email": "test@example.com",
        "password": "********"
    }
}
```

```json
{
    "campaign_id": 42,
    "estimated_ai_cost": {
        "ai_auth": 0.50,
        "flowmapper": 2.00,
        "ml_classifier": 0.10,
        "total_estimated": 2.60
    }
}
```

### 8b.5 Pipeline Integration

```
Phase 1: DISCOVERY (subfinder + httpx)
  └── AI: Flowmapper runs if enabled (discovers JS-rendered endpoints)

Phase 2: RECON (katana)
  └── AI: Flowmapper if not already run

Phase 3: VULN SCAN (nuclei + sqlmap)
  ├── AI: AI-assisted auth handles login before nuclei runs
  └── AI: ML Classifier filters out soft-404 false positives

Phase 4: EVIDENCE (screenshots)
  └── (no AI integration)
```

---
