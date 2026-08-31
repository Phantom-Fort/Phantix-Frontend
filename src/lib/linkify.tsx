import React from "react";

// ── Minimal linkifier ────────────────────────────────────────────────────────
// Turns bare http(s) URLs inside tool output / assistant text into clickable
// links without touching surrounding whitespace or markdown.

const URL_RE = /(https?:\/\/[^\s<>"')\]]+)/g;

export function linkify(text: string, className?: string): React.ReactNode[] {
  const cls =
    className ??
    "text-gold-300 underline decoration-gold-400/40 underline-offset-2 break-all hover:text-gold-200";
  return (text ?? "").split(URL_RE).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noreferrer" className={cls}>
        {part}
      </a>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    ),
  );
}
