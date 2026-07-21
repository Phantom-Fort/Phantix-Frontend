Tags: #engine #compliance #future

# Compliance Engine

Status: 🟢 Implemented (DB knowledge base + profiling + assessments; Phase 4 evidence connectors stubbed).

## What exists today (July 2026)

**Implemented:**

- Platform knowledge base (`compliance_frameworks` / `controls` / `rules` / `mappings`)
- Built-in seeds: NDPR, ISO 27001, SOC 2, PCI DSS, GDPR (`seed/frameworks/*.json`)
- **Staff admin upload** of additional frameworks: `POST /api/v1/admin/compliance/frameworks` (+ file upload, list, activate/deactivate, seed reload) — see `docs/COMPLIANCE.md`
- Client APIs: list frameworks, map findings, gaps, business profile, recommendations, assessments
- Report sections for Reporting Engine

**Still future:** live Wazuh/cloud evidence connectors feeding security-DB `compliance_evidence` (table exists in DDL; not fully wired for live collection).

## Target scope (approved v1.0)

**Supported frameworks:** ISO 27001, **ISO 27701**, SOC 2, PCI DSS, CIS Controls, NIST CSF, NDPR, and future standards as required.

NDPR (Nigeria Data Protection Regulation) is worth prioritizing over the international frameworks above if early customers are Nigeria-based — that's a sequencing call, not an architectural one.

| Component | Notes |
|---|---|
| Control Mapping | Framework-agnostic control definitions, mapped many-to-many to frameworks |
| Evidence Collection | The one table that already exists (`compliance_evidence`) — everything else is built around feeding it |
| Compliance Status | Rollup per framework per org |
| Framework Reports | Feeds [[10 - Reporting Engine]] rather than generating its own PDFs |
| Gap Analysis | What's missing to reach a given framework's compliance bar |
| Policy Mapping | Org-level policy documents/attestations mapped to controls |

**Boundary rule (v1.0):** Compliance Engine maps findings to frameworks; it doesn't own remediation decisions. Anything that looks like "accepted risk" or "compensating control" tracking overlaps with [[07 - Risk Engine]]'s existing `accepted` risk status — define that boundary explicitly when this engine is built rather than running two parallel exception systems.

## Natural data sources this engine will read from, not own

- **Findings/risk history** from [[06 - Scanner Engine]] and [[07 - Risk Engine]] — most controls need evidence that a vulnerability class isn't present, which is really "read risk history, filter by control mapping."
- **Asset criticality/tags** from [[05 - Asset Engine]] — scope definition (which assets are in scope for PCI DSS, for example) is an asset-tagging problem before it's a compliance problem.
- **Audit trail** from [[12 - Audit Engine]] — dual-control approval records are themselves a form of evidence (segregation of duties). Compliance Engine is the natural first consumer of Audit Engine's export once both exist.

## Why this waits

Compliance Engine is fundamentally a *consumer* of Asset, Scanner, Risk, and Audit data. Building control-mapping logic before those upstream engines have stable, well-understood output shapes means re-deriving the mappings every time an upstream schema changes. Sequence this after [[06 - Scanner Engine]] and [[07 - Risk Engine]] are both past MVP churn. See [[16 - Deployment Roadmap]].

## Related notes

[[02 - Engine Registry]] · [[05 - Asset Engine]] · [[07 - Risk Engine]] · [[12 - Audit Engine]] · [[10 - Reporting Engine]]
