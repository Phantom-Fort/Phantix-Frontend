import { Bot, BrainCircuit, Radar, User } from "lucide-react";
import { memo } from "react";
import { Message, MessageContent } from "@/components/prompt-kit/message";
import { Tool, type ToolPart } from "@/components/prompt-kit/tool";
import { ThinkingBar } from "@/components/prompt-kit/thinking-bar";
import { Reasoning, ReasoningTrigger, ReasoningContent } from "@/components/prompt-kit/reasoning";
import { TurnBriefCard } from "@/components/AgiStream";
import { normalizeAgiMarkdown } from "@/lib/agiMarkdown";
import { cn } from "@/lib/utils";
import { personaForChunk } from "@/lib/agiGraph";
import type { AgiTranscriptChunk } from "@/lib/types";

// ── Prompt-Kit stream adapter ────────────────────────────────────────────────
// Maps an AgiTranscriptChunk (operator / assistant / system / tool) onto the
// prompt-kit chat primitives (Message, MessageContent + Markdown, Tool,
// ThinkingBar) so the AGI workspace renders with the same high-quality streaming
// components the rest of the chat UI uses, instead of bespoke bubbles.
// Memoized so appending a new chunk does not re-render every prior bubble.

const PERSONA_LABEL: Record<string, string> = {
  orchestrator: "Phantix Autonomous Agent",
  recon: "Recon",
  exploit: "Exploit",
};

function toToolPart(t: AgiTranscriptChunk): ToolPart {
  return {
    type: typeof t.meta?.tool === "string" ? (t.meta.tool as string) : "tool",
    state: "output-available",
    output: { stdout: t.content },
    toolCallId:
      typeof t.meta?.tool_call_id === "string"
        ? (t.meta.tool_call_id as string)
        : undefined,
  };
}

function Avatar({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "gold" }) {
  return (
    <span
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
        tone === "gold"
          ? "border-gold-400/25 bg-gradient-to-br from-gold-400/15 to-transparent text-gold-400"
          : "border-border bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

export const PromptKitStream = memo(function PromptKitStream({ t, last = false }: { t: AgiTranscriptChunk; last?: boolean }) {
  if (t.role === "tool") {
    return <Tool toolPart={toToolPart(t)} defaultOpen={false} />;
  }

  if (t.role === "system") {
    return (
      <Message className="max-w-full">
        <Avatar>
          <Radar size={13} />
        </Avatar>
        <MessageContent className="bg-transparent px-0 py-0 font-mono text-xs text-muted-foreground">
          <span className="whitespace-pre-wrap break-words">{t.content}</span>
        </MessageContent>
      </Message>
    );
  }

  if (t.role === "operator") {
    return (
      <Message className="max-w-full flex-row-reverse">
        <Avatar>
          <User size={13} />
        </Avatar>
        <MessageContent className="bg-secondary text-foreground">
          <span className="whitespace-pre-wrap break-words">{t.content}</span>
        </MessageContent>
      </Message>
    );
  }

  const persona = personaForChunk(t);
  const kind = String(t.meta?.kind ?? "").toLowerCase();

  // Loop-progress turn briefs render as a compact status card, not a raw
  // markdown wall ("Turn X of 100. Loop phase: recon…").
  if (/Turn\s+\d+\s+of\s+\d+/i.test(t.content) && /(Loop phase|Job status|Working on|What happened)/i.test(t.content)) {
    return <TurnBriefCard content={t.content} dense />;
  }

  // Turn-start rows are a live banner, not a message.
  if (kind === "turn_start") {
    const working = String(t.meta?.working_on ?? "").replace(/^Working on:\s*/i, "").trim() || t.content.trim();
    return (
      <div className="flex items-center gap-2 py-0.5 pl-10">
        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-gold-400/25 bg-gold-400/10 text-gold-300">
          <Radar size={9} />
        </span>
        <p className="min-w-0 flex-1 truncate text-[11px] font-medium text-slate-400">{working}</p>
      </div>
    );
  }

  // Model reasoning — collapsible, muted garnish.
  if (kind === "reasoning") {
    return (
      <div className="max-w-full pl-10">
        <Reasoning className="rounded-xl border border-phantix-700/30 bg-phantix-950/50 px-3 py-2">
          <ReasoningTrigger className="text-[11px] font-medium text-slate-400 transition-colors hover:text-slate-200">
            <span className="flex items-center gap-1.5">
              <BrainCircuit size={11} className="text-gold-400/80" /> Thought process
            </span>
          </ReasoningTrigger>
          <ReasoningContent
            markdown
            className="mt-2 text-[11px]"
            contentClassName="prose-chat text-slate-500"
          >
            {normalizeAgiMarkdown(t.content)}
          </ReasoningContent>
        </Reasoning>
      </div>
    );
  }

  return (
    <Message className="max-w-full">
      <Avatar tone="gold">
        <Bot size={13} />
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {PERSONA_LABEL[persona] ?? "Agent"}
        </p>
        <MessageContent markdown className="bg-secondary text-foreground">
          {normalizeAgiMarkdown(t.content)}
        </MessageContent>
        {last && <ThinkingBar className="mt-2" />}
      </div>
    </Message>
  );
});

PromptKitStream.displayName = "PromptKitStream";

export default PromptKitStream;