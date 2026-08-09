import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, Send, Sparkles, Lock, ShieldCheck, Trash2, Loader2, Radar, ShieldAlert, Scale,
  Crosshair, Boxes, Globe2, Timer, Square, BrainCircuit, ChevronDown, ChevronRight,
  ThumbsUp, AlertTriangle, RotateCcw, Cpu,
} from "lucide-react";
import { PageHeader, Card } from "@/components/ui";
import AgiWorkspace from "@/components/AgiWorkspace";
import {
  loadAiStatus,
  streamAgentChat,
  streamAgentRun,
  loadAgentSkills,
  setAgentSkillStatus,
} from "@/lib/data";
import { PLATFORM_AI_URL } from "@/lib/links";
import { useStore } from "@/lib/store";
import { cx } from "@/lib/utils";
import type { AiStatus, AgentSkill } from "@/lib/types";

type ChatMsg = {
  role: "user" | "agent";
  text: string;
  thinking?: string;
  runId?: string;
  skills?: string[];
};

const DOMAINS = [
  { id: "vapt", label: "VAPT", icon: <Crosshair size={14} />, desc: "Campaign write-ups" },
  { id: "soc", label: "SOC", icon: <Radar size={14} />, desc: "Triage assist" },
  { id: "grc", label: "GRC", icon: <Scale size={14} />, desc: "Explain gaps" },
  { id: "ti", label: "Threat Intel", icon: <Globe2 size={14} />, desc: "Correlate" },
  { id: "asset", label: "Asset", icon: <Boxes size={14} />, desc: "Exposure brief" },
  { id: "cross", label: "Cross", icon: <ShieldAlert size={14} />, desc: "Global ask" },
];

const SUGGESTIONS = [
  "Summarize my current security posture",
  "Which of my assets are highest risk?",
  "What findings would appear in my next report?",
  "How many critical risks are open right now?",
];

const MODEL_BADGE = "deepseek-v4-flash";

// ── Request clarification ────────────────────────────────────────────────────
// Quick prompts and vague questions are answered locally by a lightweight
// "assistant" that helps the user pin down a specific request before any backend
// / LLM call is made. Only once a concrete ask is established do we stream to
// the agent.
type ClarifyResult =
  | { clear: true }
  | { clear: false; reply: string; followUps: string[] };

function clarifyRequest(raw: string): ClarifyResult {
  const q = raw.toLowerCase().trim();

  // Direct, scoped asks already carry a concrete target → go to backend.
  const directPatterns = [
    /summarize.*(posture|security posture)/,
    /how many.*(critical|open).*risk/,
    /which.*(asset|host|server).*(risk|exposure|critical)/,
    /what findings.*(report|next)/,
    /highest risk/i,
    /list.*(assets|risks|findings|campaigns)/,
    /show.*(assets|risks|findings|campaigns|scans)/,
    /explain.*(finding|cve|risk|treatment)/,
    /status of.*(scan|campaign|job)/,
  ];
  if (directPatterns.some((re) => re.test(q))) return { clear: true };

  // Greeting / thanks → generic reply, no backend.
  if (/^(hi|hello|hey|thanks|thank you|ok|okay|bye)\b/.test(q)) {
    return {
      clear: false,
      reply: "I'm Phantix Agent — your security operations assistant. I can summarize your posture, surface highest-risk assets, list open critical risks, preview report findings, and explain risks or findings. What would you like to look into?",
      followUps: ["Summarize my current security posture", "Which assets are highest risk?", "How many critical risks are open right now?"],
    };
  }

  // Ambiguous topic (mentions a domain but no concrete ask) → clarify.
  const topic = q.match(/asset|server|host|endpoint|domain/)
    ? "assets"
    : q.match(/risk|threat|treatment|exposure/)
      ? "risks"
      : q.match(/scan|nmap|nuclei|vulnerabilit/)
        ? "scans"
        : q.match(/vapt|campaign|pen.?test/)
          ? "vapt"
          : q.match(/finding|cve|vuln/)
            ? "findings"
            : q.match(/complian|grc|framework|iso|evidence|gap/)
              ? "compliance"
              : q.match(/report|pdf|docx|executive summary/)
                ? "reports"
                : q.match(/soc|triage|detection|alert|incident/)
                  ? "soc"
                  : q.match(/posture|score/)
                    ? "posture"
                    : null;

  if (topic) {
    const byTopic: Record<string, { reply: string; followUps: string[] }> = {
      assets: {
        reply: "Happy to help with assets. To pull the right information, which one did you have in mind?",
        followUps: ["Which of my assets are highest risk?", "List assets discovered recently", "Show assets that haven't been scanned"],
      },
      risks: {
        reply: "I can walk through your risk register. What would you like me to focus on?",
        followUps: ["How many critical risks are open right now?", "List risks in P1", "Show the highest-scored risk and why"],
      },
      scans: {
        reply: "I can summarize scan activity for you. What do you want to know?",
        followUps: ["Status of my latest scan", "What findings came from my last scan?", "How many scans are running right now?"],
      },
      vapt: {
        reply: "I can help with VAPT campaigns. What would you like me to check?",
        followUps: ["List my active campaigns", "Status of campaign #12", "What findings would appear in my next report?"],
      },
      findings: {
        reply: "I can explain findings or summarize them for reports. What's the specific question?",
        followUps: ["What findings would appear in my next report?", "Explain the most critical open finding", "List verified findings"],
      },
      compliance: {
        reply: "I can walk through compliance posture. What framework or question do you have?",
        followUps: ["Summarize my compliance gaps", "How ready am I for ISO 27001?", "What evidence is missing?"],
      },
      reports: {
        reply: "I can preview what would land in a report. Which report or finding set should I look at?",
        followUps: ["What findings would appear in my next report?", "Preview my executive summary", "List generated reports"],
      },
      soc: {
        reply: "I can help with SOC triage. Which part do you want to look at?",
        followUps: ["How many open detections do I have?", "List critical detections", "Summarize the triage queue"],
      },
      posture: {
        reply: "I can summarize your posture. What angle would help most?",
        followUps: ["Summarize my current security posture", "Show my posture trend", "What's driving my posture score down?"],
      },
    };
    const m = byTopic[topic];
    return { clear: false, reply: m.reply, followUps: m.followUps };
  }

  // No recognizable topic → guide the user toward a concrete ask.
  return {
    clear: false,
    reply: "I want to make sure I answer the right thing. Could you be more specific — for example, ask me about your assets, risks, scans, VAPT campaigns, findings, compliance, reports, or SOC queue?",
    followUps: SUGGESTIONS,
  };
}

export default function Agent() {
  const { toast, operate, requireDualControl } = useStore();
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"chat" | "skills">("chat");
  const [mode, setMode] = useState<"agent" | "agi">("agent");

  useEffect(() => {
    let cancelled = false;
    loadAiStatus().then((s) => { if (!cancelled) setStatus(s); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-[900px]">
        <div className="skeleton mb-6 h-8 w-64 rounded" />
        <div className="skeleton h-96 rounded-2xl" />
      </div>
    );
  }

  if (status && !status.agent_enabled) {
    return (
      <div className="mx-auto max-w-[640px]">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-phantix-800/70 text-gold-400"><Bot size={30} /></span>
            <h2 className="mt-5 font-display text-2xl font-bold text-white">Phantix Agent is disabled</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
              Your organization has turned off the Phantix Agent. Ask an administrator to enable it from the
              Platform's AI settings to start chatting with your security data.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <a href={PLATFORM_AI_URL} className="btn-primary"><Sparkles size={15} /> Enable on Platform</a>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-500">
              <span className="chip border-phantix-600/50 bg-phantix-800/60"><Lock size={10} className="mr-1 inline" /> Admin-gated</span>
              <span className="chip border-phantix-600/50 bg-phantix-800/60"><ShieldCheck size={10} className="mr-1 inline" /> Never scores risk</span>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  const streamEnabled = status?.agent?.stream?.enabled ?? true;

  return (
    <div className="mx-auto max-w-[900px]">
      <PageHeader
        title="Phantix Agent"
        description="Chief Security Agent routes to specialists (SOC, GRC, VAPT, Threat Intel, Asset). AI orchestrates; engines execute — AI never discovers a vulnerability without a finding ID."
        actions={
          <span className="flex items-center gap-2">
            <span className="chip border-phantix-600/50 bg-phantix-800/60 font-mono text-slate-300"><Cpu size={11} className="mr-1 inline" /> {status?.agent?.model ?? MODEL_BADGE}</span>
            <span className="chip border-emerald-400/30 bg-emerald-400/10 text-emerald-300"><Sparkles size={11} className="mr-1 inline" /> {streamEnabled ? "Live stream" : "Enabled"}</span>
          </span>
        }
      />

      {/* Mode switch — Phantix Agent vs Autonomous Pentest Agent */}
      <div className="mb-4 flex items-center gap-1.5 rounded-xl border border-phantix-700/40 bg-phantix-900/40 p-1">
        <button
          onClick={() => setMode("agent")}
          className={cx("flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors", mode === "agent" ? "bg-phantix-800/70 text-white" : "text-slate-400 hover:text-slate-200")}
        >
          <Bot size={15} /> Phantix Agent
        </button>
        <button
          onClick={() => setMode("agi")}
          className={cx("flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors", mode === "agi" ? "bg-gradient-to-r from-gold-400/20 to-gold-600/20 text-gold-200 ring-1 ring-gold-400/30" : "text-slate-400 hover:text-slate-200")}
        >
          <Radar size={15} /> Autonomous Pentest Agent
        </button>
      </div>

      {mode === "agi" ? (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="!p-0 overflow-hidden">
            <div className="h-[72vh]">
              <AgiWorkspace variant="page" />
            </div>
          </Card>
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck size={11} className="text-gold-400" /> Human-gated, scoped, container-isolated. Read-only steps stream live; state-changing steps pause for your approval. Sessions destroy their containers when stopped.
          </p>
        </motion.div>
      ) : (
        <div className="mb-4 flex items-center gap-1.5 rounded-xl border border-phantix-700/40 bg-phantix-900/40 p-1">
          <button
            onClick={() => setTab("chat")}
            className={cx("flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors", tab === "chat" ? "bg-phantix-800/70 text-white" : "text-slate-400 hover:text-slate-200")}
          >
            <Bot size={15} /> Chat & investigations
          </button>
          <button
            onClick={() => setTab("skills")}
            className={cx("flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors", tab === "skills" ? "bg-phantix-800/70 text-white" : "text-slate-400 hover:text-slate-200")}
          >
            <BrainCircuit size={15} /> Skill library
          </button>
        </div>
      )}

      {mode === "agent" && (tab === "chat" ? <AgentChat streamEnabled={streamEnabled} operate={operate} requireDualControl={requireDualControl} toast={toast} /> : <SkillsLibrary toast={toast} />)}
    </div>
  );
}

// ── Agent chat + investigation (SSE streaming per PHANTIX_AGENT_SSE_FE.md) ─────
function AgentChat({
  streamEnabled,
  operate,
  requireDualControl,
  toast,
}: {
  streamEnabled: boolean;
  operate: { unlocked: boolean };
  requireDualControl: (reason?: string) => Promise<boolean>;
  toast: (kind: "success" | "error" | "info" | "warning", title: string, body?: string) => void;
}) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<"idle" | "connecting" | "streaming" | "synthesizing">("idle");
  const [liveAnswer, setLiveAnswer] = useState("");
  const [liveThinking, setLiveThinking] = useState("");
  const [liveRunId, setLiveRunId] = useState("");
  const [tools, setTools] = useState<{ tool: string; ok: boolean }[]>([]);
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, liveAnswer, busy]);

  const resetLive = () => {
    setLiveAnswer("");
    setLiveThinking("");
    setLiveRunId("");
    setTools([]);
    setThinkingOpen(false);
  };

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || busy) return;
    // Phantix Agent operates on org data — require an unlocked dual-control session.
    if (!(await requireDualControl("Using the Phantix Agent requires a dual-control operate session."))) return;

    // Clarify first: quick prompts / vague asks are answered locally so the user
    // pins down a specific request before any backend (LLM) call happens.
    const clarified = clarifyRequest(msg);
    if (!clarified.clear) {
      setMessages((m) => [...m, { role: "user", text: msg }, { role: "agent", text: clarified.reply }]);
      setInput("");
      setFollowUps(clarified.followUps);
      return;
    }
    setFollowUps([]);
    setMessages((m) => [...m, { role: "user", text: msg }]);
    setInput("");
    setBusy(true);
    setPhase("connecting");
    resetLive();
    const controller = new AbortController();
    abortRef.current = controller;
    let answer = "";
    let thinking = "";
    try {
      await streamAgentChat(
        { messages: [{ role: "user", content: msg }], thinking: true, reasoning_effort: "high", domain: "cross" },
        (event, data) => {
          if (event === "connected") setPhase("streaming");
          else if (event === "meta") setPhase("streaming");
          else if (event === "reasoning") { thinking += data?.content ?? ""; setLiveThinking(thinking); setThinkingOpen(true); }
          else if (event === "delta") { answer += data?.content ?? ""; setLiveAnswer(answer); }
          else if (event === "done") {
            const m = { role: "agent" as const, text: answer || "No response from agent.", thinking: thinking || undefined };
            setMessages((prev) => [...prev, m]);
            resetLive();
          } else if (event === "error") {
            throw new Error(data?.error ?? "Agent stream error");
          }
        },
        controller.signal,
      );
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") {
        toast("error", "Agent unavailable", e instanceof Error ? e.message : "");
        setMessages((m) => [...m, { role: "agent", text: "I couldn't process that request. Please try again." }]);
      }
    } finally {
      setBusy(false);
      setPhase("idle");
      abortRef.current = null;
    }
  };

  const stop = () => {
    abortRef.current?.abort();
    setBusy(false);
    setPhase("idle");
  };

  const invokeDomain = async (domain: string) => {
    if (!(await requireDualControl("Running a specialist investigation requires a dual-control operate session."))) return;
    const objective = `Investigate ${domain} for this organization`;
    setMessages((m) => [...m, { role: "user", text: `Run ${domain} specialist: ${objective}` }]);
    setBusy(true);
    setPhase("connecting");
    resetLive();
    const controller = new AbortController();
    abortRef.current = controller;
    let summary = "";
    try {
      await streamAgentRun(
        { domain, objective },
        (event, data) => {
          if (event === "connected") setPhase("connecting");
          else if (event === "run_started") { setLiveRunId(String(data?.analysis_id ?? "")); }
          else if (event === "tool") { setTools((t) => [...t, { tool: String(data?.tool ?? "tool"), ok: Boolean(data?.ok) }]); }
          else if (event === "synthesis_start") setPhase("synthesizing");
          else if (event === "reasoning") { summary += data?.content ?? ""; setLiveThinking(summary); setThinkingOpen(true); }
          else if (event === "delta") { summary += data?.content ?? ""; setLiveAnswer(summary); }
          else if (event === "run_completed") {
            const skills = Array.isArray(data?.skills) ? data.skills.map(String) : undefined;
            setMessages((prev) => [...prev, { role: "agent", text: (data?.summary ?? summary) || `${domain} analysis complete.`, runId: liveRunId || undefined, skills }]);
            resetLive();
          } else if (event === "error") {
            throw new Error(data?.error ?? "Run stream error");
          }
        },
        controller.signal,
      );
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") {
        toast("error", "Agent run failed", e instanceof Error ? e.message : "");
      }
    } finally {
      setBusy(false);
      setPhase("idle");
      abortRef.current = null;
    }
  };

  const streaming = busy && (phase === "streaming" || phase === "synthesizing");

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="flex h-[66vh] flex-col !p-0 overflow-hidden">
        <div className="flex items-center gap-3 border-b border-phantix-700/40 px-5 py-3.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 text-phantix-950"><Bot size={18} /></span>
          <div>
            <p className="font-display text-sm font-semibold text-white">Phantix Agent</p>
            <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
              Chief Agent · routes to specialists
              {streaming && <span className="flex items-center gap-1 text-gold-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold-400" /> live</span>}
            </p>
          </div>
          <span
            className={cx(
              "ml-auto flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-medium",
              operate.unlocked ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-severity-medium/30 bg-severity-medium/10 text-severity-medium",
            )}
          >
            <Lock size={10} /> {operate.unlocked ? "Operate unlocked" : "Dual-control required"}
          </span>
          <button onClick={() => { setMessages([]); }} className="text-slate-500 hover:text-slate-300" title="Clear conversation"><Trash2 size={15} /></button>
        </div>

        {/* Domain specialists */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-phantix-700/30 px-5 py-2">
          <span className="text-[10px] uppercase tracking-wider text-slate-600 mr-1">Specialists</span>
          {DOMAINS.map((d) => (
            <button
              key={d.id}
              onClick={() => invokeDomain(d.id)}
              disabled={busy}
              title={d.desc}
              className="flex items-center gap-1.5 rounded-lg border border-phantix-700/40 bg-phantix-950/50 px-2 py-1 text-[11px] text-slate-300 transition-colors hover:border-gold-400/40 hover:bg-phantix-800/50 disabled:opacity-50"
            >
              {d.icon} {d.label}
            </button>
          ))}
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {messages.length === 0 && !busy && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-phantix-800/70 text-gold-400"><Bot size={26} /></span>
              <p className="mt-4 max-w-sm text-sm text-slate-400">Ask me anything about your security posture, or spin up a specialist for deep analysis.</p>
              <div className="mt-6 grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="rounded-xl border border-phantix-700/40 bg-phantix-950/50 px-3 py-2.5 text-left text-xs text-slate-300 transition-colors hover:border-gold-400/40 hover:bg-phantix-800/50">{s}</button>
                ))}
              </div>
            </div>
          )}
          <AnimatePresence initial={false}>
            {messages.map((m, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cx("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cx("max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-6", m.role === "user" ? "bg-gold-400/15 text-gold-100 border border-gold-400/20" : "bg-phantix-800/60 text-slate-200 border border-phantix-700/40")}>
                  {m.role === "agent" && m.thinking && (
                    <details className="mb-2">
                      <summary className="flex cursor-pointer items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300"><BrainCircuit size={11} /> Thinking</summary>
                      <p className="mt-1.5 whitespace-pre-wrap border-l-2 border-phantix-600/50 pl-3 text-[11px] leading-5 text-slate-500">{m.thinking}</p>
                    </details>
                  )}
                  {m.runId && <span className="mb-1 flex items-center gap-1.5 text-[10px] text-gold-400"><Timer size={10} /> run {m.runId}</span>}
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  {m.role === "agent" && m.skills && m.skills.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-slate-500">Skills:</span>
                      {m.skills.map((s) => (
                        <span key={s} className="chip border-gold-400/20 bg-gold-400/5 font-mono text-[10px] text-gold-300">{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Follow-up suggestions from the clarification assistant */}
          {!busy && followUps.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {followUps.map((s) => (
                <button
                  key={s}
                  onClick={() => void send(s)}
                  className="rounded-xl border border-gold-400/30 bg-gold-400/5 px-3 py-2 text-left text-xs text-gold-200 transition-colors hover:border-gold-400/60 hover:bg-gold-400/10"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Live streaming panel */}
          {busy && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
              <div className="max-w-[82%] rounded-2xl border border-phantix-700/40 bg-phantix-800/60 px-4 py-3 text-sm leading-6 text-slate-200">
                {phase === "connecting" && <span className="flex items-center gap-2 text-slate-400"><Loader2 size={14} className="animate-spin" /> Connecting to stream...</span>}
                {phase === "synthesizing" && tools.length === 0 && <span className="flex items-center gap-2 text-slate-400"><Loader2 size={14} className="animate-spin" /> Synthesizing...</span>}
                {tools.length > 0 && (
                  <div className="mb-2 flex flex-wrap items-center gap-1.5">
                    {tools.map((t, idx) => (
                      <span key={idx} className={cx("chip text-[10px]", t.ok ? "border-emerald-400/20 bg-emerald-400/5 text-emerald-300" : "border-severity-critical/30 bg-severity-critical/10 text-severity-critical")}>
                        {t.ok ? "✓" : "✕"} {t.tool}
                      </span>
                    ))}
                  </div>
                )}
                {liveRunId && <span className="mb-1 flex items-center gap-1.5 text-[10px] text-gold-400"><Timer size={10} /> run {liveRunId}</span>}
                {liveThinking && (
                  <details className="mb-2" open>
                    <summary className="flex cursor-pointer items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300"><BrainCircuit size={11} /> Thinking</summary>
                    <p className="mt-1.5 whitespace-pre-wrap border-l-2 border-phantix-600/50 pl-3 text-[11px] leading-5 text-slate-500">{liveThinking}</p>
                  </details>
                )}
                {liveAnswer && (
                  <>
                    <p className="whitespace-pre-wrap">{liveAnswer}<span className="ml-0.5 inline-block h-4 w-[7px] animate-pulse rounded-sm bg-gold-400/70 align-middle" /></p>
                  </>
                )}
                {!liveAnswer && phase === "streaming" && <span className="flex items-center gap-2 text-slate-400"><Loader2 size={14} className="animate-spin" /> Streaming...</span>}
              </div>
            </motion.div>
          )}
          <div ref={endRef} />
        </div>

        <div className="border-t border-phantix-700/40 p-3.5">
          <div className="flex items-center gap-2.5 rounded-xl border border-phantix-700/50 bg-phantix-950/60 px-3.5 py-2.5 focus-within:border-gold-400/40">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !busy) void send(); }}
              placeholder="Ask about your assets, findings, risks, or reports..."
              className="flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500"
            />
            {busy ? (
              <button onClick={stop} className="btn-secondary !px-3.5 !py-2 !text-xs" aria-label="Stop stream"><Square size={13} className="mr-1 inline" /> Stop</button>
            ) : (
              <button onClick={() => void send()} disabled={!input.trim()} className="btn-primary !px-3.5 !py-2 !text-xs" aria-label="Send"><Send size={14} /></button>
            )}
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-600"><ShieldCheck size={10} /> PII redacted before provider calls · skills governed (candidate/active/quarantined) · every interaction audited · agent never changes findings or risk scores</p>
        </div>
      </Card>
    </motion.div>
  );
}

// ── Skill library (PHANTIX_AGENT_FE.md A4/A5) ─────────────────────────────────
function SkillsLibrary({ toast }: { toast: (kind: "success" | "error" | "info" | "warning", title: string, body?: string) => void }) {
  const { requireDualControl } = useStore();
  const [skills, setSkills] = useState<AgentSkill[]>([]);
  const [filter, setFilter] = useState<"all" | "active" | "candidate" | "quarantined">("all");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    loadAgentSkills().then(setSkills).finally(() => setLoading(false));
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const act = async (skill: AgentSkill, status: "active" | "quarantined" | "retired") => {
    if (!(await requireDualControl("Changing a skill's governance state requires a dual-control operate session."))) return;
    setBusyId(skill.id);
    try {
      await setAgentSkillStatus(skill.id, skill.version, status);
      setSkills((prev) => prev.map((s) => (s.id === skill.id ? { ...s, status } : s)));
      toast("success", status === "active" ? "Skill promoted" : status === "quarantined" ? "Skill quarantined" : "Skill retired", skill.name);
    } catch (e) {
      toast("error", "Skill update failed", e instanceof Error ? e.message : "");
    } finally {
      setBusyId(null);
    }
  };

  const filtered = filter === "all" ? skills : skills.filter((s) => s.status === filter);
  const counts = {
    active: skills.filter((s) => s.status === "active").length,
    candidate: skills.filter((s) => s.status === "candidate").length,
    quarantined: skills.filter((s) => s.status === "quarantined").length,
  };

  const statusChip = (s: AgentSkill["status"]) =>
    s === "active" ? <span className="chip border-emerald-400/30 bg-emerald-400/10 text-emerald-300">Active</span>
      : s === "candidate" ? <span className="chip border-gold-400/30 bg-gold-400/10 text-gold-300">Candidate</span>
        : s === "quarantined" ? <span className="chip border-severity-critical/30 bg-severity-critical/10 text-severity-critical">Quarantined</span>
          : <span className="chip border-phantix-600/40 bg-phantix-800/50 text-slate-400">Retired</span>;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="!p-0 overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-phantix-700/40 px-5 py-3.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-phantix-800/70 text-gold-400"><BrainCircuit size={18} /></span>
          <div className="mr-auto">
            <p className="font-display text-sm font-semibold text-white">Skill library</p>
            <p className="text-[11px] text-slate-500">Skills mint only after anonymization + review. Auto-promote happens only in lab.</p>
          </div>
          <div className="flex items-center gap-1.5">
            {(["all", "active", "candidate", "quarantined"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cx("rounded-lg px-2.5 py-1.5 text-[11px] transition-colors", filter === f ? "bg-phantix-800/80 text-white" : "text-slate-500 hover:text-slate-300")}
              >
                {f === "all" ? `All (${skills.length})` : `${f} (${counts[f as Exclude<typeof f, "all">]})`}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-[56vh] space-y-2.5 overflow-y-auto p-5">
          {loading && <div className="skeleton h-24 rounded-xl" />}
          {!loading && filtered.length === 0 && (
            <p className="py-10 text-center text-sm text-slate-500">No skills in this bucket.</p>
          )}
          {filtered.map((s) => (
            <motion.div key={s.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3 rounded-xl border border-phantix-700/40 bg-phantix-900/40 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[13px] font-semibold text-white">{s.name}</span>
                  <span className="chip border-phantix-600/40 bg-phantix-800/50 font-mono text-[10px] text-slate-400">v{s.version}</span>
                  {statusChip(s.status)}
                  {s.domain && <span className="chip border-phantix-600/40 bg-phantix-800/50 text-[10px] text-slate-400">{s.domain}</span>}
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-400">{s.description}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1"><ThumbsUp size={11} className="text-gold-400" /> Score {(s.score * 100).toFixed(0)}%</span>
                  <span className="flex items-center gap-1"><Timer size={11} /> {s.uses} uses</span>
                  {s.last_used_at && <span className="text-slate-600">Last used {new Date(s.last_used_at).toLocaleDateString()}</span>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {s.status !== "active" && (
                  <button onClick={() => void act(s, "active")} disabled={busyId === s.id} className="btn-secondary !py-1.5 !text-[11px]"><ThumbsUp size={12} /> Promote</button>
                )}
                {s.status !== "quarantined" && (
                  <button onClick={() => void act(s, "quarantined")} disabled={busyId === s.id} className="btn-ghost !py-1.5 !text-[11px] text-severity-medium hover:text-severity-medium"><AlertTriangle size={12} /> Quarantine</button>
                )}
                {s.status !== "retired" && (
                  <button onClick={() => void act(s, "retired")} disabled={busyId === s.id} title="Retire" className="rounded-lg border border-phantix-700/40 p-2 text-slate-500 hover:border-severity-critical/40 hover:text-severity-critical"><RotateCcw size={12} /></button>
                )}
                {busyId === s.id && <Loader2 size={13} className="animate-spin text-slate-500" />}
              </div>
            </motion.div>
          ))}
        </div>

        <div className="border-t border-phantix-700/40 px-5 py-3">
          <p className="flex items-center gap-1.5 text-[10px] text-slate-600">
            <ShieldCheck size={10} /> Skills are only promoted to active after human review. Candidate skills run in shadow mode; quarantined skills never execute. Governance is immutable and audited.
          </p>
        </div>
      </Card>
    </motion.div>
  );
}
