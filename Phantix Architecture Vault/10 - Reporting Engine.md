Tags: #engine #reporting #future

# Reporting Engine

Status: 🟢 Implemented under `app/engines/reporting_engine/` (consolidate + CVSS + tracker + multi-format). See `docs/REPORTING.md` and `REPORTING_ENGINE_IMPLEMENTATION_GUIDE.md`.

Explicitly listed as out of scope for MVP in the architecture doc, with the caveat "data model supports it" — worth taking seriously, since it means this engine is mostly plumbing once started, not new data modeling.

**Boundary rule (v1.0):** Reporting Engine never performs scanning. It consumes output from Scanner, Risk, Compliance, and Audit Engines and formats it for a human — it has no business logic of its own about what counts as a finding or a risk.

## What already exists, scattered

| Export | Lives in | Format |
|---|---|---|
| Risk expert-review export | [[07 - Risk Engine]] — `GET /risks/export` | JSON / CSV, `purpose: expert_review_billable` |
| Audit compliance export | `GET /audit/export`, currently under Control Plane's router, conceptually [[12 - Audit Engine]]'s | JSON / CSV |

Both are real, working exports today. Both are also exactly the kind of thing Reporting Engine should eventually own instead of each domain engine maintaining its own export logic. **Don't build Reporting Engine's first version from scratch** — start by lifting these two into it, which validates the engine boundary with zero new business logic.

## Target scope (approved v1.0)

| Report type | Primary data source |
|---|---|
| Executive | Risk Engine (prioritized summary) + Asset Engine (inventory scale) |
| Technical | Scanner Engine (`scan_results`, raw findings) |
| Compliance | [[09 - Compliance Engine]] once it exists |
| Board | Rollup of Executive + trend over time |
| Audit | [[12 - Audit Engine]]'s trail (already exported ad hoc today, from inside Control Plane) |
| Scheduled | Requires Scanner Engine's scheduling gap to close first, or an independent cron |
| White Label | Per-partner branding on top of the same underlying report types — a delivery concern, not a new report type |
| Templates / Branding | Per-org customization — new concern, no current analog |
| PDF / CSV / JSON | CSV/JSON already proven via the two existing exports; PDF is genuinely new work |
| Dashboards | Read-side aggregation — likely the last piece, since it implies its own query/cache layer |

## Why this waits, and what unlocks it

Reporting Engine's real value shows up once there's more than one domain to summarize across — right now, "Risk Engine's export" and "Audit's export" are already reasonably complete answers for their respective domains. The case for a dedicated engine strengthens specifically when:

1. [[06 - Scanner Engine]] needs a Technical Report distinct from raw `scan_results`, or
2. [[09 - Compliance Engine]] exists and needs cross-domain evidence assembly, or
3. Customers ask for scheduled/branded PDF delivery (a genuinely new capability none of today's exports provide).

Until one of those is true, resist building this — it would be infrastructure in search of a requirement. See [[16 - Deployment Roadmap]] item 4.

## Related notes

[[02 - Engine Registry]] · [[07 - Risk Engine]] · [[12 - Audit Engine]] · [[09 - Compliance Engine]]
