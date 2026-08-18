import React, { useMemo } from "react";

// Minimal, safe markdown renderer (trusted static / short content).
// Handles: ATX headings, fenced code (incl. architecture diagrams), inline code,
// **bold**, ordered/unordered lists, tables, blockquotes, hr, paragraphs.

type Block =
  | { kind: "h"; level: number; text: string }
  | { kind: "p"; text: string }
  | { kind: "code"; text: string; lang?: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "table"; head: string[]; rows: string[][] }
  | { kind: "quote"; text: string }
  | { kind: "hr" };

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(text: string): string {
  // Escape first, then re-introduce safe tags from markdown markers
  let t = esc(text);
  t = t.replace(/`([^`]+)`/g, '<code class="rounded bg-phantix-950/80 px-1 py-0.5 font-mono text-[11px] text-gold-200/90">$1</code>');
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong class=\"font-semibold text-slate-100\">$1</strong>");
  t = t.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noreferrer" class="text-gold-300 underline decoration-gold-400/40 hover:text-gold-200 break-all">$1</a>',
  );
  return t;
}

function parseBlock(src: string): Block[] {
  const lines = src.split(/\r?\n/);
  const blocks: Block[] = [];
  let codeBuf: string[] = [];
  let inCode = false;
  let codeLang = "";
  let listBuf: string[] = [];
  let listOrdered = false;
  let tableHead: string[] | null = null;
  let tableRows: string[][] = [];
  let quoteBuf: string[] = [];

  const flushList = () => {
    if (!listBuf.length) return;
    blocks.push({ kind: listOrdered ? "ol" : "ul", items: [...listBuf] });
    listBuf = [];
  };
  const flushQuote = () => {
    if (!quoteBuf.length) return;
    blocks.push({ kind: "quote", text: inline(quoteBuf.join(" ")) });
    quoteBuf = [];
  };
  const flushTable = () => {
    if (!tableHead) return;
    blocks.push({ kind: "table", head: tableHead, rows: tableRows });
    tableHead = null;
    tableRows = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trimEnd();
    const trimmed = line.trim();

    // Fenced code (architecture diagrams, snippets)
    const fence = trimmed.match(/^```(\w*)\s*$/);
    if (fence) {
      if (inCode) {
        blocks.push({ kind: "code", text: codeBuf.join("\n"), lang: codeLang || undefined });
        codeBuf = [];
        inCode = false;
        codeLang = "";
      } else {
        flushList();
        flushQuote();
        flushTable();
        inCode = true;
        codeLang = fence[1] || "";
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(raw);
      continue;
    }

    if (!trimmed) {
      flushList();
      flushQuote();
      flushTable();
      continue;
    }

    // Table row
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      flushList();
      flushQuote();
      const cells = trimmed.slice(1, -1).split("|").map((c) => c.trim());
      if (tableHead && cells.every((c) => /^:?-{3,}:?$/.test(c) || /^[-: ]+$/.test(c))) continue;
      if (!tableHead) tableHead = cells;
      else tableRows.push(cells);
      continue;
    }

    // ATX heading: # … ###### (require space after hashes)
    const h = trimmed.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (h) {
      flushList();
      flushQuote();
      flushTable();
      blocks.push({ kind: "h", level: h[1].length, text: inline(h[2]) });
      continue;
    }

    // HR
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushList();
      flushQuote();
      flushTable();
      blocks.push({ kind: "hr" });
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(trimmed)) {
      flushList();
      flushTable();
      quoteBuf.push(trimmed.replace(/^>\s?/, ""));
      continue;
    }
    flushQuote();

    // Unordered list
    if (/^\s*[-*+]\s+/.test(raw)) {
      if (listBuf.length && listOrdered) flushList();
      listOrdered = false;
      listBuf.push(inline(raw.replace(/^\s*[-*+]\s+/, "")));
      continue;
    }

    // Ordered list
    if (/^\s*\d+[.)]\s+/.test(raw)) {
      if (listBuf.length && !listOrdered) flushList();
      listOrdered = true;
      listBuf.push(inline(raw.replace(/^\s*\d+[.)]\s+/, "")));
      continue;
    }

    flushList();
    flushTable();
    blocks.push({ kind: "p", text: inline(trimmed) });
  }
  if (inCode) blocks.push({ kind: "code", text: codeBuf.join("\n"), lang: codeLang || undefined });
  flushList();
  flushQuote();
  flushTable();
  return blocks;
}

const cls = {
  h1: "mt-6 mb-2 font-display text-xl font-bold text-white first:mt-0 break-words",
  h2: "mt-6 mb-2 font-display text-lg font-bold text-white break-words",
  h3: "mt-5 mb-2 font-display text-base font-semibold text-gold-200 break-words",
  h4: "mt-4 mb-1.5 text-sm font-semibold text-slate-100 break-words",
  h5: "mt-3 mb-1 text-sm font-semibold text-slate-200 break-words",
  h6: "mt-3 mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400 break-words",
  p: "mt-2 text-[13px] leading-6 text-slate-300 break-words",
  code: "mt-2 overflow-x-auto rounded-xl bg-phantix-950/80 border border-phantix-700/40 p-3 font-mono text-[11px] leading-[1.45] text-slate-300 whitespace-pre",
  ul: "mt-2 list-disc space-y-1 pl-5 text-[13px] leading-6 text-slate-300",
  ol: "mt-2 list-decimal space-y-1 pl-5 text-[13px] leading-6 text-slate-300",
  quote: "mt-2 border-l-2 border-gold-400/40 pl-3 text-[13px] italic leading-6 text-slate-400 break-words",
};

export default function MarkdownView({ source }: { source: string }) {
  const blocks = useMemo(() => parseBlock(source || ""), [source]);
  return (
    <div className="min-w-0 max-w-full space-y-1 break-words">
      {blocks.map((b, idx) => {
        if (b.kind === "h") {
          const level = Math.min(b.level, 6);
          const Tag = `h${level}` as keyof JSX.IntrinsicElements;
          return <Tag key={idx} className={cls[`h${level}` as keyof typeof cls]} dangerouslySetInnerHTML={{ __html: b.text }} />;
        }
        if (b.kind === "p") return <p key={idx} className={cls.p} dangerouslySetInnerHTML={{ __html: b.text }} />;
        if (b.kind === "code") return <pre key={idx} className={cls.code}>{b.text}</pre>;
        if (b.kind === "ul" || b.kind === "ol") {
          const Tag = b.kind;
          return (
            <Tag key={idx} className={b.kind === "ul" ? cls.ul : cls.ol}>
              {b.items.map((it, j) => (
                <li key={j} className="break-words" dangerouslySetInnerHTML={{ __html: it }} />
              ))}
            </Tag>
          );
        }
        if (b.kind === "table") {
          return (
            <div key={idx} className="mt-2 max-w-full overflow-x-auto rounded-xl border border-phantix-700/40">
              <table className="w-full min-w-[420px] text-left text-[12px]">
                <thead className="border-b border-phantix-700/40 bg-phantix-900/60">
                  <tr>
                    {b.head.map((c, j) => (
                      <th key={j} className="px-3 py-2 font-semibold text-slate-200 break-words" dangerouslySetInnerHTML={{ __html: inline(c) }} />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {b.rows.map((r, j) => (
                    <tr key={j} className="border-b border-phantix-700/30 last:border-0">
                      {r.map((c, k) => (
                        <td key={k} className="px-3 py-2 align-top text-slate-400 break-words" dangerouslySetInnerHTML={{ __html: inline(c) }} />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (b.kind === "quote") return <blockquote key={idx} className={cls.quote} dangerouslySetInnerHTML={{ __html: b.text }} />;
        if (b.kind === "hr") return <hr key={idx} className="my-3 border-phantix-700/40" />;
        return null;
      })}
    </div>
  );
}
