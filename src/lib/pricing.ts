// Pricing catalog — fetches live pricing from the backend; falls back to the
// pricing-v3 catalogue (Free / Starter / Growth / Enterprise) when offline.
// Source of structure: docs/10-programme/03-pricing-v3.md.
import { API_BASE, isDemoMode } from "./api";

export interface PricingTier {
  id: string;
  name: string;
  tagline: string;
  monthly_ngn: number | null;
  first_month_ngn?: number | null;
  yearly_price_ngn?: number;
  yearly_note?: string;
  highlighted?: boolean;
  cta: string;
  features: string[];
}

/**
 * Live `/billing/pricing` may return either:
 *  - the legacy single-price object (Starter list price + first-month + yearly),
 *  - or a plans array (`[{ id, name, monthly_ngn, first_month_ngn, ... }]`).
 * Growth list price is provisional (199/99 × Starter) until staff-configured.
 */
interface BillingPricingResponse {
  monthly_list_price_ngn: number;
  first_month_price_ngn?: number;
  subsequent_monthly_price_ngn?: number;
  yearly_price_ngn?: number;
  first_month_discount_percent?: number;
  growth_monthly_price_ngn?: number;
  plans?: Array<Partial<PricingTier> & { id: string; monthly_ngn: number | null }>;
}

const freeFeatures = [
  "Asset inventory + discovery (domain, nmap, GitHub, OpenAPI)",
  "On-demand scans — one active job per org",
  "Verified-only findings with dedupe",
  "JSON / CSV reports (free formats)",
  "Dual control, MFA, immutable audit + evidence redaction — free on every plan",
  "Community support",
];

const starterFeatures = [
  "Everything in Free",
  "Full engine — complete code review, web/API/mobile assessment, threat modelling",
  "Context + threat modelling with doc & architecture imports (draw.io) — monthly model refreshes",
  "PR/MR review automation (limited volume) with context-aware AI triage",
  "On-demand authenticated web / API / mobile assessment",
  "AI credits — 3,000 onboarding allotment plus a recurring plan allowance (top up in-workspace)",
  "PDF / HTML / MD board-ready reports + WA / Telegram alert channels",
  "Standard support",
];

const growthFeatures = [
  "Everything in Starter",
  "Continuous security — all enabled repos reviewed, recurring authenticated web / API tests",
  "Higher allowances — projects, PR review, model refreshes, mobile volume",
  "Multi-cloud posture + attack paths (AWS +) and Kubernetes posture",
  "Blocking policies & path rules",
  "AI credits — 10,000 onboarding allotment plus a larger recurring plan allowance",
  "Guided onboarding",
];

const enterpriseFeatures = [
  "Everything in Growth",
  "Custom volume & concurrency — assessments, repos, projects",
  "Org-wide governance & audit views",
  "Multi-company groups, custom branding & report retention",
  "Dedicated success engineer — custom quote (annual preferred)",
];

function yearsNote(monthly: number): string {
  const yearly = monthly * 10; // pricing-v3 §7: annual = 10× monthly
  return `NGN ${yearly.toLocaleString()}/year (pay for 10 months, get 12)`;
}

export function buildPricingTiers(raw: BillingPricingResponse | null): PricingTier[] {
  // Fallback numbers are pricing-v3 §7 placeholders, used ONLY when the billing
  // API is unreachable. The app must prefer live `/billing/pricing`.
  const fallback = raw ?? {
    monthly_list_price_ngn: 9_900, // Starter (Premium carried over)
    first_month_price_ngn: 4_900,
    yearly_price_ngn: 99_000,
    growth_monthly_price_ngn: 19_900,
    first_month_discount_percent: 50,
  };

  // Newer shape: the API returns a full plans array — map it straight through.
  if (Array.isArray(fallback.plans) && fallback.plans.length > 0) {
    return fallback.plans
      .filter((p) => p && typeof p.id === "string")
      .map((p) => ({
        id: p.id,
        name: p.name ?? p.id,
        tagline: p.tagline ?? "",
        monthly_ngn: p.monthly_ngn,
        first_month_ngn: p.first_month_ngn ?? null,
        yearly_price_ngn: p.yearly_price_ngn,
        yearly_note: p.yearly_price_ngn ? yearsNote(p.monthly_ngn ?? 0) : undefined,
        highlighted: Boolean(p.highlighted),
        cta: p.cta ?? (p.id === "free" ? "Get started free" : p.id === "enterprise" ? "Talk to us" : "Choose " + (p.name ?? p.id)),
        features: p.features ?? [],
      }));
  }

  const starterMonthly = fallback.monthly_list_price_ngn;
  const starterFirstMonth = fallback.first_month_price_ngn ?? 0;
  const starterYearly = fallback.yearly_price_ngn ?? starterMonthly * 10;
  // Growth is provisional (199/99 × Starter) unless the API supplies a real price.
  const growthMonthly = fallback.growth_monthly_price_ngn ?? Math.round(starterMonthly * (19_900 / 9_900));

  return [
    {
      id: "free", name: "Free", tagline: "Know your attack surface",
      monthly_ngn: 0, first_month_ngn: 0,
      yearly_note: "No card required",
      cta: "Get started free",
      features: freeFeatures,
    },
    {
      id: "starter", name: "Starter", tagline: "Full engine, starter coverage",
      monthly_ngn: starterMonthly,
      first_month_ngn: starterFirstMonth,
      yearly_price_ngn: starterYearly,
      yearly_note: yearsNote(starterMonthly),
      cta: "Upgrade to Starter",
      features: starterFeatures,
    },
    {
      id: "growth", name: "Growth", tagline: "Continuous security — the default for serious teams",
      monthly_ngn: growthMonthly,
      yearly_price_ngn: growthMonthly * 10,
      yearly_note: yearsNote(growthMonthly),
      highlighted: true,
      cta: "Choose Growth",
      features: growthFeatures,
    },
    {
      id: "enterprise", name: "Enterprise", tagline: "Custom volume, governance & support",
      monthly_ngn: null,
      cta: "Talk to us",
      features: enterpriseFeatures,
    },
  ];
}

export const pricingFootnote =
  "Prices in Nigerian Naira (NGN), per company per month — updated live from SecureGraph billing; annual = 10× monthly. AI work is metered as credits: viewing, assigning and exporting results is never billed, and top-ups are bought in-workspace without a plan change. Enterprise is a custom quote.";

let _cachedTiers: PricingTier[] | null = null;

export async function loadPricing(): Promise<PricingTier[]> {
  if (_cachedTiers) return _cachedTiers;
  if (isDemoMode()) {
    _cachedTiers = buildPricingTiers({ monthly_list_price_ngn: 9_900, first_month_price_ngn: 4_900, yearly_price_ngn: 99_000, growth_monthly_price_ngn: 19_900, first_month_discount_percent: 50 });
    return _cachedTiers;
  }
  try {
    if (!API_BASE) throw null;
    const res = await fetch(`${API_BASE}/billing/pricing`);
    if (!res.ok) throw null;
    const data = await res.json();
    _cachedTiers = buildPricingTiers(data as BillingPricingResponse);
    return _cachedTiers;
  } catch {
    _cachedTiers = buildPricingTiers(null);
    return _cachedTiers;
  }
}

export async function loadPricingTiers(): Promise<PricingTier[]> {
  return loadPricing();
}
