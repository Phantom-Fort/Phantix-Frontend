import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown, Ban, BrainCircuit, CheckCircle2, Clock, Crosshair, FileCode2,
  Globe2, Loader2, Lock, Pause, Play, Radar, Send, ShieldAlert, ShieldCheck, Sparkles, Square,
  Terminal, XCircle,
} from "lucide-react";
import { CopyBtn, StreamEmpty, StreamMessage, TypingIndicator } from "@/components/AgiStream";
import { SeverityBadge } from "@/components/ui";
import {
  deriveAttackGraph,
  deriveFindings,
  isHighRiskCommand,
  personaForChunk,
  PHASES,
  PERSONAS,
  severityCounts,
  type AgentPersona,
  type AgiFinding,
  type AttackNode,
  type NodeStatus,
} from "@/lib/agiGraph";
import type { AgiAction, AgiEngagement, AgiSession, AgiTranscriptChunk, Severity } from "@/lib/types";
import { cx } from "@/lib/utils";
import { useStickToBottom } from "@/lib/useStickToBottom";
import type { SendHint } from "@/lib/useChatSend";

const NODE_DOT: Record<NodeStatus, string> = {
  pending: "bg-slate-500",
  active: "bg-gold-400 animate-pulse",
  succeeded: "bg-emerald-400",
  blocked: "bg-severity-medium",
  failed: "bg-severity-critical",
};

const NODE_RING: Record<NodeStatus, string> = {
  pending: "border-phantix-700/50 bg-phantix-900/50",
  active: "border-gold-400/50 bg-gold-400/10 shadow-glow",
  succeeded: "border-emerald-400/40 bg-emerald-400/8",
  blocked: "border-severity-medium/40 bg-severity-medium/8",
  failed: "border-severity-critical/40 bg-severity-critical/8",
};

const SEV_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

const SEV_DOT: Record<Severity, string> = {
  critical: "bg-severity-critical",
  high: "bg-severity-high",
  medium: "bg-severity-medium",
  low: "bg-severity-low",
  info: "bg-severity-info",
};

const COMPOSER_SUGGESTIONS = [
  "Summarize findings so far",
  "What is the next planned step?",
  "Stay read-only — no state-changing steps",
];

/** Ticking session clock — isolated so the console does not re-render each second. */
function SessionClock({ since, live }: { since?: string | null; live: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!live) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [live]);
  const start = since ? new Date(since).getTime() : NaN;
  if (Number.isNaN(start)) return null;
  const s = Math.max(0, Math.floor((now - start) / 1000));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return (
    <span className="chip !text-[9px] font-mono tabular-nums text-slate-400" title="Session elapsed">
      {hh}:{mm}:{ss}
    </span>
  );
}

function NodeInspector({ node }: { node: AttackNode }) {
  return (
    <div className="min-w-0 space-y-2">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cx("h-2 w-2 rounded-full", NODE_DOT[node.status])} />
          <p className="text-xs font-semibold text-white">{node.label}</p>
          <span className="chip !text-[9px] capitalize text-slate-400">{node.status}</span>
          {node.tool && <span className="chip !text-[9px] font-mono text-gold-300">{node.tool}</span>}
        </div>
        {node.reasoning[0] ? (
          <div>
            <p className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-500"><BrainCircuit size={10} /> Reasoning</p>
            <p className="whitespace-pre-wrap break-words text-[11px] leading-5 text-slate-400">{node.reasoning[node.reasoning.length - 1]}</p>
          </div>
        ) : (
          <p className="text-[11px] text-slate-500">
            {node.status === "active"
              ? "Working — waiting on first tool result…"
              : node.status === "blocked"
              ? "Blocked — awaiting approval."
              : "No activity on this node yet."}
          </p>
        )}
      </div>
      <div className="min-w-0 space-y-1.5">
        {node.commands.length > 0 && (
          <div>
            <p className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-500"><Terminal size={10} /> Commands</p>
            <div className="space-y-1">
              {node.commands.slice(-6).map((c, i) => (
                <p key={i} className="break-all rounded-lg bg-phantix-950/70 px-2 py-1.5 font-mono text-[10px] text-slate-300">{c}</p>
              ))}
            </div>
          </div>
        )}
        {node.outputs.length > 0 && (
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">Tool output</p>
            <div className="max-h-36 space-y-1 overflow-y-auto">
              {node.outputs.slice(-8).map((c, i) => (
                <p key={i} className="whitespace-pre-wrap break-words font-mono text-[10px] leading-4 text-slate-400">{c}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EvidenceDrawer({
  finding,
  onClose,
}: {
  finding: AgiFinding;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"evidence" | "autofix">("evidence");
  return (
    <motion.div
      initial={{ y: 16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 12, opacity: 0 }}
      className="flex max-h-[46%] flex-col border-t border-phantix-700/40 bg-phantix-950/80"
    >
      <div className="flex items-center gap-2 border-b border-phantix-700/30 px-3 py-2">
        <SeverityBadge severity={finding.severity} />
        <p className="min-w-0 flex-1 truncate text-xs font-semibold text-white">{finding.title}</p>
        {finding.cve && <span className="chip !text-[9px] font-mono text-gold-300">{finding.cve}</span>}
        <div className="flex rounded-lg border border-phantix-700/40 p-0.5">
          <button onClick={() => setTab("evidence")} className={cx("rounded-md px-2 py-0.5 text-[10px]", tab === "evidence" ? "bg-phantix-800 text-white" : "text-slate-500")}>Evidence</button>
          <button onClick={() => setTab("autofix")} className={cx("rounded-md px-2 py-0.5 text-[10px]", tab === "autofix" ? "bg-phantix-800 text-white" : "text-slate-500")}>Autofix</button>
        </div>
        <button onClick={onClose} className="rounded p-1 text-slate-500 hover:text-slate-200" aria-label="Close evidence"><XCircle size={13} /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === "evidence" ? (
          <div className="space-y-2">
            <p className="break-all font-mono text-[10px] text-slate-500">{finding.target}</p>
            {finding.evidence.request && (
              <div className="group relative">
                <p className="mb-1 flex items-center text-[10px] uppercase tracking-wider text-slate-500">
                  Request
                  <CopyBtn text={finding.evidence.request} className="ml-1" />
                </p>
                <pre className="whitespace-pre-wrap rounded-lg border border-phantix-700/40 bg-phantix-950/70 p-2 font-mono text-[10px] leading-4 text-slate-300">{finding.evidence.request}</pre>
              </div>
            )}
            {finding.evidence.response && (
              <div className="group relative">
                <p className="mb-1 flex items-center text-[10px] uppercase tracking-wider text-slate-500">
                  Response
                  <CopyBtn text={finding.evidence.response} className="ml-1" />
                </p>
                <pre className="whitespace-pre-wrap rounded-lg border border-phantix-700/40 bg-phantix-950/70 p-2 font-mono text-[10px] leading-4 text-slate-300">{finding.evidence.response}</pre>
              </div>
            )}
            <div className="flex flex-wrap gap-2 text-[10px] text-slate-500">
              {finding.evidence.hash && <span className="chip !text-[9px] font-mono">{finding.evidence.hash}</span>}
              <span className="chip !text-[9px] capitalize">{finding.status}</span>
            </div>
            {finding.evidence.notes && <p className="text-[11px] leading-5 text-slate-400">{finding.evidence.notes}</p>}
          </div>
        ) : finding.autofix ? (
          <div className="space-y-2">
            <p className="text-[11px] text-slate-400">{finding.autofix.summary}</p>
            <p className="font-mono text-[10px] text-gold-300">{finding.autofix.file}</p>
            <div className="group relative">
              <pre className="whitespace-pre-wrap rounded-lg border border-gold-400/20 bg-phantix-950/70 p-2.5 font-mono text-[10px] leading-4 text-slate-200">{finding.autofix.preview}</pre>
              <CopyBtn text={finding.autofix.preview} className="absolute right-2 top-2" />
            </div>
            <button className="btn-primary w-full !py-1.5 !text-[11px]"><FileCode2 size={11} className="mr-1 inline" /> Stage pull request</button>
          </div>
        ) : (
          <p className="text-[11px] text-slate-500">No autofix preview for this finding.</p>
        )}
      </div>
    </motion.div>
  );
}

export type AgiConsoleProps = {
  running: boolean;
  paused: boolean;
  onTogglePause: () => void;
  stopping: boolean;
  onStop: () => void;
  session: AgiSession;
  engagement: AgiEngagement | null;
  transcript: AgiTranscriptChunk[];
  actions: AgiAction[];
  actionBusy: number | null;
  onDecide: (action: AgiAction, approve: boolean, overrideCmd?: string) => void;
  thinking: boolean;
  workingOn?: string | null;
  connError: string | null;
  instruction: string;
  onInstruction: (v: string) => void;
  onSend: () => void;
  sendHint?: SendHint;
  policyBanner: string | null;
  overrideDrafts: Record<number, string>;
  onOverrideDraft: (id: number, cmd: string) => void;
};

export default function AgiConsole({
  running,
  paused,
  onTogglePause,
  stopping,
  onStop,
  session,
  engagement,
  transcript,
  actions,
  actionBusy,
  onDecide,
  thinking,
  workingOn = null,
  connError,
  instruction,
  onInstruction,
  onSend,
  sendHint = "idle",
  policyBanner,
  overrideDrafts,
  onOverrideDraft,
}: AgiConsoleProps) {
  const [persona, setPersona] = useState<AgentPersona | "all">("all");
  const [lanes, setLanes] = useState(false);
  const [showTerm, setShowTerm] = useState(false);
  const [leftW, setLeftW] = useState(340);
  const [rightW, setRightW] = useState(240);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [findingId, setFindingId] = useState<string | null>(null);
  const [sevFilter, setSevFilter] = useState<Severity | null>(null);
  const [gate, setGate] = useState<AgiAction | null>(null);
  const thoughtsStick = useStickToBottom([transcript, thinking, running]);
  const toolsStick = useStickToBottom([transcript, running]);

  const nodes = useMemo(() => deriveAttackGraph(transcript, actions, running && !paused), [transcript, actions, running, paused]);
  const maxSlots = useMemo(
    () => Math.max(1, ...PHASES.map((phase) => nodes.filter((n) => n.phase === phase.id).length)),
    [nodes],
  );
  const findings = useMemo(() => deriveFindings(transcript, actions, engagement), [transcript, actions, engagement]);
  const counts = useMemo(() => severityCounts(findings), [findings]);
  const selected = nodes.find((n) => n.id === selectedId) ?? nodes.find((n) => n.status === "active" || n.status === "blocked") ?? nodes[0];
  const openFinding = findings.find((f) => f.id === findingId) ?? null;
  const allowlist = engagement?.scope_definition.target_allowlist ?? [];
  const forbidden = engagement?.scope_definition.forbidden_actions ?? [];

  const filtered = useMemo(
    () => transcript.filter((t) => persona === "all" || personaForChunk(t) === persona),
    [transcript, persona],
  );
  const tools = filtered.filter((t) => t.role === "tool");

  const personaCounts = useMemo(() => {
    const c: Record<AgentPersona | "all", number> = { all: transcript.length, orchestrator: 0, recon: 0, exploit: 0 };
    for (const t of transcript) c[personaForChunk(t)] += 1;
    return c;
  }, [transcript]);

  const phaseStats = useMemo(
    () =>
      PHASES.map((phase) => {
        const list = nodes.filter((n) => n.phase === phase.id);
        return {
          id: phase.id,
          total: list.length,
          done: list.filter((n) => n.status === "succeeded").length,
          live: list.some((n) => n.status === "active" || n.status === "blocked"),
        };
      }),
    [nodes],
  );

  const visibleFindings = useMemo(
    () => (sevFilter ? findings.filter((f) => f.severity === sevFilter) : findings),
    [findings, sevFilter],
  );

  const drag = useRef<{ side: "left" | "right"; startX: number; start: number } | null>(null);
  const onDragStart = useCallback((side: "left" | "right", e: React.MouseEvent) => {
    e.preventDefault();
    drag.current = { side, startX: e.clientX, start: side === "left" ? leftW : rightW };
    const onMove = (ev: MouseEvent) => {
      if (!drag.current) return;
      const dx = ev.clientX - drag.current.startX;
      if (drag.current.side === "left") setLeftW(Math.min(560, Math.max(240, drag.current.start + dx)));
      else setRightW(Math.min(420, Math.max(160, drag.current.start - dx)));
    };
    const onUp = () => {
      drag.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [leftW, rightW]);

  const tryApprove = (a: AgiAction) => {
    const cmd = overrideDrafts[a.id] ?? a.proposed_command;
    if (isHighRiskCommand(cmd)) { setGate(a); return; }
    onDecide(a, true, cmd);
  };

  const lastIdx = filtered.length - 1;

  return (
    <div className="flex h-full min-h-0 flex-col bg-phantix-950">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-phantix-700/40 bg-phantix-900/40 px-4 py-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <span className="flex shrink-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            <Globe2 size={11} className="text-gold-400" /> Scope
          </span>
          {allowlist.length === 0 && <span className="chip !text-[9px] text-slate-500">no allowlist</span>}
          {allowlist.map((t) => (
            <span key={t} className="chip !text-[9px] font-mono text-emerald-300 transition-colors hover:border-emerald-400/40" title={t}>{t}</span>
          ))}
          {forbidden.map((f) => (
            <span key={f} className="chip !text-[9px] text-severity-critical" title={`Forbidden: ${f}`}>¬ {f}</span>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <SessionClock since={session.started_at} live={running && !paused} />
          <span className={cx("chip !text-[9px]", running && !paused ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : paused ? "border-severity-medium/30 bg-severity-medium/10 text-severity-medium" : "border-phantix-600/40 text-slate-400")}>
            {running && !paused && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />}
            {paused ? "paused" : running ? "live" : session.status}
          </span>
          <span className="chip !text-[9px] font-mono text-slate-500">#{session.id}</span>
          {running && (
            <button onClick={onTogglePause} className="btn-secondary !px-2.5 !py-1 !text-[10px]" title={paused ? "Resume agent loop" : "Pause agent loop"}>
              {paused ? <Play size={11} className="mr-1 inline" /> : <Pause size={11} className="mr-1 inline" />}
              {paused ? "Resume" : "Pause"}
            </button>
          )}
          {running && (
            <button onClick={onStop} disabled={stopping} className="btn-secondary !px-2.5 !py-1 !text-[10px]">
              {stopping ? <Loader2 size={11} className="mr-1 inline animate-spin" /> : <Square size={11} className="mr-1 inline" />} {stopping ? "Stopping…" : "Stop"}
            </button>
          )}
        </div>
      </div>

      {policyBanner && (
        <div className="flex items-center gap-2 border-b border-severity-critical/30 bg-severity-critical/10 px-4 py-1.5">
          <Lock size={12} className="text-severity-critical" />
          <p className="text-[11px] text-red-300">{policyBanner}</p>
        </div>
      )}

      <div className="flex min-h-0 w-full flex-1">
        <aside className="flex shrink-0 flex-col border-r border-phantix-700/40 bg-phantix-900/40" style={{ width: leftW }}>
          <div className="shrink-0 border-b border-phantix-700/30 p-2">
            <p className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <Crosshair size={11} className="text-gold-400" /> Attack tree
              {selectedId && (
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-medium normal-case tracking-normal text-gold-300 transition-colors hover:bg-phantix-800"
                  title="Follow the live node again"
                >
                  <Radar size={9} /> Follow live
                </button>
              )}
            </p>
            <div className="grid grid-cols-5 gap-1">
              {PHASES.map((phase) => {
                const stat = phaseStats.find((p) => p.id === phase.id);
                const pct = stat && stat.total > 0 ? Math.round((stat.done / stat.total) * 100) : 0;
                return (
                  <div key={phase.id} className="min-w-0">
                    <p className={cx("truncate text-center text-[8px] font-semibold uppercase tracking-wider", stat?.live ? "text-gold-300" : "text-slate-500")} title={phase.label}>{phase.label}</p>
                    <div className="mt-0.5 h-0.5 overflow-hidden rounded-full bg-phantix-700/40" title={`${stat?.done ?? 0}/${stat?.total ?? 0} nodes complete`}>
                      <div
                        className={cx("h-full rounded-full transition-all duration-500", stat?.live ? "bg-gold-400" : "bg-emerald-400/80")}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {PHASES.map((phase) => {
                const list = nodes.filter((n) => n.phase === phase.id);
                const slots = [...list, ...Array.from({ length: Math.max(0, maxSlots - list.length) }, () => null)];
                return (
                  <div key={`${phase.id}-col`} className="flex flex-col gap-1">
                    {slots.map((n, i) => n ? (
                      <button
                        key={n.id}
                        onClick={() => setSelectedId(n.id)}
                        title={n.tool ? `${n.label} · ${n.tool}` : n.label}
                        className={cx("flex min-h-[46px] flex-1 flex-col items-center justify-center gap-0.5 rounded-md border px-1 py-1 text-center transition-all duration-200", NODE_RING[n.status], selected?.id === n.id && "ring-1 ring-gold-400/40")}
                      >
                        <span className={cx("h-1.5 w-1.5 rounded-full", NODE_DOT[n.status])} />
                        <span className="line-clamp-2 text-[9px] leading-3 text-slate-200">{n.label}</span>
                        {n.tool && <span className="max-w-full truncate font-mono text-[7px] leading-2 text-slate-500">{n.tool}</span>}
                      </button>
                    ) : (
                      <div key={`${phase.id}-empty-${i}`} className="min-h-[46px] flex-1 rounded-md border border-dashed border-phantix-700/30" />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {selected ? <NodeInspector node={selected} /> : <p className="text-[11px] text-slate-500">Select a node.</p>}
          </div>
        </aside>

        <button
          type="button"
          aria-label="Resize left pane"
          onMouseDown={(e) => onDragStart("left", e)}
          className="w-1.5 shrink-0 cursor-col-resize bg-phantix-800/40 hover:bg-gold-400/40"
        />

        <div className="relative flex min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-phantix-700/30 bg-phantix-950/80 px-3 py-1">
            {PERSONAS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPersona(p.id)}
                className={cx("flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors", persona === p.id ? "bg-phantix-800 text-gold-200" : "text-slate-500 hover:text-slate-300")}
              >
                {p.label}
                <span className={cx("rounded-full px-1 text-[8px] tabular-nums", persona === p.id ? "bg-gold-400/15 text-gold-300" : "bg-phantix-800/80 text-slate-500")}>
                  {personaCounts[p.id]}
                </span>
              </button>
            ))}
            <span className="mx-1 h-3 w-px bg-phantix-700/50" />
            <button
              onClick={() => setLanes((v) => !v)}
              className={cx("rounded-md px-2 py-0.5 text-[10px] transition-colors", lanes ? "bg-phantix-800 text-white" : "text-slate-500 hover:text-slate-300")}
            >
              Swimlanes
            </button>
            <button
              onClick={() => setShowTerm((v) => !v)}
              className={cx("rounded-md px-2 py-0.5 text-[10px] transition-colors", showTerm ? "bg-phantix-800 text-white" : "text-slate-500 hover:text-slate-300")}
            >
              Terminal
            </button>
          </div>

          <div className="relative min-h-0 flex-1">
            {lanes ? (
              <div className="grid h-full grid-cols-3 divide-x divide-phantix-700/30">
                {(["orchestrator", "recon", "exploit"] as AgentPersona[]).map((lane) => (
                  <div key={lane} className="min-h-0 space-y-1.5 overflow-y-auto p-2">
                    <p className="sticky top-0 z-10 -mx-2 flex items-center justify-between bg-phantix-950/95 px-2 pb-1 text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                      {PERSONAS.find((p) => p.id === lane)?.label}
                      <span className="rounded-full bg-phantix-800/80 px-1 text-[8px] tabular-nums text-slate-400">{personaCounts[lane]}</span>
                    </p>
                    {transcript.filter((t) => personaForChunk(t) === lane).map((t, i) => (
                      <StreamMessage key={`${lane}-${i}`} t={t} dense />
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div ref={thoughtsStick.scrollerRef} onScroll={thoughtsStick.onScroll} className="h-full space-y-2 overflow-y-auto px-3 py-2.5">
                {connError && (
                  <div className="flex items-center gap-2 rounded-xl border border-severity-critical/40 bg-severity-critical/10 px-3 py-2">
                    <Lock size={12} className="shrink-0 text-severity-critical" />
                    <p className="text-[11px] text-red-300">{connError}</p>
                  </div>
                )}
                {filtered.length === 0 && !connError && (
                  <StreamEmpty
                    title={persona === "all" ? "Waiting for orchestrator output…" : `No ${PERSONAS.find((p) => p.id === persona)?.label ?? "agent"} messages yet`}
                    hint="Live turns, tool calls, and engine events stream here as the agent works through the scoped assessment."
                  />
                )}
                {filtered.map((t, i) => (
                  <StreamMessage key={`st-${i}`} t={t} last={i === lastIdx && running && !paused && t.role !== "operator"} />
                ))}
                {thinking && !paused && <TypingIndicator label={(workingOn || "").trim() || undefined} />}
                {paused && <p className="text-[10px] text-severity-medium">Loop paused — agent will not advance.</p>}
                <div ref={thoughtsStick.endRef} />
              </div>
            )}

            <div className="pointer-events-none absolute inset-x-2 bottom-2 z-10 flex flex-col gap-2">
              {showTerm && (
                <div className="pointer-events-auto max-h-[42%] overflow-hidden rounded-lg border border-phantix-700/40 bg-phantix-950/95 shadow-card">
                  <p className="flex items-center gap-1.5 border-b border-phantix-700/30 px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                    <Terminal size={10} /> Terminal
                    <span className="ml-auto rounded-full bg-phantix-800/80 px-1.5 text-[8px] tabular-nums text-slate-400">{tools.length}</span>
                  </p>
                  <div ref={toolsStick.scrollerRef} onScroll={toolsStick.onScroll} className="max-h-40 space-y-1.5 overflow-y-auto p-2">
                    {tools.length === 0 && <p className="py-3 text-center text-[10px] text-slate-600">No tool output yet.</p>}
                    {tools.map((t, i) => (
                      <StreamMessage key={`tl-${i}`} t={t} dense />
                    ))}
                    <div ref={toolsStick.endRef} />
                  </div>
                </div>
              )}

              {actions.length > 0 && (
                <div className="pointer-events-auto max-h-[36%] space-y-1.5 overflow-y-auto rounded-lg border border-severity-medium/30 bg-phantix-950/95 p-2 shadow-card">
                  <p className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-severity-medium">
                    <ShieldCheck size={10} /> Human gate · {actions.length}
                  </p>
                  <AnimatePresence initial={false}>
                    {actions.map((a) => {
                      const draft = overrideDrafts[a.id] ?? a.proposed_command;
                      const risky = isHighRiskCommand(draft);
                      const busy = actionBusy === a.id;
                      return (
                        <motion.div
                          key={a.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.98 }}
                          className={cx("rounded-lg border border-severity-medium/20 bg-severity-medium/5 p-2 transition-opacity", busy && "pointer-events-none opacity-60")}
                        >
                          <div className="mb-1 flex items-center gap-1.5">
                            {busy ? <Loader2 size={11} className="animate-spin text-severity-medium" /> : <Radar size={11} className="text-severity-medium" />}
                            <p className="text-[11px] font-semibold text-amber-200">{a.tool_name ?? "state-changing step"}</p>
                            {risky && <span className="chip !text-[8px] text-severity-critical">gate</span>}
                            {busy && <span className="ml-auto text-[9px] text-slate-500">recording decision…</span>}
                          </div>
                          <textarea value={draft} onChange={(e) => onOverrideDraft(a.id, e.target.value)} rows={2} className="w-full rounded-md border border-phantix-700/50 bg-phantix-950/70 px-2 py-1 font-mono text-[10px] text-slate-200 outline-none" />
                          {a.rationale && <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-500">{a.rationale}</p>}
                          <div className="mt-1 flex gap-1.5">
                            <button onClick={() => tryApprove(a)} disabled={busy} className="btn-primary flex-1 !px-2 !py-1 !text-[10px]"><CheckCircle2 size={11} className="mr-1 inline" /> Approve</button>
                            <button onClick={() => onDecide(a, false)} disabled={busy} className="btn-ghost flex-1 !px-2 !py-1 !text-[10px] text-severity-critical"><XCircle size={11} className="mr-1 inline" /> Reject</button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>

            <AnimatePresence>
              {thoughtsStick.showJump && (
                <motion.button
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
                  onClick={thoughtsStick.jump}
                  className="absolute bottom-3 left-1/2 z-20 flex h-8 -translate-x-1/2 items-center gap-1.5 rounded-full border border-phantix-700/50 bg-phantix-900 px-2.5 text-gold-300 shadow-card"
                  aria-label="Jump to latest"
                >
                  <ArrowDown size={14} />
                  {thoughtsStick.unseen > 0 && (
                    <span className="rounded-full bg-gold-400/20 px-1.5 text-[9px] font-semibold tabular-nums text-gold-300">
                      {thoughtsStick.unseen > 99 ? "99+" : thoughtsStick.unseen}
                    </span>
                  )}
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          <div className="shrink-0 border-t border-phantix-700/40 p-3">
            {running && !paused && !instruction.trim() && (
              <div className="mx-auto mb-2 flex max-w-3xl flex-wrap items-center gap-1.5">
                <Sparkles size={10} className="text-gold-400/70" />
                {COMPOSER_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onInstruction(s)}
                    className="rounded-full border border-phantix-700/50 bg-phantix-900/50 px-2.5 py-0.5 text-[10px] text-slate-400 transition-colors hover:border-gold-400/40 hover:text-gold-200"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div className="mx-auto flex max-w-3xl items-start gap-2 rounded-xl border border-phantix-700/50 bg-phantix-950/60 px-3 py-2 transition-colors focus-within:border-gold-400/40">
              <textarea
                value={instruction}
                onChange={(e) => {
                  onInstruction(e.target.value);
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  const newH = Math.min(el.scrollHeight, 120);
                  el.style.height = `${newH}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" || e.shiftKey || e.repeat) return;
                  e.preventDefault();
                  onSend();
                }}
                placeholder={paused ? "Paused — resume to send" : running ? "Further instructions or override the next step…" : "Session stopped"}
                disabled={!running || paused}
                rows={1}
                className="flex-1 resize-none overflow-hidden bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500 disabled:opacity-50"
                style={{ minHeight: "24px", maxHeight: "120px" }}
              />
              <button onClick={onSend} disabled={!running || paused || !instruction.trim()} className="btn-primary mt-0.5 !px-3 !py-1.5 !text-xs" aria-label="Send"><Send size={13} /></button>
            </div>
            <p className="mt-1.5 flex items-center gap-1.5 text-[10px] text-slate-600">
              <ShieldCheck size={10} className="shrink-0" />
              {sendHint === "queued"
                ? "Queued — press Enter again to send now, or wait for the current reply."
                : "Scoped to allowlist · high-risk actions require a second confirmation · pause freezes the loop"}
              <span className="ml-auto hidden shrink-0 items-center gap-1 sm:flex">
                <kbd className="rounded border border-phantix-700/50 bg-phantix-900/60 px-1 font-mono text-[9px] text-slate-500">Enter</kbd> send
                <kbd className="rounded border border-phantix-700/50 bg-phantix-900/60 px-1 font-mono text-[9px] text-slate-500">Shift+Enter</kbd> newline
              </span>
            </p>
          </div>
        </div>

        <button
          type="button"
          aria-label="Resize right pane"
          onMouseDown={(e) => onDragStart("right", e)}
          className="w-1.5 shrink-0 cursor-col-resize bg-phantix-800/40 hover:bg-gold-400/40"
        />

        <aside className="flex shrink-0 flex-col border-l border-phantix-700/40 bg-phantix-900/40" style={{ width: rightW }}>
          <div className="flex items-center gap-1 border-b border-phantix-700/30 px-2 py-1.5">
            <ShieldAlert size={10} className="text-severity-high" />
            <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Findings</p>
            <span className="ml-auto rounded-full bg-phantix-800/80 px-1.5 text-[8px] tabular-nums text-slate-400">{findings.length}</span>
          </div>
          <div className="flex flex-wrap gap-1 border-b border-phantix-700/20 px-2 py-1">
            {SEV_ORDER.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSevFilter((cur) => (cur === s ? null : s))}
                title={`Filter ${s} findings`}
                className={cx(
                  "inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] text-slate-400 transition-colors",
                  sevFilter === s ? "bg-phantix-800 text-white ring-1 ring-gold-400/30" : "hover:bg-phantix-800/60",
                )}
              >
                <span className={cx("h-1.5 w-1.5 rounded-full", SEV_DOT[s])} />
                <span className="capitalize">{s}</span>
                <span className="tabular-nums text-slate-200">{counts[s]}</span>
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {visibleFindings.length === 0 && (
              <p className="px-2 py-4 text-center text-[10px] text-slate-600">
                {findings.length === 0 ? "No findings yet." : `No ${sevFilter} findings.`}
              </p>
            )}
            {visibleFindings.map((f) => (
              <button key={f.id} onClick={() => setFindingId(f.id)} className={cx("flex w-full items-start gap-1.5 border-b border-phantix-700/20 px-2 py-1.5 text-left transition-colors hover:bg-phantix-800/40", findingId === f.id && "bg-phantix-800/50")}>
                <SeverityBadge severity={f.severity} className="mt-0.5 !px-1 !py-0 !text-[8px]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[10px] text-slate-200">{f.title}</span>
                  <span className="mt-0.5 flex items-center gap-1 text-[8px] text-slate-500">
                    {f.status === "validated" ? (
                      <><ShieldCheck size={8} className="text-emerald-400" /> validated</>
                    ) : f.status === "rejected" ? (
                      <><XCircle size={8} className="text-severity-critical" /> rejected</>
                    ) : (
                      <><Clock size={8} className="text-severity-medium" /> candidate</>
                    )}
                  </span>
                </span>
              </button>
            ))}
          </div>
          <AnimatePresence>
            {openFinding && <EvidenceDrawer finding={openFinding} onClose={() => setFindingId(null)} />}
          </AnimatePresence>
        </aside>
      </div>

      <AnimatePresence>
        {gate && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[95] flex items-center justify-center bg-phantix-950/80 p-4 backdrop-blur-sm"
            onClick={() => setGate(null)}
          >
            <motion.div
              initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 12, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-severity-critical/40 bg-phantix-900 p-5 shadow-card"
            >
              <div className="flex items-center gap-2 text-severity-critical">
                <Ban size={16} />
                <p className="font-display text-sm font-semibold">Destructive action gate</p>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-400">This command matches a high-risk pattern (exploit, DoS, or privilege escalation). Confirm you intend to run it against the allowlisted scope only.</p>
              <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-phantix-950/80 p-2.5 font-mono text-[11px] text-slate-200">{overrideDrafts[gate.id] ?? gate.proposed_command}</pre>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => { const a = gate; setGate(null); onDecide(a, true, overrideDrafts[a.id] ?? a.proposed_command); }}
                  className="btn-primary flex-1 !py-2 !text-xs"
                >
                  Confirm & approve
                </button>
                <button onClick={() => setGate(null)} className="btn-ghost flex-1 !py-2 !text-xs">Cancel</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
