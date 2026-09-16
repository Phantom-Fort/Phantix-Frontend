import React from "react";
import { GitBranch, Github, Gitlab } from "lucide-react";
import type { IntegrationConnector } from "@sg/types";

// ── Source-control providers ─────────────────────────────────────────────────
// GitHub arrives via the GitHub App; GitLab and Gitea are Integrations Hub
// Connectors (category `scm`). All three feed the same branch-review pipeline
// and the verified-only merge gate. This module is the single source of truth
// for their metadata, icons and webhook paths, shared by the Code page and the
// dedicated connection pages (pages/ProviderConnect.tsx).

export const SCM_WEBHOOK_PATH: Record<string, string> = {
  github: "/github/webhook",
  gitlab: "/gitlab/webhook",
  gitea: "/gitea/webhook",
};

// Hub SCM connectors the catalogue can actually install. Other SCM-category
// entries (Snyk, Semgrep, Trivy, CI…) are DevSecOps ingest, not source control.
export const SCM_HUB_PROVIDERS = new Set(["gitlab", "gitea", "bitbucket", "azure_devops"]);
const SCM_INSTALLABLE = new Set(["ga", "beta", "preview", "active"]);

export function scmInstallable(c: IntegrationConnector): boolean {
  return SCM_INSTALLABLE.has(String(c.status || "").toLowerCase());
}

export function scmIcon(id: string, size = 15): React.ReactNode {
  if (id === "github") return <Github size={size} />;
  if (id === "gitlab") return <Gitlab size={size} />;
  return <GitBranch size={size} />;
}

export function providerTone(status?: string): string {
  const s = (status || "").toLowerCase();
  if (s === "active") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
  if (s === "pending_auth") return "border-amber-400/30 bg-amber-400/10 text-amber-300";
  if (s === "error" || s === "degraded")
    return "border-severity-critical/30 bg-severity-critical/10 text-severity-critical";
  return "border-phantix-600/40 bg-phantix-800/50 text-slate-400";
}

export interface ScmProviderSetup {
  id: string;
  name: string;
  /** `app` = GitHub App (install), `connector` = Integrations Hub SCM connector. */
  kind: "app" | "connector";
  tagline: string;
  blurb: string;
  docsUrl: string;
  /** Where to mint a token (opened in a new tab). */
  tokenUrl?: string;
  tokenLabel?: string;
  tokenHint?: string;
  scopes: string[];
  webhookSecretHeader: string;
  /** Env var whose value is the webhook secret the provider must send. */
  webhookSecretEnv?: string;
  /** Ordered setup steps. `{API_BASE}` is substituted at render time. */
  setup: string[];
  capabilities: string[];
}

export const SCM_PROVIDER_SETUP: Record<string, ScmProviderSetup> = {
  github: {
    id: "github",
    name: "GitHub",
    kind: "app",
    tagline: "GitHub App — installation-based, no long-lived token",
    blurb:
      "Install the SecureGraph GitHub App on the account or organization that owns the repositories. Reviews run on watched branches and open draft pull requests.",
    docsUrl: "https://docs.github.com/en/apps",
    scopes: ["Contents: read", "Pull requests: write", "Checks: write", "Metadata: read"],
    webhookSecretHeader: "X-Hub-Signature-256",
    setup: [
      "Install the GitHub App on the account or organization that owns the repositories.",
      "Grant access to all repositories, or only the ones you want reviewed.",
      "GitHub delivers webhooks to {API_BASE}/github/webhook (configured on the App).",
      "Watch branches from Code → Repositories; pushes are reviewed before merge.",
    ],
    capabilities: ["scm.import", "merge_request.review"],
  },
  gitlab: {
    id: "gitlab",
    name: "GitLab",
    kind: "connector",
    tagline: "GitLab.com or self-managed (server-configured base URL)",
    blurb:
      "Connect with OAuth2 or a personal/project access token. Merge-request events are reviewed before merge.",
    docsUrl: "https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html",
    tokenUrl: "https://gitlab.com/-/user_settings/personal_access_tokens",
    tokenLabel: "Personal or project access token",
    tokenHint: "Copy a token with the api scope (or read_api + write_repository).",
    scopes: ["api", "read_api", "write_repository"],
    webhookSecretHeader: "X-Gitlab-Token",
    webhookSecretEnv: "GITLAB_WEBHOOK_SECRET",
    setup: [
      "Create a GitLab personal (or project) access token with the api scope.",
      "Connect below — paste the token, or use OAuth2 to authorize SecureGraph.",
      "Add a project webhook to {API_BASE}/gitlab/webhook and set Secret token to GITLAB_WEBHOOK_SECRET.",
      "Enable the Merge request events trigger on that webhook.",
    ],
    capabilities: ["scm.import", "merge_request.review"],
  },
  gitea: {
    id: "gitea",
    name: "Gitea",
    kind: "connector",
    tagline: "Self-hosted Gitea (server-configured base URL)",
    blurb:
      "Connect with OAuth2 or an access token. Pull-request events are reviewed before merge.",
    docsUrl: "https://docs.gitea.com/development/oauth2-provider",
    tokenUrl: "/user/settings/applications",
    tokenLabel: "Access token",
    tokenHint: "Create a token with read:repository and write:repository scopes.",
    scopes: ["read:repository", "write:repository", "read:issue"],
    webhookSecretHeader: "X-Gitea-Signature",
    webhookSecretEnv: "GITEA_WEBHOOK_SECRET",
    setup: [
      "Create a Gitea access token (Settings → Applications) with repository scopes.",
      "Connect below — paste the token, or use OAuth2 to authorize SecureGraph.",
      "Add a repository webhook to {API_BASE}/gitea/webhook with a Secret matching GITEA_WEBHOOK_SECRET.",
      "Enable the Pull request event on that webhook.",
    ],
    capabilities: ["scm.import", "merge_request.review"],
  },
};

export const SCM_PROVIDER_ORDER = ["github", "gitlab", "gitea"] as const;

export function webhookUrlFor(providerId: string, apiBase: string): string {
  const path = SCM_WEBHOOK_PATH[providerId];
  return path ? `${apiBase}${path}` : "";
}
