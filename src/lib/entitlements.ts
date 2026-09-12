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
  cloud_security_scan: {
    key: "cloud_security_scan",
    label: "Cloud posture packs",
    plan: "growth",
    blurb: "Multi-cloud posture from connected accounts. Cloud packs are part of Growth.",
  },
  container_security_scan: {
    key: "container_security_scan",
    label: "Container & Kubernetes posture",
    plan: "growth",
    blurb: "Image and cluster posture with a container runtime. Container packs are Growth.",
  },
  secrets_and_sca: {
    key: "secrets_and_sca",
    label: "Secrets, SCA & SAST",
    plan: "growth",
    blurb: "Six-layer code security — secrets, dependencies, IaC and SAST. Part of Growth.",
  },
  compliance_workbench: {
    key: "compliance_workbench",
    label: "Compliance workbench",
    plan: "growth",
    blurb: "Evidence collection, mappings and audit packaging sit in the Growth workbench.",
  },
  soc_alert_console: {
    key: "soc_alert_console",
    label: "SOC alert console",
    plan: "growth",
    blurb: "Detection queue and analyst console. The SOC console is a Growth capability.",
  },
  ai_pentest_agent: {
    key: "ai_pentest_agent",
    label: "Autonomous Pentest Agent",
    plan: "growth",
    blurb: "Governed agent sessions against your own assets are part of Growth.",
  },
  dynamic_mobile: {
    key: "dynamic_mobile",
    label: "Dynamic mobile / AVD testing",
    plan: "engagement",
    blurb: "Runtime mobile analysis is a project engagement — request a quote.",
  },
};

export function upsellFor(key?: string | null): UpsellFeature | null {
  if (!key) return null;
  return UPSELL_FEATURES[key] ?? null;
}

// ── Self-serve checkout ──────────────────────────────────────────────────────

export interface SubscribeResult {
  payment?: { id?: number; amount_due_ngn?: number; reference?: string };
  subscription?: Record<string, unknown>;
  message?: string;
}

export async function subscribe(cycle: "monthly" | "yearly"): Promise<SubscribeResult> {
  if (isDemoMode()) {
    await delay(500);
    return { payment: { id: 0 }, message: "Demo checkout is disabled." };
  }
  return api.post<SubscribeResult>("/billing/subscribe", { billing_cycle: cycle });
}

export interface CheckoutSession {
  authorization_url: string;
  access_code?: string;
  reference?: string;
  public_key?: string;
}

/** Initialize Paystack checkout for a pending invoice. */
export async function initializeCheckout(
  paymentId: number,
  callbackUrl?: string,
): Promise<CheckoutSession> {
  return api.post<CheckoutSession>(`/billing/payments/${paymentId}/initialize`, {
    ...(callbackUrl ? { callback_url: callbackUrl } : {}),
  });
}

/**
 * Subscribe then open checkout. Returns the redirect URL, or throws with a message
 * the caller can show. Kept here so every upsell CTA runs the same flow.
 */
export async function startCheckout(cycle: "monthly" | "yearly"): Promise<string> {
  const res = await subscribe(cycle);
  const paymentId = Number(res.payment?.id ?? 0);
  if (!paymentId) {
    throw new Error(res.message || "Could not create the invoice for this plan.");
  }
  const callback = `${window.location.origin}/plans?checkout=return`;
  const session = await initializeCheckout(paymentId, callback);
  if (!session?.authorization_url) {
    throw new Error("Payment provider did not return a checkout URL.");
  }
  return session.authorization_url;
}
