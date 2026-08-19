import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity, Gauge, Shield, Wifi, Monitor, Clock, AlertTriangle, Crosshair,
  BellRing, FileText, Plus, RefreshCw, Search, UserCheck, XCircle, CheckCircle2,
  ArrowUpRight, MessageSquarePlus, Play, Pause, Trash2, BookOpen, ChevronRight, Radio,
} from "lucide-react";
import { PageHeader, Card, CardHeader, SeverityBadge, StatusBadge, EmptyState, Modal, Tabs, Spinner, StatCard } from "@/components/ui";
import SecurityDbBanner from "@/components/SecurityDbBanner";
import SocAvailability from "@/components/SocAvailability";
import { useResource } from "@/lib/useResource";
import {
  loadSocStatus, loadSocDashboard, loadSocDetections,
  createSocDetection, patchSocDetection, escalateSocDetection,
  loadSocCases, loadSocCase, createSocCase, patchSocCase, addSocCaseNote,
  loadSocRules, createSocRule, patchSocRule, deleteSocRule, seedSocRules,
  loadSocAdapters, ingestSocWebhook,
  loadIntelligenceDashboard,
} from "@/lib/data";
import { useStore } from "@/lib/store";
import { timeAgo, cx, titleCase } from "@/lib/utils";
import { useSseStream, type SseEvent } from "@/lib/useSse";
import type {
  SocStatus, SocDashboardScaffold, SocDetection, SocCase, SocRule, SocAdapter,
  IntelligenceDashboard, SocCaseNote,
} from "@/lib/types";

const emptySoc: SocDashboardScaffold = { organizationId: 0, status: "implemented", generatedAt: "", panels: [], liveSubscribers: 0, message: "" };
const emptyIntel: IntelligenceDashboard = { posture_score: 0, total_assets: 0, verified_count: 0, unscanned_count: 0 };

const DET_STATUSES = ["open", "acknowledged", "assigned", "escalated", "closed"] as const;
const CASE_STATUSES = ["open", "investigating", "contained", "closed"] as const;

function sevOf(sev: string | undefined): "critical" | "high" | "medium" | "low" | "info" {
  return (["critical", "high", "medium", "low", "info"] as const).includes(sev as any) ? (sev as any) : "info";
}

function ssePayloadLabel(evt: string, payload: Record<string, unknown>): string {
  switch (evt) {
    case "socDetectionMatched": return `Detection matched: ${String(payload.title ?? `#${payload.detectionId}`)}`;
    case "socDetectionUpdated": return `Detection updated: ${String(payload.title ?? `#${payload.detectionId}`)}`;
    case "socTriageAssigned": return `Triage assigned to ${String(payload.assigneeRef ?? "analyst")}`;
    case "socTriageUpdated": return `Triage updated on #${String(payload.detectionId ?? "")}`;
    case "socAlertRaised": return `Alert raised: ${String(payload.title ?? "")}`;
    case "socCaseOpened": return `Case opened: ${String(payload.title ?? `#${payload.caseId}`)}`;
    case "riskScoreChanged": return `Risk changed on ${String(payload.value ?? `#${payload.assetId}`)}`;
    case "assetDiscovered": return `New asset ${String(payload.value ?? `#${payload.assetId}`)}`;
    case "newFindingOnAsset": return `New finding on ${String(payload.value ?? `#${payload.assetId}`)}`;
    case "assetUpdated": case "intelligenceUpdated": return `Intel updated for ${String(payload.value ?? `#${payload.assetId}`)}`;
    case "heartbeat": return "Heartbeat";
    default: return `${evt} event`;
  }
}

export default function SocDashboard() {
  const { toast } = useStore();
  const [tab, setTab] = useState("overview");
  const [statusFilter, setStatusFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [query, setQuery] = useState("");

  // Live SSE stream (soc_dashboard/stream)
  const { connected: liveConnected, events: liveEvents } = useSseStream("/soc/dashboard/stream", {
    onEvent: useCallback((evt: SseEvent) => {
      const payload = (evt.data && typeof evt.data === "object" ? evt.data : {}) as Record<string, unknown>;
      if (evt.event === "socDetectionMatched") {
        setQueueTick((t) => t + 1);
      }
    }, []),
  });
  const [queueTick, setQueueTick] = useState(0);

  const status = useResource<SocStatus | null>(() => loadSocStatus().then((d) => d ?? null), null, "soc-status");
  const socData = useResource<SocDashboardScaffold>(() => loadSocDashboard().then((d) => d ?? emptySoc), emptySoc, "soc-dashboard");
  const intelData = useResource<IntelligenceDashboard>(() => loadIntelligenceDashboard().then((d) => d ?? emptyIntel), emptyIntel);

  const queue = useResource<SocDetection[]>(
    async () => {
      const r = await loadSocDetections({ openOnly: true, limit: 200 });
      return r.items ?? [];
    },
    [],
    "soc-queue",
  );

  // Reload queue when a live detection event arrives or triage actions happen
  const reloadQueue = useCallback(() => {
    queue.reload();
    status.reload();
    socData.reload();
  }, [queue, status, socData]);
  useEffect(() => {
    if (queueTick > 0) reloadQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueTick]);

  const filtered = useMemo(
    () => (queue.data ?? []).filter((d) => {
      if (statusFilter && d.status !== statusFilter) return false;
      if (severityFilter && d.severity !== severityFilter) return false;
      if (query && !`${d.title} ${d.summary ?? ""} ${d.assignee_ref ?? ""}`.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    }),
    [queue.data, statusFilter, severityFilter, query],
  );

  const score = intelData.data?.postureScore ?? intelData.data?.posture_score ?? 68;
  const queueAgg = status.data?.queue;
  const openCount = queueAgg?.openTotal ?? queueAgg?.open_total ?? (queue.data ?? []).length;

  // ── Triage actions ─────────────────────────────────────────────────────────
  const [detail, setDetail] = useState<SocDetection | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const doTriage = async (d: SocDetection, body: Record<string, unknown>, label: string) => {
    setBusyId(d.id);
    const previous = queue.data;
    // Optimistic update: patch the queue immediately, roll back on failure.
    queue.setData((list) =>
      list.map((item) => (item.id === d.id ? { ...item, ...body, status: String(body.status ?? item.status) } as SocDetection : item)),
    );
    setDetail((prev) => (prev?.id === d.id ? ({ ...prev, ...body, status: String(body.status ?? prev.status) } as SocDetection) : prev));
    try {
      const updated = await patchSocDetection(d.id, body);
      toast("success", label);
      queue.setData((list) => list.map((item) => (item.id === d.id ? updated : item)));
      setDetail((prev) => (prev?.id === d.id ? updated : prev));
      reloadQueue();
    } catch (e) {
      queue.setData(previous);
      setDetail((prev) => (prev?.id === d.id ? d : prev));
      toast("error", `${label} failed`, e instanceof Error ? e.message : "");
    } finally {
      setBusyId(null);
    }
  };

  const doEscalate = async (d: SocDetection, title?: string, summary?: string) => {
    setBusyId(d.id);
    try {
      const res = await escalateSocDetection(d.id, { title: title || undefined, summary: summary || undefined, assignee_ref: d.assignee_ref ?? undefined });
      toast("success", res.created ? "Case opened" : "Already escalated", `Detection #${d.id} linked to case #${res.case.id}`);
      setDetail(null);
      reloadQueue();
      setTab("cases");
    } catch (e) {
      toast("error", "Escalate failed", e instanceof Error ? e.message : "");
    } finally {
      setBusyId(null);
    }
  };

  // ── Manual detection create ────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [newDet, setNewDet] = useState({ title: "", summary: "", severity: "medium", asset_id: "", assignee_ref: "" });
  const [creating, setCreating] = useState(false);
  const createDetection = async () => {
    if (!newDet.title.trim()) { toast("warning", "Title required"); return; }
    setCreating(true);
    try {
      await createSocDetection({
        title: newDet.title.trim(),
        summary: newDet.summary || undefined,
        severity: newDet.severity,
        asset_id: newDet.asset_id ? Number(newDet.asset_id) : null,
        assignee_ref: newDet.assignee_ref || undefined,
      });
      toast("success", "Detection created", "Added to the triage queue");
      setCreateOpen(false);
      setNewDet({ title: "", summary: "", severity: "medium", asset_id: "", assignee_ref: "" });
      reloadQueue();
    } catch (e) {
      toast("error", "Create failed", e instanceof Error ? e.message : "");
    } finally {
      setCreating(false);
    }
  };

  // ── Cases ──────────────────────────────────────────────────────────────────
  const casesRes = useResource<{ items: SocCase[]; total: number }>(() => loadSocCases(), { items: [], total: 0 }, "soc-cases");
  const [selectedCase, setSelectedCase] = useState<SocCase | null>(null);
  const [caseDetail, setCaseDetail] = useState<SocCase | null>(null);
  const [caseOpen, setCaseOpen] = useState(false);
  const [caseForm, setCaseForm] = useState({ title: "", summary: "", severity: "medium", assignee_ref: "" });
  const [creatingCase, setCreatingCase] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);

  const openCaseDetail = async (c: SocCase) => {
    setSelectedCase(c);
    setCaseDetail(null);
    try {
      const full = await loadSocCase(c.id);
      setCaseDetail(full ?? c);
    } catch { setCaseDetail(c); }
  };

  const createCase = async () => {
    if (!caseForm.title.trim()) { toast("warning", "Case title required"); return; }
    setCreatingCase(true);
    try {
      await createSocCase({ title: caseForm.title.trim(), summary: caseForm.summary || undefined, severity: caseForm.severity, assignee_ref: caseForm.assignee_ref || undefined });
      toast("success", "Case created");
      setCaseOpen(false);
      setCaseForm({ title: "", summary: "", severity: "medium", assignee_ref: "" });
      casesRes.reload();
    } catch (e) {
      toast("error", "Create failed", e instanceof Error ? e.message : "");
    } finally {
      setCreatingCase(false);
    }
  };

  const updateCase = async (id: number, body: Record<string, unknown>, label: string) => {
    try {
      const updated = await patchSocCase(id, body);
      toast("success", label);
      setCaseDetail((prev) => (prev?.id === id ? { ...prev, ...updated } : prev));
      casesRes.reload();
    } catch (e) {
      toast("error", `${label} failed`, e instanceof Error ? e.message : "");
    }
  };

  const addNote = async () => {
    if (!caseDetail || !noteBody.trim()) return;
    setNoteBusy(true);
    try {
      const note: SocCaseNote = await addSocCaseNote(caseDetail.id, { body: noteBody.trim(), author_ref: caseDetail.assignee_ref ?? undefined });
      setCaseDetail((prev) => (prev ? { ...prev, notes: [...(prev.notes ?? []), note] } : prev));
      setNoteBody("");
      toast("success", "Note added");
    } catch (e) {
      toast("error", "Note failed", e instanceof Error ? e.message : "");
    } finally {
      setNoteBusy(false);
    }
  };

  // ── Rules ──────────────────────────────────────────────────────────────────
  const rulesRes = useResource<SocRule[]>(() => loadSocRules(), [], "soc-rules");
  const [ruleOpen, setRuleOpen] = useState(false);
  const [ruleForm, setRuleForm] = useState({ name: "", description: "", severity_default: "medium", event_types: "FindingCreated", min_severity: "", enabled: true, dedup_window_seconds: 3600 });
  const [ruleBusy, setRuleBusy] = useState(false);

  const createRule = async () => {
    if (!ruleForm.name.trim()) { toast("warning", "Rule name required"); return; }
    const match_spec: Record<string, unknown> = { event_types: ruleForm.event_types.split(",").map((s) => s.trim()).filter(Boolean) };
    if (ruleForm.min_severity) match_spec.min_severity = ruleForm.min_severity;
    setRuleBusy(true);
    try {
      await createSocRule({
        name: ruleForm.name.trim(),
        description: ruleForm.description || undefined,
        enabled: ruleForm.enabled,
        severity_default: ruleForm.severity_default,
        match_spec,
        dedup_window_seconds: Number(ruleForm.dedup_window_seconds) || 3600,
        actions: { create_detection: true, notify: false },
      });
      toast("success", "Rule created");
      setRuleOpen(false);
      setRuleForm({ name: "", description: "", severity_default: "medium", event_types: "FindingCreated", min_severity: "", enabled: true, dedup_window_seconds: 3600 });
      rulesRes.reload();
    } catch (e) {
      toast("error", "Create failed", e instanceof Error ? e.message : "");
    } finally {
      setRuleBusy(false);
    }
  };

  const toggleRule = async (r: SocRule) => {
    const nextEnabled = !r.enabled;
    const previous = rulesRes.data;
    rulesRes.setData((list) => list.map((item) => (item.id === r.id ? { ...item, enabled: nextEnabled } : item)));
    try {
      await patchSocRule(r.id, { enabled: nextEnabled });
      toast("success", r.enabled ? "Rule disabled" : "Rule enabled", r.name);
      rulesRes.reload();
    } catch (e) {
      rulesRes.setData(previous);
      toast("error", "Update failed", e instanceof Error ? e.message : "");
    }
  };

  const removeRule = async (r: SocRule) => {
    const previous = rulesRes.data;
    rulesRes.setData((list) => list.filter((item) => item.id !== r.id));
    try {
      await deleteSocRule(r.id);
      toast("success", "Rule deleted", r.name);
      rulesRes.reload();
    } catch (e) {
      rulesRes.setData(previous);
      toast("error", "Delete failed", e instanceof Error ? e.message : "");
    }
  };

  const seedRules = async () => {
    try {
      const seeded = await seedSocRules();
      toast("success", "Rules seeded", `${seeded.length} templates ensured`);
      rulesRes.reload();
    } catch (e) {
      toast("error", "Seed failed", e instanceof Error ? e.message : "");
    }
  };

  // ── Adapters ───────────────────────────────────────────────────────────────
  const adaptersRes = useResource<SocAdapter[]>(() => loadSocAdapters(), [], "soc-adapters");
  const [webhookOpen, setWebhookOpen] = useState(false);
  const [webhookJson, setWebhookJson] = useState("");
  const [webhookBusy, setWebhookBusy] = useState(false);
  const [webhookResult, setWebhookResult] = useState<number | null>(null);

  const sendWebhook = async () => {
    setWebhookBusy(true);
    setWebhookResult(null);
    try {
      let body: Record<string, unknown>;
      try { body = JSON.parse(webhookJson || "{}"); } catch { toast("error", "Invalid JSON"); setWebhookBusy(false); return; }
      const res = await ingestSocWebhook(body);
      setWebhookResult(res.accepted ?? 0);
      toast("success", "Signals ingested", `${res.accepted} detection(s) accepted`);
      reloadQueue();
    } catch (e) {
      toast("error", "Webhook failed", e instanceof Error ? e.message : "");
    } finally {
      setWebhookBusy(false);
    }
  };

  // Must stay above the early return — hooks must run on every render.
  const livePreview = useMemo(
    () => liveEvents.filter((e) => e.event !== "heartbeat").slice(-12).reverse(),
    [liveEvents],
  );

  if (socData.loading && !socData.data.panels.length && !status.data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-slate-400">
        <Spinner className="h-5 w-5" /> Loading SOC Operations Center...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Security Operations Center"
        description="Detection triage, cases, rules, and live monitoring"
        actions={
          <div className="flex items-center gap-2">
            <span
              className={cx(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
                liveConnected
                  ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                  : "border-phantix-700/50 bg-phantix-950/60 text-slate-500",
              )}
            >
              <span className={cx("h-1.5 w-1.5 rounded-full", liveConnected ? "bg-emerald-400 animate-pulse" : "bg-slate-600")} />
              {liveConnected ? "Live" : "Offline"}
            </span>
            <button type="button" className="btn-ghost text-sm px-3 py-1.5" onClick={reloadQueue} title="Refresh">
              <RefreshCw size={14} />
            </button>
          </div>
        }
      />

      {socData.data.message && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-phantix-700/30 bg-phantix-900/40 px-4 py-2.5 text-sm text-slate-400">
          <Monitor size={15} className="mt-0.5 shrink-0 text-phantix-400" />
          <span className="leading-5">{socData.data.message}</span>
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Engine" value={<span className={cx("capitalize", status.data?.status === "implemented" ? "text-emerald-400" : "text-slate-300")}>{status.data?.status === "implemented" ? "Online" : status.data?.status ?? "loading"}</span>} icon={<Gauge size={18} />} />
        <StatCard label="Open queue" value={<span className="text-white tabular-nums">{openCount}</span>} icon={<Crosshair size={18} />} />
        <StatCard label="Critical open" value={<span className="text-severity-critical tabular-nums">{(queueAgg?.bySeverityOpen ?? queueAgg?.by_severity_open ?? {})["critical"] ?? 0}</span>} icon={<AlertTriangle size={18} />} accent="red" />
        <StatCard label="Posture" value={<span className="text-gold-400 tabular-nums">{score}</span>} icon={<Activity size={18} />} />
      </div>

      <Tabs
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "queue", label: "Triage queue", count: openCount },
          { id: "cases", label: "Cases", count: casesRes.data?.items?.length ?? 0 },
          { id: "availability", label: "Availability" },
          { id: "rules", label: "Rules", count: (rulesRes.data ?? []).length },
          { id: "adapters", label: "Adapters", count: (adaptersRes.data ?? []).filter((a) => a.configured).length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "overview" && (
        <div className="grid gap-5 lg:grid-cols-12 lg:items-start">
          {/* Main panels — flexible column */}
          <div className="space-y-5 lg:col-span-8 min-w-0">
            <div className="grid gap-4 sm:grid-cols-2">
            {socData.data.panels?.length ? socData.data.panels.map((panel) => (
              <Card key={panel.id} className={cx("h-full", !panel.ready && "opacity-60")}>
                <CardHeader
                  title={
                    <div className="flex items-center gap-2 min-w-0">
                      {panel.source.includes("soc") ? <Crosshair size={15} className="shrink-0 text-gold-400" /> : <Shield size={15} className="shrink-0 text-phantix-400" />}
                      <span className="truncate">{panel.title}</span>
                      {!panel.ready && <span className="chip shrink-0 text-[10px] text-amber-300/90 bg-amber-400/10 border-amber-400/20">Soon</span>}
                    </div>
                  }
                  subtitle={panel.note || panel.source}
                />
                {panel.ready ? (
                  <div className="space-y-2">
                    {panel.source.includes("asset_intelligence") && (
                      <div className="flex items-center justify-between rounded-xl bg-phantix-950/40 border border-phantix-700/30 p-3.5">
                        <div>
                          <p className="font-display text-3xl font-bold tabular-nums text-white">{score}</p>
                          <p className="text-xs text-slate-500">Posture score</p>
                        </div>
                        <div className="space-y-1.5 text-right text-xs">
                          <div className="flex justify-end gap-3"><span className="text-slate-500">Assets</span><span className="font-mono tabular-nums text-slate-200">{intelData.data?.totals?.activeAssets ?? intelData.data?.total_assets ?? 0}</span></div>
                          <div className="flex justify-end gap-3"><span className="text-slate-500">Critical</span><span className="font-mono tabular-nums text-severity-critical">{intelData.data?.totals?.highRiskAssets ?? 0}</span></div>
                        </div>
                      </div>
                    )}
                    {panel.source.includes("soc_engine") && (
                      <div className="rounded-xl bg-phantix-950/40 border border-phantix-700/30 p-3.5">
                        <p className="text-xs text-slate-400"><span className="font-mono tabular-nums text-slate-200">{openCount}</span> open detections</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {Object.entries(queueAgg?.bySeverityOpen ?? queueAgg?.by_severity_open ?? {}).map(([s, n]) => (
                            <span key={s} className="chip text-[10px] capitalize"><SeverityBadge severity={sevOf(s)} /> {String(n)}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8 text-sm text-slate-500">
                    <Clock size={16} className="mr-2" />
                    {panel.note || "Available when this module ships"}
                  </div>
                )}
              </Card>
            )) : (
              <div className="sm:col-span-2">
                <EmptyState icon={<Gauge size={24} />} title="No monitoring panels" body="SOC dashboard panels are not available yet" />
              </div>
            )}
            </div>
          </div>

          {/* Fixed-height live feed — never grows the page */}
          <aside className="lg:col-span-4 min-w-0">
            <Card className="flex flex-col overflow-hidden border-phantix-700/30 lg:sticky lg:top-4 !p-0">
              <div className="flex items-center justify-between gap-2 border-b border-phantix-800/50 px-4 py-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                    <Radio size={14} className={cx(liveConnected ? "text-emerald-400" : "text-slate-500")} />
                    Live feed
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500 truncate">
                    {liveConnected ? "SSE · last 12 non-heartbeat events" : "Reconnecting…"}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-slate-500">{livePreview.length}</span>
              </div>
              <div className="h-64 max-h-64 overflow-y-auto overscroll-contain px-3 py-2 space-y-1">
                {livePreview.length > 0 ? livePreview.map((evt, i) => {
                  const payload = (evt.data && typeof evt.data === "object" ? evt.data : {}) as Record<string, unknown>;
                  const isSoc = evt.event.startsWith("soc");
                  const sev = payload.severity ? String(payload.severity) : undefined;
                  const hot = evt.event === "socDetectionMatched" || evt.event === "socAlertRaised";
                  return (
                    <div
                      key={`${evt.ts}-${evt.event}-${i}`}
                      className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-phantix-800/40"
                    >
                      <span className={cx(
                        "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                        hot ? "bg-severity-critical" : isSoc ? "bg-gold-400" : "bg-emerald-400/80",
                      )} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-slate-500 shrink-0">{timeAgo(evt.ts)}</span>
                          {sev && <SeverityBadge severity={sevOf(sev)} />}
                        </div>
                        <p className="mt-0.5 text-slate-300 leading-snug line-clamp-2">{ssePayloadLabel(evt.event, payload)}</p>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="flex h-full min-h-[12rem] flex-col items-center justify-center gap-1 px-4 text-center text-xs text-slate-500">
                    <Wifi size={16} className={cx(liveConnected ? "text-emerald-500/50" : "text-slate-600")} />
                    {liveConnected ? "Connected — waiting for events" : "Stream offline"}
                  </div>
                )}
              </div>
            </Card>
          </aside>
        </div>
      )}

      {tab === "queue" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input className="input !pl-9 py-2 text-sm w-56" placeholder="Search detections..." value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <select className="input w-auto py-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              {DET_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
            </select>
            <select className="input w-auto py-2 text-sm" value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
              <option value="">All severities</option>
              {["critical", "high", "medium", "low", "info"].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
            </select>
            <button className="btn-primary !py-2 text-sm ml-auto" onClick={() => setCreateOpen(true)}><Plus size={14} /> Manual detection</button>
          </div>

          <Card className="!p-0 overflow-hidden">
            {queue.loading && !(queue.data ?? []).length ? (
              <div className="p-4"><Spinner className="h-5 w-5" /></div>
            ) : filtered.length === 0 ? (
              <EmptyState icon={<Crosshair size={24} />} title="No detections" body="Nothing in the queue matching current filters" />
            ) : (
              <div className="max-h-[min(65vh,640px)] overflow-auto">
                <table className="w-full">
                  <thead className="sticky top-0 z-10 bg-phantix-900/95 backdrop-blur-sm">
                    <tr className="border-b border-phantix-700/40">
                      <th className="th">Detection</th>
                      <th className="th">Severity</th>
                      <th className="th">Status</th>
                      <th className="th">Priority</th>
                      <th className="th">Assignee</th>
                      <th className="th">Occurrences</th>
                      <th className="th">Last seen</th>
                      <th className="th w-12" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((d) => (
                      <tr key={d.id} className="border-b border-phantix-800/40 hover:bg-phantix-800/35 cursor-pointer transition-colors" onClick={() => setDetail(d)}>
                        <td className="td">
                          <div className="min-w-0 max-w-md">
                            <p className="font-medium text-slate-100 truncate">{d.title}</p>
                            <p className="text-[11px] text-slate-500 truncate">{d.correlator_id ?? d.source} · asset #{d.asset_id ?? "—"}{d.risk_id ? ` · risk #${d.risk_id}` : ""}</p>
                          </div>
                        </td>
                        <td className="td"><SeverityBadge severity={sevOf(String(d.severity))} /></td>
                        <td className="td"><StatusBadge status={String(d.status)} /></td>
                        <td className="td font-mono tabular-nums text-slate-200">{Math.round(Number(d.priority_score ?? 0))}</td>
                        <td className="td text-xs text-slate-400">{d.assignee_ref || "—"}</td>
                        <td className="td font-mono tabular-nums text-slate-300">{d.occurrence_count}</td>
                        <td className="td text-xs text-slate-500 whitespace-nowrap">{d.last_seen_at ? timeAgo(d.last_seen_at) : "—"}</td>
                        <td className="td"><ChevronRight size={14} className="text-slate-500" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === "cases" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">Optional incident cases linked from escalated detections.</p>
            <button className="btn-primary !py-2 text-sm" onClick={() => setCaseOpen(true)}><Plus size={14} /> Open case</button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {(casesRes.data?.items ?? []).length === 0 ? (
              <div className="md:col-span-2"><EmptyState icon={<BellRing size={24} />} title="No cases" body="Escalate a detection to open an incident case" /></div>
            ) : (casesRes.data?.items ?? []).map((c) => (
              <button key={c.id} type="button" className="text-left" onClick={() => void openCaseDetail(c)}>
                <Card hover className="cursor-pointer">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="chip text-[10px]">#{c.id}</span>
                      <p className="font-medium text-slate-100">{c.title}</p>
                    </div>
                    <StatusBadge status={String(c.status)} />
                  </div>
                  {c.summary && <p className="mt-2 text-xs text-slate-500 line-clamp-2">{c.summary}</p>}
                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                    <SeverityBadge severity={sevOf(String(c.severity))} />
                    {c.assignee_ref && <span className="flex items-center gap-1"><UserCheck size={11} /> {c.assignee_ref}</span>}
                    {c.opened_at && <span className="ml-auto">{timeAgo(c.opened_at)}</span>}
                  </div>
                </Card>
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === "availability" && (
        <SocAvailability />
      )}

      {tab === "rules" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <p className="text-xs text-slate-500">Detection rules fire on internal bus events (AND semantics across match_spec keys).</p>
            <button className="btn-ghost text-sm px-3 py-1.5 ml-auto" onClick={seedRules}><BookOpen size={14} /> Seed templates</button>
            <button className="btn-primary !py-2 text-sm" onClick={() => setRuleOpen(true)}><Plus size={14} /> New rule</button>
          </div>
          <Card className="!p-0 overflow-hidden">
            {(rulesRes.data ?? []).length === 0 ? (
              <EmptyState icon={<FileText size={24} />} title="No rules" body="Create a detection rule or seed the templates" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-phantix-700/40">
                      <th className="th">Rule</th>
                      <th className="th">Source</th>
                      <th className="th">Severity</th>
                      <th className="th">Match spec</th>
                      <th className="th">Dedup</th>
                      <th className="th">Status</th>
                      <th className="th w-24" />
                    </tr>
                  </thead>
                  <tbody>
                    {(rulesRes.data ?? []).map((r) => (
                      <tr key={r.id} className="border-b border-phantix-800/40 hover:bg-phantix-800/35 transition-colors">
                        <td className="td">
                          <p className="font-medium text-slate-100">{r.name}</p>
                          {r.description && <p className="text-[11px] text-slate-500">{r.description}</p>}
                        </td>
                        <td className="td"><span className="chip text-[10px]">{r.source ?? "org"}</span></td>
                        <td className="td"><SeverityBadge severity={sevOf(String(r.severity_default))} /></td>
                        <td className="td font-mono text-[11px] text-slate-400">{Object.keys(r.match_spec ?? {}).join(", ")}</td>
                        <td className="td font-mono text-xs text-slate-400">{r.dedup_window_seconds ? `${Math.round(r.dedup_window_seconds / 3600)}h` : "—"}</td>
                        <td className="td">{r.enabled ? <StatusBadge status="active" /> : <StatusBadge status="closed" />}</td>
                        <td className="td">
                          <div className="flex gap-1">
                            <button className="btn-ghost p-1.5" title={r.enabled ? "Disable" : "Enable"} onClick={() => void toggleRule(r)}>{r.enabled ? <Pause size={13} /> : <Play size={13} />}</button>
                            <button className="btn-ghost p-1.5 text-severity-critical" title="Delete" onClick={() => void removeRule(r)}><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === "adapters" && (
        <div className="space-y-4">
          <Card>
            <CardHeader title="Enrichment adapters" subtitle="Optional external enrichment only — SOC operates fully on internal Phantix signals" />
            <div className="grid gap-3 md:grid-cols-2">
              {(adaptersRes.data ?? []).map((a) => (
                <div key={a.id ?? a.vendor} className="flex items-start justify-between gap-3 rounded-xl border border-phantix-700/40 bg-phantix-950/50 p-4">
                  <div>
                    <p className="text-sm font-medium text-slate-100">{a.displayName ?? a.id ?? a.vendor}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">{a.vendor}</p>
                    {a.detail && <p className="mt-1 text-xs text-slate-500">{a.detail}</p>}
                  </div>
                  <span className={cx("chip text-[10px] shrink-0", a.configured ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-phantix-700/50 text-slate-500")}>
                    {a.configured ? <><CheckCircle2 size={10} /> Connected</> : <><XCircle size={10} /> Not connected</>}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-phantix-700/40 bg-phantix-900/40 p-3.5 text-xs leading-5 text-slate-500">
              <strong className="text-slate-300">Note:</strong> adapters are optional enrichment only. SOC operates fully on internal Phantix
              signals without external SIEM/SOAR. <span className="font-mono">siem_connectors_live: false</span>
            </div>
          </Card>

          <Card>
            <CardHeader title="Webhook ingest" subtitle="POST /soc/adapters/webhook — normalized enrichment (test / future relays)" />
            <div className="space-y-3">
              <textarea
                className="input resize-none font-mono text-xs min-h-[96px]"
                value={webhookJson}
                onChange={(e) => setWebhookJson(e.target.value)}
                placeholder={JSON.stringify({ adapter_id: "generic_webhook", title: "External IOC hit on host", severity: "high", summary: "Partner feed", iocs: ["1.2.3.4"] }, null, 2)}
              />
              <div className="flex items-center gap-2">
                <button className="btn-secondary text-sm" onClick={sendWebhook} disabled={webhookBusy || !webhookJson.trim()}>
                  {webhookBusy ? <Spinner className="h-4 w-4" /> : <><ArrowUpRight size={14} /> Ingest</>}
                </button>
                {webhookResult != null && <span className="text-xs text-emerald-400">{webhookResult} detection(s) accepted</span>}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Detection detail drawer */}
      <Modal open={detail !== null} onClose={() => setDetail(null)} title={detail ? detail.title : ""} wide>
        {detail && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={sevOf(String(detail.severity))} />
              <StatusBadge status={String(detail.status)} />
              <span className="chip text-[10px]">{detail.source}</span>
              {detail.occurrence_count > 1 && <span className="chip text-[10px] text-severity-medium">{detail.occurrence_count} occurrences</span>}
              {detail.case_id && <span className="chip text-[10px] text-gold-400">case #{detail.case_id}</span>}
            </div>
            {detail.summary && <p className="text-sm text-slate-300">{detail.summary}</p>}

            <div className="grid grid-cols-2 gap-3 text-xs">
              {[["Asset", detail.asset_id ? `#${detail.asset_id}` : "—"], ["Risk", detail.risk_id ? `#${detail.risk_id}` : "—"], ["Correlator", detail.correlator_id ?? "—"], ["Assignee", detail.assignee_ref ?? "—"], ["First seen", detail.first_seen_at ? timeAgo(detail.first_seen_at) : "—"], ["Last seen", detail.last_seen_at ? timeAgo(detail.last_seen_at) : "—"]].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-phantix-950/50 border border-phantix-700/40 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">{k}</p>
                  <p className="mt-0.5 font-medium text-slate-200">{v}</p>
                </div>
              ))}
            </div>

            {detail.evidence && Object.keys(detail.evidence).length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Evidence</p>
                <pre className="rounded-lg bg-phantix-950/70 border border-phantix-700/40 p-3 text-[11px] font-mono text-slate-400 overflow-x-auto">{JSON.stringify(detail.evidence, null, 2)}</pre>
              </div>
            )}

            <div className="flex flex-wrap gap-2 border-t border-phantix-700/40 pt-4">
              {detail.status === "open" && (
                <button className="btn-secondary text-sm" disabled={busyId === detail.id} onClick={() => void doTriage(detail, { status: "acknowledged" }, "Acknowledged")}>
                  <CheckCircle2 size={14} /> Acknowledge
                </button>
              )}
              {(detail.status === "open" || detail.status === "acknowledged") && (
                <button className="btn-secondary text-sm" disabled={busyId === detail.id} onClick={() => void doTriage(detail, { assignee_ref: "user:12" }, "Assigned")}>
                  <UserCheck size={14} /> Assign to me
                </button>
              )}
              {!["escalated", "closed"].includes(String(detail.status)) && (
                <button className="btn-secondary text-sm" disabled={busyId === detail.id} onClick={() => void doEscalate(detail)}>
                  <ArrowUpRight size={14} /> Escalate to case
                </button>
              )}
              {!["closed"].includes(String(detail.status)) && (
                <button className="btn-danger text-sm ml-auto" disabled={busyId === detail.id} onClick={() => void doTriage(detail, { status: "closed", summary: "FP / resolved" }, "Closed")}>
                  <XCircle size={14} /> Close
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Manual detection modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Manual detection">
        <div className="space-y-3">
          <div><label className="label">Title</label><input className="input" value={newDet.title} onChange={(e) => setNewDet((f) => ({ ...f, title: e.target.value }))} placeholder="Suspicious login spike on VPN" /></div>
          <div><label className="label">Summary (optional)</label><textarea className="input resize-none min-h-[64px]" value={newDet.summary} onChange={(e) => setNewDet((f) => ({ ...f, summary: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Severity</label>
              <select className="input" value={newDet.severity} onChange={(e) => setNewDet((f) => ({ ...f, severity: e.target.value }))}>
                {["critical", "high", "medium", "low", "info"].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
              </select>
            </div>
            <div><label className="label">Asset ID (optional)</label><input className="input font-mono" type="number" value={newDet.asset_id} onChange={(e) => setNewDet((f) => ({ ...f, asset_id: e.target.value }))} /></div>
          </div>
          <div><label className="label">Assignee ref (optional)</label><input className="input font-mono" value={newDet.assignee_ref} onChange={(e) => setNewDet((f) => ({ ...f, assignee_ref: e.target.value }))} placeholder="user:12" /></div>
          <button className="btn-primary w-full" onClick={createDetection} disabled={creating}>{creating ? <Spinner className="h-4 w-4" /> : "Create detection"}</button>
        </div>
      </Modal>

      {/* Create case modal */}
      <Modal open={caseOpen} onClose={() => setCaseOpen(false)} title="Open incident case">
        <div className="space-y-3">
          <div><label className="label">Title</label><input className="input" value={caseForm.title} onChange={(e) => setCaseForm((f) => ({ ...f, title: e.target.value }))} placeholder="Weekend IR war room" /></div>
          <div><label className="label">Summary</label><textarea className="input resize-none min-h-[64px]" value={caseForm.summary} onChange={(e) => setCaseForm((f) => ({ ...f, summary: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Severity</label>
              <select className="input" value={caseForm.severity} onChange={(e) => setCaseForm((f) => ({ ...f, severity: e.target.value }))}>
                {["critical", "high", "medium", "low"].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
              </select>
            </div>
            <div><label className="label">Assignee</label><input className="input font-mono" value={caseForm.assignee_ref} onChange={(e) => setCaseForm((f) => ({ ...f, assignee_ref: e.target.value }))} placeholder="user:12" /></div>
          </div>
          <button className="btn-primary w-full" onClick={createCase} disabled={creatingCase}>{creatingCase ? <Spinner className="h-4 w-4" /> : "Create case"}</button>
        </div>
      </Modal>

      {/* Case detail modal */}
      <Modal open={selectedCase !== null} onClose={() => setSelectedCase(null)} title={selectedCase ? `Case #${selectedCase.id} — ${selectedCase.title}` : ""} wide>
        {selectedCase && (
          <div className="space-y-4">
            {(caseDetail ?? selectedCase) && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <SeverityBadge severity={sevOf(String((caseDetail ?? selectedCase).severity))} />
                  <StatusBadge status={String((caseDetail ?? selectedCase).status)} />
                  {(caseDetail ?? selectedCase).assignee_ref && <span className="chip text-[10px]">{((caseDetail ?? selectedCase).assignee_ref as string)}</span>}
                </div>
                {(caseDetail ?? selectedCase).summary && <p className="text-sm text-slate-300">{(caseDetail ?? selectedCase).summary}</p>}

                {/* Status transitions */}
                <div className="flex flex-wrap gap-2 border-t border-phantix-700/40 pt-3">
                  {CASE_STATUSES.filter((s) => s !== (caseDetail ?? selectedCase).status).map((s) => (
                    <button key={s} className="btn-secondary text-xs" onClick={() => void updateCase((caseDetail ?? selectedCase).id, { status: s }, `Case ${titleCase(s)}`)}>
                      {s === "closed" ? <><XCircle size={12} /> Close case</> : <>Move to {titleCase(s)}</>}
                    </button>
                  ))}
                </div>

                {/* Linked detections */}
                {(caseDetail?.detections?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Linked detections</p>
                    <div className="space-y-1.5">
                      {(caseDetail?.detections ?? []).map((d) => (
                        <div key={d.id} className="flex items-center justify-between rounded-lg bg-phantix-950/50 border border-phantix-700/40 px-3 py-2 text-xs">
                          <span className="text-slate-200">{d.title}</span>
                          <div className="flex items-center gap-2">
                            <SeverityBadge severity={sevOf(String(d.severity))} />
                            <span className="font-mono text-slate-500">#{d.id}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Timeline notes</p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {(caseDetail?.notes?.length ?? 0) === 0 && <p className="text-xs text-slate-500">No notes yet.</p>}
                    {(caseDetail?.notes ?? []).map((n) => (
                      <div key={n.id} className="rounded-lg bg-phantix-950/50 border border-phantix-700/40 p-3">
                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                          <span className="font-mono">{n.author_ref ?? "analyst"}</span>
                          <span>{n.created_at ? timeAgo(n.created_at) : ""}</span>
                        </div>
                        <p className="mt-1 text-sm text-slate-300">{n.body}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input className="input !py-2 text-sm flex-1" placeholder="Add a note..." value={noteBody} onChange={(e) => setNoteBody(e.target.value)} />
                    <button className="btn-secondary !px-3 text-sm" onClick={addNote} disabled={noteBusy || !noteBody.trim()}><MessageSquarePlus size={14} /></button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* New rule modal */}
      <Modal open={ruleOpen} onClose={() => setRuleOpen(false)} title="Create detection rule">
        <div className="space-y-3">
          <div><label className="label">Name</label><input className="input" value={ruleForm.name} onChange={(e) => setRuleForm((f) => ({ ...f, name: e.target.value }))} placeholder="High findings on prod tags" /></div>
          <div><label className="label">Description</label><input className="input" value={ruleForm.description} onChange={(e) => setRuleForm((f) => ({ ...f, description: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Default severity</label>
              <select className="input" value={ruleForm.severity_default} onChange={(e) => setRuleForm((f) => ({ ...f, severity_default: e.target.value }))}>
                {["critical", "high", "medium", "low", "info"].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
              </select>
            </div>
            <div><label className="label">Min severity (optional)</label>
              <select className="input" value={ruleForm.min_severity} onChange={(e) => setRuleForm((f) => ({ ...f, min_severity: e.target.value }))}>
                <option value="">Any</option>
                {["critical", "high", "medium", "low"].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
              </select>
            </div>
          </div>
          <div><label className="label">Event types (comma separated)</label><input className="input font-mono text-sm" value={ruleForm.event_types} onChange={(e) => setRuleForm((f) => ({ ...f, event_types: e.target.value }))} placeholder="FindingCreated, RiskCritical" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Dedup window (seconds)</label><input className="input font-mono" type="number" value={ruleForm.dedup_window_seconds} onChange={(e) => setRuleForm((f) => ({ ...f, dedup_window_seconds: Number(e.target.value) }))} /></div>
            <div className="flex items-end pb-1"><label className="flex items-center gap-1.5 text-sm text-slate-300"><input type="checkbox" checked={ruleForm.enabled} onChange={(e) => setRuleForm((f) => ({ ...f, enabled: e.target.checked }))} className="accent-gold-400" /> Enabled</label></div>
          </div>
          <button className="btn-primary w-full" onClick={createRule} disabled={ruleBusy}>{ruleBusy ? <Spinner className="h-4 w-4" /> : "Create rule"}</button>
        </div>
      </Modal>
    </div>
  );
}