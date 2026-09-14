// GRC surfaces of the compliance engine that the main /compliance page does not
// cover: the self-attestation questionnaire, gap analysis, the business profile
// that drives framework recommendations, and evidence connectors.
//
// Contracts mirror app/engines/compliance_engine/api/compliance.py. Everything
// here is org-realm (get_current_active_organization / get_org_principal); the
// questionnaire write path additionally needs a *named* user, so an org-token
// principal without a user gets a 403 from the server.
import { api, delay, isDemoMode } from "./api";
import * as demo from "./demo-data";

// ── Questionnaire ────────────────────────────────────────────────────────────

/** Server-accepted answers for `answer_type: yes_no_partial` questions. */
export const ANSWER_CHOICES = ["yes", "no", "partial", "na"] as const;

export interface AnswererSession {
  id: number;
  organization_id: number;
  organization_user_id: number;
  stated_role: string;
  stated_title: string | null;
  user_email: string | null;
  user_full_name: string | null;
  created_at: string | null;
  last_activity_at: string | null;
  message?: string;
}

export interface AnswererAudit {
  organization_user_id: number | null;
  answered_by_name: string;
  answered_by_email: string;
  stated_role: string;
  stated_title: string | null;
  answer_value: string;
  notes: string | null;
  updated_at: string | null;
}

export interface QuestionnaireQuestion {
  id: number;
  question_key: string;
  prompt: string;
  help_text: string | null;
  category: string | null;
  risk: string | null;
  answer_type: string;
  framework_ids: string[];
  source_controls: unknown[];
  sort_order: number;
  my_answer: AnswererAudit | null;
  answers_from_others: AnswererAudit[];
  answer_count: number;
  is_seeded: boolean;
}

export interface ComplianceLevel {
  id: string;
  label: string;
  score: number | null;
  band: string | null;
}

export interface QuestionnaireProgress {
  organization_id: number;
  applicable_frameworks: string[];
  total_questions: number;
  answered_unique_questions: number;
  unanswered: number;
  percent_complete: number;
  total_answer_events: number;
  by_category: Record<string, unknown>;
  attestation_score: number | null;
  compliance_level: ComplianceLevel;
  yes_count: number;
  no_count: number;
  partial_count: number;
  not_applicable: number;
  disclaimer: string;
  disclaimer_short: string;
  replaces_certified_audit: boolean;
}

export interface QuestionnaireList {
  applicable_frameworks: string[];
  total: number;
  items: QuestionnaireQuestion[];
  progress: QuestionnaireProgress;
  answer_choices: string[];
  disclaimer: string;
  message?: string;
}

const EMPTY_LEVEL: ComplianceLevel = { id: "unknown", label: "Not started", score: null, band: null };

export const EMPTY_PROGRESS: QuestionnaireProgress = {
  organization_id: 0,
  applicable_frameworks: [],
  total_questions: 0,
  answered_unique_questions: 0,
  unanswered: 0,
  percent_complete: 0,
  total_answer_events: 0,
  by_category: {},
  attestation_score: null,
  compliance_level: EMPTY_LEVEL,
  yes_count: 0,
  no_count: 0,
  partial_count: 0,
  not_applicable: 0,
  disclaimer: "",
  disclaimer_short: "Self-attestation only — not a substitute for a GRC specialist audit.",
  replaces_certified_audit: false,
};

function frameworkQuery(frameworks?: string[]): string {
  const list = (frameworks ?? []).filter(Boolean);
  return list.length ? `?frameworks=${encodeURIComponent(list.join(","))}` : "";
}

/**
 * Declare the answering role. The server requires this before any answer is
 * accepted — every answer is attributed to the user *and* the role they claimed,
 * which is the whole point of the audit trail.
 */
export async function startAnswererSession(statedRole: string, statedTitle?: string) {
  if (isDemoMode()) {
    await delay(260);
    // The server echoes back the role and title it recorded, which is what the
    // page confirms to the user — so the demo echoes them too.
    return {
      ...demo.answererSession,
      stated_role: statedRole,
      stated_title: statedTitle?.trim() || null,
      last_activity_at: new Date().toISOString(),
    };
  }
  return api.post<AnswererSession>("/compliance/questionnaire/session", {
    stated_role: statedRole,
    ...(statedTitle?.trim() ? { stated_title: statedTitle.trim() } : {}),
  });
}

export async function loadQuestionnaire(frameworks?: string[], category?: string) {
  if (isDemoMode()) {
    await delay();
    // The server filters the item list server-side and reports `total` for the
    // filtered set; progress stays org-wide across all applicable frameworks.
    const items = category
      ? demo.questionnaire.items.filter((q) => q.category === category)
      : demo.questionnaire.items;
    return { ...demo.questionnaire, items, total: items.length };
  }
  const params = new URLSearchParams();
  const fws = (frameworks ?? []).filter(Boolean);
  if (fws.length) params.set("frameworks", fws.join(","));
  if (category) params.set("category", category);
  const qs = params.toString();
  return api.get<QuestionnaireList>(`/compliance/questionnaire/questions${qs ? `?${qs}` : ""}`);
}

export async function loadProgress(frameworks?: string[]) {
  if (isDemoMode()) {
    await delay(220);
    return demo.questionnaireProgressSummary;
  }
  return api.get<QuestionnaireProgress>(`/compliance/questionnaire/progress${frameworkQuery(frameworks)}`);
}

export async function submitAnswer(input: {
  sessionId: number;
  questionId: number;
  answerValue: string;
  notes?: string;
}) {
  if (isDemoMode()) {
    await delay(260);
    return { id: input.questionId, answer_value: input.answerValue, message: "Answer recorded." };
  }
  return api.put<{ id: number; answer_value: string; message?: string }>(
    "/compliance/questionnaire/answers",
    {
      session_id: input.sessionId,
      question_id: input.questionId,
      answer_value: input.answerValue,
      ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
    },
  );
}

export async function rebuildQuestionnaire() {
  if (isDemoMode()) {
    await delay(600);
    return { ok: true };
  }
  return api.post<{ ok: boolean }>("/compliance/questionnaire/rebuild?force=true", {});
}

export async function loadAnswerAudit(questionId?: number, limit = 100) {
  if (isDemoMode()) {
    await delay(220);
    const source = questionId
      ? demo.questionnaireQuestions
          .filter((q) => q.id === questionId)
          .flatMap((q) => [...(q.my_answer ? [q.my_answer] : []), ...q.answers_from_others])
      : demo.questionnaireAnswerAudit;
    return { organization_id: demo.organization.id, total: source.length, items: source.slice(0, limit) };
  }
  const params = new URLSearchParams({ limit: String(limit) });
  if (questionId) params.set("question_id", String(questionId));
  return api.get<{ organization_id: number; total: number; items: AnswererAudit[] }>(
    `/compliance/questionnaire/answers?${params}`,
  );
}

// ── Gap analysis ─────────────────────────────────────────────────────────────

export interface ControlGap {
  framework_id?: string;
  control_id?: string;
  title?: string;
  category?: string;
  risk?: string;
  [k: string]: unknown;
}

export interface GapAnalysis {
  frameworks: string[];
  findings_in: number;
  summary: Record<string, unknown>;
  gaps: ControlGap[];
  controls_touched: unknown[];
  mappings: unknown[];
  recommendations: unknown[];
}

export const EMPTY_GAPS: GapAnalysis = {
  frameworks: [],
  findings_in: 0,
  summary: {},
  gaps: [],
  controls_touched: [],
  mappings: [],
  recommendations: [],
};

export async function loadGapAnalysis(opts: { campaignId?: number; frameworks?: string[] } = {}) {
  if (isDemoMode()) {
    await delay();
    const wanted = (opts.frameworks ?? []).filter(Boolean);
    if (!wanted.length) return demo.gapAnalysis;
    const gaps = demo.gapAnalysis.gaps.filter((g) => wanted.includes(String(g.framework_id)));
    return { ...demo.gapAnalysis, frameworks: wanted, gaps };
  }
  const params = new URLSearchParams();
  if (opts.campaignId) params.set("campaign_id", String(opts.campaignId));
  const fws = (opts.frameworks ?? []).filter(Boolean);
  if (fws.length) params.set("frameworks", fws.join(","));
  const qs = params.toString();
  return api.get<GapAnalysis>(`/compliance/gaps${qs ? `?${qs}` : ""}`);
}

// ── Business profile + framework recommendations ─────────────────────────────

export interface BusinessProfile {
  id: number;
  organization_id: number;
  country: string;
  customer_countries: string[];
  industry: string | null;
  company_size: string | null;
  handles_personal_data: boolean;
  handles_health_records: boolean;
  handles_payment_cards: boolean;
  handles_government_contracts: boolean;
  handles_financial_transactions: boolean;
  cloud_providers: string[];
  has_public_apis: boolean;
  uses_ai: boolean;
  data_retention_period_days: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export type BusinessProfileUpdate = Partial<
  Pick<
    BusinessProfile,
    | "country"
    | "customer_countries"
    | "industry"
    | "company_size"
    | "handles_personal_data"
    | "handles_health_records"
    | "handles_payment_cards"
    | "handles_government_contracts"
    | "handles_financial_transactions"
    | "cloud_providers"
    | "has_public_apis"
    | "uses_ai"
    | "data_retention_period_days"
  >
>;

/** Returns null when the org has not created a profile yet (server sends `null`). */
export async function loadProfile() {
  if (isDemoMode()) {
    await delay(240);
    return demo.businessProfile;
  }
  return api.get<BusinessProfile | null>("/compliance/profile");
}

export async function saveProfile(patch: BusinessProfileUpdate) {
  if (isDemoMode()) {
    await delay(320);
    // PUT returns the persisted row, and the page renders what comes back.
    return { ...demo.businessProfile, ...patch, updated_at: new Date().toISOString() };
  }
  return api.put<BusinessProfile>("/compliance/profile", patch);
}

/** 400 with guidance when no profile exists yet — create the profile first. */
export async function loadFrameworkRecommendations() {
  if (isDemoMode()) {
    await delay(240);
    return { organization_id: demo.organization.id, recommendations: demo.frameworkRecommendations };
  }
  return api.get<{ organization_id: number; recommendations: unknown[] }>("/compliance/recommendations");
}

// ── Evidence connectors ──────────────────────────────────────────────────────

export interface EvidenceConnector {
  id?: string;
  connector_id?: string;
  name?: string;
  title?: string;
  ready?: boolean;
  configured?: boolean;
  description?: string;
  [k: string]: unknown;
}

export async function loadConnectors() {
  if (isDemoMode()) {
    await delay();
    return { organization_id: demo.organization.id, connectors: demo.evidenceConnectors };
  }
  return api.get<{ organization_id: number; connectors: EvidenceConnector[] }>("/compliance/connectors");
}

/** The server accepts either `{config: {...}}` or a bare config object. */
export async function saveConnectorConfig(connectorId: string, config: Record<string, unknown>) {
  if (isDemoMode()) {
    await delay(300);
    return { ok: true, connector_id: connectorId };
  }
  return api.put<{ ok: boolean; connector_id: string }>(
    `/compliance/connectors/${encodeURIComponent(connectorId)}/config`,
    { config },
  );
}

export async function collectEvidence(connectors?: string[]) {
  if (isDemoMode()) {
    await delay(900);
    // A run only collects from connectors that are actually configured, so the
    // stored count is derived from the same fixtures the page just listed.
    const ran = demo.evidenceConnectors.filter(
      (c) => (c.ready ?? c.configured) && (!connectors?.length || connectors.includes(String(c.connector_id))),
    );
    const stored = ran.reduce((n, c) => n + Number(c.evidence_count ?? 0), 0);
    return {
      organization_id: demo.organization.id,
      connectors_run: ran.map((c) => String(c.connector_id)),
      stored,
      skipped: demo.evidenceConnectors.length - ran.length,
      collected_at: new Date().toISOString(),
    };
  }
  return api.post<Record<string, unknown>>("/compliance/evidence/collect", {
    ...(connectors?.length ? { connectors } : {}),
    use_stored_config: true,
  });
}

export async function loadEvidenceSummary() {
  if (isDemoMode()) {
    await delay(240);
    return demo.evidenceSummary;
  }
  return api.get<Record<string, unknown>>("/compliance/evidence/summary");
}

export async function deleteEvidence(evidenceId: number) {
  if (isDemoMode()) {
    await delay(240);
    return { ok: true, deleted_id: evidenceId };
  }
  return api.delete<{ ok: boolean; deleted_id: number }>(`/compliance/evidence/${evidenceId}`);
}

/** Engine status — surfaced so a 409 (security DB not ready) reads clearly. */
export async function loadComplianceStatus() {
  if (isDemoMode()) {
    await delay(200);
    return {
      organization_id: demo.organization.id,
      status: "implemented",
      security_db_ready: true,
      frameworks_loaded: demo.questionnaire.applicable_frameworks,
      questionnaire_seeded: true,
    };
  }
  return api.get<Record<string, unknown>>("/compliance/status");
}

/** Connector id is the stable key the config endpoint expects. */
export function connectorKey(c: EvidenceConnector): string {
  return String(c.connector_id ?? c.id ?? c.name ?? "");
}

export function connectorLabel(c: EvidenceConnector): string {
  return String(c.title ?? c.name ?? connectorKey(c) ?? "Connector");
}
