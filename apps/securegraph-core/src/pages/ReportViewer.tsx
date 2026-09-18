import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { PageSkeleton, ErrorState } from "@sg/ui";
import { api, ApiError } from "@sg/api";

/**
 * Renders a generated report full-page, isolated in a fully sandboxed iframe —
 * the same trust model as Claude's Artifacts. `sandbox` carries no allow-*
 * tokens at all, so the frame gets a unique opaque origin with scripting,
 * same-origin storage/cookie access, form submission, top-level navigation
 * and popups all blocked, regardless of what the report HTML contains. The
 * backend's HTML renderer already escapes every dynamic value
 * (html.escape / Jinja autoescape) before it reaches us — the sandbox is a
 * second, independent layer, not the only one.
 *
 * Content is fetched with the app's normal authenticated request (same
 * org-scoped access check as the existing download endpoint) and handed to
 * the frame via `srcDoc`, so nothing is loaded from a second URL: no
 * separate address to bookmark, share, or leave sitting in browser cache
 * under this app's own origin.
 */
export default function ReportViewer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reportId = Number(id);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const text = await api.fetchText(`/reports/${reportId}/download?format=html`);
      setHtml(text);
    } catch (err) {
      const missing =
        err instanceof ApiError && err.status === 404 &&
        err.detail && typeof err.detail === "object" &&
        (err.detail as { code?: string }).code === "report_artifact_missing";
      setError(
        missing
          ? "This report's stored content is gone (usually after a redeploy without persistent storage). Regenerate it from the report library."
          : err instanceof Error ? err.message : "Could not load this report",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!Number.isFinite(reportId)) {
      setError("Invalid report link");
      setLoading(false);
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  return (
    <div className="flex h-[calc(100vh-104px)] min-h-[500px] flex-col">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => navigate("/reports?tab=reports")}
          className="flex items-center gap-1.5 rounded-lg border border-phantix-700/50 bg-phantix-950/50 px-3 py-2 text-xs text-slate-300 hover:bg-phantix-800/60"
        >
          <ArrowLeft size={13} /> Back to reports
        </button>
        <h1 className="ml-1 font-display text-sm font-semibold text-slate-200">Report #{id}</h1>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => iframeRef.current?.contentWindow?.print()}
            disabled={!html}
            className="flex items-center gap-1.5 rounded-lg border border-phantix-700/50 bg-phantix-950/50 px-3 py-2 text-xs text-slate-300 hover:bg-phantix-800/60 disabled:opacity-40"
          >
            <Printer size={13} /> Print / Save PDF
          </button>
          <a
            href={`/reports?id=${id}`}
            className="flex items-center gap-1.5 rounded-lg border border-phantix-700/50 bg-phantix-950/50 px-3 py-2 text-xs text-slate-300 hover:bg-phantix-800/60"
          >
            <Download size={13} /> Other formats
          </a>
        </div>
      </div>

      {loading && <PageSkeleton variant="detail" />}

      {!loading && error && (
        <ErrorState
          title="Could not load report"
          body={error}
          onRetry={load}
        />
      )}

      {!loading && !error && html && (
        <iframe
          ref={iframeRef}
          srcDoc={html}
          sandbox=""
          title={`Report ${id}`}
          className="w-full flex-1 rounded-lg border border-phantix-700/40 bg-white"
        />
      )}
    </div>
  );
}
