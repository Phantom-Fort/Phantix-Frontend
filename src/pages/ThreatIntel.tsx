import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Radar, ShieldAlert, Globe, Activity, Plug, Search, RefreshCw, ArrowUpRight,
  Crosshair, Fingerprint, Link2, ExternalLink, FileSearch, AlertTriangle, Plus,
} from "lucide-react";
import {
  PageHeader, Card, CardHeader, SeverityBadge, StatusBadge, EmptyState, Tabs, Spinner, StatCard, Modal,
} from "@/components/ui";
import SecurityDbBanner from "@/components/SecurityDbBanner";
import { useResource } from "@/lib/useResource";
import {
  loadIntelDashboard, loadIntelLookup, loadIntelEvents, startReputationScan, normalizeIntelSignals,
} from "@/lib/data";
import { useStore } from "@/lib/store";
import { timeAgo, cx, titleCase } from "@/lib/utils";
import type { IntelDashboard, TiSignal, CloudEvent } from "@/lib/types";

function sevOf(s: string | undefined): "critical" | "high" | "medium" | "low" | "info" {
  return (["critical", "high", "medium", "low", "info"] as const).includes(s as any) ? (s as any) : "info";
}

function IocBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    ip: "text-emerald-300 bg-emerald-400/10 border-emerald-400/30",
    domain: "text-phantix-300 bg-phantix-500/10 border-phantix-500/30",
    url: "text-gold-300 bg-gold-400/10 border-gold-400/30",
    email: "text-purple-300 bg-purple-400/10 border-purple-400/30",
  };
  return <span className={cx("chip shrink-0 text-[10px] font-mono", colors[type] ?? "text-slate-400 bg-slate-500/10 border-slate-500/30")}>{type}</span>;
}

const emptyIntel: IntelDashboard = {};

export default function ThreatIntel() {
  const { toast, requireDualControl } = useStore();
  const [tab, setTab] = useState("signals");

  const dash = useResource<IntelDashboard>(() => loadIntelDashboard().then((d) => d ?? emptyIntel), emptyIntel, "intel-dashboard");
  const intel = useResource<{ signals: TiSignal[]; scanReputation: any[]; matched: number; unmatched: number; newSignals: string[] }>(
    async () => {
      const l = await loadIntelLookup();
      return {
        signals: normalizeIntelSignals(l.signals),
        scanReputation: l.scan_reputation ?? [],
        matched: l.matched_count ?? 0,
        unmatched: l.unmatched_count ?? 0,
        newSignals: (l.new_signals ?? [])
          .map((s) => (typeof s === "string" ? s : s?.ioc))
          .filter((v): v is string => Boolean(v)),
      };
    },
    { signals: [], scanReputation: [], matched: 0, unmatched: 0, newSignals: [] },
    "intel-lookup",
  );
  const events = useResource<CloudEvent[]>(() => loadIntelEvents().then((r) => r?.items ?? []), [], "intel-events");
  const [lookup, setLookup] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupResult, setLookupResult] = useState<{ new: string[]; matched: number } | null>(null);
  const [openIoc, setOpenIoc] = useState<TiSignal | null>(null);
  const [runScan, setRunScan] = useState(false);

  const runLookup = async () => {
    const ioc = lookup.trim();
    if (!ioc) { toast("warning", "Enter an IOC to correlate"); return; }
    setLookupBusy(true);
    setLookupResult(null);
    try {
      const l = await loadIntelLookup(ioc);
      const newIocs = (l.new_signals ?? []).map((s) => s.ioc);
      const newSignalsList: TiSignal[] = newIocs.map((n, idx) => ({
        id: (intel.data.signals.length || 0) + idx + 1,
        ioc: n,
        iocType: ioc.includes(".") ? (ioc.replace(/\.\d+$/, "").split(".").length === 4 ? "ip" : "domain") : "other",
        title: "New IOC: " + n,
        severity: "medium",
        matchedAssetIds: [],
        source: "agent.ti.correlate",
      }));
      intel.setData((p) => ({
        ...p,
        signals: [...newSignalsList, ...p.signals],
        matched: l.matched_count ?? p.matched,
        unmatched: l.unmatched_count ?? p.unmatched,
        newSignals: newIocs,
      }));
      setLookupResult({ new: newIocs, matched: l.matched_count ?? 0 });
      setTab("signals");
      toast("success", "Correlated against inventory", `${newIocs.length} new signal(s), ${l.matched_count ?? 0} matched`);
    } catch (e) {
      toast("error", "Lookup failed", e instanceof Error ? e.message : "");
    } finally {
      setLookupBusy(false);
    }
  };

  const doReputationScan = async () => {
    setRunScan(true);
    try {
      if (!(await requireDualControl("Running a reputation scan requires operate mode."))) { setRunScan(false); return; }
      await startReputationScan({
        job_type: "threat_intel_scan",
        tools: ["threat_intel_scan"],
        target_filter: { asset_types: ["ip_address", "domain", "subdomain"] },
        run_inline: false,
      });
      toast("success", "Reputation scan queued", "Refresh the Reputation tab once the scan job completes.");
    } catch (e) {
      toast("error", "Scan failed", e instanceof Error ? e.message : "");
    } finally {
      setRunScan(false);
    }
  };

  const note = dash.data?.note || "Org-scoped correlation of connector IOCs and scan reputation against inventory. Not a global threat-intel feed.";

  // Merge dashboard signals with intel lookup (occurrence counts, reputation).
  const signals = useMemo(() => {
    const map = new Map<number, TiSignal>();
    for (const s of dash.data?.signals ?? []) map.set(Number(s.id), s);
    for (const s of intel.data.signals) map.set(Number(s.id), s);
    return Array.from(map.values()).filter((s) => s && s.id).slice(0, 50);
  }, [dash.data?.signals, intel.data.signals]);

  const reputation = useMemo(() => intel.data.scanReputation ?? [], [intel.data.scanReputation]);

  if (dash.loading && !dash.data.connectorCount && !signals.length && !events.data.length) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-slate-400">
        <Spinner className="h-5 w-5" /> Loading threat intelligence...
      </div>
    );
  }

  const empty = !signals.length && !events.data.length && !reputation.length;

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Threat Intelligence"
        description="Matches connector IOCs and scan reputation against this org’s assets."
        actions={
          <div className="flex items-center gap-2">
            <button type="button" className="btn-ghost text-sm px-3 py-1.5" onClick={() => { dash.reload(); intel.reload(); events.reload(); }} title="Refresh">
              <RefreshCw size={14} />
            </button>
            <button type="button" className="btn-secondary text-sm px-3 py-1.5" onClick={() => (window as any).location.assign("/cloud")} title="Manage connectors">
              <Plug size={14} /> Manage connectors
            </button>
            <button type="button" className="btn-primary text-sm px-3 py-1.5" onClick={doReputationScan} disabled={runScan}>
              {runScan ? <Spinner className="h-4 w-4" /> : <FileSearch size={14} />} Run reputation scan
            </button>
          </div>
        }
      />

      <div className="mb-4 flex items-start gap-3 rounded-xl border border-phantix-700/30 bg-phantix-900/40 px-4 py-2.5 text-sm text-slate-400">
        <Radar size={15} className="mt-0.5 shrink-0 text-phantix-400" />
        <span className="leading-5">{note}</span>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Matched IOCs" value={<span className="text-gold-400 tabular-nums">{dash.data.matchedIocs ?? intel.data.matched}</span>} icon={<Link2 size={18} />} />
        <StatCard label="Unmatched IOCs" value={<span className="text-white tabular-nums">{dash.data.unmatchedIocs ?? intel.data.unmatched}</span>} icon={<Crosshair size={18} />} />
        <StatCard label="Events (24h)" value={<span className="text-white tabular-nums">{dash.data.eventCount24h ?? 0}</span>} icon={<Activity size={18} />} />
        <StatCard label="Open detections" value={<span className="text-severity-critical tabular-nums">{dash.data.openDetections ?? 0}</span>} icon={<ShieldAlert size={18} />} accent="red" />
        <StatCard label="Connectors" value={<span className="text-phantix-300 tabular-nums">{dash.data.connectorCount ?? 0}</span>} icon={<Plug size={18} />} accent="blue" />
      </div>

      <Card className="mb-5 !p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[240px]">
            <Fingerprint size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              className="input !pl-9 py-2.5 text-sm font-mono"
              placeholder="Correlate an IOC (IP, domain, URL, email) against inventory…"
              value={lookup}
              onChange={(e) => setLookup(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runLookup()}
            />
          </div>
          <button type="button" className="btn-primary !py-2.5 text-sm" onClick={runLookup} disabled={lookupBusy || !lookup.trim()}>
            {lookupBusy ? <Spinner className="h-4 w-4" /> : <Search size={14} />} Correlate
          </button>
        </div>
        {lookupResult && lookupResult.new.length > 0 && (
          <p className="mt-2 text-xs text-emerald-400">
            <strong>{lookupResult.new.length}</strong> new signal(s) upserted for this lookup{lookupResult.matched > 0 ? `, ${lookupResult.matched} matched to assets` : ""}.
          </p>
        )}
        <p className="mt-2 text-[11px] text-slate-500">Lookup is treated as a write — it upserts a correlation signal for this org (rate-limited 30/min).</p>
      </Card>

      <Tabs
        tabs={[
          { id: "signals", label: "Signals", count: signals.length },
          { id: "events", label: "Events", count: events.data.length },
          { id: "reputation", label: "Reputation", count: reputation.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {empty ? (
        <Card>
          <EmptyState
            icon={<Plug size={24} />}
            title="No threat signals yet"
            body="Connect a cloud, VPS, or PaaS webhook on Cloud Security. Telemetry is stored in your security database and correlated against inventory. This is not a global intel feed."
            action={<a href="/cloud" className="btn-primary !py-2 text-sm"><Plus size={14} /> Open Cloud Security</a>}
          />
        </Card>
      ) : (
        <>
          {tab === "signals" && (
            <Card className="!p-0 overflow-hidden">
              {signals.length === 0 ? (
                <EmptyState icon={<Fingerprint size={24} />} title="No signals" body="Correlate an IOC above or wait for connector telemetry." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-phantix-700/40">
                        <th className="th">Indicator</th>
                        <th className="th">Type</th>
                        <th className="th">Severity</th>
                        <th className="th">Source</th>
                        <th className="th">Matches</th>
                        <th className="th">Occurrences</th>
                        <th className="th">Last seen</th>
                        <th className="th w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {signals.map((s) => {
                        const isNew = (intel.data.newSignals ?? []).includes(s.ioc);
                        const matched = s.matchedAssetIds ?? (s as { matched_asset_ids?: number[] }).matched_asset_ids ?? [];
                        return (
                          <tr key={s.id} className={cx("border-b border-phantix-800/40 hover:bg-phantix-800/35 transition-colors cursor-pointer", isNew && "bg-emerald-400/5")} onClick={() => setOpenIoc(s)}>
                            <td className="td">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-mono text-[13px] text-slate-100 truncate max-w-[240px]">{s.ioc}</span>
                                {isNew && <span className="chip text-[9px] shrink-0 text-emerald-300 bg-emerald-400/10 border-emerald-400/20">NEW</span>}
                              </div>
                              <p className="text-[11px] text-slate-500 truncate max-w-[280px]">{s.title}</p>
                            </td>
                            <td className="td"><IocBadge type={s.iocType} /></td>
                            <td className="td"><SeverityBadge severity={sevOf(String(s.severity))} /></td>
                            <td className="td"><span className="chip text-[10px]">{s.source || "—"}</span></td>
                            <td className="td">
                              {matched.length > 0 ? (
                                <span className="chip text-emerald-300 bg-emerald-400/10 border-emerald-400/20">{matched.length} asset(s)</span>
                              ) : (
                                <span className="chip text-slate-400 bg-slate-500/10 border-slate-500/30">Unmatched</span>
                              )}
                            </td>
                            <td className="td font-mono tabular-nums text-slate-300">{s.occurrenceCount ?? 1}</td>
                            <td className="td text-xs text-slate-500 whitespace-nowrap">{s.lastSeenAt ? timeAgo(s.lastSeenAt) : "—"}</td>
                            <td className="td"><ArrowUpRight size={14} className="text-slate-500" /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {tab === "events" && (
            <Card className="!p-0 overflow-hidden">
              {events.data.length === 0 ? (
                <EmptyState icon={<Activity size={24} />} title="No connector events" body="Events appear when cloud / VPS / PaaS webhooks deliver telemetry." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-phantix-700/40">
                        <th className="th">Event</th>
                        <th className="th">Provider</th>
                        <th className="th">Severity</th>
                        <th className="th">Kind</th>
                        <th className="th">Mapped engines</th>
                        <th className="th">Received</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.data.slice(0, 50).map((e: CloudEvent) => (
                        <tr key={e.id} className="border-b border-phantix-800/40 hover:bg-phantix-800/35 transition-colors">
                          <td className="td">
                            <p className="font-medium text-slate-100 truncate max-w-[240px]">{e.title ?? e.title}</p>
                            {e.summary && <p className="text-[11px] text-slate-500 truncate max-w-[280px]">{e.summary}</p>}
                          </td>
                          <td className="td"><span className="chip text-[10px]">{e.provider ?? e.provider}</span></td>
                          <td className="td"><SeverityBadge severity={sevOf(e.severity ?? e.severity)} /></td>
                          <td className="td"><span className="chip text-[10px] text-slate-300">{e.eventKind ?? titleCase(e.event_kind ?? "")}</span></td>
                          <td className="td">
                            <div className="flex flex-wrap gap-1">{(e.mappedEngines ?? e.mapped_engines ?? []).map((m) => <span key={m} className="chip text-[9px] text-slate-400">{m}</span>)}</div>
                          </td>
                          <td className="td text-xs text-slate-500 whitespace-nowrap">{e.receivedAt ?? e.received_at ? timeAgo((e.receivedAt ?? e.received_at) as string) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {tab === "reputation" && (
            <Card className="!p-0 overflow-hidden">
              {reputation.length === 0 ? (
                <EmptyState
                  icon={<FileSearch size={24} />}
                  title="No reputation results"
                  body="Run a threat_intel_scan to get VirusTotal reputation hits (requires a server VT API key)."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-phantix-700/40">
                        <th className="th">Finding</th>
                        <th className="th">Tool</th>
                        <th className="th">Severity</th>
                        <th className="th">IOC</th>
                        <th className="th">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reputation.map((r: any) => (
                        <tr key={r.id} className="border-b border-phantix-800/40 hover:bg-phantix-800/35 transition-colors">
                          <td className="td font-medium text-slate-100">{r.title}</td>
                          <td className="td"><span className="chip text-[10px]">{r.tool ?? "yaml_ti"}</span></td>
                          <td className="td"><SeverityBadge severity={sevOf(String(r.severity))} /></td>
                          <td className="td font-mono text-xs text-slate-300">{r.ioc ?? r.asset_value ?? "—"}</td>
                          <td className="td text-xs text-slate-500 whitespace-nowrap">{r.created_at ?? r.createdAt ? timeAgo((r.created_at ?? r.createdAt) as string) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </>
      )}

      {/* IOC detail drawer */}
      <Modal open={openIoc !== null} onClose={() => setOpenIoc(null)} title={openIoc ? `Signal — ${openIoc.ioc}` : ""} wide>
        {openIoc && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <IocBadge type={openIoc.iocType} />
              <SeverityBadge severity={sevOf(String(openIoc.severity))} />
              {openIoc.source && <span className="chip text-[10px]">{openIoc.source}</span>}
              {(openIoc.matchedAssetIds ?? []).length > 0
                ? <span className="chip text-emerald-300 bg-emerald-400/10 border-emerald-400/20">{(openIoc.matchedAssetIds ?? []).length} matched asset(s)</span>
                : <span className="chip text-slate-400 bg-slate-500/10 border-slate-500/30">No asset match</span>}
            </div>
            <p className="text-sm text-slate-300">{openIoc.title}</p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {[["First seen", openIoc.firstSeenAt ? timeAgo(openIoc.firstSeenAt) : "—"], ["Last seen", openIoc.lastSeenAt ? timeAgo(openIoc.lastSeenAt) : "—"], ["Occurrences", `${openIoc.occurrenceCount ?? 1}`], ["ID", `#${openIoc.id}`]].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-phantix-950/50 border border-phantix-700/40 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">{k}</p>
                  <p className="mt-0.5 font-medium text-slate-200">{v}</p>
                </div>
              ))}
            </div>
            {openIoc.evidence && Object.keys(openIoc.evidence).length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Evidence</p>
                <pre className="rounded-lg bg-phantix-950/70 border border-phantix-700/40 p-3 text-[11px] font-mono text-slate-400 overflow-x-auto">{JSON.stringify(openIoc.evidence, null, 2)}</pre>
              </div>
            )}
            {(openIoc.matchedAssetIds ?? []).length > 0 && (
              <div className="flex flex-wrap gap-2 border-t border-phantix-700/40 pt-4">
                {(openIoc.matchedAssetIds ?? []).map((id) => (
                  <a key={id} href={`/assets?asset=${id}`} className="btn-secondary text-xs"><Globe size={12} /> Open asset #{id}</a>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
