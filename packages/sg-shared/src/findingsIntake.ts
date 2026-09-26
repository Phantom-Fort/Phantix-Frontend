/**
 * Findings intake — untracked / unverified findings across every store.
 *
 * The tracker is the remediation board; the raw stores (scan results, code
 * review, VAPT, SOC detections) are the evidence of record. `GET
 * /api/v1/findings/intake` aggregates them so the Core app can work the backlog
 * (untracked = never promoted; unverified = no evidence verdict yet) and promote
 * the ones that matter onto the board.
 */
import { api, delay, isDemoMode } from "./api";

export type IntakeApp = "core" | "attack" | "defend" | "code";
export type IntakeView = "all" | "untracked" | "unverified" | "unmanaged";

export interface IntakeFinding {
  key: string;
  source_store: string;
  source_id: number;
  title: string;
  severity: string;
  app: IntakeApp;
  surface: string;
  verification_status: string;
  tracked: boolean;
  tracker_key?: string | null;
  tracker_status?: string | null;
  asset_id?: number | null;
  target?: string | null;
  detected_at?: string | null;
}

export interface IntakeSummary {
  scanned: number;
  matching: number;
  untracked: number;
  unverified: number;
  byApp: Record<string, number>;
  bySeverity: Record<string, number>;
  bySourceStore: Record<string, number>;
}

export interface IntakeResponse {
  view: IntakeView;
  summary: IntakeSummary;
  total: number;
  limit: number;
  offset: number;
  findings: IntakeFinding[];
  truncated: boolean;
}

export interface IntakeQuery {
  view?: IntakeView;
  severity?: string;
  app?: IntakeApp | "";
  source_store?: string;
  q?: string;
  limit?: number;
  offset?: number;
}

export interface PromoteResult {
  promoted: string[];
  skipped: string[];
  count: number;
}

export const INTAKE_VIEWS: { key: IntakeView; label: string; hint: string }[] = [
  { key: "unmanaged", label: "Needs attention", hint: "Untracked or unverified" },
  { key: "untracked", label: "Untracked", hint: "Never added to the tracker" },
  { key: "unverified", label: "Unverified", hint: "No evidence verdict yet" },
  { key: "all", label: "All findings", hint: "Every raw finding store" },
];

export const INTAKE_APPS: { key: IntakeApp; label: string }[] = [
  { key: "core", label: "Core" },
  { key: "attack", label: "Attack" },
  { key: "defend", label: "Defend" },
  { key: "code", label: "Code" },
];

export function emptyIntake(view: IntakeView = "unmanaged"): IntakeResponse {
  return {
    view,
    summary: {
      scanned: 0,
      matching: 0,
      untracked: 0,
      unverified: 0,
      byApp: {},
      bySeverity: {},
      bySourceStore: {},
    },
    total: 0,
    limit: 200,
    offset: 0,
    findings: [],
    truncated: false,
  };
}

function buildQuery(query: IntakeQuery): string {
  const params = new URLSearchParams();
  if (query.view) params.set("view", query.view);
  if (query.severity) params.set("severity", query.severity);
  if (query.app) params.set("app", query.app);
  if (query.source_store) params.set("source_store", query.source_store);
  if (query.q) params.set("q", query.q);
  if (query.limit != null) params.set("limit", String(query.limit));
  if (query.offset != null) params.set("offset", String(query.offset));
  return params.toString();
}

export async function loadFindingsIntake(query: IntakeQuery = {}): Promise<IntakeResponse> {
  const view = query.view ?? "unmanaged";
  if (isDemoMode()) {
    await delay(200);
    return demoIntake(query);
  }
  try {
    const qs = buildQuery(query);
    const res = await api.get<IntakeResponse>(`/findings/intake${qs ? `?${qs}` : ""}`);
    const empty = emptyIntake(view);
    return {
      ...empty,
      ...res,
      view,
      summary: { ...empty.summary, ...(res?.summary ?? {}) },
      findings: res?.findings ?? [],
    };
  } catch {
    return emptyIntake(view);
  }
}

export async function promoteIntakeFindings(
  items: { source_store: string; source_id: number }[],
): Promise<PromoteResult> {
  if (isDemoMode()) {
    await delay(250);
    return {
      promoted: items.map((i) => `${i.source_store}:${i.source_id}`),
      skipped: [],
      count: items.length,
    };
  }
  return api.post<PromoteResult>("/findings/intake/promote", { findings: items });
}

// ── demo mode ────────────────────────────────────────────────────────────────

const DEMO_FINDINGS: IntakeFinding[] = [
  {
    key: "scan_results:1",
    source_store: "scan_results",
    source_id: 1,
    title: "Open SSH (22/tcp) exposed to the internet",
    severity: "high",
    app: "core",
    surface: "Infrastructure",
    verification_status: "unverified",
    tracked: false,
    detected_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  },
  {
    key: "vapt_correlated_findings:2",
    source_store: "vapt_correlated_findings",
    source_id: 2,
    title: "SQL injection to RCE via admin upload",
    severity: "critical",
    app: "attack",
    surface: "Web",
    verification_status: "auto_verified",
    tracked: false,
    detected_at: new Date(Date.now() - 86_400_000).toISOString(),
  },
  {
    key: "code_review_findings:3",
    source_store: "code_review_findings",
    source_id: 3,
    title: "Hardcoded AWS access key in config",
    severity: "high",
    app: "code",
    surface: "Code",
    verification_status: "unverified",
    tracked: false,
    detected_at: new Date(Date.now() - 4 * 3_600_000).toISOString(),
  },
  {
    key: "soc_detections:4",
    source_store: "soc_detections",
    source_id: 4,
    title: "Impossible-travel sign-in for privileged account",
    severity: "medium",
    app: "defend",
    surface: "Detection",
    verification_status: "unverified",
    tracked: true,
    tracker_key: "FIND-4",
    tracker_status: "open",
    detected_at: new Date(Date.now() - 6 * 3_600_000).toISOString(),
  },
  {
    key: "scan_results:5",
    source_store: "scan_results",
    source_id: 5,
    title: "TLS certificate expiring in 9 days",
    severity: "low",
    app: "core",
    surface: "Infrastructure",
    verification_status: "unverified",
    tracked: false,
    detected_at: new Date(Date.now() - 12 * 3_600_000).toISOString(),
  },
];

function demoIntake(query: IntakeQuery): IntakeResponse {
  const view = query.view ?? "unmanaged";
  const matches = DEMO_FINDINGS.filter((f) => {
    if (view === "untracked") return !f.tracked;
    if (view === "unverified")
      return !["auto_verified", "manually_verified"].includes(f.verification_status);
    if (view === "unmanaged")
      return (
        !f.tracked ||
        !["auto_verified", "manually_verified"].includes(f.verification_status)
      );
    return true;
  }).filter(
    (f) =>
      (!query.app || f.app === query.app) &&
      (!query.severity || f.severity === query.severity) &&
      (!query.source_store || f.source_store === query.source_store) &&
      (!query.q || f.title.toLowerCase().includes(query.q.toLowerCase())),
  );
  const empty = emptyIntake(view);
  const count = (attr: keyof IntakeFinding) =>
    matches.reduce<Record<string, number>>((acc, f) => {
      const k = String(f[attr] ?? "unknown").toLowerCase();
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {});
  return {
    ...empty,
    summary: {
      scanned: DEMO_FINDINGS.length,
      matching: matches.length,
      untracked: DEMO_FINDINGS.filter((f) => !f.tracked).length,
      unverified: DEMO_FINDINGS.filter(
        (f) => !["auto_verified", "manually_verified"].includes(f.verification_status),
      ).length,
      byApp: count("app"),
      bySeverity: count("severity"),
      bySourceStore: count("source_store"),
    },
    total: matches.length,
    findings: matches,
  };
}
