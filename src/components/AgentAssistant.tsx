import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Send, Square, Sparkles, X, Trash2, ArrowRight, ArrowDown, BrainCircuit } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { streamAgentChat } from "@/lib/data";
import { useStore } from "@/lib/store";
import { cx } from "@/lib/utils";
import LottiePlayer from "@/components/LottiePlayer";
import MarkdownView from "@/components/MarkdownView";
import chatbotData from "@/lib/animations/chatbot.json";
import flowData from "@/lib/animations/ai-flow.json";
import { tryNavigationAnswer, helpOverview } from "@/lib/navigationGuide";
import { useChatSend } from "@/lib/useChatSend";
import { useStickToBottom } from "@/lib/useStickToBottom";

type Msg = { role: "user" | "agent"; text: string; thinking?: string; nav?: { route: string; label: string; also?: { route: string; label: string }[] } };

const DEFAULT_GREETING =
  "Hi, I'm Phantix Agent — your security operations assistant. I can summarize your posture, surface highest-risk assets, list open critical risks, preview report findings, and explain risks or findings. I can also point you to any page in the app — just ask \u201cwhere do I find\u2026\u201d. What would you like to look into?";

const SUGGESTIONS = [
  "Summarize my current security posture",
  "Which of my assets are highest risk?",
  "How many critical risks are open right now?",
  "Where do I find my risk register?",
];

const WIDTH = 400;
const MAX_MSGS = 60;

function loadChat(email: string): Msg[] {
  try {
    const raw = localStorage.getItem(`phantix_agent_chat_${email}`);
    if (raw) {
      const parsed = JSON.parse(raw) as Msg[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* ignore */ }
  return [{ role: "agent", text: DEFAULT_GREETING }];
}

export default function AgentAssistant() {
  const { toast, requireDualControl, session } = useStore();
  const navigate = useNavigate();
  const emailKey = session?.userEmail ?? "guest";
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>(() => loadChat(emailKey));
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<"idle" | "connecting" | "streaming">("idle");
  const [liveAnswer, setLiveAnswer] = useState("");
  const [liveThinking, setLiveThinking] = useState("");
  const [connError, setConnError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const chatSend = useChatSend();
  const stick = useStickToBottom([messages, liveAnswer, busy]);
  const endRef = stick.endRef;
  const scrollRef = stick.scrollerRef;
  const showScrollBtn = stick.showJump;

  // Chat retention: keep the conversation so the user can always continue it.
  useEffect(() => {
    try {
      localStorage.setItem(`phantix_agent_chat_${emailKey}`, JSON.stringify(messages.slice(-MAX_MSGS)));
    } catch { /* quota */ }
  }, [messages, emailKey]);

  const onScroll = stick.onScroll;
  const scrollToBottom = stick.jump;

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  const resetLive = () => { setLiveAnswer(""); setLiveThinking(""); };

  const resetChat = () => {
    setMessages([{ role: "agent", text: DEFAULT_GREETING }]);
    resetLive();
    try { localStorage.removeItem(`phantix_agent_chat_${emailKey}`); } catch { /* ignore */ }
  };

  const send = (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg) return;
    setInput("");
    chatSend.requestSend(msg, (m) => dispatchSend(m));
  };

  const dispatchSend = async (msg: string) => {
    if (busy) abortRef.current?.abort();

    if (!msg.toLowerCase().startsWith("/")) {
      const nav = tryNavigationAnswer(msg);
      if (nav) {
        setMessages((m) => [...m, { role: "user", text: msg }, { role: "agent", text: nav.text, nav }]);
        setInput("");
        return;
      }
    }
    if (/^(help|hi|hello|hey|what can you do|help me|where is everything|how do i use this|get started)\b/i.test(msg) && /navigat|find|where|page|module|help|guide|use|do/i.test(msg)) {
      setMessages((m) => [...m, { role: "user", text: msg }, { role: "agent", text: helpOverview() }]);
      setInput("");
      return;
    }

    if (!(await requireDualControl("Using Phantix Agent requires a dual-control operate session."))) return;
    setConnError(null);
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
          else if (event === "reasoning") { thinking += data?.content ?? ""; setLiveThinking(thinking); }
          else if (event === "delta") { answer += data?.content ?? ""; setLiveAnswer(answer); }
          else if (event === "done") {
            setMessages((prev) => [...prev, { role: "agent", text: answer || "No response from agent.", thinking: thinking || undefined }]);
            resetLive();
          } else if (event === "error") {
            throw new Error(data?.error ?? "Agent stream error");
          }
        },
        controller.signal,
      );
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") {
        const planRequired = (e as any)?.status === 402 || (e as any)?.detail?.code === "ai_agent_plan_required";
        if (planRequired) {
          setMessages((m) => [...m, { role: "agent", text: "This reply requires the Phantix Agent, which is part of a paid plan. Upgrade on the Platform to keep chatting with your security data." }]);
        } else {
          const name = String((e as any)?.name ?? "");
          const message = String((e as any)?.message ?? "");
          if (name === "TimeoutError" || name === "AbortError" || /timeout|timed out/i.test(message)) {
            setConnError("Timed out — the agent server is unavailable. Check your connection and try again.");
          } else if (/failed to fetch|networkerror|network error|load failed|fetch/i.test(message)) {
            setConnError("Failed to fetch — could not reach the agent server. Check your connection and try again.");
          } else {
            setConnError(message || "Failed to reach the agent server.");
          }
          toast("error", "Agent unavailable", e instanceof Error ? e.message : "");
          setMessages((m) => [...m, { role: "agent", text: "I couldn't process that request. Please try again." }]);
        }
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

  const streaming = busy && phase === "streaming";

  return (
    <>
      {/* Floating launcher (bottom-right) */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-8 right-8 z-[75] flex h-40 w-40 items-center justify-center overflow-hidden bg-transparent text-phantix-950 transition-transform hover:scale-105"
        title="Phantix Agent assistant"
        aria-label="Toggle Phantix Agent assistant"
      >
        <LottiePlayer animationData={chatbotData} className="h-40 w-40" loop />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 340, damping: 30 }}
              className="fixed bottom-5 right-5 z-[85] flex flex-col overflow-hidden rounded-2xl border border-phantix-700/40 bg-phantix-950/95 shadow-card"
              style={{ width: WIDTH, maxWidth: "calc(100vw - 40px)", height: "min(72vh, 660px)" }}
            >
              {/* Header */}
              <div className="flex items-center gap-3 border-b border-phantix-700/40 bg-phantix-950/90 px-4 py-3">
                <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl"><LottiePlayer animationData={chatbotData} className="h-8 w-8" loop /></span>
                <div className="min-w-0">
                  <p className="font-display text-sm font-semibold text-white">Phantix Agent</p>
                  <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    Security operations assistant
                    {streaming && <span className="flex items-center gap-1 text-gold-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold-400" /> live</span>}
                  </p>
                </div>
                <div className="ml-auto flex items-center gap-1">
                  <button onClick={resetChat} className="rounded-lg p-1.5 text-slate-500 hover:bg-phantix-800/70 hover:text-slate-300" title="Reset conversation"><Trash2 size={14} /></button>
                  <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-slate-500 hover:bg-phantix-800/70 hover:text-slate-300" title="Close"><X size={15} /></button>
                </div>
              </div>

              {/* Messages */}
              <div className="relative min-h-0 flex-1">
                <div ref={scrollRef} onScroll={onScroll} className="h-full space-y-3 overflow-y-auto p-3.5">
                  {connError && (
                    <div className="flex items-center gap-2 rounded-xl border border-severity-critical/40 bg-severity-critical/10 px-3 py-2.5">
                      <X size={13} className="shrink-0 text-severity-critical" />
                      <p className="text-[11px] leading-4 text-red-300">{connError}</p>
                    </div>
                  )}
                  <AnimatePresence initial={false}>
                    {messages.map((m, i) => (
                      <motion.div key={`${i}-${m.role}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cx("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                        <div className={cx("max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-6", m.role === "user" ? "bg-gold-400/15 text-gold-100 border border-gold-400/20" : "bg-phantix-800/60 text-slate-200 border border-phantix-700/40")}>
                          {m.role === "agent" && m.thinking && (
                            <details className="mb-1.5">
                              <summary className="flex cursor-pointer items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300"><BrainCircuit size={11} /> Thinking</summary>
                              <div className="mt-1 border-l-2 border-phantix-600/50 pl-2.5 text-[11px] leading-5 text-slate-500">{m.thinking}</div>
                            </details>
                          )}
                          {m.role === "agent" ? <MarkdownView source={m.text} /> : <p className="whitespace-pre-wrap">{m.text}</p>}
                          {m.nav && (
                            <div className="mt-2 space-y-1">
                              <button
                                onClick={() => { navigate(m.nav!.route); setOpen(false); }}
                                className="flex w-full items-center gap-1.5 rounded-lg border border-gold-400/40 bg-gold-400/10 px-2.5 py-1.5 text-left text-[11px] font-semibold text-gold-200 transition-colors hover:bg-gold-400/20"
                              >
                                <ArrowRight size={12} /> Go to {m.nav.label}
                              </button>
                              {m.nav.also?.map((a) => (
                                <button
                                  key={a.route}
                                  onClick={() => { navigate(a.route); setOpen(false); }}
                                  className="flex w-full items-center gap-1.5 rounded-lg border border-phantix-700/40 bg-phantix-950/60 px-2.5 py-1.5 text-left text-[11px] text-slate-300 transition-colors hover:border-phantix-500/50"
                                >
                                  <ArrowRight size={12} /> {a.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {/* Live streaming bubble — steps transition gracefully like a chat box */}
                  {busy && (
                    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
                      <div className="max-w-[85%] min-w-[230px] rounded-2xl border border-phantix-700/40 bg-phantix-800/60 px-3.5 py-2.5 text-[13px] leading-6 text-slate-200">
                        <AnimatePresence mode="wait" initial={false}>
                          <motion.div
                            key={phase + (liveThinking ? "-t" : "")}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.2 }}
                            className="flex items-center gap-2 text-[11px] text-slate-400"
                          >
                            {phase === "connecting" && (<><LottiePlayer animationData={flowData} className="h-5 w-5" loop speed={1.2} /> Connecting to stream…</>)}
                            {phase === "streaming" && !liveThinking && !liveAnswer && (<><LottiePlayer animationData={flowData} className="h-5 w-5" loop speed={1.2} /> Analysing…</>)}
                            {liveThinking && (<><LottiePlayer animationData={flowData} className="h-5 w-5" loop speed={1.2} /> Thinking…</>)}
                            {liveAnswer && (<><LottiePlayer animationData={flowData} className="h-5 w-5" loop speed={1.2} /> Responding…</>)}
                          </motion.div>
                        </AnimatePresence>
                        {liveThinking && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="overflow-hidden">
                            <div className="mt-1.5 whitespace-pre-wrap border-l-2 border-phantix-600/50 pl-2.5 text-[11px] leading-5 text-slate-500">{liveThinking}</div>
                          </motion.div>
                        )}
                        {liveAnswer && <p className="mt-1.5 whitespace-pre-wrap">{liveAnswer}<span className="ml-0.5 inline-block h-3.5 w-[7px] animate-pulse rounded-sm bg-gold-400/70 align-middle" /></p>}
                      </div>
                    </motion.div>
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

              {/* Suggestions on empty conversation */}
              {messages.length === 1 && !busy && (
                <div className="grid grid-cols-1 gap-1.5 border-t border-phantix-700/40 px-3.5 py-2.5 sm:grid-cols-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => void send(s)} className="rounded-xl border border-phantix-700/40 bg-phantix-950/60 px-2.5 py-2 text-left text-[11px] leading-4 text-slate-300 transition-colors hover:border-gold-400/40 hover:bg-phantix-800/60">{s}</button>
                  ))}
                </div>
              )}

              {/* Composer */}
              <div className="border-t border-phantix-700/40 p-3">
                <div className="flex items-center gap-2 rounded-xl border border-phantix-700/50 bg-phantix-950/60 px-3 py-2 focus-within:border-gold-400/40">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter" || e.shiftKey || e.repeat) return;
                      e.preventDefault();
                      send();
                    }}
                    placeholder="Ask about assets, findings, risks, or reports..."
                    className="flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500"
                  />
                  {busy ? (
                    <button onClick={stop} className="btn-secondary !px-3 !py-1.5 !text-xs" aria-label="Stop stream"><Square size={12} className="mr-1 inline" /> Stop</button>
                  ) : (
                    <button onClick={() => void send()} disabled={!input.trim()} className="btn-primary !px-3 !py-1.5 !text-xs" aria-label="Send"><Send size={13} /></button>
                  )}
                </div>
                <p className="mt-1.5 flex items-center gap-1.5 text-[10px] text-slate-600">
                  <Sparkles size={10} />
                  {chatSend.hint === "queued"
                    ? "Queued — press Enter again to send now, or wait for the current reply."
                    : "PII redacted before provider calls · every interaction audited · agent never changes findings or risk scores"}
                </p>
              </div>
            </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
