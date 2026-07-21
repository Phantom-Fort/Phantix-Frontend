Tags: #engine #scanner

# Scanner Engine

Status: 🟢 Implemented (on-demand scanning only — no schedules in MVP by design).

Owns scan orchestration, tool execution, and result normalization. Nothing here knows what a "risk" is — it just produces `scan_results`.

**Boundary rule (v1.0):** Scanner Engine must not generate reports, calculate risk, send email, call AI, or calculate compliance. It only scans. Every one of those is a real temptation once a scanner adapter is already parsing tool output — resist adding "just a quick severity bump" or "just a quick email on completion" here; that's [[07 - Risk Engine]]'s and [[11 - Alert Engine]]'s job respectively, coordinated through events once [[04 - Engine Bus]] exists.

**Approved tool roadmap** (implemented today: Nmap, Nuclei, and APK static analysis): Nmap, Nuclei, **OpenVAS, Naabu, Httpx, Subfinder, WhatWeb**, and future scanners as they're added. The Tool Adapters split below is what makes adding each of these an isolated change instead of touching shared code.

## Scan job lifecycle (`scan_jobs`)

`pending → queued/running → completed/failed`

- **One active job per organization** enforced by a unique partial index plus an application-level check.
- `idempotency_key` — duplicate submissions return the existing job rather than starting a second one.
- `target_filter` (JSON) selects assets by tags, asset_types, asset_ids, or criticality — reads directly from [[05 - Asset Engine]].
- `tools`: `["nmap"]`, `["nuclei"]`, `["apk"]`, or combinations.

## Execution environment

`app/services/tool_executor.py`:
- Prefers Docker (`instrumentisto/nmap`, `projectdiscovery/nuclei`), falls back to host binary for local dev.
- Per-organization asyncio lock — max **1 concurrent tool run per org** in-process.

## SSRF protection (strict, non-negotiable)

`app/services/ssrf_protection.py`:
- Allowed schemes: `http`/`https` only.
- Blocks private/loopback/link-local/CGNAT ranges and the cloud metadata address (`169.254.169.254`).
- Resolves DNS and rejects if any resolved address is internal (defends against DNS rebinding).
- Rejects illegal shell characters in targets.
- Redirects disabled at the tool level, not just the HTTP client.

## Message queue

Celery + Redis (`app/workers/celery_app.py`, `tasks.py`). `run_inline=true` (default) executes in-process for local/MVP; `run_inline=false` enqueues `phantix.scan.run_job` for a real worker.

## Target engine boundary vs. what exists

| Sub-component | Status | Current home |
|---|---|---|
| Scan Scheduler | 🟡 (on-demand only, no cron/recurring) | `scan_service.py` |
| Scan Queue | 🟢 | `scan_jobs` table + Celery |
| Tool Registry | 🟡 (hardcoded tool list, not a pluggable registry yet) | `tool_executor.py` |
| Execution Manager | 🟢 | `tool_executor.py` |
| Scan Policies | 🟡 (SSRF + Nmap admin flags only, no broader policy engine) | `ssrf_protection.py`, admin discovery settings |
| Result Normalizer | 🟢 | `scan_results` schema (tool, severity, title, evidence JSONB, raw_output) |
| Rate Limiter | 🟡 Basic timeouts only | — |
| Scan History | 🟢 | `scan_jobs` + `scan_results` |
| Worker Pool | 🟢 | Celery workers |
| Tool Adapters | 🟡 (Nmap, Nuclei, APK static analysis — no formal interface/implementation split yet) | `tool_executor.py` |
| Events | 🟡 (only via Alert Engine's `scan.completed`/`scan.failed`, not a real bus) | see [[04 - Engine Bus]] |

The **Tool Adapters** split (`interfaces/ScannerInterface.py` + `implementations/NmapScanner.py`, `NucleiScanner.py`, …) is the single highest-leverage refactor inside this engine — it's what makes adding a new scanner trivial instead of another `if tool == "x"` branch. Good candidate for the first real internal cleanup, independent of any Engine Bus work.

## Explicitly out of scope for MVP

Recurring/scheduled scans, authenticated scanning, cloud connectors (AWS/Azure/GCP), advanced GitHub secret scanning — see [[16 - Deployment Roadmap]].

## Related notes

[[02 - Engine Registry]] · [[05 - Asset Engine]] · [[07 - Risk Engine]] · [[15 - Event Contracts]]
