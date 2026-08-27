import { Bot, Radar, User } from "lucide-react";
import { Message, MessageContent } from "@/components/prompt-kit/message";
import { Tool, type ToolPart } from "@/components/prompt-kit/tool";
import { ThinkingBar } from "@/components/prompt-kit/thinking-bar";
import { cn } from "@/lib/utils";
import { personaForChunk } from "@/lib/agiGraph";
import type { AgiTranscriptChunk } from "@/lib/types";

// ── Prompt-Kit stream adapter ────────────────────────────────────────────────
// Maps an AgiTranscriptChunk (operator / assistant / system / tool) onto the
// prompt-kit chat primitives (Message, MessageContent + Markdown, Tool,
// ThinkingBar) so the AGI workspace renders with the same high-quality streaming
// components the rest of the chat UI uses, instead of bespoke bubbles.

const PERSONA_LABEL: Record<string, string> = {
  orchestrator: "Orchestrator",
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

export function PromptKitStream({ t, last = false }: { t: AgiTranscriptChunk; last?: boolean }) {
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
          {t.content}
        </MessageContent>
        {last && <ThinkingBar className="mt-2" />}
      </div>
    </Message>
  );
}

export default PromptKitStream;
