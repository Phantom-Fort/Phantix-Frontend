Tags: #engine #audit

# Audit Engine

Status: 🟡 Partial — **newly promoted to a first-class engine in v1.0.** The functionality exists and works today (see AUDIT.md), but it currently lives inside [[03 - Control Plane]]'s code rather than as its own module. This note describes the target boundary; the code hasn't moved yet.

Responsible for platform accountability — the immutable record of what happened, independent of who was allowed to make it happen.

## Storage residency (binding)

**All dual-control and audit trail data is stored in the Phantix application (platform) database**, scoped by `organization_id`. This includes initiator/authorizer assignment, dual-control sessions, pending authorisation queue, and completed `audit_events`.

Rationale: dual-control actors are collected during org setup / control plane configuration on Phantix; the compliance trail must remain with that tenancy metadata and must not be written into the customer’s dedicated security database (which holds assets, scans, risks).

## Why this was split out of Control Plane

The earlier version of this vault kept Audit inside Control Plane, reasoning that dual-control was fundamentally an authorization concern. The approved plan draws a sharper line: **authorization** (deciding whether an action is allowed right now) and **the record** (permanently logging that it happened) are different responsibilities, and conflating them is exactly the kind of overlap the whole Engine model exists to prevent. See [[03 - Control Plane]]'s "Where Control Plane ends and Audit Engine begins" for the exact API-level split.

## Responsibilities (approved v1.0)

- Immutable audit logs
- Approval records
- Security events
- Authentication events
- Administrative actions
- Export

**Boundary rule:** nothing outside this engine writes audit records directly. Every other engine that needs something logged publishes an event; Audit Engine is the only writer of `audit_events`.

## What exists today, and where it actually lives

| Capability | Status | Current home |
|---|---|---|
| Per-org user directory | 🟢 | `organization_users` — Control Plane |
| Initiator/authorizer assignment | 🟢 | `organization_control_roles` — Control Plane |
| Dual-control session (3 min inactivity, 30 min max) | 🟢 | `org_user_auth_service.py` — Control Plane (domain-email OTP + new-device gate) |
| Org-user identity JWT + login / data-access audit | 🟢 | `type=org_user` Bearer; middleware `data.access` + `auth.org_user.*` |
| Pending action queue (`propose → authorize/reject`) | 🟢 | `audit_pending_actions` — arguably still Control Plane, since it's part of deciding whether an action proceeds |
| Immutable completed trail | 🟢 | `audit_events` — this is the part that should become Audit Engine's alone |
| CSV/JSON export | 🟢 | `GET /audit/export` — target home is Audit Engine |

Everything here already works correctly today per AUDIT.md — this is a boundary-ownership change, not a bug fix. Snapshotting initiator/authorizer names and titles onto every event at write time (so exports stay stable even after a user is renamed or deactivated) is a property worth explicitly preserving whichever engine ends up owning the write path.

## Consumers

[[09 - Compliance Engine]] is the clearest future consumer — dual-control approval records are themselves compliance evidence (segregation of duties, change control). [[10 - Reporting Engine]]'s existing ad hoc audit export is the natural seed for a formal Audit Report type once both engines exist. Neither dependency blocks building this engine; both make a stronger case for finishing it.

## Related notes

[[02 - Engine Registry]] · [[03 - Control Plane]] · [[07 - Risk Engine]] · [[09 - Compliance Engine]] · [[10 - Reporting Engine]]
