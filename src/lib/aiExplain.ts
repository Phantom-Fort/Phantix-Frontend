// Comprehensive per-asset AI explainer.
// Gathers every signal Phantix holds about ONE asset and builds a deep-dive
// brief: identity, risk trajectory, findings, risks, SOC signals, graph
// relationships, threats and recommended actions. When the backend AI endpoint
// answers, its paragraph is woven in; otherwise the deterministic composition
// stands alone — never inventing CVEs or scores.

import {
  loadAssetsBundle,
  loadAssetIntelligence,
  loadRelationshipGraph,
  loadRisks,
  loadScansBundle,
  loadSocDetections,
  requestAiSummary,
} from "./data";
import type {
  Asset,
  AssetIntelligence,
  RelationshipGraph,
  Risk,
  ScanResult,
  SocDetection,
  AssetTag,
} from "./types";

export interface AssetBrief {
  assetLabel: string;
  assetValue: string;
  assetName: string;
  assetType: string;
  assetId: number;
  environment: string | null;
  source: string | null;
  isVerified: boolean;
  verificationMethod: string | null;
  criticality: string | null;
  tags: Array<{ name: string; color: string }>;
  firstSeenAt: string | null;
  lastSeenAt: string | null;

  riskScore: number | null;
  riskLevel: string | null;
  riskScorePrevious: number | null;
  riskScoreDelta: number | null;
  exposureLevel: string | null;
  openFindingsCount: number | null;

  findings: Array<{
    id: number;
    title: string;
    tool: string;
    severity: string;
    verificationStatus: string;
    confidence: number | null;
    createdAt: string | null;
    impactLevel?: string | null;
  }>;
  findingsBySeverity: Record<string, number>;
  unverifiedFindings: number;

  risks: Array<{
    id: number;
    title: string;
    level: string;
    status: string;
    priorityBand: string | null;
    likelihood: number | null;
    impact: number | null;
    ageDays: number | null;
    treatmentStatus: string | null;
  }>;

  detections: Array<{
    id: number;
    title: string;
    severity: string;
    status: string;
    occurrences: number;
    priorityScore: number | null;
    assignee: string | null;
    lastSeenAt: string | null;
  }>;

  related: Array<{
    id: number;
    value: string;
    assetType: string;
    riskLevel: string | null;
    via: string;
  }>;

  activeThreats: string[];
  recommendedActions: Array<{ label: string; description: string; priority: string }>;
  historicalPostureSummary: string | null;

  /** How many raw engine records fed this brief (transparency counter). */
  recordCount: number;
}

export type ExplanationSource = "ai" | "deterministic";

export interface ComprehensiveExplanation {
  source: ExplanationSource;
  postureSummary: string;
  whyPrioritized: string;
  brief: AssetBrief;
}

const SEV_ORDER = ["critical", "high", "medium", "low", "info"] as const;

function emptyFindingsBySeverity(): Record<string, number> {
  return { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
}

function bumpSev(map: Record<string, number>, sev: string | undefined | null) {
  const k = String(sev ?? "info").toLowerCase();
  map[k] = (map[k] ?? 0) + 1;
}

function riskLevelFromScore(score: number | null | undefined): string | null {
  if (score == null || !Number.isFinite(Number(score))) return null;
  const s = Number(score);
  if (s >= 85) return "critical";
  if (s >= 65) return "high";
  if (s >= 40) return "medium";
  return "low";
}

function sameAsset(a: { asset_id?: number | null; asset_value?: string | null }, id: number, value: string): boolean {
  if (a.asset_id != null && Number(a.asset_id) === id) return true;
  const v = a.asset_value != null ? String(a.asset_value) : "";
  return !!v && !!value && (v === value || value.includes(v) || v.includes(value));
}

/** Pull every Phantix engine's view of one asset. All loaders fail soft so a
 *  partially-degraded deployment still yields a useful brief. */
export async function gatherAssetBrief(asset: Asset, preloadedTags?: AssetTag[]): Promise<AssetBrief> {
  const [intelRes, scansRes, risksRes, detsRes, relRes] = await Promise.all([
    safe(loadAssetIntelligence(asset.id)),
    safe(loadScansBundle()),
    safe(loadRisks()),
    safe(loadSocDetections({ limit: 500 })),
    safe(loadRelationshipGraph()),
  ]);

  const intel = intelRes ?? null;
  const scans = scansRes?.scanResults ?? [];
  const risksAll = risksRes ?? [];
  const detectionsAll = detsRes?.items ?? [];
  const rel = relRes as RelationshipGraph | null;

  const findings = scans
    .filter((s) => sameAsset(s, asset.id, asset.value))
    .sort((a, b) => SEV_ORDER.indexOf((b.severity ?? "info") as any) - SEV_ORDER.indexOf((a.severity ?? "info") as any))
    .map((s) => ({
      id: s.id,
      title: s.title,
      tool: s.tool,
      severity: String(s.severity ?? "info"),
      verificationStatus: String(s.verification_status ?? "unverified"),
      confidence: s.confidence != null ? Number(s.confidence) : null,
      createdAt: s.created_at ?? null,
      impactLevel: s.impact_level ?? null,
    }));

  const findingsBySeverity = emptyFindingsBySeverity();
  let unverifiedFindings = 0;
  for (const f of findings) {
    bumpSev(findingsBySeverity, f.severity);
    if (!["manually_verified", "auto_verified"].includes(f.verificationStatus)) unverifiedFindings += 1;
  }

  const assetRisks = risksAll
    .filter((r) => String(r.asset_value ?? "") === asset.value)
    .map((r) => ({
      id: r.id,
      title: r.title,
      level: r.level,
      status: r.status,
      priorityBand: r.priority_band ?? null,
      likelihood: r.likelihood ?? null,
      impact: r.impact ?? null,
      ageDays: r.age_days ?? null,
      treatmentStatus: r.treatment_status ?? null,
    }));
  const assetRiskIds = new Set(assetRisks.map((r) => r.id));

  const detections = detectionsAll
    .filter(
      (d) =>
        Number(d.asset_id ?? -1) === asset.id ||
        sameAsset(d as any, asset.id, asset.value) ||
        // Detections raised from a register risk inherit that risk's asset.
        (d.risk_id != null && assetRiskIds.has(Number(d.risk_id))),
    )
    .map((d) => ({
      id: d.id,
      title: d.title,
      severity: String(d.severity ?? "info"),
      status: String(d.status ?? "open"),
      occurrences: d.occurrence_count ?? 1,
      priorityScore: d.priority_score != null ? Math.round(Number(d.priority_score)) : null,
      assignee: d.assignee_ref ?? null,
      lastSeenAt: d.last_seen_at ?? null,
    }));

  const nodeById = new Map<number, { value: string; assetType: string | null }>();
  for (const n of rel?.nodes ?? []) nodeById.set(Number(n.id), { value: n.value ?? n.name ?? `#${n.id}`, assetType: n.assetType ?? null });
  const relatedFromEdges: AssetBrief["related"] = [];
  for (const e of rel?.edges ?? []) {
    let otherId: number | null = null;
    if (Number(e.source) === asset.id) otherId = Number(e.target);
    else if (Number(e.target) === asset.id) otherId = Number(e.source);
    if (otherId == null) continue;
    const node = nodeById.get(otherId);
    if (!node) continue;
    relatedFromEdges.push({
      id: otherId,
      value: node.value,
      assetType: node.assetType ?? "",
      riskLevel: null,
      via: e.relationshipType ?? "related",
    });
  }
  const seenRel = new Set(relatedFromEdges.map((r) => r.id));
  const relatedFromIntel = (intel?.related_assets ?? [])
    .filter((r) => !seenRel.has(r.id))
    .map((r) => ({
      id: r.id,
      value: r.value ?? r.name ?? `#${r.id}`,
      assetType: r.asset_type ?? "",
      riskLevel: riskLevelFromScore(r.risk_score),
      via: "intelligence",
    }));

  const brief: AssetBrief = {
    assetId: asset.id,
    assetLabel: asset.value || asset.name || `#${asset.id}`,
    assetValue: asset.value,
    assetName: asset.name,
    assetType: asset.asset_type,
    environment: asset.environment ?? null,
    source: asset.source ?? null,
    isVerified: Boolean(asset.is_verified),
    verificationMethod: asset.verification_method ?? null,
    criticality: asset.criticality ?? null,
    tags: (asset.tags ?? []).map((t) => ({ name: t.name, color: t.color })),
    firstSeenAt: asset.first_discovered_at ?? null,
    lastSeenAt: asset.last_seen_at ?? null,

    riskScore: intel?.risk_score ?? null,
    riskLevel: intel?.risk_level ?? null,
    riskScorePrevious: intel?.previous_risk_score ?? null,
    riskScoreDelta: intel?.risk_score_delta ?? null,
    exposureLevel: intel?.exposure_level ?? null,
    openFindingsCount: intel?.open_findings_count ?? findings.length,

    findings,
    findingsBySeverity,
    unverifiedFindings,

    risks: assetRisks,

    detections,

    related: [...relatedFromEdges, ...relatedFromIntel],

    activeThreats: intel?.active_threats ?? [],
    recommendedActions: intel?.recommended_actions ?? [],
    historicalPostureSummary: intel?.posture_summary ?? null,

    recordCount: findings.length + assetRisks.length + detections.length + relatedFromEdges.length + (intel ? 1 : 0),
  };
  void preloadedTags;
  return brief;
}

async function safe<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch {
    return null;
  }
}

/** Deterministic deep narrative — cites only numbers present in the brief. */
function composePostureSummary(brief: AssetBrief): string {
  const sentences: string[] = [];
  const identify = `${brief.assetLabel}${brief.assetType ? ` (${brief.assetType.replace(/_/g, " ")})` : ""}` +
    `${brief.environment ? ` in ${brief.environment}` : ""}`;
  const verifiedBit = brief.isVerified
    ? `Ownership is verified${brief.verificationMethod ? ` via ${brief.verificationMethod.replace(/_/g, " ")}` : ""}`
    : "Ownership is NOT yet verified";
  sentences.push(`${identify} is ${brief.isVerified ? "a verified" : "an UNVERIFIED"} asset. ${verifiedBit}.`);

  if (brief.riskScore != null) {
    let traj = "";
    if (brief.riskScoreDelta != null && brief.riskScoreDelta !== 0) {
      traj = brief.riskScoreDelta > 0
        ? `risk climbed from ${brief.riskScorePrevious ?? "?"} to ${brief.riskScore} (+${brief.riskScoreDelta})`
        : `risk improved from ${brief.riskScorePrevious ?? "?"} to ${brief.riskScore} (${brief.riskScoreDelta})`;
    } else {
      traj = `current risk score sits at ${brief.riskScore}/100`;
    }
    sentences.push(`Phantix scores this asset ${brief.riskLevel ?? "unrated"} with ${traj}${brief.exposureLevel ? `, exposed via ${brief.exposureLevel.replace(/_/g, " ")}` : ""}.`);
  }

  const sevBits = SEV_ORDER.map((s) => `${brief.findingsBySeverity[s] ?? 0} ${s}`).filter((bit) => !bit.startsWith("0 "));
  if (findingsTotal(brief) > 0) {
    sentences.push(
      `Scan engines recorded ${findingsTotal(brief)} finding(s) — ${sevBits.join(", ") || "none rated"} — across ${
        new Set(brief.findings.map((f) => f.tool)).size || "?"
      } tool(s). ${brief.unverifiedFindings > 0 ? `${brief.unverifiedFindings} finding(s) remain unverified candidates.` : "All findings carry verified evidence."}`,
    );
  } else {
    sentences.push("No scan findings exist for this asset yet — either never scanned or scanner coverage was silent.");
  }

  if (brief.risks.length > 0) {
    const worst = brief.risks[0];
    sentences.push(`The risk register carries ${brief.risks.length} entr${brief.risks.length === 1 ? "y" : "ies"} for it; ${worst.level}-rated "${worst.title}"${worst.priorityBand ? ` (${worst.priorityBand})` : ""}${worst.treatmentStatus ? `, treatment status "${worst.treatmentStatus}"` : ", awaiting treatment decision"}.`);
  }

  if (brief.detections.length > 0) {
    const hottest = [...brief.detections].sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0))[0];
    sentences.push(`SOC telemetry shows ${brief.detections.length} detection(s) touching this asset; the most urgent is "${hottest.title}" (${hottest.severity}, priority ${hottest.priorityScore ?? "?"}).`);
  }

  if (brief.related.length > 0) {
    sentences.push(`It is networked into ${brief.related.length} other asset(s) in the relationship graph (e.g. ${brief.related.slice(0, 3).map((r) => r.value).join(", ")}), so compromise here could pivot.`);
  }

  if (brief.activeThreats.length > 0) {
    sentences.push(`Threat mapping flags: ${brief.activeThreats.join(", ")}.`);
  }

  sentences.push(brief.lastSeenAt
    ? `Last observed on the wire recently (${brief.lastSeenAt.slice(0, 10)}); treat current findings as actionable until rescanned.`
    : "No recent heartbeat — confirm the asset is actually live before acting.");

  return sentences.join(" ");
}

function findingsTotal(brief: AssetBrief): number {
  return Object.values(brief.findingsBySeverity).reduce((a, b) => a + b, 0);
}

function composeWhyPrioritized(brief: AssetBrief): string {
  const drivers: string[] = [];
  if (/external|public/.test(String(brief.exposureLevel ?? ""))) drivers.push("internet-exposed surface");
  if ((brief.findingsBySeverity.critical ?? 0) > 0) drivers.push(`${brief.findingsBySeverity.critical} critical finding(s)`);
  if ((brief.findingsBySeverity.high ?? 0) > 0) drivers.push(`${brief.findingsBySeverity.high} high finding(s)`);
  if (brief.tags.some((t) => /crown|jewel|critical/i.test(t.name))) drivers.push("tagged as crown-jewel");
  if (!brief.isVerified) drivers.push("ownership not verified");
  if (brief.detections.some((d) => ["critical", "high"].includes(d.severity))) drivers.push("live SOC detections");
  if (brief.risks.some((r) => ["critical", "high"].includes(r.level))) drivers.push("open register risks");
  if ((brief.riskScoreDelta ?? 0) > 0) drivers.push("worsening risk trajectory");
  if (!drivers.length) drivers.push("baseline hygiene monitoring");
  return drivers.slice(0, 4).join(", ");
}

/** Full generation pipeline: gather everything, weave in backend AI if reachable. */
export async function generateComprehensiveExplanation(asset: Asset, preloadedTags?: AssetTag[]): Promise<ComprehensiveExplanation> {
  const brief = await gatherAssetBrief(asset, preloadedTags);
  const deterministic = composePostureSummary(brief);
  const why = composeWhyPrioritized(brief);

  try {
    const res = await requestAiSummary(asset.id);
    const aiText = typeof res?.postureSummary === "string" ? res.postureSummary.trim() : "";
    const aiWhy = typeof res?.whyPrioritized === "string" ? res.whyPrioritized.trim() : "";
    const looksGeneric = !aiText || /^this asset appears/i.test(aiText);
    const summarySource = res?.summarySource === "ai" && !looksGeneric ? "ai" : "deterministic";
    return {
      source: summarySource === "ai" ? "ai" : "deterministic",
      postureSummary: summarySource === "ai"
        ? `${aiText}\n\nDeep context (composed from ${brief.recordCount} engine records):\n${deterministic}`
        : deterministic,
      whyPrioritized: aiWhy || why,
      brief,
    };
  } catch {
    return { source: "deterministic", postureSummary: deterministic, whyPrioritized: why, brief };
  }
}

/** Demo/staging-friendly asset-intel lookup used by the picker preview rows. */
export async function findAssetInInventory(id: number): Promise<Asset | null> {
  const bundle = await loadAssetsBundle();
  return (bundle.assets ?? []).find((a) => a.id === id) ?? null;
}
