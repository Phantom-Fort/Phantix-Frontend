// Product context + threat modelling (threat_model_engine).
//
// Contracts mirror app/engines/threat_model_engine/api/{context,threat_models}.py.
// Everything persists to the customer's own security DB, so every call here can
// answer 409 when that storage is not activated yet.
//
// List: GET /threat-models?project_id= (authoritative). LOCAL_MODEL_INDEX remains
// a per-browser fallback when the list call fails or demo mode has no API.
import { api, delay, isDemoMode } from "./api";
import * as demo from "./demo-data";

export const PROJECT_STAGES = ["planned", "in_build", "live"] as const;
export type ProjectStage = (typeof PROJECT_STAGES)[number];

export interface ProductProject {
  id: number;
  name: string;
  stage: string;
  active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ProjectComponent {
  id: number;
  name: string;
  kind: string | null;
  boundary_id: number | null;
  trusted: boolean | null;
  external: boolean | null;
}

export interface ProjectFlow {
  id: number;
  source_component_id: number;
  target_component_id: number;
  source_name: string | null;
  target_name: string | null;
  crosses_boundary: boolean | null;
  roles: unknown;
  actions: unknown;
  data: unknown;
}

export interface ProjectGraph {
  components?: ProjectComponent[];
  flows?: ProjectFlow[];
  boundaries?: unknown[];
  [k: string]: unknown;
}

export interface DocumentHit {
  id?: number;
  title?: string;
  chunk?: string;
  text?: string;
  score?: number;
  [k: string]: unknown;
}

// ── Projects ─────────────────────────────────────────────────────────────────

export async function listProjects(activeOnly = true) {
  if (isDemoMode()) {
    await delay();
    const items = activeOnly ? demo.productProjects.filter((p) => p.active) : demo.productProjects;
    return { items, total: items.length };
  }
  return api.get<{ items: ProductProject[]; total: number }>(
    `/context/projects?active_only=${activeOnly ? "true" : "false"}`,
  );
}

export async function createProject(name: string, stage: ProjectStage) {
  if (isDemoMode()) {
    await delay(360);
    const now = new Date().toISOString();
    return {
      id: Math.max(0, ...demo.productProjects.map((p) => p.id)) + 1,
      name,
      stage,
      active: true,
      created_at: now,
      updated_at: now,
    };
  }
  return api.post<ProductProject>("/context/projects", { name, stage });
}

export async function projectGraph(projectId: number) {
  if (isDemoMode()) {
    await delay(420);
    // A project with no diagram uploaded yet returns empty collections, not 404.
    return demo.projectGraphs[projectId] ?? { components: [], flows: [], boundaries: [] };
  }
  return api.get<ProjectGraph>(`/context/projects/${projectId}/graph`);
}

export async function searchProjectDocuments(projectId: number, query: string, limit = 8) {
  if (isDemoMode()) {
    await delay(380);
    const q = query.trim().toLowerCase();
    const pool = demo.projectDocumentHits[projectId] ?? [];
    const items = pool
      .filter((h) => !q || `${h.title ?? ""} ${h.chunk ?? ""}`.toLowerCase().includes(q))
      .slice(0, limit);
    return { items, total: items.length };
  }
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  return api.get<{ items: DocumentHit[]; total: number }>(
    `/context/projects/${projectId}/search?${params}`,
  );
}

/**
 * Requirements text is chunked in the background when a worker is available and
 * inline when the broker is down — the response says which happened.
 */
export async function ingestDocument(projectId: number, input: { text: string; title?: string; kind?: string }) {
  if (isDemoMode()) {
    await delay(560);
    return {
      execution: "celery",
      task_id: `demo-ingest-${projectId}-${Date.now()}`,
      message: "Document queued for chunking.",
    };
  }
  return api.post<{ execution?: string; task_id?: string; message?: string }>(
    `/context/projects/${projectId}/documents`,
    { text: input.text, title: input.title ?? "", kind: input.kind ?? "requirements" },
  );
}

export async function answerContextClarification(clarificationId: number, answer: string) {
  if (isDemoMode()) {
    await delay(300);
    return { clarification_id: clarificationId, applied: true };
  }
  return api.post<{ clarification_id: number; applied: boolean }>(
    `/context/clarifications/${clarificationId}/answer`,
    { answer },
  );
}

/**
 * Diagram upload is multipart and parsed synchronously — a bad diagram comes
 * back as a 400 with the parse reason, which is what the uploader needs to see.
 */
export async function uploadDiagram(projectId: number, file: File, replace = true): Promise<Record<string, unknown>> {
  if (isDemoMode()) {
    await delay(900);
    const graph = demo.projectGraphs[projectId] ?? { components: [], flows: [], boundaries: [] };
    return {
      project_id: projectId,
      filename: file.name,
      replaced: replace,
      components: (graph.components ?? []).length,
      flows: (graph.flows ?? []).length,
      boundaries: (graph.boundaries ?? []).length,
      parsed_at: new Date().toISOString(),
    };
  }
  const form = new FormData();
  form.append("file", file);
  return api.upload<Record<string, unknown>>(
    `/context/projects/${projectId}/diagram?replace=${replace ? "true" : "false"}`,
    form,
  );
}

// ── Threat models ────────────────────────────────────────────────────────────

export interface ThreatModelMeta {
  id: number;
  project_id: number;
  stage: string | null;
  status: string | null;
  context_snapshot_hash: string | null;
}

export interface ThreatModelListItem extends ThreatModelMeta {
  generation_status?: string | null;
  generation_detail?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  counts?: {
    supported?: number;
    conditional?: number;
    speculative?: number;
    total?: number;
    open_questions?: number;
  };
}

export interface ThreatModelListResponse {
  project_id: number | null;
  models: ThreatModelListItem[];
}

/** GET /threat-models?project_id= — authoritative project-scoped index. */
export async function listThreatModels(projectId?: number, limit = 100) {
  if (isDemoMode()) {
    await delay(280);
    const fromDetails = Object.values(demo.threatModels)
      .map((d) => d.model)
      .filter((m): m is ThreatModelMeta => m != null)
      .map((m) => ({
        ...m,
        created_at: null,
        updated_at: null,
      })) as ThreatModelListItem[];
    const models = projectId == null
      ? fromDetails
      : fromDetails.filter((m) => Number(m.project_id) === projectId);
    return { project_id: projectId ?? null, models };
  }
  const q = new URLSearchParams();
  if (projectId != null) q.set("project_id", String(projectId));
  if (limit !== 100) q.set("limit", String(limit));
  const qs = q.toString();
  return api.get<ThreatModelListResponse>(`/threat-models${qs ? `?${qs}` : ""}`);
}

export interface Threat {
  id: number;
  category: string | null;
  title: string | null;
  impact: string | null;
  grade: string | null;
  verification_question: string | null;
  source_flow_id: number | null;
  source_component_id: number | null;
  status: string | null;
  owner_type: string | null;
  owner_ref: number | null;
}

export interface ThreatClarification {
  id: number;
  question: string;
  answer: string | null;
  open: boolean;
}

export interface ThreatModelDetail {
  model: ThreatModelMeta | null;
  threats: Threat[];
  questions: ThreatClarification[];
}

/** Generation is always asynchronous — a 503 means no worker was available. */
export async function generateThreatModel(projectId: number, stage?: string) {
  if (isDemoMode()) {
    await delay(700);
    return {
      project_id: projectId,
      execution: "celery",
      task_id: `demo-threat-model-${projectId}-${Date.now()}`,
      message: "Generation queued. In this demo tenant, models 9001 and 9002 are already built — open one by id.",
    };
  }
  return api.post<{ project_id: number; execution: string; task_id: string; message?: string }>(
    "/threat-models",
    { project_id: projectId, ...(stage ? { stage } : {}) },
  );
}

export async function getThreatModel(modelId: number) {
  if (isDemoMode()) {
    await delay(420);
    return demo.threatModels[modelId] ?? { model: null, threats: [], questions: [] };
  }
  return api.get<ThreatModelDetail>(`/threat-models/${modelId}`);
}

export async function answerThreatClarification(modelId: number, clarificationId: number, answer: string) {
  if (isDemoMode()) {
    await delay(600);
    // Answering re-grades the threats that cited the question.
    const detail = demo.threatModels[modelId];
    const question = detail?.questions.find((q) => q.id === clarificationId);
    const regraded = (detail?.threats ?? [])
      .filter((t) => t.verification_question && t.verification_question === question?.question)
      .map((t) => t.id);
    return { ok: true, re_graded_threat_ids: regraded };
  }
  // still_open → the answer did not settle the question (contract §3 Clarify).
  return api.post<{ ok?: boolean; still_open?: boolean; re_graded_threat_ids?: number[] }>(
    `/threat-models/${modelId}/clarify`,
    { clarification_id: clarificationId, answer },
  );
}

/** `project_id` is a query parameter on this route, not a body field. */
export async function regenerateThreatModel(modelId: number, projectId: number) {
  if (isDemoMode()) {
    await delay(700);
    return { model_id: modelId, execution: "celery", task_id: `demo-regen-${modelId}-${Date.now()}` };
  }
  return api.post<{ model_id: number; execution: string; task_id: string }>(
    `/threat-models/${modelId}/regenerate?project_id=${projectId}`,
    {},
  );
}

// ── Export / deliver / disposition (02-pages-and-flows §9b) ───────────────────

export type ThreatModelExportFormat = "md" | "html" | "pdf";

/**
 * POST /threat-models/{id}/export → a file (md | html | pdf).
 * PDF may 503 when the renderer is not deployed — the detail explains; the UI
 * should offer md/html instead rather than failing the action.
 */
export async function exportThreatModel(modelId: number, format: ThreatModelExportFormat): Promise<Blob> {
  if (isDemoMode()) {
    throw new Error("Exports are available on a real organisation, not in the demo tenant.");
  }
  return api.postDownload(`/threat-models/${modelId}/export`, { format });
}

/**
 * POST /threat-models/{id}/deliver — parks behind authorizer approval (202
 * { pending, pending_id }) when dual control is configured. only_supported=true
 * keeps conditional threats out of the tracker (they are unsettled questions).
 */
export async function deliverThreatModel(
  modelId: number,
  opts: { connector_id?: string; only_supported?: boolean } = {},
) {
  if (isDemoMode()) {
    await delay(600);
    return { pending: true, status: "pending", detail: "Sent for authorizer approval (demo)." };
  }
  return api.post<Record<string, unknown>>(`/threat-models/${modelId}/deliver`, {
    ...(opts.connector_id ? { connector_id: opts.connector_id } : {}),
    only_supported: opts.only_supported ?? true,
  });
}

/** PATCH /threats/{id} — disposition + ownership. No grade control: grade is rule-computed. */
export async function patchThreat(
  threatId: number,
  patch: { status?: string; owner_type?: string; owner_ref?: number },
) {
  if (isDemoMode()) {
    await delay(300);
    return { id: threatId, ...patch };
  }
  return api.patch<{ id: number }>(`/threats/${threatId}`, patch);
}

// ── Local model index (fallback when GET /threat-models is unavailable) ──────

const INDEX_KEY = "phantix_threat_model_index";

export interface RememberedModel {
  modelId: number;
  projectId: number;
  projectName: string;
  seenAt: number;
}

/**
 * Per-browser fallback when GET /threat-models is unavailable. Prefer
 * {@link listThreatModels} for the authoritative index.
 */
export const LOCAL_MODEL_INDEX = {
  list(): RememberedModel[] {
    try {
      const raw = localStorage.getItem(INDEX_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      const rows = Array.isArray(parsed) ? (parsed as RememberedModel[]) : [];
      // The demo tenant has models but no browser history of them, so seed the
      // index the way a returning real session would already have it.
      if (isDemoMode() && !rows.length) return demo.rememberedThreatModels;
      return rows;
    } catch {
      return isDemoMode() ? demo.rememberedThreatModels : [];
    }
  },
  remember(entry: RememberedModel): void {
    try {
      const rows = LOCAL_MODEL_INDEX.list().filter((r) => r.modelId !== entry.modelId);
      localStorage.setItem(INDEX_KEY, JSON.stringify([entry, ...rows].slice(0, 50)));
    } catch {
      /* storage unavailable — the page still works, it just forgets */
    }
  },
  forget(modelId: number): void {
    try {
      localStorage.setItem(INDEX_KEY, JSON.stringify(LOCAL_MODEL_INDEX.list().filter((r) => r.modelId !== modelId)));
    } catch {
      /* ignore */
    }
  },
};

export const GRADE_TONE: Record<string, string> = {
  supported: "border-severity-critical/30 bg-severity-critical/10 text-severity-critical",
  /** Contract vocabulary (rule-computed grade). */
  conditional: "border-severity-medium/30 bg-severity-medium/10 text-severity-medium",
  /** Legacy alias still present in older demo payloads. */
  speculative: "border-severity-medium/30 bg-severity-medium/10 text-severity-medium",
  refuted: "border-phantix-700 text-slate-500",
};
