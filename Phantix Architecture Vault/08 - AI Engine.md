Tags: #engine #ai #future

# AI Engine

Status: 🔴 Not started. This note is design intent only — do not treat anything below as shipped.

## Boundary rule (v1.0)

**AI Engine runs entirely as background workers. API requests must never wait for AI completion.** This is a hard constraint, not a performance preference — no endpoint should synchronously call an LLM and block on the response. The pattern to follow is the same request → queue → poll/webhook shape [[06 - Scanner Engine]] already uses for scans (`run_inline` aside — that's an MVP convenience Scanner Engine has and AI Engine should skip in favor of async-only from day one, given how much slower and less predictable model calls are than tool execution).

## What exists today

One thing: an `ai_analyses` table already exists in the security schema DDL (created during `security_data_storage` bootstrap, alongside `assets`, `findings`, `compliance_evidence`, etc.). Nothing writes to it yet. That's the entire footprint of AI in the codebase right now — the schema anticipated this engine before any service code did.

## Target scope (approved v1.0)

| Sub-component | Notes |
|---|---|
| LLM | Model access layer — provider-agnostic if possible, given how fast this space moves |
| RAG | Retrieval over scan results, risk history, compliance evidence |
| Prompt Templates | Versioned, not inlined in code |
| Vector Search | Needs a decision: pgvector in the customer's security DB (keeps data residency intact) vs. a separate vector store (breaks the hybrid privacy model unless carefully scoped) |
| Knowledge Base | Internal security knowledge, not customer data |
| Finding Explanation | Plain-language layer over a single `scan_result` |
| Root Cause | Analysis over `scan_results` + `risk_history` |
| Attack Path Generation | Correlates findings across assets into a chained attack narrative — one of the more research-heavy items here |
| Remediation | Suggested treatments — must integrate with [[07 - Risk Engine]]'s existing `priority_factors` explainability, not replace it with an opaque suggestion |
| Executive / Technical Summaries | Natural-language layer on top of [[10 - Reporting Engine]] output, audience-specific |
| Natural Language Search | Query interface over an org's own asset/scan/risk data |
| Threat Intelligence Correlation | External feed correlation against [[05 - Asset Engine]] inventory |
| Chat | Conversational interface over an org's own security data |
| Memory | Session/context persistence — needs its own residency decision, same as Vector Search |
| Recommendations | Cross-cutting — likely the last piece built, since it depends on most of the above |

## The hard constraint this engine inherits

Every other engine in Phantix respects the rule in [[01 - Platform Architecture]]: security data lives only in the customer's database, never Phantix's platform DB. AI Engine is the first domain where that gets genuinely difficult — RAG and vector search typically want an embeddings index, and if that index lives outside the customer's database, it's a quiet violation of the hybrid privacy model even if the underlying text is paraphrased.

**Resolve this before writing any AI Engine code**, not after: either embeddings live inside the customer's security DB (pgvector extension, same residency guarantee as everything else), or Phantix defines an explicit, disclosed exception to the model. Retrofitting data residency onto an AI feature after customers are already using it is a much worse conversation than deciding it up front.

## Why this is last on the roadmap

Every other engine (Asset, Scanner, Risk, Alert) produces the data AI Engine would consume. Building this before those are stable means building against a moving target. See [[16 - Deployment Roadmap]] — this is explicitly a post-MVP engine.

## Related notes

[[02 - Engine Registry]] · [[07 - Risk Engine]] · [[10 - Reporting Engine]] · [[01 - Platform Architecture]]
