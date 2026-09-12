// Code page ops — GitHub App installation, branch-review wallet/settings/events,
// AutoFix status and connected repositories. Mirrors the /github/* and
// /ai/autofix/* endpoints src/pages/Code.tsx renders.
import { api, delay, isDemoMode } from "./api";
import * as demo from "./demo-data";

export interface GithubInstallation {
  connected?: boolean;
  status?: string;
  installation_id?: number | null;
  account_login?: string;
  [k: string]: unknown;
}

export interface BranchReviewWallet {
  balance_ngn?: number;
  currency?: string;
  updated_at?: string | null;
  [k: string]: unknown;
}

export interface ReviewSetting {
  github_repository_id: number;
  enabled?: boolean;
  watched_branch?: string;
  post_github_comment?: boolean;
}

export interface ReviewEvent {
  id: number;
  repo?: string;
  repo_url?: string;
  sha: string;
  ref: string;
  size_tier: string;
  status: string;
  amount_ngn?: number;
  created_at?: string | null;
}

export interface AutofixStatus {
  continuous_pr?: { opens_pr?: boolean; [k: string]: unknown };
  queue?: string;
  [k: string]: unknown;
}

export interface Repo {
  id: number;
  name?: string;
  full_name?: string;
  private?: boolean;
  default_branch?: string;
  html_url?: string;
  can_analyze?: boolean;
  analyze_blocked_reason?: string | null;
  requires_premium?: boolean;
}

export async function loadGithubInstallation() {
  if (isDemoMode()) {
    await delay();
    return demo.githubInstallation;
  }
  return api.get<GithubInstallation>("/github/installation");
}

export async function loadBranchReviewWallet() {
  if (isDemoMode()) {
    await delay();
    return demo.branchReviewWallet;
  }
  return api.get<BranchReviewWallet>("/github/branch-reviews/wallet");
}

export async function loadBranchReviewSettings() {
  if (isDemoMode()) {
    await delay();
    return { items: demo.branchReviewSettings };
  }
  return api.get<{ items: ReviewSetting[] }>("/github/branch-reviews/settings");
}

export async function loadBranchReviewEvents() {
  if (isDemoMode()) {
    await delay();
    return { items: demo.branchReviewEvents };
  }
  return api.get<{ items: ReviewEvent[] }>("/github/branch-reviews/events");
}

export async function loadAutofixStatus() {
  if (isDemoMode()) {
    await delay();
    return demo.autofixStatus;
  }
  return api.get<AutofixStatus>("/ai/autofix/status");
}

export async function loadGithubRepositories() {
  if (isDemoMode()) {
    await delay();
    return { items: demo.githubRepositories };
  }
  return api.get<{ items: Repo[] }>("/github/repositories");
}

// ── Code review — findings, the vulnerable block, why/fix, AutoFix PR ────────
// The /github/code/* surface. A finding row carries *where* the weakness is and
// what to do about it; the code itself is fetched per finding from GitHub at the
// reviewed SHA (never stored by the platform), which is why the block lives
// behind its own call rather than arriving with the list.

export type CodeSeverity = "critical" | "high" | "medium" | "low" | "info";

export interface CodeAutofix {
  state?: string;
  pr_number?: number | null;
  pr_url?: string | null;
  branch?: string | null;
  commit_sha?: string | null;
  signed?: boolean | null;
  detail?: string | null;
  updated_at?: string | null;
}

export interface CodeFinding {
  id: number;
  fingerprint?: string;
  github_repository_id: number;
  repo?: string;
  repo_url?: string;
  layer?: string;
  tool?: string;
  rule_id?: string;
  severity: CodeSeverity;
  title: string;
  path: string;
  language?: string;
  start_line?: number | null;
  end_line?: number | null;
  symbol?: string | null;
  cwe?: string | null;
  status?: string;
  reportable?: boolean;
  sha?: string | null;
  ref?: string | null;
  occurrences?: number;
  permalink?: string;
  autofix?: CodeAutofix;
  first_seen_sha?: string | null;
  last_seen_at?: string | null;
  created_at?: string | null;
  /** Truncated in list responses; full text on the detail call. */
  why?: string | null;
  /** Detail call only. */
  description?: string | null;
  fix?: string | null;
  reference_url?: string | null;
  guidance_specific?: boolean;
  detail?: Record<string, unknown>;
  ai_explanation?: CodeAiExplanation | null;
  ai_explained_at?: string | null;
}

export interface CodeAiExplanation {
  explanation?: string | null;
  impact?: string | null;
  remediation?: string | null;
  root_cause?: string | null;
  confidence?: number | null;
  requires_human_review?: boolean | null;
  hallucination_flagged?: boolean | null;
  model_provider?: string | null;
  model_name?: string | null;
}

export interface CodeFindingFile {
  github_repository_id: number;
  repo?: string;
  path: string;
  language?: string;
  findings: number;
  worst_severity: CodeSeverity;
  layers?: string[];
  autofix_pr_url?: string | null;
  sha?: string | null;
}

export interface CodeSeverityCounts {
  critical?: number;
  high?: number;
  medium?: number;
  low?: number;
  info?: number;
  total?: number;
}

export interface CodeBlobLine {
  number: number;
  content: string;
  highlight: boolean;
}

export interface CodeBlob {
  ok: boolean;
  /** Why the block could not be read — branch gone, file moved, app disconnected. */
  reason?: string;
  path?: string;
  language?: string;
  sha?: string | null;
  repo?: string;
  start_line?: number | null;
  end_line?: number | null;
  first_line?: number;
  last_line?: number;
  total_lines?: number;
  anchored?: boolean;
  redacted?: boolean;
  permalink?: string;
  lines?: CodeBlobLine[];
}

export interface CodeFindingFilters {
  repository_id?: number;
  status?: string;
  severity?: string;
  layer?: string;
  path?: string;
  reportable_only?: boolean;
  limit?: number;
  offset?: number;
}

function queryOf(params: Record<string, unknown>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

export async function loadCodeFindingFiles(params: { repository_id?: number; status?: string } = {}) {
  if (isDemoMode()) {
    await delay();
    return { items: demo.codeFindingFiles, total: demo.codeFindingFiles.length, counts: demo.codeFindingCounts };
  }
  return api.get<{ items: CodeFindingFile[]; total: number; counts: CodeSeverityCounts }>(
    `/github/code/files${queryOf(params)}`,
  );
}

export async function loadCodeFindings(params: CodeFindingFilters = {}) {
  if (isDemoMode()) {
    await delay();
    const items = demo.codeFindings.filter(
      (f) =>
        (!params.path || f.path === params.path) &&
        (!params.repository_id || f.github_repository_id === params.repository_id) &&
        (!params.severity || f.severity === params.severity),
    );
    return { items, total: items.length, counts: demo.codeFindingCounts };
  }
  return api.get<{ items: CodeFinding[]; total: number; counts: CodeSeverityCounts }>(
    `/github/code/findings${queryOf(params as Record<string, unknown>)}`,
  );
}

export async function loadCodeFinding(id: number) {
  if (isDemoMode()) {
    await delay();
    return demo.codeFindingDetail(id);
  }
  return api.get<CodeFinding>(`/github/code/findings/${id}`);
}

export async function loadCodeBlob(id: number, context = 12) {
  if (isDemoMode()) {
    await delay();
    return demo.codeFindingBlob(id);
  }
  return api.get<CodeBlob>(`/github/code/findings/${id}/blob?context=${context}`);
}

/** Paid, explicit enrichment — the rule-based why/fix is already on the finding. */
export async function explainCodeFinding(id: number, refresh = false) {
  if (isDemoMode()) {
    await delay();
    return { ok: true, cached: false, explanation: demo.codeFindingExplanation(id) };
  }
  return api.post<{ ok: boolean; cached: boolean; explanation: CodeAiExplanation }>(
    `/github/code/findings/${id}/explain?refresh=${refresh ? "true" : "false"}`,
    {},
  );
}

export async function setCodeFindingStatus(id: number, status: "open" | "dismissed", reason?: string) {
  if (isDemoMode()) {
    await delay();
    return { ...demo.codeFindingDetail(id), status };
  }
  return api.patch<CodeFinding>(`/github/code/findings/${id}/status`, { status, reason });
}

/** Dual-controlled: parked for an authorizer, then opens a **draft** PR. */
export async function openCodeAutofixPr(id: number, baseBranch?: string) {
  if (isDemoMode()) {
    await delay();
    return { task_id: "demo-autofix-task", finding_id: id, opens_pr: true, merges_automatically: false };
  }
  return api.post<{ task_id: string; finding_id: number; repo?: string; message?: string }>(
    `/github/code/findings/${id}/autofix-pr${baseBranch ? `?base_branch=${encodeURIComponent(baseBranch)}` : ""}`,
    {},
  );
}
