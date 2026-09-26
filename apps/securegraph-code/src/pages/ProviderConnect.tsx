import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, CheckCircle2, Copy, ExternalLink, GitBranch, KeyRound, Loader2, RefreshCw,
  ShieldCheck, TestTube, Trash2, Webhook,
} from "lucide-react";
import { PageHeader, Card, CardHeader, EmptyState, Tabs, CardListSkeleton } from "@sg/ui";
import { API_BASE, api, isPendingApproval, publicErrorMessage } from "@sg/api";
import { loadGithubInstallation } from "@sg/codeOps";
import {
  loadHubCatalog,
  loadHubInstallations,
  installHubIntegration,
  startHubOAuth,
  uninstallHubIntegration,
  testHubInstallation,
} from "@sg/data";
import type { IntegrationConnector, IntegrationInstallation } from "@sg/types";
import { useStore } from "@sg/store";
import { cx, timeAgo, humanize } from "@sg/utils";
import DocLink from "@sg/components/DocLink";
import { SCM_PROVIDER_SETUP, SCM_WEBHOOK_PATH, providerTone, scmIcon } from "../scmProviders";

// ── Per-provider source-control connection page ──────────────────────────────
// GitHub, GitLab and Gitea each get their own page, reachable from Code →
// Providers. GitHub is an App install; GitLab/Gitea are Integrations Hub SCM
// connectors (OAuth2 or access token). All three land in the same branch-review
// pipeline, so the page differs only in setup, not in review behaviour.

function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  const v = value as { items?: T[]; connectors?: T[]; installations?: T[] } | null;
  return v?.items ?? v?.connectors ?? v?.installations ?? [];
}

export default function ProviderConnect() {
  const { provider = "" } = useParams<{ provider: string }>();
  const navigate = useNavigate();
  const { toast, requireDualControl } = useStore();
  const meta = SCM_PROVIDER_SETUP[provider];

  const [loading, setLoading] = useState(true);
  const [githubInst, setGithubInst] = useState<Record<string, unknown> | null>(null);
  const [catalog, setCatalog] = useState<IntegrationConnector[]>([]);
  const [installs, setInstalls] = useState<IntegrationInstallation[]>([]);
  const [mode, setMode] = useState("oauth2");
  const [label, setLabel] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [gh, cat, ins] = await Promise.all([
      loadGithubInstallation().catch(() => null),
      loadHubCatalog().catch(() => null),
      loadHubInstallations().catch(() => null),
    ]);
    setGithubInst((gh as Record<string, unknown>) ?? null);
    setCatalog(
      asArray<IntegrationConnector & { display_name?: string }>(cat).map((c) => ({
        ...c,
        name: c.name || c.display_name || c.connector_id,
      })),
    );
    setInstalls(asArray<IntegrationInstallation>(ins));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const connector = useMemo(
    () => catalog.find((c) => c.connector_id === provider) ?? null,
    [catalog, provider],
  );
  const providerInstalls = useMemo(
    () => installs.filter((i) => i.connector_id === provider),
    [installs, provider],
  );

  // Unknown provider id → back to the Providers hub.
  useEffect(() => {
    if (!loading && !meta) navigate("/code-review/providers", { replace: true });
  }, [loading, meta, navigate]);

  // Keep the auth mode valid for whichever connector loaded.
  useEffect(() => {
    const modes = connector?.auth_modes ?? [];
    if (modes.length && !modes.includes(mode)) setMode(modes[0]);
  }, [connector, mode]);

  if (!meta) return null;

  const isGithub = meta.kind === "app";
  const githubConnected = Boolean(
    githubInst?.connected || githubInst?.status === "active" || githubInst?.installation_id,
  );
  const activeCount = providerInstalls.filter((i) => i.status === "active").length;
  const connected = isGithub ? githubConnected : activeCount > 0;
  const webhookUrl = `${API_BASE}${SCM_WEBHOOK_PATH[provider] ?? ""}`;
  const steps = meta.setup.map((s) => s.replace("{API_BASE}", API_BASE));
  const needsToken = mode === "api_key";
  const authModes = connector?.auth_modes ?? ["oauth2", "api_key"];

  const copy = (text: string, what: string) =>
    navigator.clipboard
      ?.writeText(text)
      .then(() => toast("success", `${what} copied`))
      .catch(() => toast("info", `${what} — select to copy`, text));

  const connectGithub = useCallback(async () => {
    setBusy(true);
    try {
      const r = await api.get<{ install_url?: string }>("/github/install-url");
      if (r?.install_url) window.location.href = r.install_url;
      else toast("error", "GitHub install URL unavailable");
    } catch {
      toast("error", "Could not start GitHub install");
    } finally {
      setBusy(false);
    }
  }, [toast]);

  const connectConnector = useCallback(async () => {
    if (!connector) return;
    if (!label.trim()) {
      toast("error", "Label is required");
      return;
    }
    if (needsToken && !token.trim()) {
      toast("error", "An access token is required");
      return;
    }
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
        await load();
        return;
      }
      const id =
        (res as { installation_id?: number; id?: number })?.installation_id ??
        (res as { installation_id?: number; id?: number })?.id;
      if (mode === "oauth2" && id) {
        const start = await startHubOAuth(id);
        if (start?.authorize_url) {
          window.location.href = start.authorize_url;
          return;
        }
        toast("info", "Awaiting authorisation", "Continue the OAuth flow to finish connecting.");
      } else {
        toast("success", "Connected", `${meta.name} connected.`);
      }
      setLabel("");
      setToken("");
      await load();
    } catch (e: unknown) {
      const err = e as { message?: string; detail?: { message?: string } };
      toast("error", "Connect failed", publicErrorMessage(err, "Could not connect provider."));
    } finally {
      setBusy(false);
    }
  }, [connector, label, token, mode, needsToken, meta.name, toast, load]);

  const resumeOAuth = useCallback(
    async (installationId: number) => {
      try {
        const r = await startHubOAuth(installationId);
        if (r?.authorize_url) window.location.href = r.authorize_url;
        else toast("info", "Awaiting approval", "The OAuth start may be parked for an authorizer.");
      } catch {
        toast("error", "Could not start OAuth");
      }
    },
    [toast],
  );

  const disconnect = useCallback(
    async (install: IntegrationInstallation) => {
      if (!(await requireDualControl(`Disconnecting ${meta.name} requires dual-control.`))) return;
      const res = await uninstallHubIntegration(install.installation_id);
      await load();
      if (isPendingApproval(res)) {
        toast("info", "Sent for approval", `${install.label} disconnect is parked for an authorizer.`);
      } else {
        toast("success", "Disconnected", `${install.label} disconnected.`);
      }
    },
    [requireDualControl, meta.name, toast, load],
  );

  const test = useCallback(
    async (install: IntegrationInstallation) => {
      try {
        await testHubInstallation(install.installation_id);
        toast("info", "Test sent", "Integration health check completed.");
        await load();
      } catch {
        toast("error", "Test failed", "The connector did not respond.");
      }
    },
    [toast, load],
  );

  return (
    <div>
      <PageHeader
        title={`Connect ${meta.name}`}
        description={meta.tagline}
        actions={
          <>
            <DocLink docId="howto-app-21" label="Code security how-to" />
            <button onClick={() => void load()} className="btn-ghost text-xs !py-2" title="Refresh">
              <RefreshCw size={13} className={cx("inline", loading && "animate-spin")} />
            </button>
          </>
        }
      />

      <div className="mb-4">
        <Link to="/code-review/providers" className="-ml-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] text-slate-400 hover:bg-phantix-800/70 hover:text-slate-200">
          <ArrowLeft size={14} /> All providers
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className={cx("chip text-xs", connected ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-phantix-600/40 text-slate-400")}>
          <span className="mr-1 inline-flex align-middle">{scmIcon(provider, 12)}</span>
          {connected ? `${meta.name} connected` : `${meta.name} not connected`}
        </span>
        <span className="chip text-xs border-phantix-600/40 bg-phantix-800/50 text-slate-400">
          {meta.kind === "app" ? "GitHub App" : "Integrations Hub connector"}
        </span>
        {meta.capabilities.map((cap) => (
          <span key={cap} className="chip text-xs border-phantix-600/40 bg-phantix-800/50 text-slate-400">{cap}</span>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Connect / manage */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="h-full">
            <CardHeader
              title={`Connect ${meta.name}`}
              subtitle={meta.blurb}
              action={<span className="text-gold-300">{scmIcon(provider, 16)}</span>}
            />
            {loading ? (
              <CardListSkeleton rows={3} className="p-4" />
            ) : isGithub ? (
              <div className="space-y-4 p-4">
                <p className="text-sm leading-6 text-slate-300">
                  SecureGraph reviews every push to watched branches and opens <strong className="text-slate-100">draft pull requests</strong> for
                  verified fixes. No token is stored — access is granted through the App installation.
                </p>
                {!githubConnected ? (
                  <button className="btn-primary w-full" disabled={busy} onClick={() => void connectGithub()}>
                    {busy ? <Loader2 size={14} className="animate-spin" /> : scmIcon("github", 14)}
                    Install the GitHub App
                  </button>
                ) : (
                  <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-200">
                    <CheckCircle2 size={14} className="mr-1 inline" />
                    Installed{githubInst?.account_login ? ` on ${String(githubInst.account_login)}` : ""}.
                  </div>
                )}
                <a href={meta.docsUrl} target="_blank" rel="noreferrer" className="btn-secondary w-full">
                  <ExternalLink size={13} /> GitHub App documentation
                </a>
              </div>
            ) : (
              <div className="space-y-4 p-4">
                {authModes.length > 1 && (
                  <Tabs
                    tabs={authModes.map((m) => ({ id: m, label: humanize(m) }))}
                    active={mode}
                    onChange={setMode}
                  />
                )}
                <div>
                  <label className="label">Label</label>
                  <input
                    className="input"
                    placeholder={`e.g. ${meta.name} (production)`}
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                  />
                </div>
                {needsToken && (
                  <div>
                    <label className="label">{meta.tokenLabel ?? "Access token"}</label>
                    <textarea
                      className="input !min-h-[80px] font-mono !text-xs"
                      placeholder="Paste a token with repository read + merge-request write scope"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                    />
                    <p className="mt-1 text-[13px] text-slate-500">{meta.tokenHint} Stored encrypted and never shown again.</p>
                  </div>
                )}
                {!needsToken && (
                  <p className="text-[13px] leading-5 text-slate-500">
                    You will be redirected to {meta.name} to authorise SecureGraph, then returned here.
                  </p>
                )}
                <button className="btn-primary w-full" disabled={busy || !connector} onClick={() => void connectConnector()}>
                  {busy ? <Loader2 size={14} className="animate-spin" /> : needsToken ? <KeyRound size={14} /> : <ShieldCheck size={14} />}
                  {needsToken ? "Connect with token" : "Connect with OAuth2"}
                </button>
                {meta.tokenUrl && (
                  <a
                    href={meta.tokenUrl.startsWith("http") ? meta.tokenUrl : `${window.location.origin}${meta.tokenUrl}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-ghost w-full !text-xs"
                  >
                    <ExternalLink size={13} /> Where to create a token
                  </a>
                )}
              </div>
            )}
          </Card>
        </motion.div>

        {/* Setup checklist */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="h-full">
            <CardHeader title="Setup" subtitle="What to configure on the provider side" action={<Webhook size={16} className="text-gold-300" />} />
            <div className="space-y-3 p-4">
              <ol className="space-y-2 text-sm leading-6 text-slate-300">
                {steps.map((step, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-phantix-600/50 bg-phantix-800/60 text-[12px] font-semibold text-slate-300">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>

              <div className="rounded-lg border border-phantix-700/40 bg-phantix-950/60 p-2.5">
                <p className="mb-1 text-[12px] uppercase tracking-wider text-slate-500">Webhook URL</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate font-mono text-[12px] text-phantix-300">{webhookUrl}</code>
                  <button className="btn-ghost p-1" title="Copy webhook URL" onClick={() => copy(webhookUrl, "Webhook URL")}>
                    <Copy size={12} />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <span className="chip text-[12px] border-phantix-600/40 bg-phantix-800/50 text-slate-400">
                  Signature header: {meta.webhookSecretHeader}
                </span>
                {meta.webhookSecretEnv && (
                  <span className="chip text-[12px] border-phantix-600/40 bg-phantix-800/50 text-slate-400">
                    Secret env: {meta.webhookSecretEnv}
                  </span>
                )}
              </div>

              <div>
                <p className="mb-1 text-[12px] uppercase tracking-wider text-slate-500">Required scopes</p>
                <div className="flex flex-wrap gap-1.5">
                  {meta.scopes.map((s) => (
                    <span key={s} className="chip text-[12px] border-phantix-600/40 bg-phantix-800/50 text-slate-300">{s}</span>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Connected installations */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-5">
        <Card>
          <CardHeader
            title="Connections"
            subtitle={isGithub ? "The GitHub App installation for this organization" : "Installed connector instances"}
          />
          {loading ? (
            <CardListSkeleton rows={2} className="p-4" />
          ) : isGithub ? (
            githubConnected ? (
              <div className="flex items-center justify-between gap-3 p-4 text-sm text-slate-300">
                <span className="flex items-center gap-2">
                  <GitBranch size={14} className="text-emerald-400" />
                  {githubInst?.account_login ? `Installed on ${String(githubInst.account_login)}` : "GitHub App installed"}
                </span>
                <span className="chip text-[12px] border-emerald-400/30 bg-emerald-400/10 text-emerald-300">active</span>
              </div>
            ) : (
              <EmptyState
                icon={<GitBranch size={22} />}
                title="No installation"
                body="Install the GitHub App to review repositories and open draft pull requests."
              />
            )
          ) : providerInstalls.length === 0 ? (
            <EmptyState
              icon={<GitBranch size={22} />}
              title={`No ${meta.name} connections`}
              body={`Connect ${meta.name} above to import repositories and review merge requests.`}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-phantix-700/40">
                    <th className="th">Label</th>
                    <th className="th">Auth</th>
                    <th className="th">Status</th>
                    <th className="th">Last test</th>
                    <th className="th text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {providerInstalls.map((i) => (
                    <tr key={i.installation_id} className="border-b border-phantix-700/20 hover:bg-phantix-800/40">
                      <td className="td text-sm text-slate-200">{i.label}</td>
                      <td className="td text-xs text-slate-400">{humanize(i.auth_mode)}</td>
                      <td className="td"><span className={cx("chip text-[12px]", providerTone(i.status))}>{humanize(i.status)}</span></td>
                      <td className="td text-xs text-slate-500">
                        {i.last_test_at ? `${timeAgo(i.last_test_at)}${i.last_test_ok === false ? " · failed" : ""}` : "—"}
                      </td>
                      <td className="td text-right">
                        <div className="flex justify-end gap-1">
                          {i.status === "pending_auth" && (
                            <button className="btn-secondary !px-2 !py-1 !text-xs" onClick={() => void resumeOAuth(i.installation_id)}>
                              Finish auth
                            </button>
                          )}
                          {i.status === "active" && (
                            <button className="btn-ghost !px-2 !py-1 !text-xs" onClick={() => void test(i)}>
                              <TestTube size={12} /> Test
                            </button>
                          )}
                          <button className="btn-ghost !px-2 !py-1 !text-xs text-severity-critical" onClick={() => void disconnect(i)}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
