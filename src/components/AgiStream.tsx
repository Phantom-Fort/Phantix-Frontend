import React, { memo, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight, Bot, BrainCircuit, Check, ChevronDown, ChevronRight, Clock, Copy, Crosshair, HelpCircle, Loader2, Radar, Send, ShieldAlert, ShieldCheck, Terminal, User,
} from "lucide-react";
import { Markdown } from "@/components/prompt-kit/markdown";
import { Tool } from "@/components/prompt-kit/tool";
import { Reasoning, ReasoningTrigger, ReasoningContent } from "@/components/prompt-kit/reasoning";
import { TextShimmer } from "@/components/prompt-kit/text-shimmer";
import { linkify } from "@/lib/linkify";
import { normalizeAgiMarkdown } from "@/lib/agiMarkdown";
import { personaForChunk, PHASE_ACTIVITY, PHASE_ACTIVITY_BY_ID, activityFor, type AgentPersona, type AttackPhase } from "@/lib/agiGraph";
import type { AgiTranscriptChunk, Severity } from "@/lib/types";
import { cx } from "@/lib/utils";

// ── Shared live-stream primitives for the Autonomous Pentest Agent console ────
// Used by the fullscreen operator console (AgiConsole) and the compact drawer
// stream (AgiWorkspace) so both surfaces render messages, tool calls, engine
// events, and the working indicator identically.

const PERSONA_META: Record<AgentPersona, { label: string; tint: string }> = {
  orchestrator: { label: "Phantix Autonomous Agent", tint: "text-gold-300" },
  recon: { label: "Recon agent", tint: "text-severity-low" },
  exploit: { label: "Web exploit agent", tint: "text-severity-high" },
};

const SEV_DOT: Record<Severity, string> = {
  critical: "bg-severity-critical",
  high: "bg-severity-high",
  medium: "bg-severity-medium",
  low: "bg-severity-low",
  info: "bg-severity-info",
};

export function streamTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function StreamCaret() {
  return <span className="ml-0.5 inline-block h-3 w-[6px] animate-pulse rounded-sm bg-gold-400/70 align-middle" />;
}

// ── Turn brief (loop progress) ───────────────────────────────────────────────
// The backend streams a verbose "Turn X of 100. Loop phase: recon…" status
// block after every loop iteration. We parse the stable section headings into a
// compact, readable card so the operator sees a clean turn summary instead of a
// wall of raw engine copy.
interface TurnBrief {
  turn?: number;
  total?: number;
  phase?: string;
  status?: string;
  workingOn?: string;
  happened?: string;
  found: string[];
  next: string[];
  blocked: string[];
  tools: string[];
  totals?: string;
  note?: string;
}

export function parseTurnBrief(content: string): TurnBrief | null {
  if (!/Turn\s+\d+\s+of\s+\d+/i.test(content)) return null;
  const turn = content.match(/Turn\s+(\d+)\s+of\s+(\d+)/i);
  const phase = content.match(/Loop phase:\s*([\w\s-]+)/i)?.[1]?.trim();
  const status = content.match(/Job status:\s*(\w+)/i)?.[1];
  const note = content.match(/Loop note:\s*(.+)/i)?.[1]?.trim();
  const totals = content.match(/Running totals:\s*(.+)/i)?.[1]?.trim();

  // Split the body into sections keyed by their heading; each heading starts on
  // its own line and the section runs until the next known heading or EOF.
  const HEADINGS = [
    "What this turn worked on",
    "Working on",
    "What happened",
    "What was found",
    "What still needs work",
    "What is blocked",
    "Tools used this turn",
    "Running totals",
    "Loop note",
  ];
  const grab = (heading: string): string => {
    const hIdx = content.indexOf(heading);
    if (hIdx < 0) return "";
    const start = content.indexOf("\n", hIdx) + 1;
    let end = content.length;
    for (const other of HEADINGS) {
      if (other === heading) continue;
      const idx = content.indexOf(other, hIdx + heading.length);
      if (idx > start && idx < end) end = idx;
    }
    return content.slice(start, end).trim();
  };

  const bullets = (s: string): string[] =>
    s
      .split(/\n/)
      .map((l) => l.replace(/^[○•-]\s*/, "").trim())
      .filter(Boolean);

  const workingOn = grab("Working on");

  return {
    turn: turn ? Number(turn[1]) : undefined,
    total: turn ? Number(turn[2]) : undefined,
    phase,
    status,
    workingOn: workingOn || undefined,
    happened: grab("What happened") || undefined,
    found: bullets(grab("What was found")),
    next: bullets(grab("What still needs work")),
    blocked: bullets(grab("What is blocked")),
    tools: bullets(grab("Tools used this turn")),
    totals,
    note,
  };
}

export function TurnBriefCard({ content, dense = false }: { content: string; dense?: boolean }) {
  const b = useMemo(() => parseTurnBrief(content), [content]);
  const [open, setOpen] = useState(false);
  if (!b) return null;

  const phaseKey = (b.phase ?? "").toLowerCase().trim() as AttackPhase;
  const activity = PHASE_ACTIVITY[phaseKey] ?? "Working on it";

  return (
    <div className={cx("group w-full min-w-0 overflow-hidden rounded-xl border border-phantix-700/40 bg-phantix-900/50", dense ? "max-w-full" : "max-w-[94%]")}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cx("flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-phantix-800/40", dense ? "py-1.5" : "py-2")}
      >
        <span className={cx("flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-gold-400/25 bg-gold-400/10 text-gold-300", dense ? "h-5 w-5" : "")}>
          <Radar size={12} />
        </span>
        <span className="min-w-0 flex-1">
          <span className={cx("block truncate font-semibold text-slate-200", dense ? "text-[11px]" : "text-xs")}>
            {activity}
            {b.workingOn ? <span className="text-slate-400"> — {b.workingOn}</span> : null}
          </span>
          <span className={cx("block text-[10px] text-slate-500", dense ? "hidden" : "")}>
            {b.turn ? `Turn ${b.turn}${b.total ? ` of ${b.total}` : ""}` : "Turn"}
            {b.phase ? ` · ${b.phase}` : ""}
            {b.status ? ` · ${b.status}` : ""}
            {b.totals ? ` · ${b.totals}` : ""}
          </span>
        </span>
        <span className={cx("shrink-0 text-slate-500 transition-transform", open && "rotate-180")}>
          <ChevronDown size={12} />
        </span>
      </button>

      {open && (
        <div className="space-y-2.5 border-t border-phantix-700/30 px-3 py-2.5">
          {b.workingOn && (
            <p className={cx("font-medium text-slate-200", dense ? "text-[11px]" : "text-xs")}>
              Working on: <span className="font-normal text-slate-300">{b.workingOn}</span>
            </p>
          )}
          {b.happened && (
            <p className={cx("leading-relaxed text-slate-400", dense ? "text-[10px]" : "text-[11px]")}>{b.happened}</p>
          )}
          {b.found.length > 0 && (
            <BriefSection title="What was found" items={b.found} dense={dense} accent="text-emerald-300" />
          )}
          {b.next.length > 0 && <BriefSection title="Still to do" items={b.next} dense={dense} />}
          {b.blocked.length > 0 && (
            <BriefSection title="Blocked" items={b.blocked} dense={dense} accent="text-severity-medium" />
          )}
          {b.tools.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={cx("font-semibold uppercase tracking-wider text-slate-500", dense ? "text-[9px]" : "text-[10px]")}>Tools</span>
              {b.tools.map((t, i) => (
                <span key={i} className="chip !px-1.5 !py-0 font-mono text-[10px] text-gold-300">{t}</span>
              ))}
            </div>
          )}
          {b.note && <p className={cx("text-slate-500", dense ? "text-[10px]" : "text-[11px]")}>Loop note: {b.note}</p>}
        </div>
      )}
      <CopyBtn text={content} className="absolute right-2 top-2 z-10 !opacity-0 group-hover:!opacity-100" />
    </div>
  );
}

function BriefSection({ title, items, dense = false, accent }: { title: string; items: string[]; dense?: boolean; accent?: string }) {
  return (
    <div>
      <p className={cx("font-semibold uppercase tracking-wider text-slate-500", dense ? "text-[9px]" : "text-[10px]")}>{title}</p>
      <ul className={cx("mt-1 space-y-1", dense ? "text-[10px]" : "text-[11px]")}>
        {items.slice(0, 6).map((it, i) => (
          <li key={i} className="flex items-start gap-1.5 leading-relaxed text-slate-300">
            <span className={cx("mt-1.5 h-1 w-1 shrink-0 rounded-full", accent ?? "bg-slate-500")} />
            <span className="min-w-0 break-words">{linkify(it)}</span>
          </li>
        ))}
        {items.length > 6 && <li className="text-slate-500">+{items.length - 6} more</li>}
      </ul>
    </div>
  );
}

export function CopyBtn({ text, className }: { text: string; className?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      aria-label="Copy message"
      title="Copy"
      onClick={(e) => {
        e.stopPropagation();
        try { void navigator.clipboard?.writeText(text); } catch { /* clipboard unavailable */ }
        setOk(true);
        window.setTimeout(() => setOk(false), 1200);
      }}
      className={cx(
        "rounded-md p-1 text-slate-500 opacity-0 transition-opacity duration-150 hover:bg-phantix-800 hover:text-slate-200 group-hover:opacity-100",
        ok && "!opacity-100 !text-emerald-400",
        className,
      )}
    >
      {ok ? <Check size={11} /> : <Copy size={11} />}
    </button>
  );
}

// ── Tool call / tool output ───────────────────────────────────────────────────

const CMD_RE = /^[a-z_][\w.-]*(\s+\S+)+$/i;

function prettyJson(raw: string): string | null {
  const s = raw.trim();
  if (!s.startsWith("{") && !s.startsWith("[")) return null;
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return null;
  }
}

function ToolCallCard({ t, dense = false }: { t: AgiTranscriptChunk; dense?: boolean }) {
  const toolName = typeof t.meta?.tool === "string" ? (t.meta.tool as string) : "tool";

  // First line that looks like a shell command becomes the "Input"; the rest is output.
  const { command, body } = useMemo(() => {
    const lines = t.content.split("\n");
    if (lines.length === 1) return { command: lines[0].trim(), body: "" };
    const first = lines[0].trim();
    const looksLikeCmd = first.length > 0 && first.length <= 200 && CMD_RE.test(first) && !first.startsWith("{");
    return { command: looksLikeCmd ? first : "", body: looksLikeCmd ? lines.slice(1).join("\n") : lines.join("\n") };
  }, [t.content]);

  const pretty = useMemo(() => (body ? prettyJson(body) : null), [body]);
  const output = pretty ?? body;

  return (
    <div className="group relative min-w-0">
      <Tool
        defaultOpen={!dense}
        toolPart={{
          type: toolName,
          state: "output-available",
          input: command ? { command } : undefined,
          output: output ? { output } : undefined,
        }}
        className={cx(
          "mt-0 border-phantix-700/40 bg-phantix-950/70",
          dense ? "[&_pre]:!max-h-32 [&_*]:!text-[11px]" : "[&_pre]:!max-h-60",
        )}
      />
      <CopyBtn text={t.content} className="absolute right-2 top-2 z-10 !opacity-0 group-hover:!opacity-100" />
    </div>
  );
}

// Split a tool chunk's content into an optional command line + the output body.
export function splitToolContent(content: string): { command: string; body: string } {
  const lines = (content ?? "").split("\n");
  if (lines.length === 1) return { command: lines[0].trim(), body: "" };
  const first = lines[0].trim();
  const looksLikeCmd = first.length > 0 && first.length <= 200 && CMD_RE.test(first) && !first.startsWith("{");
  return { command: looksLikeCmd ? first : "", body: looksLikeCmd ? lines.slice(1).join("\n") : lines.join("\n") };
}

// ── Grouped tool calls ───────────────────────────────────────────────────────
// Consecutive runs of the same tool collapse into one expandable card
// ("http_get × 10") so a busy pipeline doesn't spam the timeline with a card
// per invocation. Output is linkified so URLs are clickable.
export function ToolGroupCard({
  tool,
  runs,
  dense = false,
}: {
  tool: string;
  runs: AgiTranscriptChunk[];
  dense?: boolean;
}) {
  const [open, setOpen] = useState(runs.length <= 1);
  const count = runs.length;
  const totalText = useMemo(() => runs.map((r) => r.content).join("\n"), [runs]);
  return (
    <div className="group relative min-w-0 overflow-hidden rounded-xl border border-phantix-700/40 bg-phantix-950/70">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cx(
          "flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-phantix-900/60",
          dense && "px-2 py-1.5",
        )}
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-phantix-800/80 text-gold-400">
          <Terminal size={11} />
        </span>
        <span className={cx("truncate font-mono font-semibold text-slate-200", dense ? "text-[11px]" : "text-xs")}>{tool}</span>
        <span className="chip shrink-0 !px-1.5 !py-0 font-mono text-[10px] text-gold-300">× {count}</span>
        <span className={cx("ml-auto shrink-0 text-slate-500 transition-transform", open && "rotate-180")}>
          <ChevronDown size={12} />
        </span>
      </button>
      {open && (
        <div className={cx("wb-scroll space-y-1.5 overflow-y-auto border-t border-phantix-700/30", dense ? "max-h-40 px-2 py-1.5" : "max-h-72 px-3 py-2")}>
          {runs.map((r, i) => {
            const { command, body } = splitToolContent(r.content);
            const output = body || command;
            return (
              <div key={i} className="rounded-lg bg-phantix-900/50 px-2.5 py-1.5">
                {command && <p className={cx("font-mono text-slate-500", dense ? "text-[10px]" : "text-[11px]")}>{linkify(command, "text-gold-300/90 break-all hover:text-gold-200")}</p>}
                {output && (
                  <p className={cx("whitespace-pre-wrap break-words font-mono leading-5 text-slate-300", dense ? "text-[10px]" : "text-[11px]")}>
                    {linkify(output)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
      <CopyBtn text={totalText} className="absolute right-2 top-2 z-10 !opacity-0 group-hover:!opacity-100" />
    </div>
  );
}

// ── Agent clarification ask (ASK_OPERATOR) ───────────────────────────────────
// Renders while the backend has an open clarification (session.clarification
// status "open" / meta.kind "clarification_needed"). Optional option chips
// submit directly; free text goes through the input. The answer is POSTed to
// /agi/sessions/{id}/clarify as { clarification_id, answer }, which resumes the
// loop (clarification_answered → loop_status / working_on again).
export function ClarificationAsk({
  clarification,
  onAnswer,
  busy = false,
  dense = false,
}: {
  clarification: { clarification_id: string; question: string; options?: string[]; allow_free_text?: boolean };
  onAnswer: (clarificationId: string, answer: string) => void;
  busy?: boolean;
  dense?: boolean;
}) {
  const [text, setText] = useState("");
  const submit = (answer: string) => {
    const a = answer.trim();
    if (!a || busy) return;
    onAnswer(clarification.clarification_id, a);
    setText("");
  };
  const options = clarification.options ?? [];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cx("rounded-xl border border-gold-400/30 bg-gold-400/5 p-3", dense ? "max-w-full" : "max-w-[94%]")}
    >
      <p className="flex items-center gap-1.5 text-xs font-semibold text-gold-200">
        <HelpCircle size={13} /> Agent needs a clarification
      </p>
      <p className="mt-1.5 text-sm leading-6 text-slate-200">{linkify(clarification.question)}</p>
      {options.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {options.map((o) => (
            <button
              key={o}
              type="button"
              disabled={busy}
              onClick={() => submit(o)}
              className="rounded-full border border-gold-400/40 bg-gold-400/10 px-2.5 py-1 text-xs font-medium text-gold-200 transition-colors hover:bg-gold-400/20 disabled:opacity-50"
            >
              {o}
            </button>
          ))}
        </div>
      )}
      {clarification.allow_free_text !== false && (
        <div className="mt-2 flex items-center gap-2">
          <input
            className="input flex-1 !py-1.5 text-xs"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && text.trim() && !busy) submit(text); }}
            placeholder="Type your answer…"
            disabled={busy}
          />
          <button className="btn-primary !px-3 !py-1.5 wb-xs" disabled={!text.trim() || busy} onClick={() => submit(text)}>
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Reply
          </button>
        </div>
      )}
    </motion.div>
  );
}

// ── Inline issues strip ──────────────────────────────────────────────────────
// Lists verified/candidate findings compactly with a link out to the findings
// tracker. Used by the drawer so issues are visible without the full console.
export function IssuesStrip({
  findings,
  href,
}: {
  findings: Array<{ title: string; severity?: string; status?: string; cve?: string; target?: string }>;
  href: string;
}) {
  if (!findings || findings.length === 0) return null;
  return (
    <div className="rounded-xl border border-phantix-700/40 bg-phantix-900/50 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Issues found ({findings.length})
        </p>
        <a href={href} className="text-[10px] font-medium text-gold-300 underline decoration-gold-400/40 underline-offset-2 hover:text-gold-200">
          Open tracker →
        </a>
      </div>
      <div className="mt-1.5 space-y-1">
        {findings.slice(0, 8).map((f, i) => {
          const sev = (f.severity ?? "info").toLowerCase() as Severity;
          return (
            <a
              key={i}
              href={href}
              className="flex items-center gap-2 rounded-lg bg-phantix-950/50 px-2 py-1 text-xs transition-colors hover:bg-phantix-800/50"
            >
              <span className={cx("h-1.5 w-1.5 shrink-0 rounded-full", SEV_DOT[sev] ?? "bg-slate-500")} />
              <span className="min-w-0 flex-1 truncate text-slate-300">{f.title}</span>
              {f.cve && <span className="shrink-0 font-mono text-[9px] text-gold-400">{f.cve}</span>}
            </a>
          );
        })}
      </div>
    </div>
  );
}

// ── Engine / system events ────────────────────────────────────────────────────

const FINDING_RE = /^(.*?)\[(critical|high|medium|low|info)\]\s*:?\s*(.*)$/i;

function SystemLine({ t, dense = false }: { t: AgiTranscriptChunk; dense?: boolean }) {
  const time = streamTime(t.created_at);
  const m = t.content.match(FINDING_RE);
  const sev = (m?.[2]?.toLowerCase() ?? null) as Severity | null;
  const isFinding = !!m && /finding/i.test(m[1] ?? "");

  if (isFinding && sev) {
    return (
      <div className="group flex justify-start">
        <div className="flex max-w-[94%] items-start gap-2 rounded-xl border border-phantix-700/30 bg-phantix-900/50 px-2.5 py-1.5">
          <ShieldAlert size={12} className={cx("mt-0.5 shrink-0", sev === "critical" ? "text-severity-critical" : sev === "high" ? "text-severity-high" : sev === "medium" ? "text-severity-medium" : "text-slate-500")} />
          <p className={cx("min-w-0 font-mono leading-5 text-slate-400", dense ? "wb-xs" : "wb-sm")}>
            <span className="mr-1.5 inline-flex items-center gap-1 font-semibold capitalize">
              <span className={cx("h-1.5 w-1.5 rounded-full", SEV_DOT[sev])} />
              {sev}
            </span>
            <span className="break-words">{m[3]}</span>
            {time && <span className="wb-2xs ml-1.5 tabular-nums text-slate-600">{time}</span>}
          </p>
        </div>
      </div>
    );
  }

  // Engine boot / skill-plan / job-objectives dumps are verbose; collapse them
  // into a compact, expandable summary card so the stream stays scannable.
  const isPlan = /engineSession started|## Skill plan|## Job objectives/i.test(t.content);
  if (isPlan) {
    return <PlanCard content={t.content} dense={dense} time={time} />;
  }

  return (
    <div className="group flex justify-start">
      <p className={cx("max-w-[94%] font-mono leading-5 text-slate-500", dense ? "wb-xs" : "wb-sm")}>
        <span className="wb-2xs mr-1.5 inline-flex items-center gap-1 rounded border border-phantix-700/40 bg-phantix-900/60 px-1 py-px font-sans font-semibold uppercase tracking-wider text-slate-500">
          <Radar size={8} /> engine
        </span>
        <span className="whitespace-pre-wrap break-words">{t.content}</span>
        {time && <span className="wb-2xs ml-1.5 tabular-nums text-slate-600">{time}</span>}
      </p>
    </div>
  );
}

/** Compact, expandable card for the engine's verbose boot/skill/job plan dump. */
function PlanCard({ content, dense = false, time }: { content: string; dense?: boolean; time?: string }) {
  const [open, setOpen] = useState(false);
  const summary = useMemo(() => {
    const line = content
      .split(/\n/)
      .map((l) => l.trim())
      .find((l) => /engineSession started|objective|skill plan|job objectives/i.test(l));
    return line ?? content.split("\n")[0]?.trim() ?? "Engine plan";
  }, [content]);
  const skillCount = (content.match(/^[0-9]+\.\s+\S+/gm) ?? []).length;
  const objectiveCount = (content.match(/^\[[ xX]\]/gm) ?? []).length;

  return (
    <div className={cx("group w-full min-w-0 overflow-hidden rounded-xl border border-phantix-700/40 bg-phantix-900/50", dense ? "max-w-full" : "max-w-[94%]")}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cx("flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-phantix-800/40", dense ? "py-1.5" : "py-2")}
      >
        <span className={cx("flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-phantix-700/40 bg-phantix-900/70 text-gold-300", dense ? "h-5 w-5" : "")}>
          <Radar size={12} />
        </span>
        <span className="min-w-0 flex-1">
          <span className={cx("block truncate font-semibold text-slate-200", dense ? "text-[11px]" : "text-xs")}>{summary}</span>
          <span className={cx("block text-[10px] text-slate-500", dense && "hidden")}>
            {skillCount > 0 && `${skillCount} skill${skillCount === 1 ? "" : "s"}`}
            {objectiveCount > 0 && `${skillCount > 0 ? " · " : ""}${objectiveCount} objectives`}
            {time ? ` · ${time}` : ""}
          </span>
        </span>
        <span className={cx("shrink-0 text-slate-500 transition-transform", open && "rotate-180")}>
          <ChevronDown size={12} />
        </span>
      </button>
      {open && (
        <div className="wb-scroll max-h-72 overflow-y-auto border-t border-phantix-700/30 px-3 py-2.5">
          <pre className={cx("whitespace-pre-wrap break-words font-mono leading-5 text-slate-400", dense ? "text-[10px]" : "text-[11px]")}>{content}</pre>
        </div>
      )}
    </div>
  );
}

// ── Pi mid-turn helpers (pi_subagent) ────────────────────────────────────────
// The runner delegates bounded helper tasks to a headless `pi` process. The FE
// sees a tool row (meta.tool "pi_subagent") plus a `[PI_SUBAGENT …]` observe
// line in history. Helpers render as compact cards — never as full bubbles —
// and soft-fails are warnings, not session errors. Max 2 run concurrently.

const PI_SOFT_FAIL = /pi_not_installed|pi_auth_required|pi_timeout|pi_failed|pi_spawn_failed|task_required/i;

function piMeta(t: AgiTranscriptChunk): {
  profile: string;
  task: string;
  result: string;
  resultLine: string | null;
  failed: boolean;
  error: string | null;
  message: string | null;
  latencyMs: number | null;
  tools: string | null;
} {
  const meta = (t.meta ?? {}) as Record<string, unknown>;
  const content = t.content ?? "";
  const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
  const resultLine = lines.find((l) => /^RESULT:/i.test(l)) ?? null;
  const error = typeof meta.error === "string" && meta.error ? meta.error : content.match(/\berror=([\w-]+)/i)?.[1] ?? null;
  const failed = meta.ok === false || Boolean(error && PI_SOFT_FAIL.test(error)) || PI_SOFT_FAIL.test(content);
  const task =
    (typeof meta.task === "string" && meta.task) ||
    content.match(/task='([^']*)'/i)?.[1] ||
    content.match(/task="([^"]*)"/i)?.[1] ||
    lines.find((l) => !/^RESULT:/i.test(l) && !/^\[PI_SUBAGENT/i.test(l)) ||
    "Helper task";
  return {
    profile: (typeof meta.profile === "string" && meta.profile) || content.match(/profile=(\w+)/i)?.[1] || "helper",
    task: task.replace(/^(Task|Helper task):\s*/i, "").trim() || "Helper task",
    result: (typeof meta.result_text === "string" && meta.result_text) || (resultLine ? content : ""),
    resultLine,
    failed,
    error,
    message: (typeof meta.message === "string" && meta.message) || null,
    latencyMs: typeof meta.latency_ms === "number" ? (meta.latency_ms as number) : Number(content.match(/latency_ms=(\d+)/i)?.[1] ?? NaN) || null,
    tools: (typeof meta.tools === "string" && meta.tools) || content.match(/tools=([^\s\]]+)/i)?.[1] || null,
  };
}

function PiHelperCard({ t, dense = false, observe = false }: { t: AgiTranscriptChunk; dense?: boolean; observe?: boolean }) {
  const [open, setOpen] = useState(false);
  const p = useMemo(() => piMeta(t), [t.content]);
  const title = p.profile === "scout" ? "Pi scout" : "Pi helper";
  const accent = p.failed
    ? { ring: "border-severity-medium/40 bg-severity-medium/[0.06]", icon: "bg-severity-medium/15 text-severity-medium", Icon: ShieldAlert }
    : { ring: "border-phantix-700/40 bg-phantix-900/50", icon: "bg-phantix-800/80 text-gold-400", Icon: Bot };

  return (
    <div className={cx("group relative min-w-0 overflow-hidden rounded-xl border", dense ? "max-w-full" : "max-w-[94%]", accent.ring)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cx("flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-phantix-800/40", dense ? "py-1.5" : "py-2")}
      >
        <span className={cx("flex h-6 w-6 shrink-0 items-center justify-center rounded-md", dense ? "h-5 w-5" : "", accent.icon)}>
          <accent.Icon size={12} />
        </span>
        <span className="min-w-0 flex-1">
          <span className={cx("flex items-center gap-1.5", dense ? "text-[11px]" : "text-xs")}>
            <span className="truncate font-semibold text-slate-200">{title}</span>
            <span className="chip shrink-0 !px-1.5 !py-0 font-mono text-[9px] uppercase text-slate-400">{p.profile}</span>
            {p.latencyMs != null && <span className="shrink-0 font-mono text-[9px] tabular-nums text-slate-500">{(p.latencyMs / 1000).toFixed(1)}s</span>}
          </span>
          <span className={cx("block truncate text-slate-400", dense ? "text-[10px]" : "wb-xs")}>
            {p.failed && p.error
              ? `Helper unavailable (${p.error}) — the main agent continues.`
              : observe
                ? "Helper result attached"
                : p.task}
          </span>
        </span>
        <span className={cx("shrink-0 text-slate-500 transition-transform", open && "rotate-180")}>
          <ChevronDown size={12} />
        </span>
      </button>
      {open && (
        <div className="space-y-2 border-t border-phantix-700/30 px-3 py-2.5">
          {p.task && <p className={cx("leading-relaxed text-slate-300", dense ? "text-[10px]" : "wb-xs")}>{p.task}</p>}
          {p.failed && p.message && (
            <p className={cx("leading-relaxed text-severity-medium", dense ? "text-[10px]" : "wb-xs")}>{p.message}</p>
          )}
          {(p.result || p.resultLine) && (
            <pre className={cx("wb-scroll overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-phantix-700/40 bg-phantix-950/70 p-2 font-mono leading-5 text-slate-300", dense ? "text-[10px]" : "text-[11px]")}>
              {p.resultLine ?? p.result}
            </pre>
          )}
          {p.tools && (
            <p className="font-mono text-[10px] text-slate-500">tools: {p.tools}</p>
          )}
        </div>
      )}
      <CopyBtn text={t.content} className="absolute right-2 top-2 z-10 !opacity-0 group-hover:!opacity-100" />
    </div>
  );
}

// ── Message renderer ──────────────────────────────────────────────────────────

export type StreamMessageProps = {
  t: AgiTranscriptChunk;
  /** Show the streaming caret (last live chunk while the loop runs). */
  last?: boolean;
  /** Compact chrome for swimlane columns. */
  dense?: boolean;
};

export const StreamMessage = memo(function StreamMessage({ t, last = false, dense = false }: StreamMessageProps) {
  const time = streamTime(t.created_at);

  if (t.role === "tool") {
    // Pi mid-turn helpers render as compact cards, not generic tool dumps.
    if (t.meta?.tool === "pi_subagent") {
      return (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="flex justify-start"
        >
          <PiHelperCard t={t} dense={dense} />
        </motion.div>
      );
    }
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="flex justify-start"
      >
        <div className={cx("min-w-0", dense ? "w-full" : "max-w-[94%]")}>
          <ToolCallCard t={t} dense={dense} />
        </div>
      </motion.div>
    );
  }

  // `[PI_SUBAGENT …]` observe lines injected into history are redundant with the
  // structured helper cards — collapse them so the timeline stays scannable.
  if (/^\s*\[PI_SUBAGENT\b/i.test(t.content)) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.16, ease: "easeOut" }}
        className="flex justify-start"
      >
        <PiHelperCard t={t} dense={dense} observe />
      </motion.div>
    );
  }

  if (t.role === "system") {
    return (
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, ease: "easeOut" }}>
        <SystemLine t={t} dense={dense} />
      </motion.div>
    );
  }

  if (t.role === "operator") {
    const sending = t.seq === -1;
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="group flex justify-end"
      >
        <div className={cx("min-w-0", dense ? "max-w-full" : "max-w-[85%]")}>
          <p className="wb-2xs mb-0.5 flex items-center justify-end gap-1.5 px-0.5 text-slate-500">
            {sending && (
              <span className="flex items-center gap-1 text-gold-400/80">
                <Loader2 size={9} className="animate-spin" /> sending…
              </span>
            )}
            <User size={9} className="text-gold-400/70" />
            <span className="font-semibold uppercase tracking-wider text-gold-300/80">You</span>
            {time && <span className="tabular-nums">{time}</span>}
          </p>
          <div
            className={cx(
              "wb-base rounded-xl rounded-tr-sm border border-gold-400/25 bg-gold-400/12 px-3 py-2 text-gold-100 shadow-sm",
              sending && "animate-pulse",
            )}
          >
            <span className="whitespace-pre-wrap break-words">{t.content}</span>
          </div>
        </div>
      </motion.div>
    );
  }

  // assistant (default)
  const persona = PERSONA_META[personaForChunk(t)];
  const kind = String(t.meta?.kind ?? "").toLowerCase();

  // Loop-progress turn briefs render as a compact status card instead of a raw
  // markdown wall ("Turn X of 100. Loop phase: recon…").
  if (/Turn\s+\d+\s+of\s+\d+/i.test(t.content) && /(Loop phase|Job status|Working on|What happened)/i.test(t.content)) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="flex justify-start"
      >
        <TurnBriefCard content={t.content} dense={dense} />
      </motion.div>
    );
  }

  // Turn-start rows (meta.kind === "turn_start") are a live banner, not a
  // message — render them as a slim status line that says what is happening now.
  if (kind === "turn_start") {
    const working = String(t.meta?.working_on ?? "").replace(/^Working on:\s*/i, "").trim() || t.content.trim();
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.16, ease: "easeOut" }}
        className="flex items-center gap-2 py-0.5 pl-0.5"
      >
        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-gold-400/25 bg-gold-400/10 text-gold-300">
          <Radar size={9} />
        </span>
        <p className={cx("min-w-0 flex-1 truncate font-medium text-slate-400", dense ? "text-[10px]" : "wb-xs")}>
          {working}
          {time && <span className="ml-1.5 tabular-nums text-slate-600">{time}</span>}
        </p>
      </motion.div>
    );
  }

  // Model reasoning streams (meta.kind === "reasoning") are ephemeral garnish —
  // collapsible, muted, never competing with the answer.
  if (kind === "reasoning") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.16, ease: "easeOut" }}
        className={cx("min-w-0", dense ? "max-w-full" : "max-w-[92%]")}
      >
        <Reasoning className="rounded-xl border border-phantix-700/30 bg-phantix-950/50 px-3 py-2">
          <ReasoningTrigger className={cx("font-medium text-slate-400 transition-colors hover:text-slate-200", dense ? "text-[10px]" : "wb-xs")}>
            <span className="flex items-center gap-1.5">
              <BrainCircuit size={11} className="text-gold-400/80" /> Thought process
            </span>
          </ReasoningTrigger>
          <ReasoningContent
            markdown
            className={cx("mt-2", dense ? "text-[10px]" : "wb-xs")}
            contentClassName="prose-chat text-slate-500"
          >
            {normalizeAgiMarkdown(t.content)}
          </ReasoningContent>
        </Reasoning>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="group flex justify-start gap-2"
    >
      <span className={cx("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-gold-400", persona.tint === "text-gold-300" ? "border-gold-400/25 bg-gradient-to-br from-gold-400/15 to-transparent" : "border-phantix-600/40 bg-phantix-900/70")}>
        <Bot size={12} />
      </span>
      <div className={cx("min-w-0", dense ? "max-w-full" : "max-w-[92%]")}>
        <p className="wb-2xs mb-0.5 flex items-center gap-1.5 px-0.5 text-slate-500">
          <span className={cx("font-semibold uppercase tracking-wider", persona.tint)}>{persona.label}</span>
          {time && <span className="tabular-nums">{time}</span>}
          <CopyBtn text={t.content} className="!p-0.5" />
        </p>
        <div className="wb-base rounded-2xl rounded-tl-md border border-phantix-700/40 bg-gradient-to-b from-phantix-800/60 to-phantix-900/40 px-3.5 py-2.5 text-slate-200 shadow-sm transition-colors group-hover:border-phantix-600/50">
          <Markdown className="max-w-none">{normalizeAgiMarkdown(t.content)}</Markdown>
          {last && <StreamCaret />}
        </div>
      </div>
    </motion.div>
  );
});

StreamMessage.displayName = "StreamMessage";

// ── Working / typing indicator ────────────────────────────────────────────────

export function TypingIndicator({ label, tool, workingOn, phaseId }: { label?: string | null; tool?: string | null; workingOn?: string | null; phaseId?: string | null }) {
  const detail = (workingOn ?? label ?? "").trim();
  const activity = detail ? activityFor(detail, phaseId) : "Thinking";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="flex items-center gap-2.5 rounded-xl border border-phantix-700/40 bg-phantix-900/60 px-3 py-2"
    >
      <span className="flex shrink-0 items-center gap-1 px-0.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-gold-400"
            style={{ animationDelay: `${i * 160}ms`, animationDuration: "0.9s" }}
          />
        ))}
      </span>
      <span className="wb-sm min-w-0 flex-1 truncate">
        <TextShimmer as="span" duration={3} className="font-semibold">
          {activity}
        </TextShimmer>
        {detail && <span className="text-slate-500"> — {detail}</span>}
      </span>
      {tool && <span className="chip shrink-0 !px-1.5 !py-0 wb-2xs font-mono text-gold-300">{tool}</span>}
    </motion.div>
  );
}

// ── Queued operator prompts ───────────────────────────────────────────────────
// A prompt sent mid-turn stays pinned just above the composer until the agent
// has actually acted on it — orchestrator output, tool calls, and terminal rows
// stream past it without ever pushing the operator's own words out of sight.

export interface QueuedPrompt {
  id: string;
  content: string;
  /** Backend has persisted the row — the agent will act on it next turn. */
  delivered: boolean;
}

export function QueuedPromptStrip({ prompts, dense = false }: { prompts: QueuedPrompt[]; dense?: boolean }) {
  if (!prompts.length) return null;
  return (
    <div className={cx("space-y-1.5", dense ? "max-w-full" : "mx-auto max-w-3xl")}>
      {prompts.map((p) => (
        <motion.div
          key={p.id}
          layout="position"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="flex items-start gap-2.5 rounded-xl border border-gold-400/30 bg-gold-400/[0.07] px-3 py-2 shadow-sm"
        >
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-gold-400/30 bg-gold-400/10 text-gold-300">
            {p.delivered ? (
              <span className="flex items-center gap-[2px]" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-[3px] w-[3px] animate-bounce rounded-full bg-gold-300"
                    style={{ animationDelay: `${i * 160}ms`, animationDuration: "0.9s" }}
                  />
                ))}
              </span>
            ) : (
              <Clock size={10} />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className={cx("truncate font-medium text-gold-100", dense ? "text-[11px]" : "wb-sm")}>{p.content}</p>
            <p className={cx("text-gold-300/60", dense ? "text-[9px]" : "wb-2xs")}>
              {p.delivered ? "Received — waiting for the agent to act on it" : "Queued — the agent picks this up on its next turn"}
            </p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ── Always-on activity line ───────────────────────────────────────────────────
// Sits directly above the composer and always names the current state —
// reasoning, phase work, waiting for approval, paused, offline — so the
// operator is never left guessing whether something is happening.

export interface AgentActivity {
  running: boolean;
  paused?: boolean;
  thinking?: boolean;
  /** The agent is actively streaming output (fresh engine rows within the window). */
  streaming?: boolean;
  workingOn?: string | null;
  phaseId?: string | null;
  approvals?: number;
  clarification?: boolean;
  connError?: string | null;
  sessionStatus?: string;
}

/** Cognitive verbs cycled while the agent is streaming a response. The line
 *  interleaves these with the live phase labels (group + granular) so the
 *  operator sees both the model's cognition and the concrete attack-tree step. */
const STREAM_VERBS = [
  "Thinking",
  "Reasoning",
  "Deducing",
  "Factoring",
  "Analyzing",
  "Synthesizing",
  "Correlating",
  "Evaluating",
  "Planning",
  "Triaging",
  "Cross-checking",
  "Hypothesizing",
  "Prioritizing",
  "Reviewing",
  "Mapping",
  "Weighing options",
];

export function AgentActivityLine({ activity, dense = false }: { activity: AgentActivity; dense?: boolean }) {
  const detail = (activity.workingOn ?? "").trim();
  const phase = activityFor(detail, activity.phaseId);
  const granular = activity.phaseId ? PHASE_ACTIVITY_BY_ID[activity.phaseId] : undefined;
  const working = activity.running && !activity.paused;
  // Streaming = a prompt is in flight OR fresh engine output landed recently.
  const streaming = Boolean(activity.streaming) || Boolean(activity.thinking);

  // Intelligent alternation: cognitive verb → phase entry → verb → granular
  // phase → … so the line rotates between *how* the model is working and
  // *what* it is working on. Phase entries repeat; verbs never repeat back-to-back.
  const pool = useMemo(() => {
    const phaseEntries = Array.from(new Set([granular, phase].filter(Boolean) as string[]));
    const out: string[] = [];
    let p = 0;
    for (const v of STREAM_VERBS) {
      out.push(v);
      if (phaseEntries.length) {
        out.push(phaseEntries[p % phaseEntries.length]);
        p += 1;
      }
    }
    return out;
  }, [phase, granular]);

  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!streaming) return;
    const t = window.setInterval(() => setStep((i) => i + 1), 6000);
    return () => window.clearInterval(t);
  }, [streaming]);
  const primary = streaming ? pool[step % pool.length] : "Waiting for response";

  // Anything agent-side that is actively running gets the animated "…";
  // states waiting on the operator (or ended) keep a quiet, static state dot.
  const busy = (working || activity.thinking) && !activity.connError;

  let dot: string = "bg-slate-600";
  let label: React.ReactNode;
  let shimmer = false;

  if (activity.connError) {
    dot = "bg-severity-critical";
    label = "Connection issue — retrying";
  } else if (activity.paused) {
    dot = "bg-severity-medium";
    label = "Paused — chat is queued until you resume";
  } else if (activity.clarification) {
    dot = "bg-gold-400";
    label = "Waiting for your answer — the loop is hard-paused";
  } else if ((activity.approvals ?? 0) > 0) {
    dot = "bg-severity-medium";
    label = `Waiting for your approval — ${activity.approvals} step${(activity.approvals ?? 0) > 1 ? "s" : ""} in the Human gate`;
  } else if (working || activity.thinking) {
    shimmer = streaming;
    label = detail ? <>{primary}<span className="text-slate-500"> — {detail}</span></> : primary;
  } else if (["stopped", "torn_down", "failed"].includes(activity.sessionStatus ?? "")) {
    dot = "bg-slate-600";
    label = "Session ended — start a new session to continue";
  } else {
    dot = "bg-slate-600";
    label = "Idle";
  }

  return (
    <div
      className={cx(
        "flex items-center gap-2 rounded-lg border border-phantix-700/30 bg-phantix-950/60 px-2.5 py-1.5",
        dense ? "max-w-full" : "mx-auto max-w-3xl",
      )}
      role="status"
      aria-live="polite"
    >
      {busy ? (
        <span className="flex shrink-0 items-center gap-[3px]" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1 w-1 animate-bounce rounded-full bg-gold-400"
              style={{ animationDelay: `${i * 160}ms`, animationDuration: "0.9s" }}
            />
          ))}
        </span>
      ) : (
        <span className={cx("h-1.5 w-1.5 shrink-0 rounded-full", dot)} aria-hidden />
      )}
      <span className={cx("min-w-0 flex-1 truncate font-medium", dense ? "text-[10px]" : "wb-xs")}>
        <motion.span
          key={streaming ? `cycle-${step}` : "static"}
          initial={{ opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="inline-block max-w-full truncate align-middle"
        >
          {shimmer ? (
            <TextShimmer as="span" duration={3}>
              {label}
            </TextShimmer>
          ) : (
            <span className="text-slate-400">{label}</span>
          )}
        </motion.span>
      </span>
    </div>
  );
}

// ── Awaiting-authorization cue ──────────────────────────────────────────────
// Rendered inline in the stream when one or more steps are gated. Instead of a
// generic "awaiting engine output", it reveals the approval path: the operator
// reviews in the Human gate, and for state-changing steps a second authorizer
// must approve in the Authorizations queue.

export function ApprovalNotice({
  count = 1,
  stateChanging = true,
  authorizationsHref,
  dense = false,
}: {
  count?: number;
  /** State-changing steps require a second authorizer via the queue. */
  stateChanging?: boolean;
  /** Link to the authorizer approval queue (command centre: "/authorizations"). */
  authorizationsHref?: string;
  dense?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="flex justify-start"
    >
      <div className={cx("flex items-start gap-2.5 rounded-xl border border-severity-medium/40 bg-severity-medium/10 px-3 py-2.5", dense ? "max-w-full" : "max-w-[94%]")}>
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-severity-medium/15 text-severity-medium">
          <ShieldCheck size={13} className="animate-pulse" />
        </span>
        <div className="min-w-0">
          <p className={cx("font-semibold text-amber-200", dense ? "wb-xs" : "wb-sm")}>
            Paused — awaiting authorization{count > 1 ? ` (${count} steps)` : ""}
          </p>
          <p className={cx("mt-0.5 leading-relaxed text-slate-400", dense ? "wb-2xs" : "wb-xs")}>
            {stateChanging
              ? authorizationsHref
                ? "This state-changing step is held for dual control. Ask an authorizer to approve it in the Authorizations queue."
                : "This state-changing step is held for approval. Review and decide it in the Human gate."
              : "This step is held pending approval."}
          </p>
          {stateChanging && authorizationsHref && (
            <a
              href={authorizationsHref}
              className={cx("mt-1 inline-flex items-center gap-1 font-medium text-gold-300 underline decoration-gold-400/40 underline-offset-2 hover:text-gold-200", dense ? "wb-2xs" : "wb-xs")}
            >
              Open the Authorizations queue <ArrowRight size={11} />
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Empty stream placeholder ──────────────────────────────────────────────────

export function StreamEmpty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-2 py-10 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-phantix-700/40 bg-phantix-900/60 text-gold-400">
        <Crosshair size={16} className="animate-pulse" />
      </span>
      <p className="wb-sm font-medium text-slate-400">{title}</p>
      {hint && <p className="wb-xs max-w-[260px] leading-relaxed text-slate-600">{hint}</p>}
    </div>
  );
}
