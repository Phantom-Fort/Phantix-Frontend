import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Send, ShieldCheck, Loader2, Radar, Square, ChevronDown,
  Plus, Lock, CheckCircle2, XCircle, Globe2, ArrowDown, CornerUpLeft,
} from "lucide-react";
import { Modal, Spinner } from "@/components/ui";
import MarkdownView from "@/components/MarkdownView";
import AgiConsole from "@/components/AgiConsole";
import { ApprovalNotice, ClarificationAsk, IssuesStrip, ToolGroupCard } from "@/components/AgiStream";
import { PromptKitStream } from "@/components/agent/PromptKitStream";
import { ThinkingBar } from "@/components/prompt-kit/thinking-bar";
import { groupStreamRows, openClarificationFrom } from "@/lib/agiStreamGroup";
import { activityFor } from "@/lib/agiGraph";
import { AgentActivityLine, QueuedPromptStrip, type QueuedPrompt } from "@/components/AgiStream";
import { loadAssetsBundle } from "@/lib/data";
import type { Asset } from "@/lib/types";
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
  isAgiGatewayError,
  loadActiveAgiSession,
  loadAgiSession,
  loadAgiFindings,
  answerAgiClarification,
} from "@/lib/agi";
import type { AgiAccess, AgiAction, AgiEngagement, AgiSession, AgiTranscriptChunk } from "@/lib/types";
import { cx } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { useStickToBottom } from "@/lib/useStickToBottom";
import { useChatSend } from "@/lib/useChatSend";
import { sanitizeAgiChunks } from "@/lib/agiSanitize";
import { useNavigate } from "react-router-dom";

const POLL_MS = 5000;
const ACTION_POLL_MS = 8000;

type WorkspaceVariant = "drawer" | "page" | "console";

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
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="group flex w-full items-start justify-between gap-2 text-left">
        <div className="flex items-center gap-2">
          <span className="wb-iconbox flex items-center justify-center rounded-lg bg-severity-medium/15 text-severity-medium"><ShieldCheck size={13} /></span>
          <div>
            <p className="wb-sm font-semibold text-amber-200">State-changing step</p>
            <p className="wb-2xs text-slate-500">pending approval</p>
          </div>
        </div>
        <ChevronDown size={14} className={cx("shrink-0 text-slate-500 transition-transform duration-200 group-hover:text-slate-300", !open && "-rotate-90")} />
      </button>
      <div className={cx("wb-collapse", open && "open")}>
        <div className="wb-collapse-inner">
          <div className="mt-2.5 space-y-2">
            <p className="wb-xs rounded-lg bg-phantix-950/70 px-2.5 py-2 font-mono leading-relaxed text-slate-200">{a.proposed_command}</p>
            {a.rationale && <p className="wb-xs leading-relaxed text-slate-400">{a.rationale}</p>}
            <div className="flex items-center gap-2 pt-0.5">
              <button onClick={() => onDecide(true)} disabled={busy} className="btn-primary flex-1 !px-2 !py-1.5 wb-xs"><CheckCircle2 size={12} className="mr-1 inline" /> Approve</button>
              <button onClick={() => onDecide(false)} disabled={busy} className="btn-ghost flex-1 !px-2 !py-1.5 wb-xs text-severity-critical hover:text-severity-critical"><XCircle size={12} className="mr-1 inline" /> Reject</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AgiWorkspace({ variant = "drawer" }: { variant?: WorkspaceVariant }) {
  const { toast, requireDualControl, demoActive } = useStore();
  const navigate = useNavigate();
  const reportSubmitted = useRef(false);
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
  const [newRoe, setNewRoe] = useState("");
  const [creating, setCreating] = useState(false);

  // Asset picker — engagements may only target the org's already-added assets.
  const [orgAssets, setOrgAssets] = useState<Asset[]>([]);
  const [assetLoading, setAssetLoading] = useState(false);
  const [assetSearch, setAssetSearch] = useState("");
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<number>>(new Set());
  const [selectAllAssets, setSelectAllAssets] = useState(false);

  // Session + stream
  const [session, setSession] = useState<AgiSession | null>(null);
  const [instruction, setInstruction] = useState("");
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [transcript, setTranscript] = useState<AgiTranscriptChunk[]>([]);
  const afterSeqRef = useRef(0);
  const pendingOpsRef = useRef<string[]>([]);
  // Guards against duplicate transcript rows: overlapping polls are serialized,
  // and locally-appended rows (sync replies, loop briefs) are remembered so the
  // poll skips the backend's persisted twin exactly once.
  const pollBusyRef = useRef(false);
  const localKeysRef = useRef<Map<string, number>>(new Map());
  // Streaming signal: fresh engine output within the window means the agent is
  // actively producing (turn briefs, tool rows, replies) — the activity line
  // shows cognitive verbs then; only true silence falls back to "Waiting for
  // response".
  const lastOutputAtRef = useRef(0);
  const [streaming, setStreaming] = useState(false);
  // Prompts sent mid-turn stay pinned above the composer until the agent acts.
  const [pendingPrompts, setPendingPrompts] = useState<QueuedPrompt[]>([]);
  const [actions, setActions] = useState<AgiAction[]>([]);
  const [actionBusy, setActionBusy] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [policyBanner, setPolicyBanner] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [workingOn, setWorkingOn] = useState<string | null>(null);
  const [connError, setConnError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [overrideDrafts, setOverrideDrafts] = useState<Record<number, string>>({});
  const stick = useStickToBottom([transcript, actions, running, thinking]);
  const chatSend = useChatSend();

  useEffect(() => {
    const t = window.setInterval(() => {
      const next = thinking || Date.now() - lastOutputAtRef.current < 30_000;
      setStreaming((prev) => (prev === next ? prev : next));
    }, 2000);
    return () => window.clearInterval(t);
  }, [thinking]);

  const boot = useCallback(async () => {
    setBooting(true);
    try {
      const a = await loadAgiAccess();
      setAccess(a);
      if (a.agi.can_use) {
        const engs = await loadAgiEngagements();
        setEngagements(engs);
        if (engs.length > 0) setSelectedEng(engs[0].id);
        const live = await loadActiveAgiSession();
        if (live) {
          setSession(live);
          setSelectedEng(live.engagement_id);
          setRunning(live.status === "running" || live.status === "provisioning");
          setPaused(live.status === "paused");
          const chunks = await loadAgiTranscript(live.id, 0);
          setTranscript(sanitizeAgiChunks(chunks));
          afterSeqRef.current = chunks.length ? Math.max(...chunks.map((c) => c.seq)) : 0;
          try { setActions(await loadAgiPendingActions(live.id)); } catch { /* ignore */ }
        }
      }
    } catch (e) {
      toast("error", "Could not load AGI access", e instanceof Error ? e.message : "");
    } finally {
      setBooting(false);
    }
    // Best-effort: load the org's assets for the engagement target picker.
    setAssetLoading(true);
    try {
      const bundle = await loadAssetsBundle();
      setOrgAssets(Array.isArray(bundle.assets) ? bundle.assets : []);
    } catch {
      setOrgAssets([]);
    } finally {
      setAssetLoading(false);
    }
  }, [toast]);

  useEffect(() => { void boot(); }, [boot]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("phantix:agi-live", { detail: { running: Boolean(session && running) } }));
  }, [session, running]);

  const onScroll = stick.onScroll;
  const scrollToBottom = stick.jump;
  const showScrollBtn = stick.showJump;
  const scrollRef = stick.scrollerRef;
  const endRef = stick.endRef;

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
    const max = access?.agi.limits.max_allowlist_targets ?? 10;
    const picked = selectAllAssets
      ? orgAssets
      : orgAssets.filter((a) => selectedAssetIds.has(a.id));
    const targets = picked.map((a) => a.value.trim()).filter(Boolean).slice(0, max);
    if (!newName.trim() || targets.length === 0) {
      toast("error", selectAllAssets && orgAssets.length === 0 ? "No assets available yet — add assets first" : "Name and at least one target asset are required");
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
      setNewRoe("");
      setSelectedAssetIds(new Set());
      setSelectAllAssets(false);
      setAssetSearch("");
      toast("success", "Engagement created", `${eng.name} · ${targets.length} target${targets.length === 1 ? "" : "s"}`);
    } catch (e) {
      const code = (e as any)?.detail?.code;
      if (code === "allowlist_too_large") toast("error", "Too many targets", `Reduce the allowlist (max ${max}).`);
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
      toast("info", "Provisioning container…", "Workspace setup can take up to ~2 minutes.");
      const s = await startAgiSession(selectedEng, msg, { include_org_assets: false, autonomy: "medium" });
      setSession(s);
      setRunning(true);
      reportSubmitted.current = false;
      setPaused(false);
      setTranscript([]);
      afterSeqRef.current = 0;
      pendingOpsRef.current = [];
      setPendingPrompts([]);
      setActions([]);
      setOverrideDrafts({});
      setInstruction("");
      if (s.loop?.working_on) setWorkingOn(s.loop.working_on);
      toast("success", "Session started", "Streaming live from the engagement container...");
    } catch (e) {
      const blocked = isAgiPolicyBlocked(e);
      if (blocked) { setPolicyBanner(blocked.message); toast("warning", "Policy blocked", blocked.message); }
      else if (isAgiGatewayError(e)) {
        toast(
          "error",
          "Start failed at the gateway",
          "The connection was cut off while the workspace was provisioning. The backend may still be starting the session — " +
          "wait a minute and reload this page before retrying (retrying immediately can create a duplicate session). " +
          "If it persists, the AGI runner is likely unreachable — contact support with the correlation ID.",
        );
      }
      else toast("error", "Start failed", e instanceof Error ? e.message : "");
    } finally {
      setStarting(false);
    }
  };

  const goToReports = (s: AgiSession) => {
    const reportId = (s.meta as { report?: { report_id?: number } } | null)?.report?.report_id;
    const qs = new URLSearchParams({ from: "agi", session: String(s.id) });
    if (reportId) qs.set("report", String(reportId));
    navigate(`/reports?${qs.toString()}`);
  };

  const stop = async () => {
    if (!session) return;
    if (!(await requireDualControl("Stopping an Autonomous Pentest Agent session requires a dual-control operate session."))) return;
    setStopping(true);
    try {
      const s = await stopAgiSession(session.id);
      setSession(s);
      setRunning(false);
      reportSubmitted.current = true;
      toast("success", "Report submitted", "Opening the report engine…");
      goToReports(s);
    } catch (e) {
      toast("error", "Stop failed", e instanceof Error ? e.message : "");
    } finally {
      setStopping(false);
    }
  };

  // Leave the console back to the engagement picker so a fresh session can be
  // started (previously you were stuck in the stopped-session view).
  const exitToPicker = useCallback(() => {
    setSession(null);
    setRunning(false);
    setPaused(false);
    setTranscript([]);
    setActions([]);
    afterSeqRef.current = 0;
    pendingOpsRef.current = [];
    setInstruction("");
    setWorkingOn(null);
    setConnError(null);
    setThinking(false);
    setOverrideDrafts({});
    setPendingPrompts([]);
    reportSubmitted.current = false;
  }, []);

  const dispatchChat = async (msg: string) => {
    if (!session || !running || paused) return;
    if (!(await requireDualControl("Sending instructions to the Autonomous Pentest Agent requires a dual-control operate session."))) return;
    setConnError(null);
    pendingOpsRef.current.push(msg);
    const promptId = `pp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setPendingPrompts((prev) => [...prev, { id: promptId, content: msg, delivered: false }]);
    setTranscript((prev) => [...prev, { seq: -1, role: "operator", content: msg, meta: null, created_at: new Date().toISOString() }]);
    setThinking(true);
    try {
      const res = await agiChat(session.id, msg);
      if (res.loop?.working_on) setWorkingOn(res.loop.working_on);
      if (res.queued) setThinking(false);
      if (res.reply && !res.queued) {
        // The agent answered synchronously — it has processed the prompt, so the
        // pinned pill can go (message + reply now live in the transcript).
        setPendingPrompts((prev) => prev.filter((p) => p.id !== promptId));
        // Remember this locally-appended reply so the transcript poll skips the
        // backend's persisted twin instead of duplicating it.
        localKeysRef.current.set(`assistant|${res.reply}`, Date.now());
        setTranscript((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && last.content === res.reply) return prev;
          return [...prev, { seq: afterSeqRef.current + 1, role: "assistant", content: res.reply || "", meta: { kind: res.reply_kind || "assistant" }, created_at: new Date().toISOString() }];
        });
        lastOutputAtRef.current = Date.now();
      } else if (res.reply && res.queued) {
        setPendingPrompts((prev) => prev.map((p) => (p.id === promptId ? { ...p, delivered: true } : p)));
        setTranscript((prev) => [...prev, { seq: afterSeqRef.current + 1, role: "system", content: res.reply || "Queued for the next turn.", meta: { kind: "queued" }, created_at: new Date().toISOString() }]);
      }
      if (typeof res.transcript_seq === "number" && res.transcript_seq > afterSeqRef.current) {
        afterSeqRef.current = res.transcript_seq;
      }
    } catch (e: any) {
      setThinking(false);
      setPendingPrompts((prev) => prev.filter((p) => p.id !== promptId));
      const blocked = isAgiPolicyBlocked(e);
      if (blocked) { setPolicyBanner(blocked.message); toast("warning", "Policy blocked", blocked.message); return; }
      const name = String(e?.name ?? "");
      const message = String(e?.message ?? "");
      // Dual-control expired while session still running — clearer copy
      if (/dual.?control|authenticator session|X-Dual-Control/i.test(message) && running) {
        setConnError("Operate session was released — re-unlock dual-control to continue approvals.");
        toast("warning", "Operate session released", "Re-unlock dual-control to continue approvals.");
        return;
      }
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

  const send = () => {
    const msg = instruction.trim();
    if (!session || !running || paused) return;
    if (!msg) return;
    setInstruction("");
    chatSend.requestSend(msg, dispatchChat);
  };

  // ── Clarification asks (ASK_OPERATOR) ────────────────────────────────────
  // Mirrors the backend contract: an open ask lives on session.clarification
  // (status "open") or the latest transcript chunk meta.kind
  // "clarification_needed". Answering POSTs { clarification_id, answer } to
  // /agi/sessions/{id}/clarify; the backend clears the ask and resumes the loop
  // (clarification_answered → loop_status / working_on again).
  const [answeredClarificationId, setAnsweredClarificationId] = useState<string | null>(null);
  const [answering, setAnswering] = useState(false);
  const openClarification = useMemo(
    () => openClarificationFrom(session, transcript, answeredClarificationId),
    [session, transcript, answeredClarificationId],
  );

  const handleAnswer = useCallback(async (clarificationId: string, answer: string) => {
    if (!session) return;
    setAnswering(true);
    setThinking(false);
    try {
      await answerAgiClarification(session.id, { clarification_id: clarificationId, answer });
      setAnsweredClarificationId(clarificationId);
      toast("success", "Clarification answered", "The agent is resuming the assessment.");
      // Force a session refresh so the cleared ask + resumed loop reflect quickly.
      loadAgiSession(session.id).then((s) => { if (s) setSession(s); }).catch(() => {});
    } catch (e) {
      toast("error", "Answer failed", e instanceof Error ? e.message : "");
    } finally {
      setAnswering(false);
    }
  }, [session, toast]);

  // ── Drawer issues strip ───────────────────────────────────────────────────
  // Surface backend findings in the compact drawer so issues are visible
  // without opening the full console, and link out to the findings tracker.
  const [drawerFindings, setDrawerFindings] = useState<Array<Record<string, unknown>>>([]);
  useEffect(() => {
    if (!session || !running) return;
    let cancelled = false;
    const load = () =>
      loadAgiFindings(session.id).then((fs) => {
        if (!cancelled) setDrawerFindings(Array.isArray(fs) ? fs : []);
      }).catch(() => {});
    load();
    const t = window.setInterval(load, 12000);
    return () => { cancelled = true; window.clearInterval(t); };
  }, [session, running]);

  const drawerIssueRows = useMemo(
    () =>
      drawerFindings.map((f) => ({
        title: String(f.title ?? "Finding"),
        severity: String(f.severity ?? "info"),
        status: String(f.status ?? ""),
        cve: f.cve ? String(f.cve) : undefined,
        target: f.target ? String(f.target) : undefined,
      })),
    [drawerFindings],
  );
  const drawerRows = useMemo(() => groupStreamRows(transcript), [transcript]);

  const decide = async (action: AgiAction, approve: boolean, overrideCmd?: string) => {
    if (!(await requireDualControl("Approving a state-changing step requires a dual-control operate session."))) return;
    setActionBusy(action.id);
    try {
      const notes = !approve
        ? ""
        : overrideCmd && overrideCmd !== action.proposed_command
          ? `Override: ${overrideCmd}`
          : "Within ROE";
      await decideAgiAction(action.id, approve, notes);
      setActions((prev) => prev.filter((x) => x.id !== action.id));
      setOverrideDrafts((prev) => {
        const next = { ...prev };
        delete next[action.id];
        return next;
      });
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

  useEffect(() => {
    if (!running || !session || paused) return;
    const t = window.setInterval(async () => {
      // Serialize polls: an overlapping fetch would read the same after_seq and
      // append the whole batch twice (the "sent once, appears twice" bug).
      if (pollBusyRef.current) return;
      pollBusyRef.current = true;
      try {
        const chunks = await loadAgiTranscript(session.id, afterSeqRef.current);
        if (chunks.length > 0) {
          const safe = sanitizeAgiChunks(chunks);
          const pend = pendingOpsRef.current;
          // How many pending ops the backend has persisted (FIFO content match).
          let taken = 0;
          for (const c of safe) {
            if (c.role === "operator" && taken < pend.length && pend[taken] === c.content) taken += 1;
          }
          // Did the agent produce an answer in this batch (excluding the local
          // twin we already painted)?
          const responded = safe.some((c) => c.role === "assistant" && !localKeysRef.current.has(`assistant|${c.content}`));

          setTranscript((prev) => {
            const seenSeqs = new Set(prev.filter((p) => p.seq > 0).map((p) => p.seq));
            let skip = 0;
            const out: AgiTranscriptChunk[] = [];
            for (const c of safe) {
              // Optimistic operator rows are replaced by their persisted twin.
              if (c.role === "operator" && skip < taken) { skip += 1; continue; }
              // Skip rows already appended (same seq) — protects against any
              // after_seq re-delivery or double-append race.
              if (c.seq > 0 && seenSeqs.has(c.seq)) continue;
              // Skip the persisted twin of a locally-appended row exactly once
              // (sync replies, loop briefs). The key is consumed on match so
              // genuine repeats later in the session still render.
              const key = `${c.role}|${c.content}`;
              if (localKeysRef.current.has(key)) { localKeysRef.current.delete(key); continue; }
              out.push(c);
            }
            if (out.length === 0) return prev;
            return [...prev, ...out];
          });

          if (taken > 0) {
            pendingOpsRef.current = pend.slice(taken);
            setPendingPrompts((pp) => {
              let need = taken;
              return pp.map((p) => {
                if (need > 0 && !p.delivered) { need -= 1; return { ...p, delivered: true }; }
                return p;
              });
            });
          }
          // The agent answered a delivered prompt — unpin it.
          if (responded) setPendingPrompts((pp) => pp.filter((p) => !p.delivered));
          afterSeqRef.current = Math.max(afterSeqRef.current, ...chunks.map((c) => c.seq));
          // Fresh engine output → the agent is streaming.
          lastOutputAtRef.current = Date.now();
          // New engine output means the agent has replied — drop the thinking cue.
          setThinking(false);
          setConnError(null);
        }
      } catch { /* transient — keep polling */ }
      finally { pollBusyRef.current = false; }
    }, demoActive ? 350 : POLL_MS);
    return () => window.clearInterval(t);
  }, [running, session, paused, demoActive]);

  useEffect(() => {
    if (!running || !session || paused) return;
    const t = window.setInterval(async () => {
      try {
        const acts = await loadAgiPendingActions(session.id);
        setActions(acts);
      } catch { /* transient */ }
    }, ACTION_POLL_MS);
    return () => window.clearInterval(t);
  }, [running, session, paused]);

  // Session poll (3–5s): job + loop.working_on — never silent thinking
  useEffect(() => {
    if (!running || !session || paused) return;
    const tick = async () => {
      try {
        const s = await loadAgiSession(session.id);
        if (!s) return;
        setSession(s);
        if (s.loop?.working_on) setWorkingOn(s.loop.working_on);
        if (s.loop?.content && s.loop.event === "loop_progress") {
          setTranscript((prev) => {
            // Each brief embeds a unique turn counter, so an exact match anywhere
            // in the transcript means it is already painted (by this poll or by
            // the transcript poll) — never re-append it.
            if (prev.some((p) => p.role === "assistant" && p.content === s.loop?.content)) return prev;
            // Remember the locally-painted brief so the transcript poll skips
            // its persisted twin (key consumed on first match).
            localKeysRef.current.set(`assistant|${s.loop?.content ?? ""}`, Date.now());
            return [...prev, { seq: afterSeqRef.current + 1, role: "assistant", content: s.loop?.content || "", meta: { kind: "turn_brief", event: "loop_progress" }, created_at: new Date().toISOString() }];
          });
          lastOutputAtRef.current = Date.now();
          setThinking(false);
        }
        if (s.status === "stopped" || s.status === "torn_down" || s.status === "failed") {
          setRunning(false);
        }
      } catch { /* transient */ }
    };
    void tick();
    const t = window.setInterval(() => void tick(), 10000);
    return () => window.clearInterval(t);
  }, [running, session?.id, paused]);

  const stopRef = useRef(stop);
  stopRef.current = stop;
  useEffect(() => {
    if (!demoActive || !running || !session || reportSubmitted.current) return;
    const last = transcript[transcript.length - 1]?.content ?? "";
    if (!/Engagement complete|Report tagged `phantix_agi`/i.test(last)) return;
    const id = window.setTimeout(() => { void stopRef.current(); }, 1400);
    return () => window.clearTimeout(id);
  }, [transcript, demoActive, running, session]);

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
            <p className="wb-xs flex items-center gap-1.5 text-slate-500">
              human-gated · scoped · terminal-access
              {running && <span className="flex items-center gap-1 text-gold-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold-400" /> live</span>}
            </p>
          </div>
          {running && (
            <button onClick={() => void stop()} disabled={stopping} className="ml-auto btn-secondary !px-3 !py-1.5 !text-xs" title="Stop session">
              <Square size={12} className="mr-1 inline" /> {stopping ? "Stopping..." : "Stop"}
            </button>
          )}
          {!running && (
            <button onClick={exitToPicker} className="ml-auto btn-primary !px-3 !py-1.5 !text-xs" title="Start a new session">
              <Plus size={12} className="mr-1 inline" /> New session
            </button>
          )}
        </div>
      )}

      {/* Policy banner */}
      {policyBanner && (
        <div className="flex items-center gap-2 border-b border-severity-critical/30 bg-severity-critical/10 px-4 py-2">
          <Lock size={13} className="shrink-0 text-severity-critical" />
          <p className="wb-xs leading-relaxed text-red-300">{policyBanner}</p>
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
                <p className="wb-pane-title">1 · Choose an engagement</p>
                <button onClick={() => setCreateOpen((v) => !v)} className="btn-ghost !px-2 !py-1 wb-xs"><Plus size={12} className="mr-1 inline" /> New</button>
              </div>
              {engLoading ? (
                <div className="space-y-2">
                  <div className="skeleton h-16 rounded-xl" />
                  <div className="skeleton h-16 rounded-xl" />
                </div>
              ) : (
                <div className="space-y-2">
                  {engagements.length === 0 && !createOpen && (
                    <p className="wb-sm rounded-xl border border-dashed border-phantix-700/50 px-3 py-4 text-center text-slate-500">No engagements yet. Create one with a tight allowlist to start.</p>
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
                        <span className="wb-sm min-w-0 truncate font-semibold text-slate-200">{e.name}</span>
                        <span className={cx("ml-auto chip shrink-0 !px-2 !py-0.5 wb-2xs", e.status === "ready" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-phantix-600/40 bg-phantix-800/50 text-slate-400")}>{e.status}</span>
                      </div>
                      <p className="wb-2xs mt-1 truncate font-mono text-slate-500">{e.scope_definition.target_allowlist.join(" · ") || "no targets"}</p>
                    </button>
                  ))}
                </div>
              )}

              {createOpen && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2 rounded-xl border border-phantix-700/40 bg-phantix-900/50 p-3">
                  <p className="wb-pane-title">New engagement</p>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Name (e.g. Lab external web)"
                    className="wb-sm w-full rounded-lg border border-phantix-700/50 bg-phantix-950/60 px-3 py-2 text-slate-200 outline-none placeholder:text-slate-600 focus:border-gold-400/40"
                  />
                  <div className="rounded-lg border border-phantix-700/50 bg-phantix-950/60 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="wb-pane-title">Target assets (from your inventory)</p>
                      <label className="wb-xs flex cursor-pointer items-center gap-1.5 text-slate-400">
                        <input
                          type="checkbox"
                          checked={selectAllAssets}
                          onChange={(e) => setSelectAllAssets(e.target.checked)}
                          className="h-3 w-3 accent-gold-400"
                        />
                        Select all
                      </label>
                    </div>
                    <input
                      value={assetSearch}
                      onChange={(e) => setAssetSearch(e.target.value)}
                      placeholder={selectAllAssets ? "All assets selected" : "Search assets…"}
                      disabled={selectAllAssets}
                      className="wb-xs mt-1.5 w-full rounded-md border border-phantix-700/50 bg-phantix-950/70 px-2 py-1.5 text-slate-200 outline-none placeholder:text-slate-600 focus:border-gold-400/40 disabled:opacity-50"
                    />
                    {assetLoading ? (
                      <p className="wb-xs py-3 text-center text-slate-500"><Loader2 size={11} className="mr-1 animate-spin inline" /> Loading assets…</p>
                    ) : orgAssets.length === 0 ? (
                      <p className="wb-xs py-3 text-center text-slate-500">No assets in your inventory yet. Add assets first, then create an engagement.</p>
                    ) : (
                      <div className="wb-scroll mt-1.5 max-h-40 space-y-1 overflow-y-auto pr-1">
                        {orgAssets
                          .filter((a) => !selectAllAssets && (!assetSearch.trim() || a.value.toLowerCase().includes(assetSearch.toLowerCase()) || a.name.toLowerCase().includes(assetSearch.toLowerCase())))
                          .map((a) => (
                            <label
                              key={a.id}
                              className={cx(
                                "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition-colors",
                                selectAllAssets ? "opacity-60" : "hover:bg-phantix-800/50",
                                selectedAssetIds.has(a.id) && !selectAllAssets && "bg-phantix-800/40",
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={selectAllAssets || selectedAssetIds.has(a.id)}
                                disabled={selectAllAssets}
                                onChange={(e) => {
                                  setSelectedAssetIds((prev) => {
                                    const next = new Set(prev);
                                    if (e.target.checked) next.add(a.id); else next.delete(a.id);
                                    return next;
                                  });
                                }}
                                className="h-3 w-3 shrink-0 accent-gold-400"
                              />
                              <span className={cx("h-1.5 w-1.5 shrink-0 rounded-full", a.criticality === "critical" ? "bg-severity-critical" : a.criticality === "high" ? "bg-severity-high" : a.criticality === "medium" ? "bg-severity-medium" : "bg-severity-low")} />
                              <span className="wb-xs min-w-0 flex-1 truncate font-mono text-slate-200">{a.value}</span>
                              <span className="wb-2xs shrink-0 uppercase tracking-wider text-slate-500">{a.asset_type}</span>
                            </label>
                          ))}
                      </div>
                    )}
                    <p className="wb-2xs mt-1.5 text-slate-600">
                      {selectAllAssets
                        ? `${orgAssets.length} asset${orgAssets.length === 1 ? "" : "s"} selected (all)`
                        : `${selectedAssetIds.size} of ${orgAssets.length} selected`}
                    </p>
                  </div>
                  <input
                    value={newRoe}
                    onChange={(e) => setNewRoe(e.target.value)}
                    placeholder="Rules of engagement (optional)"
                    className="wb-sm w-full rounded-lg border border-phantix-700/50 bg-phantix-950/60 px-3 py-2 text-slate-200 outline-none placeholder:text-slate-600 focus:border-gold-400/40"
                  />
                  <button onClick={() => void createEngagement()} disabled={creating} className="btn-primary w-full !py-2 wb-sm">
                    {creating ? <Loader2 size={12} className="mr-1 animate-spin inline" /> : <Plus size={12} className="mr-1 inline" />} Create engagement
                  </button>
                </motion.div>
              )}

              <div>
                <p className="wb-pane-title">2 · Instruction</p>
                <textarea
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void start(); }}
                  placeholder="Give the agent an explicit instruction, e.g. “Perform read-only recon of the allowlisted hosts and propose any active verification steps.”"
                  rows={3}
                  disabled={!selectedEng}
                  className="wb-sm mt-2 w-full rounded-xl border border-phantix-700/50 bg-phantix-950/60 px-3 py-2 leading-relaxed text-slate-200 outline-none placeholder:text-slate-600 focus:border-gold-400/40 disabled:opacity-50"
                />
                <button onClick={() => void start()} disabled={!selectedEng || !instruction.trim() || starting} className="btn-primary mt-2 w-full !py-2.5 wb-sm">
                  {starting ? <Loader2 size={13} className="mr-1 animate-spin inline" /> : <Radar size={13} className="mr-1 inline" />} Start session
                </button>
              </div>
            </div>
          ) : variant === "console" ? (
            <AgiConsole
              running={running}
              paused={paused}
              onTogglePause={() => setPaused((v) => !v)}
              stopping={stopping}
              onStop={() => void stop()}
              onExit={exitToPicker}
              session={session}
              engagement={selected}
              transcript={transcript}
              actions={actions}
              actionBusy={actionBusy}
              onDecide={(a, ok, cmd) => void decide(a, ok, cmd)}
              thinking={thinking}
              workingOn={workingOn}
              connError={connError}
              instruction={instruction}
              onInstruction={setInstruction}
              onSend={send}
              sendHint={chatSend.hint}
              clarification={openClarification}
              onAnswer={handleAnswer}
              policyBanner={null}
              overrideDrafts={overrideDrafts}
              onOverrideDraft={(id, cmd) => setOverrideDrafts((prev) => ({ ...prev, [id]: cmd }))}
              pendingPrompts={pendingPrompts}
              streaming={streaming}
            />
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-center gap-1.5 border-b border-phantix-700/40 px-3 py-2">
                <span className={cx("chip !px-2 !py-0.5 wb-2xs", running ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-phantix-600/40 bg-phantix-800/50 text-slate-400")}>
                  {running ? <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> running</span> : "stopped"}
                </span>
                <span className="chip !px-2 !py-0.5 wb-2xs min-w-0 truncate text-slate-500">{selected?.name}</span>
                <span className="chip !px-2 !py-0.5 wb-2xs shrink-0 font-mono text-slate-500">#{session.id}</span>
                {running && (
                  <button onClick={() => void stop()} disabled={stopping} className="ml-auto btn-secondary !px-2.5 !py-1 wb-xs shrink-0" title="Stop session">
                    <Square size={11} className="mr-1 inline" /> {stopping ? "Stopping..." : "Stop"}
                  </button>
                )}
                {!running && (
                  <button onClick={exitToPicker} className="ml-auto btn-primary !px-2.5 !py-1 wb-xs shrink-0" title="Start a new session">
                    <Plus size={11} className="mr-1 inline" /> New session
                  </button>
                )}
                <button onClick={exitToPicker} className="btn-ghost !px-2 !py-1 wb-xs shrink-0" title="Back to session selection">
                  <CornerUpLeft size={11} className="mr-1 inline" /> Sessions
                </button>
              </div>

              <div className="relative min-h-0 flex-1">
                <div ref={scrollRef} onScroll={onScroll} className="wb-scroll h-full space-y-2 overflow-y-auto p-3">
                  {connError && (
                    <div className="flex items-center gap-2 rounded-xl border border-severity-critical/40 bg-severity-critical/10 px-3 py-2.5">
                      <Lock size={13} className="shrink-0 text-severity-critical" />
                      <p className="wb-xs leading-relaxed text-red-300">{connError}</p>
                    </div>
                  )}
                  {!running && (session.status === "stopped" || session.status === "torn_down" || session.status === "failed") && (
                    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-phantix-700/40 bg-phantix-900/60 px-3 py-2.5">
                      <p className="wb-xs flex-1 text-slate-400">
                        Session ended{session.status === "failed" ? " — check the engine logs" : ""}. Ready to run a fresh assessment?
                      </p>
                      <button onClick={exitToPicker} className="btn-primary !px-2.5 !py-1 wb-xs shrink-0"><Plus size={11} className="mr-1 inline" /> New session</button>
                    </div>
                  )}
                  <IssuesStrip findings={drawerIssueRows} href="/reports?tab=tracker" />
                  {transcript.length === 0 && !connError && (
                    <div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-center">
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-phantix-700/40 bg-phantix-900/60 text-gold-400">
                        <Radar size={16} className="animate-pulse" />
                      </span>
                      <p className="wb-sm font-medium text-slate-400">Connecting to engagement container…</p>
                      <p className="wb-xs max-w-[240px] leading-relaxed text-slate-600">Live turns, tool calls, and engine events will stream here.</p>
                    </div>
                  )}
                  {drawerRows.map((row, i) =>
                    row.kind === "toolGroup" ? (
                      <ToolGroupCard key={i} tool={row.tool} runs={row.runs} dense />
                    ) : (
                      <PromptKitStream key={i} t={row.t} last={i === drawerRows.length - 1 && running && row.t.role !== "operator"} />
                    ),
                  )}
                  {thinking && !openClarification && (
                    <ThinkingBar text={activityFor((workingOn || "").trim()) || "Thinking"} />
                  )}
                  {!connError && actions.length > 0 && (
                    <ApprovalNotice
                      count={actions.length}
                      stateChanging={actions.some((a) => a.action_type === "state_changing")}
                      authorizationsHref="/authorizations"
                    />
                  )}
                  {running && transcript.length > 0 && !thinking && !connError && actions.length === 0 && !openClarification && (
                    <p className="wb-xs text-center text-slate-600">— awaiting engine output —</p>
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
                      className="absolute bottom-3 right-3 flex h-9 items-center justify-center gap-1.5 rounded-full border border-phantix-700/50 bg-phantix-900/90 px-2.5 text-gold-300 shadow-card backdrop-blur-xl transition-colors hover:border-gold-400/40 hover:bg-phantix-800/90"
                    >
                      <ArrowDown size={16} />
                      {stick.unseen > 0 && (
                        <span className="wb-2xs rounded-full bg-gold-400/20 px-1.5 font-semibold tabular-nums text-gold-300">
                          {stick.unseen > 99 ? "99+" : stick.unseen}
                        </span>
                      )}
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>

              {/* Pending approvals */}
              {actions.length > 0 && (
                <div className="wb-scroll max-h-[40%] space-y-2 overflow-y-auto border-t border-phantix-700/40 bg-phantix-950/60 p-3">
                  <p className="wb-pane-title !text-severity-medium mb-1"><ShieldCheck size={12} /> Awaiting your approval ({actions.length})</p>
                  {actions.map((a) => (
                    <ActionCard key={a.id} a={a} busy={actionBusy === a.id} onDecide={(ok) => void decide(a, ok)} />
                  ))}
                </div>
              )}

              {/* Composer */}
              <div className="border-t border-phantix-700/40 p-3">
                {pendingPrompts.length > 0 && (
                  <div className="mb-2">
                    <QueuedPromptStrip prompts={pendingPrompts} dense />
                  </div>
                )}
                <div className="mb-2">
                  <AgentActivityLine
                    dense
                    activity={{
                      running,
                      paused,
                      thinking,
                      streaming,
                      workingOn,
                      approvals: actions.length,
                      clarification: Boolean(openClarification),
                      connError,
                      sessionStatus: session.status,
                    }}
                  />
                </div>
                {openClarification && (
                  <div className="mb-2">
                    <ClarificationAsk clarification={openClarification} onAnswer={handleAnswer} busy={answering} dense />
                  </div>
                )}
                {running && !instruction.trim() && (
                  <div className="mb-2 flex flex-wrap items-center gap-1.5">
                    {["Summarize findings so far", "Next planned step?", "Stay read-only"].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setInstruction(s)}
                        className="wb-xs rounded-full border border-phantix-700/50 bg-phantix-900/50 px-2.5 py-0.5 text-slate-400 transition-colors hover:border-gold-400/40 hover:text-gold-200"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 rounded-xl border border-phantix-700/50 bg-phantix-950/60 px-3 py-2 transition-colors focus-within:border-gold-400/40">
                  <input
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter" || e.shiftKey || e.repeat) return;
                      e.preventDefault();
                      send();
                    }}
                    placeholder={running ? "Further instructions for the agent..." : "Session stopped"}
                    disabled={!running}
                    className="wb-md flex-1 bg-transparent text-slate-200 outline-none placeholder:text-slate-500 disabled:opacity-50"
                  />
                  <button onClick={send} disabled={!running || !instruction.trim()} className="btn-primary !px-3 !py-1.5 wb-xs" aria-label="Send"><Send size={14} /></button>
                </div>
                <p className="wb-xs mt-2 flex items-center gap-1.5 text-slate-600">
                  <ShieldCheck size={11} className="shrink-0" />
                  {chatSend.hint === "queued"
                    ? "Queued — press Enter again to send now, or wait for the current reply."
                    : "Read-only steps stream live · state-changing steps wait for your approval · container destroyed on stop"}
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
            <MarkdownView source={agreementBody} />
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
