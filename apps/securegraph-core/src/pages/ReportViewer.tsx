import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Download, ExternalLink, FileText, Printer } from "lucide-react";
import { PageSkeleton, ErrorState } from "@sg/ui";
import { api, ApiError } from "@sg/api";

/**
 * Full-page report viewer.
 *
 * Two rendering modes:
 *
 *  • **PDF** — the primary view for client deliverables. The authenticated
 *    bytes are fetched with the app's normal request (same org-scoped check as
 *    the download endpoint), wrapped in a blob URL, and handed to the browser's
 *    built-in PDF viewer inside an iframe. Nothing is loaded from a second
 *    address under this app's origin.
 *  • **HTML** — the same report rendered full-page in a fully sandboxed iframe
 *    (`sandbox` carries no allow-* tokens), the trust model used by Claude's
 *    Artifacts. This is the fallback when no PDF artifact exists (e.g. a report
 *    generated without the pdf format) and the source for Print → Save as PDF.
 *
 * The format is chosen from the report's actual artifacts (`output_files` /
 * `formats_requested`), prefers PDF, and can be overridden with `?format=`.
 */

type ViewerFormat = "pdf" | "html";

function availableFormats(report: any): Set<string> {
  const out = new Set<string>();
  const files = report?.output_files;
  if (files && typeof files === "object") {
    for (const [key, val] of Object.entries(files)) {
      if (key.endsWith("_error")) continue;
      const isInline =
        !!val && typeof val === "object" && typeof (val as { inline?: unknown }).inline === "string";
      if (isInline || (typeof val === "string" && val.trim())) out.add(key);
    }
  }
  const requested = report?.formats_requested;
  if (Array.isArray(requested)) for (const f of requested) if (typeof f === "string") out.add(f);
  return out;
}

export default function ReportViewer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const pdfUrlRef = useRef<string | null>(null);

  const reportId = Number(id);

  const [format, setFormat] = useState<ViewerFormat>("pdf");
  const [available, setAvailable] = useState<Set<string>>(new Set());
  const [html, setHtml] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const setObjectUrl = useCallback((blob: Blob) => {
    if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
    const url = URL.createObjectURL(blob);
    pdfUrlRef.current = url;
    setPdfUrl(url);
    return url;
  }, []);

  const isArtifactMissing = (err: unknown) =>
    err instanceof ApiError &&
    err.status === 404 &&
    !!err.detail &&
    typeof err.detail === "object" &&
    (err.detail as { code?: string }).code === "report_artifact_missing";

  const loadHtml = useCallback(async () => {
    const text = await api.fetchText(`/reports/${reportId}/download?format=html`);
    setHtml(text);
    setPdfUrl((prev) => {
      if (prev && pdfUrlRef.current) {
        URL.revokeObjectURL(pdfUrlRef.current);
        pdfUrlRef.current = null;
      }
      return null;
    });
  }, [reportId]);

  const loadPdf = useCallback(async () => {
    const blob = await api.download(`/reports/${reportId}/download?format=pdf`);
    if (!blob || blob.size === 0) throw new Error("Server returned an empty PDF");
    setObjectUrl(blob);
    setHtml(null);
  }, [reportId, setObjectUrl]);

  const load = useCallback(
    async (requested?: ViewerFormat) => {
      if (!Number.isFinite(reportId)) {
        setError("Invalid report link");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      setNotice(null);
      try {
        // Learn which artifacts exist, then pick PDF when we can.
        let detail: any = null;
        try {
          detail = await api.get<any>(`/reports/${reportId}`);
        } catch {
          /* detail is best-effort — fall through to the requested/HTML default */
        }
        const formats = availableFormats(detail);
        setAvailable(formats);
        const want: ViewerFormat =
          requested ?? (formats.has("pdf") ? "pdf" : "html");
        setFormat(want);

        if (want === "pdf") {
          try {
            await loadPdf();
          } catch (err) {
            // No stored PDF (or it was dropped by a redeploy) — show the HTML
            // rendering instead of a dead page, and say so.
            if (isArtifactMissing(err)) {
              setNotice(
                "No stored PDF for this report — showing the HTML rendering, which you can Print → Save as PDF.",
              );
              setFormat("html");
              await loadHtml();
            } else {
              throw err;
            }
          }
        } else {
          await loadHtml();
        }
      } catch (err) {
        setError(
          isArtifactMissing(err)
            ? "This report's stored content is gone (usually after a redeploy without persistent storage). Regenerate it from the report library."
            : err instanceof Error
              ? err.message
              : "Could not load this report",
        );
      } finally {
        setLoading(false);
      }
    },
    [reportId, loadPdf, loadHtml],
  );

  useEffect(() => {
    const fromQuery = params.get("format");
    void load(fromQuery === "pdf" || fromQuery === "html" ? fromQuery : undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  // Revoke the object URL when the page unmounts so the blob can be collected.
  useEffect(() => {
    return () => {
      if (pdfUrlRef.current) {
        URL.revokeObjectURL(pdfUrlRef.current);
        pdfUrlRef.current = null;
      }
    };
  }, []);

  const switchTo = (next: ViewerFormat) => {
    if (next === format) return;
    void load(next);
  };

  const canPdf = available.has("pdf");
  const canHtml = available.has("html") || !canPdf; // HTML is the always-available fallback

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

        {/* Format switch — only offered for artifacts the report actually has. */}
        {!loading && !error && (
          <div className="ml-2 flex items-center gap-1 rounded-lg border border-phantix-700/50 bg-phantix-950/50 p-0.5">
            <button
              type="button"
              onClick={() => switchTo("pdf")}
              disabled={!canPdf}
              className={`rounded-md px-2.5 py-1.5 text-[12px] font-semibold uppercase transition-colors ${
                format === "pdf"
                  ? "bg-gold-400/15 text-gold-300"
                  : "text-slate-400 hover:text-slate-200 disabled:opacity-40"
              }`}
            >
              PDF
            </button>
            <button
              type="button"
              onClick={() => switchTo("html")}
              disabled={!canHtml}
              className={`rounded-md px-2.5 py-1.5 text-[12px] font-semibold uppercase transition-colors ${
                format === "html"
                  ? "bg-gold-400/15 text-gold-300"
                  : "text-slate-400 hover:text-slate-200 disabled:opacity-40"
              }`}
            >
              HTML
            </button>
          </div>
        )}

        <div className="ml-auto flex gap-2">
          {format === "html" && (
            <button
              onClick={() => iframeRef.current?.contentWindow?.print()}
              disabled={!html}
              className="flex items-center gap-1.5 rounded-lg border border-phantix-700/50 bg-phantix-950/50 px-3 py-2 text-xs text-slate-300 hover:bg-phantix-800/60 disabled:opacity-40"
            >
              <Printer size={13} /> Print / Save PDF
            </button>
          )}
          {format === "pdf" && pdfUrl && (
            <button
              onClick={() => window.open(pdfUrl, "_blank", "noopener")}
              className="flex items-center gap-1.5 rounded-lg border border-phantix-700/50 bg-phantix-950/50 px-3 py-2 text-xs text-slate-300 hover:bg-phantix-800/60"
            >
              <ExternalLink size={13} /> Open in new tab
            </button>
          )}
          <a
            href={`/reports?id=${id}`}
            className="flex items-center gap-1.5 rounded-lg border border-phantix-700/50 bg-phantix-950/50 px-3 py-2 text-xs text-slate-300 hover:bg-phantix-800/60"
          >
            <Download size={13} /> Other formats
          </a>
        </div>
      </div>

      {notice && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-gold-400/25 bg-gold-400/5 px-3.5 py-2.5 text-xs leading-5 text-gold-200">
          <FileText size={14} className="mt-0.5 shrink-0 text-gold-400" />
          <span>{notice}</span>
        </div>
      )}

      {loading && <PageSkeleton variant="detail" />}

      {!loading && error && <ErrorState title="Could not load report" body={error} onRetry={() => void load()} />}

      {!loading && !error && format === "html" && html && (
        <iframe
          ref={iframeRef}
          srcDoc={html}
          sandbox=""
          title={`Report ${id}`}
          className="w-full flex-1 rounded-lg border border-phantix-700/40 bg-white"
        />
      )}

      {!loading && !error && format === "pdf" && pdfUrl && (
        <iframe
          src={`${pdfUrl}#view=FitH&toolbar=1`}
          title={`Report ${id} (PDF)`}
          className="w-full flex-1 rounded-lg border border-phantix-700/40 bg-white"
        />
      )}
    </div>
  );
}
