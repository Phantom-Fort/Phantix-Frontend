Tags: #vision #architecture

# Phantix Architecture Vault

**Purpose of this vault**: a living architectural knowledge base for Phantix, separate from the codebase but always describing it honestly. Every note in here says explicitly whether what it describes is *built*, *partially built*, or *only planned* — this vault is not allowed to get ahead of the code.

**Status legend used across every note:**
- 🟢 Implemented — real code, running today
- 🟡 Partial — scaffold, table, or stub exists; not a finished capability
- 🔴 Not started — design intent only

---

## Where we are

Phantix has **not shipped yet**. We're in active MVP development on a single FastAPI monolith (routers → services → models), with a hybrid privacy-first data model already working: platform DB for tenancy/auth, and a customer-owned "Dedicated Security Database" for all actual security data. See [[01 - Platform Architecture]].

Several modules are already solid — Asset Discovery, Scanning, Risk, Client Alerting, Audit/Dual-Control, and Server Ops are implemented and documented. Others (AI, Compliance, Reporting) exist only as empty tables in the schema or as roadmap bullets.

## Status update — v1.0 approved

The **Phantix Backend Architecture Refactoring Plan v1.0 (July 2026)** has been approved for development. It formalizes and tightens everything this vault describes: every note below has been updated to match it, and any place where the approved plan changes an earlier call made in this vault (event naming, where Audit lives, exact folder structure) is called out explicitly rather than silently overwritten — architecture decisions should leave a trail.

The single most important line in that plan: **Phantix is a Modular Monolith, not microservices.**

```text
- One FastAPI application
- One Docker deployment
- One PostgreSQL platform database
- One Redis instance
- One Celery cluster
- One code repository
```

Internally, every Engine must behave as though it *could* become its own service one day — clean boundaries, no shared repositories, communication through events rather than direct calls — but physically, none of this is being split into separate deployments yet. That only happens later, and only for engines that actually earn it (see [[16 - Deployment Roadmap]]'s extraction criteria). Modularity is the goal now; distribution is a later, conditional decision.

## Why "Engines" at all

The long-term concern: as Phantix grows into threat intel, cloud connectors, agent-based scanning, SIEM integration, and AI-assisted remediation, a flat `routers/services/models` structure stops scaling — not technically, but organizationally. Multiple people end up editing the same files for unrelated features, and domain logic (what counts as a "risk," how a scan gets prioritized) leaks across module boundaries.

The **Engine** model treats each domain (assets, scanning, risk, compliance, reporting, alerting, AI, operations) as an independently-owned unit with its own internal layout, its own tables, and — eventually — its own way of publishing events instead of calling other domains directly. Think of it the way an OS separates memory management from process scheduling: neither owns the other, they just communicate through defined contracts.

## Why this is a *direction*, not a rewrite

We are **not** freezing feature work to do a big-bang decomposition. Two reasons:

1. We haven't shipped. Every week spent restructuring code nobody's using yet is a week not spent finding out if the product works.
2. Big-bang rewrites of working systems routinely take far longer than estimated, and several of our modules (Alerts, Risk, Server Ops) are already implemented and correct — reorganizing folders around them for symmetry's sake right now would just be busywork.

Instead: keep shipping on the current monolith, but name things consistently with the target architecture as we go, and peel a module into a true Engine only when its complexity actually earns it (see [[16 - Deployment Roadmap]] for the phased approach).

## How to use this vault

- [[01 - Platform Architecture]] — what's actually running today
- [[02 - Engine Registry]] — the target domain map and what each maps to in current code
- [[03 - Control Plane]] — today's orchestration layer (API, auth, dual-control, admin)
- [[04 - Engine Bus]] — the event-driven target, and what stands in for it today
- [[05 - Asset Engine]] through [[12 - Audit Engine]], plus [[13 - Operations Engine]] — one note per domain
- [[14 - Infrastructure]] — local dev, CI, migrations, infrastructure layer
- [[15 - Event Contracts]] — event names, implemented vs. approved standard
- [[16 - Deployment Roadmap]] — what ships next, and how the engine migration is sequenced
- [[17 - Shared SDK]] — the internal library every engine imports instead of each other

Update a note the moment its status changes in the code — a stale vault is worse than no vault.

## The closing principle (keep this one pinned)

> **Optimize for modularity before distribution.** A well-designed modular monolith with clear Engine boundaries is significantly easier to develop, test, deploy, and maintain than a prematurely distributed system. Every architectural decision should preserve the ability to extract an Engine into its own service without requiring major refactoring.

That's the test for every decision recorded in this vault: does it preserve the option to extract later, without forcing the extraction now.
