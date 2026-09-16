// Entitlements & upgrade — what this organization can use, and how to pay.
//
// Mirrors GET /billing/entitlements (plan, premium status, enforcement window and
// a per-pack entitled flag) and POST /billing/subscribe + /payments/{id}/initialize
// for the self-serve Starter checkout. The pricing *content* lives in ./pricing so
// the landing page and the app render the same catalog.
import { api, delay, isDemoMode } from "./api";

export interface EntitlementPack {
  tool_key: string;
  name: string;
  tier?: string | null;
  pricing_model?: string | null;
  requires_platform_subscription?: boolean;
  entitled: boolean;
  reason?: string | null;
  access_tag?: string | null;
}

export interface BillingEnforcement {
  enabled: boolean;
  mode?: string;
  environment?: string;
  free_asset_cap?: number;
  free_org_user_cap?: number;
  premium_ai_quota_monthly?: number;
  free_report_formats?: string[];
}

export interface Entitlements {
  plan: string;
  premium_active: boolean;
  billing_enforcement: BillingEnforcement;
  asset_count_active?: number | null;
  assets_remaining_free?: number | null;
  org_user_count_active?: number | null;
  org_users_remaining_free?: number | null;
  full_access_coupon?: { code?: string; access_ends_at?: string; status?: string } | null;
  subscription?: Record<string, unknown> | null;
  packs: EntitlementPack[];
  message?: string;
}

const FREE_PLAN = "free";

export async function loadEntitlements(): Promise<Entitlements> {
  if (isDemoMode()) {
    await delay(200);
    return {
      plan: "free",
      premium_active: false,
      billing_enforcement: { enabled: true, mode: "auto", free_asset_cap: 50, free_org_user_cap: 4 },
      packs: [],
      message: "Demo tenant.",
    };
  }
  return api.get<Entitlements>("/billing/entitlements");
}

export function isFreePlan(ent: Entitlements | null | undefined): boolean {
  if (!ent) return false;
  if (ent.full_access_coupon) return false;
  return String(ent.plan || FREE_PLAN).toLowerCase() === FREE_PLAN;
}

/** Whether gates are actually enforced — in dev everything reports entitled. */
export function gatesActive(ent: Entitlements | null | undefined): boolean {
  return Boolean(ent?.billing_enforcement?.enabled);
}

export function packEntitled(ent: Entitlements | null | undefined, toolKey: string): boolean {
  if (!ent || !gatesActive(ent)) return true;
  const pack = (ent.packs ?? []).find((p) => p.tool_key === toolKey);
  return pack ? Boolean(pack.entitled) : true;
}

export function planLabel(plan?: string | null): string {
  const p = String(plan || "").toLowerCase();
  if (p === "free") return "Free";
  if (p === "starter") return "Starter";
  if (p === "growth") return "Growth";
  if (p === "enterprise") return "Enterprise";
  return plan ? p[0].toUpperCase() + p.slice(1) : "Free";
}

/** Plan ordering for tier comparisons. Enterprise ranks highest. */
export const PLAN_RANK: Record<string, number> = {
  free: 0,
  starter: 1,
  growth: 2,
  enterprise: 3,
};

export function planRank(plan?: string | null): number {
  return PLAN_RANK[String(plan || "free").toLowerCase()] ?? 0;
}

/**
 * Whether the org's plan is at least `plan`. Full-access coupons count as the
 * top tier. An `engagement` requirement means “any paid plan plus a quote”, so
 * it resolves to Starter for the in-app gate.
 */
export function planAtLeast(
  ent: Entitlements | null | undefined,
  plan: string,
): boolean {
  if (!ent) return false;
  if (ent.full_access_coupon) return true;
  if (plan === "engagement") return planRank(ent.plan) >= PLAN_RANK.starter;
  return planRank(ent.plan) >= (PLAN_RANK[String(plan).toLowerCase()] ?? 0);
}

/**
 * Features Free cannot use, and the plan that unlocks each.
 *
 * The copy is the *reason a person is here*, not a marketing line — it names what
 * they tried to do and what it needs. Keep the keys aligned with the backend pack
 * keys so an entitlement lookup can drive the same row.
 */
export interface UpsellFeature {
  key: string;
  label: string;
  plan: "starter" | "growth" | "enterprise" | "engagement";
  blurb: string;
}

export const UPSELL_FEATURES: Record<string, UpsellFeature> = {
  // Growth is a **cap** upsell: the surface is reachable, the always-on
  // behaviour is what Growth buys.
  continuous_pr: {
    key: "continuous_pr",
    label: "Continuous PR / MR review",
    plan: "growth",
    blurb: "Every push reviewed, not just an on-demand check. Continuous PR is a Growth capability.",
  },
  continuous_pentest: {
    key: "continuous_pentest",
    label: "Continuous / recurring pentest",
    plan: "growth",
    blurb: "Re-tested on a schedule so a fix is confirmed, not assumed. Recurring pentest is Growth.",
  },
  // Starter is a **section** upsell: the whole page unlocks on any paid plan.
  cloud_security_scan: {
    key: "cloud_security_scan",
    label: "Cloud posture",
    plan: "starter",
    blurb: "Cloud posture from connected accounts is included with Starter and Growth.",
  },
  container_security_scan: {
    key: "container_security_scan",
    label: "Container & Kubernetes posture",
    plan: "starter",
    blurb: "Image and cluster posture with a container runtime is included with Starter and Growth.",
  },
  secrets_and_sca: {
    key: "secrets_and_sca",
    label: "Secrets, SCA & SAST",
    plan: "starter",
    blurb: "Six-layer code security — secrets, dependencies, IaC and SAST — is included with Starter and Growth.",
  },
  compliance_workbench: {
    key: "compliance_workbench",
    label: "Compliance workbench",
    plan: "starter",
    blurb: "Evidence collection, mappings and audit packaging are included with Starter and Growth.",
  },
  soc_alert_console: {
    key: "soc_alert_console",
    label: "SOC console",
    plan: "starter",
    blurb: "The detection queue and analyst console are included with Starter and Growth.",
  },
  ai_pentest_agent: {
    key: "ai_pentest_agent",
    label: "Autonomous Pentest Agent",
    plan: "starter",
    blurb: "Governed agent sessions against your own assets are included with Starter and Growth.",
  },
  dynamic_mobile: {
    key: "dynamic_mobile",
    label: "Dynamic mobile / AVD testing",
    plan: "engagement",
    blurb: "Runtime mobile analysis is a project engagement — request a quote.",
  },
};

/** Section key → the plan that unlocks it, for the in-page section gate. */
export const SECTION_UPSELL: Record<string, { label: string; plan: "starter" | "growth" }> = {
  "attack.pentest_agent": { label: "Pentest agent", plan: "starter" },
  "attack.mobile": { label: "Mobile testing", plan: "starter" },
  "defend.cloud": { label: "Cloud posture", plan: "starter" },
  "defend.compliance": { label: "Compliance", plan: "starter" },
  "defend.compliance_questionnaire": { label: "Compliance questionnaire", plan: "starter" },
  "defend.compliance_gaps": { label: "Compliance gap analysis", plan: "starter" },
  "defend.compliance_profile": { label: "Compliance business profile", plan: "starter" },
  "defend.compliance_connectors": { label: "Compliance evidence connectors", plan: "starter" },
  "defend.soc": { label: "SOC console", plan: "starter" },
  "defend.soc_war_room": { label: "SOC war room", plan: "starter" },
  "defend.soc_playbooks": { label: "SOC playbooks", plan: "starter" },
  "defend.soc_advisor": { label: "SOC advisor", plan: "starter" },
  "defend.soc_logs": { label: "SOC log pipeline", plan: "starter" },
  "defend.soc_agents": { label: "SOC agents", plan: "starter" },
  "defend.soc_cloud": { label: "SOC cloud integrations", plan: "starter" },
  "defend.threat_intel": { label: "Threat intelligence", plan: "starter" },
};

export function sectionUpsell(sectionKey?: string | null) {
  if (!sectionKey) return null;
  return SECTION_UPSELL[sectionKey] ?? null;
}

export function upsellFor(key?: string | null): UpsellFeature | null {
  if (!key) return null;
  return UPSELL_FEATURES[key] ?? null;
}

// Self-serve checkout (subscribe, plan purchase) lives on the Platform app's
// Billing page now — every upgrade CTA in this app links there instead of
// running its own checkout flow.
