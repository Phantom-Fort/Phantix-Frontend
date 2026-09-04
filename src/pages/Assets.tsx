import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Plus, Search, ShieldCheck, Boxes, Globe, Smartphone, Github, FileJson, Radar, Tag, Sparkles, RefreshCw, KeyRound } from "lucide-react";
import { PageHeader, Card, CardHeader, StatusBadge, SeverityBadge, Modal, EmptyState, Tabs, ProgressBar, Spinner, PageSkeleton, ErrorState } from "@/components/ui";
import SecurityDbBanner from "@/components/SecurityDbBanner";
import DocLink from "@/components/DocLink";
import { loadAssetsBundle, loadPrioritizedAssets, loadAssetIntelligence } from "@/lib/data";
import { useResource } from "@/lib/useResource";
import { timeAgo, titleCase, cx } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { api, tokens, API_BASE } from "@/lib/api";
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

/** Tier badge for discovery-tiered assets (metadata.tier / metadata.priority). */
function assetTierBadge(a: Asset | null | undefined): { label: string; cls: string } | null {
  const md = a?.metadata ?? ({} as Record<string, unknown>);
  const raw = md.tier ?? md.priority ?? "";
  const t = String(raw).toLowerCase();
  if (t === "high") return { label: "High tier", cls: "border-gold-400/30 bg-gold-400/10 text-gold-300" };
  if (t === "medium") return { label: "Medium tier", cls: "border-severity-medium/30 bg-severity-medium/10 text-severity-medium" };
  if (t === "low") return { label: "Low tier", cls: "border-slate-500/30 bg-slate-500/10 text-slate-400" };
  if (t === "true" || t === "1") return { label: "Priority", cls: "border-gold-400/30 bg-gold-400/10 text-gold-300" };
  return null;
}

/** Read a local file to text (JSON/YAML API specs). */
function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read the selected file"));
    reader.readAsText(file);
  });
}

export default function Assets() {
  const { toast, requireDualControl } = useStore();
  const { data, loading, error, reload } = useResource(loadAssetsBundle, {
    assets: [],
    assetTags: [],
    discoveryJobs: [],
    securityDbBlocked: false,
    error: null,
  }, "assets");
  const { data: prioritized } = useResource(loadPrioritizedAssets, [], "prioritized_assets");
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
  const [showGithubModal, setShowGithubModal] = useState(false);
  const [githubMethod, setGithubMethod] = useState<"pat" | "app">("pat");
  const [githubPat, setGithubPat] = useState("");
  const [importingGithub, setImportingGithub] = useState(false);
  const [githubStatus, setGithubStatus] = useState<{ github_login?: string; token_configured?: boolean } | null>(null);
  const [githubAppStatus, setGithubAppStatus] = useState<{ connected?: boolean; account_login?: string; status?: string; message?: string } | null>(null);
  // Latest GitHub analysis scan job returned by POST /assets/import/github
  // (GITHUB_ANALYSIS_SCAN_JOB_FE.md) — a separate job family from network scans.
  const [githubAnalysisJob, setGithubAnalysisJob] = useState<{ id?: number; status?: string; skipped_start?: boolean } | null>(null);
  const [showApiModal, setShowApiModal] = useState(false);
  const [apiSpec, setApiSpec] = useState("");
  const [apiFormat, setApiFormat] = useState("openapi");
  const [apiInputMode, setApiInputMode] = useState<"paste" | "file" | "url">("paste");
  const [apiFile, setApiFile] = useState<File | null>(null);
  const [apiUrl, setApiUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** Map an asset to the discovery job spec the backend expects. */
  const discoveryForAsset = (a: Asset): { job_type: string; config: Record<string, unknown>; target_asset_id?: number } | null => {
    switch (a.asset_type) {
      case "domain":
        return { job_type: "domain_enum", config: { domain: a.value, include_subdomains: true, include_directories: true } };
      case "subdomain":
        return { job_type: "subdomain_enum", config: { domain: a.value } };
      case "web_app":
      case "api":
        return { job_type: "directory_enum", config: { url: a.value } };
      case "ip_address":
        return { job_type: "nmap", config: { target: a.value } };
      case "port_service":
        return { job_type: "nmap", config: { target: a.value.split("/")[0] } };
      case "mobile_apk":
        return { job_type: "apk_analyze", config: { asset_id: a.id }, target_asset_id: a.id };
      case "github_repo":
        return { job_type: "github_sync", config: {} };
      default:
        return null;
    }
  };

  const runDiscovery = async (list: Asset[]) => {
    if (!(await requireDualControl("Running discovery jobs requires a dual-control operate session."))) return;
    const targets = list.filter((a) => a && discoveryForAsset(a));
    if (targets.length === 0) {
      toast("error", "No discovery available", "Selected asset type has no supported discovery job.");
      return;
    }
    let ok = 0;
    let fail = 0;
    for (const a of targets) {
      const spec = discoveryForAsset(a)!;
      try {
        await api.post("/assets/discovery/jobs", { ...spec, run_inline: true });
        ok += 1;
      } catch {
        fail += 1;
      }
    }
    if (ok > 0) toast("success", "Discovery started", `${ok} job${ok > 1 ? "s" : ""} queued — watch the Discovery jobs tab.`);
    if (fail > 0) toast("error", "Some jobs failed", `${fail} asset(s) could not start discovery.`);
    setChecked(new Set());
    setTab("discovery");
  };

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
    if (document.hidden) return; // pause while the tab is hidden
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
      pollRef.current = setInterval(pollDiscovery, 10_000);
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


  const loadGithubStatus = async () => {
    // PAT integration(s) — backend returns a list.
    try {
      const list = await api.get<{ github_login?: string; token_configured?: boolean }[] | { items: { github_login?: string; token_configured?: boolean }[] }>("/assets/integrations/github");
      const arr = Array.isArray(list) ? list : (list as any)?.items ?? [];
      const active = arr.find((x: { token_configured?: boolean }) => x.token_configured !== false) ?? arr[0];
      setGithubStatus(active ? { github_login: active.github_login, token_configured: active.token_configured !== false } : null);
    } catch { setGithubStatus(null); }
    // GitHub App installation (org-scoped) — reflects the org's connected App.
    try {
      const app = await api.get<{ connected?: boolean; account_login?: string; status?: string; message?: string }>("/github/installation");
      setGithubAppStatus(app);
    } catch { setGithubAppStatus(null); }
  };

  const handleGithubConnect = async () => {
    if (githubMethod === "app") {
      if (!(await requireDualControl("Connecting the GitHub App requires a dual-control operate session."))) return;
      setImportingGithub(true);
      try {
        const res = await api.get<{ install_url: string; state: string; configured: boolean }>("/github/install-url");
        if (!res.configured) { toast("error", "GitHub App not configured", "The GitHub App is not set up on the server yet."); return; }
        window.location.href = res.install_url;
      } catch (e: any) {
        toast("error", "Connect failed", e.message || "Could not reach the GitHub App setup");
      } finally { setImportingGithub(false); }
      return;
    }
    if (!githubPat) { toast("error", "Enter a PAT"); return; }
    if (!(await requireDualControl("Connecting GitHub requires a dual-control operate session."))) return;
    setImportingGithub(true);
    try {
      await api.post("/assets/integrations/github", { personal_access_token: githubPat });
      await loadGithubStatus();
      toast("success", "GitHub connected", githubStatus?.github_login ? `Logged in as ${githubStatus.github_login}` : "Token stored");
      setGithubPat("");
    } catch (e: any) {
      toast("error", "Connection failed", e.message || "Invalid token or network error");
    } finally {
      setImportingGithub(false);
    }
  };

  const handleGithubImport = async () => {
    if (!(await requireDualControl("Importing repos requires a dual-control operate session."))) return;
    setImportingGithub(true);
    try {
      // POST /assets/import/github queues a SEPARATE github_analysis scan job (returned
      // as analysis_job). Import must not fail just because analysis could not start.
      const res = await api.post<{
        imported?: unknown[];
        message?: string;
        analysis_job?: { id?: number; job_type?: string; status?: string; skipped_start?: boolean };
      }>("/assets/import/github", { discover_all: true });
      const job = res?.analysis_job ?? null;
      const importedCount = (res?.imported ?? []).length;
      setGithubAnalysisJob(job ? { id: job.id, status: job.status, skipped_start: job.skipped_start } : null);
      if (job && job.skipped_start) {
        toast("info", "Repos imported; analysis already running", "Another GitHub analysis is active. Assets were saved; a new scan was not started.");
      } else if (job && job.id) {
        toast("success", "Import started", `Imported ${importedCount} repo(s) & queued GitHub analysis scan job #${job.id}. Track it under Scans.`);
      } else {
        toast("success", "Import started", "Repos imported as assets (no analysis job queued).");
      }
      reload();
    } catch (e: any) {
      toast("error", "Import failed", e.message || "");
    } finally {
      setImportingGithub(false);
    }
  };

  const handleApiImport = async () => {
    // Backend contract (app/engines/asset_engine/schemas/assets.py → ApiSpecImportRequest):
    //   POST /assets/import/api  { format, content?, url?, confirm_ownership }
    // File upload is sent as `content`; URLs are fetched server-side via `url`.
    const body: Record<string, unknown> = { format: apiFormat, confirm_ownership: true };

    if (apiInputMode === "file") {
      if (!apiFile) { toast("error", "Choose a JSON/YAML file"); return; }
      try {
        const content = await readTextFile(apiFile);
        if (!content.trim()) { toast("error", "File is empty"); return; }
        body.content = content;
      } catch (e: any) {
        toast("error", "Could not read file", e.message || "");
        return;
      }
    } else if (apiInputMode === "url") {
      if (!apiUrl) { toast("error", "Enter an API doc URL"); return; }
      body.url = apiUrl;
    } else {
      if (!apiSpec.trim()) { toast("error", "Provide an OpenAPI or Postman spec"); return; }
      body.content = apiSpec;
    }

    if (!(await requireDualControl("API import requires a dual-control operate session."))) return;
    setImporting(true);
    try {
      await api.post("/assets/import/api", body);
      toast("success", "API imported", "Endpoints added as assets");
      setShowApiModal(false);
      setApiSpec("");
      setApiFile(null);
      setApiUrl("");
      setApiInputMode("paste");
      reload();
    } catch (e: any) {
      toast("error", "Import failed", e.message || "");
    } finally { setImporting(false); }
  };

  // Check GitHub status (PAT + GitHub App) on page load
  useEffect(() => {
    void loadGithubStatus();
  }, []);
  if (loading) {
    return <PageSkeleton variant="split" rows={6} actions />;
  }

  if (error && data.assets.length === 0) {
    return (
      <ErrorState
        onRetry={reload}
        body="We could not load your asset inventory. Check your connection and retry — your session stays signed in."
      />
    );
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      {securityDbBlocked && <SecurityDbBanner message={loadError} />}
      <PageHeader
        title="Attack-surface inventory"
        description="Every row lives only in your dedicated security database -- schema phantix, version 1.4.2. Discovery is gated: HTTP 404s and dead hosts never enter inventory."
        actions={
          <div className="flex items-center gap-2">
            <DocLink docId="howto-app-03" label="Add assets" />
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
                {(prioritized ?? []).map((a: any, i: number) => {
                  const score = a.riskScore ?? a.risk_score ?? 0;
                  const level = (a.riskLevel ?? a.risk_level ?? "low").toLowerCase();
                  const findings = a.openFindingsCount ?? a.open_findings ?? 0;
                  const exposure = a.exposureLevel ?? a.exposure ?? "";
                  const assetType = a.assetType ?? a.asset_type ?? "";
                  const displayName = a.name || a.value || `#${a.id}`;
                  return (
                  <tr key={a.id} className={cx("border-b border-phantix-800/40 hover:bg-phantix-800/35 text-sm", i % 2 === 1 && "bg-phantix-950/30")}>
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-200">{displayName}</p>
                      <p className="text-xs text-slate-500 font-mono">{a.value || `#${a.id}`}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className="chip text-xs">{titleCase(assetType)}</span>
                    </td>
                    <td className="px-5 py-3 font-mono text-sm">
                      <span className={cx(score >= 75 ? "text-severity-critical" : score >= 50 ? "text-severity-high" : score >= 25 ? "text-severity-medium" : "text-severity-low")}>
                        {score || "--"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <SeverityBadge severity={level as never} />
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-400">{titleCase(exposure)}</td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-400">{findings}</td>
                  </tr>
                  );
                })}
                {(!prioritized || prioritized.length === 0) && (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-500">No prioritized assets yet -- run scans to populate risk data.</td></tr>
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
                <input className="input !pl-10" placeholder="Search value or name..." value={q} onChange={(e) => setQ(e.target.value)} />
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

            {(() => {
              const filtered = assetsWithDiscovery.filter(
                (a) =>
                  (typeFilter === "all" || a.asset_type === typeFilter) &&
                  (a.value.toLowerCase().includes(q.toLowerCase()) || a.name.toLowerCase().includes(q.toLowerCase())),
              );
              if (filtered.length === 0) {
                return <EmptyState icon={<Boxes size={22} />} title="No assets match" body="Adjust filters or add your first in-scope host." />;
              }
              const selectedInView = filtered.filter((a) => checked.has(a.id));
              const allChecked = selectedInView.length === filtered.length;
              const toggleAll = (e: React.ChangeEvent<HTMLInputElement>) => {
                const s = new Set(checked);
                if (e.target.checked) filtered.forEach((a) => s.add(a.id));
                else filtered.forEach((a) => s.delete(a.id));
                setChecked(s);
              };
              return (
                <>
                  {checked.size > 0 && (
                    <div className="flex flex-wrap items-center gap-3 border-b border-phantix-700/40 bg-phantix-800/40 px-4 py-2.5">
                      <span className="text-xs font-medium text-slate-300">{checked.size} selected</span>
                      <button
                        onClick={() => void runDiscovery(assets.filter((a) => checked.has(a.id)))}
                        className="btn-primary !py-1.5 !text-xs"
                      >
                        <Radar size={13} className="mr-1 inline" /> Run discovery
                      </button>
                      <button onClick={() => setChecked(new Set())} className="btn-ghost !py-1.5 !text-xs">Clear</button>
                    </div>
                  )}
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-phantix-700/40">
                        <th className="th w-10"><input type="checkbox" checked={allChecked} onChange={toggleAll} className="accent-gold-400" aria-label="Select all assets" /></th>
                        <th className="th">Asset</th>
                        <th className="th">Type</th>
                        <th className="th">Discovery</th>
                        <th className="th">Criticality</th>
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
                          <td className="td w-10" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={checked.has(a.id)}
                              onChange={(e) => {
                                const s = new Set(checked);
                                if (e.target.checked) s.add(a.id);
                                else s.delete(a.id);
                                setChecked(s);
                              }}
                              className="accent-gold-400"
                              aria-label={`Select ${a.value}`}
                            />
                          </td>
                          <td className="td">
                            <div className="flex items-center gap-3">
                              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-phantix-800/70 text-phantix-300">
                                {typeIcon[a.asset_type] ?? <Boxes size={15} />}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate font-medium text-slate-200">{a.value}</p>
                                <p className="text-xs text-slate-500">{a.name || a.asset_type}</p>
                                {(() => {
                                  const t = assetTierBadge(a);
                                  return t ? <span className={`mt-1 inline-flex rounded border px-1.5 py-0.5 text-[10px] font-medium ${t.cls}`}>{t.label}</span> : null;
                                })()}
                              </div>
                            </div>
                          </td>
                          <td className="td"><span className="text-xs text-slate-400">{titleCase(a.asset_type)}</span></td>
                          <td className="td">
                            {a.discoveryStatus ? (
                              <span className="flex items-center gap-1.5">
                                <span className={cx("h-1.5 w-1.5 rounded-full", a.discoveryStatus === "running" ? "bg-severity-low animate-pulse-soft" : a.discoveryStatus === "completed" ? "bg-emerald-400" : a.discoveryStatus === "failed" ? "bg-severity-critical" : "bg-slate-500")} />
                                <StatusBadge status={a.discoveryStatus} />
                              </span>
                            ) : (
                              <span className="text-xs text-slate-600">--</span>
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
                </>
              );
            })()}
            </Card>
          </motion.div>
      )}

      {tab === "discovery" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">
              {activeJobs.length > 0 ? (
                <span className="flex items-center gap-2"><Spinner className="h-3 w-3" /> {activeJobs.length} active job{activeJobs.length > 1 ? "s" : ""}</span>
              ) : (
                `${discoveryJobs.length} discovery job${discoveryJobs.length !== 1 ? "s" : ""}`
              )}
            </p>
          </div>
          {discoveryJobs.map((j: any) => {
            const cfg = j.config || {};
            const rs = j.result_summary || {};
            const subdomains: string[] = rs.subdomains || [];
            const endpoints: string[] = rs.endpoints || [];
            const priorityEndpoints: string[] = rs.priority_endpoints || [];
            const errors: string[] = rs.errors || [];
            const tools: string[] = rs.tools_used || [];
            return (
            <Card key={j.id}>
              {/* Header */}
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <span className={cx("flex h-9 w-9 items-center justify-center rounded-xl", j.status === "running" ? "bg-severity-low/20 text-severity-low" : j.status === "completed" ? "bg-emerald-400/20 text-emerald-400" : j.status === "failed" ? "bg-severity-critical/20 text-severity-critical" : "bg-phantix-800/70 text-gold-400")}>
                  <Radar size={16} className={j.status === "running" ? "animate-pulse-soft" : ""} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-display text-sm font-semibold text-slate-100">{titleCase(j.job_type)}</p>
                    <span className="text-xs font-mono text-slate-500">#{j.id}</span>
                    <StatusBadge status={j.status} />
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Domain: <span className="text-slate-300 font-mono">{cfg.domain || "--"}</span>
                    {j.assets_discovered != null && <span className="ml-3">{j.assets_discovered} assets discovered</span>}
                    {rs.assets_upserted != null && <span className="ml-2">{rs.assets_upserted} upserted</span>}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-slate-500">{timeAgo(j.created_at)}</div>
                  {j.completed_at && <div className="text-[10px] text-slate-600">Completed {timeAgo(j.completed_at)}</div>}
                </div>
              </div>

              {j.status === "running" && <ProgressBar value={64} color="#38BDF8" />}

              {/* Subdomains */}
              {subdomains.length > 0 && (
                <div className="mt-3 pt-3 border-t border-phantix-700/40">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                    Subdomains ({subdomains.length})
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {subdomains.slice(0, 20).map((s: string) => (
                      <span key={s} className="chip text-[10px] text-phantix-300 bg-phantix-500/10 border-phantix-500/20 font-mono">{s}</span>
                    ))}
                    {subdomains.length > 20 && <span className="text-[10px] text-slate-500">+{subdomains.length - 20} more</span>}
                  </div>
                </div>
              )}

              {/* Priority endpoints */}
              {priorityEndpoints.length > 0 && (
                <div className="mt-2 pt-2 border-t border-phantix-700/30">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                    Priority Endpoints ({priorityEndpoints.length})
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {priorityEndpoints.slice(0, 15).map((e: string) => (
                      <span key={e} className="text-[10px] text-severity-medium bg-severity-medium/10 border border-severity-medium/20 rounded px-1.5 py-0.5 font-mono truncate max-w-[280px]">{e}</span>
                    ))}
                    {priorityEndpoints.length > 15 && <span className="text-[10px] text-slate-500">+{priorityEndpoints.length - 15} more</span>}
                  </div>
                </div>
              )}

              {/* Tools used */}
              {tools.length > 0 && (
                <div className="mt-2 text-[10px] text-slate-500">
                  Tools: {tools.join(", ")}
                  {rs.method && <span className="ml-2">· Method: {rs.method}</span>}
                </div>
              )}

              {/* Errors */}
              {errors.length > 0 && (
                <div className="mt-2 rounded-lg bg-severity-critical/5 border border-severity-critical/20 p-2.5">
                  <p className="text-[10px] font-semibold text-severity-critical mb-1">Errors ({errors.length})</p>
                  {errors.slice(0, 3).map((e: string, i: number) => (
                    <p key={i} className="text-[10px] text-severity-critical/80 leading-relaxed">{e}</p>
                  ))}
                  {errors.length > 3 && <p className="text-[10px] text-slate-500 mt-0.5">+{errors.length - 3} more errors</p>}
                </div>
              )}

              {j.error_message && (
                <div className="mt-2 rounded-lg bg-severity-critical/5 border border-severity-critical/20 p-2.5 text-[10px] text-severity-critical">{j.error_message}</div>
              )}
            </Card>
          )})}
          {discoveryJobs.length === 0 && (
            <EmptyState icon={<Radar size={24} />} title="No discovery jobs" body="Add a domain or subdomain asset to start automatic discovery." />
          )}
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
          <Card hover className="flex flex-col">
            <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-phantix-800/70 text-gold-400"><Github size={18} /></span>
            <h3 className="font-display text-[15px] font-semibold text-slate-100">GitHub repositories</h3>
            <p className="mt-1.5 flex-1 text-[13px] leading-6 text-slate-400">
              {githubAppStatus?.connected
                ? `GitHub App connected as ${githubAppStatus.account_login || "GitHub"}. Import repos as assets.`
                : githubStatus?.token_configured
                  ? `Connected via PAT as ${githubStatus.github_login || "GitHub"}. Import repos as assets.`
                  : "Connect the GitHub App or a Personal Access Token to list and import repositories."}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {githubAppStatus?.connected && (
                <span className="chip border-emerald-400/30 bg-emerald-400/10 text-emerald-300"><Github size={10} className="mr-1 inline" /> App · {githubAppStatus.account_login}</span>
              )}
              {githubStatus?.token_configured && (
                <span className="chip border-gold-400/30 bg-gold-400/10 text-gold-300">PAT · {githubStatus.github_login || "configured"}</span>
              )}
              {!githubStatus?.token_configured && !githubAppStatus?.connected && (
                <span className="chip border-phantix-600/40 bg-phantix-800/50 text-slate-400">Not connected</span>
              )}
            </div>
            {(githubStatus?.token_configured || githubAppStatus?.connected) ? (
              <button className="btn-secondary mt-4 w-full" onClick={handleGithubImport} disabled={importingGithub}>
                {importingGithub ? <Spinner className="h-3 w-3" /> : <Github size={14} />} Import Repos
              </button>
            ) : (
              <button className="btn-secondary mt-4 w-full" onClick={() => { void (async () => { if (await requireDualControl("Connecting GitHub requires a dual-control operate session.")) { setGithubMethod("pat"); setShowGithubModal(true); } })(); }}>
                <Github size={14} /> Connect GitHub
              </button>
            )}
            {githubAnalysisJob?.id && githubAnalysisJob.status !== "completed" && (
              <a href="/scans" className="mt-2 block rounded-lg border border-phantix-700/40 bg-phantix-950/60 px-3 py-2 text-center text-[11px] text-slate-400 transition-colors hover:border-phantix-500/50 hover:text-slate-200">
                {githubAnalysisJob.skipped_start
                  ? "A GitHub analysis is already running (skipped a new start). View Scans."
                  : `GitHub analysis job #${githubAnalysisJob.id} · ${githubAnalysisJob.status ?? "queued"}. Track in Scans.`}
              </a>
            )}
            <p className="mt-2 font-mono text-[10px] text-slate-500">POST /assets/integrations/github · GET /github/installation</p>
          </Card>

          <Card hover className="flex flex-col">
            <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-phantix-800/70 text-gold-400"><FileJson size={18} /></span>
            <h3 className="font-display text-[15px] font-semibold text-slate-100">OpenAPI / Postman</h3>
            <p className="mt-1.5 flex-1 text-[13px] leading-6 text-slate-400">Import an OpenAPI/Postman spec by paste, file upload, or URL. Endpoints are imported as API assets with metadata.</p>
            <button className="btn-secondary mt-4 w-full" onClick={() => { void (async () => { if (await requireDualControl("API import requires a dual-control operate session.")) setShowApiModal(true); })(); }}>
              Import Spec
            </button>
            <p className="mt-2 font-mono text-[10px] text-slate-500">POST /assets/import/api</p>
          </Card>

          <Card hover className="flex flex-col">
            <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-phantix-800/70 text-gold-400"><Smartphone size={18} /></span>
            <h3 className="font-display text-[15px] font-semibold text-slate-100">Android APK</h3>
            <p className="mt-1.5 flex-1 text-[13px] leading-6 text-slate-400">Upload an APK for static analysis. Package mapped as a mobile_apk asset with permissions.</p>
            <button className="btn-secondary mt-4 w-full" onClick={() => { void (async () => { if (await requireDualControl("APK upload requires a dual-control operate session.")) { 
              const input = document.createElement('input'); input.type = 'file'; input.accept = '.apk';
              input.onchange = async (ev) => {
                const file = (ev.target as HTMLInputElement).files?.[0];
                if (!file) return;
                if (!(await requireDualControl("APK upload requires a dual-control operate session."))) return;
                setImporting(true);
                try {
                  const form = new FormData(); form.append("file", file); form.append("confirm_ownership", "true");
                  await api.upload("/assets/upload/apk", form);
                  toast("success", "APK uploaded", "Analysis running in background");
                  reload();
                } catch (e: any) {
                  const st = Number(e?.status ?? 0);
                  toast("error", st === 502 || st === 503 ? "Storage unavailable" : "Upload failed", st === 502 || st === 503 ? "Storage unavailable — retry." : (e?.message ?? ""));
                }
                finally { setImporting(false); }
              };
              input.click();
            }})(); }}>
              Upload APK
            </button>
            <p className="mt-2 font-mono text-[10px] text-slate-500">POST /assets/upload/apk</p>
          </Card>
        </motion.div>
      )}

      {/* Asset detail modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.value ?? ""} wide>
        {selected && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              {selected.is_verified && <span className="chip border-emerald-400/30 bg-emerald-400/10 text-emerald-300"><ShieldCheck size={12} /> {selected.verification_method ?? "verified"}</span>}
              {(() => {
                const t = assetTierBadge(selected);
                return t ? <span className={`chip ${t.cls}`}>{t.label}</span> : null;
              })()}
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
                )) : <span className="text-sm text-slate-500">No manual tags -- auto-tags (type/source/verified) apply.</span>}
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
                {(selectedIntel.recommended_actions?.length ?? 0) > 0 && (
                  <div>
                    <p className="label">Recommended actions</p>
                    <div className="space-y-2">
                      {(selectedIntel.recommended_actions ?? []).map((ra) => (
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
              <button
                className="btn-secondary"
                onClick={() => void runDiscovery([selected])}
              >
                <Radar size={13} className="mr-1 inline" /> Run discovery
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

      <Modal open={showGithubModal} onClose={() => setShowGithubModal(false)} title="Connect GitHub">
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 rounded-xl border border-phantix-700/40 bg-phantix-900/40 p-1">
            <button
              onClick={() => setGithubMethod("pat")}
              className={cx("flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors", githubMethod === "pat" ? "bg-phantix-800/70 text-white" : "text-slate-400 hover:text-slate-200")}
            >
              <KeyRound size={15} /> Personal Access Token
            </button>
            <button
              onClick={() => setGithubMethod("app")}
              className={cx("flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors", githubMethod === "app" ? "bg-gradient-to-r from-gold-400/20 to-gold-600/20 text-gold-200 ring-1 ring-gold-400/30" : "text-slate-400 hover:text-slate-200")}
            >
              <Github size={15} /> GitHub App
            </button>
          </div>

          {githubMethod === "pat" ? (
            <>
              <p className="text-xs text-slate-400">Paste a GitHub Personal Access Token (classic or fine-grained) with <strong>repo</strong> or <strong>Contents: Read</strong> scope. The token is stored encrypted and never shown again.</p>
              <div><label className="label">Personal Access Token</label><input className="input font-mono text-sm" type="password" placeholder="ghp_..." value={githubPat} onChange={(e) => setGithubPat(e.target.value)} /></div>
              <p className="text-[10px] text-slate-500">Minimum scopes: <code>public_repo</code> (classic) or <code>Contents: Read</code> (fine-grained). Revoke anytime in GitHub → Settings → Developer settings.</p>
              <button onClick={handleGithubConnect} disabled={importingGithub || !githubPat} className="btn-primary w-full">{importingGithub ? <Spinner className="h-4 w-4" /> : null}Connect with PAT</button>
            </>
          ) : (
            <>
              <p className="text-xs text-slate-400">Install the <strong>Phantix GitHub App</strong> on your account or organization. The App is the recommended integration — no tokens to rotate, and repositories are imported automatically.</p>
              {githubAppStatus?.connected ? (
                <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3">
                  <p className="text-sm font-semibold text-emerald-300">GitHub App connected</p>
                  <p className="mt-1 text-xs text-slate-300">Logged in as {githubAppStatus.account_login || "your GitHub account"}. You can import repositories directly.</p>
                </div>
              ) : (
                <div className="rounded-xl border border-phantix-700/40 bg-phantix-950/50 p-3">
                  <p className="text-xs text-slate-300">You'll be redirected to GitHub to install the Phantix App. After approving, repositories are available for import.</p>
                </div>
              )}
              <button onClick={handleGithubConnect} disabled={importingGithub} className="btn-primary w-full">{importingGithub ? <Spinner className="h-4 w-4" /> : <Github size={14} className="mr-1 inline" />}{githubAppStatus?.connected ? "Reconnect GitHub App" : "Install GitHub App"}</button>
            </>
          )}
        </div>
      </Modal>

      <Modal open={showApiModal} onClose={() => setShowApiModal(false)} title="Import OpenAPI / Postman">
        <div className="space-y-3">
          <div><label className="label">Format</label><select className="input" value={apiFormat} onChange={(e) => setApiFormat(e.target.value)}><option value="openapi">OpenAPI (JSON/YAML)</option><option value="postman">Postman Collection</option></select></div>

          <div className="flex rounded-lg border border-phantix-700/50 bg-phantix-900/50 p-0.5">
            {(["paste", "file", "url"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setApiInputMode(m)}
                className={cx(
                  "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  apiInputMode === m ? "bg-phantix-700/60 text-white" : "text-slate-400 hover:text-slate-200",
                )}
              >
                {m === "paste" ? "Paste" : m === "file" ? "Upload file" : "From URL"}
              </button>
            ))}
          </div>

          {apiInputMode === "paste" && (
            <div>
              <label className="label">Spec Content</label>
              <textarea className="input resize-none font-mono text-xs" rows={8} placeholder='{"openapi": "3.0.0", "info": {...}, ...}' value={apiSpec} onChange={(e) => setApiSpec(e.target.value)} />
            </div>
          )}

          {apiInputMode === "file" && (
            <div>
              <label className="label">Spec file (.json / .yaml / .yml)</label>
              <input
                type="file"
                accept=".json,.yaml,.yml,application/json,application/yaml,text/yaml,text/plain"
                className="input"
                onChange={(e) => setApiFile(e.target.files?.[0] ?? null)}
              />
              {apiFile && (
                <p className="mt-1.5 text-[11px] text-slate-400">
                  Selected: <span className="text-slate-200">{apiFile.name}</span> · {(apiFile.size / 1024).toFixed(1)} KB
                </p>
              )}
            </div>
          )}

          {apiInputMode === "url" && (
            <div>
              <label className="label">API doc URL</label>
              <input
                type="url"
                className="input"
                placeholder="https://api.example.com/openapi.json"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
              />
              <p className="mt-1.5 text-[11px] text-slate-500">Phantix fetches the spec from this URL and imports it automatically.</p>
            </div>
          )}

          <p className="text-[10px] text-slate-500">Endpoints are imported as API assets with path, method, and auth metadata.</p>
          <button
            onClick={handleApiImport}
            disabled={importing || (apiInputMode === "file" ? !apiFile : apiInputMode === "url" ? !apiUrl : !apiSpec.trim())}
            className="btn-primary w-full"
          >
            {importing ? <Spinner className="h-4 w-4" /> : null}
            {importing ? "Importing…" : "Import Endpoints"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

