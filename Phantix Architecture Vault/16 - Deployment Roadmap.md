Tags: #roadmap #deployment

# Deployment Roadmap

Status: living document — update as items complete or priorities shift. Three tracks run in parallel: **shipping the product**, **formalizing the Engine architecture** (code boundaries), and **the long-term deployment topology** (where things physically run). None of the three should block another; see [[00 - Vision]] for why we're explicitly not freezing feature work.

## Track 1: Ship the MVP (in priority order)

1. Production Celery deployment + Redis HA
2. Wire real WhatsApp / Telegram providers for critical alerts (currently `provider=log` stubs — see [[11 - Alert Engine]]); Slack/Teams follow once those two are real
3. Nuclei template policy + severity mapping (see [[06 - Scanner Engine]])
4. Report service reading `scan_results` + tags (the seed of [[10 - Reporting Engine]])
5. Authenticated API scanning
6. Cloud connectors (AWS/Azure/GCP)
7. Per-user org login (beyond today's dual-control session model — see [[03 - Control Plane]])

And underneath all of it: **the deploy pipeline itself doesn't exist yet** ([[14 - Infrastructure]] — CI runs lint/test/build, no deploy job). First production deploy is a prerequisite for everything else on this list mattering to a real customer.

## Track 2: Engine architecture migration (code boundaries, phased, incremental)

**Phase 0 — now.** One FastAPI modular monolith. Asset, Scanner, Risk, Alert, and Operations are functionally engine-shaped already (clean service boundaries, own tables) but physically live in the same codebase with no bus. Audit has just been promoted to a first-class engine on paper ([[12 - Audit Engine]]) but its code hasn't moved out of Control Plane yet. Keep building features here.

**Phase 1 — first real split, triggered by need, not the calendar.** Split out whichever of Scanner/Asset/Risk is causing the most contributor friction first (multiple people editing the same service file). Formalize [[04 - Engine Bus]] on top of the existing Celery/Redis infrastructure, using [[11 - Alert Engine]]'s `enqueue_alert` pattern as the reference. Migrate the `scan.completed` → risk-creation flow from a direct call to a published event as the first proof case, and settle the naming migration decision in [[15 - Event Contracts]] as part of this work — not before it's needed, not after the bus is already carrying traffic.

**Phase 2 — join the bus, split Audit out for real.** Remaining implemented engines (whichever of Asset/Scanner/Risk wasn't done in Phase 1, plus Alert) move onto the same event contract. This is also when [[12 - Audit Engine]]'s code actually separates from Control Plane's — the immutable-trail write path moves, the pending-action/session logic stays.

**Phase 3 — build the not-yet-started engines.** [[10 - Reporting Engine]] (seeded from the existing Risk/Audit exports), then [[09 - Compliance Engine]] (once it has stable upstream data to map controls against), then [[08 - AI Engine]] last — deliberately last, since it depends on every other engine having a stable, well-understood output shape, and because its data-residency question (see [[08 - AI Engine]]) needs to be settled before any code is written, not discovered mid-build.

**Phase 4 — full decomposition, if it's ever warranted.** Every engine takes on the approved folder standard (`api/services/repositories/models/schemas/workers/tasks/adapters/interfaces/validators/events/cache/tests/docs/` — see [[02 - Engine Registry]]), separate database schemas per engine, and every engine importing shared contracts from [[17 - Shared SDK]] instead of each other. Only pursue this if Phase 1–3 genuinely produce enough independent-team friction to justify it — several products never need to go this far, and that's fine. This phase is about code organization, not where things run — see Track 3 for that.

## Track 3: Long-term deployment topology (approved v1.0, physical — separate axis from Track 2)

Track 2 is about code boundaries; this is about where things actually execute. An engine can be a clean, fully-formed module (Track 2 done) for a long time before it has any reason to run anywhere but the same process as everything else.

**Stage 1 — where we are.** Single VPS, single FastAPI process, single Docker Compose stack.

**Stage 2 — dedicated workers, same deployment unit conceptually.** Dedicated Celery workers, dedicated AI workers, dedicated Scanner workers — separate processes/containers pulling from the same queues, still one codebase and one release.

**Stage 3 — separate deployments for the heaviest engines.** Separate AI deployment, separate Scanner deployment, separate Reporting deployment. These three are called out specifically because they're the ones most likely to need independent scaling (AI: GPU-bound; Scanner: bursty, CPU/network-heavy; Reporting: spiky, batch-shaped) — not because every engine eventually gets this treatment.

**Stage 4 — optional microservice extraction.** Only extract an engine into a true separate service if it meets one of these, per the approved plan:

- It requires independent scaling.
- It has independent deployment requirements.
- It introduces unacceptable resource contention with the rest of the platform.
- It has a separate engineering team.

Most engines will never meet any of these. That's the intended outcome, not a shortfall — see the closing principle in [[00 - Vision]]: optimize for modularity before distribution, and only distribute what genuinely needs it. [[13 - Operations Engine]] is flagged elsewhere in this vault as the most likely first Stage 3/4 candidate, precisely because it's staff-only and has no org-facing dependency to coordinate a migration around.

## What not to do

- Don't freeze feature development to do Phase 4 or Stage 4 upfront. We haven't shipped; shipping is the priority.
- Don't leave the dot.case/PascalCase event-naming split unresolved past the point Engine Bus work actually starts — see [[15 - Event Contracts]] for the two options and the requirement to pick one.
- Don't add a second message broker (Kafka, etc.) before Celery/Redis actually can't keep up.
- Don't build [[08 - AI Engine]] or [[09 - Compliance Engine]] before their upstream engines (Asset, Scanner, Risk) are stable — they'd be built against a moving target.
- Don't confuse Track 2 (code boundaries) with Track 3 (deployment topology) progress — an engine can be a perfect module and still correctly run in the same process as everything else for years.

## Related notes

[[00 - Vision]] · [[02 - Engine Registry]] · [[04 - Engine Bus]] · [[13 - Operations Engine]] · [[14 - Infrastructure]] · [[17 - Shared SDK]]
