import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Send, ShieldCheck, Loader2, Radar, Square, Terminal, ChevronDown, ChevronRight,
  Plus, Lock, CheckCircle2, XCircle, Globe2, ArrowDown,
} from "lucide-react";
import { Modal, Spinner } from "@/components/ui";
import LottiePlayer from "@/components/LottiePlayer";
import ghostData from "@/lib/animations/ghostsmart.json";
import {
  loadAgiAccess,
  loadAgiAgreement,
  acceptAgiAgreement,
  loadAgiEngagements,
  createAgiEngagement,
  startAgiSession,
  agiChat,
  loadAgiTranscript,
  loadAgiPendingActions,
  decideAgiAction,
  stopAgiSession,
  isAgiPolicyBlocked,
} from "@/lib/agi";
import type { AgiAccess, AgiAction, AgiEngagement, AgiSession, AgiTranscriptChunk } from "@/lib/types";
import { cx } from "@/lib/utils";
import { useStore } from "@/lib/store";

const POLL_MS = 2000;
const ACTION_POLL_MS = 3000;

type WorkspaceVariant = "drawer" | "page";

/** Render one transcript line as a terminal-ish stream. */
function TxLine({ t, last }: { t: AgiTranscriptChunk; last: boolean }) {
  const isTool = t.role === "tool";
  const isSystem = t.role === "system";
  const isOperator = t.role === "operator";
  const toolName = t.meta && typeof t.meta.tool === "string" ? (t.meta.tool as string) : null;
  return (
    <div className={cx("flex", isOperator ? "justify-end" : "justify-start")}>
      <div
        className={cx(
          "max-w-[92%] rounded-xl px-3 py-2 text-[12.5px] leading-5",
          isOperator && "bg-gold-400/15 border border-gold-400/20 text-gold-100",
          !isOperator && isTool && "border border-phantix-700/40 bg-phantix-950/70 font-mono text-[11px] text-slate-300",
          !isOperator && isSystem && "font-mono text-[11px] text-slate-500",
          !isOperator && !isTool && !isSystem && "border border-phantix-700/40 bg-phantix-800/60 text-slate-200",
        )}
      >
        {isTool && (
          <span className="mb-1 flex items-center gap-1.5 text-[10px] text-gold-400">
            <Terminal size={10} /> {toolName ?? "tool"}
          </span>
        )}
        {isSystem && <span className="mr-1 text-[10px] text-slate-600">engine</span>}
        <span className="whitespace-pre-wrap break-words">{t.content}</span>
        {last && !isOperator && <span className="ml-0.5 inline-block h-3 w-[6px] animate-pulse rounded-sm bg-gold-400/70 align-middle" />}
      </div>
    </div>
  );
}

function ActionCard({
  a,
  onDecide,
  busy,
}: {
  a: AgiAction;
  onDecide: (approve: boolean) => void;
  busy: boolean;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-xl border border-severity-medium/30 bg-severity-medium/5 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-severity-medium/15 text-severity-medium"><ShieldCheck size={13} /></span>
          <div>
            <p className="text-xs font-semibold text-amber-200">State-changing step</p>
            <p className="text-[10px] text-slate-500">pending approval</p>
          </div>
        </div>
        <button onClick={() => setOpen((v) => !v)} className="text-slate-500 hover:text-slate-300">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>
      {open && (
        <div className="mt-2.5 space-y-2">
          <p className="rounded-lg bg-phantix-950/70 px-2.5 py-2 font-mono text-[11px] leading-5 text-slate-200">{a.proposed_command}</p>
          {a.rationale && <p className="text-[11px] leading-4 text-slate-400">{a.rationale}</p>}
          <div className="flex items-center gap-2 pt-0.5">
            <button onClick={() => onDecide(true)} disabled={busy} className="btn-primary flex-1 !px-2 !py-1.5 !text-[11px]"><CheckCircle2 size={12} className="mr-1 inline" /> Approve</button>
            <button onClick={() => onDecide(false)} disabled={busy} className="btn-ghost flex-1 !px-2 !py-1.5 !text-[11px] text-severity-critical hover:text-severity-critical"><XCircle size={12} className="mr-1 inline" /> Reject</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AgiWorkspace({ variant = "drawer" }: { variant?: WorkspaceVariant }) {
  const { toast, requireDualControl } = useStore();
  const [access, setAccess] = useState<AgiAccess | null>(null);
  const [booting, setBooting] = useState(true);

  // Agreement
  const [agreementOpen, setAgreementOpen] = useState(false);
  const [agreementBody, setAgreementBody] = useState("");
  const [agreementChecked, setAgreementChecked] = useState(false);
  const [accepting, setAccepting] = useState(false);

  // Engagements
  const [engagements, setEngagements] = useState<AgiEngagement[]>([]);
  const [engLoading, setEngLoading] = useState(false);
  const [selectedEng, setSelectedEng] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAllowlist, setNewAllowlist] = useState("");
  const [newRoe, setNewRoe] = useState("");
  const [creating, setCreating] = useState(false);

  // Session + stream
  const [session, setSession] = useState<AgiSession | null>(null);
  const [instruction, setInstruction] = useState("");
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [transcript, setTranscript] = useState<AgiTranscriptChunk[]>([]);
  const afterSeqRef = useRef(0);
  const [actions, setActions] = useState<AgiAction[]>([]);
  const [actionBusy, setActionBusy] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [policyBanner, setPolicyBanner] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [connError, setConnError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const boot = useCallback(async () => {
    setBooting(true);
    try {
      const a = await loadAgiAccess();
      setAccess(a);
      if (a.agi.can_use) {
        const engs = await loadAgiEngagements();
        setEngagements(engs);
        if (engs.length > 0) setSelectedEng(engs[0].id);
      }
    } catch (e) {
      toast("error", "Could not load AGI access", e instanceof Error ? e.message : "");
    } finally {
      setBooting(false);
    }
  }, [toast]);

  useEffect(() => { void boot(); }, [boot]);

  // Scroll to bottom on new lines.
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [transcript, actions, running]);

  // Track scroll position: show the "jump to bottom" button when the user
  // scrolls up away from the latest terminal output.
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    setShowScrollBtn(!atBottom);
  };

  const scrollToBottom = () => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowScrollBtn(false);
  };

  const openAgreement = async () => {
    try {
      const a = await loadAgiAgreement();
      setAgreementBody(a.body_md);
      setAgreementChecked(false);
      setAgreementOpen(true);
    } catch (e) { toast("error", "Could not load agreement", e instanceof Error ? e.message : ""); }
  };

  const accept = async () => {
    setAccepting(true);
    try {
      await acceptAgiAgreement("app");
      setAgreementOpen(false);
      toast("success", "Agreement accepted", "Autonomous Pentest Agent unlocked for this organization.");
      await boot();
    } catch (e) {
      toast("error", "Accept failed", e instanceof Error ? e.message : "");
    } finally {
      setAccepting(false);
    }
  };

  const createEngagement = async () => {
    const targets = newAllowlist.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    if (!newName.trim() || targets.length === 0) {
      toast("error", "Name and at least one target are required");
      return;
    }
    setCreating(true);
    try {
      const eng = await createAgiEngagement({
        name: newName.trim(),
        description: "",
        scope: {
          target_allowlist: targets,
          forbidden_actions: ["dos", "ransomware", "data_exfil_bulk"],
          rules_of_engagement: newRoe.trim() || "Authorized targets only. No destructive actions.",
        },
      });
      setEngagements((prev) => [eng, ...prev]);
      setSelectedEng(eng.id);
      setCreateOpen(false);
      setNewName("");
      setNewAllowlist("");
      setNewRoe("");
      toast("success", "Engagement created", eng.name);
    } catch (e) {
      const code = (e as any)?.detail?.code;
      if (code === "allowlist_too_large") toast("error", "Too many targets", `Reduce the allowlist (max ${access?.agi.limits.max_allowlist_targets ?? 10}).`);
      else toast("error", "Create failed", e instanceof Error ? e.message : "");
    } finally {
      setCreating(false);
    }
  };

  const start = async () => {
    const msg = instruction.trim();
    if (!selectedEng || !msg) return;
    if (!(await requireDualControl("Starting an Autonomous Pentest Agent session requires a dual-control operate session."))) return;
    setStarting(true);
    setPolicyBanner(null);
    try {
      const s = await startAgiSession(selectedEng, msg);
      setSession(s);
      setRunning(true);
      setTranscript([]);
      afterSeqRef.current = 0;
      setActions([]);
      setInstruction("");
      toast("success", "Session started", "Streaming live from the engagement container...");
    } catch (e) {
      const blocked = isAgiPolicyBlocked(e);
      if (blocked) { setPolicyBanner(blocked.message); toast("warning", "Policy blocked", blocked.message); }
      else toast("error", "Start failed", e instanceof Error ? e.message : "");
    } finally {
      setStarting(false);
    }
  };

  const stop = async () => {
    if (!session) return;
    if (!(await requireDualControl("Stopping an Autonomous Pentest Agent session requires a dual-control operate session."))) return;
    setStopping(true);
    try {
      const s = await stopAgiSession(session.id);
      setSession(s);
      setRunning(false);
      toast("success", "Session stopped", "Container destroyed · report tagged phantix_agi");
    } catch (e) {
      toast("error", "Stop failed", e instanceof Error ? e.message : "");
    } finally {
      setStopping(false);
    }
  };

  const send = async () => {
    const msg = instruction.trim();
    if (!session || !msg || !running) return;
    if (!(await requireDualControl("Sending instructions to the Autonomous Pentest Agent requires a dual-control operate session."))) return;
    setInstruction("");
    setConnError(null);
    setTranscript((prev) => [...prev, { seq: -1, role: "operator", content: msg, meta: null, created_at: new Date().toISOString() }]);
    setThinking(true);
    try {
      await agiChat(session.id, msg);
    } catch (e: any) {
      setThinking(false);
      const blocked = isAgiPolicyBlocked(e);
      if (blocked) { setPolicyBanner(blocked.message); toast("warning", "Policy blocked", blocked.message); return; }
      // Connection failures: "Failed to fetch" (network/backend down) vs timeout (server unavailability).
      const name = String(e?.name ?? "");
      const message = String(e?.message ?? "");
      if (name === "TimeoutError" || name === "AbortError" || /timeout|timed out/i.test(message)) {
        setConnError("Timed out — the agent server is unavailable. Check your connection and try again.");
      } else if (/failed to fetch|networkerror|network error|load failed|fetch/i.test(message)) {
        setConnError("Failed to fetch — could not reach the agent server. Check your connection and try again.");
      } else {
        setConnError(message || "Failed to reach the agent server.");
      }
      toast("error", "Chat failed", e instanceof Error ? e.message : "");
    } finally {
      setThinking(false);
    }
  };

  const decide = async (action: AgiAction, approve: boolean) => {
    if (!(await requireDualControl("Approving a state-changing step requires a dual-control operate session."))) return;
    setActionBusy(action.id);
    try {
      await decideAgiAction(action.id, approve, approve ? "Within ROE" : "");
      setActions((prev) => prev.filter((x) => x.id !== action.id));
      toast("success", approve ? "Step approved" : "Step rejected");
    } catch (e: any) {
      const code = e?.detail?.code;
      if (code === "state_changing_disabled") toast("error", "State-changing disabled", "Your organization has disabled active steps.");
      else if (code === "dual_control_same_approver") toast("warning", "Dual control", "A second, different user must approve this step.");
      else toast("error", "Decision failed", e instanceof Error ? e.message : "");
    } finally {
      setActionBusy(null);
    }
  };

  // Transcript poll while running.
  useEffect(() => {
    if (!running || !session) return;
    const t = window.setInterval(async () => {
      try {
        const chunks = await loadAgiTranscript(session.id, afterSeqRef.current);
        if (chunks.length > 0) {
          setTranscript((prev) => [...prev, ...chunks]);
          afterSeqRef.current = Math.max(afterSeqRef.current, ...chunks.map((c) => c.seq));
          // New engine output means the agent has replied — drop the thinking cue.
          setThinking(false);
          setConnError(null);
        }
      } catch { /* transient — keep polling */ }
    }, POLL_MS);
    return () => window.clearInterval(t);
  }, [running, session]);

  // Pending actions poll while running.
  useEffect(() => {
    if (!running || !session) return;
    const t = window.setInterval(async () => {
      try {
        const acts = await loadAgiPendingActions(session.id);
        setActions(acts);
      } catch { /* transient */ }
    }, ACTION_POLL_MS);
    return () => window.clearInterval(t);
  }, [running, session]);

  if (booting) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <div className="text-center">
          <Spinner className="mx-auto h-6 w-6" />
          <p className="mt-3 text-xs text-slate-500">Checking AGI availability...</p>
        </div>
      </div>
    );
  }

  const canUse = Boolean(access?.agi.can_use);
  const agreementRequired = Boolean(access?.agi.agreement_required);
  const selected = engagements.find((e) => e.id === selectedEng) ?? null;

  return (
    <div className="flex h-full flex-col">
      {/* Header — only the standalone page renders its own (the drawer provides one) */}
      {variant === "page" && (
        <div className="flex items-center gap-3 border-b border-phantix-700/40 px-4 py-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 text-phantix-950"><Radar size={18} /></span>
          <div className="min-w-0">
            <p className="font-display text-sm font-semibold text-white">Autonomous Pentest Agent</p>
            <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
              human-gated · scoped · terminal-access
              {running && <span className="flex items-center gap-1 text-gold-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold-400" /> live</span>}
            </p>
          </div>
          {running && (
            <button onClick={() => void stop()} disabled={stopping} className="ml-auto btn-secondary !px-3 !py-1.5 !text-xs" title="Stop session">
              <Square size={12} className="mr-1 inline" /> {stopping ? "Stopping..." : "Stop"}
            </button>
          )}
        </div>
      )}

      {/* Policy banner */}
      {policyBanner && (
        <div className="flex items-center gap-2 border-b border-severity-critical/30 bg-severity-critical/10 px-4 py-2">
          <Lock size={13} className="shrink-0 text-severity-critical" />
          <p className="text-[11px] leading-4 text-red-300">{policyBanner}</p>
        </div>
      )}

      {/* Blocked state */}
      {!canUse && !agreementRequired && (
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <Lock size={26} className="text-slate-500" />
          <p className="mt-3 text-sm font-semibold text-slate-200">Autonomous Pentest Agent unavailable</p>
          <ul className="mt-3 space-y-1.5 text-xs text-slate-500">
            {access?.agi.blockers.map((b) => (
              <li key={b.code} className="flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-slate-600" /> {b.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Agreement required — first-time gate */}
      {!canUse && agreementRequired && (
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold-400/10 text-gold-400"><ShieldCheck size={22} /></span>
          <p className="mt-3 text-sm font-semibold text-slate-200">Accept the usage agreement to continue</p>
          <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">
            The Autonomous Pentest Agent only runs against your approved engagement allowlist. State-changing steps pause for your approval.
          </p>
          <button onClick={() => void openAgreement()} className="btn-primary mt-4 !text-xs"><ShieldCheck size={13} /> Review & accept agreement</button>
        </div>
      )}

      {/* Main workspace */}
      {canUse && (
        <div className="flex min-h-0 flex-1 flex-col">
          {!session ? (
            /* No session — engagement picker / create */
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">1 · Choose an engagement</p>
                <button onClick={() => setCreateOpen((v) => !v)} className="btn-ghost !px-2 !py-1 !text-[11px]"><Plus size={12} className="mr-1 inline" /> New</button>
              </div>
              {engLoading ? (
                <div className="space-y-2">
                  <div className="skeleton h-16 rounded-xl" />
                  <div className="skeleton h-16 rounded-xl" />
                </div>
              ) : (
                <div className="space-y-2">
                  {engagements.length === 0 && !createOpen && (
                    <p className="rounded-xl border border-dashed border-phantix-700/50 px-3 py-4 text-center text-xs text-slate-500">No engagements yet. Create one with a tight allowlist to start.</p>
                  )}
                  {engagements.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => setSelectedEng(e.id)}
                      className={cx(
                        "w-full rounded-xl border px-3 py-2.5 text-left transition-colors",
                        selectedEng === e.id ? "border-gold-400/50 bg-gold-400/5" : "border-phantix-700/40 bg-phantix-900/40 hover:border-phantix-500/40",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Globe2 size={13} className="shrink-0 text-gold-400" />
                        <span className="truncate text-xs font-semibold text-slate-200">{e.name}</span>
                        <span className={cx("ml-auto chip !text-[9px]", e.status === "ready" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-phantix-600/40 bg-phantix-800/50 text-slate-400")}>{e.status}</span>
                      </div>
                      <p className="mt-1 truncate font-mono text-[10px] text-slate-500">{e.scope_definition.target_allowlist.join(" · ") || "no targets"}</p>
                    </button>
                  ))}
                </div>
              )}

              {createOpen && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2 rounded-xl border border-phantix-700/40 bg-phantix-900/50 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">New engagement</p>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Name (e.g. Lab external web)"
                    className="w-full rounded-lg border border-phantix-700/50 bg-phantix-950/60 px-3 py-2 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-gold-400/40"
                  />
                  <textarea
                    value={newAllowlist}
                    onChange={(e) => setNewAllowlist(e.target.value)}
                    placeholder={`Target allowlist (one per line)${access?.agi.limits.max_allowlist_targets ? ` — max ${access.agi.limits.max_allowlist_targets}` : ""}\nhttps://lab.example.com\n10.0.0.0/24`}
                    rows={3}
                    className="w-full rounded-lg border border-phantix-700/50 bg-phantix-950/60 px-3 py-2 font-mono text-[11px] text-slate-200 outline-none placeholder:text-slate-600 focus:border-gold-400/40"
                  />
                  <input
                    value={newRoe}
                    onChange={(e) => setNewRoe(e.target.value)}
                    placeholder="Rules of engagement (optional)"
                    className="w-full rounded-lg border border-phantix-700/50 bg-phantix-950/60 px-3 py-2 text-[11px] text-slate-200 outline-none placeholder:text-slate-600 focus:border-gold-400/40"
                  />
                  <button onClick={() => void createEngagement()} disabled={creating} className="btn-primary w-full !py-2 !text-xs">
                    {creating ? <Loader2 size={12} className="mr-1 animate-spin inline" /> : <Plus size={12} className="mr-1 inline" />} Create engagement
                  </button>
                </motion.div>
              )}

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">2 · Instruction</p>
                <textarea
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void start(); }}
                  placeholder="Give the agent an explicit instruction, e.g. “Perform read-only recon of the allowlisted hosts and propose any active verification steps.”"
                  rows={3}
                  disabled={!selectedEng}
                  className="mt-2 w-full rounded-xl border border-phantix-700/50 bg-phantix-950/60 px-3 py-2 text-xs leading-5 text-slate-200 outline-none placeholder:text-slate-600 focus:border-gold-400/40 disabled:opacity-50"
                />
                <button onClick={() => void start()} disabled={!selectedEng || !instruction.trim() || starting} className="btn-primary mt-2 w-full !py-2.5 !text-xs">
                  {starting ? <Loader2 size={13} className="mr-1 animate-spin inline" /> : <Radar size={13} className="mr-1 inline" />} Start session
                </button>
              </div>
            </div>
          ) : (
            /* Live session — streaming terminal */
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-center gap-2 border-b border-phantix-700/40 px-4 py-2">
                <span className={cx("chip !text-[9px]", running ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-phantix-600/40 bg-phantix-800/50 text-slate-400")}>
                  {running ? <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> running</span> : "stopped"}
                </span>
                <span className="chip !text-[9px] text-slate-500">{selected?.name}</span>
                <span className="chip !text-[9px] font-mono text-slate-500">session #{session.id}</span>
                {running && (
                  <button onClick={() => void stop()} disabled={stopping} className="ml-auto btn-secondary !px-2.5 !py-1 !text-[10px]" title="Stop session">
                    <Square size={11} className="mr-1 inline" /> {stopping ? "Stopping..." : "Stop"}
                  </button>
                )}
              </div>

              <div className="relative min-h-0 flex-1">
                <div ref={scrollRef} onScroll={onScroll} className="h-full space-y-2 overflow-y-auto p-3 font-mono">
                  {connError && (
                    <div className="flex items-center gap-2 rounded-xl border border-severity-critical/40 bg-severity-critical/10 px-3 py-2.5">
                      <Lock size={13} className="shrink-0 text-severity-critical" />
                      <p className="text-[11px] leading-4 text-red-300">{connError}</p>
                    </div>
                  )}
                  {transcript.length === 0 && !connError && (
                    <p className="py-6 text-center text-[11px] text-slate-600">Connecting to engagement container...</p>
                  )}
                  {transcript.map((t, i) => (
                    <TxLine key={i} t={t} last={i === transcript.length - 1 && running} />
                  ))}
                  {thinking && (
                    <p className="flex items-center gap-2 text-[11px] text-gold-300">
                      <LottiePlayer animationData={ghostData} className="h-4 w-4" loop speed={1.3} /> thinking...
                    </p>
                  )}
                  {running && transcript.length > 0 && !thinking && !connError && (
                    <p className="text-[10px] text-slate-600">— awaiting engine output —</p>
                  )}
                  <div ref={endRef} />
                </div>

                {/* Floating "jump to bottom" */}
                <AnimatePresence>
                  {showScrollBtn && (
                    <motion.button
                      initial={{ opacity: 0, y: 6, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.9 }}
                      onClick={scrollToBottom}
                      aria-label="Scroll to bottom"
                      className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full border border-phantix-700/50 bg-phantix-900/90 text-gold-300 shadow-card backdrop-blur-xl transition-colors hover:border-gold-400/40 hover:bg-phantix-800/90"
                    >
                      <ArrowDown size={16} />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>

              {/* Pending approvals */}
              {actions.length > 0 && (
                <div className="max-h-[38%] space-y-2 overflow-y-auto border-t border-phantix-700/40 bg-phantix-950/60 p-3">
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-severity-medium"><ShieldCheck size={11} /> Awaiting your approval ({actions.length})</p>
                  {actions.map((a) => (
                    <ActionCard key={a.id} a={a} busy={actionBusy === a.id} onDecide={(ok) => void decide(a, ok)} />
                  ))}
                </div>
              )}

              {/* Composer */}
              <div className="border-t border-phantix-700/40 p-3">
                <div className="flex items-center gap-2 rounded-xl border border-phantix-700/50 bg-phantix-950/60 px-3 py-2 focus-within:border-gold-400/40">
                  <input
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) void send(); }}
                    placeholder={running ? "Further instructions for the agent..." : "Session stopped"}
                    disabled={!running}
                    className="flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500 disabled:opacity-50"
                  />
                  <button onClick={() => void send()} disabled={!running || !instruction.trim()} className="btn-primary !px-3 !py-1.5 !text-xs" aria-label="Send"><Send size={13} /></button>
                </div>
                <p className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-600">
                  <ShieldCheck size={10} /> Read-only steps stream live · state-changing steps wait for your approval · container destroyed on stop
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Agreement modal */}
      <Modal open={agreementOpen} onClose={() => setAgreementOpen(false)} title="Autonomous Pentest Agent — Usage Agreement">
        <div className="space-y-3">
          <div className="max-h-[40vh] overflow-y-auto rounded-xl border border-phantix-700/40 bg-phantix-950/60 p-4">
            <p className="whitespace-pre-wrap text-xs leading-6 text-slate-300">{agreementBody}</p>
          </div>
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-phantix-700/40 p-3">
            <input
              type="checkbox"
              checked={agreementChecked}
              onChange={(e) => setAgreementChecked(e.target.checked)}
              className="mt-0.5 accent-[rgb(var(--gold-400))]"
            />
            <span className="text-xs leading-5 text-slate-400">I am authorized to test the listed targets under the stated rules of engagement, and understand that state-changing steps require approval.</span>
          </label>
          <button onClick={() => void accept()} disabled={!agreementChecked || accepting} className="btn-primary w-full !py-2.5 !text-xs">
            {accepting ? <Loader2 size={12} className="mr-1 animate-spin inline" /> : <ShieldCheck size={13} className="mr-1 inline" />} Accept & continue
          </button>
        </div>
      </Modal>
    </div>
  );
}
