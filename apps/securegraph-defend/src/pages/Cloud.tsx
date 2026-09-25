import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Cloud as CloudIcon, Plus, Trash2, KeyRound, Copy, ExternalLink, RefreshCw, Zap,
  Plug, Activity, Radar, ShieldAlert, CheckCircle2, XCircle, Pause, Play, Search, Globe2,
} from "lucide-react";
import {
  PageHeader, Card, CardHeader, SeverityBadge, EmptyState, Modal, Spinner, StatCard, Tabs, PageSkeleton, ErrorState,
} from "@sg/ui";
import SecurityDbBanner from "@sg/components/SecurityDbBanner";
import CloudPosturePanel from "@sg/components/CloudPosturePanel";
import DocLink from "@sg/components/DocLink";
import { useResource } from "@sg/useResource";
import {
  loadCloudProviders, loadCloudConnectors, createCloudConnector, patchCloudConnector,
  rotateCloudSecret, deleteCloudConnector, cloudIngestUrl, loadIntelDashboard, loadCloudPosture,
  loadCloudPollers, syncCloudConnector,
} from "@sg/data";
import { useStore } from "@sg/store";
import { cx, timeAgo, titleCase, humanize } from "@sg/utils";
import type { CloudProvider, CloudConnector } from "@sg/types";
import { UpsellBanner } from "@sg/components/UpgradeGate";

// Human labels for the provider categories the backend registry emits.
const CATEGORY_LABEL: Record<string, string> = {
  cloud: "Cloud",
  vps: "VPS",
  hosting: "Hosting",
  managed_hosting: "Managed hosting",
  paas: "PaaS",
  cdn: "CDN",
  africa: "Africa",
  platform: "Platform",
  logs: "Logs",
  generic: "Generic",
};

function categoryLabel(category?: string): string {
  if (!category) return "Other";
  return CATEGORY_LABEL[category] ?? titleCase(category.replace(/_/g, " "));
}

function credentialLabel(key: string): string {
  return titleCase(key.replace(/_/g, " "));
}

export default function Cloud() {
  const { toast, requireDualControl } = useStore();
  const [tab, setTab] = useState("connectors");

  const providers = useResource<CloudProvider[]>(() => loadCloudProviders(), [], "cloud-providers");
  const connectors = useResource<CloudConnector[]>(() => loadCloudConnectors(), [], "cloud-connectors");
  const pollers = useResource(() => loadCloudPollers(), [], "cloud-pollers");
  const [syncing, setSyncing] = useState<number | null>(null);
  const intel = useResource<{ matched: number; unmatched: number }>(
    async () => {
      const d = await loadIntelDashboard();
      return { matched: d.matchedIocs ?? 0, unmatched: d.unmatchedIocs ?? 0 };
    },
    { matched: 0, unmatched: 0 },
    "cloud-intel-kpis",
  );

  // Posture capabilities — packs, exposure, TLS, host baselines, execution.
  const posture = useResource(() => loadCloudPosture(), null, "cloud-posture");

  // Add connector wizard
  const [addOpen, setAddOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<CloudProvider | null>(null);
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdResult, setCreatedResult] = useState<{ connector: CloudConnector; secret: string; url: string } | null>(null);

  // Secret reveal for existing connectors (rotate)
  const [secretMap, setSecretMap] = useState<Record<number, string>>({});

  // Provider picker: search + category filter + optional account credentials.
  const [providerQuery, setProviderQuery] = useState("");
  const [providerCategory, setProviderCategory] = useState("all");
  const [credentials, setCredentials] = useState<Record<string, string>>({});

  const pickProvider = (p: CloudProvider) => {
    setSelectedProvider(p);
    setLabel("");
    setCredentials({});
    setCreatedResult(null);
  };

  const create = async () => {
    if (!selectedProvider) return;
    if (!(await requireDualControl("Creating a connector requires a dual-control operate session."))) return;
    setCreating(true);
    try {
      const provided = Object.fromEntries(
        Object.entries(credentials).filter(([, value]) => value.trim()),
      );
      const body: Record<string, unknown> = {
        provider: selectedProvider.id,
        label: label || `${selectedProvider.name} connector`,
      };
      if (Object.keys(provided).length) {
        body.credentials = provided;
        body.mode = "account";
      }
      const res = await createCloudConnector(body);
      const secret = (res as any).webhookSecret || (res as any).webhook?.secret || `whsec_${crypto.randomUUID().replace(/-/g, "").slice(0, 32)}`;
      setCreatedResult({ connector: res, secret, url: cloudIngestUrl(res) });
      toast("success", "Connector created", "Copy the webhook secret now — it will not be shown again.");
      connectors.reload();
    } catch (e) {
      toast("error", "Create failed", e instanceof Error ? e.message : "");
    } finally {
      setCreating(false);
    }
  };

  const rotate = async (c: CloudConnector) => {
    if (!(await requireDualControl("Rotating a connector secret requires dual-control."))) return;
    try {
      const res = await rotateCloudSecret(c.id);
      setSecretMap((m) => ({ ...m, [c.id]: res.webhookSecret ?? "rotated" }));
      toast("success", "Secret rotated", "Copy it now — the previous one is revoked.");
      connectors.reload();
    } catch (e) {
      toast("error", "Rotate failed", e instanceof Error ? e.message : "");
    }
  };

  /** Live API pull for API-mode connectors (Contabo OAuth2, Hetzner/Vercel bearer). */
  const sync = async (c: CloudConnector) => {
    if (!(await requireDualControl("Polling a provider API requires dual-control."))) return;
    setSyncing(c.id);
    try {
      const res = await syncCloudConnector(c.id);
      const n = Number((res as { accepted?: number })?.accepted ?? 0);
      toast("success", "Provider polled", `${n} event(s) ingested from ${humanize(c.provider)}.`);
      connectors.reload();
    } catch (e) {
      toast("error", "Poll failed", e instanceof Error ? e.message : "");
    } finally {
      setSyncing(null);
    }
  };

  const toggle = async (c: CloudConnector) => {
    if (!(await requireDualControl("Toggling a connector requires dual-control."))) return;
    const previous = connectors.data;
    try {
      const nextActive = !(c.is_active ?? c.active ?? true);
      connectors.setData((list) => list.map((x) => (x.id === c.id ? { ...x, is_active: nextActive, active: nextActive } : x)));
      await patchCloudConnector(c.id, { is_active: nextActive, active: nextActive });
      toast("success", nextActive ? "Connector enabled" : "Connector paused");
      connectors.reload();
    } catch (e) {
      connectors.setData(previous as CloudConnector[]);
      toast("error", "Update failed", e instanceof Error ? e.message : "");
    }
  };

  const remove = async (c: CloudConnector) => {
    if (!(await requireDualControl("Deleting a connector requires dual-control."))) return;
    const previous = connectors.data;
    connectors.setData((list) => list.filter((x) => x.id !== c.id));
    try {
      await deleteCloudConnector(c.id);
      toast("success", "Connector removed", c.label ?? c.provider);
      connectors.reload();
    } catch (e) {
      connectors.setData(previous as CloudConnector[]);
      toast("error", "Delete failed", e instanceof Error ? e.message : "");
    }
  };

  const copy = (text: string, what: string) => {
    navigator.clipboard?.writeText(text).then(() => toast("success", `${what} copied`)).catch(() => toast("info", `${what} — select to copy`, text));
  };

  const connectedCount = connectors.data.filter((c) => c.is_active ?? c.active ?? true).length;

  const providerCategories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of providers.data) {
      const key = p.category || p.kind || "other";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) =>
      categoryLabel(a[0]).localeCompare(categoryLabel(b[0])),
    );
  }, [providers.data]);

  const filteredProviders = useMemo(() => {
    const q = providerQuery.trim().toLowerCase();
    return providers.data
      .filter((p) => {
        const category = p.category || p.kind || "other";
        if (providerCategory !== "all" && category !== providerCategory) return false;
        if (!q) return true;
        return `${p.name} ${p.id} ${p.description ?? ""} ${category}`.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        // Africa-local hosts first, then category, then name — the ICP default.
        if (Boolean(b.africa) !== Boolean(a.africa)) return a.africa ? -1 : 1;
        const ca = categoryLabel(a.category || a.kind);
        const cb = categoryLabel(b.category || b.kind);
        if (ca !== cb) return ca.localeCompare(cb);
        return a.name.localeCompare(b.name);
      });
  }, [providers.data, providerQuery, providerCategory]);

  const accountCredentialKeys = selectedProvider?.credentialKeys ?? [];

  if (providers.loading && !providers.data.length && !connectors.data.length) {
    return <PageSkeleton variant="cards" rows={4} actions />;
  }

  if (providers.error && !providers.data.length && !connectors.data.length) {
    return (
      <ErrorState
        onRetry={providers.reload}
        body="We could not load cloud security connectors. Check your connection and retry — your session stays signed in."
      />
    );
  }

  const emptyState = !connectors.data.length;

  return (
    <div>
      <PageHeader
        title="Cloud Security"
        description="Cloud, VPS, and PaaS connectors, log drains, and org-scoped threat intel."
        actions={
          <div className="flex items-center gap-2">
            <DocLink docId="howto-app-18" label="Cloud posture how-to" />
            <button type="button" className="btn-ghost text-sm px-3 py-1.5" onClick={() => { connectors.reload(); intel.reload(); providers.reload(); }} title="Refresh"><RefreshCw size={14} /></button>
            <a href="/threat-intel" className="btn-secondary text-sm px-3 py-1.5"><Radar size={14} /> Open Threat Intel</a>
            <button type="button" className="btn-primary text-sm px-3 py-1.5" onClick={() => { setAddOpen(true); setSelectedProvider(null); setCreatedResult(null); }}><Plus size={14} /> Add connector</button>
          </div>
        }
      />

      <UpsellBanner feature="cloud_security_scan" />

      {emptyState && (
        <Card className="mb-5">
          <EmptyState
            icon={<Plug size={24} />}
            title="Connect a webhook"
            body="Connect a cloud, VPS, or PaaS webhook. Telemetry is stored in your security database and correlated against inventory."
            action={<button className="btn-primary !py-2 text-sm" onClick={() => { setAddOpen(true); setSelectedProvider(null); setCreatedResult(null); }}><Plus size={14} /> Add connector</button>}
          />
        </Card>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Connectors" value={<span className="text-phantix-300 tabular-nums">{connectedCount}/{connectors.data.length}</span>} icon={<Plug size={18} />} accent="blue" />
        <StatCard label="Matched IOCs" value={<span className="text-gold-400 tabular-nums">{intel.data.matched}</span>} icon={<Radar size={18} />} />
        <StatCard label="Unmatched IOCs" value={<span className="text-white tabular-nums">{intel.data.unmatched}</span>} icon={<Activity size={18} />} />
        <StatCard label="Events (24h)" value={<span className="text-white tabular-nums">{/* placeholder */}—</span>} icon={<Activity size={18} />} />
        <StatCard label="Open detections" value={<span className="text-severity-critical tabular-nums">—</span>} icon={<ShieldAlert size={18} />} accent="red" />
      </div>

      <CloudPosturePanel posture={posture.data} loading={posture.loading} error={posture.error} onRetry={posture.reload} />

      <Tabs
        tabs={[
          { id: "connectors", label: "Connectors", count: connectors.data.length },
          { id: "events", label: "Live events" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "connectors" && (
        <div className="space-y-4">
          {connectors.data.length === 0 ? (
            <Card>
              <EmptyState icon={<CloudIcon size={24} />} title="No connectors" body="Pick a provider to connect a webhook / log drain." />
            </Card>
          ) : (
            <Card className="!p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-phantix-700/40">
                      <th className="th">Label</th>
                      <th className="th">Provider</th>
                      <th className="th">Status</th>
                      <th className="th">Ingest URL</th>
                      <th className="th">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {connectors.data.map((c) => {
                      const active = c.is_active ?? c.active ?? true;
                      return (
                        <React.Fragment key={c.id}>
                          <tr className="border-b border-phantix-800/40 hover:bg-phantix-800/35">
                            <td className="td">
                              <div className="flex items-center gap-2">
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-phantix-800 text-phantix-300"><CloudIcon size={14} /></span>
                                <span className="font-medium text-slate-100">{c.label || c.provider}</span>
                              </div>
                            </td>
                            <td className="td text-xs text-slate-400">{humanize(c.provider)}</td>
                            <td className="td">
                              <span className={cx("chip text-[12px]", active ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-phantix-700/50 text-slate-500")}>
                                {active ? <><CheckCircle2 size={10} /> Active</> : <><Pause size={10} /> Paused</>}
                              </span>
                            </td>
                            <td className="td max-w-[220px]">
                              {cloudIngestUrl(c) ? (
                                <p className="font-mono text-[12px] text-phantix-300 truncate">{cloudIngestUrl(c)}</p>
                              ) : (
                                <span className="text-xs text-slate-500">—</span>
                              )}
                            </td>
                            <td className="td">
                              <div className="flex flex-wrap gap-1.5">
                                <button className="btn-ghost p-1.5 text-xs" title={active ? "Pause" : "Enable"} onClick={() => void toggle(c)}>{active ? <Pause size={13} /> : <Play size={13} />}</button>
                                <button className="btn-ghost p-1.5 text-xs text-phantix-300" title="Poll provider API now (read-only)" disabled={syncing === c.id} onClick={() => void sync(c)}><RefreshCw size={13} className={syncing === c.id ? "animate-spin" : undefined} /></button>
                                <button className="btn-ghost p-1.5 text-xs text-gold-400" title="Rotate secret" onClick={() => void rotate(c)}><KeyRound size={13} /></button>
                                <button className="btn-ghost p-1.5 text-xs text-slate-400" title="Copy ingest URL" onClick={() => copy(cloudIngestUrl(c), "Ingest URL")}><Copy size={13} /></button>
                                <button className="btn-ghost p-1.5 text-xs text-severity-critical" title="Delete" onClick={() => void remove(c)}><Trash2 size={13} /></button>
                              </div>
                            </td>
                          </tr>
                          {secretMap[c.id] && (
                            <tr className="border-b border-phantix-800/40 bg-gold-400/[0.04]">
                              <td className="td" colSpan={5}>
                                <div className="rounded-lg border border-gold-400/30 bg-gold-400/8 p-2.5">
                                  <p className="text-[12px] font-semibold text-gold-300 mb-0.5">Webhook secret — copy now</p>
                                  <div className="flex items-center gap-2">
                                    <code className="flex-1 font-mono text-[12px] text-slate-200 break-all">{secretMap[c.id]}</code>
                                    <button className="btn-ghost p-1" onClick={() => copy(secretMap[c.id], "Webhook secret")}><Copy size={12} /></button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {tab === "events" && (
        <Card>
          <EmptyState
            icon={<Activity size={24} />}
            title="Live events"
            body="Connector events stream here once webhooks deliver telemetry. See Threat Intel for the IOC correlation board."
            action={<a href="/threat-intel" className="btn-secondary !py-2 text-sm"><Radar size={14} /> Open Threat Intel</a>}
          />
        </Card>
      )}

      {/* Add connector modal — provider picker → label → created (secret once) */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add cloud connector" wide>
        {createdResult ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-emerald-400/30 bg-emerald-400/8 px-4 py-3">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-400" />
              <div>
                <p className="text-sm font-semibold text-emerald-300">Connector created</p>
                <p className="mt-0.5 text-xs text-slate-400">Copy the secret now — it will not be shown again.</p>
              </div>
            </div>
            <div>
              <label className="label">Webhook secret</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg bg-phantix-950/70 border border-gold-400/30 px-3 py-2 font-mono text-xs text-gold-200 break-all">{createdResult.secret}</code>
                <button className="btn-secondary !px-3" onClick={() => copy(createdResult.secret, "Webhook secret")}><Copy size={14} /></button>
              </div>
            </div>
            <div>
              <label className="label">Ingest URL — enter into the provider (log drain / webhook)</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg bg-phantix-950/70 border border-phantix-700/40 px-3 py-2 font-mono text-[13px] text-phantix-300 break-all">{createdResult.url}</code>
                <button className="btn-secondary !px-3" onClick={() => copy(createdResult.url, "Ingest URL")}><Copy size={14} /></button>
              </div>
            </div>
            <p className="text-[13px] leading-5 text-slate-500">Vercel: use the secret as the signing secret (<code className="font-mono">x-vercel-signature</code>). GitHub: <code className="font-mono">X-Hub-Signature-256</code>. Others: <code className="font-mono">X-SecureGraph-Signature: sha256=&lt;hmac&gt;</code>.</p>
            <button className="btn-primary w-full" onClick={() => { setAddOpen(false); setCreatedResult(null); setSelectedProvider(null); }}>Done</button>
          </div>
        ) : (
          <div className="space-y-4">
            {!selectedProvider ? (
              <>
                <p className="text-xs text-slate-400">
                  Choose a provider to receive telemetry. {providers.data.length} providers available — filter by category or search.
                </p>
                <div className="relative">
                  <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    className="input pl-8"
                    placeholder="Search providers — Contabo, Hetzner, HostAfrica…"
                    value={providerQuery}
                    onChange={(e) => setProviderQuery(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setProviderCategory("all")}
                    className={cx("chip text-[13px]", providerCategory === "all" ? "border-phantix-400/50 bg-phantix-500/15 text-phantix-200" : "border-phantix-700/50 text-slate-400")}
                  >
                    All ({providers.data.length})
                  </button>
                  {providerCategories.map(([category, count]) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setProviderCategory(category)}
                      className={cx("chip text-[13px]", providerCategory === category ? "border-phantix-400/50 bg-phantix-500/15 text-phantix-200" : "border-phantix-700/50 text-slate-400")}
                    >
                      {categoryLabel(category)} ({count})
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {filteredProviders.map((p) => (
                    <button key={p.id} onClick={() => pickProvider(p)} className="text-left rounded-xl border border-phantix-700/40 bg-phantix-950/50 p-3 hover:border-phantix-500/50 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <p className="flex items-center gap-2 text-sm font-medium text-slate-100">
                          <CloudIcon size={15} className="text-phantix-300" /> {p.name}
                        </p>
                        {p.africa && <span className="chip shrink-0 text-[12px] border-emerald-400/30 bg-emerald-400/10 text-emerald-300"><Globe2 size={9} /> Africa</span>}
                      </div>
                      {p.description && <p className="mt-1 text-[13px] leading-4 text-slate-500">{p.description}</p>}
                      <div className="mt-2 flex flex-wrap gap-1">
                        <span className="chip text-[12px] border-phantix-700/50 text-slate-400">{categoryLabel(p.category || p.kind)}</span>
                        {p.accountCapable ? (
                          <span className="chip text-[12px] border-gold-400/30 bg-gold-400/10 text-gold-300"><KeyRound size={9} /> Account</span>
                        ) : (
                          <span className="chip text-[12px] border-phantix-700/50 text-slate-500"><Plug size={9} /> Webhook</span>
                        )}
                        {pollers.data.some((x) => x.provider === p.id && x.liveApi) && (
                          <span className="chip text-[12px] border-phantix-400/30 bg-phantix-400/10 text-phantix-200"><Zap size={9} /> Live API</span>
                        )}
                        {(p.engines ?? []).map((engine) => (
                          <span key={engine} className="chip text-[12px] border-phantix-700/50 text-slate-500">{engine}</span>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
                {filteredProviders.length === 0 && (
                  <p className="text-xs text-slate-500">
                    {providers.data.length === 0 ? "No providers loaded." : "No providers match that filter."}
                  </p>
                )}
              </>
            ) : (
              <div className="space-y-3">
                <button onClick={() => setSelectedProvider(null)} className="text-xs text-gold-300 hover:underline">← Back to providers</button>
                <div className="flex items-center justify-between gap-2 rounded-xl border border-phantix-700/40 bg-phantix-950/50 p-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium text-slate-100"><CloudIcon size={15} className="text-phantix-300" /> {selectedProvider.name}</p>
                    <p className="mt-0.5 text-[13px] text-slate-500">{selectedProvider.description}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="chip text-[12px] border-phantix-700/50 text-slate-400">{categoryLabel(selectedProvider.category || selectedProvider.kind)}</span>
                    {selectedProvider.accountCapable
                      ? <span className="chip text-[12px] border-gold-400/30 bg-gold-400/10 text-gold-300"><KeyRound size={9} /> Account + webhook</span>
                      : <span className="chip text-[12px] border-phantix-700/50 text-slate-500"><Plug size={9} /> Webhook only</span>}
                  </div>
                </div>
                <div><label className="label">Label</label><input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={`${selectedProvider.name} connector`} /></div>
                {accountCredentialKeys.length > 0 && (
                  <div className="space-y-2 rounded-xl border border-phantix-700/40 bg-phantix-950/40 p-3">
                    <p className="flex items-center gap-2 text-xs font-medium text-slate-200"><KeyRound size={13} className="text-gold-400" /> Account credentials <span className="font-normal text-slate-500">— optional, stored encrypted</span></p>
                    <p className="text-[13px] leading-5 text-slate-500">
                      Add a read-only credential to pull the account&apos;s audit/monitoring events. Leave blank to use the webhook only.
                    </p>
                    {accountCredentialKeys.map((key) => (
                      <div key={key}>
                        <label className="label">{credentialLabel(key)}</label>
                        <input
                          className="input font-mono text-xs"
                          type="password"
                          autoComplete="off"
                          spellCheck={false}
                          value={credentials[key] ?? ""}
                          onChange={(e) => setCredentials((c) => ({ ...c, [key]: e.target.value }))}
                          placeholder={`${selectedProvider.id} ${key}`}
                        />
                      </div>
                    ))}
                  </div>
                )}
                {selectedProvider.webhook && <p className="text-[13px] text-slate-500">Webhook: {selectedProvider.webhook.label}. {selectedProvider.webhook.ingestUrlHint && <>Setup hint: {selectedProvider.webhook.ingestUrlHint}.</>}</p>}
                <button className="btn-primary w-full" onClick={create} disabled={creating}>{creating ? <Spinner className="h-4 w-4" /> : <><Plus size={14} /> Create connector</>}</button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
