import React, { useMemo } from "react";

// Minimal, safe markdown renderer for the AGI contributor guide.
// Handles: ATX/### headings, fenced ``` code, inline `code`, **bold**, lists,
// tables, blockquotes, horizontal rules, paragraphs. No raw HTML is emitted
// except the generated structure below (input is trusted static content).

type Block =
  | { kind: "h"; level: number; text: string }
  | { kind: "p"; text: string }
  | { kind: "code"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "table"; head: string[]; rows: string[][] }
  | { kind: "quote"; text: string }
  | { kind: "hr" };

function inline(text: string): string {
  return text
    .replace(/`([^`]+)`/g, "<code class=\"md-code\">$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer" class="text-gold-300 underline decoration-gold-400/40 hover:text-gold-200">$1</a>');
}

function parseBlock(src: string): Block[] {
  const lines = src.split(/\r?\n/);
  const blocks: Block[] = [];
  let i = 0;
  let codeBuf: string[] = [];
  let inCode = false;
  let listBuf: string[] = [];
  let tableHead: string[] | null = null;
  let tableRows: string[][] = [];

  const flushList = () => {
    if (listBuf.length) { blocks.push({ kind: "ul", items: [...listBuf] }); listBuf = []; }
  };

  for (; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();

    if (line.startsWith("```")) {
      if (inCode) {
        blocks.push({ kind: "code", text: codeBuf.join("\n") });
        codeBuf = [];
        inCode = false;
      } else {
        flushList();
        tableHead = null;
        inCode = true;
      }
      continue;
    }
    if (inCode) { codeBuf.push(raw); continue; }

    if (!line) {
      flushList();
      if (tableHead) { blocks.push({ kind: "table", head: tableHead, rows: tableRows }); tableHead = null; tableRows = []; }
      continue;
    }

    // Table row? "| a | b |"
    if (line.startsWith("|") && line.endsWith("|")) {
      const cells = line.slice(1, -1).split("|").map((c) => c.trim());
      if (tableHead && /^[-: ]+$/.test(cells.join(""))) { continue; } // separator
      if (!tableHead) { tableHead = cells; } else { tableRows.push(cells); }
      continue;
    }

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { flushList(); if (tableHead) { blocks.push({ kind: "table", head: tableHead, rows: tableRows }); tableHead = null; tableRows = []; } blocks.push({ kind: "h", level: h[1].length, text: inline(h[2]) }); continue; }

    if (/^---+$/.test(line)) { flushList(); blocks.push({ kind: "hr" }); continue; }

    if (/^>\s?/.test(line)) { flushList(); blocks.push({ kind: "quote", text: inline(line.replace(/^>\s?/, "")) }); continue; }

    if (/^\s*[-*]\s+/.test(raw)) { listBuf.push(inline(raw.replace(/^\s*[-*]\s+/, ""))); continue; }

    flushList();
    if (tableHead) { blocks.push({ kind: "table", head: tableHead, rows: tableRows }); tableHead = null; tableRows = []; }
    blocks.push({ kind: "p", text: inline(line) });
  }
  if (inCode) blocks.push({ kind: "code", text: codeBuf.join("\n") });
  flushList();
  if (tableHead) blocks.push({ kind: "table", head: tableHead, rows: tableRows });
  return blocks;
}

const cls = {
  h1: "mt-6 mb-2 font-display text-xl font-bold text-white first:mt-0",
  h2: "mt-6 mb-2 font-display text-lg font-bold text-white",
  h3: "mt-5 mb-2 font-display text-base font-semibold text-white",
  h4: "mt-4 mb-1.5 text-sm font-semibold text-gold-200",
  h5: "mt-3 mb-1 text-sm font-semibold text-slate-200",
  h6: "mt-3 mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400",
  p: "mt-2 text-[13px] leading-6 text-slate-300",
  code: "mt-2 overflow-x-auto rounded-xl bg-phantix-950/80 border border-phantix-700/40 p-3 font-mono text-[11px] leading-5 text-slate-300",
  ul: "mt-2 space-y-1 text-[13px] leading-6 text-slate-300",
  quote: "mt-2 border-l-2 border-gold-400/40 pl-3 text-[13px] italic leading-6 text-slate-400",
};

export default function MarkdownView({ source }: { source: string }) {
  const blocks = useMemo(() => parseBlock(source), [source]);
  return (
    <div className="space-y-1">
      {blocks.map((b, idx) => {
        if (b.kind === "h") {
          const Tag = `h${Math.min(b.level, 6)}` as keyof JSX.IntrinsicElements;
          return <Tag key={idx} className={cls[`h${Math.min(b.level, 6)}` as keyof typeof cls]} dangerouslySetInnerHTML={{ __html: b.text }} />;
        }
        if (b.kind === "p") return <p key={idx} className={cls.p} dangerouslySetInnerHTML={{ __html: b.text }} />;
        if (b.kind === "code") return <pre key={idx} className={cls.code}>{b.text}</pre>;
        if (b.kind === "ul") return (
          <ul key={idx} className={cls.ul}>
            {b.items.map((it, j) => <li key={j} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-400/70" /><span dangerouslySetInnerHTML={{ __html: it }} /></li>)}
          </ul>
        );
        if (b.kind === "table") return (
          <div key={idx} className="mt-2 overflow-x-auto rounded-xl border border-phantix-700/40">
            <table className="w-full text-left text-[12px]">
              <thead className="border-b border-phantix-700/40 bg-phantix-900/60">
                <tr>{b.head.map((c, j) => <th key={j} className="px-3 py-2 font-semibold text-slate-200">{c}</th>)}</tr>
              </thead>
              <tbody>
                {b.rows.map((r, j) => (
                  <tr key={j} className="border-b border-phantix-700/30 last:border-0">
                    {r.map((c, k) => <td key={k} className="px-3 py-2 text-slate-400" dangerouslySetInnerHTML={{ __html: inline(c) }} />)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        if (b.kind === "quote") return <blockquote key={idx} className={cls.quote} dangerouslySetInnerHTML={{ __html: b.text }} />;
        if (b.kind === "hr") return <hr key={idx} className="my-3 border-phantix-700/40" />;
        return null;
      })}
    </div>
  );
}
