import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown, Ban, BrainCircuit, CheckCircle2, ChevronDown, Clock, CornerUpLeft, Crosshair, FileCode2,
  Globe2, Loader2, Lock, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen,
  Pause, Play, Plus, Radar, Send, ShieldAlert, ShieldCheck, Sparkles, Square,
  Terminal, XCircle,
} from "lucide-react";
import { AgentActivityLine, ApprovalNotice, ClarificationAsk, CopyBtn, QueuedPromptStrip, StreamEmpty, StreamMessage, ToolGroupCard, TypingIndicator, type QueuedPrompt } from "@/components/AgiStream";
import { Menu, MenuItem, SeverityBadge } from "@/components/ui";
import { VerificationBadge, verificationBadge } from "@/components/VerificationBadge";
import { groupStreamRows } from "@/lib/agiStreamGroup";
import type { AgiClarification } from "@/lib/agiStreamGroup";
import {
  Steps,
  StepsItem,
  StepsTrigger,
  StepsContent,
} from "@/components/prompt-kit/steps";
import { PaneHeader, ResizeHandle } from "@/components/workbench";
import { useDragResize } from "@/lib/useDragResize";
import { loadAgiFindings, decideAgiFindingVerification } from "@/lib/agi";
import {
  deriveAttackGraph,
  deriveFindings,
  isHighRiskCommand,
  personaForChunk,
  PHASES,
  PERSONAS,
  severityCounts,
  phasesFromSession,
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

// Pane size bounds (px). The fluid `.wb-*` type inside each pane scales with
// its width between these bounds, and double-clicking a handle resets it.
const LEFT = { initial: 360, min: 280, max: 560, reset: 360 };
const RIGHT = { initial: 300, min: 230, max: 460, reset: 300 };

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
    <span className="chip !px-2 !py-0.5 wb-2xs font-mono tabular-nums text-slate-400" title="Session elapsed">
      {hh}:{mm}:{ss}
    </span>
  );
}

function NodeInspector({ node }: { node: AttackNode }) {
  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={cx("h-2 w-2 shrink-0 rounded-full", NODE_DOT[node.status])} />
        <p className="wb-sm min-w-0 font-semibold text-white">{node.label}</p>
        <span className="chip !px-1.5 !py-0 wb-2xs capitalize text-slate-400">{node.status}</span>
        {node.tool && <span className="chip !px-1.5 !py-0 wb-2xs font-mono text-gold-300">{node.tool}</span>}
      </div>

      {node.reasoning[0] ? (
        <div>
          <p className="wb-pane-title mb-1"><BrainCircuit size={10} /> Reasoning</p>
          <p className="wb-xs whitespace-pre-wrap break-words leading-relaxed text-slate-400">{node.reasoning[node.reasoning.length - 1]}</p>
        </div>
      ) : (
        <p className="wb-xs text-slate-500">
          {node.status === "active"
            ? "Working — waiting on first tool result…"
            : node.status === "blocked"
            ? "Blocked — awaiting approval."
            : "No activity on this node yet."}
        </p>
      )}

      {(node.commands.length > 0 || node.outputs.length > 0) && (
        <Steps defaultOpen={false} className="pt-1">
          <StepsItem>
            <StepsTrigger leftIcon={<Terminal size={12} />}>
              Activity
              {node.commands.length > 0 && <span className="tabular-nums"> · {node.commands.length} cmd{node.commands.length !== 1 ? "s" : ""}</span>}
              {node.outputs.length > 0 && <span className="tabular-nums"> · {node.outputs.length} output{node.outputs.length !== 1 ? "s" : ""}</span>}
            </StepsTrigger>
            <StepsContent bar={<span className="block h-full w-[2px] rounded bg-phantix-700/60" />}>
              {node.commands.length > 0 && (
                <div className="space-y-1">
                  {node.commands.slice(-6).map((c, i) => (
                    <p key={i} className="wb-2xs break-all rounded-md bg-phantix-950/70 px-2 py-1.5 font-mono text-slate-300">{c}</p>
                  ))}
                </div>
              )}
              {node.outputs.length > 0 && (
                <div className="wb-scroll max-h-44 space-y-1 overflow-y-auto pr-1">
                  {node.outputs.slice(-8).map((c, i) => (
                    <p key={i} className="wb-2xs whitespace-pre-wrap break-words font-mono leading-relaxed text-slate-400">{c}</p>
                  ))}
                </div>
              )}
            </StepsContent>
          </StepsItem>
        </Steps>
      )}
    </div>
  );
}

function EvidenceDrawer({
  finding,
  onClose,
  sessionId,
  onVerify,
}: {
  finding: AgiFinding;
  onClose: () => void;
  sessionId?: number;
  onVerify?: (verdict: "confirmed" | "rejected", note?: string) => Promise<boolean>;
}) {
  const [tab, setTab] = useState<"evidence" | "autofix">("evidence");
  const [verifying, setVerifying] = useState<"confirmed" | "rejected" | null>(null);
  const v = finding.verification;
  const badge = verificationBadge(v);

  const humanVerify = async (verdict: "confirmed" | "rejected") => {
    if (!onVerify) return;
    setVerifying(verdict);
    await onVerify(verdict);
    setVerifying(null);
  };

  return (
    <motion.div
      initial={{ y: 16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 12, opacity: 0 }}
      className="flex max-h-[52%] shrink-0 flex-col border-t border-phantix-700/40 bg-phantix-950/85"
    >
      <div className="wb-pad-x wb-pad-y flex items-center gap-2 border-b border-phantix-700/30">
        <SeverityBadge severity={finding.severity} />
        <p className="wb-sm min-w-0 flex-1 truncate font-semibold text-white">{finding.title}</p>
        {finding.cve && <span className="chip !px-1.5 !py-0 wb-2xs font-mono text-gold-300">{finding.cve}</span>}
        <div className="flex shrink-0 rounded-lg border border-phantix-700/40 p-0.5">
          <button onClick={() => setTab("evidence")} className={cx("wb-2xs rounded-md px-2 py-0.5", tab === "evidence" ? "bg-phantix-800 text-white" : "text-slate-500")}>Evidence</button>
          <button onClick={() => setTab("autofix")} className={cx("wb-2xs rounded-md px-2 py-0.5", tab === "autofix" ? "bg-phantix-800 text-white" : "text-slate-500")}>Autofix</button>
        </div>
        <button onClick={onClose} className="shrink-0 rounded p-1 text-slate-500 hover:text-slate-200" aria-label="Close evidence"><XCircle size={14} /></button>
      </div>
      <div className="wb-scroll min-h-0 flex-1 overflow-y-auto wb-pad">
        {tab === "evidence" ? (
          <div className="space-y-2">
            {/* Verification layer */}
            <div className="rounded-lg border border-phantix-700/40 bg-phantix-900/40 p-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cx("inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-medium", badge.cls)}>
                  {badge.icon} {badge.label}
                </span>
                {v?.verifier && <span className="wb-2xs font-mono text-slate-500">{v.verifier}</span>}
                {v?.by && <span className="wb-2xs text-slate-600">by {v.by}</span>}
              </div>
              {v?.reason && <p className="wb-2xs mt-1.5 leading-relaxed text-slate-400">{v.reason}</p>}
              {v?.attempted_at && <p className="wb-2xs mt-1 text-slate-600">checked {new Date(v.attempted_at).toLocaleString()}</p>}
              {onVerify && finding.status !== "validated" && finding.status !== "rejected" && (
                <div className="mt-2 flex gap-1.5">
                  <button
                    onClick={() => void humanVerify("confirmed")}
                    disabled={verifying !== null}
                    className="btn-primary flex-1 !py-1 wb-2xs"
                  >
                    {verifying === "confirmed" ? <Loader2 size={11} className="mr-1 inline animate-spin" /> : <CheckCircle2 size={11} className="mr-1 inline" />}
                    Verify
                  </button>
                  <button
                    onClick={() => void humanVerify("rejected")}
                    disabled={verifying !== null}
                    className="btn-ghost flex-1 !py-1 wb-2xs text-severity-critical"
                  >
                    {verifying === "rejected" ? <Loader2 size={11} className="mr-1 inline animate-spin" /> : <XCircle size={11} className="mr-1 inline" />}
                    Dismiss
                  </button>
                </div>
              )}
            </div>
            <p className="wb-2xs break-all font-mono text-slate-500">{finding.target}</p>
            {finding.evidence.request && (
              <div className="group relative">
                <p className="wb-pane-title mb-1">Request <CopyBtn text={finding.evidence.request} className="ml-1" /></p>
                <pre className="wb-2xs whitespace-pre-wrap rounded-lg border border-phantix-700/40 bg-phantix-950/70 p-2 font-mono leading-relaxed text-slate-300">{finding.evidence.request}</pre>
              </div>
            )}
            {finding.evidence.response && (
              <div className="group relative">
                <p className="wb-pane-title mb-1">Response <CopyBtn text={finding.evidence.response} className="ml-1" /></p>
                <pre className="wb-2xs whitespace-pre-wrap rounded-lg border border-phantix-700/40 bg-phantix-950/70 p-2 font-mono leading-relaxed text-slate-300">{finding.evidence.response}</pre>
              </div>
            )}
            <div className="flex flex-wrap gap-1.5 text-slate-500">
              {finding.evidence.hash && <span className="chip !px-1.5 !py-0 wb-2xs font-mono">{finding.evidence.hash}</span>}
              <span className="chip !px-1.5 !py-0 wb-2xs capitalize">{finding.status}</span>
            </div>
            {finding.evidence.notes && <p className="wb-xs leading-relaxed text-slate-400">{finding.evidence.notes}</p>}
          </div>
        ) : finding.autofix ? (
          <div className="space-y-2">
            <p className="wb-xs text-slate-400">{finding.autofix.summary}</p>
            <p className="wb-2xs font-mono text-gold-300">{finding.autofix.file}</p>
            <div className="group relative">
              <pre className="wb-2xs whitespace-pre-wrap rounded-lg border border-gold-400/20 bg-phantix-950/70 p-2.5 font-mono leading-relaxed text-slate-200">{finding.autofix.preview}</pre>
              <CopyBtn text={finding.autofix.preview} className="absolute right-2 top-2" />
            </div>
            <button className="btn-primary w-full !py-1.5 wb-xs"><FileCode2 size={12} className="mr-1 inline" /> Stage pull request</button>
          </div>
        ) : (
          <p className="wb-xs text-slate-500">No autofix preview for this finding.</p>
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
  /** Leave the console and return to the engagement/session picker. */
  onExit?: () => void;
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
  /** Open ASK_OPERATOR clarification awaiting an operator answer. */
  clarification?: AgiClarification | null;
  /** Sends { clarification_id, answer } to /agi/sessions/{id}/clarify. */
  onAnswer?: (clarificationId: string, answer: string) => void;
  policyBanner: string | null;
  overrideDrafts: Record<number, string>;
  onOverrideDraft: (id: number, cmd: string) => void;
  /** Prompts sent mid-turn that the agent has not acted on yet — pinned above the composer. */
  pendingPrompts?: QueuedPrompt[];
  /** Fresh engine output within the window — the agent is actively streaming. */
  streaming?: boolean;
};

export default function AgiConsole({
  running,
  paused,
  onTogglePause,
  stopping,
  onStop,
  onExit,
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
  clarification,
  onAnswer,
  policyBanner,
  overrideDrafts,
  onOverrideDraft,
  pendingPrompts = [],
  streaming = false,
}: AgiConsoleProps) {
  const [persona, setPersona] = useState<AgentPersona | "all">("all");
  const [lanes, setLanes] = useState(false);
  const [showTerm, setShowTerm] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [findingId, setFindingId] = useState<string | null>(null);
  const [sevFilter, setSevFilter] = useState<Severity | null>(null);
  const [gate, setGate] = useState<AgiAction | null>(null);
  const [liveFindings, setLiveFindings] = useState<Record<string, unknown>[]>([]);
  const thoughtsStick = useStickToBottom([transcript, thinking, running]);
  const toolsStick = useStickToBottom([transcript, running]);

  // Findings verification layer: poll the backend's live findings so the
  // verification verdict (auto / subagent / human) rides onto the derived
  // console findings.
  useEffect(() => {
    if (!session?.id) return;
    let cancelled = false;
    const load = () =>
      loadAgiFindings(session.id).then((fs) => {
        if (!cancelled) setLiveFindings(Array.isArray(fs) ? fs : []);
      }).catch(() => {});
    load();
    const t = window.setInterval(load, 15000);
    return () => { cancelled = true; window.clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  const verificationMap = useMemo(() => {
    const m: Record<string, { id?: string; verification?: Record<string, unknown>; status?: string }> = {};
    for (const f of liveFindings) {
      const key = `${String(f.title ?? "").toLowerCase()}|${String(f.target ?? "").toLowerCase()}`;
      if (key !== "|") {
        m[key] = {
          id: String(f.id ?? ""),
          verification: (f.verification as Record<string, unknown> | undefined) ?? undefined,
          status: String(f.status ?? ""),
        };
      }
    }
    return m;
  }, [liveFindings]);

  const findings = useMemo(() => {
    const derived = deriveFindings(transcript, actions, engagement);
    return derived.map((f) => {
      const live = verificationMap[`${f.title.toLowerCase()}|${f.target.toLowerCase()}`];
      if (!live?.verification) return f;
      return { ...f, verification: live.verification as AgiFinding["verification"] };
    });
  }, [transcript, actions, engagement, verificationMap]);

  const handleFindingVerify = async (finding: AgiFinding, verdict: "confirmed" | "rejected") => {
    if (!session?.id) return false;
    const live = verificationMap[`${finding.title.toLowerCase()}|${finding.target.toLowerCase()}`];
    if (!live?.id) return false;
    const ok = await decideAgiFindingVerification(session.id, live.id, verdict);
    if (ok) {
      const fs = await loadAgiFindings(session.id);
      setLiveFindings(Array.isArray(fs) ? fs : []);
    }
    return ok;
  };

  const left = useDragResize({ initial: LEFT.initial, min: LEFT.min, max: LEFT.max, side: "start" });
  const right = useDragResize({ initial: RIGHT.initial, min: RIGHT.min, max: RIGHT.max, side: "end" });

  const nodes = useMemo(
    () => deriveAttackGraph(transcript, actions, running && !paused, phasesFromSession(session.job)),
    [transcript, actions, running, paused, session.job],
  );
  const maxSlots = useMemo(
    () => Math.max(1, ...PHASES.map((phase) => nodes.filter((n) => n.phase === phase.id).length)),
    [nodes],
  );

  const counts = useMemo(() => severityCounts(findings), [findings]);
  const selected = nodes.find((n) => n.id === selectedId) ?? nodes.find((n) => n.status === "active" || n.status === "blocked") ?? nodes[0];
  // The live attack-tree node drives the granular activity label shown in the
  // thinking indicator (e.g. "recon_dns" → "Enumerating subdomains & DNS").
  const livePhaseId = nodes.find((n) => n.status === "active" || n.status === "blocked")?.phaseId ?? null;
  const openFinding = findings.find((f) => f.id === findingId) ?? null;
  const allowlist = engagement?.scope_definition.target_allowlist ?? [];
  const forbidden = engagement?.scope_definition.forbidden_actions ?? [];
  const filtered = useMemo(
    () => transcript.filter((t) => persona === "all" || personaForChunk(t) === persona),
    [transcript, persona],
  );
  const tools = filtered.filter((t) => t.role === "tool");
  // Consecutive same-tool chunks collapse into a single "tool × N" card.
  const groupedFiltered = useMemo(() => groupStreamRows(filtered), [filtered]);
  const groupedTools = useMemo(() => groupStreamRows(tools), [tools]);
  const laneRows = useMemo(
    () => ({
      orchestrator: groupStreamRows(transcript.filter((t) => personaForChunk(t) === "orchestrator")),
      recon: groupStreamRows(transcript.filter((t) => personaForChunk(t) === "recon")),
      exploit: groupStreamRows(transcript.filter((t) => personaForChunk(t) === "exploit")),
    }),
    [transcript],
  );

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

  const tryApprove = (a: AgiAction) => {
    const cmd = overrideDrafts[a.id] ?? a.proposed_command;
    if (isHighRiskCommand(cmd)) { setGate(a); return; }
    onDecide(a, true, cmd);
  };

  const lastIdx = filtered.length - 1;
  const activePersonaLabel = PERSONAS.find((p) => p.id === persona)?.label ?? "All agents";

  return (
    <div className="flex h-full min-h-0 flex-col bg-phantix-950">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-phantix-700/40 bg-phantix-900/40 px-4 py-2">
        <div className="wb-scroll wb-fade-x flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pb-0.5">
          <span className="wb-2xs flex shrink-0 items-center gap-1.5 font-semibold uppercase tracking-[0.16em] text-slate-500">
            <Globe2 size={12} className="text-gold-400" /> Scope
          </span>
          {allowlist.length === 0 && <span className="chip !px-2 !py-0.5 wb-2xs shrink-0 text-slate-500">no allowlist</span>}
          {allowlist.map((t) => (
            <span key={t} className="chip !px-2 !py-0.5 wb-2xs shrink-0 font-mono text-emerald-300 transition-colors hover:border-emerald-400/40" title={t}>{t}</span>
          ))}
          {forbidden.map((f) => (
            <span key={f} className="chip !px-2 !py-0.5 wb-2xs shrink-0 text-severity-critical" title={`Forbidden: ${f}`}>¬ {f}</span>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <SessionClock since={session.started_at} live={running && !paused} />
          <span className={cx("chip !px-2 !py-0.5 wb-2xs", running && !paused ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : paused ? "border-severity-medium/30 bg-severity-medium/10 text-severity-medium" : "border-phantix-600/40 text-slate-400")}>
            {running && !paused && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />}
            {paused ? "paused" : running ? "live" : session.status}
          </span>
          <span className="chip !px-2 !py-0.5 wb-2xs font-mono text-slate-500">#{session.id}</span>
          {onExit && (
            <button onClick={onExit} className="btn-ghost !px-2 !py-1 wb-xs" title="Back to session selection">
              <CornerUpLeft size={12} className="mr-1 inline" /> Sessions
            </button>
          )}
          {running && (
            <button onClick={onTogglePause} className="btn-secondary !px-2.5 !py-1 wb-xs" title={paused ? "Resume agent loop" : "Pause agent loop"}>
              {paused ? <Play size={12} className="mr-1 inline" /> : <Pause size={12} className="mr-1 inline" />}
              {paused ? "Resume" : "Pause"}
            </button>
          )}
          {running && (
            <button onClick={onStop} disabled={stopping} className="btn-secondary !px-2.5 !py-1 wb-xs">
              {stopping ? <Loader2 size={12} className="mr-1 inline animate-spin" /> : <Square size={12} className="mr-1 inline" />} {stopping ? "Stopping…" : "Stop"}
            </button>
          )}
          {!running && onExit && (
            <button onClick={onExit} className="btn-primary !px-2.5 !py-1 wb-xs" title="Start a new session">
              <Plus size={12} className="mr-1 inline" /> New session
            </button>
          )}
        </div>
      </div>

      {policyBanner && (
        <div className="flex items-center gap-2 border-b border-severity-critical/30 bg-severity-critical/10 px-4 py-1.5">
          <Lock size={13} className="shrink-0 text-severity-critical" />
          <p className="wb-xs text-red-300">{policyBanner}</p>
        </div>
      )}

      <div className="flex min-h-0 w-full flex-1">
        {leftOpen ? (
          <>
            <aside className="wb-pane flex shrink-0 flex-col border-r border-phantix-700/40 bg-phantix-900/40" style={{ width: left.size }}>
              <div className="wb-pad shrink-0 border-b border-phantix-700/30">
                <PaneHeader
                  icon={<Crosshair size={12} />}
                  title="Attack tree"
                  right={
                    <>
                      {selectedId && (
                        <button
                          type="button"
                          onClick={() => setSelectedId(null)}
                          className="wb-2xs flex items-center gap-1 rounded px-1.5 py-0.5 font-medium normal-case tracking-normal text-gold-300 transition-colors hover:bg-phantix-800"
                          title="Follow the live node again"
                        >
                          <Radar size={10} /> Follow live
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setLeftOpen(false)}
                        className="rounded p-1 text-slate-500 transition-colors hover:bg-phantix-800 hover:text-slate-200"
                        title="Collapse attack tree"
                        aria-label="Collapse attack tree"
                      >
                        <PanelLeftClose size={14} />
                      </button>
                    </>
                  }
                />
                <div className="mt-2 grid gap-1" style={{ gridTemplateColumns: `repeat(${PHASES.length}, minmax(0, 1fr))` }}>
                  {PHASES.map((phase) => {
                    const stat = phaseStats.find((p) => p.id === phase.id);
                    const pct = stat && stat.total > 0 ? Math.round((stat.done / stat.total) * 100) : 0;
                    return (
                      <div key={phase.id} className="min-w-0">
                        <p className={cx("wb-2xs truncate text-center font-semibold uppercase tracking-wider", stat?.live ? "text-gold-300" : "text-slate-500")} title={phase.label}>
                          <span className="at-long">{phase.label}</span>
                          <span className="at-short">{phase.short}</span>
                        </p>
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
                            <span className={cx("h-1.5 w-1.5 rounded-full", NODE_DOT[n.status])} title={`${n.label} · ${n.status}`} />
                            <span className="wb-2xs line-clamp-2 leading-tight text-slate-200">
                              <span className="at-long">{n.label}</span>
                              <span className="at-short">{n.short}</span>
                            </span>
                            {n.tool && <span className="wb-2xs max-w-full truncate font-mono text-slate-500">{n.tool}</span>}
                          </button>
                        ) : (
                          <div key={`${phase.id}-empty-${i}`} className="min-h-[46px] flex-1 rounded-md border border-dashed border-phantix-700/30" />
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="wb-scroll min-h-0 flex-1 overflow-y-auto wb-pad">
                {selected ? <NodeInspector node={selected} /> : <p className="wb-xs text-slate-500">Select a node.</p>}
              </div>
            </aside>
            <ResizeHandle onMouseDown={left.onHandleMouseDown} dragging={left.dragging} label="Resize attack tree pane" onDoubleClick={() => left.setSize(LEFT.reset)} />
          </>
        ) : (
          <button
            type="button"
            onClick={() => setLeftOpen(true)}
            className="flex w-7 shrink-0 flex-col items-center justify-start gap-2 border-r border-phantix-700/40 bg-phantix-900/40 pt-3 text-slate-500 transition-colors hover:text-gold-300"
            title="Expand attack tree"
            aria-label="Expand attack tree"
          >
            <PanelLeftOpen size={14} />
            <span className="wb-2xs font-semibold uppercase tracking-widest [writing-mode:vertical-rl]">Attack tree</span>
          </button>
        )}

        <div className="wb-pane relative flex min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-phantix-700/30 bg-phantix-950/80 px-3 py-1.5">
            <Menu
              align="left"
              trigger={
                <span className="wb-xs flex cursor-pointer items-center gap-1.5 rounded-md border border-phantix-700/40 bg-phantix-900/50 px-2.5 py-1 font-medium text-slate-300 transition-colors hover:border-gold-400/40 hover:text-gold-200">
                  <BrainCircuit size={12} className="text-gold-400" />
                  {activePersonaLabel}
                  <span className="wb-2xs rounded-full bg-phantix-800/80 px-1 tabular-nums text-slate-400">{personaCounts[persona]}</span>
                  <ChevronDown size={12} className="text-slate-500" />
                </span>
              }
            >
              {(close) => (
                <>
                  {PERSONAS.map((p) => (
                    <MenuItem
                      key={p.id}
                      active={persona === p.id}
                      onClick={() => { setPersona(p.id); close(); }}
                      icon={<span className={cx("h-1.5 w-1.5 rounded-full", p.id === "all" ? "bg-slate-500" : p.id === "orchestrator" ? "bg-gold-400" : p.id === "recon" ? "bg-severity-low" : "bg-severity-high")} />}
                    >
                      <span className="flex w-full items-center justify-between gap-4">
                        {p.label}
                        <span className="tabular-nums text-slate-500">{personaCounts[p.id]}</span>
                      </span>
                    </MenuItem>
                  ))}
                </>
              )}
            </Menu>
            <span className="mx-1 h-3.5 w-px bg-phantix-700/50" />
            <button
              onClick={() => setLanes((v) => !v)}
              className={cx("wb-xs rounded-md px-2 py-1 transition-colors", lanes ? "bg-phantix-800 text-white" : "text-slate-500 hover:text-slate-300")}
            >
              Swimlanes
            </button>
            <button
              onClick={() => setShowTerm((v) => !v)}
              className={cx("wb-xs flex items-center gap-1 rounded-md px-2 py-1 transition-colors", showTerm ? "bg-phantix-800 text-white" : "text-slate-500 hover:text-slate-300")}
            >
              <Terminal size={12} /> Terminal
            </button>
          </div>

          <div className="relative min-h-0 flex-1">
            {lanes ? (
              <div className="grid h-full grid-cols-3 divide-x divide-phantix-700/30">
                {(["orchestrator", "recon", "exploit"] as AgentPersona[]).map((lane) => (
                  <div key={lane} className="wb-pane wb-scroll min-h-0 space-y-1.5 overflow-y-auto wb-pad">
                    <p className="wb-pane-title sticky top-0 z-10 -mx-1 bg-phantix-950/95 px-1 pb-1.5">
                      {PERSONAS.find((p) => p.id === lane)?.label}
                      <span className="wb-2xs ml-auto rounded-full bg-phantix-800/80 px-1 tabular-nums text-slate-400">{personaCounts[lane]}</span>
                    </p>
                    {laneRows[lane].map((row, i) => (
                      row.kind === "toolGroup" ? (
                        <ToolGroupCard key={`${lane}-${i}`} tool={row.tool} runs={row.runs} dense />
                      ) : (
                        <StreamMessage key={`${lane}-${i}`} t={row.t} dense />
                      )
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div ref={thoughtsStick.scrollerRef} onScroll={thoughtsStick.onScroll} className="wb-scroll h-full space-y-2 overflow-y-auto px-3 py-2.5">
                {connError && (
                  <div className="flex items-center gap-2 rounded-xl border border-severity-critical/40 bg-severity-critical/10 px-3 py-2">
                    <Lock size={13} className="shrink-0 text-severity-critical" />
                    <p className="wb-xs text-red-300">{connError}</p>
                  </div>
                )}
                {filtered.length === 0 && !connError && (
                  <StreamEmpty
                    title={persona === "all" ? "Waiting for orchestrator output…" : `No ${PERSONAS.find((p) => p.id === persona)?.label ?? "agent"} messages yet`}
                    hint="Live turns, tool calls, and engine events stream here as the agent works through the scoped assessment."
                  />
                )}
                {groupedFiltered.map((row, i) =>
                  row.kind === "toolGroup" ? (
                    <ToolGroupCard key={`st-${i}`} tool={row.tool} runs={row.runs} />
                  ) : (
                    <StreamMessage key={`st-${i}`} t={row.t} last={i === lastIdx && running && !paused && row.t.role !== "operator"} />
                  ),
                )}
                {!connError && actions.length > 0 && (
                  <ApprovalNotice
                    count={actions.length}
                    stateChanging={actions.some((a) => a.action_type === "state_changing")}
                    authorizationsHref="/authorizations"
                  />
                )}
                {thinking && !paused && !clarification && <TypingIndicator workingOn={(workingOn || "").trim() || undefined} phaseId={livePhaseId} />}
                {paused && <p className="wb-xs text-severity-medium">Loop paused — agent will not advance.</p>}
                <div ref={thoughtsStick.endRef} />
              </div>
            )}

            <div className="pointer-events-none absolute inset-x-2 bottom-2 z-10 flex flex-col gap-2">
              {showTerm && (
                <div className="pointer-events-auto max-h-[42%] overflow-hidden rounded-lg border border-phantix-700/40 bg-phantix-950/95 shadow-card">
                  <p className="wb-pane-title border-b border-phantix-700/30 wb-pad-x wb-pad-y">
                    <Terminal size={11} /> Terminal
                    <span className="wb-2xs ml-auto rounded-full bg-phantix-800/80 px-1.5 tabular-nums text-slate-400">{tools.length}</span>
                  </p>
                  <div ref={toolsStick.scrollerRef} onScroll={toolsStick.onScroll} className="wb-scroll max-h-44 space-y-1.5 overflow-y-auto wb-pad">
                    {tools.length === 0 && <p className="wb-xs py-3 text-center text-slate-600">No tool output yet.</p>}
                    {groupedTools.map((row, i) =>
                      row.kind === "toolGroup" ? (
                        <ToolGroupCard key={`tl-${i}`} tool={row.tool} runs={row.runs} dense />
                      ) : (
                        <StreamMessage key={`tl-${i}`} t={row.t} dense />
                      ),
                    )}
                    <div ref={toolsStick.endRef} />
                  </div>
                </div>
              )}

              {actions.length > 0 && (
                <div className="wb-scroll pointer-events-auto max-h-[38%] space-y-1.5 overflow-y-auto rounded-lg border border-severity-medium/30 bg-phantix-950/95 p-2 shadow-card">
                  <p className="wb-pane-title !text-severity-medium">
                    <ShieldCheck size={11} /> Human gate · {actions.length}
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
                            {busy ? <Loader2 size={12} className="animate-spin text-severity-medium" /> : <Radar size={12} className="text-severity-medium" />}
                            <p className="wb-sm font-semibold text-amber-200">{a.tool_name ?? "state-changing step"}</p>
                            {risky && <span className="chip !px-1.5 !py-0 wb-2xs text-severity-critical">gate</span>}
                            {busy && <span className="wb-2xs ml-auto text-slate-500">recording decision…</span>}
                          </div>
                          <textarea value={draft} onChange={(e) => onOverrideDraft(a.id, e.target.value)} rows={2} className="wb-xs w-full rounded-md border border-phantix-700/50 bg-phantix-950/70 px-2 py-1 font-mono text-slate-200 outline-none focus:border-gold-400/40" />
                          {a.rationale && <p className="wb-2xs mt-1 line-clamp-2 leading-relaxed text-slate-500">{a.rationale}</p>}
                          <div className="mt-1.5 flex gap-1.5">
                            <button onClick={() => tryApprove(a)} disabled={busy} className="btn-primary flex-1 !px-2 !py-1 wb-xs"><CheckCircle2 size={12} className="mr-1 inline" /> Approve</button>
                            <button onClick={() => onDecide(a, false)} disabled={busy} className="btn-ghost flex-1 !px-2 !py-1 wb-xs text-severity-critical"><XCircle size={12} className="mr-1 inline" /> Reject</button>
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
                    <span className="wb-2xs rounded-full bg-gold-400/20 px-1.5 font-semibold tabular-nums text-gold-300">
                      {thoughtsStick.unseen > 99 ? "99+" : thoughtsStick.unseen}
                    </span>
                  )}
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          <div className="shrink-0 border-t border-phantix-700/40 p-3">
            {pendingPrompts.length > 0 && (
              <div className="mb-2">
                <QueuedPromptStrip prompts={pendingPrompts} />
              </div>
            )}
            <div className="mb-2">
              <AgentActivityLine
                activity={{
                  running,
                  paused,
                  thinking,
                  streaming,
                  workingOn,
                  phaseId: livePhaseId,
                  approvals: actions.length,
                  clarification: Boolean(clarification),
                  connError,
                  sessionStatus: session.status,
                }}
              />
            </div>
            {clarification && onAnswer && (
              <div className="mx-auto mb-2 max-w-3xl">
                <ClarificationAsk
                  clarification={clarification}
                  onAnswer={onAnswer}
                />
              </div>
            )}
            {running && !paused && !instruction.trim() && (
              <div className="mx-auto mb-2 flex max-w-3xl flex-wrap items-center gap-1.5">
                <Sparkles size={11} className="text-gold-400/70" />
                {COMPOSER_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onInstruction(s)}
                    className="wb-xs rounded-full border border-phantix-700/50 bg-phantix-900/50 px-2.5 py-0.5 text-slate-400 transition-colors hover:border-gold-400/40 hover:text-gold-200"
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
                className="wb-md flex-1 resize-none overflow-hidden bg-transparent text-slate-200 outline-none placeholder:text-slate-500 disabled:opacity-50"
                style={{ minHeight: "24px", maxHeight: "120px" }}
              />
              <button onClick={onSend} disabled={!running || paused || !instruction.trim()} className="btn-primary mt-0.5 !px-3 !py-1.5 wb-xs" aria-label="Send"><Send size={14} /></button>
            </div>
            <p className="wb-xs mt-1.5 flex items-center gap-1.5 text-slate-600">
              <ShieldCheck size={11} className="shrink-0" />
              {sendHint === "queued"
                ? "Queued — press Enter again to send now, or wait for the current reply."
                : "Scoped to allowlist · high-risk actions require a second confirmation · pause freezes the loop"}
              <span className="ml-auto hidden shrink-0 items-center gap-1 sm:flex">
                <kbd className="wb-2xs rounded border border-phantix-700/50 bg-phantix-900/60 px-1 font-mono text-slate-500">Enter</kbd> send
                <kbd className="wb-2xs rounded border border-phantix-700/50 bg-phantix-900/60 px-1 font-mono text-slate-500">Shift+Enter</kbd> newline
              </span>
            </p>
          </div>
        </div>

        {rightOpen ? (
          <>
            <ResizeHandle onMouseDown={right.onHandleMouseDown} dragging={right.dragging} label="Resize findings pane" onDoubleClick={() => right.setSize(RIGHT.reset)} />
            <aside className="wb-pane flex shrink-0 flex-col border-l border-phantix-700/40 bg-phantix-900/40" style={{ width: right.size }}>
              <PaneHeader
                icon={<ShieldAlert size={12} className="text-severity-high" />}
                title="Findings"
                className="wb-pad-x border-b border-phantix-700/30 py-2"
                right={
                  <>
                    <span className="wb-2xs rounded-full bg-phantix-800/80 px-1.5 tabular-nums text-slate-400">{findings.length}</span>
                    <button
                      type="button"
                      onClick={() => setRightOpen(false)}
                      className="rounded p-1 text-slate-500 transition-colors hover:bg-phantix-800 hover:text-slate-200"
                      title="Collapse findings"
                      aria-label="Collapse findings"
                    >
                      <PanelRightClose size={14} />
                    </button>
                  </>
                }
              />
              <div className="wb-scroll wb-fade-x flex gap-1 overflow-x-auto border-b border-phantix-700/20 wb-pad-x py-1.5">
                {SEV_ORDER.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSevFilter((cur) => (cur === s ? null : s))}
                    title={`Filter ${s} findings`}
                    className={cx(
                      "wb-2xs inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-slate-400 transition-colors",
                      sevFilter === s ? "bg-phantix-800 text-white ring-1 ring-gold-400/30" : "hover:bg-phantix-800/60",
                    )}
                  >
                    <span className={cx("h-1.5 w-1.5 rounded-full", SEV_DOT[s])} />
                    <span className="capitalize">{s}</span>
                    <span className="tabular-nums text-slate-200">{counts[s]}</span>
                  </button>
                ))}
              </div>
              <div className="wb-scroll min-h-0 flex-1 overflow-y-auto">
                {visibleFindings.length === 0 && (
                  <p className="wb-xs px-3 py-6 text-center text-slate-600">
                    {findings.length === 0 ? "No findings yet." : `No ${sevFilter} findings.`}
                  </p>
                )}
                {visibleFindings.map((f) => (
                  <button key={f.id} onClick={() => setFindingId(f.id)} className={cx("wb-pad-x flex w-full items-start gap-1.5 border-b border-phantix-700/20 py-1.5 text-left transition-colors hover:bg-phantix-800/40", findingId === f.id && "bg-phantix-800/50")}>
                    <SeverityBadge severity={f.severity} className="mt-0.5 !px-1 !py-0 !text-[8px]" />
                    <span className="min-w-0 flex-1">
                      <span className="wb-xs block truncate text-slate-200">{f.title}</span>
                      <span className="wb-2xs mt-0.5 flex items-center gap-1 text-slate-500">
                        {f.status === "validated" ? (
                          <><ShieldCheck size={9} className="text-emerald-400" /> validated</>
                        ) : f.status === "rejected" ? (
                          <><XCircle size={9} className="text-severity-critical" /> rejected</>
                        ) : (
                          <><Clock size={9} className="text-severity-medium" /> candidate</>
                        )}
                      </span>
                      {f.verification && (
                        <span className="mt-1 flex">
                          <VerificationBadge verification={f.verification} className="!px-1 !py-0 !text-[8px]" />
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
              <AnimatePresence>
                {openFinding && (
                  <EvidenceDrawer
                    finding={openFinding}
                    onClose={() => setFindingId(null)}
                    sessionId={session?.id}
                    onVerify={(verdict) => handleFindingVerify(openFinding, verdict)}
                  />
                )}
              </AnimatePresence>
            </aside>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setRightOpen(true)}
            className="flex w-7 shrink-0 flex-col items-center justify-start gap-2 border-l border-phantix-700/40 bg-phantix-900/40 pt-3 text-slate-500 transition-colors hover:text-gold-300"
            title="Expand findings"
            aria-label="Expand findings"
          >
            <PanelRightOpen size={14} />
            <span className="wb-2xs font-semibold uppercase tracking-widest [writing-mode:vertical-rl]">Findings</span>
            {findings.length > 0 && (
              <span className="wb-2xs rounded-full bg-severity-high/20 px-1 tabular-nums text-severity-high">{findings.length}</span>
            )}
          </button>
        )}
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
