// ── AI model catalog (staging-rollout §6) ────────────────────────────────────
// GET /api/v1/ai/models → models across two surfaces ("pentest" | "general").
// The API may return a flat list (each item carries `surfaces: [...]`) or the
// nested { surfaces: { pentest, general } } shape; both are normalised here.
// Selection persists server-side via PUT /api/v1/ai/settings
// ({ preferred_model } for general, { pentest_model } for pentest).

import { api } from "./api";

export type AiSurface = "pentest" | "general";
export type AiTier = "economy" | "balanced" | "enterprise";

export interface AiModel {
  id: string;
  provider?: string;
  model?: string;
  model_name?: string;
  label?: string;
  surfaces?: AiSurface[];
  tier?: string;
  capabilities?: string[];
  audience?: string;
  free?: boolean;
  notes?: string | null;
  available?: boolean;
  unavailable_reason?: string | null;
  pentest_eligible?: boolean;
  selected?: boolean;
}

export type AiCapability = "text" | "vision" | "reasoning" | "tools" | "json";

export const CAPABILITY_LABELS: Record<string, string> = {
  text: "Text",
  vision: "Vision",
  reasoning: "Reasoning",
  tools: "Tools",
  json: "JSON",
};

export function capabilityLabel(cap: string): string {
  return CAPABILITY_LABELS[cap] ?? cap;
}

export interface AiSurfaceView {
  models: AiModel[];
  selected: string | null;
  default: string | null;
  settingsField?: string;
  restrictedBecause?: string | null;
  freeAgreementAccepted?: boolean;
  freePlan?: boolean;
  freeModelsEnabled?: boolean;
}

export interface FreeModelAgreement {
  version: string;
  title: string;
  summary: string;
  acceptance_required_copy: string;
  sections: { id: string; title: string; body: string }[];
  required: boolean;
  accepted: boolean;
  accepted_at?: string | null;
}

type ModelsPayload =
  | { surfaces?: Partial<Record<AiSurface, { models?: AiModel[]; selected?: string | null; default?: string | null; settings_field?: string; restricted_because?: string | null }>> }
  | { models?: AiModel[] }
  | AiModel[];

const TIER_ORDER = ["economy", "balanced", "enterprise"];
export const TIER_ORDER_SET = new Set(TIER_ORDER);

export function tierRank(tier?: string): number {
  const t = (tier ?? "").toLowerCase();
  const i = TIER_ORDER.indexOf(t);
  return i === -1 ? TIER_ORDER.length : i;
}

/** Human label — prefer label, then model_name, then the id's tail. */
export function modelLabel(m: AiModel): string {
  if (m.label) return m.label;
  if (m.model_name) return m.model_name;
  if (m.model) return m.model;
  return m.id.split(":").pop() ?? m.id;
}

function normalizeModel(raw: Record<string, unknown>): AiModel {
  const id = String(raw.id ?? "");
  return {
    id,
    provider: raw.provider != null ? String(raw.provider) : undefined,
    model: raw.model != null ? String(raw.model) : undefined,
    model_name: raw.model_name != null ? String(raw.model_name) : undefined,
    label: raw.label != null ? String(raw.label) : undefined,
    surfaces: Array.isArray(raw.surfaces) ? raw.surfaces.map((s) => String(s) as AiSurface) : undefined,
    tier: raw.tier != null ? String(raw.tier) : undefined,
    capabilities: Array.isArray(raw.capabilities) ? raw.capabilities.map((c) => String(c)) : undefined,
    audience: raw.audience != null ? String(raw.audience) : undefined,
    free: typeof raw.free === "boolean" ? raw.free : undefined,
    notes: raw.notes != null ? String(raw.notes) : undefined,
    available: typeof raw.available === "boolean" ? raw.available : undefined,
    unavailable_reason: raw.unavailable_reason != null ? String(raw.unavailable_reason) : undefined,
    pentest_eligible: typeof raw.pentest_eligible === "boolean" ? raw.pentest_eligible : undefined,
    selected: typeof raw.selected === "boolean" ? raw.selected : undefined,
  };
}

/** Fetch + resolve the model catalog for one surface. Returns [] on any failure. */
export async function loadModels(surface: AiSurface): Promise<AiSurfaceView> {
  try {
    const payload = await api.get<ModelsPayload>("/ai/models");
    const empty: AiSurfaceView = { models: [], selected: null, default: null };
    const flat = (arr: unknown[]): AiSurfaceView => {
      const models = arr
        .filter((m): m is Record<string, unknown> => !!m && typeof m === "object")
        .map(normalizeModel);
      const eligible = surface === "pentest" ? models.filter((m) => (m.pentest_eligible ?? true) && (!m.surfaces || m.surfaces.includes("pentest"))) : models;
      const forSurface = surface === "general" ? models.filter((m) => !m.surfaces || m.surfaces.includes("general")) : eligible;
      const selected = forSurface.find((m) => m.selected)?.id ?? null;
      return { models: forSurface, selected, default: null };
    };
    if (Array.isArray(payload)) return flat(payload);
    if (payload && typeof payload === "object" && Array.isArray((payload as { models?: unknown[] }).models)) {
      const p = payload as { models?: unknown[] };
      if (p.models) return flat(p.models);
    }
    const nested = (payload as { surfaces?: Partial<Record<AiSurface, { models?: AiModel[]; selected?: string | null; default?: string | null; settings_field?: string; restricted_because?: string | null }>>; free_model_agreement?: { accepted?: boolean }; free_plan?: boolean; free_models_enabled?: boolean }).surfaces?.[surface];
    const meta = payload as {
      free_model_agreement?: { accepted?: boolean };
      free_plan?: boolean;
      free_models_enabled?: boolean;
    };
    if (!nested)
      return {
        ...empty,
        freeAgreementAccepted: meta.free_model_agreement?.accepted,
        freePlan: meta.free_plan,
        freeModelsEnabled: meta.free_models_enabled,
      };
    return {
      models: (nested.models ?? []).map((m) => ({ ...m, selected: m.id === (nested.selected ?? nested.default) })),
      selected: nested.selected ?? nested.default ?? null,
      default: nested.default ?? null,
      settingsField: nested.settings_field,
      restrictedBecause: nested.restricted_because ?? null,
      freeAgreementAccepted: meta.free_model_agreement?.accepted,
      freePlan: meta.free_plan,
      freeModelsEnabled: meta.free_models_enabled,
    };
  } catch {
    return { models: [], selected: null, default: null };
  }
}

/** Persist a model selection server-side (PUT /api/v1/ai/settings). */
export async function selectModel(surface: AiSurface, modelId: string, settingsField?: string): Promise<void> {
  const field = settingsField ?? (surface === "pentest" ? "pentest_model" : "preferred_model");
  await api.put("/ai/settings", { [field]: modelId });
}

/** The free-tier open-source-models agreement (current text + acceptance). */
export async function loadFreeModelAgreement(): Promise<FreeModelAgreement | null> {
  try {
    return await api.get<FreeModelAgreement>("/ai/free-model-agreement");
  } catch {
    return null;
  }
}

/** Record acceptance so free-plan orgs can switch onto the free pools. */
export async function acceptFreeModelAgreement(): Promise<void> {
  await api.post("/ai/free-model-agreement/accept", {});
}

/** The id tail, e.g. "deepseek:deepseek-v4-flash" → "deepseek-v4-flash". */
export function shortModelId(id: string): string {
  return id.split(":").pop() ?? id;
}
