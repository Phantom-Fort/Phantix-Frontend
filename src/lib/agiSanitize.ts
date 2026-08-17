// Customer-facing sanitization for AGI transcript chunks.
// Users must only see: thinking → intent restated → skill resolved → execution.
// Never expose AGI-provider internals: system prompt fragments, tool
// instruction formats, engine-call internals, forbidden appendix, skill
// playbook body_md, or raw job/progress protocol.

import type { AgiTranscriptChunk } from "./types";

const PROVIDER_PATTERNS: RegExp[] = [
  /\[engine\]/i,
  /ENGINE_CALL\s*:/i,
  /REQUEST_TOOL\s*:/i,
  /PROPOSE_STATE/i,
  /JOB_DONE\s*:/i,
  /JOB_BLOCKED\s*:/i,
  /JOB_CONTINUE\s*:/i,
  /REQUEST_INFO\s*:/i,
  /TOOL\s+(skill_search|skill_load|engine_call|mailinator|auth_|shell|bg_shell)/i,
  /FORBIDDEN_SYSTEM_APPENDIX/i,
  /forbidden\.md/i,
  /opencode_contract/i,
  /ALLOWLIST\s*:/i,
  /FORBIDDEN_ACTIONS\s*:/i,
  /ENGINE_CONTEXT_JSON/i,
  /ENGINE_OPS/i,
  /ENGINE_LEARNING/i,
  /AUTONOMY=/i,
  /ORG_ASSETS/i,
  /You are PHANTIX AGI/i,
];

export function sanitizeAgiContent(content: string): string {
  if (!content) return content;
  let out = content;
  for (const re of PROVIDER_PATTERNS) {
    out = out.replace(re, "…");
  }
  // Strip fenced agi-tool / agi-job JSON blocks (provider tool protocol).
  out = out.replace(/```agi-(tool|job)[\s\S]*?```/g, "…");
  return out.trim();
}

export function sanitizeAgiChunk(chunk: AgiTranscriptChunk): AgiTranscriptChunk {
  const content = sanitizeAgiContent(chunk.content);
  if (content === chunk.content) return chunk;
  return { ...chunk, content };
}

export function sanitizeAgiChunks(chunks: AgiTranscriptChunk[]): AgiTranscriptChunk[] {
  return chunks.map(sanitizeAgiChunk);
}
