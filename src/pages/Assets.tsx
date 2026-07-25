import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Plus, Search, ShieldCheck, Boxes, Globe, Smartphone, Github, FileJson, Radar, Tag, Sparkles, RefreshCw } from "lucide-react";
import { PageHeader, Card, CardHeader, StatusBadge, SeverityBadge, Modal, EmptyState, Tabs, ProgressBar, Spinner } from "@/components/ui";
import SecurityDbBanner from "@/components/SecurityDbBanner";
import { loadAssetsBundle, loadPrioritizedAssets, loadAssetIntelligence } from "@/lib/data";
import { useResource } from "@/lib/useResource";
import { timeAgo, titleCase, cx } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import type { Asset, AssetIntelligence, DiscoveryJob } from "@/lib/types";

const typeIcon: Record<string, React.ReactNode> = {
  domain: <Globe size={15} />,
  subdomain: <Globe size={15} />,
  ip_address: <Radar size={15} />,
  github_repo: <Github size={15} />,
  api: <FileJson size={15} />,
  mobile_apk: <Smartphone size={15} />,
  web_app: <Globe size={15} />,
  port_service: <Radar size={15} />,
  database_connection: <Boxes size={15} />,
};

export default function Assets() {
  const { toast, requireDualControl } = useStore();
  const { data, loading, reload } = useResource(loadAssetsBundle, {
    assets: [],
    assetTags: [],
    discoveryJobs: [],
    securityDbBlocked: false,
    error: null,
  });
  const { data: prioritized } = useResource(loadPrioritizedAssets, []);
  const { assets, assetTags, discoveryJobs, securityDbBlocked, error: loadError } = data;
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [tab, setTab] = useState("inventory");
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState<Asset | null>(null);
  const [selectedIntel, setSelectedIntel] = useState<AssetIntelligence | null>(null);
  const [verifyStep, setVerifyStep] = useState<{ message: string; hint: string } | null>(null);
  const [addConfirmOwnership, setAddConfirmOwnership] = useState(false);
  const [addForm, setAddForm] = useState({ type: "domain", value: "", name: "", environment: "production", criticality: "medium" });
  const [adding, setAdding] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!selected) { setSelectedIntel(null); return; }
    let cancelled = false;
    loadAssetIntelligence(selected.id).then((i) => { if (!cancelled) setSelectedIntel(i); });
    return () => { cancelled = true; };
  }, [selected?.id]);

  // Merge discovery status into asset rows
  const assetsWithDiscovery = useMemo(() => {
    return assets.map((a) => {
      const job = discoveryJobs.find(
        (j: DiscoveryJob) => {
          const domain = (j.config as any)?.domain || (j.config as any)?.target || "";
          return domain.toLowerCase() === (a.value || "").toLowerCase();
        }
      );
      return { ...a, discoveryStatus: job?.status as string | undefined, discoveryJobId: job?.id };
    });
  }, [assets, discoveryJobs]);

  // Auto-poll discovery when active jobs exist
  const activeJobs = useMemo(() =>
    discoveryJobs.filter((j: DiscoveryJob) => ["pending", "queued", "running"].includes(j.status)),
    [discoveryJobs]
  );

  const pollDiscovery = useCallback(async () => {
    try {
      const raw = await api.get<any>("/assets/discovery/jobs?limit=30");
      const jobs = Array.isArray(raw) ? raw : (raw?.items ?? raw?.value ?? []);
      const stillActive = jobs.filter((j: any) => ["pending", "queued", "running"].includes(j.status));
      if (stillActive.length === 0) {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        reload();
      }
    } catch { /* silent */ }
  }, [reload]);

  useEffect(() => {
    if (activeJobs.length > 0 && !pollRef.current) {
      pollRef.current = setInterval(pollDiscovery, 3000);
    } else if (activeJobs.length === 0 && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [activeJobs.length, pollDiscovery]);

  const types = useMemo(() => ["all", ...Array.from(new Set(assets.map((a) => a.asset_type)))], [assets]);

  const handleAddAsset = async () => {
    if (!addForm.value) { toast("error", "Enter a value"); return; }
    if (!(await requireDualControl("Adding assets requires a dual-control operate session."))) return;
    setAdding(true);
    setVerifyStep(null);
    try {
      await api.post("/assets", {
        asset_type: addForm.type,
        value: addForm.value.trim(),
        name: addForm.name || addForm.value.trim(),
        environment: addForm.environment,
        criticality: addForm.criticality,
        confirm_ownership: addConfirmOwnership,
      });
      toast("success", "Asset added", "Discovery queued in background");
      setAddOpen(false);
      setAddConfirmOwnership(false);
      setVerifyStep(null);
      setAddForm({ type: "domain", value: "", name: "", environment: "production", criticality: "medium" });
      reload();
    } catch (e: any) {
      if (e.status === 422 && e.detail?.verification) {
        setVerifyStep({
          message: e.detail.message || "Domain verification required",
          hint: e.detail.verification?.hint || "Check the domain and confirm ownership",
        });
      } else {
        toast("error", "Failed", e.message || "Could not add asset");
      }
    } finally {
      setAdding(false);
    }
  };

  const handleRunDiscovery = async (domain: string) => {
    if (!(await requireDualControl("Starting discovery requires a dual-control operate session."))) return;
    try {
      await api.post("/assets/discovery/jobs", {
        job_type: "domain_enum",
        config: { domain, include_subdomains: true, include_directories: true },
        run_inline: false,
      });
      toast("success", "Discovery started", `Enumerating ${domain}`);
      reload();
    } catch (e: any) {
      toast("error", "Discovery failed", e.message || "");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-slate-400">
        <Spinner className="h-5 w-5" /> Loading assets…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      {securityDbBlocked && <SecurityDbBanner message={loadError} />}
      <PageHeader
        title="Attack-surface inventory"
        description="Every row lives only in your dedicated security database — schema phantix, version 1.4.2. Discovery is gated: HTTP 404s and dead hosts never enter inventory."
        actions={
          <div className="flex items-center gap-2">
            <button
              className="btn-ghost text-sm px-3 py-1.5"
              onClick={() => reload()}
              disabled={loading}
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              className="btn-primary"
              onClick={() =>
                void (async () => {
                  if (await requireDualControl("Adding assets requires a dual-control operate session.")) {
                    setVerifyStep(null);
                    setAddConfirmOwnership(false);
                    setAddOpen(true);
                  }
                })()
              }
            >
              <Plus size={15} /> Add asset
            </button>
          </div>
        }
      />

      <Tabs
        tabs={[
          { id: "inventory", label: "Inventory", count: assets.length },
          { id: "prioritized", label: "Prioritized", count: prioritized?.length ?? 0 },
          { id: "discovery", label: "Discovery jobs", count: discoveryJobs.length },
          { id: "tags", label: "Tags", count: assetTags.length },
          { id: "imports", label: "Imports" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "prioritized" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="!p-0 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-phantix-700/40 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3 font-medium">Asset</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">Risk score</th>
                  <th className="px-5 py-3 font-medium">Risk level</th>
                  <th className="px-5 py-3 font-medium">Exposure</th>
                  <th className="px-5 py-3 font-medium">Findings</th>
                </tr>
              </thead>
              <tbody>
                {prioritized!.map((a, i) => (
                  <tr key={a.id} className={cx("border-b border-phantix-800/40 hover:bg-phantix-800/35 text-sm", i % 2 === 1 && "bg-phantix-950/30")}>
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-200">{a.name || a.value}</p>
                      <p className="text-xs text-slate-500 font-mono">{a.value}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className="chip text-xs">{titleCase(a.asset_type)}</span>
                    </td>
                    <td className="px-5 py-3 font-mono text-sm">
                      <span className={cx(a.risk_score >= 75 ? "text-severity-critical" : a.risk_score >= 50 ? "text-severity-high" : a.risk_score >= 25 ? "text-severity-medium" : "text-severity-low")}>
                        {a.risk_score}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <SeverityBadge severity={a.risk_level as never} />
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-400">{titleCase(a.exposure)}</td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-400">{a.open_findings}</td>
                  </tr>
                ))}
                {(!prioritized || prioritized.length === 0) && (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-500">No prioritized assets yet — run scans to populate risk data.</td></tr>
                )}
              </tbody>
            </table>
          </Card>
        </motion.div>
      )}

      {tab === "inventory" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="!p-0 overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 border-b border-phantix-700/40 p-4">
              <div className="relative w-72">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input className="input !pl-10" placeholder="Search value or name…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {types.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    className={cx(
                      "rounded-lg px-2.5 py-1.5 text-xs font-medium capitalize transition-colors",
                      typeFilter === t ? "bg-gold-400/15 text-gold-300 border border-gold-400/30" : "text-slate-400 hover:bg-phantix-800/60 border border-transparent",
                    )}
                  >
                    {titleCase(t)}
                  </button>
                ))}
              </div>
            </div>

            {assetsWithDiscovery.filter(
              (a) =>
                (typeFilter === "all" || a.asset_type === typeFilter) &&
                (a.value.toLowerCase().includes(q.toLowerCase()) || a.name.toLowerCase().includes(q.toLowerCase())),
            ).length === 0 ? (
              <EmptyState icon={<Boxes size={22} />} title="No assets match" body="Adjust filters or add your first in-scope host." />
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-phantix-700/40">
                    <th className="th">Asset</th>
                    <th className="th">Type</th>
                    <th className="th">Discovery</th>
                    <th className="th">Criticality</th>
                    <th className="th">Verified</th>
                    <th className="th">Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {assetsWithDiscovery.filter(
                    (a) =>
                      (typeFilter === "all" || a.asset_type === typeFilter) &&
                      (a.value.toLowerCase().includes(q.toLowerCase()) || a.name.toLowerCase().includes(q.toLowerCase())),
                  ).map((a, i) => (
                    <motion.tr
                      key={a.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => setSelected(a)}
                      className="cursor-pointer border-b border-phantix-800/40 transition-colors hover:bg-phantix-800/35"
                    >
                      <td className="td">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-phantix-800/70 text-phantix-300">
                            {typeIcon[a.asset_type] ?? <Boxes size={15} />}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-200">{a.value}</p>
                            <p className="text-xs text-slate-500">{a.name || a.asset_type}</p>
                          </div>
                        </div>
                      </td>
                      <td className="td"><span className="text-xs text-slate-400">{titleCase(a.asset_type)}</span></td>
                      <td className="td">
                        {a.discoveryStatus ? (
                          <span className="flex items-center gap-1.5">
                            <span className={cx("h-1.5 w-1.5 rounded-full", a.discoveryStatus === "running" ? "bg-blue-400 animate-pulse-soft" : a.discoveryStatus === "completed" ? "bg-emerald-400" : a.discoveryStatus === "failed" ? "bg-severity-critical" : "bg-slate-500")} />
                            <StatusBadge status={a.discoveryStatus} />
                          </span>
                        ) : (
                          <span className="text-xs text-slate-600">—</span>
                        )}
                      </td>
                      <td className="td">
                        <span className={cx("text-xs font-semibold capitalize", a.criticality === "critical" ? "text-severity-critical" : a.criticality === "high" ? "text-severity-high" : a.criticality === "medium" ? "text-severity-medium" : "text-slate-400")}>
                          {a.criticality}
                        </span>
                      </td>
                      <td className="td">
                        {a.is_verified ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-400"><ShieldCheck size={13} /> Verified</span>
                        ) : (
                          <span className="text-xs text-severity-medium">Unverified</span>
                        )}
                      </td>
                      <td className="td"><span className="text-xs text-slate-500">{timeAgo(a.last_seen_at)}</span></td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </motion.div>
      )}

      {tab === "discovery" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-400">
              {activeJobs.length > 0 ? (
                <span className="flex items-center gap-2"><Spinner className="h-3 w-3" /> {activeJobs.length} active job{activeJobs.length > 1 ? "s" : ""}</span>
              ) : (
                "No active discovery jobs"
              )}
            </p>
          </div>
          {discoveryJobs.map((j) => (
            <Card key={j.id} hover>
              <div className="flex flex-wrap items-center gap-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-phantix-800/70 text-gold-400">
                  <Radar size={17} className={j.status === "running" ? "animate-pulse-soft" : ""} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5">
                    <p className="font-medium text-slate-200">{titleCase(j.job_type)} · #{j.id}</p>
                    <StatusBadge status={j.status} />
                  </div>
                  <p className="mt-0.5 font-mono text-xs text-slate-500">{JSON.stringify(j.config)}</p>
                </div>
                {j.result_summary && (
                  <div className="flex gap-4 text-center">
                    {Object.entries(j.result_summary).map(([k, v]) => (
                      <div key={k}>
                        <p className="font-display text-lg font-bold text-white">{String(v)}</p>
                        <p className="text-[10px] uppercase tracking-wider text-slate-500">{titleCase(k)}</p>
                      </div>
                    ))}
                  </div>
                )}
                <span className="text-xs text-slate-500">{timeAgo(j.created_at)}</span>
              </div>
              {j.status === "running" && <div className="mt-3"><ProgressBar value={64} color="#38BDF8" /></div>}
            </Card>
          ))}
          <p className="text-xs text-slate-500">
            domain_enum runs subfinder + amass, ffuf/gobuster directory brute force, then upserts verified
            subdomains, web apps and API endpoints only. Prefer run_inline=false so Cloudflare doesn't 504.
          </p>
        </motion.div>
      )}

      {tab === "tags" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assetTags.map((t) => (
            <Card key={t.id} hover>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${t.color}1f`, color: t.color }}>
                  <Tag size={16} />
                </span>
                <div>
                  <p className="font-medium text-slate-200">{t.name}</p>
                  <p className="text-xs text-slate-500">{t.asset_count} assets{t.description ? ` · ${t.description}` : ""}</p>
                </div>
              </div>
            </Card>
          ))}
          <Card className="flex items-center justify-center border-dashed">
            <button
              className="btn-ghost text-slate-400"
              onClick={() =>
                void (async () => {
                  if (!(await requireDualControl("Creating asset tags requires a dual-control operate session."))) return;
                  toast("info", "Tag creation", "POST /asset-tags");
                })()
              }
            >
              <Plus size={15} /> New tag
            </button>
          </Card>
        </motion.div>
      )}

      {tab === "imports" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            { icon: <Github size={18} />, title: "GitHub repositories", desc: "Store a PAT (Fernet-encrypted) and import repos as github_repo assets.", endpoint: "POST /assets/import/github" },
            { icon: <FileJson size={18} />, title: "OpenAPI / Postman", desc: "Import a spec; endpoints are categorized into metadata for API assets.", endpoint: "POST /assets/import/api" },
            { icon: <Smartphone size={18} />, title: "Android APK", desc: "Upload an APK — static analysis maps a mobile_apk asset with permissions.", endpoint: "POST /assets/upload/apk" },
          ].map((c) => (
            <Card key={c.title} hover className="flex flex-col">
              <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-phantix-800/70 text-gold-400">{c.icon}</span>
              <h3 className="font-display text-[15px] font-semibold text-slate-100">{c.title}</h3>
              <p className="mt-1.5 flex-1 text-[13px] leading-6 text-slate-400">{c.desc}</p>
              <p className="mt-3 font-mono text-[11px] text-slate-500">{c.endpoint}</p>
              <button
                className="btn-secondary mt-4 w-full"
                onClick={() =>
                  void (async () => {
                    if (!(await requireDualControl(`${c.title} requires a dual-control operate session.`))) return;
                    toast("info", c.title, c.endpoint);
                  })()
                }
              >
                Import
              </button>
            </Card>
          ))}
        </motion.div>
      )}

      {/* Asset detail modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.value ?? ""} wide>
        {selected && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              {selected.is_verified && <span className="chip border-emerald-400/30 bg-emerald-400/10 text-emerald-300"><ShieldCheck size={12} /> {selected.verification_method ?? "verified"}</span>}
              <span className="chip border-phantix-600/50 bg-phantix-800/60 text-slate-300">{titleCase(selected.asset_type)}</span>
              <span className="chip border-phantix-600/50 bg-phantix-800/60 text-slate-300 capitalize">{selected.environment}</span>
              <span className="chip border-severity-high/30 bg-severity-high/10 text-severity-high capitalize">{selected.criticality} criticality</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              {[
                ["Asset ID", `#${selected.id}`],
                ["Source", selected.source],
                ["First seen", timeAgo(selected.first_discovered_at)],
                ["Last seen", timeAgo(selected.last_seen_at)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-phantix-950/60 border border-phantix-700/40 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">{k}</p>
                  <p className="mt-1 font-medium text-slate-200">{v}</p>
                </div>
              ))}
            </div>
            <div>
              <p className="label">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {(selected.tags?.length ?? 0) ? selected.tags!.map((t) => (
                  <span key={t.id} className="rounded-lg px-2 py-1 text-xs font-medium" style={{ background: `${t.color}22`, color: t.color }}>{t.name}</span>
                )) : <span className="text-sm text-slate-500">No manual tags — auto-tags (type/source/verified) apply.</span>}
              </div>
            </div>
            {selectedIntel && (
              <>
                <div>
                  <p className="label">Intelligence</p>
                  <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                    {[
                      ["Risk score", String(selectedIntel.risk_score)],
                      ["Risk level", selectedIntel.risk_level],
                      ["Open findings", String(selectedIntel.open_findings_count)],
                      ["Exposure", selectedIntel.exposure_level],
                    ].map(([k, v]) => (
                      <div key={k} className="rounded-xl bg-phantix-950/60 border border-phantix-700/40 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-slate-500">{k}</p>
                        <p className="mt-1 font-medium text-slate-200 capitalize">{v}</p>
                      </div>
                    ))}
                  </div>
                  {selectedIntel.posture_summary && (
                    <div className="mt-3 rounded-xl border border-gold-400/20 bg-gold-400/5 p-3.5 text-xs leading-5 text-slate-300">
                      <p className="mb-1 font-medium text-gold-300"><Sparkles size={12} className="inline mr-1" />Posture summary</p>
                      {selectedIntel.posture_summary}
                    </div>
                  )}
                </div>
                {selectedIntel.recommended_actions.length > 0 && (
                  <div>
                    <p className="label">Recommended actions</p>
                    <div className="space-y-2">
                      {selectedIntel.recommended_actions.map((ra) => (
                        <div key={ra.action_key} className="flex items-start gap-3 rounded-xl border border-phantix-700/40 bg-phantix-950/50 px-4 py-3">
                          <SeverityBadge severity={ra.priority as never} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-200">{ra.label}</p>
                            <p className="text-xs text-slate-500">{ra.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
            <div className="flex gap-2.5">
              <button
                className="btn-primary flex-1"
                onClick={() =>
                  void (async () => {
                    if (!(await requireDualControl("Asset verification requires a dual-control operate session."))) return;
                    toast("success", "Verification queued", `POST /assets/${selected.id}/verify`);
                  })()
                }
              >
                Re-verify ownership
              </button>
              <button className="btn-secondary" onClick={() => toast("info", "History", "asset_history tracks every change in your security DB.")}>
                View history
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add asset modal */}
      <Modal open={addOpen} onClose={() => { setAddOpen(false); setVerifyStep(null); }} title="Add asset">
        <div className="space-y-4">
          {verifyStep && (
            <div className="rounded-lg bg-severity-medium/10 border border-severity-medium/30 p-3 text-xs space-y-2">
              <p className="text-severity-medium font-semibold">Verification Required</p>
              <p className="text-slate-300">{verifyStep.message}</p>
              <p className="text-slate-500">{verifyStep.hint}</p>
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={addConfirmOwnership}
                  onChange={(e) => setAddConfirmOwnership(e.target.checked)}
                  className="rounded accent-gold-400"
                />
                I confirm my organization owns this asset
              </label>
              <button onClick={handleAddAsset} disabled={adding || !addConfirmOwnership} className="btn-primary w-full text-sm">
                {adding && <Spinner className="h-3 w-3" />} Retry with confirmation
              </button>
              <button onClick={() => setVerifyStep(null)} className="btn-ghost w-full text-xs">Cancel</button>
            </div>
          )}

          {!verifyStep && (
            <>
              <div>
                <label className="label">Type</label>
                <select className="input" value={addForm.type} onChange={(e) => setAddForm((f) => ({ ...f, type: e.target.value }))}>
                  {["domain", "subdomain", "ip_address", "api", "web_app", "github_repo", "other"].map((t) => (
                    <option key={t} value={t}>{titleCase(t)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Value</label>
                <input className="input font-mono" placeholder="api.example.com" value={addForm.value} onChange={(e) => setAddForm((f) => ({ ...f, value: e.target.value, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Environment</label>
                  <select className="input" value={addForm.environment} onChange={(e) => setAddForm((f) => ({ ...f, environment: e.target.value }))}>
                    <option>production</option><option>staging</option>
                  </select>
                </div>
                <div>
                  <label className="label">Criticality</label>
                  <select className="input" value={addForm.criticality} onChange={(e) => setAddForm((f) => ({ ...f, criticality: e.target.value }))}>
                    <option>high</option><option>critical</option><option>medium</option><option>low</option>
                  </select>
                </div>
              </div>
              <div className="text-xs text-slate-500 p-2 rounded-lg bg-phantix-800/40">
                Domains/subdomains are verified against your organization name. Discovery runs automatically in the background after a successful add.
              </div>
              <button onClick={handleAddAsset} disabled={adding || !addForm.value} className="btn-primary w-full">
                {adding ? <Spinner className="h-4 w-4" /> : null}
                Create asset
              </button>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
