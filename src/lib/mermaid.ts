// Renders diagram sources used in our docs. `flowchart` blocks are drawn by our
// purpose-built native renderer (clean, responsive, theme-matched SVG); any
// other diagram type (sequenceDiagram, stateDiagram, …) falls back to the
// lazily-imported mermaid package so we never lose capability.
import type Mermaid from "mermaid";
import { isFlowchart, renderFlowSvg } from "./flowChart";

let seq = 0;

function themeVars(): Record<string, string> {
  const light = typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "light";
  if (light) {
    return {
      background: "transparent",
      primaryColor: "#eff6ff",
      primaryTextColor: "#0f172a",
      primaryBorderColor: "#64748b",
      lineColor: "#64748b",
      secondaryColor: "#f8fafc",
      tertiaryColor: "#ffffff",
      clusterBkg: "#ffffff",
      clusterBorder: "#cbd5e1",
      edgeLabelBackground: "#ffffff",
      nodeBorder: "#64748b",
      nodeTextColor: "#0f172a",
      labelBackground: "#ffffff",
      labelTextColor: "#475569",
      titleColor: "#0f172a",
      fontSize: "13px",
    };
  }
  return {
    background: "transparent",
    primaryColor: "#0d1b3d",
    primaryTextColor: "#e2e8f0",
    primaryBorderColor: "#3357a8",
    lineColor: "#94a3b8",
    secondaryColor: "#16214a",
    tertiaryColor: "#050b1d",
    clusterBkg: "#050b1d",
    clusterBorder: "#3357a8",
    edgeLabelBackground: "#0d1b3d",
    nodeBorder: "#3357a8",
    nodeTextColor: "#e2e8f0",
    labelBackground: "#0d1b3d",
    labelTextColor: "#94a3b8",
    titleColor: "#e2e8f0",
    fontSize: "13px",
  };
}

async function getMermaid(): Promise<typeof Mermaid> {
  const mod = await import("mermaid");
  const mermaid = mod.default ?? mod;
  mermaid.initialize({
    startOnLoad: false,
    theme: "base",
    securityLevel: "loose",
    fontFamily: "'Geist Variable', 'Space Grotesk', system-ui, sans-serif",
    themeVariables: themeVars(),
  });
  return mermaid;
}

/** Render a diagram source string to an SVG string. Throws on parse/render error. */
export async function renderMermaid(code: string): Promise<string> {
  if (isFlowchart(code)) return renderFlowSvg(code);
  const mermaid = await getMermaid();
  const id = `mmd-${++seq}-${Date.now().toString(36)}`;
  const { svg } = await mermaid.render(id, code);
  return svg;
}