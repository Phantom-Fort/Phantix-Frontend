Tags: #architecture #sdk

# Shared SDK

Status: 🔴 Not started. Design intent only — no `sdk/` package exists in the codebase yet. This note matters more than its size suggests: it's the thing that keeps [[04 - Engine Bus]] and [[02 - Engine Registry]]'s "no engine imports another engine's internals" rule enforceable in practice rather than just in principle.

## The problem this solves

Without a shared SDK, "don't call another engine's internals" is a convention people can accidentally violate by importing a function from a sibling service module — easy to do in a monorepo where everything is one `pip install -e .` away. The SDK is the *only* thing engines are allowed to import from each other's territory. If it's not in the SDK, it's not shared.

## Structure (approved v1.0)

```text
sdk/
    auth/
    database/
    events/
    encryption/
    logging/
    telemetry/
    exceptions/
    constants/
    types/
    utilities/
```

| Module | Owns |
|---|---|
| `auth/` | JWT verification, dual-control session validation helpers — used by every engine's API layer, owned by nobody's business logic |
| `database/` | Connection helpers for the platform DB and the dynamic per-org security DB pattern (see [[01 - Platform Architecture]]) — not table models, just the connection mechanics |
| `events/` | Event publish/subscribe interface once [[04 - Engine Bus]] exists — this is where `enqueue_alert`'s pattern generalizes to, per [[04 - Engine Bus]]'s recommendation to use it as the reference design |
| `encryption/` | Fernet helpers — currently duplicated wherever connection credentials, GitHub PATs, and SMTP passwords each get encrypted; this is the actual consolidation opportunity if this module gets built early |
| `logging/` | Structured logging conventions, shared across engines so logs are queryable the same way regardless of which engine emitted them |
| `telemetry/` | Metrics/tracing hooks — feeds [[13 - Operations Engine]] |
| `exceptions/` | Shared exception types (e.g. a common `PhantixValidationError`) so engines don't each invent their own error shape |
| `constants/` | Shared enums — severity levels, statuses — anywhere two engines need to agree on the same fixed vocabulary (e.g. Risk Engine's severity levels and Alert Engine's severity routing table need to mean the same thing) |
| `types/` | Shared type definitions / schemas for event payloads — the closest thing to what earlier drafts called "contracts" |
| `utilities/` | Genuinely generic helpers with no business meaning — the smallest, most tightly-scrutinized module, since it's the one most likely to become a dumping ground |

## The rule

Engines import contracts from the SDK. They never import another engine's internal implementation — only its published events (once the bus exists) or its documented public API.

## Why this doesn't need to exist yet

Nothing is physically split into separate engines today (see [[02 - Engine Registry]] — Phase 0), so there's no cross-engine import discipline to enforce yet; everything genuinely is shared in one codebase. Build this SDK skeleton at the start of [[16 - Deployment Roadmap]]'s Track 2 Phase 1, alongside the first real engine split and [[04 - Engine Bus]] — not before, or it'll be designed against guesses about what needs sharing instead of the first real case.

## Related notes

[[02 - Engine Registry]] · [[04 - Engine Bus]] · [[16 - Deployment Roadmap]]
