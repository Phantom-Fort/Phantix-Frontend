import type { AgiTranscriptChunk } from "@/lib/types";

// ── AGI stream row model ─────────────────────────────────────────────────────
// Consecutive same-tool transcript chunks are collapsed into a single group so
// a run that calls `http_get` ten times renders as one "http_get × 10" card
// instead of ten noisy bubbles.

export type StreamRow =
  | { kind: "chunk"; t: AgiTranscriptChunk }
  | { kind: "toolGroup"; tool: string; runs: AgiTranscriptChunk[] };

export function groupStreamRows(items: AgiTranscriptChunk[]): StreamRow[] {
  const out: StreamRow[] = [];
  for (const t of items) {
    if (t.role === "tool") {
      const tool = typeof t.meta?.tool === "string" && t.meta.tool ? String(t.meta.tool) : "tool";
      const last = out[out.length - 1];
      if (last?.kind === "toolGroup" && last.tool === tool) last.runs.push(t);
      else out.push({ kind: "toolGroup", tool, runs: [t] });
    } else {
      out.push({ kind: "chunk", t });
    }
  }
  return out;
}

// ── Clarification (ASK_OPERATOR) ─────────────────────────────────────────────
// Mirrors app/engines/ai_engine/agi/schemas.py AgiClarifyRead + service payload:
//   session.clarification / session.job.open_clarification
//   { schema, clarification_id, question, options[], allow_free_text, status:"open", turn }
// and transcript chunks with meta.kind === "clarification_needed" whose
// meta.clarification carries the same payload. Answer via POST …/clarify with
// { clarification_id, answer }.

export type AgiClarification = {
  clarification_id: string;
  question: string;
  options?: string[];
  allow_free_text?: boolean;
  context?: string;
  status?: string;
  turn?: number;
};

function normalizeClarification(c: Record<string, unknown>): AgiClarification {
  return {
    clarification_id: String(c.clarification_id ?? ""),
    question: String(c.question ?? ""),
    options: Array.isArray(c.options) ? c.options.map((o) => String(o)).filter(Boolean) : undefined,
    allow_free_text: typeof c.allow_free_text === "boolean" ? c.allow_free_text : true,
    context: c.context ? String(c.context) : undefined,
    status: c.status ? String(c.status) : undefined,
    turn: typeof c.turn === "number" ? c.turn : undefined,
  };
}

/**
 * Resolve the currently-open clarification. `session.clarification` is the
 * authoritative source (the backend clears it on answer); until the session
 * poll reflects it, fall back to the latest `clarification_needed` transcript
 * chunk that has not already been answered.
 */
export function openClarificationFrom(
  session?: { clarification?: Record<string, unknown> | null } | null,
  transcript?: AgiTranscriptChunk[] | null,
  answeredClarificationId?: string | null,
): AgiClarification | null {
  const sc = session?.clarification;
  if (sc && typeof sc === "object") {
    const c = normalizeClarification(sc as Record<string, unknown>);
    // Answered recently → hide even if the session poll hasn't cleared it yet.
    if (c.clarification_id && c.clarification_id === answeredClarificationId) return null;
    // Authoritative: if the session says the ask is still open, surface it.
    if ((c.status ?? "").toLowerCase() === "open" && c.clarification_id) return c;
    if (c.clarification_id && !(c.status ?? "").toLowerCase()) return c;
    // Present but no longer open (answered/cleared) → hide.
    if ((c.status ?? "").toLowerCase() !== "open") return null;
  }
  if (Array.isArray(transcript)) {
    for (let i = transcript.length - 1; i >= 0; i--) {
      const t = transcript[i];
      const kind = String(t.meta?.kind ?? "").toLowerCase();
      if (kind === "clarification_needed" && t.meta?.clarification && typeof t.meta.clarification === "object") {
        const c = normalizeClarification(t.meta.clarification as Record<string, unknown>);
        if (c.clarification_id && c.clarification_id !== answeredClarificationId) return c;
        return null;
      }
    }
  }
  return null;
}
