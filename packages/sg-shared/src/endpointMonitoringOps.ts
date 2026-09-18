// Standard Defend endpoint monitoring — monitors, results, incidents, summary.
//
// Contracts mirror app/engines/soc_engine/api/endpoint_monitoring.py (the org
// router under /soc/endpoint-monitoring, get_current_active_organization). A
// monitor carries its own expected response, flagging thresholds and auth
// preconditions; the backend beat task probes due monitors 24/7 and raises
// per-issue-type incidents (down | expectation | tls | auth | drift) into the
// same alert + SOC-detection pipeline as availability.
import { api, delay, isDemoMode } from "./api";

const BASE = "/soc/endpoint-monitoring";

export const ENDPOINT_ISSUE_TYPES = ["down", "expectation", "tls", "auth", "drift"] as const;
export type EndpointIssueType = (typeof ENDPOINT_ISSUE_TYPES)[number];

export interface EndpointMonitor {
  id: number;
  organization_id: number;
  asset_id: number | null;
  name: string;
  url: string;
  method: string;
  request_headers: Record<string, string>;
  request_body: string | null;
  auth: Record<string, unknown>;
  expected_status: number | null;
  expected_keyword: string | null;
  expected_headers: Record<string, string>;
  expected_body_schema: Record<string, unknown>;
  thresholds: Record<string, unknown>;
  security_checks: Record<string, unknown>;
  drift_baseline: Record<string, unknown>;
  interval_seconds: number;
  timeout_seconds: number;
  failures_to_down: number;
  successes_to_up: number;
  enabled: boolean;
  severity: string;
  notify_on_down: boolean;
  notify_on_recovery: boolean;
  last_status: string;
  consecutive_failures: number;
  consecutive_successes: number;
  last_checked_at: string | null;
  last_latency_ms: number | null;
  last_error: string | null;
  last_posture: Record<string, unknown>;
  next_check_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
}

export interface EndpointMonitorCreate {
  name: string;
  url: string;
  method?: string;
  asset_id?: number | null;
  request_headers?: Record<string, string>;
  request_body?: string | null;
  auth?: Record<string, unknown>;
  expected_status?: number | null;
  expected_keyword?: string | null;
  expected_headers?: Record<string, string>;
  expected_body_schema?: Record<string, unknown>;
  thresholds?: Record<string, unknown>;
  security_checks?: Record<string, unknown>;
  interval_seconds?: number;
  timeout_seconds?: number;
  failures_to_down?: number;
  successes_to_up?: number;
  enabled?: boolean;
  severity?: string;
  notify_on_down?: boolean;
  notify_on_recovery?: boolean;
  metadata?: Record<string, unknown>;
}

export type EndpointMonitorUpdate = Partial<EndpointMonitorCreate>;

export interface EndpointResult {
  id: number;
  monitor_id: number;
  ok: boolean;
  status_label: string;
  latency_ms: number | null;
  http_status: number | null;
  posture: Record<string, unknown>;
  issues: Array<{ type: string; severity: string; detail: string }>;
  error: string | null;
  evidence: Record<string, unknown>;
  checked_at: string | null;
}

export interface EndpointIncident {
  id: number;
  organization_id: number;
  monitor_id: number | null;
  asset_id: number | null;
  soc_detection_id: number | null;
  issue_type: string;
  title: string;
  status: string;
  severity: string;
  source: string;
  down_at: string | null;
  recovered_at: string | null;
  acknowledged_at: string | null;
  time_to_resolve_seconds: number | null;
  excluded_from_sla: boolean;
  failure_count: number;
  last_error: string | null;
  evidence: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
  elapsed_seconds: number | null;
}

export interface EndpointSummary {
  organizationId: number;
  monitors: {
    total?: number;
    enabled?: number;
    up?: number;
    down?: number;
    degraded?: number;
    unknown?: number;
  };
  openIncidents: number;
  openByIssueType: Record<string, number>;
  healthPercentSnapshot: number | null;
  postureScore: number | null;
}

export interface EndpointRunResult {
  monitor: EndpointMonitor;
  probe: {
    ok: boolean;
    status_label: string;
    latency_ms: number | null;
    http_status: number | null;
    error: string | null;
    issues: Array<{ type: string; severity: string; detail: string }>;
    posture: Record<string, unknown>;
  };
  opened_incidents: EndpointIncident[];
  recovered_incidents: EndpointIncident[];
}

interface ListEnvelope<T> {
  organizationId?: number;
  total?: number;
  items: T[];
}

// ── Monitors ──────────────────────────────────────────────────────────────────

export async function listMonitors() {
  if (isDemoMode()) {
    await delay();
    return { organizationId: 0, total: demoMonitors.length, items: demoMonitors } as ListEnvelope<EndpointMonitor>;
  }
  return api.get<ListEnvelope<EndpointMonitor>>(`${BASE}/monitors`);
}

export async function getMonitor(id: number) {
  if (isDemoMode()) {
    await delay();
    return demoMonitors.find((m) => m.id === id) ?? demoMonitors[0];
  }
  return api.get<EndpointMonitor>(`${BASE}/monitors/${id}`);
}

export async function createMonitor(body: EndpointMonitorCreate) {
  if (isDemoMode()) {
    await delay();
    const now = new Date().toISOString();
    const created: EndpointMonitor = {
      ...blankMonitor(),
      ...body,
      id: Math.max(0, ...demoMonitors.map((m) => m.id)) + 1,
      created_at: now,
      updated_at: now,
    } as EndpointMonitor;
    return created;
  }
  return api.post<EndpointMonitor>(`${BASE}/monitors`, body);
}

export async function updateMonitor(id: number, body: EndpointMonitorUpdate) {
  if (isDemoMode()) {
    await delay();
    const current = demoMonitors.find((m) => m.id === id) ?? demoMonitors[0];
    return { ...current, ...body, updated_at: new Date().toISOString() } as EndpointMonitor;
  }
  return api.patch<EndpointMonitor>(`${BASE}/monitors/${id}`, body);
}

export async function deleteMonitor(id: number) {
  if (isDemoMode()) {
    await delay();
    return;
  }
  return api.delete<void>(`${BASE}/monitors/${id}`);
}

export async function runMonitor(id: number) {
  if (isDemoMode()) {
    await delay(600);
    const monitor = demoMonitors.find((m) => m.id === id) ?? demoMonitors[0];
    return {
      monitor,
      probe: {
        ok: monitor.last_status !== "down",
        status_label: monitor.last_status,
        latency_ms: monitor.last_latency_ms,
        http_status: 200,
        error: monitor.last_error,
        issues: [],
        posture: monitor.last_posture,
      },
      opened_incidents: [],
      recovered_incidents: [],
    } as EndpointRunResult;
  }
  return api.post<EndpointRunResult>(`${BASE}/monitors/${id}/run`);
}

export async function listResults(monitorId: number, limit = 100) {
  if (isDemoMode()) {
    await delay();
    return { items: demoResults.filter((r) => r.monitor_id === monitorId).slice(0, limit) };
  }
  return api.get<{ items: EndpointResult[] }>(`${BASE}/monitors/${monitorId}/results?limit=${limit}`);
}

// ── Incidents ─────────────────────────────────────────────────────────────────

export async function listIncidents(params: { status?: string; issue_type?: string; limit?: number } = {}) {
  if (isDemoMode()) {
    await delay();
    let items = demoIncidents;
    if (params.status) items = items.filter((i) => i.status === params.status);
    if (params.issue_type) items = items.filter((i) => i.issue_type === params.issue_type);
    return { organizationId: 0, total: items.length, items } as ListEnvelope<EndpointIncident>;
  }
  const q = new URLSearchParams();
  if (params.status) q.set("status", params.status);
  if (params.issue_type) q.set("issue_type", params.issue_type);
  if (params.limit) q.set("limit", String(params.limit));
  const qs = q.toString();
  return api.get<ListEnvelope<EndpointIncident>>(`${BASE}/incidents${qs ? `?${qs}` : ""}`);
}

export async function acknowledgeIncident(id: number) {
  if (isDemoMode()) {
    await delay();
    const inc = demoIncidents.find((i) => i.id === id)!;
    return { ...inc, acknowledged_at: new Date().toISOString() };
  }
  return api.post<EndpointIncident>(`${BASE}/incidents/${id}/acknowledge`);
}

export async function falsePositiveIncident(id: number) {
  if (isDemoMode()) {
    await delay();
    const inc = demoIncidents.find((i) => i.id === id)!;
    return { ...inc, status: "false_positive", excluded_from_sla: true };
  }
  return api.post<EndpointIncident>(`${BASE}/incidents/${id}/false-positive`);
}

// ── Summary ───────────────────────────────────────────────────────────────────

export async function endpointSummary() {
  if (isDemoMode()) {
    await delay();
    return demoSummary;
  }
  return api.get<EndpointSummary>(`${BASE}/summary`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** A default monitor shell for the create form. */
export function blankMonitor(): EndpointMonitor {
  return {
    id: 0,
    organization_id: 0,
    asset_id: null,
    name: "",
    url: "",
    method: "GET",
    request_headers: {},
    request_body: null,
    auth: {},
    expected_status: 200,
    expected_keyword: null,
    expected_headers: {},
    expected_body_schema: {},
    thresholds: { tls_expiry_days: 14 },
    security_checks: { tls: true, auth_enforced: true, drift: true },
    drift_baseline: {},
    interval_seconds: 120,
    timeout_seconds: 8,
    failures_to_down: 3,
    successes_to_up: 2,
    enabled: true,
    severity: "high",
    notify_on_down: true,
    notify_on_recovery: true,
    last_status: "unknown",
    consecutive_failures: 0,
    consecutive_successes: 0,
    last_checked_at: null,
    last_latency_ms: null,
    last_error: null,
    last_posture: {},
    next_check_at: null,
    metadata: {},
    created_at: null,
    updated_at: null,
  };
}

export const ISSUE_LABELS: Record<string, string> = {
  down: "Down",
  expectation: "Unexpected response",
  tls: "TLS",
  auth: "Auth not enforced",
  drift: "Response drift",
};

// ── Demo fixtures ──────────────────────────────────────────────────────────────

const demoMonitors: EndpointMonitor[] = [
  {
    ...blankMonitor(),
    id: 1,
    organization_id: 0,
    name: "Orders API",
    url: "https://api.acme.example/v1/orders",
    method: "GET",
    auth: { type: "bearer", token: "••••••" },
    expected_status: 200,
    expected_body_schema: { required: ["id", "status"] },
    thresholds: { latency_ms: 800, tls_expiry_days: 14 },
    last_status: "up",
    last_latency_ms: 142,
    last_posture: { tls_days_until_expiry: 61, auth_enforced: true },
    last_checked_at: new Date(Date.now() - 40_000).toISOString(),
    created_at: new Date(Date.now() - 6 * 864e5).toISOString(),
  },
  {
    ...blankMonitor(),
    id: 2,
    name: "Public status page",
    url: "https://status.acme.example",
    method: "GET",
    auth: {},
    thresholds: { latency_ms: 1500, tls_expiry_days: 21, allow_unauth: true },
    security_checks: { tls: true, auth_enforced: false, drift: true },
    last_status: "degraded",
    last_latency_ms: 1830,
    last_error: "certificate expires in 12 days",
    last_posture: { tls_days_until_expiry: 12 },
    last_checked_at: new Date(Date.now() - 55_000).toISOString(),
    created_at: new Date(Date.now() - 12 * 864e5).toISOString(),
  },
  {
    ...blankMonitor(),
    id: 3,
    name: "Billing webhook receiver",
    url: "https://api.acme.example/webhooks/billing",
    method: "POST",
    auth: { type: "api_key", header: "X-Webhook-Key", value: "••••••" },
    expected_status: 202,
    thresholds: { latency_ms: 1000, tls_expiry_days: 14 },
    last_status: "down",
    last_latency_ms: null,
    last_error: "reachable without credentials (HTTP 200)",
    last_posture: { auth_enforced: false },
    last_checked_at: new Date(Date.now() - 30_000).toISOString(),
    created_at: new Date(Date.now() - 3 * 864e5).toISOString(),
  },
];

const demoIncidents: EndpointIncident[] = [
  {
    id: 91,
    organization_id: 0,
    monitor_id: 3,
    asset_id: null,
    soc_detection_id: 5012,
    issue_type: "auth",
    title: "AUTH NOT ENFORCED: Billing webhook receiver",
    status: "open",
    severity: "high",
    source: "securegraph_probe",
    down_at: new Date(Date.now() - 3600_000).toISOString(),
    recovered_at: null,
    acknowledged_at: null,
    time_to_resolve_seconds: null,
    excluded_from_sla: false,
    failure_count: 12,
    last_error: "reachable without credentials (HTTP 200)",
    evidence: {},
    metadata: {},
    created_at: new Date(Date.now() - 3600_000).toISOString(),
    updated_at: new Date(Date.now() - 60_000).toISOString(),
    elapsed_seconds: 3600,
  },
  {
    id: 92,
    organization_id: 0,
    monitor_id: 2,
    asset_id: null,
    soc_detection_id: null,
    issue_type: "tls",
    title: "TLS: Public status page",
    status: "open",
    severity: "medium",
    source: "securegraph_probe",
    down_at: new Date(Date.now() - 2 * 864e5).toISOString(),
    recovered_at: null,
    acknowledged_at: new Date(Date.now() - 864e5).toISOString(),
    time_to_resolve_seconds: null,
    excluded_from_sla: false,
    failure_count: 48,
    last_error: "certificate expires in 12 days",
    evidence: {},
    metadata: {},
    created_at: new Date(Date.now() - 2 * 864e5).toISOString(),
    updated_at: new Date(Date.now() - 55_000).toISOString(),
    elapsed_seconds: 2 * 86400,
  },
];

const demoResults: EndpointResult[] = [
  {
    id: 1,
    monitor_id: 1,
    ok: true,
    status_label: "up",
    latency_ms: 142,
    http_status: 200,
    posture: { tls_days_until_expiry: 61, auth_enforced: true },
    issues: [],
    error: null,
    evidence: {},
    checked_at: new Date(Date.now() - 40_000).toISOString(),
  },
];

const demoSummary: EndpointSummary = {
  organizationId: 0,
  monitors: { total: 3, enabled: 3, up: 1, down: 1, degraded: 1, unknown: 0 },
  openIncidents: 2,
  openByIssueType: { auth: 1, tls: 1 },
  healthPercentSnapshot: 33.33,
  postureScore: 23.33,
};
