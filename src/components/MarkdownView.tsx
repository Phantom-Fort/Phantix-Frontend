import React, { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { cx } from "@/lib/utils";
import MermaidDiagram from "@/components/MermaidDiagram";

// Minimal, safe markdown renderer (trusted static / short content).
// Handles: ATX headings, fenced code (with language + copy), inline code,
// **bold**, *italic*, ~~strike~~, links, ordered/unordered + NESTED lists,
// task lists (- [ ] / - [x]), tables, blockquotes, hr, paragraphs.
//
// Typography is em-relative throughout, so the whole rendered block scales with
// the font-size of its container (e.g. the fluid `.wb-*` chat bubble). This is
// what makes streamed agent output shrink/grow with its pane.

type ListNode = { html: string; ordered: boolean; checked: boolean | null; children: ListNode[] };

type Block =
  | { kind: "h"; level: number; text: string }
  | { kind: "p"; text: string }
  | { kind: "code"; text: string; lang?: string }
  | { kind: "mermaid"; text: string }
  | { kind: "list"; ordered: boolean; items: ListNode[] }
  | { kind: "table"; head: string[]; rows: string[][] }
  | { kind: "quote"; text: string }
  | { kind: "hr" };

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(text: string): string {
  // Escape first, then re-introduce safe tags from markdown markers.
  let t = esc(text);

  // Protect inline code spans with placeholders so bold/italic don't touch them.
  const codes: string[] = [];
  t = t.replace(/`([^`]+)`/g, (_m, c) => {
    codes.push(c);
    return `\u0000${codes.length - 1}\u0000`;
  });

  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-slate-100">$1</strong>');
  t = t.replace(/__([^_]+)__/g, '<strong class="font-semibold text-slate-100">$1</strong>');
  // Italic (single * or _) — safe after ** and __ are consumed.
  t = t.replace(/\*([^*\n]+)\*/g, '<em class="text-slate-200">$1</em>');
  t = t.replace(/\b_([^_\n]+)_\b/g, '<em class="text-slate-200">$1</em>');
  t = t.replace(/~~([^~]+)~~/g, '<del class="text-slate-500 line-through">$1</del>');
  t = t.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noreferrer" class="text-gold-300 underline decoration-gold-400/40 underline-offset-2 hover:text-gold-200 break-all">$1</a>',
  );

  // Restore inline code.
  t = t.replace(/\u0000(\d+)\u0000/g, (_m, i) =>
    `<code class="rounded border border-phantix-700/50 bg-phantix-950/80 px-1 py-0.5 font-mono text-[0.85em] text-gold-200/90">${codes[Number(i)]}</code>`,
  );
  return t;
}

// ── Lists ───────────────────────────────────────────────────────────────────

type FlatItem = { indent: number; ordered: boolean; checked: boolean | null; html: string };

const LIST_RE = /^(\s*)(?:([-*+])|(\d+)[.)])\s+(.*)$/;
const TASK_RE = /^\[( |x|X)\]\s+(.*)$/;

function parseListLine(raw: string): FlatItem | null {
  const m = raw.match(LIST_RE);
  if (!m) return null;
  const indent = (m[1] || "").replace(/\t/g, "    ").length;
  const ordered = m[3] != null;
  let content = m[4] ?? "";
  let checked: boolean | null = null;
  const task = content.match(TASK_RE);
  if (task) {
    checked = task[1].toLowerCase() === "x";
    content = task[2];
  }
  return { indent, ordered, checked, html: inline(content) };
}

function buildListTree(flat: FlatItem[]): ListNode[] {
  const root: ListNode[] = [];
  const stack: { node: ListNode; indent: number }[] = [];
  for (const f of flat) {
    const node: ListNode = { html: f.html, ordered: f.ordered, checked: f.checked, children: [] };
    while (stack.length && f.indent <= stack[stack.length - 1].indent) stack.pop();
    if (stack.length) stack[stack.length - 1].node.children.push(node);
    else root.push(node);
    stack.push({ node, indent: f.indent });
  }
  return root;
}

// ── Block parser ────────────────────────────────────────────────────────────

function parseBlock(src: string): Block[] {
  const lines = src.split(/\r?\n/);
  const blocks: Block[] = [];
  let codeBuf: string[] = [];
  let inCode = false;
  let codeLang = "";
  let listBuf: FlatItem[] = [];
  let tableHead: string[] | null = null;
  let tableRows: string[][] = [];
  let quoteBuf: string[] = [];

  const flushList = () => {
    if (!listBuf.length) return;
    const items = buildListTree(listBuf);
    blocks.push({ kind: "list", ordered: listBuf[0].ordered, items });
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

    // Fenced code
    const fence = trimmed.match(/^```(\w*)\s*$/);
    if (fence) {
      if (inCode) {
        const codeText = codeBuf.join("\n");
        blocks.push(
          codeLang.toLowerCase() === "mermaid"
            ? { kind: "mermaid", text: codeText }
            : { kind: "code", text: codeText, lang: codeLang || undefined },
        );
        codeBuf = [];
        inCode = false;
        codeLang = "";
      } else {
        flushList(); flushQuote(); flushTable();
        inCode = true;
        codeLang = fence[1] || "";
      }
      continue;
    }
    if (inCode) { codeBuf.push(raw); continue; }

    if (!trimmed) { flushList(); flushQuote(); flushTable(); continue; }

    // Table row
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      flushList(); flushQuote();
      const cells = trimmed.slice(1, -1).split("|").map((c) => c.trim());
      if (tableHead && cells.every((c) => /^:?-{3,}:?$/.test(c) || /^[-: ]+$/.test(c))) continue;
      if (!tableHead) tableHead = cells;
      else tableRows.push(cells);
      continue;
    }

    // ATX heading
    const h = trimmed.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (h) {
      flushList(); flushQuote(); flushTable();
      blocks.push({ kind: "h", level: h[1].length, text: inline(h[2]) });
      continue;
    }

    // HR
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushList(); flushQuote(); flushTable();
      blocks.push({ kind: "hr" });
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(trimmed)) {
      flushList(); flushTable();
      quoteBuf.push(trimmed.replace(/^>\s?/, ""));
      continue;
    }
    flushQuote();

    // List item (ordered / unordered / task / nested)
    const li = parseListLine(raw);
    if (li) { listBuf.push(li); continue; }

    flushList(); flushTable();
    blocks.push({ kind: "p", text: inline(trimmed) });
  }
  if (inCode) {
    const codeText = codeBuf.join("\n");
    blocks.push(
      codeLang.toLowerCase() === "mermaid"
        ? { kind: "mermaid", text: codeText }
        : { kind: "code", text: codeText, lang: codeLang || undefined },
    );
  }
  flushList(); flushQuote(); flushTable();
  return blocks;
}

// ── em-scaled class map (inherits container font-size) ─────────────────────

const cls = {
  h1: "mt-[0.9em] mb-[0.35em] font-display text-[1.4em] font-bold leading-tight text-white first:mt-0 break-words",
  h2: "mt-[0.9em] mb-[0.3em] font-display text-[1.22em] font-bold leading-tight text-white break-words",
  h3: "mt-[0.85em] mb-[0.28em] font-display text-[1.1em] font-semibold leading-snug text-gold-200 break-words",
  h4: "mt-[0.8em] mb-[0.25em] text-[1em] font-semibold text-slate-100 break-words",
  h5: "mt-[0.7em] mb-[0.2em] text-[0.95em] font-semibold text-slate-200 break-words",
  h6: "mt-[0.7em] mb-[0.2em] text-[0.82em] font-semibold uppercase tracking-wider text-slate-400 break-words",
  p: "mt-[0.5em] text-[1em] leading-[1.65] text-slate-300 break-words first:mt-0",
  quote: "mt-[0.6em] border-l-2 border-gold-400/40 pl-3 text-[1em] italic leading-[1.6] text-slate-400 break-words",
  list: "mt-[0.45em] space-y-[0.3em] pl-[1.35em] text-[1em] leading-[1.55] text-slate-300",
  nestedList: "mt-[0.3em] space-y-[0.25em] pl-[1.2em]",
};

// ── Code block with language + copy ─────────────────────────────────────────

function CodeCopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      aria-label="Copy code"
      onClick={(e) => {
        e.stopPropagation();
        try { void navigator.clipboard?.writeText(text); } catch { /* clipboard unavailable */ }
        setOk(true);
        window.setTimeout(() => setOk(false), 1200);
      }}
      className={cx(
        "flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.72em] font-medium text-slate-400 transition-colors hover:bg-phantix-800 hover:text-slate-200",
        ok && "text-emerald-400",
      )}
    >
      {ok ? <Check size={11} /> : <Copy size={11} />}
      {ok ? "Copied" : "Copy"}
    </button>
  );
}

function CodeBlock({ text, lang }: { text: string; lang?: string }) {
  return (
    <div className="mt-[0.6em] overflow-hidden rounded-lg border border-phantix-700/40 bg-phantix-950/85">
      <div className="flex items-center gap-2 border-b border-phantix-700/30 bg-phantix-900/50 px-2.5 py-1">
        <span className="text-[0.72em] font-semibold uppercase tracking-wider text-slate-500">{lang || "code"}</span>
        <span className="ml-auto"><CodeCopyBtn text={text} /></span>
      </div>
      <pre className="wb-scroll overflow-x-auto p-2.5 font-mono text-[0.85em] leading-[1.5] text-slate-300 whitespace-pre">{text}</pre>
    </div>
  );
}

// ── Lists (recursive, nested, gold markers, task checkboxes) ────────────────

function TaskBox({ checked }: { checked: boolean }) {
  return (
    <span
      className={cx(
        "mr-[0.45em] inline-flex h-[0.95em] w-[0.95em] translate-y-[0.12em] items-center justify-center rounded border align-baseline",
        checked ? "border-emerald-400/50 bg-emerald-400/15 text-emerald-300" : "border-slate-500/60 bg-transparent text-transparent",
      )}
      aria-hidden
    >
      <Check size={9} strokeWidth={3.5} />
    </span>
  );
}

function ListView({ nodes, ordered, nested = false }: { nodes: ListNode[]; ordered: boolean; nested?: boolean }) {
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag
      className={cx(
        nested ? cls.nestedList : cls.list,
        ordered ? "list-decimal marker:font-semibold marker:text-gold-400/90" : "list-disc marker:text-gold-400/80",
      )}
    >
      {nodes.map((n, i) => (
        <li key={i} className="break-words">
          {n.checked !== null && <TaskBox checked={n.checked} />}
          <span dangerouslySetInnerHTML={{ __html: n.html }} />
          {n.children.length > 0 && <ListView nodes={n.children} ordered={n.children[0].ordered} nested />}
        </li>
      ))}
    </Tag>
  );
}

// ── Renderer ────────────────────────────────────────────────────────────────

export default function MarkdownView({ source }: { source: string }) {
  const blocks = useMemo(() => parseBlock(source || ""), [source]);
  return (
    <div className="min-w-0 max-w-full break-words">
      {blocks.map((b, idx) => {
        if (b.kind === "h") {
          const level = Math.min(b.level, 6);
          const Tag = `h${level}` as keyof JSX.IntrinsicElements;
          return <Tag key={idx} className={cls[`h${level}` as keyof typeof cls]} dangerouslySetInnerHTML={{ __html: b.text }} />;
        }
        if (b.kind === "p") return <p key={idx} className={cls.p} dangerouslySetInnerHTML={{ __html: b.text }} />;
        if (b.kind === "code") return <CodeBlock key={idx} text={b.text} lang={b.lang} />;
        if (b.kind === "mermaid") return <MermaidDiagram key={idx} code={b.text} />;
        if (b.kind === "list") return <ListView key={idx} nodes={b.items} ordered={b.ordered} />;
        if (b.kind === "table") {
          return (
            <div key={idx} className="wb-scroll mt-[0.6em] max-w-full overflow-x-auto rounded-lg border border-phantix-700/40">
              <table className="w-full min-w-[380px] text-left text-[0.92em]">
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
        if (b.kind === "hr") return <hr key={idx} className="my-[0.8em] border-phantix-700/40" />;
        return null;
      })}
    </div>
  );
}
