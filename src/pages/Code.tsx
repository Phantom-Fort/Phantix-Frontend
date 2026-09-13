import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  GitBranch, GitPullRequest, Wrench, ShieldCheck, RefreshCw, ExternalLink, Loader2, Send, Github, AlertTriangle,
  Gitlab, Plug, PlugZap, Key, Trash2, TestTube, Webhook, CheckCircle2,
} from "lucide-react";
import { PageHeader, Card, CardHeader, StatusBadge, EmptyState, Spinner, Tabs, Modal } from "@/components/ui";
import { api, isPendingApproval } from "@/lib/api";
import {
  loadGithubInstallation,
  loadBranchReviewWallet,
  loadBranchReviewSettings,
  loadBranchReviewEvents,
  loadAutofixStatus,
  loadGithubRepositories,
} from "@/lib/codeOps";
import {
  loadHubCatalog,
  loadHubInstallations,
  installHubIntegration,
  startHubOAuth,
  uninstallHubIntegration,
  testHubInstallation,
} from "@/lib/data";
import type { IntegrationConnector, IntegrationInstallation } from "@/lib/types";
import { useStore } from "@/lib/store";
import { cx, timeAgo } from "@/lib/utils";
import DocLink from "@/components/DocLink";
import { UpsellBanner } from "@/components/UpgradeGate";

// ── Code — AutoFix, Continuous PR, GitHub repositories & review runs ─────────
// One place for everything code: connected repos, branch-review runs (the PR
// push feed), AutoFix generation and Continuous PR (ephemeral clone → app-signed
// commit → draft PR that a developer merges).

interface Repo {
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

interface ReviewSetting {
  github_repository_id: number;
  enabled?: boolean;
  watched_branch?: string;
  post_github_comment?: boolean;
}

interface ReviewEvent {
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

function statusTone(status: string): string {
  const s = (status || "").toLowerCase();
  if (s === "charged" || s === "reviewed") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
  if (s === "failed") return "border-severity-critical/30 bg-severity-critical/10 text-severity-critical";
  if (s === "reserved") return "border-amber-400/30 bg-amber-400/10 text-amber-300";
  return "border-phantix-600/40 bg-phantix-800/50 text-slate-400";
}

// ── Source-control providers ─────────────────────────────────────────────
// GitHub arrives via the GitHub App; GitLab and Gitea are Integrations Hub
// Connectors (category `scm`). All three feed the same branch-review pipeline
// and the verified-only merge gate.
const SCM_WEBHOOK_PATH: Record<string, string> = {
  github: "/github/webhook",
  gitlab: "/gitlab/webhook",
  gitea: "/gitea/webhook",
};

function scmIcon(id: string): React.ReactNode {
  if (id === "github") return <Github size={15} />;
  if (id === "gitlab") return <Gitlab size={15} />;
  return <GitBranch size={15} />;
}

function providerTone(status?: string): string {
  const s = (status || "").toLowerCase();
  if (s === "active") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
  if (s === "pending_auth") return "border-amber-400/30 bg-amber-400/10 text-amber-300";
  if (s === "error" || s === "degraded") return "border-severity-critical/30 bg-severity-critical/10 text-severity-critical";
  return "border-phantix-600/40 bg-phantix-800/50 text-slate-400";
}

function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  const v = value as { items?: T[]; connectors?: T[]; installations?: T[] } | null;
  return v?.items ?? v?.connectors ?? v?.installations ?? [];
}

export default function Code() {
  const { toast, requireDualControl } = useStore();
  const [tab, setTab] = useState("repositories");
  const [loading, setLoading] = useState(true);
  const [reposError, setReposError] = useState<string | null>(null);
  const [installation, setInstallation] = useState<any>(null);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [settings, setSettings] = useState<Record<number, ReviewSetting>>({});
  const [wallet, setWallet] = useState<any>(null);
  const [events, setEvents] = useState<ReviewEvent[]>([]);
  const [autofix, setAutofix] = useState<any>(null);
  const [scmCatalog, setScmCatalog] = useState<IntegrationConnector[]>([]);
  const [scmInstalls, setScmInstalls] = useState<IntegrationInstallation[]>([]);
  const [connectId, setConnectId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setReposError(null);
    const [inst, walletRes, settingsRes, eventsRes, autofixRes, catalogRes, installsRes] = await Promise.all([
      loadGithubInstallation().catch(() => null),
      loadBranchReviewWallet().catch(() => null),
      loadBranchReviewSettings().catch(() => null),
      loadBranchReviewEvents().catch(() => null),
      loadAutofixStatus().catch(() => null),
      loadHubCatalog().catch(() => null),
      loadHubInstallations().catch(() => null),
    ]);
    setInstallation(inst);
    const catalog = asArray<IntegrationConnector & { display_name?: string }>(catalogRes)
      .filter((c) => (c.category || "").toLowerCase() === "scm")
      .map((c) => ({ ...c, name: c.name || c.display_name || c.connector_id }));
    setScmCatalog(catalog);
    setScmInstalls(
      asArray<IntegrationInstallation>(installsRes).filter((i) =>
        ["gitlab", "gitea", "github"].includes(i.connector_id),
      ),
    );
    setWallet(walletRes);
    setEvents(Array.isArray(eventsRes?.items) ? eventsRes.items : []);
    setAutofix(autofixRes);
    const map: Record<number, ReviewSetting> = {};
    for (const s of settingsRes?.items ?? []) map[s.github_repository_id] = s;
    setSettings(map);
    try {
      const r = await loadGithubRepositories();
      setRepos(Array.isArray(r?.items) ? r.items : []);
    } catch (e: any) {
      setRepos([]);
      setReposError(e?.message || e?.detail?.message || "Repositories unavailable.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const connected = Boolean(installation?.connected || installation?.status === "active" || installation?.installation_id);

  const connectGithub = useCallback(async () => {
    try {
      const r = await api.get<{ install_url?: string }>("/github/install-url");
      if (r?.install_url) window.location.href = r.install_url;
      else toast("error", "GitHub install URL unavailable");
    } catch {
      toast("error", "Could not start GitHub install");
    }
  }, [toast]);

  const resumeScmOAuth = useCallback(async (installationId: number) => {
    try {
      const r = await startHubOAuth(installationId);
      if (r?.authorize_url) window.location.href = r.authorize_url;
      else toast("info", "Awaiting approval", "The OAuth start may be parked for an authorizer.");
    } catch {
      toast("error", "Could not start OAuth");
    }
  }, [toast]);

  const disconnectScm = useCallback(async (install: IntegrationInstallation) => {
    if (!(await requireDualControl("Disconnecting a source-control provider requires dual-control."))) return;
    const res = await uninstallHubIntegration(install.installation_id);
    await load();
    if (isPendingApproval(res)) toast("info", "Sent for approval", `${install.label} disconnect is parked for an authorizer.`);
    else toast("success", "Disconnected", `${install.label} disconnected.`);
  }, [requireDualControl, toast, load]);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Code"
        description="Source control, AutoFix, Continuous PR, connected repositories and branch/merge-request reviews."
        actions={<>
            <DocLink docId="howto-app-21" label="Code security how-to" />
          <button onClick={() => void load()} className="btn-ghost text-xs !py-2" title="Refresh">
            <RefreshCw size={13} className={cx("inline", loading && "animate-spin")} />
          </button>
        </>}
      />

      <UpsellBanner feature="continuous_pr" />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className={cx("chip text-xs", connected ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-phantix-600/40 text-slate-400")}>
          <Github size={12} className="mr-1 inline" /> {connected ? "GitHub connected" : "GitHub not connected"}
        </span>
        {wallet?.balance_ngn != null && (
          <span className="chip text-xs border-phantix-600/40 bg-phantix-800/50 text-slate-300">
            Branch-review wallet · ₦{Number(wallet.balance_ngn).toLocaleString()}
          </span>
        )}
        {autofix?.continuous_pr && (
          <span className="chip text-xs border-gold-400/30 bg-gold-400/10 text-gold-200">
            Continuous PR {autofix.continuous_pr.opens_pr ? "enabled" : "off"}
          </span>
        )}
        {scmInstalls.filter((i) => i.connector_id !== "github").map((i) => (
          <span key={i.installation_id} className={cx("chip text-xs", providerTone(i.status))}>
            {scmIcon(i.connector_id)}
            <span className="ml-1">{i.connector_id}</span>
            <span className="ml-1 opacity-70">{i.status === "active" ? "connected" : i.status}</span>
          </span>
        ))}
      </div>

      <Card className="mb-4">
        <CardHeader
          title="Source control"
          subtitle="Providers that feed repositories and pull / merge-request reviews"
          action={<GitBranch size={16} className="text-gold-300" />}
        />
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-phantix-700/40 bg-phantix-900/40 p-3">
            <div className="flex items-center gap-2">
              <span className={cx("flex h-8 w-8 items-center justify-center rounded-md border", connected ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-phantix-600/40 bg-phantix-800/50 text-slate-400")}>
                <Github size={15} />
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-200">GitHub</p>
                <p className="text-[11px] text-slate-500">GitHub App · push + pull_request</p>
              </div>
              {connected ? <CheckCircle2 size={14} className="text-emerald-400" /> : null}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className={cx("chip text-[10px]", connected ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-phantix-600/40 text-slate-400")}>
                {connected ? "connected" : "not connected"}
              </span>
              {connected ? (
                <a href="/integrations" className="btn-ghost !px-2 !py-1 !text-xs">Manage</a>
              ) : (
                <button className="btn-primary !px-2 !py-1 !text-xs" onClick={() => void connectGithub()}>Connect</button>
              )}
            </div>
          </div>

          {scmCatalog.map((c) => {
            const install = scmInstalls.find((i) => i.connector_id === c.connector_id);
            const active = install?.status === "active";
            return (
              <div key={c.connector_id} className="rounded-lg border border-phantix-700/40 bg-phantix-900/40 p-3">
                <div className="flex items-center gap-2">
                  <span className={cx("flex h-8 w-8 items-center justify-center rounded-md border", active ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-gold-400/30 bg-gold-400/10 text-gold-300")}>
                    {scmIcon(c.connector_id)}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-200">{c.name || c.connector_id}</p>
                    <p className="text-[11px] text-slate-500">{(c.auth_modes || []).join(" · ")}</p>
                  </div>
                </div>
                <p className="mt-2 text-[11px] leading-4 text-slate-500">{c.description}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className={cx("chip text-[10px]", providerTone(install?.status))}>
                    {active ? "connected" : install ? install.status : "not connected"}
                  </span>
                  {active ? (
                    <a href="/integrations" className="btn-ghost !px-2 !py-1 !text-xs">Manage</a>
                  ) : install?.status === "pending_auth" ? (
                    <button className="btn-secondary !px-2 !py-1 !text-xs" onClick={() => void resumeScmOAuth(install.installation_id)}>Finish auth</button>
                  ) : (
                    <button className="btn-primary !px-2 !py-1 !text-xs" onClick={() => setConnectId(c.connector_id)}>Connect</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Tabs
        tabs={[
          { id: "repositories", label: "Repositories", count: repos.length || undefined },
          { id: "pull-requests", label: "Pull requests", count: events.length || undefined },
          { id: "providers", label: "Providers", count: scmCatalog.length || undefined },
          { id: "autofix", label: "AutoFix" },
          { id: "continuous-pr", label: "Continuous PR" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "repositories" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardHeader title="Connected repositories" subtitle="Repositories the GitHub App can read and review" action={<GitBranch size={16} className="text-gold-300" />} />
          {loading ? (
            <div className="p-4"><Spinner /></div>
          ) : reposError ? (
            <EmptyState icon={<AlertTriangle size={22} />} title="Repositories unavailable" body={reposError} action={<button className="btn-secondary" onClick={() => void load()}>Retry</button>} />
          ) : repos.length === 0 ? (
            <EmptyState icon={<Github size={22} />} title="No repositories" body="Install the GitHub App or sync repositories from the platform portal." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-phantix-700/40">
                    <th className="th">Repository</th>
                    <th className="th">Branch</th>
                    <th className="th">Review</th>
                    <th className="th">Visibility</th>
                    <th className="th text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {repos.map((r) => {
                    const s = settings[r.id];
                    return (
                      <tr key={r.id} className="border-b border-phantix-700/20 hover:bg-phantix-800/40">
                        <td className="td">
                          <div className="flex items-center gap-2">
                            <GitBranch size={13} className="text-slate-500" />
                            <span className="text-sm text-slate-200">{r.full_name || r.name}</span>
                          </div>
                        </td>
                        <td className="td text-xs font-mono text-slate-400">{r.default_branch || s?.watched_branch || "—"}</td>
                        <td className="td">
                          {s?.enabled ? (
                            <span className="chip text-[10px] border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
                              {s.watched_branch || "watching"}
                            </span>
                          ) : (
                            <span className="chip text-[10px] border-phantix-600/40 text-slate-500">off</span>
                          )}
                        </td>
                        <td className="td text-xs text-slate-400">{r.private ? "Private" : "Public"}</td>
                        <td className="td text-right">
                          {r.html_url && (
                            <a href={r.html_url} target="_blank" rel="noreferrer" className="btn-ghost !px-2 !py-1 !text-xs">
                              <ExternalLink size={12} /> Open
                            </a>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        </motion.div>
      )}

      {tab === "pull-requests" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardHeader title="Recent branch-review runs" subtitle="Every push the reviewer processed — PR safety before merge" action={<GitPullRequest size={16} className="text-gold-300" />} />
          {loading ? (
            <div className="p-4"><Spinner /></div>
          ) : events.length === 0 ? (
            <EmptyState icon={<GitPullRequest size={22} />} title="No runs yet" body="Runs appear here as pushes land on watched branches. PRs are reviewed before merge." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-phantix-700/40">
                    <th className="th">Repository</th>
                    <th className="th">Ref</th>
                    <th className="th">SHA</th>
                    <th className="th">Tier</th>
                    <th className="th">Status</th>
                    <th className="th">When</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => (
                    <tr key={e.id} className="border-b border-phantix-700/20 hover:bg-phantix-800/40">
                      <td className="td text-sm text-slate-200">{e.repo || "—"}</td>
                      <td className="td text-xs font-mono text-slate-400">{e.ref}</td>
                      <td className="td text-xs font-mono text-slate-500">{e.sha?.slice(0, 10)}</td>
                      <td className="td text-xs text-slate-300">{e.size_tier}</td>
                      <td className="td"><span className={cx("chip text-[10px]", statusTone(e.status))}>{e.status}</span></td>
                      <td className="td text-xs text-slate-500">{e.created_at ? timeAgo(e.created_at) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        </motion.div>
      )}

      {tab === "autofix" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardHeader title="AutoFix" subtitle="Block-scoped, verified fixes — proposed for human review" action={<Wrench size={16} className="text-gold-300" />} />
          <div className="space-y-3 text-sm leading-6 text-slate-300">
            <p>
              AutoFix runs only on <strong className="text-slate-100">verified</strong> findings. It generates the
              smallest diff that fixes the class, re-validates against the original evidence, and runs blast-radius
              tests before anything is proposed.
            </p>
            <p className="text-slate-400">
              Generate a fix from a finding's detail, then open it as a <strong className="text-slate-200">Continuous PR</strong>{" "}
              — SecureGraph clones the repo into an ephemeral directory, commits the fix <strong>signed by the app</strong>,
              and opens a draft PR that your developers merge.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="chip text-xs border-phantix-600/40 bg-phantix-800/50 text-slate-300">gates: scope · no-op · re-validation · credits</span>
              {autofix?.queue && <span className="chip text-xs border-phantix-600/40 bg-phantix-800/50 text-slate-300">queue: {autofix.queue}</span>}
            </div>
          </div>
        </Card>
        </motion.div>
      )}

      {tab === "continuous-pr" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <ContinuousPrForm repos={repos} onDone={() => void load()} />
        </motion.div>
      )}

      {tab === "providers" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader
              title="Source-control providers"
              subtitle="GitHub App plus Integrations Hub SCM connectors — all feed the same verified-only merge gate"
              action={<Webhook size={16} className="text-gold-300" />}
            />
            {loading ? (
              <div className="p-4"><Spinner /></div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-phantix-700/40">
                        <th className="th">Provider</th>
                        <th className="th">Auth</th>
                        <th className="th">Status</th>
                        <th className="th">Webhook</th>
                        <th className="th text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-phantix-700/20 hover:bg-phantix-800/40">
                        <td className="td">
                          <span className="flex items-center gap-2 text-sm text-slate-200"><Github size={13} className="text-slate-500" /> GitHub</span>
                        </td>
                        <td className="td text-xs text-slate-400">app_install</td>
                        <td className="td">
                          <span className={cx("chip text-[10px]", connected ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-phantix-600/40 text-slate-400")}>
                            {connected ? "connected" : "not connected"}
                          </span>
                        </td>
                        <td className="td text-xs font-mono text-slate-500">{SCM_WEBHOOK_PATH.github}</td>
                        <td className="td text-right">
                          {!connected && <button className="btn-primary !px-2 !py-1 !text-xs" onClick={() => void connectGithub()}>Connect</button>}
                        </td>
                      </tr>
                      {scmCatalog.map((c) => {
                        const install = scmInstalls.find((i) => i.connector_id === c.connector_id);
                        return (
                          <tr key={c.connector_id} className="border-b border-phantix-700/20 hover:bg-phantix-800/40">
                            <td className="td">
                              <span className="flex items-center gap-2 text-sm text-slate-200">
                                {scmIcon(c.connector_id)} {c.name || c.connector_id}
                              </span>
                            </td>
                            <td className="td text-xs text-slate-400">{(c.auth_modes || []).join(" · ")}</td>
                            <td className="td">
                              <span className={cx("chip text-[10px]", providerTone(install?.status))}>
                                {install?.status === "active" ? "connected" : install?.status || "not connected"}
                              </span>
                            </td>
                            <td className="td text-xs font-mono text-slate-500">{SCM_WEBHOOK_PATH[c.connector_id] || "—"}</td>
                            <td className="td text-right">
                              {install?.status === "active" ? (
                                <div className="flex justify-end gap-1">
                                  <button
                                    className="btn-ghost !px-2 !py-1 !text-xs"
                                    onClick={async () => { await testHubInstallation(install.installation_id); toast("info", "Test sent", "Integration health check completed."); }}
                                  >
                                    <TestTube size={12} /> Test
                                  </button>
                                  <button className="btn-ghost !px-2 !py-1 !text-xs text-severity-critical" onClick={() => void disconnectScm(install)}>
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              ) : install?.status === "pending_auth" ? (
                                <button className="btn-secondary !px-2 !py-1 !text-xs" onClick={() => void resumeScmOAuth(install.installation_id)}>Finish auth</button>
                              ) : (
                                <button className="btn-primary !px-2 !py-1 !text-xs" onClick={() => setConnectId(c.connector_id)}>Connect</button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="p-3 text-[11px] leading-4 text-slate-500">
                  Point the provider webhook at <code className="mx-1">&#123;API_BASE&#125;{SCM_WEBHOOK_PATH.gitlab}</code> for GitLab
                  or <code className="mx-1">&#123;API_BASE&#125;{SCM_WEBHOOK_PATH.gitea}</code> for Gitea. Signatures are verified with the
                  connector secret (<code>X-Gitlab-Token</code> / <code>X-Gitea-Signature</code>); GitHub uses the App's <code>X-Hub-Signature-256</code>.
                </p>
              </>
            )}
          </Card>
        </motion.div>
      )}

      {connectId && (
        <ScmConnectModal
          connector={scmCatalog.find((c) => c.connector_id === connectId) || null}
          onClose={() => setConnectId(null)}
          onDone={() => { setConnectId(null); void load(); }}
        />
      )}
    </div>
  );
}

// ── Connect an SCM connector (api_key or OAuth) ──────────────────────────

function ScmConnectModal({ connector, onClose, onDone }: { connector: IntegrationConnector | null; onClose: () => void; onDone: () => void }) {
  const { toast } = useStore();
  const [label, setLabel] = useState("");
  const [mode, setMode] = useState(connector?.auth_modes?.[0] || "oauth2");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  if (!connector) return null;
  const needsToken = mode === "api_key";

  const submit = async () => {
    if (!label.trim()) { toast("error", "Label is required"); return; }
    if (needsToken && !token.trim()) { toast("error", "A personal access token is required"); return; }
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        connector_id: connector.connector_id,
        label: label.trim(),
        auth_mode: mode,
      };
      if (needsToken) body.secrets = { api_key: token.trim() };
      const res = await installHubIntegration(body);
      if (isPendingApproval(res)) {
        toast("info", "Sent for approval", "Install is parked for an authorizer — approve it from Authorizations.");
        onDone();
        return;
      }
      const id = (res as { installation_id?: number; id?: number })?.installation_id ?? (res as { id?: number })?.id;
      if (mode === "oauth2" && id) {
        const start = await startHubOAuth(id);
        if (start?.authorize_url) { window.location.href = start.authorize_url; return; }
      }
      toast("success", "Connected", `${connector.name} connected.`);
      onDone();
    } catch (e: unknown) {
      const err = e as { message?: string; detail?: { message?: string } };
      toast("error", "Connect failed", err?.message || err?.detail?.message || "Could not connect provider.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={true} onClose={onClose} title={`Connect ${connector.name}`}>
      <div className="space-y-4">
        <p className="text-xs text-slate-400">{connector.description}</p>
        <div>
          <label className="label">Label</label>
          <input className="input" placeholder={`e.g. ${connector.name} (production)`} value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        {connector.auth_modes.length > 1 && (
          <div>
            <label className="label">Authentication</label>
            <select className="input" value={mode} onChange={(e) => setMode(e.target.value)}>
              {connector.auth_modes.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        )}
        {needsToken ? (
          <div>
            <label className="label">Personal access token</label>
            <textarea
              className="input !min-h-[80px] font-mono !text-xs"
              placeholder="Paste a token with repository read + pull-request write scope"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Stored encrypted and projected to the Asset Engine; the API never returns it.
            </p>
          </div>
        ) : (
          <p className="text-[11px] text-slate-500">You will be redirected to {connector.name} to authorise repository access.</p>
        )}
        <div className="flex justify-end gap-3">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy} onClick={() => void submit()}>
            {busy ? <Loader2 size={13} className="mr-1.5 inline animate-spin" /> : null}
            {needsToken ? "Connect" : `Continue to ${connector.name}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ContinuousPrForm({ repos, onDone }: { repos: Repo[]; onDone: () => void }) {
  const { toast } = useStore();
  const [repoFull, setRepoFull] = useState("");
  const [findingText, setFindingText] = useState("");
  const [baseBranch, setBaseBranch] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ kind: string; message: string; requestUrl?: string } | null>(null);

  const selected = useMemo(() => repos.find((r) => (r.full_name || r.name) === repoFull), [repos, repoFull]);

  const submit = async () => {
    if (!repoFull) {
      toast("error", "Pick a repository");
      return;
    }
    let finding: Record<string, unknown> = {};
    try {
      finding = findingText.trim() ? JSON.parse(findingText) : {};
    } catch {
      toast("error", "Finding must be valid JSON");
      return;
    }
    const [owner, repo] = repoFull.split("/");
    if (!owner || !repo) {
      toast("error", "Repository must be owner/name");
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const res = await api.post<any>("/ai/autofix/continuous-pr", {
        finding,
        owner,
        repo,
        base_branch: baseBranch || selected?.default_branch || undefined,
      });
      setResult({ kind: "queued", message: `Queued as task ${res?.task_id ?? "—"}. A draft PR will open; it is never merged automatically.` });
      onDone();
    } catch (e: any) {
      const detail = e?.detail ?? {};
      if (detail?.error === "free_model_agreement_required") {
        setResult({ kind: "error", message: detail.message || "Agreement required.", requestUrl: detail.agreement_endpoint });
      } else if (detail?.error === "permission_required") {
        setResult({ kind: "permission", message: detail.message || "GitHub write permissions required.", requestUrl: detail.request_url });
      } else {
        setResult({ kind: "error", message: e?.message || detail?.message || "Could not open Continuous PR." });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Open a Continuous PR"
        subtitle="Ephemeral clone → app-signed commit → draft PR (a developer merges)"
        action={<ShieldCheck size={16} className="text-emerald-300" />}
      />
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Repository</label>
            <select className="input" value={repoFull} onChange={(e) => setRepoFull(e.target.value)}>
              <option value="">Select a repository…</option>
              {repos.map((r) => (
                <option key={r.id} value={r.full_name || r.name}>
                  {r.full_name || r.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Base branch (optional)</label>
            <input className="input" placeholder={selected?.default_branch || "default branch"} value={baseBranch} onChange={(e) => setBaseBranch(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Finding (JSON)</label>
          <textarea
            className="input !min-h-[130px] font-mono !text-xs"
            placeholder='{ "title": "…", "severity": "high", "vuln_class": "sql_injection", "evidence": { … } }'
            value={findingText}
            onChange={(e) => setFindingText(e.target.value)}
          />
          <p className="mt-1 text-[11px] text-slate-500">
            Only verified findings reach AutoFix; the patch will follow your product-context code style and be signed by the app.
          </p>
        </div>

        {result && (
          <div className={cx("rounded-md border p-3 text-xs leading-5", result.kind === "queued" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-amber-400/30 bg-amber-400/10 text-amber-200")}>
            <p>{result.message}</p>
            {result.requestUrl && (
              <a href={result.requestUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 underline">
                <ExternalLink size={11} /> Grant access / open link
              </a>
            )}
          </div>
        )}

        <div className="flex justify-end">
          <button className="btn-primary text-xs" disabled={busy} onClick={() => void submit()}>
            {busy ? <Loader2 size={13} className="mr-1.5 inline animate-spin" /> : <Send size={13} className="mr-1.5 inline" />}
            Open Continuous PR
          </button>
        </div>
        <p className="text-[11px] leading-4 text-slate-500">
          Dual-controlled: the request is parked for an authorizer before it runs. It never forks (the GitHub App
          token pushes a branch to the same repo) and never merges — the PR opens as a draft.
        </p>
      </div>
    </Card>
  );
}
