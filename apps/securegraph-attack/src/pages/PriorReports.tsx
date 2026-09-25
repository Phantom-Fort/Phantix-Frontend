import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, FileText, FileUp,
  Loader2, RefreshCw, Search, ShieldCheck, Trash2, UploadCloud, X,
} from "lucide-react";
import { Card, EmptyState, ErrorState, PageHeader, PageSkeleton, Modal } from "@sg/ui";
import MarkdownView from "@sg/components/MarkdownView";
import { Pagination, usePaged } from "@sg/components/Pagination";
import { useResource } from "@sg/useResource";
import { useStore } from "@sg/store";
import { cx, timeAgo } from "@sg/utils";
import {
  AGI_REPORT_ACCEPT,
  AGI_REPORT_MAX_BYTES,
  AgiReportError,
  loadAgiPriorReports,
  uploadAgiPriorReport,
  validateAgiReportFile,
  type AgiPriorReport,
} from "@sg/agi";

/**
 * Prior pentest / VAPT reports — org-wide knowledge the agent reads.
 *
 * Upload once (DOCX/PDF/MD/HTML/TXT); the backend converts it to markdown and
 * every future engagement in this organization retrieves it as callable data
 * (`ai_engine.reports.prior`) so the agent retests prior findings instead of
 * rediscovering them. The page is explicit about conversion problems (e.g. a
 * scanned PDF with no text layer) rather than showing a silent success.
 */

const FILE_BADGE: Record<string, string> = {
  pdf: "bg-rose-500/10 text-rose-300 border-rose-400/25",
  docx: "bg-sky-500/10 text-sky-300 border-sky-400/25",
  md: "bg-emerald-500/10 text-emerald-300 border-emerald-400/25",
  html: "bg-amber-500/10 text-amber-300 border-amber-400/25",
  txt: "bg-slate-500/10 text-slate-300 border-slate-400/25",
};

function bytes(n: number): string {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function ReportRow({ report, onPreview }: { report: AgiPriorReport; onPreview: () => void }) {
  const ft = String(report.meta?.file_type || "md").toLowerCase();
  const warnings = (report.meta?.conversion_warnings as string[] | undefined) || report.warnings || [];
  const cats = report.categories || [];
  return (
    <tr
      tabIndex={0}
      onClick={onPreview}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPreview();
        }
      }}
      className="group h-10 cursor-pointer border-b border-phantix-800/40 hover:bg-phantix-800/35 focus-visible:bg-phantix-800/35"
    >
      <td className="td max-w-[24rem]">
        <span className="flex min-w-0 items-center gap-2">
          <FileText size={15} className={cx("shrink-0", (FILE_BADGE[ft] || FILE_BADGE.txt).split(" ").filter((c) => c.startsWith("text-")).join(" "))} aria-hidden="true" />
          <span className="truncate font-medium text-slate-100" title={report.title}>{report.title}</span>
          {warnings.length > 0 && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded border border-amber-400/30 bg-amber-400/10 px-1.5 text-[12px] font-semibold text-amber-300" title={warnings.join("\n")}>
              <AlertTriangle size={10} /> needs attention
            </span>
          )}
        </span>
      </td>
      <td className="td whitespace-nowrap text-[13px] uppercase text-slate-400">{ft}</td>
      <td className="td hidden max-w-[14rem] lg:table-cell">
        {typeof report.meta?.source_file === "string" ? <span className="block truncate text-[13px] text-slate-400" title={report.meta.source_file}>{report.meta.source_file}</span> : <span className="text-slate-600">—</span>}
      </td>
      <td className="td hidden whitespace-nowrap text-right font-mono text-[13px] text-slate-400 md:table-cell">
        {typeof report.meta?.byte_size === "number" ? bytes(report.meta.byte_size as number) : "—"}
      </td>
      <td className="td hidden whitespace-nowrap xl:table-cell">
        {cats.length ? (
          <span className="inline-flex items-center gap-1" title={cats.join(", ")}>
            {cats.slice(0, 2).map((c) => (
              <span key={c} className="rounded border border-phantix-700/40 bg-phantix-950/60 px-1.5 text-[12px] text-slate-400">{c}</span>
            ))}
            {cats.length > 2 && <span className="text-[12px] text-slate-500">+{cats.length - 2}</span>}
          </span>
        ) : <span className="text-slate-600">—</span>}
      </td>
      <td className="td whitespace-nowrap text-[13px] text-slate-400">{report.created_at ? timeAgo(report.created_at) : "—"}</td>
      <td className="td w-8 text-right">
        <ChevronRight size={14} className="inline text-slate-600 transition-transform group-hover:translate-x-0.5 group-hover:text-gold-300" />
      </td>
    </tr>
  );
}

export default function PriorReports() {
  const { toast } = useStore();
  const reports = useResource<AgiPriorReport[]>(() => loadAgiPriorReports(), [], "agi-prior-reports");
  const [query, setQuery] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [preview, setPreview] = useState<AgiPriorReport | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return reports.data;
    return reports.data.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        (r.categories || []).some((c) => c.toLowerCase().includes(q)) ||
        String(r.meta?.source_file || "").toLowerCase().includes(q),
    );
  }, [reports.data, query]);
  const { pageItems: reportPageItems, pagination: reportPagination } = usePaged(filtered, "attack-prior-reports", query);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <PageHeader
        title="Prior reports"
        description="Share an earlier pentest or VAPT report once. It is converted to markdown and becomes org-wide knowledge the agent reads on every engagement — so it retests prior findings and does not repeat work."
        actions={
          <button onClick={() => setUploadOpen(true)} className="btn-primary !px-4 !py-2 !text-sm">
            <UploadCloud size={15} className="mr-1.5 inline" /> Upload report
          </button>
        }
      />

      <Card className="mb-4 flex items-start gap-3 border-gold-400/20 bg-gold-400/5">
        <ShieldCheck size={16} className="mt-0.5 shrink-0 text-gold-300" />
        <div className="text-[13px] leading-5 text-slate-300">
          <p className="font-semibold text-gold-200">How the agent uses this</p>
          <p className="mt-0.5 text-slate-400">
            The agent pulls prior reports from the engine before testing (<span className="font-mono text-gold-300/90">ai_engine.reports.prior</span>),
            retests each finding on the live scope, and treats a previously accepted risk as context — not a new finding.
            Accepted formats: DOCX, PDF, MD, HTML, TXT (max 8 MB).
          </p>
        </div>
      </Card>

      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search reports by title, category, or file…"
            className="input w-full !py-2 pl-9 text-sm"
          />
        </div>
        <button onClick={() => reports.reload()} className="btn-ghost !px-3 !py-2 !text-[13px]" title="Refresh">
          <RefreshCw size={13} className={cx("mr-1.5 inline", reports.loading && "animate-spin")} /> Refresh
        </button>
      </div>

      {reports.loading && reports.data.length === 0 ? (
        <PageSkeleton />
      ) : reports.error ? (
        <ErrorState title="Could not load reports" body={reports.error} onRetry={() => reports.reload()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FileUp size={26} />}
          title={reports.data.length === 0 ? "No prior reports yet" : "No reports match"}
          body={
            reports.data.length === 0
              ? "Upload a previous pentest or VAPT report (DOCX, PDF, MD, HTML, or TXT). The agent will use it as context on every future engagement for this organization."
              : "Try a different search term, or clear the filter."
          }
          action={
            reports.data.length === 0 ? (
              <button onClick={() => setUploadOpen(true)} className="btn-primary !text-sm">
                <UploadCloud size={14} className="mr-1.5 inline" /> Upload report
              </button>
            ) : (
              <button onClick={() => setQuery("")} className="btn-ghost !text-sm">Clear search</button>
            )
          }
        />
      ) : (
        <div className="space-y-2">
          <Card className="!p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-phantix-700/40">
                    <th className="th">Report</th>
                    <th className="th">Format</th>
                    <th className="th hidden lg:table-cell">File</th>
                    <th className="th hidden text-right md:table-cell">Size</th>
                    <th className="th hidden xl:table-cell">Categories</th>
                    <th className="th">Uploaded</th>
                    <th className="th w-8"><span className="sr-only">Open</span></th>
                  </tr>
                </thead>
                <tbody>
                  {reportPageItems.map((r) => (
                    <ReportRow key={r.id} report={r} onPreview={() => setPreview(r)} />
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination {...reportPagination} itemLabel="reports" />
          </Card>
          <p className="pt-1 text-[12px] text-slate-500">
            {query.trim() ? `${filtered.length} matching “${query.trim()}” · ` : ""}Available to the agent org-wide
          </p>
        </div>
      )}

      {uploadOpen && (
        <UploadReportModal
          onClose={() => setUploadOpen(false)}
          onUploaded={(doc) => {
            reports.setData((prev) => [doc, ...prev.filter((p) => p.id !== doc.id)]);
            setUploadOpen(false);
            const warnings = (doc.meta?.conversion_warnings as string[] | undefined) || doc.warnings || [];
            if (warnings.length) {
              toast("warning", "Uploaded with warnings", warnings.join(" "));
            } else {
              toast("success", "Report uploaded", `“${doc.title}” is now available to the agent org-wide.`);
            }
          }}
        />
      )}

      {preview && (
        <Modal open onClose={() => setPreview(null)} title={preview.title} wide>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-[12px] text-slate-500">
              <span className={cx("rounded border px-1.5 py-0.5 font-semibold uppercase", FILE_BADGE[String(preview.meta?.file_type || "md").toLowerCase()] || FILE_BADGE.txt)}>
                {String(preview.meta?.file_type || "md")}
              </span>
              {typeof preview.meta?.source_file === "string" && <span>{preview.meta.source_file}</span>}
              {typeof preview.meta?.byte_size === "number" && <span>{bytes(preview.meta.byte_size as number)}</span>}
              {preview.created_at && <span>{timeAgo(preview.created_at)}</span>}
            </div>
            {(((preview.meta?.conversion_warnings as string[] | undefined) || preview.warnings || []).length > 0) && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 p-2.5 text-[13px] text-amber-200">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <div>
                  {((preview.meta?.conversion_warnings as string[] | undefined) || preview.warnings || []).map((w, i) => (
                    <p key={i}>{w}</p>
                  ))}
                </div>
              </div>
            )}
            <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-phantix-700/40 bg-phantix-950/50 p-4">
              {preview.body_md ? <MarkdownView source={preview.body_md} /> : <p className="text-sm text-slate-500">No readable text was extracted from this file.</p>}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Upload ────────────────────────────────────────────────────────────────────

function UploadReportModal({
  onClose,
  onUploaded,
}: {
  onClose: () => void;
  onUploaded: (doc: AgiPriorReport) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [categories, setCategories] = useState("");
  const [reportDate, setReportDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Dropping a file anywhere outside the dropzone would otherwise make the
  // browser navigate to it — swallow page-level drops while the modal is open.
  useEffect(() => {
    const prevent = (e: DragEvent) => e.preventDefault();
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, []);

  const pick = useCallback((f: File | undefined) => {
    if (!f) return;
    try {
      validateAgiReportFile(f);
      setFile(f);
      setError(null);
      if (!title.trim()) setTitle(f.name.replace(/\.[a-z0-9]+$/i, ""));
    } catch (e) {
      setFile(null);
      setError(e instanceof AgiReportError ? e.message : "That file cannot be uploaded.");
    }
  }, [title]);

  const submit = async () => {
    if (!file) {
      setError("Choose a report file first.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const doc = await uploadAgiPriorReport(file, { title, tags, categories, reportDate });
      onUploaded(doc);
    } catch (e) {
      setError(
        e instanceof AgiReportError
          ? e.message
          : (e as { message?: string })?.message || "Upload failed — please try again.",
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal open onClose={() => { if (!uploading) onClose(); }} title="Upload a prior report" wide>
      <div className="space-y-4">
        {/* Dropzone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files?.[0]); }}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
          className={cx(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors",
            dragging ? "border-gold-400/60 bg-gold-400/5" : "border-phantix-700/60 bg-phantix-950/40 hover:border-gold-400/30",
          )}
        >
          {file ? (
            <>
              <span className={cx("flex h-11 w-11 items-center justify-center rounded-lg border", FILE_BADGE[(file.name.split(".").pop() || "").toLowerCase()] || FILE_BADGE.txt)}>
                <FileText size={20} />
              </span>
              <span className="text-sm font-semibold text-slate-100">{file.name}</span>
              <span className="text-[12px] text-slate-500">
                {bytes(file.size)} · ready to convert to markdown
              </span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setFile(null); if (inputRef.current) inputRef.current.value = ""; }}
                className="mt-1 inline-flex items-center gap-1 text-[12px] text-slate-400 hover:text-severity-critical"
              >
                <X size={11} /> Remove
              </button>
            </>
          ) : (
            <>
              <FileUp size={24} className="text-slate-500" />
              <span className="text-sm font-medium text-slate-200">Drop the report here, or click to choose</span>
              <span className="text-[12px] text-slate-500">DOCX · PDF · MD · HTML · TXT — up to {bytes(AGI_REPORT_MAX_BYTES)}</span>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={AGI_REPORT_ACCEPT}
            className="hidden"
            onChange={(e) => pick(e.target.files?.[0])}
          />
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-[12px] font-semibold uppercase tracking-wider text-slate-500">Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Q2 2026 External VAPT" className="input w-full text-sm" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold uppercase tracking-wider text-slate-500">Report date (optional)</span>
            <input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} className="input w-full text-sm" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold uppercase tracking-wider text-slate-500">Categories (optional)</span>
            <input value={categories} onChange={(e) => setCategories(e.target.value)} placeholder="sqli, idor, auth" className="input w-full text-sm" />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-[12px] font-semibold uppercase tracking-wider text-slate-500">Tags (optional)</span>
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="external, web, 2026" className="input w-full text-sm" />
          </label>
        </div>

        {error && (
          <p className="flex items-start gap-2 rounded-lg border border-severity-critical/30 bg-severity-critical/10 p-2.5 text-[13px] text-severity-critical">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} disabled={uploading} className="btn-ghost !px-4 !py-2 !text-sm disabled:opacity-50">Cancel</button>
          <button onClick={() => void submit()} disabled={!file || uploading} className="btn-primary !px-4 !py-2 !text-sm disabled:opacity-50">
            {uploading ? <Loader2 size={14} className="mr-1.5 inline animate-spin" /> : <CheckCircle2 size={14} className="mr-1.5 inline" />}
            {uploading ? "Converting…" : "Upload & convert"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
