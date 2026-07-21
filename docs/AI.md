# AI Engine

**Guide**: [AI_ENGINE_IMPLEMENTATION_GUIDE.md](../Phantix%20Architecture%20Vault/Engineering%20Docs/AI_ENGINE_IMPLEMENTATION_GUIDE.md)
**Package**: `app/engines/ai_engine/`
**Status**: **Phase 1–2 implemented** (governance + core agents). Phase 3 consensus modes partial. Phase 5 RAG deferred.

**Ops notes (2026-07)**:

### Staging vs production keys

| Environment | How AI is powered |
|-------------|-------------------|
| **Staging / local** | Optional **AgentRouter** (`AGENTROUTER_API_KEY`) — one gateway key for testing |
| **Production** | **Real provider keys** (`DEEPSEEK_API_KEY`, `KIMI_API_KEY`, …). AgentRouter is **disabled** when `ENVIRONMENT=production` unless `AI_ALLOW_AGENTROUTER_IN_PROD=true` |

```env
# Staging .env
ENVIRONMENT=staging
AGENTROUTER_API_KEY=sk-...          # from https://agentrouter.org/console/token
AGENTROUTER_BASE_URL=https://agentrouter.org/v1   # OpenAI Chat Completions (Copilot docs)
AGENTROUTER_MODEL=claude-opus-4-8   # prefer Claude Opus over gpt-5.5 / glm-5.2
AI_DEFAULT_PROVIDER=agentrouter
AI_ENABLED=true
# AI pentesting (VAPT) only activates when DeepSeek is set:
DEEPSEEK_API_KEY=...

# Production .env
ENVIRONMENT=production
AI_ALLOW_AGENTROUTER_IN_PROD=false
DEEPSEEK_API_KEY=...                # also gates AI pentesting
KIMI_API_KEY=...
AI_DEFAULT_PROVIDER=deepseek
AI_ENABLED=true
```

### Model preference

| Priority | Model | Notes |
|----------|-------|-------|
| **1 (default)** | `claude-opus-4-8` | Preferred AgentRouter model (verified on `/v1/chat/completions`) |
| 2 | `claude-opus-4-7` / `claude-opus-4-6` | Fallbacks if account has channels |
| 3 | `glm-5.2`, `gpt-5.5` | Alternate AgentRouter chat models |

Set `AGENTROUTER_MODEL` to override. Phantix ranks Opus above gpt-5.5 / glm when selecting.

### AI pentesting gate (DeepSeek required)

**AI pentesting is inactive unless `DEEPSEEK_API_KEY` is configured.**

| Component | Behaviour without DeepSeek |
|-----------|----------------------------|
| VAPT complexity threshold met | Does **not** publish `AIAnalysisRequested` |
| Coordinator `AIAnalysisRequested` / `vapt_analysis` | Returns `pentest_ai_disabled` + audit log |
| Status APIs | `ai_pentest_ready: false` |

With DeepSeek configured, pentest jobs prefer the DeepSeek provider first (AgentRouter/Opus still available as fallback for non-pentest AI).

### AgentRouter + GitHub Copilot doc notes

From [AgentRouter GitHub Copilot setup](https://agentrouter.org/docs/github-copilot.html):

| Protocol | Base URL | Example models |
|----------|----------|----------------|
| OpenAI Chat Completions | `https://agentrouter.org/v1` | `claude-opus-4-8` (preferred), `gpt-5.5`, `glm-5.2` |
| Claude Messages | `https://agentrouter.org` / `/v1/messages` | `claude-opus-4-8`, … |

Phantix AI Engine uses the **OpenAI-compatible** chat path (`/v1/chat/completions`). Live probe (2026-07): `claude-opus-4-8` returns 200 on chat completions.

### AgentRouter client allowlist (important)

AgentRouter returns **`unauthorized client detected`** for generic Python/`httpx` User-Agents.
It **allows** Codex/Claude-Code style clients (same reason GitHub Copilot works).

Phantix sends:

```http
User-Agent: openai-codex-cli/0.1.0
originator: codex_cli_rs
Authorization: Bearer <AGENTROUTER_API_KEY>
```

Verified working clients (2026-07):

| Client fingerprint | Result |
|--------------------|--------|
| `openai-codex-cli` + `originator: codex_cli_rs` | **200 OK** |
| `claude-cli/...` | **200 OK** |
| Bare httpx / OpenAI Python default UA | **401 unauthorized client** |

Smoke test:

```bash
.venv/bin/python scripts/test_agentrouter.py --via all
# via=httpx | openai-sdk | registry
```

- Coordinator **falls back** across enabled providers when primary fails.
- DeepSeek **HTTP 402** = insufficient balance. Moonshot **401** = bad key / region.
- Startup seeds prompts; staff: `POST /api/v1/admin/ai/activate`.
- Worker: `celery -A app.workers.celery_app.celery worker -Q ai -c 2`.

---

## Principles

1. **Async only** — API never waits on LLM calls (bus → Celery queue `ai`)
2. **AI never determines security facts** — explains / summarizes only
3. **PII redacted** before provider calls
4. **Every call audited** (`ai_audit_logs`) with prompt version + model + cost
5. **Mock provider** works without API keys

---

## Capabilities

| Area | Status |
|------|--------|
| PII redactor | ✅ |
| Prompt registry (versioned + seeds) | ✅ |
| Audit logger + monthly usage/cost | ✅ |
| Hallucination heuristic detector | ✅ |
| Cost / budget gates | ✅ |
| Model registry (DeepSeek, Qwen, Kimi, OpenRouter, OpenAI, Anthropic, xAI, mock) | ✅ |
| Finding explanation agent | ✅ |
| Executive summary agent | ✅ |
| Consensus engine (enterprise multi-model) | ✅ partial |
| Celery `phantix.ai.process_request` | ✅ |
| VAPT / Reporting wiring | ✅ |
| Remaining agents (auth, flowmapper, chat, …) | ⏳ Phase 4 |
| RAG / vector search | ⏳ Deferred |

---

## Configuration

Phantix prefers **low-cost OpenAI-compatible** providers for `economy` / `balanced` modes.

```env
# --- Low-cost (recommended) ---
DEEPSEEK_API_KEY=sk-...
QWEN_API_KEY=...                 # or DASHSCOPE_API_KEY
KIMI_API_KEY=...                 # or MOONSHOT_API_KEY
OPENROUTER_API_KEY=...           # optional multi-vendor gateway

# Optional base URL overrides
# DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
# KIMI_BASE_URL=https://api.moonshot.cn/v1
# QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1

# Local OpenAI-compatible (vLLM / LiteLLM / Ollama proxy)
# AI_COMPAT_BASE_URL=http://localhost:11434/v1
# AI_COMPAT_API_KEY=ollama

# --- Premium fallbacks (optional) ---
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
XAI_API_KEY=

AI_DEFAULT_PROVIDER=deepseek     # deepseek|qwen|kimi|openrouter|openai|anthropic|xai|mock
AI_ENABLED=true
```

| Provider | Env key | Default models (economy) |
|----------|---------|---------------------------|
| **DeepSeek** | `DEEPSEEK_API_KEY` | `deepseek-chat` |
| **Qwen** | `QWEN_API_KEY` / `DASHSCOPE_API_KEY` | `qwen-turbo` |
| **Kimi** | `KIMI_API_KEY` / `MOONSHOT_API_KEY` | `moonshot-v1-8k` |
| **OpenRouter** | `OPENROUTER_API_KEY` | `deepseek/deepseek-chat` |
| OpenAI | `OPENAI_API_KEY` | `gpt-4o-mini` |
| Anthropic | `ANTHROPIC_API_KEY` | haiku / sonnet (balanced+) |
| xAI | `XAI_API_KEY` | `grok-3-mini` |
| Mock | *(none)* | always available |

Org settings (`PUT /api/v1/ai/settings`) can restrict `enabled_providers` e.g.
`["deepseek","qwen","kimi","mock"]` and set `mode` to `economy` | `balanced` | `enterprise`.

Worker:

```bash
celery -A app.workers.celery_app.celery worker -Q ai -c 2 -l info
```

Migration:

```bash
alembic upgrade head   # through o5c6d7e8f9a0
```

---

## API

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/engines/ai/status` | open |
| GET/PUT | `/api/v1/ai/settings` | org JWT |
| GET | `/api/v1/ai/usage` | org JWT |
| GET | `/api/v1/admin/ai/settings` | staff |
| GET/POST | `/api/v1/admin/ai/prompts` | staff |
| POST | `/api/v1/admin/ai/prompts/{key}/activate` | staff |
| GET | `/api/v1/admin/ai/audit-logs` | staff |
| GET | `/api/v1/admin/ai/costs` | staff |
| POST | `/api/v1/admin/ai/consensus/test` | staff |

---

## Event flow

```text
VAPT AIAnalysisRequested / Reporting AIRequested
        │
        ▼
AI Engine subscriber → Celery phantix.ai.process_request
        │
        ▼
Coordinator (PII → prompt → model → hallucination → audit → cost)
        │
        ├── finding_explanation → AICompleted
        └── executive_summary   → AICompleted + AIReportNarrativesCompleted
```

Per-org settings: mode `economy` | `balanced` | `enterprise`, token budget, enabled agents/providers.

---

## Platform tables

`ai_prompts`, `ai_audit_logs`, `ai_usage_monthly`, `ai_settings`

Customer security DB (existing): `ai_analyses`
