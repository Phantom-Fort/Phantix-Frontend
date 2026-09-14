// Lightweight, dependency-free Mermaid‑flowchart‑to‑SVG renderer.
//
// We render `flowchart TD/LR` blocks ourselves (instead of shipping mermaid)
// so process flows get a deliberate, consistent design: clean orthogonal
// routing, no stray boxes, responsive scaling via viewBox, and a palette that
// tracks the app theme. The parser handles exactly the subset used in our docs
// (nodes, decisions `{}`, parallelograms `[/x/]`, edge labels, `A & B --> C`,
// back edges). Anything else falls through to the caller's mermaid fallback.

export type FlowNodeShape = "rect" | "diamond" | "para" | "stadium";

export interface FlowNode {
  id: string;
  label: string;
  shape: FlowNodeShape;
  level: number;
  order: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FlowEdge {
  from: string;
  to: string;
  label?: string | null;
}

export interface FlowGraph {
  dir: "TD" | "LR";
  nodes: Map<string, FlowNode>;
  edges: FlowEdge[];
}

// ── Parsing ──────────────────────────────────────────────────────────────────

const NODE_ID_RE = "[A-Za-z_][\\w-]*";

// Split on `&` only at bracket depth 0 so `A[Assets & Discovery]` is one node.
function splitAmp(src: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of src) {
    if (ch === "[" || ch === "{" || ch === "(") depth++;
    else if (ch === "]" || ch === "}" || ch === ")") depth--;
    if (ch === "&" && depth === 0) {
      parts.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}

type NodeExpr =
  | { kind: "def"; id: string; label: string; shape: FlowNodeShape }
  | { kind: "ref"; id: string }
  | { kind: "none" };

function parseNodeExpr(expr: string): NodeExpr {
  const s = expr.trim();
  const shapes: Array<[RegExp, FlowNodeShape]> = [
    [new RegExp(`^(${NODE_ID_RE})\\s*\\{\\s*([\\s\\S]*?)\\s*\\}$`), "diamond"],
    [new RegExp(`^(${NODE_ID_RE})\\s*\\[/\\s*([\\s\\S]*?)\\s*/\\]$`), "para"],
    [new RegExp(`^(${NODE_ID_RE})\\s*\\[\\\\\\s*([\\s\\S]*?)\\s*\\\\\\]$`), "para"],
    [new RegExp(`^(${NODE_ID_RE})\\s*\\(\\s*\\(\\s*([\\s\\S]*?)\\s*\\)\\s*\\)$`), "stadium"],
    [new RegExp(`^(${NODE_ID_RE})\\s*\\[\\s*([\\s\\S]*?)\\s*\\]$`), "rect"],
  ];
  for (const [re, shape] of shapes) {
    const m = s.match(re);
    if (m) return { kind: "def", id: m[1], label: m[2].trim(), shape };
  }
  const ref = s.match(new RegExp(`^(${NODE_ID_RE})$`));
  if (ref) return { kind: "ref", id: ref[1] };
  return { kind: "none" };
}

function parseLine(line: string): { chunks: string[]; conns: { label: string | null }[] } {
  const tokens: Array<{ type: "chunk"; text: string } | { type: "conn"; label: string | null }> = [];
  let i = 0;
  while (i < line.length) {
    const conn = line.slice(i).match(/^\s*(-->|--X-->|---|==>|===)/);
    if (conn) {
      tokens.push({ type: "conn", label: null });
      i += conn[0].length;
      const lm = line.slice(i).match(/^\s*\|([^|]*)\|\s*/);
      if (lm) {
        const last = tokens[tokens.length - 1];
        if (last && last.type === "conn") last.label = lm[1].trim() || null;
        i += lm[0].length;
      }
      continue;
    }
    const next = line.slice(i).search(/(-->|--X-->|---|==>|===)/);
    const chunk = next === -1 ? line.slice(i) : line.slice(i, next);
    if (chunk.trim()) tokens.push({ type: "chunk", text: chunk });
    if (next === -1) break;
    i = next;
  }
  const chunks = tokens.filter((t) => t.type === "chunk").map((t) => t.text);
  const conns = tokens.filter((t): t is { type: "conn"; label: string | null } => t.type === "conn");
  return { chunks, conns };
}

/** Parse a mermaid `flowchart TD|LR` block into a graph model. */
export function parseFlow(source: string): FlowGraph {
  const lines = source.split(/\r?\n/).map((l) => l.replace(/%%.*$/, "").trim());
  let dir: "TD" | "LR" = "TD";
  const nodeDefs = new Map<string, { label: string; shape: FlowNodeShape }>();
  const edges: FlowEdge[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const dirM = line.match(/^flowchart\s+(TD|TB|BT|LR|RL)\b/i);
    if (dirM) {
      const d = dirM[1].toUpperCase();
      dir = d === "LR" || d === "RL" ? "LR" : "TD";
      continue;
    }
    if (line.startsWith("flowchart")) continue;
    if (/^(sequenceDiagram|stateDiagram|classDiagram|gantt|graph\s)/i.test(line)) continue;

    const { chunks, conns } = parseLine(line);
    const parsedChunks = chunks.map((c) =>
      splitAmp(c)
        .map(parseNodeExpr)
        .filter((e) => e.kind !== "none"),
    );
    for (const chunk of parsedChunks) {
      for (const e of chunk) {
        if (e.kind === "def") nodeDefs.set(e.id, { label: e.label, shape: e.shape });
      }
    }
    for (let k = 0; k < conns.length; k++) {
      const srcs = parsedChunks[k] ?? [];
      const tgts = parsedChunks[k + 1] ?? [];
      for (const s of srcs) {
        for (const t of tgts) {
          if (s.kind !== "ref" && s.kind !== "def") continue;
          if (t.kind !== "ref" && t.kind !== "def") continue;
          edges.push({ from: s.id, to: t.id, label: conns[k].label });
        }
      }
    }
  }

  // Ensure every referenced id has a node entry.
  const nodes = new Map<string, FlowNode>();
  for (const [id, def] of nodeDefs) {
    nodes.set(id, { id, label: def.label, shape: def.shape, level: 0, order: 0, x: 0, y: 0, w: 0, h: 0 });
  }
  for (const e of edges) {
    if (!nodes.has(e.from)) nodes.set(e.from, { id: e.from, label: e.from, shape: "rect", level: 0, order: 0, x: 0, y: 0, w: 0, h: 0 });
    if (!nodes.has(e.to)) nodes.set(e.to, { id: e.to, label: e.to, shape: "rect", level: 0, order: 0, x: 0, y: 0, w: 0, h: 0 });
  }

  // Longest-path layering (cycle-safe: back edges are ignored for layering).
  const indeg = new Map<string, number>();
  for (const id of nodes.keys()) indeg.set(id, 0);
  for (const e of edges) indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);

  const memo = new Map<string, number>();
  const visiting = new Set<string>();
  const depthOf = (id: string): number => {
    const seen = memo.get(id);
    if (seen !== undefined) return seen;
    if (visiting.has(id)) return 0; // cycle
    visiting.add(id);
    let best = 0;
    for (const e of edges) {
      if (e.to === id) best = Math.max(best, depthOf(e.from) + 1);
    }
    visiting.delete(id);
    memo.set(id, best);
    return best;
  };
  for (const id of nodes.keys()) depthOf(id);

  const byLevel = new Map<number, string[]>();
  for (const id of nodes.keys()) {
    const lvl = memo.get(id) ?? 0;
    nodes.get(id)!.level = lvl;
    if (!byLevel.has(lvl)) byLevel.set(lvl, []);
    byLevel.get(lvl)!.push(id);
  }

  // Order nodes within a level to reduce crossings (barycentre on parents).
  const maxLevel = Math.max(0, ...Array.from(byLevel.keys()));
  const order = new Map<string, number>();
  for (let lvl = 0; lvl <= maxLevel; lvl++) {
    const ids = byLevel.get(lvl) ?? [];
    const scored = ids.map((id) => {
      const parents = edges.filter((e) => e.to === id).map((e) => order.get(e.from) ?? 0);
      const avg = parents.length ? parents.reduce((a, b) => a + b, 0) / parents.length : -1;
      return { id, avg };
    });
    scored.sort((a, b) => a.avg - b.avg);
    scored.forEach((s, i) => order.set(s.id, i));
  }
  for (const id of nodes.keys()) nodes.get(id)!.order = order.get(id) ?? 0;

  return { dir, nodes, edges };
}

// ── Sizing & text ────────────────────────────────────────────────────────────

const FONT = "12.5px 'Geist Variable', system-ui, sans-serif";
const EDGE_FONT = "11px 'Geist Variable', system-ui, sans-serif";
const LINE_H = 17;

function escXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Measure text with a canvas 2D context when available (browser). Falls back to
// a per-character estimate in non-DOM environments so SSR/tests stay correct.
let measureCtx: CanvasRenderingContext2D | null = null;
function measureText(text: string, font = FONT): number {
  if (typeof document !== "undefined") {
    try {
      if (!measureCtx) {
        const c = document.createElement("canvas");
        measureCtx = c.getContext("2d");
      }
      if (measureCtx) {
        measureCtx.font = font;
        return measureCtx.measureText(text).width;
      }
    } catch {
      /* fall through to estimate */
    }
  }
  let w = 0;
  for (const ch of text) {
    w += ch.charCodeAt(0) < 128 ? 6.9 : 8.6;
  }
  return w;
}

/** Wrap text to a measured pixel width, hard-breaking overlong words. */
function wrapText(text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (measureText(w) > maxWidth) {
      // A single token wider than the box: split it character by character.
      if (cur) {
        lines.push(cur);
        cur = "";
      }
      let piece = "";
      for (const ch of w) {
        if (piece && measureText(piece + ch) > maxWidth) {
          lines.push(piece);
          piece = ch;
        } else {
          piece += ch;
        }
      }
      if (piece) cur = piece;
      continue;
    }
    const cand = cur ? `${cur} ${w}` : w;
    if (!cur || measureText(cand) <= maxWidth) cur = cand;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [text];
}

// ── Theme ────────────────────────────────────────────────────────────────────

interface Palette {
  nodeFill: string;
  nodeStroke: string;
  nodeText: string;
  nodeSub: string;
  decisionFill: string;
  decisionStroke: string;
  edge: string;
  edgeLabel: string;
  arrow: string;
  labelFill: string;
}

function palette(): Palette {
  const light =
    typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "light";
  return light
    ? {
        nodeFill: "#ffffff",
        nodeStroke: "#94a3b8",
        nodeText: "#0f172a",
        nodeSub: "#64748b",
        decisionFill: "#fffbeb",
        decisionStroke: "#c9a227",
        edge: "#64748b",
        edgeLabel: "#334155",
        arrow: "#b9862f",
        labelFill: "#ffffff",
      }
    : {
        nodeFill: "#0d1b3d",
        nodeStroke: "#3357a8",
        nodeText: "#e2e8f0",
        nodeSub: "#94a3b8",
        decisionFill: "#2b2411",
        decisionStroke: "#c9a227",
        edge: "#8aa0c8",
        edgeLabel: "#cbd5e1",
        arrow: "#e8b54d",
        labelFill: "#050b1d",
      };
}

let svgSeq = 0;

// ── Layout ───────────────────────────────────────────────────────────────────

interface LayoutNode {
  node: FlowNode;
  lines: string[];
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Layout {
  dir: "TD" | "LR";
  nodes: LayoutNode[];
  edges: { from: LayoutNode; to: LayoutNode; label?: string | null }[];
  width: number;
  height: number;
}

function measureNode(node: FlowNode): { w: number; h: number; lines: string[] } {
  const wrapW = node.shape === "diamond" ? 190 : 260;
  const lines = wrapText(node.label, wrapW);
  const textW = Math.max(...lines.map((l) => measureText(l)), 8);
  const textH = lines.length * LINE_H;

  let w: number;
  let h: number;

  if (node.shape === "diamond") {
    // A diamond tapers: the horizontal room available at vertical offset y from
    // its centre is w * (1 - 2|y|/h). We must size it so the tallest line fits
    // at the top/bottom of the text block, not just at the widest middle.
    const padH = 14;
    const padV = 22;
    h = Math.max(56, Math.ceil(textH + padV * 2));
    const roomAtExtreme = 1 - textH / h; // width fraction at the text's extreme
    w = Math.max(120, Math.ceil((textW + padH * 2) / Math.max(0.35, roomAtExtreme)));
  } else if (node.shape === "stadium") {
    w = Math.max(84, Math.ceil(textW + 44));
    h = Math.max(48, Math.ceil(textH + 22));
  } else if (node.shape === "para") {
    // Parallelogram skew eats a little horizontal room at the top/bottom.
    w = Math.max(88, Math.ceil(textW + 40));
    h = Math.max(48, Math.ceil(textH + 24));
  } else {
    w = Math.max(84, Math.ceil(textW + 36));
    h = Math.max(48, Math.ceil(textH + 22));
  }
  return { w, h, lines };
}

function layOut(graph: FlowGraph): Layout {
  const byLevel = new Map<number, string[]>();
  for (const n of graph.nodes.values()) {
    if (!byLevel.has(n.level)) byLevel.set(n.level, []);
    byLevel.get(n.level)!.push(n.id);
  }
  const levels = Array.from(byLevel.keys()).sort((a, b) => a - b);

  const laneGap = 30; // gap between nodes on the same level (along secondary axis)
  const levelGap = 66; // gap between levels along the primary axis
  const pad = 24;
  const isLR = graph.dir === "LR";
  const maxExtent = isLR ? 640 : 780;

  // Size every node. Along the secondary axis the extent of a level is the sum
  // of node "secondary sizes" (widths for TD, heights for LR); along the
  // primary axis each level advances by its largest "primary size".
  const sized = new Map<string, { w: number; h: number; lines: string[] }>();
  const levelExtent = new Map<number, number>();
  const levelPrimary = new Map<number, number>();
  for (const lvl of levels) {
    const ids = byLevel.get(lvl)!.slice().sort((a, b) => (graph.nodes.get(a)?.order ?? 0) - (graph.nodes.get(b)?.order ?? 0));
    let span = 0;
    let thick = 0;
    for (const id of ids) {
      const n = graph.nodes.get(id)!;
      const m = measureNode(n);
      sized.set(id, m);
      span += (isLR ? m.h : m.w) + laneGap;
      thick = Math.max(thick, isLR ? m.w : m.h);
    }
    levelExtent.set(lvl, Math.max(0, span - laneGap));
    levelPrimary.set(lvl, thick);
  }
  const secondarySpan = Math.max(maxExtent, ...levelExtent.values()) + pad * 2;

  // Place nodes: secondary-axis centered per level; primary-axis advances by
  // each level's own thickness so tall rows never overlap shorter ones.
  const placed: LayoutNode[] = [];
  const placedMap = new Map<string, LayoutNode>();
  let cursorPrimary = pad;
  for (const lvl of levels) {
    const ids = byLevel.get(lvl)!.slice().sort((a, b) => (graph.nodes.get(a)?.order ?? 0) - (graph.nodes.get(b)?.order ?? 0));
    const extent = levelExtent.get(lvl) ?? 0;
    const thick = levelPrimary.get(lvl) ?? 0;
    let cursor = (secondarySpan - extent) / 2;
    for (const id of ids) {
      const n = graph.nodes.get(id)!;
      const m = sized.get(id)!;
      // Assign axis roles: for TD the secondary axis is X and primary is Y;
      // for LR the secondary axis is Y and primary is X. Node w/h stay fixed.
      const ln: LayoutNode =
        isLR
          ? { node: n, lines: m.lines, x: cursorPrimary, y: cursor, w: m.w, h: m.h }
          : { node: n, lines: m.lines, x: cursor, y: cursorPrimary, w: m.w, h: m.h };
      placed.push(ln);
      placedMap.set(id, ln);
      cursor += (isLR ? m.h : m.w) + laneGap;
    }
    cursorPrimary += thick + levelGap;
  }

  const primarySpan = Math.max(...placed.map((p) => (isLR ? p.x + p.w : p.y + p.h))) + pad;

  return {
    dir: graph.dir,
    nodes: placed,
    edges: graph.edges
      .map((e) => ({ from: placedMap.get(e.from)!, to: placedMap.get(e.to)!, label: e.label }))
      .filter((e) => e.from && e.to),
    width: isLR ? primarySpan : secondarySpan,
    height: isLR ? secondarySpan : primarySpan,
  };
}

// ── SVG generation ───────────────────────────────────────────────────────────

function nodeShapeSvg(ln: LayoutNode, pal: Palette): string {
  const { x, y, w, h } = ln;
  const n = ln.node;
  const lines = ln.lines;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const fill = n.shape === "diamond" ? pal.decisionFill : pal.nodeFill;
  const stroke = n.shape === "diamond" ? pal.decisionStroke : pal.nodeStroke;

  let body = "";
  if (n.shape === "diamond") {
    body = `<polygon points="${cx},${y} ${x + w},${cy} ${cx},${y + h} ${x},${cy}" fill="${fill}" stroke="${stroke}" stroke-width="1.3"/>`;
  } else if (n.shape === "para") {
    const skew = Math.min(16, h * 0.35);
    body = `<polygon points="${x + skew},${y} ${x + w},${y} ${x + w - skew},${y + h} ${x},${y + h}" fill="${fill}" stroke="${stroke}" stroke-width="1.3"/>`;
  } else if (n.shape === "stadium") {
    body = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="1.3"/>`;
  } else {
    body = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9" fill="${fill}" stroke="${stroke}" stroke-width="1.3"/>`;
  }

  // Centre the text block vertically: the first baseline sits above centre by
  // half the block height, then each line advances by LINE_H.
  const blockH = lines.length * LINE_H;
  const firstBaseline = cy - blockH / 2 + LINE_H / 2 + 1;
  const tspans = lines
    .map(
      (l, i) =>
        `<tspan x="${cx}" dy="${i === 0 ? 0 : LINE_H}">${escXml(l)}</tspan>`,
    )
    .join("");
  const textColor = n.shape === "diamond" ? pal.nodeText : pal.nodeText;
  return `${body}<text x="${cx}" y="${firstBaseline.toFixed(1)}" text-anchor="middle" font-size="12.5" font-family="'Geist Variable',system-ui,sans-serif" fill="${textColor}">${tspans}</text>`;
}

function edgePath(
  l: Layout,
  e: { from: LayoutNode; to: LayoutNode; label?: string | null },
  idx: number,
  pal: Palette,
  markerId: string,
): string {
  const a = e.from;
  const b = e.to;
  const lane = idx % 4;
  const aLevel = a.node.level;
  const bLevel = b.node.level;

  if (l.dir === "TD") {
    if (aLevel < bLevel) {
      const exitX = a.x + a.w / 2 + (lane - 1.5) * 9;
      const exitY = a.y + a.h;
      const enterX = b.x + b.w / 2;
      const enterY = b.y;
      const bendY = exitY + 16 + lane * 5;
      const d = `M ${exitX.toFixed(1)} ${exitY.toFixed(1)} L ${exitX.toFixed(1)} ${bendY.toFixed(1)} L ${enterX.toFixed(1)} ${bendY.toFixed(1)} L ${enterX.toFixed(1)} ${enterY.toFixed(1)}`;
      return wrapEdge(d, e.label, (exitX + enterX) / 2, bendY - 4, pal, markerId);
    }
    // Back / same-level edge: route around the right margin.
    const maxX = Math.max(...l.nodes.map((n) => n.x + n.w));
    const exitX = a.x + a.w;
    const exitY = a.y + a.h / 2;
    const rightX = maxX + 30 + lane * 8;
    const enterX = b.x + b.w;
    const enterY = b.y + b.h / 2;
    const d = `M ${exitX.toFixed(1)} ${exitY.toFixed(1)} L ${rightX.toFixed(1)} ${exitY.toFixed(1)} L ${rightX.toFixed(1)} ${enterY.toFixed(1)} L ${enterX.toFixed(1)} ${enterY.toFixed(1)}`;
    return wrapEdge(d, e.label, rightX + 6, (exitY + enterY) / 2, pal, markerId);
  }

  // LR
  if (aLevel < bLevel) {
    const exitY = a.y + a.h / 2 + (lane - 1.5) * 9;
    const exitX = a.x + a.w;
    const enterY = b.y + b.h / 2;
    const enterX = b.x;
    const bendX = exitX + 16 + lane * 5;
    const d = `M ${exitX.toFixed(1)} ${exitY.toFixed(1)} L ${bendX.toFixed(1)} ${exitY.toFixed(1)} L ${bendX.toFixed(1)} ${enterY.toFixed(1)} L ${enterX.toFixed(1)} ${enterY.toFixed(1)}`;
    return wrapEdge(d, e.label, bendX + 6, (exitY + enterY) / 2, pal, markerId);
  }
  // Back / same-level edge (LR): route around the bottom margin.
  const maxY = Math.max(...l.nodes.map((n) => n.y + n.h));
  const exitX = a.x + a.w / 2;
  const exitY = a.y + a.h;
  const bottomY = maxY + 30 + lane * 8;
  const enterX = b.x + b.w / 2;
  const enterY = b.y + b.h;
  const d = `M ${exitX.toFixed(1)} ${exitY.toFixed(1)} L ${exitX.toFixed(1)} ${bottomY.toFixed(1)} L ${enterX.toFixed(1)} ${bottomY.toFixed(1)} L ${enterX.toFixed(1)} ${enterY.toFixed(1)}`;
  return wrapEdge(d, e.label, (exitX + enterX) / 2, bottomY - 4, pal, markerId);
}

function wrapEdge(
  d: string,
  label: string | null | undefined,
  labelX: number,
  labelY: number,
  pal: Palette,
  markerId: string,
): string {
  const line = `<path d="${d}" fill="none" stroke="${pal.edge}" stroke-width="1.5" marker-end="url(#${markerId})"/>`;
  if (!label) return line;
  const labelW = Math.ceil(measureText(label, EDGE_FONT));
  const w = labelW + 16;
  return `${line}<g><rect x="${labelX - w / 2}" y="${labelY - 10}" width="${w}" height="17" rx="8" fill="${pal.labelFill}" opacity="0.92" stroke="${pal.edge}" stroke-opacity="0.35"/><text x="${labelX}" y="${labelY + 3.5}" text-anchor="middle" font-size="11" font-family="'Geist Variable',system-ui,sans-serif" fill="${pal.edgeLabel}">${escXml(label)}</text></g>`;
}

/** Render a `flowchart` source block to a complete, self-scaling `<svg>`. */
export function renderFlowSvg(code: string): string {
  const graph = parseFlow(code);
  if (graph.nodes.size === 0) return "";
  const layout = layOut(graph);
  const pal = palette();
  const markerId = `flow-arrow-${++svgSeq}`;
  const pad = 24;
  const W = layout.width + pad * 2;
  const H = layout.height + pad * 2;

  const nodesSvg = layout.nodes.map((ln) => nodeShapeSvg(ln, pal)).join("");
  const edgesSvg = layout.edges
    .map((e, i) => edgePath(layout, e, i, pal, markerId))
    .join("");

  return `<svg viewBox="0 0 ${W.toFixed(1)} ${H.toFixed(1)}" width="100%" role="img" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto">
<defs><marker id="${markerId}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${pal.arrow}"/></marker></defs>
<g transform="translate(${pad} ${pad})">${nodesSvg}${edgesSvg}</g>
</svg>`;
}

/** Returns true when the source looks like a flowchart block we can render natively. */
export function isFlowchart(code: string): boolean {
  return /^\s*flowchart\s+(TD|TB|BT|LR|RL)\b/i.test(code);
}