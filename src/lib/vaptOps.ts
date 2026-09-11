// Org-side VAPT operations the /vapt campaign page does not cover: recurring
// schedules, engine settings (mining consent + AI threshold), the procedure
// catalogue, correlation rules and mined rule candidates.
//
// Contracts mirror app/engines/vapt_engine/api/{schedules,procedures,approvals}.py.
// These are the *org* routers (get_current_active_organization) — the staff
// portal's /admin/vapt/* equivalents are a separate, admin-gated surface.
import { api, delay, isDemoMode } from "./api";
import * as demo from "./demo-data";

// ── Schedules ────────────────────────────────────────────────────────────────

export interface VaptSchedule {
  id: number;
  organization_id: number;
  schedule_name: string;
  description: string | null;
  procedure_key: string;
  asset_scope_template: Record<string, unknown>;
  campaign_config: Record<string, unknown>;
  cron_expression: string;
  timezone: string;
  max_concurrent_per_org: number;
  allowed_days_of_week: unknown[] | null;
  blackout_windows: BlackoutWindow[];
  is_active: boolean;
  skip_next: boolean;
  pause_until: string | null;
  last_run_at: string | null;
  last_run_campaign_id: number | null;
  next_run_at: string | null;
  total_runs: number;
  total_failures: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface BlackoutWindow {
  start?: string;
  end?: string;
  days?: string[];
}

export interface VaptScheduleCreate {
  schedule_name: string;
  description?: string;
  procedure_key: string;
  /** Simple interval (`1d`, `7d`, `12h`) or a 5-field cron expression. */
  cron_expression?: string;
  timezone?: string;
  max_concurrent_per_org?: number;
  is_active?: boolean;
  asset_scope_template?: Record<string, unknown>;
  campaign_config?: Record<string, unknown>;
}

export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

/** Interval presets the backend's tooling-free parser understands directly. */
export const CRON_PRESETS = [
  { value: "1d", label: "Daily" },
  { value: "7d", label: "Weekly" },
  { value: "30d", label: "Monthly" },
  { value: "12h", label: "Twice daily" },
];

export async function listSchedules() {
  if (isDemoMode()) {
    await delay();
    return demo.vaptSchedules;
  }
  return api.get<VaptSchedule[]>("/vapt/schedules");
}

export async function createSchedule(body: VaptScheduleCreate) {
  if (isDemoMode()) {
    await delay(420);
    const now = new Date().toISOString();
    return {
      id: Math.max(0, ...demo.vaptSchedules.map((s) => s.id)) + 1,
      organization_id: demo.organization.id,
      schedule_name: body.schedule_name,
      description: body.description ?? null,
      procedure_key: body.procedure_key,
      asset_scope_template: body.asset_scope_template ?? {},
      campaign_config: body.campaign_config ?? {},
      cron_expression: body.cron_expression ?? "7d",
      timezone: body.timezone ?? "UTC",
      max_concurrent_per_org: body.max_concurrent_per_org ?? 1,
      allowed_days_of_week: null,
      blackout_windows: [],
      is_active: body.is_active ?? true,
      skip_next: false,
      pause_until: null,
      last_run_at: null,
      last_run_campaign_id: null,
      next_run_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      total_runs: 0,
      total_failures: 0,
      created_at: now,
      updated_at: now,
    };
  }
  return api.post<VaptSchedule>("/vapt/schedules", {
    cron_expression: "7d",
    timezone: "UTC",
    max_concurrent_per_org: 1,
    is_active: true,
    asset_scope_template: {},
    campaign_config: {},
    ...body,
  });
}

/**
 * Append a blackout window. The server takes these as *query* parameters and
 * appends to the existing list rather than replacing it.
 */
export async function addBlackout(scheduleId: number, window: { start: string; end: string; days?: string[] }) {
  if (isDemoMode()) {
    await delay(320);
    // The server appends to the existing list and returns the updated schedule.
    const row = demo.vaptSchedules.find((s) => s.id === scheduleId) ?? demo.vaptSchedules[0];
    return {
      ...row,
      blackout_windows: [...row.blackout_windows, { start: window.start, end: window.end, days: window.days ?? [] }],
      updated_at: new Date().toISOString(),
    };
  }
  const params = new URLSearchParams({ start: window.start, end: window.end });
  if (window.days?.length) params.set("days", window.days.join(","));
  return api.post<VaptSchedule>(`/vapt/schedules/${scheduleId}/blackout?${params}`, {});
}

// ── Engine settings ──────────────────────────────────────────────────────────

/** Severity floor at which the AI planner is consulted. */
export const AI_THRESHOLDS = ["off", "critical", "high", "medium", "low", "always"] as const;
export type AiThreshold = (typeof AI_THRESHOLDS)[number];

export interface VaptSettings {
  organization_id: number;
  mining_consent_enabled: boolean;
  mining_consent_granted_at: string | null;
  mining_data_scope: string | null;
  ai_threshold: string;
}

export async function loadVaptSettings() {
  if (isDemoMode()) {
    await delay(240);
    return demo.vaptSettings;
  }
  return api.get<VaptSettings>("/vapt/settings");
}

export async function saveVaptSettings(patch: { mining_consent_enabled?: boolean; ai_threshold?: string }) {
  if (isDemoMode()) {
    await delay(320);
    const next = { ...demo.vaptSettings, ...patch };
    // Granting consent stamps the moment it was given; withdrawing clears it.
    if (patch.mining_consent_enabled === true && !demo.vaptSettings.mining_consent_enabled) {
      next.mining_consent_granted_at = new Date().toISOString();
    } else if (patch.mining_consent_enabled === false) {
      next.mining_consent_granted_at = null;
    }
    return next;
  }
  return api.put<VaptSettings>("/vapt/settings", patch);
}

// ── Procedures, correlation rules, mining ────────────────────────────────────

export interface VaptProcedure {
  procedure_key?: string;
  key?: string;
  display_name?: string;
  title?: string;
  category?: string;
  phase?: string;
  required_role?: string;
  is_active?: boolean;
  steps?: unknown[];
  [k: string]: unknown;
}

export interface CorrelationRule {
  id?: number | string;
  rule_key?: string;
  name?: string;
  title?: string;
  description?: string;
  severity?: string;
  source?: string;
  [k: string]: unknown;
}

export interface RuleCandidate {
  frequency?: number;
  confidence?: number;
  pattern?: string;
  description?: string;
  [k: string]: unknown;
}

export async function listProcedures() {
  if (isDemoMode()) {
    await delay();
    return demo.vaptProcedures;
  }
  return api.get<VaptProcedure[]>("/vapt/procedures");
}

export async function getProcedure(key: string) {
  if (isDemoMode()) {
    await delay(240);
    return demo.vaptProcedures.find((p) => p.procedure_key === key) ?? demo.vaptProcedures[0];
  }
  return api.get<VaptProcedure>(`/vapt/procedures/${encodeURIComponent(key)}`);
}

export async function listCorrelationRules() {
  if (isDemoMode()) {
    await delay(300);
    return demo.vaptCorrelationRules;
  }
  return api.get<CorrelationRule[]>("/vapt/correlation-rules");
}

/** Mined candidates always need human review before becoming real rules. */
export async function listMinedCandidates(minFrequency = 10) {
  if (isDemoMode()) {
    await delay(300);
    // min_frequency is a server-side filter, so the demo applies it too.
    return {
      candidates: demo.vaptRuleCandidates.filter((c) => Number(c.frequency ?? 0) >= minFrequency),
      note: demo.vaptMiningNote,
    };
  }
  return api.get<{ candidates: RuleCandidate[]; note?: string }>(
    `/vapt/mining/candidates?min_frequency=${minFrequency}`,
  );
}

export function procedureKey(p: VaptProcedure): string {
  return String(p.procedure_key ?? p.key ?? "");
}

export function procedureName(p: VaptProcedure): string {
  return String(p.display_name ?? p.title ?? procedureKey(p) ?? "Procedure");
}

/** Both list endpoints may answer with a bare array or an `{items}` envelope. */
export function asArray<T>(v: T[] | { items?: T[] } | null | undefined): T[] {
  if (Array.isArray(v)) return v;
  return Array.isArray(v?.items) ? (v!.items as T[]) : [];
}

// ── Continuous reassessment (W4) ─────────────────────────────────────────────
// Cadence + change-triggered re-assessment driven by product context.

export interface ContinuousReassessmentSchedule {
  id: number;
  project_id?: number;
  target_key?: string;
  cadence?: string;
  debounce_hours?: number;
  is_active?: boolean;
  schedule_name?: string | null;
  next_run_at?: string | null;
  last_run_at?: string | null;
  created_at?: string | null;
  [k: string]: unknown;
}

export interface ContinuousReassessmentEnable {
  project_id: number;
  target_key: string;
  cadence?: string;
  debounce_hours?: number;
  asset_ids?: number[];
  schedule_name?: string;
}

export async function listContinuousReassessment(projectId?: number) {
  const qs = projectId ? `?project_id=${projectId}` : "";
  return api.get<{ organization_id: number; schedules: ContinuousReassessmentSchedule[] }>(
    `/vapt/continuous-reassessment${qs}`,
  );
}

export async function enableContinuousReassessment(body: ContinuousReassessmentEnable) {
  return api.post<ContinuousReassessmentSchedule>("/vapt/continuous-reassessment", {
    debounce_hours: 24,
    cadence: "7d",
    ...body,
  });
}

export async function proposeContinuousReassessment(body: {
  project_id: number;
  target_key: string;
  asset_ids?: number[];
  reason?: string;
}) {
  return api.post<{ ok: boolean; [k: string]: unknown }>("/vapt/continuous-reassessment/propose", {
    reason: "manual",
    ...body,
  });
}
