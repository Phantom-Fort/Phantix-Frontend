import React, { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity, Plus, RefreshCw, Play, Trash2, Pencil, Wifi, WifiOff, AlertTriangle,
  Clock, CheckCircle2, XCircle, ExternalLink, Globe2, Server, ShieldCheck, Terminal,
} from "lucide-react";
import { Card, CardHeader, StatCard, Modal, EmptyState, StatusBadge, SeverityBadge, Spinner } from "@/components/ui";
import { useStore } from "@/lib/store";
import { timeAgo, cx, titleCase } from "@/lib/utils";
import {
  loadAvailabilitySummary, loadAvailabilityChecks, loadAvailabilityIncidents,
  createAvailabilityCheck, updateAvailabilityCheck, deleteAvailabilityCheck,
  runAvailabilityCheck, acknowledgeAvailabilityIncident, markAvailabilityFalsePositive,
  formatDuration,
} from "@/lib/data";
import type { AvailabilityCheck, AvailabilityIncident, AvailabilitySummary } from "@/lib/types";

const CHECK_TYPES = ["http", "https", "tcp", "tls", "dns"];

function statusChip(status: string) {
  const cls =
    status === "up" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
    : status === "down" ? "border-severity-critical/30 bg-severity-critical/10 text-severity-critical"
    : status === "degraded" ? "border-severity-medium/30 bg-severity-medium/10 text-severity-medium"
    : "border-slate-500/50 bg-slate-500/10 text-slate-400";
  return <span className={cx("chip capitalize", cls)}><span className="h-1.5 w-1.5 rounded-full bg-current" />{status || "unknown"}</span>;
}

const emptyForm = {
  name: "", check_type: "http", target: "", interval_seconds: 120, timeout_seconds: 8,
  failures_to_down: 3, successes_to_up: 2, expected_status: "", expected_keyword: "",
  severity_on_down: "critical", notify_on_down: true, notify_on_recovery: true,
};

export default function SocAvailability() {
  const { toast } = useStore();
  const [summary, setSummary] = useState<AvailabilitySummary | null>(null);
  const [checks, setChecks] = useState<AvailabilityCheck[]>([]);
  const [openIncidents, setOpenIncidents] = useState<AvailabilityIncident[]>([]);
  const [recovered, setRecovered] = useState<AvailabilityIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [secBlocked, setSecBlocked] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AvailabilityCheck | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [detail, setDetail] = useState<AvailabilityIncident | null>(null);
  const [, setTick] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setSecBlocked(false);
    try {
      const [s, c, open, rec] = await Promise.all([
        loadAvailabilitySummary(),
        loadAvailabilityChecks(),
        loadAvailabilityIncidents("open", 50),
        loadAvailabilityIncidents("recovered", 20),
      ]);
      setSummary(s);
      setChecks(c ?? []);
      setOpenIncidents(open ?? []);
      setRecovered(rec ?? []);
    } catch (e: any) {
      if (e?.status === 409) setSecBlocked(true);
      else toast("error", "Could not load availability", e instanceof Error ? e.message : "");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  // Live elapsed ticker for open incidents (update every 1s).
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const refresh = async () => {
    setSummary(await loadAvailabilitySummary());
    setOpenIncidents(await loadAvailabilityIncidents("open", 50));
    setChecks(await loadAvailabilityChecks());
  };

  const openCreate = () => { setEditing(null); setForm(emptyForm); setFormOpen(true); };
  const openEdit = (c: AvailabilityCheck) => {
    setEditing(c);
    setForm({
      name: c.name, check_type: c.check_type, target: c.target,
      interval_seconds: c.interval_seconds, timeout_seconds: c.timeout_seconds,
      failures_to_down: c.failures_to_down, successes_to_up: c.successes_to_up,
      expected_status: c.expected_status ? String(c.expected_status) : "",
      expected_keyword: c.expected_keyword ?? "",
      severity_on_down: c.severity_on_down, notify_on_down: c.notify_on_down, notify_on_recovery: c.notify_on_recovery,
    });
    setFormOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.target.trim()) { toast("error", "Name and target are required"); return; }
    setSaving(true);
    const body = {
      name: form.name.trim(),
      check_type: form.check_type,
      target: form.target.trim(),
      interval_seconds: Number(form.interval_seconds) || 120,
      timeout_seconds: Number(form.timeout_seconds) || 8,
      failures_to_down: Number(form.failures_to_down) || 3,
      successes_to_up: Number(form.successes_to_up) || 2,
      expected_status: form.expected_status ? Number(form.expected_status) : null,
      expected_keyword: form.expected_keyword.trim() || null,
      severity_on_down: form.severity_on_down,
      notify_on_down: form.notify_on_down,
      notify_on_recovery: form.notify_on_recovery,
    };
    try {
      if (editing) await updateAvailabilityCheck(editing.id, body);
      else await createAvailabilityCheck(body);
      toast("success", editing ? "Check updated" : "Check created", form.name);
      setFormOpen(false);
      await load();
    } catch (e: any) {
      if (e?.status === 409) { setSecBlocked(true); setFormOpen(false); }
      else toast("error", "Save failed", e instanceof Error ? e.message : "");
    } finally { setSaving(false); }
  };

  const runNow = async (c: AvailabilityCheck) => {
    setBusyId(c.id);
    try {
      const res = await runAvailabilityCheck(c.id);
      const label = String(res?.probe?.status_label ?? res?.check?.last_status ?? "done");
      toast("success", `Run now · ${label}`, res?.probe?.error ? String(res.probe.error) : res?.probe?.latency_ms ? `${res.probe.latency_ms}ms` : "");
      await refresh();
    } catch (e: any) {
      if (e?.status === 409) setSecBlocked(true);
      else toast("error", "Run failed", e instanceof Error ? e.message : "");
    } finally { setBusyId(null); }
  };

  const remove = async (c: AvailabilityCheck) => {
    if (!window.confirm(`Stop monitoring "${c.name}"? History incidents remain.`)) return;
    setBusyId(c.id);
    try {
      await deleteAvailabilityCheck(c.id);
      toast("success", "Check deleted", c.name);
      await load();
    } catch (e: any) {
      if (e?.status === 409) setSecBlocked(true);
      else toast("error", "Delete failed", e instanceof Error ? e.message : "");
    } finally { setBusyId(null); }
  };

  const toggleEnabled = async (c: AvailabilityCheck) => {
    try {
      await updateAvailabilityCheck(c.id, { enabled: !c.enabled });
      setChecks((list) => list.map((x) => (x.id === c.id ? { ...x, enabled: !c.enabled } : x)));
    } catch (e: any) {
      if (e?.status === 409) setSecBlocked(true);
      else toast("error", "Update failed", e instanceof Error ? e.message : "");
    }
  };

  const acknowledge = async (inc: AvailabilityIncident) => {
    try {
      await acknowledgeAvailabilityIncident(inc.id);
      toast("success", "Downtime acknowledged");
      await refresh();
    } catch (e) { toast("error", "Acknowledge failed", e instanceof Error ? e.message : ""); }
  };

  const markFp = async (inc: AvailabilityIncident) => {
    try {
      await markAvailabilityFalsePositive(inc.id);
      toast("success", "Marked false positive", "Excluded from MTTR / SLA");
      await refresh();
    } catch (e) { toast("error", "Update failed", e instanceof Error ? e.message : ""); }
  };

  const checksAgg = summary?.checks ?? {};
  const upCount = checksAgg.up ?? 0;
  const enabledCount = checksAgg.enabled ?? 0;
  const inputCls = "w-full rounded-lg border border-phantix-700/50 bg-phantix-950/60 px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-gold-400/40";

  if (secBlocked) {
    return (
      <Card>
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
          <AlertTriangle size={26} className="text-severity-medium" />
          <p className="text-sm font-semibold text-slate-200">Security database needs bootstrap</p>
          <p className="max-w-md text-xs leading-5 text-slate-500">Configure & bootstrap your Security Database (schema 1.7.0+) to use availability monitoring. Open Platform → Connections.</p>
        </div>
      </Card>
    );
  }

  if (loading) {
    return <div className="flex min-h-[30vh] items-center justify-center"><Spinner className="h-6 w-6" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open outages" value={<span className="text-severity-critical">{summary?.openIncidents ?? 0}</span>} icon={<WifiOff size={18} />} />
        <StatCard label="Checks healthy" value={<span className="text-emerald-400">{upCount}/{enabledCount || 0}</span>} icon={<Wifi size={18} />} />
        <StatCard label="Uptime snapshot" value={summary?.uptimePercentSnapshot != null ? `${summary.uptimePercentSnapshot}%` : "—"} icon={<Activity size={18} />} />
        <StatCard label="Median MTTR (7d)" value={<span className="font-mono text-sm">{formatDuration(summary?.mttrLast7d?.medianSeconds)}</span>} icon={<Clock size={18} />} />
      </div>

      {/* Open incidents */}
      <Card>
        <CardHeader
          title="Open downtime"
          subtitle="Live outages — elapsed time ticks while open"
          action={<button onClick={() => void refresh()} className="btn-ghost text-sm px-3 py-1.5"><RefreshCw size={14} /></button>}
        />
        {openIncidents.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">All monitors are up.</p>
        ) : (
          <div className="space-y-2">
            {openIncidents.map((inc) => (
              <div key={inc.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-severity-critical/30 bg-severity-critical/5 p-3.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-severity-critical/15 text-severity-critical"><WifiOff size={16} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-100">{inc.title}</p>
                  <p className="text-xs text-slate-500">Down since {timeAgo(inc.down_at)} · <span className="font-mono text-severity-critical">{formatDuration(inc.elapsed_seconds)}</span> elapsed{inc.source ? ` · ${titleCase(inc.source)}` : ""}</p>
                  {inc.last_error && <p className="mt-0.5 truncate font-mono text-[11px] text-slate-400">{inc.last_error}</p>}
                </div>
                <SeverityBadge severity={inc.severity as any} />
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setDetail(inc)} className="btn-ghost !px-2.5 !py-1.5 !text-[11px]"><ExternalLink size={12} className="mr-1 inline" /> Detail</button>
                  <button onClick={() => void acknowledge(inc)} className="btn-secondary !px-2.5 !py-1.5 !text-[11px]"><CheckCircle2 size={12} className="mr-1 inline" /> Acknowledge</button>
                  <button onClick={() => void markFp(inc)} className="btn-ghost !px-2.5 !py-1.5 !text-[11px] text-slate-400"><XCircle size={12} className="mr-1 inline" /> FP</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Recovered incidents (MTTR) */}
      <Card>
        <CardHeader title="Recovered (last 20)" subtitle="Time to resolve is logged on every recovery" />
        {recovered.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">No recovered incidents yet.</p>
        ) : (
          <div className="space-y-2">
            {recovered.map((inc) => (
              <div key={inc.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-phantix-700/40 bg-phantix-900/40 p-3.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-400/15 text-emerald-400"><CheckCircle2 size={16} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-200">{inc.title}</p>
                  <p className="text-xs text-slate-500">{timeAgo(inc.down_at)} → {inc.recovered_at ? timeAgo(inc.recovered_at) : "—"}</p>
                </div>
                {inc.excluded_from_sla && <span className="chip border-slate-500/50 bg-slate-500/10 text-[10px] text-slate-400">excluded</span>}
                <div className="text-right">
                  <p className="font-mono text-sm font-bold text-emerald-300">{formatDuration(inc.time_to_resolve_seconds)}</p>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">time to resolve</p>
                </div>
                <button onClick={() => setDetail(inc)} className="btn-ghost !px-2.5 !py-1.5 !text-[11px]"><ExternalLink size={12} className="mr-1 inline" /> Detail</button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Checks table */}
      <Card>
        <CardHeader
          title="Monitored checks"
          subtitle={`${checks.length} checks · HTTP/TCP/TLS/DNS probes`}
          action={<button onClick={openCreate} className="btn-primary !px-3.5 !py-2 !text-xs"><Plus size={13} className="mr-1 inline" /> Add check</button>}
        />
        {checks.length === 0 ? (
          <EmptyState icon={<Globe2 size={24} />} title="No monitors yet" body="Add an HTTP or TCP check for a client server or app." action={<button onClick={openCreate} className="btn-primary !text-xs"><Plus size={12} className="mr-1 inline" /> Add check</button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-phantix-700/40 text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Target</th>
                  <th className="px-3 py-2 font-medium">Latency</th>
                  <th className="px-3 py-2 font-medium">Fail streak</th>
                  <th className="px-3 py-2 font-medium">Last check</th>
                  <th className="px-3 py-2 font-medium">Enabled</th>
                  <th className="px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {checks.map((c) => (
                  <tr key={c.id} className="border-b border-phantix-800/40 last:border-0 hover:bg-phantix-800/30">
                    <td className="px-3 py-2.5">{statusChip(c.last_status)}</td>
                    <td className="px-3 py-2.5 text-sm font-medium text-slate-200">{c.name}</td>
                    <td className="px-3 py-2.5"><span className="chip font-mono text-[10px] text-slate-400">{c.check_type}</span></td>
                    <td className="px-3 py-2.5 font-mono text-xs text-slate-400">{c.target}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-slate-400">{c.last_latency_ms != null ? `${c.last_latency_ms}ms` : "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-400">{c.last_status === "down" ? <span className="text-severity-critical font-mono">{c.consecutive_failures}/{c.failures_to_down}</span> : <span className="font-mono">{c.consecutive_failures}/{c.failures_to_down}</span>}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-500">{c.last_checked_at ? timeAgo(c.last_checked_at) : "never"}</td>
                    <td className="px-3 py-2.5">
                      <button onClick={() => void toggleEnabled(c)} aria-label="Toggle check" className={cx("relative h-5 w-9 rounded-full transition-colors", c.enabled ? "bg-emerald-500/70" : "bg-slate-600")}>
                        <span className={cx("absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all", c.enabled ? "left-4.5 left-[18px]" : "left-0.5")} />
                      </button>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => void runNow(c)} disabled={busyId === c.id} className="rounded-lg border border-phantix-700/40 p-1.5 text-slate-400 hover:border-gold-400/40 hover:text-gold-300" title="Run now">
                          {busyId === c.id ? <Spinner className="h-3 w-3" /> : <Play size={12} />}
                        </button>
                        <button onClick={() => openEdit(c)} className="rounded-lg border border-phantix-700/40 p-1.5 text-slate-400 hover:border-gold-400/40 hover:text-gold-300" title="Edit"><Pencil size={12} /></button>
                        <button onClick={() => void remove(c)} disabled={busyId === c.id} className="rounded-lg border border-phantix-700/40 p-1.5 text-slate-500 hover:border-severity-critical/40 hover:text-severity-critical" title="Delete"><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Integrations help */}
      <Card>
        <CardHeader title="Integrations" subtitle="Webhooks, agents, and external tools" action={<Terminal size={16} className="text-gold-400" />} />
        <div className="grid grid-cols-1 gap-3 text-xs text-slate-400 md:grid-cols-2">
          <div className="rounded-xl border border-phantix-700/40 bg-phantix-950/50 p-3">
            <p className="font-semibold text-slate-200">External tool events</p>
            <p className="mt-1 leading-5">Any tool (Uptime Kuma, Healthchecks, Alertmanager) can open/close MTTR-tracked incidents:</p>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-phantix-950/80 p-2.5 font-mono text-[10px] text-slate-300">{"POST /api/v1/soc/availability/events\n{ \"event\": \"down\", \"target\": \"https://app/client.com\", \"title\": \"API production\", \"source\": \"uptime_kuma\" }"}</pre>
          </div>
          <div className="rounded-xl border border-phantix-700/40 bg-phantix-950/50 p-3">
            <p className="font-semibold text-slate-200">Private-server agent</p>
            <p className="mt-1 leading-5">Heartbeat every 30–60s from servers behind NAT. Missed heartbeats open downtime:</p>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-phantix-950/80 p-2.5 font-mono text-[10px] text-slate-300">{"POST /api/v1/soc/availability/heartbeat\n{ \"host\": \"app-prod-1\", \"status\": \"up\" }"}</pre>
          </div>
        </div>
      </Card>

      {/* Create / edit check modal */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? `Edit check — ${editing.name}` : "Add monitor"} wide>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Name *</label>
              <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Production API health" />
            </div>
            <div>
              <label className="label">Type</label>
              <select className={inputCls} value={form.check_type} onChange={(e) => setForm({ ...form, check_type: e.target.value })}>
                {CHECK_TYPES.map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Target *</label>
            <input className={inputCls} value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} placeholder="https://api.client.com/health  ·  host:port  ·  hostname" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="label">Interval (s)</label><input type="number" min={30} max={900} className={inputCls} value={form.interval_seconds} onChange={(e) => setForm({ ...form, interval_seconds: Number(e.target.value) })} /></div>
            <div><label className="label">Timeout (s)</label><input type="number" min={1} max={60} className={inputCls} value={form.timeout_seconds} onChange={(e) => setForm({ ...form, timeout_seconds: Number(e.target.value) })} /></div>
            <div><label className="label">Failures to down</label><input type="number" min={1} max={20} className={inputCls} value={form.failures_to_down} onChange={(e) => setForm({ ...form, failures_to_down: Number(e.target.value) })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Expected HTTP status (HTTP)</label><input className={inputCls} value={form.expected_status} onChange={(e) => setForm({ ...form, expected_status: e.target.value })} placeholder="200" /></div>
            <div><label className="label">Expected keyword</label><input className={inputCls} value={form.expected_keyword} onChange={(e) => setForm({ ...form, expected_keyword: e.target.value })} placeholder='e.g. {"status":"ok"}' /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Severity when down</label>
              <select className={inputCls} value={form.severity_on_down} onChange={(e) => setForm({ ...form, severity_on_down: e.target.value })}>
                <option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
              </select>
            </div>
            <div className="flex items-end gap-4 pb-1">
              <label className="flex items-center gap-1.5 text-xs text-slate-300"><input type="checkbox" checked={form.notify_on_down} onChange={(e) => setForm({ ...form, notify_on_down: e.target.checked })} className="accent-[rgb(var(--gold-400))]" /> Notify down</label>
              <label className="flex items-center gap-1.5 text-xs text-slate-300"><input type="checkbox" checked={form.notify_on_recovery} onChange={(e) => setForm({ ...form, notify_on_recovery: e.target.checked })} className="accent-[rgb(var(--gold-400))]" /> Notify recovery</label>
            </div>
          </div>
          <p className="text-[10px] text-slate-500">Critical downtime also notifies email / WhatsApp / Telegram per Alerts settings when configured.</p>
          <button onClick={() => void save()} disabled={saving} className="btn-primary w-full !py-2.5 !text-xs">{saving ? <Spinner className="h-3 w-3" /> : editing ? <Pencil size={13} /> : <Plus size={13} />} {editing ? "Save check" : "Create check"}</button>
        </div>
      </Modal>

      {/* Incident detail drawer */}
      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title={detail?.title ?? "Incident"} wide>
        {detail && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={detail.status} />
              <SeverityBadge severity={detail.severity as any} />
              <span className="chip border-phantix-600/40 bg-phantix-800/50 text-[10px] text-slate-400">{titleCase(detail.source)}</span>
              {detail.excluded_from_sla && <span className="chip border-slate-500/50 bg-slate-500/10 text-[10px] text-slate-400">excluded from SLA</span>}
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg bg-phantix-950/60 p-3"><p className="text-slate-500">Down at</p><p className="mt-1 font-mono text-slate-200">{new Date(detail.down_at).toLocaleString()}</p></div>
              <div className="rounded-lg bg-phantix-950/60 p-3"><p className="text-slate-500">Recovered at</p><p className="mt-1 font-mono text-slate-200">{detail.recovered_at ? new Date(detail.recovered_at).toLocaleString() : "—"}</p></div>
              <div className="rounded-lg bg-emerald-400/10 p-3"><p className="text-emerald-300">Time to resolve</p><p className="mt-1 font-mono text-lg font-bold text-emerald-300">{formatDuration(detail.time_to_resolve_seconds)}</p></div>
              <div className="rounded-lg bg-phantix-950/60 p-3"><p className="text-slate-500">Time to acknowledge</p><p className="mt-1 font-mono text-slate-200">{formatDuration(detail.time_to_acknowledge_seconds)}</p></div>
            </div>
            {detail.last_error && <div className="rounded-lg bg-severity-critical/10 p-3 font-mono text-[11px] text-red-300">{detail.last_error}</div>}
            {detail.evidence && Object.keys(detail.evidence).length > 0 && (
              <details>
                <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-200">Evidence</summary>
                <pre className="mt-2 overflow-x-auto rounded-lg bg-phantix-950/60 p-3 text-[11px] text-slate-400">{JSON.stringify(detail.evidence, null, 2)}</pre>
              </details>
            )}
            {detail.soc_detection_id && (
              <p className="flex items-center gap-1.5 text-xs text-gold-300"><ShieldCheck size={12} /> SOC detection #{detail.soc_detection_id}</p>
            )}
            <div className="flex items-center gap-2">
              {detail.status === "open" && (
                <>
                  <button onClick={() => { void acknowledge(detail); setDetail(null); }} className="btn-secondary flex-1 !py-2 !text-xs"><CheckCircle2 size={13} className="mr-1 inline" /> Acknowledge</button>
                  <button onClick={() => { void markFp(detail); setDetail(null); }} className="btn-ghost flex-1 !py-2 !text-xs"><XCircle size={13} className="mr-1 inline" /> False positive</button>
                </>
              )}
              <button onClick={() => setDetail(null)} className="btn-primary flex-1 !py-2 !text-xs">Close</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
