import React, { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2 } from "lucide-react";
import type { AssetGraphModel, AssetGraphNode } from "@/lib/assetGraphData";

// Obsidian-inspired relational force graph rendered on canvas.
// Nodes drift apart via repulsion, cluster via link springs, and settle —
// then the simulation sleeps so idle frames are free.

interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number; // pinned x while dragging
  fy?: number;
}

interface Props {
  model: AssetGraphModel;
  selectedId?: string | null;
  onSelect?: (node: AssetGraphNode | null) => void;
  /** Dim everything except matches + their neighbours when non-empty. */
  query?: string;
  className?: string;
  interactive?: boolean;
}

const EDGE_STYLE: Record<string, { width: number; alpha: number }> = {
  tagged: { width: 1.3, alpha: 0.5 },
  typed: { width: 1, alpha: 0.35 },
  related: { width: 2, alpha: 0.65 },
};

function radiusOf(n: AssetGraphNode): number {
  const base = n.kind === "type" ? 11 : n.kind === "tag" ? 9 : 5.5;
  return base + n.weight * 7;
}

export default function AssetForceGraph({
  model,
  selectedId,
  onSelect,
  query,
  className,
  interactive = true,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 640, h: 360 });
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [zoomLabel, setZoomLabel] = useState(1);

  // Simulation transform + node positions live in refs to avoid re-renders.
  const posRef = useRef<Map<string, P>>(new Map());
  const alphaRef = useRef(1);
  const viewRef = useRef({ x: 0, y: 0, k: 1 });
  const dragRef = useRef<{ id: string | null; panning: boolean; moved: boolean; sx: number; sy: number; ox: number; oy: number }>({
    id: null, panning: false, moved: false, sx: 0, sy: 0, ox: 0, oy: 0,
  });
  const pointerRef = useRef<{ x: number; y: number }>({ x: -1e4, y: -1e4 });
  const rafRef = useRef<number>(0);
  const frozenRef = useRef(false);

  const nodesRef = useRef(model.nodes);
  const edgesRef = useRef(model.edges);
  nodesRef.current = model.nodes;
  edgesRef.current = model.edges;

  // Adjacency for neighbour highlighting
  const adjRef = useRef<Map<string, Set<string>>>(new Map());
  useEffect(() => {
    const adj = new Map<string, Set<string>>();
    for (const e of model.edges) {
      if (!adj.has(e.source)) adj.set(e.source, new Set());
      if (!adj.has(e.target)) adj.set(e.target, new Set());
      adj.get(e.source)!.add(e.target);
      adj.get(e.target)!.add(e.source);
    }
    adjRef.current = adj;
    // Seed any new nodes near a connected node (or centre).
    const pos = posRef.current;
    const knownKeys = new Set(model.nodes.map((n) => n.id));
    for (const id of [...pos.keys()]) if (!knownKeys.has(id)) pos.delete(id);
    let seedIdx = 0;
    for (const n of model.nodes) {
      if (pos.has(n.id)) continue;
      const anchor = [...(adj.get(n.id) ?? [])].find((id) => pos.has(id));
      const angle = (seedIdx++ * 137.5) % 360;
      const r = 40 + Math.random() * 30;
      pos.set(n.id, {
        x: anchor ? pos.get(anchor)!.x + Math.cos(angle) * r : 0,
        y: anchor ? pos.get(anchor)!.y + Math.sin(angle) * r : 0,
        vx: 0, vy: 0,
      });
    }
    alphaRef.current = Math.max(alphaRef.current, 0.7);
  }, [model]);

  // Highlight / focus sets recomputed on demand
  const focusSetRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const focus = new Set<string>();
    const q = (query ?? "").trim().toLowerCase();
    if (q) {
      for (const n of model.nodes) {
        if (n.label.toLowerCase().includes(q)) {
          focus.add(n.id);
          const nb = adjRef.current.get(n.id);
          if (nb) for (const b of nb) focus.add(b);
        }
      }
    }
    if (selectedId) focus.add(selectedId);
    focusSetRef.current = focus;
  }, [query, selectedId, model]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize({ w: Math.max(120, r.width), h: Math.max(120, r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const stepSim = useCallback(() => {
    const nodes = nodesRef.current;
    const edges = edgesRef.current;
    const pos = posRef.current;
    let alpha = alphaRef.current;
    if (frozenRef.current || alpha < 0.005) return;
    alpha *= 0.985;
    alphaRef.current = alpha;

    const arr = nodes.filter((n) => pos.has(n.id));
    const N = arr.length;
    if (!N) return;

    // Center gravity (weak)
    for (let i = 0; i < N; i++) {
      const p = pos.get(arr[i].id)!;
      p.vx += -p.x * 0.0015 * alpha;
      p.vy += -p.y * 0.0025 * alpha;
    }

    // Pairwise repulsion — capped radius keeps this linear-ish in practice.
    const REPULSE = 2200;
    for (let i = 0; i < N; i++) {
      const a = pos.get(arr[i].id)!;
      for (let j = i + 1; j < N; j++) {
        const b = pos.get(arr[j].id)!;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d2 = dx * dx + dy * dy;
        if (d2 > 90000) continue; // skip far pairs entirely
        if (d2 < 25) d2 = 25;
        const f = (REPULSE * alpha) / d2;
        const d = Math.sqrt(d2);
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        a.vx -= fx;
        a.vy -= fy;
        b.vx += fx;
        b.vy += fy;
      }
    }

    // Link springs
    for (const e of edges) {
      const pa = pos.get(e.source);
      const pb = pos.get(e.target);
      if (!pa || !pb) continue;
      const rest = e.kind === "related" ? 120 : e.kind === "typed" ? 130 : 95;
      const dx = pb.x - pa.x;
      const dy = pb.y - pa.y;
      const d = Math.max(20, Math.hypot(dx, dy));
      const f = ((d - rest) / d) * 0.06 * alpha;
      const fx = dx * f;
      const fy = dy * f;
      pa.vx += fx;
      pa.vy += fy;
      pb.vx -= fx;
      pb.vy -= fy;
    }

    // Integrate with damping
    for (let i = 0; i < N; i++) {
      const n = arr[i];
      const p = pos.get(n.id)!;
      if (p.fx != null && p.fy != null) {
        p.x = p.fx;
        p.y = p.fy;
        p.vx = 0;
        p.vy = 0;
        continue;
      }
      p.vx *= 0.86;
      p.vy *= 0.86;
      p.x += Math.max(-14, Math.min(14, p.vx));
      p.y += Math.max(-14, Math.min(14, p.vy));
    }
  }, []);

  // ── Render loop ────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const { w, h } = size;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const view = viewRef.current;
    const pos = posRef.current;
    const nodes = nodesRef.current;
    const edges = edgesRef.current;
    const focus = focusSetRef.current;
    const qActive = !!query?.trim();
    const sel = selectedId;
    const hov = hoverId;

    const toScreen = (x: number, y: number) => ({
      sx: w / 2 + (x + view.x) * view.k,
      sy: h / 2 + (y + view.y) * view.k,
    });

    const isHot = (id: string) => id === sel || id === hov;
    const litNeighbors =
      sel ?? hov
        ? new Set([...(adjRef.current.get((sel ?? hov)!) ?? []), sel, hov])
        : null;

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(view.k, view.k);
    ctx.translate(view.x, view.y);

    // Color lookup by node id
    const colorById = new Map<string, string>();
    for (const n of nodes) colorById.set(n.id, n.color);

    // Edges
    for (const e of edges) {
      const pa = pos.get(e.source);
      const pb = pos.get(e.target);
      if (!pa || !pb) continue;
      const style = EDGE_STYLE[e.kind] ?? EDGE_STYLE.typed;
      const hotEnds = isHot(e.source) || isHot(e.target);
      let dimmed = false;
      if (qActive) {
        const fa = focus.size === 0 || focus.has(e.source);
        const fb = focus.size === 0 || focus.has(e.target);
        dimmed = !(fa && fb);
      } else if (litNeighbors) {
        dimmed = !hotEnds && !litNeighbors.has(e.source) && !litNeighbors.has(e.target);
      }

      ctx.strokeStyle = colorById.get(e.target) || "#475569";
      ctx.globalAlpha = hotEnds ? Math.min(1, style.alpha + 0.45) : dimmed ? style.alpha * 0.18 : style.alpha;
      ctx.lineWidth = (hotEnds ? style.width + 0.8 : style.width) / Math.max(0.75, view.k ** 0.35);
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      // Slight curve for organic look
      const mx = (pa.x + pb.x) / 2 - (pb.y - pa.y) * 0.08;
      const my = (pa.y + pb.y) / 2 + (pb.x - pa.x) * 0.08;
      ctx.quadraticCurveTo(mx, my, pb.x, pb.y);
      ctx.stroke();
    }

    // Node label density gate
    const drawLabels = view.k > 0.55;
    ctx.textAlign = "center";

    for (const n of nodes) {
      const p = pos.get(n.id);
      if (!p) continue;
      const r = radiusOf(n);
      const hot = isHot(n.id);
      const neighborLit = !!litNeighbors && litNeighbors.has(n.id) && !isHot(n.id);
      const focused = focus.size === 0 || focus.has(n.id);
      let alpha = focused ? 1 : 0.16;
      if (litNeighbors && !(focused || neighborLit || hot)) alpha = 0.16;

      ctx.globalAlpha = alpha;
      // Glow halo on hot nodes
      if (hot) {
        ctx.shadowColor = n.color;
        ctx.shadowBlur = 18;
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.fillStyle = n.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      if (n.kind !== "asset") {
        // Ring style for group hubs
        ctx.strokeStyle = "rgba(10,15,24,0.9)";
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r - 1.4, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (n.kind === "type") {
        ctx.strokeStyle = n.color;
        ctx.globalAlpha = alpha * 0.7;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + 3.5, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (drawLabels || hot || neighborLit) {
        const fontSize = 11;
        ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
        ctx.fillStyle = hot ? "#F8FAFC" : "rgba(203,213,225,0.82)";
        ctx.globalAlpha = hot ? 1 : alpha * (neighborLit ? 1.05 : 0.95);
        ctx.fillText(n.label, p.x, p.y + r + fontSize + 1);
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }, [size, hoverId, selectedId, query]);

  useEffect(() => {
    const loop = () => {
      stepSim();
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [stepSim, draw]);

  // ── Interaction helpers ────────────────────────────────────────────────────
  const pickNode = useCallback(
    (clientX: number, clientY: number): string | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const view = viewRef.current;
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      const wx = (px - size.w / 2) / view.k - view.x;
      const wy = (py - size.h / 2) / view.k - view.y;
      let best: string | null = null;
      let bestD = Infinity;
      for (const n of nodesRef.current) {
        const p = posRef.current.get(n.id);
        if (!p) continue;
        const d = Math.hypot(p.x - wx, p.y - wy);
        const hitR = radiusOf(n) + 6;
        if (d < hitR && d < bestD) {
          bestD = d;
          best = n.id;
        }
      }
      return best;
    },
    [size],
  );

  const fitView = useCallback(() => {
    const pos = posRef.current;
    const nodes = nodesRef.current;
    if (!nodes.length) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of nodes) {
      const p = pos.get(n.id);
      if (!p) continue;
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    if (!Number.isFinite(minX)) return;
    const pad = 70;
    const spanX = Math.max(1, maxX - minX + pad * 2);
    const spanY = Math.max(1, maxY - minY + pad * 2);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const k = Math.max(0.25, Math.min(2.2, Math.min(size.w / spanX, size.h / spanY)));
    viewRef.current = { x: -cx, y: -cy, k };
    setZoomLabel(Math.round(k * 100) / 100);
    alphaRef.current = Math.max(alphaRef.current, 0.25);
  }, [size]);

  useEffect(() => {
    // Initial layout has settled enough after ~1.2s of sim — fit once warm.
    if (!model.nodes.length) return;
    const t = setTimeout(fitView, 1150);
    return () => clearTimeout(t);
  }, [fitView, model]);

  useEffect(() => { frozenRef.current = false; }, [model]);

  const onMouseDown = (e: React.MouseEvent) => {
    if (!interactive) return;
    const id = pickNode(e.clientX, e.clientY);
    dragRef.current = {
      id,
      panning: !id,
      moved: false,
      sx: e.clientX,
      sy: e.clientY,
      ox: viewRef.current.x,
      oy: viewRef.current.y,
    };
    if (id) {
      const p = posRef.current.get(id)!;
      p.fx = p.x;
      p.fy = p.y;
      alphaRef.current = Math.max(alphaRef.current, 0.3);
    }
  };

  const onMouseMove = (e: React.MouseEvent) => {
    const d = dragRef.current;
    if (!interactive) return;
    if (d.id || d.panning) {
      const dx = e.clientX - d.sx;
      const dy = e.clientY - d.sy;
      if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
      if (d.id) {
        const view = viewRef.current;
        const p = posRef.current.get(d.id)!;
        p.fx = (e.clientX - (canvasRef.current?.getBoundingClientRect().left ?? 0) - size.w / 2) / view.k - view.x;
        p.fy = (e.clientY - (canvasRef.current?.getBoundingClientRect().top ?? 0) - size.h / 2) / view.k - view.y;
        alphaRef.current = Math.max(alphaRef.current, 0.3);
      } else {
        const view = viewRef.current;
        view.x = d.ox + dx / view.k;
        view.y = d.oy + dy / view.k;
      }
      return;
    }
    const id = pickNode(e.clientX, e.clientY);
    if (id !== hoverId) setHoverId(id);
  };

  const endDrag = () => {
    const d = dragRef.current;
    if (d.id) {
      const p = posRef.current.get(d.id)!;
      // Un-pin unless it was barely a click; release back into physics.
      delete p.fx;
      delete p.fy;
      if (!d.moved) {
        const n = nodesRef.current.find((x) => x.id === d.id) ?? null;
        onSelect?.(n);
      }
    }
    dragRef.current = { id: null, panning: false, moved: false, sx: 0, sy: 0, ox: 0, oy: 0 };
  };

  // Zoom-to-cursor on wheel — native non-passive listener so preventDefault works.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !interactive) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left - size.w / 2;
      const my = e.clientY - rect.top - size.h / 2;
      const view = viewRef.current;
      const factor = Math.exp(-e.deltaY * 0.0016);
      const kNext = Math.max(0.2, Math.min(4, view.k * factor));
      view.x = view.x - mx / view.k + mx / kNext;
      view.y = view.y - my / view.k + my / kNext;
      view.k = kNext;
      setZoomLabel(Math.round(kNext * 100) / 100);
    };
    canvas.addEventListener("wheel", handler, { passive: false });
    return () => canvas.removeEventListener("wheel", handler);
  }, [interactive, size.w, size.h]);

  return (
    <div
      ref={wrapRef}
      className={className}
      style={{ position: "relative", overflow: "hidden", height: "100%", minHeight: 200 }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block", cursor: hoverId ? "pointer" : "grab" }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={() => { setHoverId(null); endDrag(); }}
        onDoubleClick={fitView}
      />
      {interactive && (
        <button
          type="button"
          onClick={fitView}
          title="Fit graph to view"
          className="absolute right-2 top-2 z-10 rounded-lg border border-phantix-700/50 bg-phantix-900/80 p-1.5 text-slate-400 backdrop-blur transition-colors hover:border-gold-400/50 hover:text-gold-300"
        >
          <Maximize2 size={13} />
        </button>
      )}
      {interactive && (
        <div className="pointer-events-none absolute bottom-2 left-3 font-mono text-[10px] uppercase tracking-wider text-slate-600">
          {nodesRef.current.length} nodes · {edgesRef.current.length} links · {Math.round(zoomLabel * 100)}%
        </div>
      )}
    </div>
  );
}
