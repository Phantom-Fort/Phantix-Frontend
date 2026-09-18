import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Plus,
  Play,
  Pencil,
  Trash2,
  RefreshCw,
  Radar,
  Lock,
  ShieldAlert,
  Clock,
  Globe,
  CheckCircle2,
} from "lucide-react";
import {
  PageHeader,
  Card,
  StatCard,
  StatusBadge,
  SeverityBadge,
  Modal,
  Tabs,
  PageSkeleton,
  ErrorState,
  EmptyState,
  Spinner,
} from "@sg/ui";
import SecurityDbBanner from "@sg/components/SecurityDbBanner";
import { useResource } from "@sg/useResource";
import { useStore } from "@sg/store";
import { isSecurityDbBlocked } from "@sg/api";
import { timeAgo, cx } from "@sg/utils";
import type { Severity } from "@sg/types";
import {
  listMonitors,
  listIncidents,
  endpointSummary,
  createMonitor,
  updateMonitor,
  deleteMonitor,
  runMonitor,
  listResults,
  acknowledgeIncident,
  falsePositiveIncident,
  blankMonitor,
  ISSUE_LABELS,
  type EndpointMonitor,
  type EndpointIncident,
  type EndpointResult,
  type EndpointSummary,
} from "@sg/endpointMonitoringOps";

interface Bundle {
  summary: EndpointSummary | null;
  monitors: EndpointMonitor[];
  incidents: EndpointIncident[];
  securityDbBlocked: boolean;
  error: string | null;
}

const EMPTY: Bundle = { summary: null, monitors: [], incidents: [], securityDbBlocked: false, error: null };

async function loadEndpointBundle(): Promise<Bundle> {
  try {
    const [summary, monitors, incidents] = await Promise.all([
      endpointSummary(),
      listMonitors(),
      listIncidents({ status: "open", limit: 100 }),
    ]);
    return { summary, monitors: monitors.items, incidents: incidents.items, securityDbBlocked: false, error: null };
  } catch (err) {
    if (isSecurityDbBlocked(err)) return { ...EMPTY, securityDbBlocked: true };
    return { ...EMPTY, error: err instanceof Error ? err.message : "Failed to load endpoint monitors" };
  }
}

// ── Form model (a subset of the monitor, edited in the modal) ──────────────────
type FormState = {
  id: number | null;
  name: string;
  url: string;
  method: string;
  authType: string;
  authToken: string;
  authUser: string;
  authPass: string;
  authHeader: string;
  authValue: string;
  authCookie: string;
  expectedStatus: string;
  expectedKeyword: string;
  requiredKeys: string;
  latencyMs: string;
  tlsExpiryDays: string;
  allowUnauth: boolean;
  checkTls: boolean;
  checkAuth: boolean;
  checkDrift: boolean;
  intervalSeconds: string;
  timeoutSeconds: string;
  severity: string;
  enabled: boolean;
};

function formFromMonitor(m: EndpointMonitor | null): FormState {
  const base = m ?? blankMonitor();
  const auth = (base.auth ?? {}) as Record<string, string>;
  const th = (base.thresholds ?? {}) as Record<string, unknown>;
  const sc = (base.security_checks ?? {}) as Record<string, unknown>;
  const schema = (base.expected_body_schema ?? {}) as { required?: string[] };
  return {
    id: m && m.id ? m.id : null,
    name: base.name,
    url: base.url,
    method: base.method || "GET",
    authType: String(auth.type ?? auth.mode ?? "none"),
    authToken: String(auth.token ?? ""),
    authUser: String(auth.username ?? ""),
    authPass: String(auth.password ?? ""),
    authHeader: String(auth.header ?? auth.header_name ?? "X-API-Key"),
    authValue: String(auth.value ?? ""),
    authCookie: String(auth.cookie ?? ""),
    expectedStatus: base.expected_status != null ? String(base.expected_status) : "",
    expectedKeyword: base.expected_keyword ?? "",
    requiredKeys: Array.isArray(schema.required) ? schema.required.join(", ") : "",
    latencyMs: th.latency_ms != null ? String(th.latency_ms) : "",
    tlsExpiryDays: th.tls_expiry_days != null ? String(th.tls_expiry_days) : "14",
    allowUnauth: Boolean(th.allow_unauth),
    checkTls: sc.tls !== false,
    checkAuth: sc.auth_enforced !== false,
    checkDrift: sc.drift !== false,
    intervalSeconds: String(base.interval_seconds || 120),
    timeoutSeconds: String(base.timeout_seconds || 8),
    severity: base.severity || "high",
    enabled: base.enabled !== false,
  };
}

function payloadFromForm(f: FormState) {
  let auth: Record<string, string> = {};
  if (f.authType === "bearer") {
    auth = { type: "bearer", token: f.authToken.trim() };
  } else if (f.authType === "basic") {
    auth = { type: "basic", username: f.authUser.trim(), password: f.authPass };
  } else if (f.authType === "api_key") {
    auth = { type: "api_key", header: f.authHeader.trim() || "X-API-Key", value: f.authValue.trim() };
  } else if (f.authType === "cookie") {
    auth = { type: "cookie", cookie: f.authCookie.trim() };
  }

  const thresholds: Record<string, unknown> = { tls_expiry_days: Number(f.tlsExpiryDays || 14), allow_unauth: f.allowUnauth };
  if (f.latencyMs.trim()) thresholds.latency_ms = Number(f.latencyMs);

  const required = f.requiredKeys.split(",").map((s) => s.trim()).filter(Boolean);

  return {
    name: f.name.trim(),
    url: f.url.trim(),
    method: f.method,
    auth,
    expected_status: f.expectedStatus.trim() ? Number(f.expectedStatus) : null,
    expected_keyword: f.expectedKeyword.trim() || null,
    expected_body_schema: required.length ? { required } : {},
    thresholds,
    security_checks: { tls: f.checkTls, auth_enforced: f.checkAuth, drift: f.checkDrift },
    interval_seconds: Number(f.intervalSeconds || 120),
    timeout_seconds: Number(f.timeoutSeconds || 8),
    severity: f.severity,
    enabled: f.enabled,
  };
}

function PostureChips({ posture }: { posture: Record<string, unknown> }) {
  const chips: string[] = [];
  const days = posture.tls_days_until_expiry;
  if (typeof days === "number") chips.push(`TLS ${days}d`);
  if (posture.auth_enforced === false) chips.push("auth open");
  else if (posture.auth_enforced === true) chips.push("auth ✓");
  if (posture.drift) chips.push("drift");
  if (posture.latency_over_threshold) chips.push("slow");
  if (!chips.length) return <span className="text-slate-600">—</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <span key={c} className="rounded-md bg-phantix-800/80 px-2 py-0.5 text-[11px] font-medium text-slate-400">{c}</span>
      ))}
    </div>
  );
}

export default function EndpointMonitoring() {
  const { toast, requireDualControl } = useStore();
  const { data, loading, error, reload } = useResource(loadEndpointBundle, EMPTY, "endpoint-monitoring");
  const [tab, setTab] = useState("monitors");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(() => formFromMonitor(null));
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [detail, setDetail] = useState<EndpointMonitor | null>(null);

  const monitors = data.monitors;
  const incidents = data.incidents;
  const summary = data.summary;

  const openCreate = () => {
    setForm(formFromMonitor(null));
    setFormOpen(true);
  };
  const openEdit = (m: EndpointMonitor) => {
    setForm(formFromMonitor(m));
    setFormOpen(true);
  };

  const patch = (p: Partial<FormState>) => setForm((f) => ({ ...f, ...p }));

  const submit = async () => {
    if (!form.name.trim() || !form.url.trim()) {
      toast("warning", "Missing details", "Name and URL are required.");
      return;
    }
    if (!(await requireDualControl("Saving an endpoint monitor requires a dual-control operate session."))) return;
    setSaving(true);
    try {
      const body = payloadFromForm(form);
      if (form.id) {
        await updateMonitor(form.id, body);
        toast("success", "Monitor updated", `${body.name} was saved.`);
      } else {
        await createMonitor(body);
        toast("success", "Monitor created", `${body.name} is now monitored 24/7.`);
      }
      setFormOpen(false);
      reload();
    } catch (err) {
      toast("error", "Save failed", err instanceof Error ? err.message : "Could not save the monitor.");
    } finally {
      setSaving(false);
    }
  };

  const runNow = async (m: EndpointMonitor) => {
    if (!(await requireDualControl("Running a probe requires a dual-control operate session."))) return;
    setBusyId(m.id);
    try {
      const res = await runMonitor(m.id);
      const opened = res.opened_incidents?.length ?? 0;
      toast(
        res.probe.status_label === "down" ? "error" : opened ? "warning" : "success",
        `Probe: ${res.probe.status_label}`,
        opened ? `${opened} new issue(s) raised.` : "No new issues.",
      );
      reload();
    } catch (err) {
      toast("error", "Probe failed", err instanceof Error ? err.message : "Could not run the probe.");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (m: EndpointMonitor) => {
    if (!(await requireDualControl("Deleting an endpoint monitor requires a dual-control operate session."))) return;
    setBusyId(m.id);
    try {
      await deleteMonitor(m.id);
      toast("success", "Monitor deleted", `${m.name} is no longer monitored.`);
      reload();
    } catch (err) {
      toast("error", "Delete failed", err instanceof Error ? err.message : "Could not delete the monitor.");
    } finally {
      setBusyId(null);
    }
  };

  const ackIncident = async (inc: EndpointIncident) => {
    if (!(await requireDualControl("Acknowledging an incident requires a dual-control operate session."))) return;
    try {
      await acknowledgeIncident(inc.id);
      toast("success", "Acknowledged", inc.title);
      reload();
    } catch (err) {
      toast("error", "Failed", err instanceof Error ? err.message : "Could not acknowledge.");
    }
  };

  const fpIncident = async (inc: EndpointIncident) => {
    if (!(await requireDualControl("Marking a false positive requires a dual-control operate session."))) return;
    try {
      await falsePositiveIncident(inc.id);
      toast("info", "Marked false positive", inc.title);
      reload();
    } catch (err) {
      toast("error", "Failed", err instanceof Error ? err.message : "Could not update.");
    }
  };

  if (loading) return <PageSkeleton variant="list" rows={6} actions />;

  if (error && monitors.length === 0 && !data.securityDbBlocked) {
    return <ErrorState onRetry={reload} body="We could not load endpoint monitors. Check your connection and retry — your session stays signed in." />;
  }

  const mstats = summary?.monitors ?? {};

  return (
    <div>
      <PageHeader
        title="Endpoint monitoring"
        description="The standard 24/7 monitor for your own endpoints. Set the expected response, flagging thresholds and access preconditions per endpoint; we watch health and security posture (TLS, auth enforcement, response drift) and raise incidents."
        actions={
          <button className="btn-primary" onClick={openCreate}>
            <Plus size={15} /> New monitor
          </button>
        }
      />

      {data.securityDbBlocked && <SecurityDbBanner message={data.error} />}

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Monitors" value={mstats.total ?? monitors.length} hint={`${mstats.enabled ?? 0} enabled`} />
        <StatCard label="Up" value={mstats.up ?? 0} />
        <StatCard label="Degraded" value={mstats.degraded ?? 0} />
        <StatCard label="Down" value={mstats.down ?? 0} />
        <StatCard
          label="Posture score"
          value={summary?.postureScore != null ? summary.postureScore : "—"}
          hint={`${summary?.openIncidents ?? incidents.length} open incident(s)`}
        />
      </div>

      <Tabs
        tabs={[
          { id: "monitors", label: "Monitors", count: monitors.length },
          { id: "incidents", label: "Incidents", count: incidents.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "monitors" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          {monitors.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Radar size={22} />}
                title="No endpoint monitors yet"
                body="Add an endpoint with its expected response, thresholds and auth preconditions to start continuous monitoring."
                action={<button className="btn-primary" onClick={openCreate}><Plus size={15} /> New monitor</button>}
              />
            </Card>
          ) : (
            <Card className="!p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-phantix-700/40">
                      <th className="th">Name</th>
                      <th className="th">Endpoint</th>
                      <th className="th">Status</th>
                      <th className="th">Latency</th>
                      <th className="th">Posture</th>
                      <th className="th">Checked</th>
                      <th className="th text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monitors.map((m) => (
                      <tr key={m.id} className="border-b border-phantix-800/40 hover:bg-phantix-800/35">
                        <td className="td">
                          <button className="text-left font-medium text-slate-200 hover:text-gold-300" onClick={() => setDetail(m)}>
                            {m.name}
                          </button>
                          {!m.enabled && <span className="ml-2 rounded bg-phantix-800/80 px-1.5 py-0.5 text-[10px] uppercase text-slate-500">paused</span>}
                        </td>
                        <td className="td">
                          <span className="inline-flex items-center gap-1.5 font-mono text-xs text-slate-400">
                            <span className="rounded bg-phantix-800/80 px-1.5 py-0.5 text-[10px] uppercase text-slate-400">{m.method}</span>
                            <span className="max-w-[280px] truncate">{m.url}</span>
                          </span>
                        </td>
                        <td className="td"><StatusBadge status={m.last_status === "up" ? "ready" : m.last_status} /></td>
                        <td className="td text-xs text-slate-400">{m.last_latency_ms != null ? `${m.last_latency_ms} ms` : "—"}</td>
                        <td className="td"><PostureChips posture={m.last_posture ?? {}} /></td>
                        <td className="td whitespace-nowrap text-xs text-slate-500">{m.last_checked_at ? timeAgo(m.last_checked_at) : "never"}</td>
                        <td className="td">
                          <div className="flex items-center justify-end gap-1.5">
                            <button className="btn-secondary !px-2 !py-1" title="Run now" disabled={busyId === m.id} onClick={() => runNow(m)}>
                              {busyId === m.id ? <Spinner className="h-3.5 w-3.5" /> : <Play size={13} />}
                            </button>
                            <button className="btn-secondary !px-2 !py-1" title="Edit" onClick={() => openEdit(m)}><Pencil size={13} /></button>
                            <button className="btn-secondary !px-2 !py-1 hover:!text-severity-critical" title="Delete" disabled={busyId === m.id} onClick={() => remove(m)}><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </motion.div>
      )}

      {tab === "incidents" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          {incidents.length === 0 ? (
            <Card>
              <EmptyState icon={<CheckCircle2 size={22} />} title="No open incidents" body="Every monitored endpoint is healthy and passing its security checks." />
            </Card>
          ) : (
            <Card className="!p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-phantix-700/40">
                      <th className="th">Issue</th>
                      <th className="th">Title</th>
                      <th className="th">Severity</th>
                      <th className="th">Open for</th>
                      <th className="th">Detail</th>
                      <th className="th text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incidents.map((inc) => (
                      <tr key={inc.id} className="border-b border-phantix-800/40 hover:bg-phantix-800/35">
                        <td className="td">
                          <span className="inline-flex items-center gap-1.5">
                            <span className={cx("flex h-6 w-6 items-center justify-center rounded-md", inc.issue_type === "down" ? "bg-severity-critical/15 text-severity-critical" : "bg-phantix-800/70 text-phantix-300")}>
                              {inc.issue_type === "tls" ? <Lock size={12} /> : inc.issue_type === "auth" ? <ShieldAlert size={12} /> : <Activity size={12} />}
                            </span>
                            <span className="text-xs font-medium text-slate-300">{ISSUE_LABELS[inc.issue_type] ?? inc.issue_type}</span>
                          </span>
                        </td>
                        <td className="td text-sm text-slate-200">{inc.title}</td>
                        <td className="td"><SeverityBadge severity={inc.severity as Severity} /></td>
                        <td className="td whitespace-nowrap text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1"><Clock size={11} />{inc.elapsed_seconds != null ? fmtDuration(inc.elapsed_seconds) : (inc.down_at ? timeAgo(inc.down_at) : "—")}</span>
                        </td>
                        <td className="td max-w-[280px] truncate text-xs text-slate-400" title={inc.last_error ?? ""}>{inc.last_error ?? "—"}</td>
                        <td className="td">
                          <div className="flex items-center justify-end gap-1.5">
                            {!inc.acknowledged_at && <button className="btn-secondary !px-2.5 !py-1 text-xs" onClick={() => ackIncident(inc)}>Acknowledge</button>}
                            <button className="btn-secondary !px-2.5 !py-1 text-xs" onClick={() => fpIncident(inc)}>False positive</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </motion.div>
      )}

      <MonitorForm open={formOpen} form={form} saving={saving} onClose={() => setFormOpen(false)} onChange={patch} onSubmit={submit} />
      {detail && <MonitorDetail monitor={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function fmtDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

// ── Create / edit form ─────────────────────────────────────────────────────────
function MonitorForm({
  open,
  form,
  saving,
  onClose,
  onChange,
  onSubmit,
}: {
  open: boolean;
  form: FormState;
  saving: boolean;
  onClose: () => void;
  onChange: (p: Partial<FormState>) => void;
  onSubmit: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={form.id ? "Edit monitor" : "New endpoint monitor"} wide>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="label">Name</label>
            <input className="input" placeholder="Orders API" value={form.name} onChange={(e) => onChange({ name: e.target.value })} />
          </div>
          <div>
            <label className="label">Method</label>
            <select className="input" value={form.method} onChange={(e) => onChange({ method: e.target.value })}>
              {["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"].map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label">URL</label>
          <input className="input" placeholder="https://api.example.com/v1/health" value={form.url} onChange={(e) => onChange({ url: e.target.value })} />
        </div>

        {/* Access preconditions */}
        <fieldset className="rounded-xl border border-phantix-700/50 bg-phantix-950/50 p-3.5">
          <legend className="px-1 text-[12px] font-semibold uppercase tracking-wider text-slate-400">Access preconditions</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Auth type</label>
              <select className="input" value={form.authType} onChange={(e) => onChange({ authType: e.target.value })}>
                <option value="none">None (public)</option>
                <option value="bearer">Bearer token</option>
                <option value="basic">Basic</option>
                <option value="api_key">API key header</option>
                <option value="cookie">Cookie</option>
              </select>
            </div>
            {form.authType === "bearer" && (
              <div>
                <label className="label">Token</label>
                <input className="input" type="password" value={form.authToken} onChange={(e) => onChange({ authToken: e.target.value })} />
              </div>
            )}
            {form.authType === "basic" && (
              <>
                <div>
                  <label className="label">Username</label>
                  <input className="input" value={form.authUser} onChange={(e) => onChange({ authUser: e.target.value })} />
                </div>
                <div>
                  <label className="label">Password</label>
                  <input className="input" type="password" value={form.authPass} onChange={(e) => onChange({ authPass: e.target.value })} />
                </div>
              </>
            )}
            {form.authType === "api_key" && (
              <>
                <div>
                  <label className="label">Header name</label>
                  <input className="input" value={form.authHeader} onChange={(e) => onChange({ authHeader: e.target.value })} />
                </div>
                <div>
                  <label className="label">Value</label>
                  <input className="input" type="password" value={form.authValue} onChange={(e) => onChange({ authValue: e.target.value })} />
                </div>
              </>
            )}
            {form.authType === "cookie" && (
              <div className="sm:col-span-2">
                <label className="label">Cookie</label>
                <input className="input" value={form.authCookie} onChange={(e) => onChange({ authCookie: e.target.value })} />
              </div>
            )}
          </div>
        </fieldset>

        {/* Expected response */}
        <fieldset className="rounded-xl border border-phantix-700/50 bg-phantix-950/50 p-3.5">
          <legend className="px-1 text-[12px] font-semibold uppercase tracking-wider text-slate-400">Expected response</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="label">Status</label>
              <input className="input" inputMode="numeric" placeholder="200" value={form.expectedStatus} onChange={(e) => onChange({ expectedStatus: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Keyword in body</label>
              <input className="input" placeholder="ok" value={form.expectedKeyword} onChange={(e) => onChange({ expectedKeyword: e.target.value })} />
            </div>
            <div className="sm:col-span-3">
              <label className="label">Required JSON keys (comma-separated)</label>
              <input className="input" placeholder="id, status" value={form.requiredKeys} onChange={(e) => onChange({ requiredKeys: e.target.value })} />
            </div>
          </div>
        </fieldset>

        {/* Thresholds + checks */}
        <fieldset className="rounded-xl border border-phantix-700/50 bg-phantix-950/50 p-3.5">
          <legend className="px-1 text-[12px] font-semibold uppercase tracking-wider text-slate-400">Thresholds &amp; security checks</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="label">Latency threshold (ms)</label>
              <input className="input" inputMode="numeric" placeholder="800" value={form.latencyMs} onChange={(e) => onChange({ latencyMs: e.target.value })} />
            </div>
            <div>
              <label className="label">TLS expiry warn (days)</label>
              <input className="input" inputMode="numeric" value={form.tlsExpiryDays} onChange={(e) => onChange({ tlsExpiryDays: e.target.value })} />
            </div>
            <div>
              <label className="label">Severity</label>
              <select className="input" value={form.severity} onChange={(e) => onChange({ severity: e.target.value })}>
                {["critical", "high", "medium", "low"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
              <input type="checkbox" className="h-3.5 w-3.5 accent-gold-400" checked={form.checkTls} onChange={(e) => onChange({ checkTls: e.target.checked })} /> Check TLS
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
              <input type="checkbox" className="h-3.5 w-3.5 accent-gold-400" checked={form.checkAuth} onChange={(e) => onChange({ checkAuth: e.target.checked })} /> Check auth enforced
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
              <input type="checkbox" className="h-3.5 w-3.5 accent-gold-400" checked={form.checkDrift} onChange={(e) => onChange({ checkDrift: e.target.checked })} /> Check response drift
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
              <input type="checkbox" className="h-3.5 w-3.5 accent-gold-400" checked={form.allowUnauth} onChange={(e) => onChange({ allowUnauth: e.target.checked })} /> Endpoint is public (allow unauthenticated)
            </label>
          </div>
        </fieldset>

        {/* Schedule */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="label">Interval (s)</label>
            <input className="input" inputMode="numeric" value={form.intervalSeconds} onChange={(e) => onChange({ intervalSeconds: e.target.value })} />
          </div>
          <div>
            <label className="label">Timeout (s)</label>
            <input className="input" inputMode="numeric" value={form.timeoutSeconds} onChange={(e) => onChange({ timeoutSeconds: e.target.value })} />
          </div>
          <div className="flex items-end">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
              <input type="checkbox" className="h-3.5 w-3.5 accent-gold-400" checked={form.enabled} onChange={(e) => onChange({ enabled: e.target.checked })} /> Enabled (monitored 24/7)
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? <Spinner className="h-4 w-4" /> : <Globe size={14} />} {form.id ? "Save changes" : "Create monitor"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Monitor detail (recent probe results) ──────────────────────────────────────
function MonitorDetail({ monitor, onClose }: { monitor: EndpointMonitor; onClose: () => void }) {
  const { data, loading } = useResource(() => listResults(monitor.id, 25), { items: [] as EndpointResult[] });
  const results = useMemo(() => data.items, [data]);
  return (
    <Modal open onClose={onClose} title={monitor.name} wide>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-slate-400">
          <span className="rounded bg-phantix-800/80 px-1.5 py-0.5 uppercase">{monitor.method}</span>
          <span>{monitor.url}</span>
          <StatusBadge status={monitor.last_status === "up" ? "ready" : monitor.last_status} />
        </div>
        <div className="rounded-xl border border-phantix-700/40 bg-phantix-950/50 p-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Latest posture</p>
          <PostureChips posture={monitor.last_posture ?? {}} />
        </div>
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Recent probes</p>
          {loading ? (
            <div className="flex justify-center py-6"><Spinner /></div>
          ) : results.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">No probe results yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-phantix-700/40">
                    <th className="th">When</th>
                    <th className="th">Status</th>
                    <th className="th">HTTP</th>
                    <th className="th">Latency</th>
                    <th className="th">Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.id} className="border-b border-phantix-800/40">
                      <td className="td whitespace-nowrap text-xs text-slate-500">{r.checked_at ? timeAgo(r.checked_at) : "—"}</td>
                      <td className="td"><StatusBadge status={r.status_label === "up" ? "ready" : r.status_label} /></td>
                      <td className="td text-xs text-slate-400">{r.http_status ?? "—"}</td>
                      <td className="td text-xs text-slate-400">{r.latency_ms != null ? `${r.latency_ms} ms` : "—"}</td>
                      <td className="td text-xs text-slate-400">
                        {r.issues.length ? r.issues.map((i) => ISSUE_LABELS[i.type] ?? i.type).join(", ") : <span className="text-slate-600">none</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
