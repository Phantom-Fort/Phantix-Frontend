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
