import React, { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Search, ShieldCheck, Boxes, Globe, Smartphone, Github, FileJson, Radar, Tag, Sparkles } from "lucide-react";
import { PageHeader, Card, CardHeader, StatusBadge, SeverityBadge, Modal, EmptyState, Tabs, ProgressBar, Spinner } from "@/components/ui";
import SecurityDbBanner from "@/components/SecurityDbBanner";
import { loadAssetsBundle, loadPrioritizedAssets, loadAssetIntelligence } from "@/lib/data";
import { useResource } from "@/lib/useResource";
import { timeAgo, titleCase, cx } from "@/lib/utils";
import { useStore } from "@/lib/store";
import type { Asset, AssetIntelligence } from "@/lib/types";

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
  const { data, loading } = useResource(loadAssetsBundle, {
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

  useEffect(() => {
    if (!selected) { setSelectedIntel(null); return; }
    let cancelled = false;
    loadAssetIntelligence(selected.id).then((i) => { if (!cancelled) setSelectedIntel(i); });
    return () => { cancelled = true; };
  }, [selected?.id]);

  const types = useMemo(() => ["all", ...Array.from(new Set(assets.map((a) => a.asset_type)))], [assets]);
  const filtered = assets.filter(
    (a) =>
      (typeFilter === "all" || a.asset_type === typeFilter) &&
      (a.value.toLowerCase().includes(q.toLowerCase()) || a.name.toLowerCase().includes(q.toLowerCase())),
  );

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
          <button
            className="btn-primary"
            onClick={() =>
              void (async () => {
                if (await requireDualControl("Adding assets requires a dual-control operate session.")) setAddOpen(true);
              })()
            }
          >
            <Plus size={15} /> Add asset
          </button>
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

            {filtered.length === 0 ? (
              <EmptyState icon={<Boxes size={22} />} title="No assets match" body="Adjust filters or add your first in-scope host." />
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-phantix-700/40">
                    <th className="th">Asset</th>
                    <th className="th">Type</th>
                    <th className="th">Criticality</th>
                    <th className="th">Tags</th>
                    <th className="th">Source</th>
                    <th className="th">Verified</th>
                    <th className="th">Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a, i) => (
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
                            <p className="text-xs text-slate-500">{a.name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="td"><span className="text-xs text-slate-400">{titleCase(a.asset_type)}</span></td>
                      <td className="td">
                        <span className={cx("text-xs font-semibold capitalize", a.criticality === "critical" ? "text-severity-critical" : a.criticality === "high" ? "text-severity-high" : a.criticality === "medium" ? "text-severity-medium" : "text-slate-400")}>
                          {a.criticality}
                        </span>
                      </td>
                      <td className="td">
                        <div className="flex flex-wrap gap-1">
                          {(a.tags ?? []).slice(0, 2).map((t) => (
                            <span key={t.id} className="rounded-md px-1.5 py-0.5 text-[10px] font-medium" style={{ background: `${t.color}22`, color: t.color }}>
                              {t.name}
                            </span>
                          ))}
                          {(a.tags?.length ?? 0) > 2 && <span className="text-[10px] text-slate-500">+{(a.tags?.length ?? 0) - 2}</span>}
                        </div>
                      </td>
                      <td className="td"><span className="font-mono text-xs text-slate-500">{a.source}</span></td>
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
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add asset">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setAddOpen(false);
            toast("success", "Asset submitted", "Domains queue an async domain_enum discovery job automatically.");
          }}
        >
          <div>
            <label className="label">Type</label>
            <select className="input">
              {["domain", "subdomain", "ip_address", "api", "web_app", "github_repo", "other"].map((t) => (
                <option key={t} value={t}>{titleCase(t)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Value</label>
            <input className="input font-mono" placeholder="api.example.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Environment</label>
              <select className="input"><option>production</option><option>staging</option></select>
            </div>
            <div>
              <label className="label">Criticality</label>
              <select className="input"><option>high</option><option>critical</option><option>medium</option><option>low</option></select>
            </div>
          </div>
          <label className="flex items-center gap-2.5 text-sm text-slate-300">
            <input type="checkbox" className="h-4 w-4 rounded accent-gold-400" /> I confirm ownership of this asset
          </label>
          <button className="btn-primary w-full">Create asset</button>
        </form>
      </Modal>
    </div>
  );
}
