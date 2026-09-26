import type { AgiTranscriptChunk } from "./types";

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
      // A tool row with no payload at all is a call that was never emitted.
      // Grouping it drew a card headed "tool × 1" over an empty body, and it
      // inflated the ×N count next to real calls.
      if (!(t.content ?? "").trim()) continue;
      const tool = typeof t.meta?.tool === "string" && t.meta.tool ? String(t.meta.tool) : "tool";
      const last = out[out.length - 1];
      if (last?.kind === "toolGroup" && last.tool === tool) last.runs.push(t);
      else out.push({ kind: "toolGroup", tool, runs: [t] });
    } else {
      // A chunk with no text and no meta-driven payload (an assistant row the
      // backend opened per turn and never filled, an event with no data) renders
      // as an empty bubble. Drop it here so it cannot be drawn or counted.
      const meta = (t.meta ?? {}) as Record<string, unknown>;
      if (!(t.content ?? "").trim() && !meta.kind && !meta.working_on) continue;
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

/** The job view's `open_clarification`, whichever shape the job payload is. */
function clarificationCarrier(job: unknown): Record<string, unknown> | null {
  if (!job || typeof job !== "object") return null;
  const ask = (job as Record<string, unknown>).open_clarification;
  return ask && typeof ask === "object" ? (ask as Record<string, unknown>) : null;
}

/**
 * Resolve the currently-open clarification.
 *
 * The backend publishes the ask in one of three places and all of them have to be
 * read: `session.clarification`, `session.open_clarification` and
 * `session.job.open_clarification` — the loop writes the ask into the job view
 * for the turn it belongs to. Only the first used to be read, so an ASK_OPERATOR
 * gate rendered as "Blocked — … 1 open information requests" in the turn brief
 * with no prompt to answer it, and the run stayed parked with nothing to click.
 *
 * A settled copy (status other than "open") is skipped rather than treated as
 * final: a newer ask can be sitting on the next carrier. When every carrier is
 * settled the ask is hidden; only then is the latest `clarification_needed`
 * transcript chunk consulted, as the fallback for a poll that has not yet
 * caught up with the answer.
 */
export function openClarificationFrom(
  session?: {
    clarification?: Record<string, unknown> | null;
    open_clarification?: Record<string, unknown> | null;
    /** A plain record or the typed job view — only `open_clarification` is read. */
    job?: unknown;
  } | null,
  transcript?: AgiTranscriptChunk[] | null,
  answeredClarificationId?: string | null,
): AgiClarification | null {
  const carriers = [
    session?.clarification,
    session?.open_clarification,
    clarificationCarrier(session?.job),
  ];
  let settled = false;
  for (const carrier of carriers) {
    if (!carrier || typeof carrier !== "object") continue;
    const c = normalizeClarification(carrier as Record<string, unknown>);
    if (!c.clarification_id) continue;
    // Answered recently → hide even if the session poll hasn't cleared it yet.
    if (c.clarification_id === answeredClarificationId) {
      settled = true;
      continue;
    }
    // Authoritative: an ask that is still open outranks any settled copy.
    const status = (c.status ?? "").toLowerCase();
    if (!status || status === "open") return c;
    settled = true;
  }
  if (settled) return null;
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
