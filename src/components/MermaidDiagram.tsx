import React, { useEffect, useMemo, useState } from "react";
import { cx } from "@/lib/utils";
import { renderMermaid } from "@/lib/mermaid";
import { isFlowchart, renderFlowSvg } from "@/lib/flowChart";

/**
 * Renders a diagram client-side. `flowchart` blocks are drawn by our native
 * SVG renderer (synchronous, responsive, theme-aware — no flash). Other diagram
 * types fall back to the lazily-imported mermaid package. On failure we fall
 * back to the raw source block so the content is never lost.
 */
export default function MermaidDiagram({ code, className }: { code: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const [theme, setTheme] = useState(() =>
    typeof document !== "undefined" ? document.documentElement.getAttribute("data-theme") : "dark",
  );

  // Re-render when the app theme flips so native SVGs track the palette.
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(document.documentElement.getAttribute("data-theme"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  const flowchart = isFlowchart(code);

  // Native flowchart: render synchronously; keep the raw source visible while
  // we wait for nothing.
  const nativeSvg = useMemo(() => {
    if (!flowchart) return "";
    try {
      return renderFlowSvg(code);
    } catch (err) {
      console.error("Native flowchart render failed:", err);
      setFailed(true);
      return "";
    }
  }, [code, theme, flowchart]);

  // Fallback (non-flowchart diagrams): lazy mermaid, mounted once ready.
  const [mermaidSvg, setMermaidSvg] = useState<string | null>(null);
  useEffect(() => {
    if (flowchart) return;
    let cancelled = false;
    setFailed(false);
    setMermaidSvg(null);
    (async () => {
      try {
        const svg = await renderMermaid(code);
        if (!cancelled) setMermaidSvg(svg);
      } catch (err) {
        if (!cancelled) setFailed(true);
        console.error("Mermaid render failed:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, theme, flowchart]);

  const svg = flowchart ? nativeSvg : mermaidSvg;

  if (failed) {
    return (
      <pre className="wb-scroll mt-3 overflow-x-auto rounded-lg border border-severity-medium/30 bg-phantix-950/60 p-3 font-mono text-[12px] leading-5 text-slate-400 whitespace-pre">
        {code}
      </pre>
    );
  }

  return (
    <div
      className={cx(
        "wb-scroll mt-3 w-full overflow-x-auto rounded-xl border border-phantix-700/40 bg-phantix-950/40 px-4 py-4 text-center",
        className,
      )}
      aria-label="Diagram"
    >
      {svg ? <span dangerouslySetInnerHTML={{ __html: svg }} /> : <span className="sr-only">Rendering diagram…</span>}
    </div>
  );
}