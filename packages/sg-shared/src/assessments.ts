/**
 * Assessment Intelligence — the shared feed every app reads.
 *
 * `GET /api/v1/assessments/latest` returns the most recent completed assessment
 * (AGI session, VAPT campaign, agent run) with its findings and the next actions
 * each application can take. Every app renders a "From your last assessment"
 * panel from this one call, so none of them is empty after a run.
 */
import { api, isDemoMode } from "./api";

export type AssessmentApp = "core" | "attack" | "defend" | "code";

export type AssessmentAction = {
  kind: string;
  label: string;
  entity_type?: string;
  entity_id?: number | null;
  href?: string;
  endpoint?: string;
  method?: string;
};

/** CVSS 3.1 base score, computed deterministically by the backend. */
export type AssessmentCvss = {
  version: string;
  vector: string;
  base_score: number;
  severity: string;
  source?: string;
};

export type AssessmentFinding = {
  id: number;
  finding_key: string;
  title: string;
  severity: string;
  category: string | null;
  target: string | null;
  asset_id: number | null;
  status: string;
  refs: Record<string, unknown>;
  cvss?: AssessmentCvss | null;
  case_id?: number | null;
  actions: AssessmentAction[];
  last_seen_at?: string | null;
};

export type AssessmentSummary = {
  id: number;
  source: string;
  external_id?: string | null;
  title: string;
  environment?: string | null;
  status: string;
  findings_count: number;
  severity_counts: Record<string, number>;
  coverage?: Record<string, unknown>;
  completed_at: string | null;
};

export type LatestAssessment = {
  as_of: string | null;
  assessment: AssessmentSummary | null;
  findings: AssessmentFinding[];
  actions_by_app: Record<AssessmentApp, AssessmentAction[]>;
  stale: boolean;
  stale_after_hours?: number;
  note?: string;
};

export function emptyAssessment(): LatestAssessment {
  return {
    as_of: null,
    assessment: null,
    findings: [],
    actions_by_app: { core: [], attack: [], defend: [], code: [] },
    stale: true,
  };
}

export async function loadLatestAssessment(): Promise<LatestAssessment> {
  if (isDemoMode()) return emptyAssessment();
  try {
    const res = await api.get<LatestAssessment>("/assessments/latest");
    return { ...emptyAssessment(), ...res, actions_by_app: { ...emptyAssessment().actions_by_app, ...(res?.actions_by_app || {}) } };
  } catch {
    return emptyAssessment();
  }
}
