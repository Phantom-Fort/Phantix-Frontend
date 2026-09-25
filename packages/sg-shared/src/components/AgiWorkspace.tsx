import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Send, ShieldCheck, Loader2, Radar, Square, ChevronDown,
  Plus, Lock, CheckCircle2, XCircle, Globe2, ArrowDown, CornerUpLeft, ShieldAlert,
  AlertTriangle, Pencil,
} from "lucide-react";
import { Modal, SkeletonBlock } from "../ui";
import DocLink from "./DocLink";
import MarkdownView from "./MarkdownView";
import AgiConsole from "./AgiConsole";
import PentestTodo from "./PentestTodo";
import AgiMetrics from "./AgiMetrics";
import { ApprovalNotice, ClarificationAsk, IssuesStrip, ToolGroupCard } from "./AgiStream";
import { PromptKitStream } from "./agent/PromptKitStream";
import { ThinkingBar } from "../prompt-kit/thinking-bar";
import { groupStreamRows, openClarificationFrom } from "../agiStreamGroup";
import { activityFor } from "../agiGraph";
import { AgentActivityLine, QueuedPromptStrip, type QueuedPrompt } from "./AgiStream";
import { loadAssetsBundle, loadAiUsage } from "../data";
import { tokens, isDemoMode } from "../api";
import type { Asset } from "../types";
import {
  loadAgiAccess,
  loadAgiAgreement,
  acceptAgiAgreement,
  loadAgiEngagements,
  createAgiEngagement,
  patchAgiEngagement,
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
  promoteAgiFinding,
  confirmAgiJob,
  answerAgiClarification,
  streamAgiSession,
  pauseAgiSession,
  resumeAgiSession,
  normalizeAgiLoop,
} from "../agi";
import type { AgiAccess, AgiAction, AgiEngagement, AgiSession, AgiTranscriptChunk, AiUsage } from "../types";
import { cx, humanize } from "../utils";
import {
  EngagementContextFields,
  TestingModePicker,
  TESTING_MODES,
  DEFAULT_TESTING_MODE,
  EMPTY_ENGAGEMENT_CONTEXT,
  buildEngagementConfig,
  type EngagementContext,
  type TestingMode,
} from "../testingMode";
import { useStore } from "../store";
import { useStickToBottom } from "../useStickToBottom";
import { useChatSend } from "../useChatSend";
import { sanitizeAgiChunks } from "../agiSanitize";

const POLL_MS = 5000;
const ACTION_POLL_MS = 8000;
// Stream is considered stalled after this much silence while the session still
// claims to be running (no approvals / clarification pending). The watchdog then
// re-syncs the transcript from scratch (self-heals a desynced cursor) and offers
// the operator a Resume that restarts the agent's loop.
const STALL_MS = 45_000;
const WATCHDOG_MS = 7_000;

/** One-tap starting scopes for the pre-session picker.
 *
 *  Each maps to a phase the agent already runs, so an operator can pick an
 *  engagement, tap a scope and start without writing a paragraph first. The
 *  text stays editable afterwards.
 */
const QUICK_INSTRUCTIONS: { key: string; label: string; text: string }[] = [
  {
    key: "vapt",
    label: "VAPT",
    text: "Map and assess the attack surface of the in-scope targets.",
  },
  {
    key: "web",
    label: "Web app",
    text: "Assess the in-scope web applications for injection, auth and access-control flaws.",
  },
  {
    key: "api",
    label: "API",
    text: "Test the in-scope APIs for authorization, injection and business-logic flaws.",
  },
  {
    key: "mobile",
    label: "Mobile App",
    text: "Assess the in-scope mobile application (APK) for insecure storage, transport and auth.",
  },
];

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

// Map an AGI blocker to the person who can clear it and the step they take.
// "Unavailable" without a name leaves the operator stuck; every gate here has
// a known owner.
function blockerGuidance(code: string): string | null {
  switch (code) {
    case "agi_org_disabled":
      return "Ask your organization admin to enable the Autonomous Agent on Platform \u2192 Autonomous Agent.";
    case "agi_plan_required":
      return "Ask your organization admin to upgrade the plan or add the AI Pentest Agent.";
    case "agi_disabled":
      return "The Autonomous Agent is turned off on this deployment \u2014 contact Phantix support to enable it.";
    default:
      return null;
  }
}

/** A turn brief is only worth painting when it describes a real turn.
 *
 *  The backend contract exposes an always-complete brief (safe for rendering),
 *  so an idle/placeholder brief arrives with ``turn: 0``, no findings and no
 *  working_on — and previously was appended as a "Turn 0 … 0 tool calls"
 *  summary that contradicted the live counters shown in the header. */
function hasRealBrief(loop: any): boolean {
  if (!loop || !loop.content) return false;
  if (Number(loop.turn ?? 0) > 0) return true;
  if (loop.summary || loop.working_on) return true;
  return (loop.found?.length ?? 0) > 0 || (loop.next?.length ?? 0) > 0;
}

export default function AgiWorkspace({ variant = "drawer" }: { variant?: WorkspaceVariant }) {
  const { toast, requireDualControl, demoActive } = useStore();
  const reportSubmitted = useRef(false);
  const [access, setAccess] = useState<AgiAccess | null>(null);
  const [booting, setBooting] = useState(true);
  // AgiWorkspace mounts once at app root (inside the always-rendered drawer), so
  // its first boot can run before the app-session token is established — then
  // `/agi/access` fails and the agent looks broken until a full reload. This
  // tracks a successful access load so we can safely re-boot when the operator
  // opens the console, instead of forcing a reload.
  const bootedOkRef = useRef(false);

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
  const [newMode, setNewMode] = useState<TestingMode>(DEFAULT_TESTING_MODE);
  const [engContext, setEngContext] = useState<EngagementContext>(EMPTY_ENGAGEMENT_CONTEXT);
  const [editEng, setEditEng] = useState<AgiEngagement | null>(null);
  const [editMode, setEditMode] = useState<TestingMode>(DEFAULT_TESTING_MODE);
  const [editContext, setEditContext] = useState<EngagementContext>(EMPTY_ENGAGEMENT_CONTEXT);
  const [savingEdit, setSavingEdit] = useState(false);
  const [creating, setCreating] = useState(false);

  // Asset picker — engagements may only target the org's already-added assets.
  const [orgAssets, setOrgAssets] = useState<Asset[]>([]);
  const [assetLoading, setAssetLoading] = useState(false);
  const [assetSearch, setAssetSearch] = useState("");
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<number>>(new Set());
  const [selectAllAssets, setSelectAllAssets] = useState(false);

  // Group the inventory by its first asset tag so the picker reads like the
  // asset inventory does — tagged groups first, untagged assets at the end.
  const assetGroups = useMemo(() => {
    const groups: { name: string; assets: Asset[] }[] = [];
    const index = new Map<string, number>();
    for (const a of orgAssets) {
      const tag = a.tags?.[0]?.name?.trim();
      const name = tag || "Untagged";
      const existing = index.get(name);
      if (existing !== undefined) {
        groups[existing].assets.push(a);
      } else {
        index.set(name, groups.length);
        groups.push({ name, assets: [a] });
      }
    }
    return groups.sort((a, b) => {
      if (a.name === "Untagged") return 1;
      if (b.name === "Untagged") return -1;
      return a.name.localeCompare(b.name);
    });
  }, [orgAssets]);

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
  // Keys of SSE rows already painted, so a reconnect or replay cannot double them.
  const streamKeysRef = useRef<Set<string>>(new Set());
  // Streaming signal: fresh engine output within the window means the agent is
  // actively producing (turn briefs, tool rows, replies) — the activity line
  // shows cognitive verbs then; only true silence falls back to "Waiting for
  // response".
  const lastOutputAtRef = useRef(0);
  const [streaming, setStreaming] = useState(false);
  // Stall watchdog: the stream went silent while the session still claims to be
  // running. `stalled` drives a visible recovery affordance; the ref throttles
  // the automatic re-sync so it runs at most once per stall window.
  const [stalled, setStalled] = useState(false);
  const [resuming, setResuming] = useState(false);
  const lastResyncAtRef = useRef(0);
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
  // Set when the runner's autonomous loop has ended but the SESSION is still
  // alive (resumable by chat). Distinct from session.status so the page stops
  // looking frozen after a bounded stop (max_tools / idle / max_turns) without
  // pretending the session is dead.
  const [loopStopped, setLoopStopped] = useState<string | null>(null);
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
    // /agi/access requires an app session. AgiDrawer mounts this component
    // globally (outside the shell's auth gate), so on a cross-app handoff it can
    // mount before the session is redeemed; calling the endpoint then returns a
    // 401 "Not authenticated". Wait for the session — the shell fires
    // `phantix:app-authenticated` when it is ready, which re-runs boot.
    if (!(tokens.appSession || isDemoMode())) {
      setBooting(false);
      return;
    }
    setBooting(true);
    try {
      const a = await loadAgiAccess();
      setAccess(a);
      bootedOkRef.current = Boolean(a?.agi?.can_use);
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
          if (live.loop_status === "stopped") { setLoopStopped(live.loop_stop_reason || "stopped"); setThinking(false); }
          else setLoopStopped(null);
          const chunks = await loadAgiTranscript(live.id, 0);
          setTranscript(sanitizeAgiChunks(chunks));
          afterSeqRef.current = chunks.length ? Math.max(...chunks.map((c) => c.seq)) : 0;
          try { setActions(await loadAgiPendingActions(live.id)); } catch { /* ignore */ }
        }
      }
    } catch (e) {
      // A 401 means the session is not ready yet (or was just lost) — not a real
      // AGI failure. Stay quiet; the app-authenticated / open listeners re-boot.
      if ((e as { status?: number } | null)?.status !== 401) {
        toast("error", "Could not load AGI access", e instanceof Error ? e.message : "");
      }
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

  useEffect(() => {
    // `boot` itself waits for an app session; the shell's
    // `phantix:app-authenticated` event (handled below) re-runs it on arrival.
    void boot();
  }, [boot]);

  // Opening the console re-boots when the first (app-boot) attempt failed — e.g.
  // it ran before auth was ready. Guarded by `bootedOkRef` so a successful load
  // (and any running-session state) is never clobbered on subsequent opens.
  useEffect(() => {
    const onOpen = () => { if (!bootedOkRef.current) void boot(); };
    window.addEventListener("phantix:agi-open", onOpen);
    window.addEventListener("phantix:app-authenticated", onOpen);
    return () => {
      window.removeEventListener("phantix:agi-open", onOpen);
      window.removeEventListener("phantix:app-authenticated", onOpen);
    };
  }, [boot]);

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
        config: buildEngagementConfig(newMode, engContext, {
          prompts: {},
          tools: ["httpx", "nmap_safe", "nuclei_safe"],
          skills: { auto_select: true, auto_select_limit: 6 },
        }),
      });
      setEngagements((prev) => [eng, ...prev]);
      setSelectedEng(eng.id);
      setCreateOpen(false);
      setNewName("");
      setNewRoe("");
      setNewMode(DEFAULT_TESTING_MODE);
      setEngContext(EMPTY_ENGAGEMENT_CONTEXT);
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

  const openEdit = (eng: AgiEngagement) => {
    const cfg = (eng.config || {}) as Record<string, unknown>;
    setEditEng(eng);
    setEditMode((cfg.testing_mode as TestingMode) || DEFAULT_TESTING_MODE);
    setEditContext({
      process_flow: (cfg.process_flow as string) || "",
      critical_workflows: (cfg.critical_workflows as string) || "",
      out_of_scope_behaviours: (cfg.out_of_scope_behaviours as string) || "",
      rate_limit: (cfg.rate_limit as string) || "",
      tenant_model: (cfg.tenant_model as string) || "",
      source_paths: (cfg.source_paths as string) || "",
      repo: (cfg.repo as string) || "",
      known_findings: (cfg.known_findings as string) || "",
      secrets_locations: (cfg.secrets_locations as string) || "",
      fix_lifecycle: (cfg.fix_lifecycle as string) || "",
      active_exploitation_authorized: cfg.active_exploitation_authorized as boolean | undefined,
      registration_open: cfg.registration_open as boolean | undefined,
      api_spec_urls: Array.isArray(cfg.api_spec_urls)
        ? (cfg.api_spec_urls as string[]).join(", ")
        : (cfg.api_spec_urls as string) || "",
      test_accounts: Array.isArray(cfg.credential_accounts)
        ? (cfg.credential_accounts as Array<{ login_url: string; username: string; password: string }>)
            .map((c) => `${c.username}:${c.password}@${c.login_url}`)
            .join("\n")
        : "",
    });
  };

  const saveEdit = async () => {
    if (!editEng) return;
    setSavingEdit(true);
    try {
      const config = buildEngagementConfig(editMode, editContext, (editEng.config || {}) as Record<string, unknown>);
      const updated = await patchAgiEngagement(editEng.id, { config });
      setEngagements((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      setEditEng(null);
      toast("success", "Engagement updated", `${TESTING_MODES.find((m) => m.id === editMode)?.label} mode saved`);
    } catch (e) {
      toast("error", "Update failed", e instanceof Error ? e.message : "");
    } finally {
      setSavingEdit(false);
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
          "The session may still be starting. Wait a minute and reload this page before retrying — " +
          "retrying immediately can create a duplicate session. If it persists, contact support and " +
          "include the reference shown above.",
        );
      }
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
      reportSubmitted.current = true;
      // Reports are not part of the Attack app. On stop the agent's findings are
      // tagged `phantix_agi` and submitted to the reporting backend; the operator
      // generates the deliverable from Report Solutions on the Core app. So we
      // surface that instruction instead of navigating to a /reports route that
      // only exists in the Core app (here it would just 404).
      toast("success", "Assessment complete", "Findings submitted — generate reports from Report Solutions on the Core app.");
    } catch (e) {
      toast("error", "Stop failed", e instanceof Error ? e.message : "");
    } finally {
      setStopping(false);
    }
  };

  // Pause/resume must reach the runner. Toggling local state only would show
  // "paused" while the agent kept spending credits and probing.
  const togglePause = useCallback(async () => {
    if (!session) return;
    const next = !paused;
    setPaused(next);
    try {
      const s = next ? await pauseAgiSession(session.id) : await resumeAgiSession(session.id);
      setPaused(s.status === "paused");
      toast(
        "success",
        next ? "Agent paused" : "Agent resumed",
        next ? "No model tokens or shell work start while paused." : "The loop continues from where it stopped.",
      );
    } catch (e) {
      setPaused(!next); // never keep a paused UI the runner did not confirm
      toast("error", next ? "Pause failed" : "Resume failed", e instanceof Error ? e.message : "");
    }
  }, [session, paused, toast]);

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

  const dispatchChat = async (msg: string): Promise<boolean> => {
    if (!session || !running || paused) return false;
    // Optimistic resume: sending an instruction restarts the loop server-side.
    setLoopStopped(null);
    if (!(await requireDualControl("Sending instructions to the Autonomous Pentest Agent requires a dual-control operate session."))) return false;
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
      return true;
    } catch (e: any) {
      setThinking(false);
      setPendingPrompts((prev) => prev.filter((p) => p.id !== promptId));
      const blocked = isAgiPolicyBlocked(e);
      if (blocked) { setPolicyBanner(blocked.message); toast("warning", "Policy blocked", blocked.message); return false; }
      const name = String(e?.name ?? "");
      const message = String(e?.message ?? "");
      // Dual-control expired while session still running — clearer copy
      if (/dual.?control|authenticator session|X-Dual-Control/i.test(message) && running) {
        setConnError("Operate session expired — unlock it in the dialog, then resend your message.");
        toast("warning", "Operate session expired", "Unlock the operate session to continue, then resend.");
        return false;
      }
      if (name === "TimeoutError" || name === "AbortError" || /timeout|timed out/i.test(message)) {
        setConnError("Timed out — the agent server is unavailable. Check your connection and try again.");
      } else if (/failed to fetch|networkerror|network error|load failed|fetch/i.test(message)) {
        setConnError("Failed to fetch — could not reach the agent server. Check your connection and try again.");
      } else {
        setConnError(message || "Failed to reach the agent server.");
      }
      toast("error", "Chat failed", e instanceof Error ? e.message : "");
      return false;
    } finally {
      setThinking(false);
    }
  };

  const send = () => {
    const msg = instruction.trim();
    if (!session || !running || paused) return;
    if (!msg) return;
    // Keep the operator's text until the send actually lands. A dual-control
    // expiry (or any failure) leaves the response in the composer to resend.
    chatSend.requestSend(msg, async (m) => {
      const ok = await dispatchChat(m);
      if (ok) setInstruction((cur) => (cur.trim() === m ? "" : cur));
    });
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
    if (!session) return false;
    setAnswering(true);
    setThinking(false);
    try {
      await answerAgiClarification(session.id, { clarification_id: clarificationId, answer });
      setAnsweredClarificationId(clarificationId);
      toast("success", "Clarification answered", "The agent is resuming the assessment.");
      // Force a session refresh so the cleared ask + resumed loop reflect quickly.
      loadAgiSession(session.id).then((s) => { if (s) setSession(s); }).catch(() => {});
      return true;
    } catch (e) {
      toast("error", "Answer failed", e instanceof Error ? e.message : "");
      return false;
    } finally {
      setAnswering(false);
    }
  }, [session, toast]);

  // ── Drawer issues strip ───────────────────────────────────────────────────
  // Surface backend findings in the compact drawer so issues are visible
  // without opening the full console, and link out to the findings tracker.
  const [drawerFindings, setDrawerFindings] = useState<Array<Record<string, unknown>>>([]);
  const [usage, setUsage] = useState<AiUsage | null>(null);
  // Budget snapshot. Loaded once so the metrics read before any run starts, and
  // refreshed during a live session because a budget can be exhausted mid-run.
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      loadAiUsage()
        .then((u) => {
          if (!cancelled) setUsage(u);
        })
        .catch(() => {});
    load();
    if (!running) return () => {
      cancelled = true;
    };
    const t = window.setInterval(load, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [running]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const load = () =>
      loadAgiFindings(session.id).then((fs) => {
        if (!cancelled) setDrawerFindings(Array.isArray(fs) ? fs : []);
      }).catch(() => {});
    // Always fetch once first — this is the FINAL fetch that used to be skipped:
    // the old guard (`!running`) returned early the moment the session stopped,
    // so findings recorded at/after completion never appeared. Keep polling only
    // while the session is live.
    load();
    // Realtime nudge: keep the compact drawer's findings current without
    // relying on the poll interval alone.
    const onFinding = (e: Event) => {
      const detail = (e as CustomEvent<{ sessionId?: number }>).detail;
      if (detail?.sessionId && Number(detail.sessionId) !== Number(session.id)) return;
      void load();
    };
    window.addEventListener("phantix:agi-finding", onFinding);
    const t = running ? window.setInterval(load, 12000) : undefined;
    return () => {
      cancelled = true;
      if (t) window.clearInterval(t);
      window.removeEventListener("phantix:agi-finding", onFinding);
    };
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

  // ── Promote a finding / confirm the job ───────────────────────────────────
  const [promoting, setPromoting] = useState<string | null>(null);
  const [jobBusy, setJobBusy] = useState(false);

  const promoteFinding = async (findingId: unknown) => {
    if (!session || findingId == null) return;
    setPromoting(String(findingId));
    try {
      await promoteAgiFinding(session.id, String(findingId));
      toast("success", "Promoted", "The finding is now in your risk register.");
      const fs = await loadAgiFindings(session.id);
      setDrawerFindings(Array.isArray(fs) ? fs : []);
    } catch (e) {
      toast("error", "Could not promote", e instanceof Error ? e.message : "");
    } finally {
      setPromoting(null);
    }
  };

  const confirmJob = async () => {
    if (!session) return;
    setJobBusy(true);
    try {
      await confirmAgiJob(session.id);
      toast("success", "Job confirmed", "The session can complete and tear down.");
      const fresh = await loadAgiSession(session.id);
      if (fresh) setSession(fresh);
    } catch (e) {
      toast("error", "Could not confirm the job", e instanceof Error ? e.message : "");
    } finally {
      setJobBusy(false);
    }
  };
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

  // Live SSE: paint loop briefs, approvals, findings and harness events the
  // moment they happen. The 5s/8s polls above remain the correctness fallback;
  // this is what makes the console feel live instead of lagged.
  useEffect(() => {
    if (!running || !session || paused || isDemoMode()) return;
    const controller = new AbortController();
    const streamKeys = streamKeysRef.current;
    const pushLive = (key: string, content: string, meta: Record<string, unknown>) => {
      if (streamKeys.has(key)) return;
      streamKeys.add(key);
      setTranscript((prev) => [
        ...prev,
        {
          seq: afterSeqRef.current + 1,
          role: "system",
          content,
          meta: { ...meta, streamKey: key },
          created_at: new Date().toISOString(),
        },
      ]);
    };
    const refreshActions = () => { void loadAgiPendingActions(session.id).then(setActions).catch(() => {}); };
    const refreshFindings = () => { void loadAgiFindings(session.id).then((fs) => setDrawerFindings(Array.isArray(fs) ? fs : [])).catch(() => {}); };

    void streamAgiSession(session.id, (event, data) => {
      try {
        if (event === "loop_status" || event === "loop_progress") {
          const loop = normalizeAgiLoop(JSON.parse(data));
          if (loop.working_on) setWorkingOn(loop.working_on);
          if (event === "loop_status") { setThinking(true); setLoopStopped(null); }
          if (event === "loop_progress") {
            setThinking(false);
            if (hasRealBrief(loop)) {
              // The persisted row is stored through strip_emojis() -> .strip(), so
              // the streamed text (which ends with a newline) never byte-matched
              // its own stored twin and every brief was painted twice. Compare and
              // paint the trimmed form so both copies agree.
              const briefText = (loop.content ?? "").trim();
              setTranscript((prev) => {
                if (prev.some((p) => p.role === "assistant" && (p.content ?? "").trim() === briefText)) return prev;
                localKeysRef.current.set(`assistant|${briefText}`, Date.now());
                return [...prev, { seq: afterSeqRef.current + 1, role: "assistant", content: briefText, meta: { kind: "turn_brief", event: "loop_progress", turn: loop.turn }, created_at: new Date().toISOString() }];
              });
            }
            lastOutputAtRef.current = Date.now();
          }
          return;
        }
        if (event === "token") { setThinking(true); return; }
        if (event === "job_progress" || event === "todo") {
          // Live checklist: the runner emits the job view directly on every change
          // (plan declared, tool advances an item, finding satisfies it). Without
          // this the to-do list only refreshed on the 10s session poll.
          try {
            const view = JSON.parse(data) as Record<string, unknown>;
            setSession((s) => (s ? { ...s, job: { ...(s.job ?? {}), ...view } } : s));
          } catch { /* ignore malformed frame */ }
          return;
        }
        if (event === "assistant_done") { setThinking(false); return; }
        if (event === "action_pending" || event === "action_executed" || event === "action_rejected") {
          refreshActions();
          return;
        }
        if (event === "finding" || event === "finding_verified") {
          refreshFindings();
          return;
        }
        if (event === "finding_dropped") {
          refreshFindings();
          const p = JSON.parse(data) as { title?: string; verdict?: string; confidence?: number; reason?: string };
          pushLive(
            `dropped-${p.title ?? ""}-${p.confidence ?? ""}`,
            `Candidate dropped as a non-vulnerability — "${p.title || "candidate"}" (${p.verdict || p.reason || "control"}, confidence ${p.confidence ?? "?"})`,
            { kind: "finding_dropped", event, ...p },
          );
          return;
        }
        if (event === "teardown") { setRunning(false); setLoopStopped(null); return; }
        if (event === "loop_stop") {
          const reason = String((JSON.parse(data) as { reason?: string })?.reason || "stopped");
          setLoopStopped(reason);
          setThinking(false);
          return;
        }
        if (event === "loop_paused") { setPaused(true); pushLive(`paused-${Date.now()}`, "Operator paused the agent.", { kind: "loop_paused", event }); return; }
        if (event === "loop_resumed") { setPaused(false); pushLive(`resumed-${Date.now()}`, "Operator resumed the agent.", { kind: "loop_resumed", event }); return; }
        if (event === "campaign_done") {
          const p = JSON.parse(data) as { found?: number; assets?: number; summary?: { elapsed?: number; categories?: string[] } };
          pushLive(
            `campaign-${p.summary?.elapsed ?? ""}-${p.assets ?? 0}-${p.found ?? 0}`,
            `Campaign complete — ${p.found ?? 0} finding(s) across ${p.assets ?? 0} asset(s) in ${p.summary?.elapsed ?? "?"}s.`,
            { kind: "campaign_done", event, ...p },
          );
          return;
        }
        if (event === "decision_review") {
          const p = JSON.parse(data) as { verdict?: string; unresolved?: string[]; next?: string[]; findings?: number };
          pushLive(
            `review-${(p.unresolved || []).length}-${(p.next || []).join(",")}`,
            `Decision review — verdict: ${p.verdict || "continue"}. ${(p.unresolved || []).length} open lead(s).`,
            { kind: "decision_review", event, ...p },
          );
          return;
        }
        if (event === "verify_all") {
          const p = JSON.parse(data) as { count?: number; verified?: number; dismissed?: number; inconclusive?: number };
          if (typeof p.count === "number") {
            pushLive(
              `verify-${p.count}-${p.verified ?? 0}-${p.dismissed ?? 0}-${p.inconclusive ?? 0}`,
              `Verification — ${p.count} finding(s): ${p.verified ?? 0} confirmed, ${p.dismissed ?? 0} dismissed, ${p.inconclusive ?? 0} inconclusive`,
              { kind: "verify_all", event, ...p },
            );
            refreshFindings();
          }
          return;
        }
        if (event === "ai_credit_spend") {
          const p = JSON.parse(data) as { estimated_credits?: number; total_tokens?: number };
          pushLive(
            `credits-${p.estimated_credits ?? 0}-${p.total_tokens ?? 0}`,
            `AI spend — ${p.estimated_credits ?? 0} credit(s) across ${p.total_tokens ?? 0} token(s).`,
            { kind: "ai_credit_spend", event, ...p },
          );
          return;
        }
      } catch { /* ignore malformed frames — polling still reconciles */ }
    }, controller.signal).catch(() => { /* SSE fallback: polling continues */ });
    return () => controller.abort();
  }, [running, session?.id, paused]);

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
        if (s.loop_status === "stopped") { setLoopStopped(s.loop_stop_reason || "stopped"); setThinking(false); }
        else if (s.loop_status === "running") setLoopStopped(null);
        if (s.loop?.working_on) setWorkingOn(s.loop.working_on);
        if (s.loop?.event === "loop_progress" && hasRealBrief(s.loop)) {
          const briefText = (s.loop?.content ?? "").trim();
          setTranscript((prev) => {
            // Each brief embeds a unique turn counter, so a match anywhere in the
            // transcript means it is already painted (by this poll or by the
            // transcript poll) — never re-append it. Compare on the trimmed text:
            // the stored row is stripped, the streamed copy is not.
            if (prev.some((p) => p.role === "assistant" && (p.content ?? "").trim() === briefText)) return prev;
            // Remember the locally-painted brief so the transcript poll skips
            // its persisted twin (key consumed on first match).
            localKeysRef.current.set(`assistant|${briefText}`, Date.now());
            return [...prev, { seq: afterSeqRef.current + 1, role: "assistant", content: briefText, meta: { kind: "turn_brief", event: "loop_progress", turn: s.loop?.turn }, created_at: new Date().toISOString() }];
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

  // Full transcript re-sync: refetch from seq 0 and merge anything we are missing
  // (dedup by seq + locally-appended twins), then refresh the session. Self-heals
  // a desynced cursor and any dropped poll batch. Read-only; no dual control.
  const resyncTranscript = useCallback(async () => {
    if (!session || pollBusyRef.current) return;
    pollBusyRef.current = true;
    try {
      const chunks = await loadAgiTranscript(session.id, 0);
      if (chunks.length > 0) {
        const safe = sanitizeAgiChunks(chunks);
        let added = 0;
        setTranscript((prev) => {
          const seenSeqs = new Set(prev.filter((p) => p.seq > 0).map((p) => p.seq));
          const out: AgiTranscriptChunk[] = [];
          for (const c of safe) {
            if (c.seq > 0 && seenSeqs.has(c.seq)) continue;
            const key = `${c.role}|${c.content}`;
            if (localKeysRef.current.has(key)) { localKeysRef.current.delete(key); continue; }
            out.push(c);
          }
          added = out.length;
          if (out.length === 0) return prev;
          return [...prev, ...out];
        });
        afterSeqRef.current = Math.max(afterSeqRef.current, ...chunks.map((c) => c.seq));
        if (added > 0) { lastOutputAtRef.current = Date.now(); setStalled(false); }
      }
      const s = await loadAgiSession(session.id);
      if (s) {
        setSession(s);
        if (s.loop_status === "stopped") { setLoopStopped(s.loop_stop_reason || "stopped"); setThinking(false); }
        else if (s.loop_status === "running") setLoopStopped(null);
        if (s.status === "stopped" || s.status === "torn_down" || s.status === "failed") setRunning(false);
      }
    } catch { /* transient — the watchdog will retry */ }
    finally { pollBusyRef.current = false; }
  }, [session]);

  // Stall watchdog: while the session claims to be running with no approval or
  // clarification pending, silence past STALL_MS means the stream is wedged. Flag
  // it (so the UI stops looking frozen) and auto re-sync once per window.
  useEffect(() => {
    if (!running || !session || paused || demoActive) { setStalled(false); return; }
    const check = () => {
      // First tick after (re)adopting a running session: seed the clock so we do
      // not flag a stall before the first poll has had a chance to bring output.
      if (!lastOutputAtRef.current) { lastOutputAtRef.current = Date.now(); setStalled(false); return; }
      const quietFor = Date.now() - lastOutputAtRef.current;
      const blocked = actions.length > 0 || Boolean(openClarification) || thinking || Boolean(loopStopped);
      if (blocked || quietFor < STALL_MS) { setStalled(false); return; }
      setStalled(true);
      if (Date.now() - lastResyncAtRef.current > STALL_MS) {
        lastResyncAtRef.current = Date.now();
        void resyncTranscript();
      }
    };
    check();
    const t = window.setInterval(check, WATCHDOG_MS);
    return () => window.clearInterval(t);
  }, [running, session?.id, paused, demoActive, actions.length, openClarification, thinking, loopStopped, resyncTranscript]);

  // Operator-initiated recovery from a stall: nudge the backend so it restarts
  // the autonomous loop, and re-sync in case chunks were only missed on the client.
  const resumeAgent = useCallback(async () => {
    if (!session || !running || paused || resuming) return;
    setResuming(true);
    try {
      await resyncTranscript();
      // Only nudge the loop if the re-sync did not already bring it back to life.
      if (Date.now() - lastOutputAtRef.current > STALL_MS) {
        await dispatchChat("Continue the assessment toward the open objectives.");
      }
      setStalled(false);
    } finally {
      setResuming(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, running, paused, resuming, resyncTranscript]);

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
          <SkeletonBlock className="mx-auto h-2 w-44 rounded-full" />
          <p className="mt-3 text-xs text-slate-500">Checking AGI availability...</p>
        </div>
      </div>
    );
  }

  const canUse = Boolean(access?.agi.can_use);
  const agreementRequired = Boolean(access?.agi.agreement_required);
  // The drawer is narrow; the metric groups stay identical and only reflow.
  const COMPACT = variant !== "page";
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
              <li key={b.code} className="flex items-start gap-1.5">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-600" />
                <span>
                  {b.message}
                  {blockerGuidance(b.code) && (
                    <span className="mt-0.5 block text-gold-200/90">{blockerGuidance(b.code)}</span>
                  )}
                </span>
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

          {/* What is actually being agreed to. A gate that only says "accept"
              asks for consent without stating the terms it governs. */}
          <div className="mt-6 w-full max-w-lg rounded-xl border border-phantix-700/40 bg-phantix-900/40 p-3 text-left">
            <AgiMetrics
              access={access}
              session={null}
              usage={usage}
              findingCount={0}
              pendingCount={0}
              running={false}
              compact={COMPACT}
            />
          </div>
        </div>
      )}

      {/* Main workspace */}
      {canUse && (
        <div className="flex min-h-0 flex-1 flex-col">
          {!session ? (
            /* No session — engagement picker / create */
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {/* Limits and budget belong here too: they decide whether a run is
                  worth starting, which is a decision made before picking. */}
              <div className="rounded-xl border border-phantix-700/40 bg-phantix-900/40 p-3">
                <AgiMetrics
                  access={access}
                  session={null}
                  usage={usage}
                  findingCount={0}
                  pendingCount={0}
                  running={false}
                  compact={COMPACT}
                  collapsible
                  defaultCollapsed={COMPACT}
                />
              </div>

              <div className="overflow-hidden rounded-xl border border-phantix-700/40 bg-phantix-900/40">
                <div className="flex items-center justify-between border-b border-phantix-700/40 px-3 py-2">
                  <p className="wb-pane-title">1 · Choose an engagement</p>
                  <button onClick={() => setCreateOpen((v) => !v)} className="btn-ghost !px-2 !py-1 wb-xs"><Plus size={12} className="mr-1 inline" /> New</button>
                </div>

                <div className="wb-scroll max-h-[min(45vh,380px)] overflow-y-auto p-2">
                  {createOpen && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-2 space-y-2 rounded-xl border border-phantix-700/40 bg-phantix-900/50 p-3">
                  <p className="wb-pane-title">New engagement</p>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-slate-400">Engagement name</span>
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="e.g. Lab external web"
                      className="wb-sm w-full rounded-lg border border-phantix-700/50 bg-phantix-950/60 px-3 py-2 text-slate-200 outline-none placeholder:text-slate-600 focus:border-gold-400/40"
                    />
                  </label>
                  <div className="rounded-lg border border-phantix-700/50 bg-phantix-950/60 p-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="wb-pane-title">Target assets</p>
                        <p className="mt-0.5 text-[12px] leading-4 text-slate-500">
                          Pick the assets this engagement may touch. Only selected assets become allowlist targets.
                        </p>
                      </div>
                      <label className="wb-xs flex shrink-0 cursor-pointer items-center gap-1.5 pt-0.5 text-slate-400">
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
                      <div className="wb-scroll mt-2 max-h-64 space-y-3 overflow-y-auto pr-1">
                        {assetGroups.map((group) => {
                          const visible = selectAllAssets
                            ? group.assets
                            : group.assets.filter((a) => !assetSearch.trim() || a.value.toLowerCase().includes(assetSearch.toLowerCase()) || a.name.toLowerCase().includes(assetSearch.toLowerCase()));
                          if (visible.length === 0) return null;
                          const allSelected = selectAllAssets || visible.every((a) => selectedAssetIds.has(a.id));
                          return (
                            <div key={group.name}>
                              <button
                                type="button"
                                onClick={() => {
                                  if (selectAllAssets) return;
                                  setSelectedAssetIds((prev) => {
                                    const next = new Set(prev);
                                    for (const a of visible) {
                                      if (allSelected) next.delete(a.id); else next.add(a.id);
                                    }
                                    return next;
                                  });
                                }}
                                className="mb-1 flex w-full items-center gap-2 text-left"
                              >
                                <span className={cx("flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[12px]", allSelected ? "border-gold-400/50 bg-gold-400/20 text-gold-300" : "border-phantix-600 text-transparent")}>
                                  {allSelected ? "✓" : ""}
                                </span>
                                <span className="wb-2xs font-semibold uppercase tracking-wider text-slate-400">{group.name}</span>
                                <span className="wb-2xs text-slate-600">{visible.length} asset{visible.length === 1 ? "" : "s"}</span>
                              </button>
                              <div className="space-y-1 pl-5">
                                {visible.map((a) => (
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
                                    <span className="wb-2xs shrink-0 uppercase tracking-wider text-slate-500">{humanize(a.asset_type)}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <p className="wb-2xs mt-1.5 text-slate-600">
                      {selectAllAssets
                        ? `${orgAssets.length} asset${orgAssets.length === 1 ? "" : "s"} selected (all)`
                        : `${selectedAssetIds.size} of ${orgAssets.length} selected`}
                    </p>
                  </div>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-slate-400">Rules of engagement</span>
                    <input
                      value={newRoe}
                      onChange={(e) => setNewRoe(e.target.value)}
                      placeholder="e.g. Business hours only, no destructive actions"
                      className="wb-sm w-full rounded-lg border border-phantix-700/50 bg-phantix-950/60 px-3 py-2 text-slate-200 outline-none placeholder:text-slate-600 focus:border-gold-400/40"
                    />
                    <span className="mt-1 block text-[12px] leading-4 text-slate-600">Optional. Defaults to authorized targets only, no destructive actions.</span>
                  </label>
                  <div className="space-y-2">
                    <span className="block text-xs font-semibold text-slate-400">Testing mode</span>
                    <TestingModePicker value={newMode} onChange={setNewMode} disabled={creating} />
                    <span className="block text-[12px] leading-4 text-slate-600">
                      {TESTING_MODES.find((m) => m.id === newMode)?.description}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <span className="block text-xs font-semibold text-slate-400">
                      Engagement context — answers the agent up front so it does not stop to ask
                    </span>
                    <EngagementContextFields
                      mode={newMode}
                      values={engContext}
                      onChange={setEngContext}
                      disabled={creating}
                    />
                  </div>
                  <button onClick={() => void createEngagement()} disabled={creating} className="btn-primary w-full !py-2 wb-sm">
                    {creating ? <Loader2 size={12} className="mr-1 animate-spin inline" /> : <Plus size={12} className="mr-1 inline" />} Create engagement
                  </button>
                </motion.div>
              )}

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
                    <div key={e.id} className="relative">
                    <button
                      onClick={() => setSelectedEng(e.id)}
                      className={cx(
                        "w-full rounded-xl border px-3 py-2.5 pr-9 text-left transition-colors",
                        selectedEng === e.id ? "border-gold-400/50 bg-gold-400/5" : "border-phantix-700/40 bg-phantix-900/40 hover:border-phantix-500/40",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Globe2 size={13} className="shrink-0 text-gold-400" />
                        <span className="wb-sm min-w-0 truncate font-semibold text-slate-200">{e.name}</span>
                        <span className={cx("ml-auto chip shrink-0 !px-2 !py-0.5 wb-2xs", e.status === "ready" ? "border-gold-400/30 bg-gold-400/10 text-gold-300" : "border-phantix-600/40 bg-phantix-800/50 text-slate-400")}>{humanize(e.status)}</span>
                      </div>
                      <p className="wb-2xs mt-1.5 flex items-center gap-1.5 text-slate-500">
                        <span className="shrink-0 font-semibold text-slate-400">{e.scope_definition.target_allowlist.length} target{e.scope_definition.target_allowlist.length === 1 ? "" : "s"}</span>
                        <span className="min-w-0 truncate font-mono">
                          {e.scope_definition.target_allowlist.slice(0, 3).join(", ")}
                          {e.scope_definition.target_allowlist.length > 3 ? "…" : ""}
                        </span>
                      </p>
                      {e.scope_definition.rules_of_engagement && (
                        <p className="wb-2xs mt-1 line-clamp-1 text-slate-600">ROE: {e.scope_definition.rules_of_engagement}</p>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={(ev) => { ev.stopPropagation(); openEdit(e); }}
                      title="Edit testing mode & engagement context"
                      className="absolute right-2 top-2 rounded-md border border-phantix-700/50 bg-phantix-900/80 p-1 text-slate-500 transition-colors hover:text-gold-300"
                    >
                      <Pencil size={11} />
                    </button>
                    </div>
                  ))}
                </div>
              )}
                </div>
              </div>

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
                {/* One-tap starting scope — fills the instruction so an engagement
                    can be selected and started without typing first. */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {QUICK_INSTRUCTIONS.map((q) => {
                    const active = instruction.trim() === q.text;
                    return (
                      <button
                        key={q.key}
                        type="button"
                        disabled={!selectedEng}
                        aria-pressed={active}
                        onClick={() => setInstruction(q.text)}
                        className={cx(
                          "wb-xs rounded-lg border px-2.5 py-1.5 font-medium transition-colors disabled:opacity-50",
                          active
                            ? "border-gold-400/50 bg-gold-400/15 text-gold-200"
                            : "border-phantix-700/50 bg-phantix-950/50 text-slate-400 hover:bg-phantix-800/60 hover:text-slate-200",
                        )}
                      >
                        {q.label}
                      </button>
                    );
                  })}
                </div>
                <button onClick={() => void start()} disabled={!selectedEng || !instruction.trim() || starting} className="btn-primary mt-2 w-full !py-2.5 wb-sm">
                  {starting ? <Loader2 size={13} className="mr-1 animate-spin inline" /> : <Radar size={13} className="mr-1 inline" />} Start session
                </button>
              </div>
            </div>
          ) : variant === "console" ? (
            <AgiConsole
              running={running}
              paused={paused}
              onTogglePause={() => void togglePause()}
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
                <span className={cx("chip !px-2 !py-0.5 wb-2xs", loopStopped ? "border-severity-medium/30 bg-severity-medium/10 text-severity-medium" : running ? "border-gold-400/30 bg-gold-400/10 text-gold-300" : "border-phantix-600/40 bg-phantix-800/50 text-slate-400")}>
                  {loopStopped
                    ? <span className="flex items-center gap-1" title={`Autonomous loop stopped: ${loopStopped}`}><span className="h-1.5 w-1.5 rounded-full bg-severity-medium" /> loop stopped</span>
                    : running ? <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-gold-400" /> running</span> : "stopped"}
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

              {/* Standard metric strip — same three groups in every state of this
                  module, so "how far in, will it finish, what may it touch" is
                  answered without opening another surface. */}
              <div className="border-b border-phantix-700/40 px-3 py-2.5">
                <AgiMetrics
                  access={access}
                  session={session}
                  usage={usage}
                  findingCount={drawerFindings.length}
                  pendingCount={actions.length}
                  running={running}
                  compact={COMPACT}
                  collapsible={COMPACT}
                  defaultCollapsed={COMPACT}
                />
              </div>

              {/* Live pentest to-do: the loop checklist, ticked off as the agent advances */}
              {session.job && (
                <div className="border-b border-phantix-700/40 px-3 py-2">
                  <PentestTodo job={session.job as Parameters<typeof PentestTodo>[0]["job"]} running={running} />
                </div>
              )}

              {/* The agent claims the job is done — a human has to agree before the
                  session completes. Confirming is dual-controlled server-side. */}
              {(() => {
                const job = (session.job ?? {}) as Record<string, unknown>;
                const status = String(job.status ?? "");
                const needsConfirm =
                  Boolean(job.confirm_required ?? job.require_confirm) || status === "complete_pending_confirm";
                if (!needsConfirm) return null;
                return (
                  <div className="border-b border-phantix-700/40 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gold-400/30 bg-gold-400/[0.08] px-3 py-2">
                      <CheckCircle2 size={13} className="shrink-0 text-gold-300" />
                      <p className="wb-xs flex-1 text-gold-100">
                        The agent reports the job complete. Confirm to finish and tear down the container.
                      </p>
                      <button onClick={() => void confirmJob()} disabled={jobBusy} className="btn-primary !px-2.5 !py-1 wb-xs shrink-0">
                        {jobBusy ? <Loader2 size={11} className="mr-1 inline animate-spin" /> : <CheckCircle2 size={11} className="mr-1 inline" />}
                        Confirm job
                      </button>
                    </div>
                  </div>
                );
              })()}

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
                  {drawerFindings.length > 0 && (
                    <div className="space-y-1.5">
                      {drawerFindings.slice(0, 6).map((f, i) => {
                        const fid = f.id ?? f.finding_id ?? f.finding_key ?? f.key ?? i;
                        const promoted = Boolean(f.promoted ?? f.risk_id);
                        return (
                          <div
                            key={`${String(fid)}-${i}`}
                            className="flex items-center gap-2 rounded-xl border border-phantix-700/40 bg-phantix-900/50 px-3 py-2"
                          >
                            <p className="wb-xs min-w-0 flex-1 truncate text-slate-300">
                              {String(f.title ?? "Finding")}
                            </p>
                            {promoted ? (
                              <span className="chip shrink-0 border-emerald-400/30 text-emerald-400">in risk register</span>
                            ) : (
                              <button
                                onClick={() => void promoteFinding(fid)}
                                disabled={promoting === String(fid)}
                                className="btn-ghost shrink-0 !px-2 !py-0.5 wb-xs disabled:opacity-50"
                                title="Promote this session finding into the org risk register"
                              >
                                {promoting === String(fid) ? (
                                  <Loader2 size={10} className="mr-1 inline animate-spin" />
                                ) : (
                                  <ShieldAlert size={10} className="mr-1 inline" />
                                )}
                                Promote
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
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
                  {running && transcript.length > 0 && !thinking && !connError && actions.length === 0 && !openClarification && !stalled && (
                    <p className="wb-xs text-center text-slate-600">— awaiting engine output —</p>
                  )}
                  {running && !thinking && !connError && actions.length === 0 && !openClarification && stalled && (
                    <div className="mx-auto my-1 flex max-w-md flex-col items-center gap-2 rounded-xl border border-phantix-700/50 bg-phantix-900/50 px-4 py-3 text-center">
                      <p className="wb-xs text-slate-400">
                        The agent has been quiet for a while — re-syncing the transcript. If it stays idle, resume the run.
                      </p>
                      <button
                        type="button"
                        onClick={() => void resumeAgent()}
                        disabled={resuming}
                        className="btn-secondary !px-3 !py-1.5 wb-xs disabled:opacity-60"
                      >
                        {resuming ? "Resuming…" : "Resume agent"}
                      </button>
                    </div>
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
                      startedAt: session.started_at,
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
                {loopStopped && (
                  <div className="mb-2 flex items-start gap-2 rounded-lg border border-severity-medium/30 bg-severity-medium/10 px-3 py-2 text-[12px] text-severity-medium">
                    <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                    <span>Autonomous loop stopped (<span className="font-mono">{loopStopped}</span>). Send a message to continue where it left off, or start a new session.</span>
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
                    placeholder={loopStopped ? "Loop stopped — send a message to continue..." : running ? "Further instructions for the agent..." : "Session stopped"}
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
      <Modal open={!!editEng} onClose={() => setEditEng(null)} title={`Engagement settings · ${editEng?.name ?? ""}`} wide>
        <div className="space-y-4">
          <div className="space-y-2">
            <span className="block text-xs font-semibold text-slate-400">Testing mode</span>
            <TestingModePicker value={editMode} onChange={setEditMode} disabled={savingEdit} />
            <span className="block text-[12px] leading-4 text-slate-600">
              {TESTING_MODES.find((m) => m.id === editMode)?.description}
            </span>
          </div>
          <EngagementContextFields mode={editMode} values={editContext} onChange={setEditContext} disabled={savingEdit} />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditEng(null)}
              className="wb-sm rounded-lg border border-phantix-700/50 px-3 py-2 text-slate-300 hover:border-phantix-500/50"
            >
              Cancel
            </button>
            <button type="button" onClick={() => void saveEdit()} disabled={savingEdit} className="btn-primary wb-sm">
              {savingEdit ? <Loader2 size={12} className="mr-1 inline animate-spin" /> : null} Save settings
            </button>
          </div>
        </div>
      </Modal>

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
          {/* Help sits under the button so the agreement is read first — the guide
              explains scope, approvals and what the agent may never touch.
              DocLink opens in a new tab, so this modal (and the drawer, if
              open) stays exactly as the operator left it. */}
          <div className="flex justify-center">
            <DocLink docId="howto-app-17" />
          </div>
        </div>
      </Modal>
    </div>
  );
}
