import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle, ChevronRight, ExternalLink, FileCode2, GitPullRequest, Loader2, RefreshCw,
  ShieldCheck, Sparkles, Wrench, EyeOff, Undo2, ShieldAlert, Lock,
} from "lucide-react";
import { Card, CardHeader, EmptyState, SeverityBadge, Spinner } from "@/components/ui";
import { highlightCode } from "@/lib/highlighter";
import {
  loadCodeBlob, loadCodeFinding, loadCodeFindingFiles, loadCodeFindings,
  explainCodeFinding, openCodeAutofixPr, setCodeFindingStatus,
} from "@/lib/codeOps";
import type {
  CodeAiExplanation, CodeBlob, CodeFinding, CodeFindingFile, CodeSeverityCounts, Repo,
} from "@/lib/codeOps";
import { useStore } from "@/lib/store";
import { cx, timeAgo } from "@/lib/utils";
import type { Severity } from "@/lib/types";

// ── Code review — the GitHub-style finding view ──────────────────────────────
// Files on the left, the selected file's findings beneath them, and on the right
// the review itself: the block that is wrong, why it is wrong, how to fix it,
// and the AutoFix draft PR that closes it.
//
// The code block is fetched per finding from GitHub at the SHA that was reviewed
// (`/github/code/findings/{id}/blob`) — the platform stores the location, never
// the source — so a missing block is an ordinary degraded panel, not an error.

const LAYER_LABEL: Record<string, string> = {
  sast: "SAST",
  sca: "Dependencies",
  secrets: "Secrets",
  iac: "IaC",
  pipeline: "Pipeline",
  malware: "Malware",
};

/** Literal classes — Tailwind only generates what it can see in the source, so
 *  these cannot be built from a template string. */
const SEV_DOT: Record<string, string> = {
  critical: "bg-severity-critical",
  high: "bg-severity-high",
  medium: "bg-severity-medium",
  low: "bg-severity-low",
  info: "bg-severity-info",
};

const AUTOFIX_TONE: Record<string, string> = {
  pr_open: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  pr_merged: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  queued: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  permission_required: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  no_fix: "border-phantix-600/40 bg-phantix-800/50 text-slate-400",
  failed: "border-severity-critical/30 bg-severity-critical/10 text-severity-critical",
};

const AUTOFIX_LABEL: Record<string, string> = {
  none: "No AutoFix yet",
  queued: "AutoFix queued",
  pr_open: "Draft PR open",
  pr_merged: "PR merged",
  pr_closed: "PR closed",
  no_fix: "No safe fix produced",
  permission_required: "GitHub write access needed",
  failed: "AutoFix failed",
};

/** Reasons `/blob` can decline, in words a developer can act on. */
const BLOB_REASON: Record<string, string> = {
  repository_unknown: "The finding's repository is no longer connected.",
  path_unknown: "This finding has no file path recorded.",
  sha_unknown: "No reviewed commit is recorded for this finding.",
  github_not_connected: "The GitHub App is not connected, so the file cannot be read.",
  file_not_found_at_sha: "The file is gone at the reviewed commit — it was moved, renamed or the branch was deleted.",
  not_a_file: "That path is not a file at the reviewed commit.",
  file_too_large: "The file is too large to render here.",
  binary_or_undecodable: "The file is binary, so there is no block to show.",
  github_error: "GitHub could not be reached for this file.",
};

// ── The block ────────────────────────────────────────────────────────────────

/** Line-numbered source with the offending range tinted, like a GitHub blob.
 *
 * Shiki colours the window as one block and emits one `.line` span per line,
 * which we split back apart so each line keeps its own number and highlight
 * state. If that mapping does not line up exactly, we render plain text rather
 * than risk showing a line's colours against the wrong line number. */
function BlobView({ blob }: { blob: CodeBlob }) {
  const lines = blob.lines ?? [];
  const [html, setHtml] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setHtml(null);
    if (lines.length === 0) return;
    const text = lines.map((l) => l.content).join("\n");
    highlightCode(text, blob.language)
      .then((out) => {
        if (cancelled) return;
        const doc = new DOMParser().parseFromString(out, "text/html");
        const spans = Array.from(doc.querySelectorAll("pre code .line"));
        setHtml(spans.length === lines.length ? spans.map((s) => s.innerHTML) : null);
      })
      .catch(() => {
        if (!cancelled) setHtml(null);
      });
    return () => {
      cancelled = true;
    };
  }, [blob.language, lines]);

  if (lines.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-md border border-phantix-700/50 bg-[#0d1117]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-phantix-700/50 bg-phantix-900/60 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <FileCode2 size={13} className="shrink-0 text-slate-500" />
          <span className="truncate font-mono text-xs text-slate-300">{blob.path}</span>
          {blob.sha && (
            <span className="shrink-0 font-mono text-[10px] text-slate-500">@ {blob.sha.slice(0, 7)}</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {blob.redacted && (
            <span className="chip text-[10px] border-amber-400/30 bg-amber-400/10 text-amber-300">
              <Lock size={10} className="mr-1 inline" /> value masked
            </span>
          )}
          {blob.permalink && (
            <a href={blob.permalink} target="_blank" rel="noreferrer" className="btn-ghost !px-2 !py-1 !text-[11px]">
              <ExternalLink size={11} /> GitHub
            </a>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse font-mono text-[12.5px] leading-[1.6]">
          <tbody>
            {lines.map((line, i) => (
              <tr
                key={line.number}
                className={cx(
                  line.highlight && "bg-severity-critical/10",
                  !line.highlight && "hover:bg-white/[0.03]",
                )}
              >
                <td
                  className={cx(
                    "w-[1%] select-none whitespace-nowrap border-r border-phantix-700/40 px-3 text-right align-top text-[11px]",
                    line.highlight ? "text-severity-critical" : "text-slate-600",
                  )}
                >
                  {line.number}
                </td>
                <td className="whitespace-pre px-3 align-top text-slate-300">
                  {html ? (
                    <span dangerouslySetInnerHTML={{ __html: html[i] }} />
                  ) : (
                    line.content || " "
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!blob.anchored && (
        <p className="border-t border-phantix-700/50 px-3 py-2 text-[11px] text-slate-500">
          This detector reports the file, not a line — the head of the file is shown.
        </p>
      )}
    </div>
  );
}

// ── Detail panel ─────────────────────────────────────────────────────────────

function Prose({ title, body, icon }: { title: string; body?: string | null; icon: React.ReactNode }) {
  if (!body) return null;
  return (
    <div>
      <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {icon} {title}
      </h4>
      <p className="whitespace-pre-line text-sm leading-6 text-slate-300">{body}</p>
    </div>
  );
}

function FindingDetail({
  findingId,
  repos,
  onChanged,
}: {
  findingId: number;
  repos: Repo[];
  onChanged: () => void;
}) {
  const { toast } = useStore();
  const [finding, setFinding] = useState<CodeFinding | null>(null);
  const [blob, setBlob] = useState<CodeBlob | null>(null);
  const [loading, setLoading] = useState(true);
  const [blobLoading, setBlobLoading] = useState(true);
  const [explanation, setExplanation] = useState<CodeAiExplanation | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [autofixBusy, setAutofixBusy] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setBlobLoading(true);
    setExplanation(null);
    try {
      const detail = await loadCodeFinding(findingId);
      setFinding(detail);
      setExplanation(detail.ai_explanation ?? null);
    } catch (e: any) {
      setFinding(null);
      toast("error", "Finding unavailable", e?.message || e?.detail?.message);
    } finally {
      setLoading(false);
    }
    try {
      setBlob(await loadCodeBlob(findingId));
    } catch {
      setBlob({ ok: false, reason: "github_error" });
    } finally {
      setBlobLoading(false);
    }
  }, [findingId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const explain = async () => {
    setExplaining(true);
    try {
      const res = await explainCodeFinding(findingId);
      setExplanation(res.explanation);
      if (res.cached) toast("info", "Showing the saved narrative for this finding");
    } catch (e: any) {
      const detail = e?.detail ?? {};
      toast("error", "Narrative unavailable", detail.message || e?.message);
    } finally {
      setExplaining(false);
    }
  };

  const autofix = async () => {
    if (!finding) return;
    setAutofixBusy(true);
    try {
      const repo = repos.find((r) => r.id === finding.github_repository_id);
      await openCodeAutofixPr(findingId, repo?.default_branch || undefined);
      toast("success", "AutoFix queued", "A draft PR will open; it is never merged automatically.");
      await load();
      onChanged();
    } catch (e: any) {
      const detail = e?.detail ?? {};
      if (detail?.error === "continuous_pr_not_enabled") {
        toast("error", "Continuous PR is off", detail.message);
      } else if (detail?.error === "permission_required") {
        toast("error", "GitHub write access needed", detail.message);
      } else {
        toast("error", "Could not open AutoFix PR", detail.message || e?.message);
      }
    } finally {
      setAutofixBusy(false);
    }
  };

  const toggleStatus = async () => {
    if (!finding) return;
    const next = finding.status === "dismissed" ? "open" : "dismissed";
    setStatusBusy(true);
    try {
      const updated = await setCodeFindingStatus(findingId, next);
      setFinding(updated);
      toast("success", next === "dismissed" ? "Finding dismissed" : "Finding re-opened");
      onChanged();
    } catch (e: any) {
      toast("error", "Could not change status", e?.detail?.message || e?.message);
    } finally {
      setStatusBusy(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <div className="p-6"><Spinner /></div>
      </Card>
    );
  }
  if (!finding) {
    return (
      <Card>
        <EmptyState icon={<AlertTriangle size={22} />} title="Finding unavailable" body="It may have been resolved by a newer review run." />
      </Card>
    );
  }

  const af = finding.autofix ?? {};
  const afState = af.state || "none";
  const canAutofix = afState === "none" || afState === "failed" || afState === "no_fix";

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <Card>
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <SeverityBadge severity={(finding.severity || "info") as Severity} />
              {finding.reportable ? (
                <span className="chip text-[10px] border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
                  <ShieldCheck size={10} className="mr-1 inline" /> verified · gates merge
                </span>
              ) : (
                <span className="chip text-[10px] border-phantix-600/40 text-slate-500">unverified signal</span>
              )}
              <span className="chip text-[10px] border-phantix-600/40 bg-phantix-800/50 text-slate-300">
                {LAYER_LABEL[finding.layer || ""] || finding.layer}
              </span>
              {finding.cwe && (
                <span className="chip text-[10px] border-phantix-600/40 bg-phantix-800/50 text-slate-300">{finding.cwe}</span>
              )}
              {finding.status === "dismissed" && (
                <span className="chip text-[10px] border-amber-400/30 bg-amber-400/10 text-amber-300">dismissed</span>
              )}
            </div>
            <h3 className="text-base font-semibold text-slate-100">{finding.title}</h3>
            <p className="mt-1 font-mono text-xs text-slate-500">
              {finding.repo}
              {" · "}
              {finding.path}
              {finding.start_line ? `:${finding.start_line}` : ""}
              {finding.occurrences && finding.occurrences > 1 ? ` · seen in ${finding.occurrences} runs` : ""}
              {finding.last_seen_at ? ` · ${timeAgo(finding.last_seen_at)}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button className="btn-ghost !py-1.5 !text-xs" disabled={statusBusy} onClick={() => void toggleStatus()}>
              {statusBusy ? <Loader2 size={12} className="mr-1 inline animate-spin" />
                : finding.status === "dismissed" ? <Undo2 size={12} className="mr-1 inline" />
                : <EyeOff size={12} className="mr-1 inline" />}
              {finding.status === "dismissed" ? "Re-open" : "Dismiss"}
            </button>
            {canAutofix && (
              <button className="btn-primary !py-1.5 !text-xs" disabled={autofixBusy} onClick={() => void autofix()}>
                {autofixBusy ? <Loader2 size={12} className="mr-1 inline animate-spin" /> : <Wrench size={12} className="mr-1 inline" />}
                AutoFix this
              </button>
            )}
          </div>
        </div>

        {blobLoading ? (
          <div className="rounded-md border border-phantix-700/50 bg-phantix-900/40 p-6"><Spinner /></div>
        ) : blob?.ok ? (
          <BlobView blob={blob} />
        ) : (
          <div className="rounded-md border border-phantix-700/50 bg-phantix-900/40 p-4">
            <p className="text-xs leading-5 text-slate-400">
              {BLOB_REASON[blob?.reason || ""] || "The code block could not be read."}
            </p>
            {(blob?.permalink || finding.permalink) && (
              <a href={blob?.permalink || finding.permalink} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-gold-300 underline">
                <ExternalLink size={11} /> Open the file on GitHub
              </a>
            )}
          </div>
        )}
      </Card>

      <Card>
        <div className="space-y-4">
          <Prose title="Why this is a vulnerability" body={finding.why} icon={<ShieldAlert size={12} />} />
          <Prose title="How to fix it" body={finding.fix} icon={<Wrench size={12} />} />
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {finding.reference_url && (
              <a href={finding.reference_url} target="_blank" rel="noreferrer" className="btn-ghost !py-1.5 !text-xs">
                <ExternalLink size={11} /> Reference
              </a>
            )}
            {!explanation && (
              <button className="btn-secondary !py-1.5 !text-xs" disabled={explaining} onClick={() => void explain()}>
                {explaining ? <Loader2 size={12} className="mr-1 inline animate-spin" /> : <Sparkles size={12} className="mr-1 inline" />}
                Explain in context
              </button>
            )}
            {finding.guidance_specific === false && (
              <span className="text-[11px] text-slate-500">
                General guidance for this layer — no rule-specific text is registered yet.
              </span>
            )}
          </div>

          {explanation && (
            <div className="rounded-md border border-gold-400/20 bg-gold-400/[0.06] p-3">
              <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gold-200">
                <Sparkles size={12} /> In this repository
              </h4>
              {explanation.explanation && <p className="whitespace-pre-line text-sm leading-6 text-slate-300">{explanation.explanation}</p>}
              {explanation.impact && <p className="mt-2 text-sm leading-6 text-slate-400"><span className="text-slate-300">Impact: </span>{explanation.impact}</p>}
              {explanation.root_cause && <p className="mt-2 text-sm leading-6 text-slate-400"><span className="text-slate-300">Root cause: </span>{explanation.root_cause}</p>}
              {explanation.remediation && <p className="mt-2 text-sm leading-6 text-slate-400"><span className="text-slate-300">Remediation: </span>{explanation.remediation}</p>}
              <div className="mt-2 flex flex-wrap gap-2">
                {explanation.requires_human_review && (
                  <span className="chip text-[10px] border-amber-400/30 bg-amber-400/10 text-amber-300">needs human review</span>
                )}
                {explanation.hallucination_flagged && (
                  <span className="chip text-[10px] border-severity-critical/30 bg-severity-critical/10 text-severity-critical">flagged for review</span>
                )}
                {explanation.model_name && (
                  <span className="chip text-[10px] border-phantix-600/40 bg-phantix-800/50 text-slate-400">{explanation.model_name}</span>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="AutoFix" subtitle="Ephemeral clone → app-signed commit → draft PR a developer merges" action={<GitPullRequest size={15} className="text-gold-300" />} />
        <div className="flex flex-wrap items-center gap-2">
          <span className={cx("chip text-[11px]", AUTOFIX_TONE[afState] || "border-phantix-600/40 bg-phantix-800/50 text-slate-400")}>
            {AUTOFIX_LABEL[afState] || afState}
          </span>
          {af.pr_url && (
            <a href={af.pr_url} target="_blank" rel="noreferrer" className="btn-ghost !py-1.5 !text-xs">
              <ExternalLink size={11} /> PR #{af.pr_number}
            </a>
          )}
          {af.signed && (
            <span className="chip text-[10px] border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
              <ShieldCheck size={10} className="mr-1 inline" /> signed commit
            </span>
          )}
          {af.branch && <span className="font-mono text-[11px] text-slate-500">{af.branch}</span>}
        </div>
        {af.detail && <p className="mt-2 text-xs leading-5 text-slate-400">{af.detail}</p>}
        <p className="mt-2 text-[11px] leading-4 text-slate-500">
          Dual-controlled: the request is parked for an authorizer before it runs. AutoFix never forks and never
          merges — the PR opens as a draft.
        </p>
      </Card>
    </motion.div>
  );
}

// ── The page surface ─────────────────────────────────────────────────────────

export default function CodeReview({ repos }: { repos: Repo[] }) {
  const { toast } = useStore();
  const [files, setFiles] = useState<CodeFindingFile[]>([]);
  const [counts, setCounts] = useState<CodeSeverityCounts>({});
  const [repoFilter, setRepoFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [pathFindings, setPathFindings] = useState<CodeFinding[]>([]);
  const [pathLoading, setPathLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await loadCodeFindingFiles({
        repository_id: repoFilter ? Number(repoFilter) : undefined,
        status: statusFilter,
      });
      const items = Array.isArray(res?.items) ? res.items : [];
      setFiles(items);
      setCounts(res?.counts ?? {});
      setSelectedPath((prev) => (prev && items.some((f) => f.path === prev) ? prev : items[0]?.path ?? null));
    } catch (e: any) {
      setFiles([]);
      setError(e?.detail?.message || e?.message || "Code findings unavailable.");
    } finally {
      setLoading(false);
    }
  }, [repoFilter, statusFilter]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  const selectedFile = useMemo(() => files.find((f) => f.path === selectedPath), [files, selectedPath]);

  const loadPath = useCallback(async () => {
    if (!selectedPath) {
      setPathFindings([]);
      setSelectedId(null);
      return;
    }
    setPathLoading(true);
    try {
      const res = await loadCodeFindings({
        path: selectedPath,
        repository_id: selectedFile?.github_repository_id,
        status: statusFilter,
        limit: 100,
      });
      const items = Array.isArray(res?.items) ? res.items : [];
      setPathFindings(items);
      setSelectedId((prev) => (prev && items.some((f) => f.id === prev) ? prev : items[0]?.id ?? null));
    } catch (e: any) {
      setPathFindings([]);
      toast("error", "Findings unavailable", e?.detail?.message || e?.message);
    } finally {
      setPathLoading(false);
    }
  }, [selectedPath, selectedFile?.github_repository_id, statusFilter, toast]);

  useEffect(() => {
    void loadPath();
  }, [loadPath]);

  const refreshAll = () => {
    void loadFiles();
    void loadPath();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select className="input !w-auto !py-1.5 !text-xs" value={repoFilter} onChange={(e) => setRepoFilter(e.target.value)}>
          <option value="">All repositories</option>
          {repos.map((r) => (
            <option key={r.id} value={String(r.id)}>{r.full_name || r.name}</option>
          ))}
        </select>
        <select className="input !w-auto !py-1.5 !text-xs" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="open">Open</option>
          <option value="fixed">Fixed</option>
          <option value="dismissed">Dismissed</option>
          <option value="all">All</option>
        </select>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {(["critical", "high", "medium", "low"] as const).map((sev) =>
            counts[sev] ? (
              <span key={sev} className="chip text-[10px] border-phantix-600/40 bg-phantix-800/50 text-slate-300">
                <span className={cx("mr-1 inline-block h-1.5 w-1.5 rounded-full", SEV_DOT[sev])} />
                {counts[sev]} {sev}
              </span>
            ) : null,
          )}
          <button className="btn-ghost !px-2 !py-1.5 !text-xs" onClick={refreshAll} title="Refresh">
            <RefreshCw size={12} className={cx("inline", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {loading ? (
        <Card><div className="p-6"><Spinner /></div></Card>
      ) : error ? (
        <Card>
          <EmptyState
            icon={<AlertTriangle size={22} />}
            title="Code findings unavailable"
            body={error}
            action={<button className="btn-secondary" onClick={refreshAll}>Retry</button>}
          />
        </Card>
      ) : files.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileCode2 size={22} />}
            title={statusFilter === "open" ? "No open code findings" : "Nothing here"}
            body={
              statusFilter === "open"
                ? "Findings appear as the reviewer processes pushes on watched branches. Enable review on a repository to start."
                : "No findings match this filter."
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-4 xl:col-span-3">
            <Card className="!p-0">
              <div className="border-b border-phantix-700/40 px-3 py-2.5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Files · {files.length}
                </h3>
              </div>
              <div className="max-h-[720px] overflow-y-auto">
                {files.map((f) => {
                  const active = f.path === selectedPath;
                  return (
                    <div key={`${f.github_repository_id}-${f.path}`}>
                      <button
                        onClick={() => setSelectedPath(f.path)}
                        className={cx(
                          "w-full border-b border-phantix-700/20 px-3 py-2.5 text-left transition-colors",
                          active ? "bg-phantix-800/70" : "hover:bg-phantix-800/40",
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <ChevronRight
                            size={13}
                            className={cx(
                              "mt-0.5 shrink-0 text-slate-600 transition-transform duration-150",
                              active && "rotate-90 text-slate-400",
                            )}
                          />
                          <FileCode2 size={13} className={cx("mt-0.5 shrink-0", active ? "text-gold-300" : "text-slate-500")} />
                          <div className="min-w-0 flex-1">
                            <p className={cx("truncate font-mono text-[11.5px]", active ? "text-slate-100" : "text-slate-300")} title={f.path}>
                              {f.path}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <SeverityBadge severity={(f.worst_severity || "info") as Severity} className="!px-1.5 !py-0 !text-[9px]" />
                              <span className="text-[10px] text-slate-500">{f.findings} finding{f.findings === 1 ? "" : "s"}</span>
                              {f.autofix_pr_url && <GitPullRequest size={10} className="text-emerald-400" />}
                            </div>
                            {f.repo && <p className="mt-1 truncate text-[10px] text-slate-600">{f.repo}</p>}
                          </div>
                        </div>
                      </button>

                      {active && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          transition={{ duration: 0.15 }}
                          className="overflow-hidden bg-phantix-900/40"
                        >
                          {pathLoading ? (
                            <div className="px-3 py-3"><Spinner /></div>
                          ) : (
                            pathFindings.map((fd, i) => {
                              const isLast = i === pathFindings.length - 1;
                              return (
                                <button
                                  key={fd.id}
                                  onClick={() => setSelectedId(fd.id)}
                                  className={cx(
                                    "relative flex w-full items-start gap-2 border-b border-phantix-700/20 py-2 pl-7 pr-3 text-left transition-colors",
                                    fd.id === selectedId ? "bg-gold-400/[0.08]" : "hover:bg-phantix-800/40",
                                  )}
                                >
                                  {/* Tree connector — ties this finding back to the file it belongs to. */}
                                  <span
                                    aria-hidden
                                    className={cx(
                                      "pointer-events-none absolute left-[18px] top-0 w-px bg-phantix-600/60",
                                      isLast ? "h-[17px]" : "h-full",
                                    )}
                                  />
                                  <span
                                    aria-hidden
                                    className="pointer-events-none absolute left-[18px] top-[17px] h-px w-2.5 rounded-full bg-phantix-600/60"
                                  />
                                  <span className={cx("relative mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", SEV_DOT[fd.severity] || SEV_DOT.info)} />
                                  <span className="min-w-0 flex-1">
                                    <span className={cx("block truncate text-[11.5px]", fd.id === selectedId ? "text-slate-100" : "text-slate-400")}>
                                      {fd.title}
                                    </span>
                                    <span className="mt-0.5 block text-[10px] text-slate-600">
                                      {fd.start_line ? `line ${fd.start_line}` : "file-level"}
                                      {fd.autofix?.pr_number ? ` · PR #${fd.autofix.pr_number}` : ""}
                                    </span>
                                  </span>
                                </button>
                              );
                            })
                          )}
                        </motion.div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          <div className="lg:col-span-8 xl:col-span-9">
            {selectedId ? (
              <FindingDetail key={selectedId} findingId={selectedId} repos={repos} onChanged={refreshAll} />
            ) : (
              <Card>
                <EmptyState icon={<FileCode2 size={22} />} title="Pick a finding" body="Choose a file on the left to see the block, why it is a vulnerability, and the fix." />
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
