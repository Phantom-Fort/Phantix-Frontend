import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Bot, Check, ChevronRight, Copy, Crosshair, Loader2, Radar, ShieldAlert, Terminal, User,
} from "lucide-react";
import MarkdownView from "@/components/MarkdownView";
import { personaForChunk, type AgentPersona } from "@/lib/agiGraph";
import type { AgiTranscriptChunk, Severity } from "@/lib/types";
import { cx } from "@/lib/utils";

// ── Shared live-stream primitives for the Autonomous Pentest Agent console ────
// Used by the fullscreen operator console (AgiConsole) and the compact drawer
// stream (AgiWorkspace) so both surfaces render messages, tool calls, engine
// events, and the working indicator identically.

const PERSONA_META: Record<AgentPersona, { label: string; tint: string }> = {
  orchestrator: { label: "Orchestrator", tint: "text-gold-300" },
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

const COLLAPSE_AT = 8;

function prettyJson(raw: string): string | null {
  const s = raw.trim();
  if (!s.startsWith("{") && !s.startsWith("[")) return null;
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return null;
  }
}

const CMD_RE = /^[a-z_][\w.-]*(\s+\S+)+$/i;

function ToolCallCard({ t, dense = false }: { t: AgiTranscriptChunk; dense?: boolean }) {
  const [open, setOpen] = useState(false);
  const toolName = typeof t.meta?.tool === "string" ? (t.meta.tool as string) : "tool";
  const time = streamTime(t.created_at);

  const { command, body, totalLines } = useMemo(() => {
    const lines = t.content.split("\n");
    if (lines.length === 1) return { command: lines[0].trim(), body: "", totalLines: 1 };
    const first = lines[0].trim();
    const looksLikeCmd = first.length > 0 && first.length <= 200 && CMD_RE.test(first) && !first.startsWith("{");
    const rest = looksLikeCmd ? lines.slice(1).join("\n") : lines.join("\n");
    return { command: looksLikeCmd ? first : "", body: rest, totalLines: lines.length };
  }, [t.content]);

  const pretty = useMemo(() => (body ? prettyJson(body) : null), [body]);
  const bodyLines = useMemo(() => (pretty ?? body).split("\n"), [pretty, body]);
  const long = bodyLines.length > COLLAPSE_AT;
  const shownBody = long && !open ? bodyLines.slice(0, 5).join("\n") : (pretty ?? body);

  return (
    <div className="group overflow-hidden rounded-xl border border-phantix-700/40 bg-phantix-950/85 shadow-sm">
      <div className="flex items-center gap-1.5 border-b border-phantix-700/30 bg-phantix-900/40 px-2.5 py-1.5">
        <span className="flex h-4 w-4 items-center justify-center rounded bg-gold-400/10 text-gold-400">
          <Terminal size={10} />
        </span>
        <span className="wb-xs font-mono font-semibold text-gold-300">{toolName}</span>
        <span className="chip !px-1.5 !py-0 wb-2xs font-normal text-slate-500">tool call</span>
        <span className="ml-auto flex items-center gap-0.5">
          {time && <span className="wb-2xs mr-0.5 tabular-nums text-slate-600">{time}</span>}
          {long && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="wb-2xs flex items-center gap-0.5 rounded px-1 py-0.5 text-slate-500 transition-colors hover:bg-phantix-800 hover:text-slate-200"
            >
              {open ? "Collapse" : `${bodyLines.length} lines`}
              <ChevronRight size={10} className={cx("transition-transform duration-150", open && "rotate-90")} />
            </button>
          )}
          <CopyBtn text={t.content} />
        </span>
      </div>
      <div className={cx("font-mono leading-[1.5]", dense ? "wb-xs px-2 py-1.5" : "wb-sm px-2.5 py-2")}>
        {command && (
          <p className={cx("flex gap-1.5 text-emerald-300", shownBody && "mb-1")}>
            <span className="shrink-0 select-none text-slate-600">$</span>
            <span className="min-w-0 break-all">{command}</span>
          </p>
        )}
        {shownBody && (
          <pre className="whitespace-pre-wrap break-words text-slate-400">{shownBody}</pre>
        )}
        {long && !open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="wb-2xs mt-1 font-semibold text-gold-400/80 hover:text-gold-300"
          >
            Show {bodyLines.length - 5} more lines…
          </button>
        )}
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

// ── Message renderer ──────────────────────────────────────────────────────────

export type StreamMessageProps = {
  t: AgiTranscriptChunk;
  /** Show the streaming caret (last live chunk while the loop runs). */
  last?: boolean;
  /** Compact chrome for swimlane columns. */
  dense?: boolean;
};

export function StreamMessage({ t, last = false, dense = false }: StreamMessageProps) {
  const time = streamTime(t.created_at);

  if (t.role === "tool") {
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
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="group flex justify-start gap-2"
    >
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-gold-400/25 bg-gradient-to-br from-gold-400/15 to-transparent text-gold-400">
        <Bot size={12} />
      </span>
      <div className={cx("min-w-0", dense ? "max-w-full" : "max-w-[92%]")}>
        <p className="wb-2xs mb-0.5 flex items-center gap-1.5 px-0.5 text-slate-500">
          <span className={cx("font-semibold uppercase tracking-wider", persona.tint)}>{persona.label}</span>
          {time && <span className="tabular-nums">{time}</span>}
          <CopyBtn text={t.content} className="!p-0.5" />
        </p>
        <div className="wb-base rounded-xl rounded-tl-sm border border-phantix-700/40 bg-phantix-800/55 px-3 py-2 text-slate-200 shadow-sm">
          <MarkdownView source={t.content} />
          {last && <StreamCaret />}
        </div>
      </div>
    </motion.div>
  );
}

// ── Working / typing indicator ────────────────────────────────────────────────

export function TypingIndicator({ label, tool }: { label?: string | null; tool?: string | null }) {
  const text = (label ?? "").trim();
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
      <span className="wb-sm min-w-0 flex-1 truncate text-slate-300">
        {text || "Working on the scoped assessment."}
      </span>
      {tool && <span className="chip shrink-0 !px-1.5 !py-0 wb-2xs font-mono text-gold-300">{tool}</span>}
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
