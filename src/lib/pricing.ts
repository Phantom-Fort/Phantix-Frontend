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

// NOTE: feature copy is shared verbatim with the landing pricing page
// (landing/src/lib/pricing.ts). Change one, change both.
const freeFeatures = [
  "Asset inventory + discovery (domain, nmap, GitHub, OpenAPI)",
  "VAPT campaigns + vulnerability / web / API scanner",
  "1 threat-modelling project from your product context",
  "PR / branch review and channel alerts (WhatsApp / Telegram) — metered by AI credits",
  "Every report type and format — free on every plan",
  "500 one-time AI credits, then free open-source models (admin opt-in)",
  "Dual control, MFA, immutable audit, evidence redaction — free on every plan",
  "Community support",
];

const starterFeatures = [
  "Everything in Free",
  "Full engine — six-layer code security, mobile, cloud & supply-chain scanners",
  "Threat modelling & product context — more projects and monthly model refreshes",
  "10 PR / MR security reviews / mo",
  "3 on-demand assessments / mo · 1 model refresh / mo",
  "5,000 AI credits / mo + 5,000 onboarding allotment",
  "AI AutoFix (credit-metered) · email support",
];

const growthFeatures = [
  "Everything in Starter",
  "Continuous PR / MR review and continuous / recurring pentest",
  "5 projects · 20 on-demand assessments / mo · 10 model refreshes / mo",
  "Multi-cloud + Kubernetes posture · blocking policies & path rules",
  "Compliance workbench · SOC alert console",
  "20,000 AI credits / mo + 20,000 onboarding allotment",
  "Guided onboarding",
];

const enterpriseFeatures = [
  "Everything in Growth, at custom volume",
  "Unlimited / negotiated projects & assessments",
  "Org-wide governance & audit views",
  "Multi-company groups, custom branding & report retention",
  "Priority support · dedicated success (deal-dependent)",
  "Partner / white-label reports + custom SLA (deal-dependent)",
];

function yearsNote(monthly: number): string {
  const yearly = monthly * 10; // pricing-v3 §7: annual = 10× monthly
  return `NGN ${yearly.toLocaleString()}/year (pay for 10 months, get 12)`;
}

export function buildPricingTiers(raw: BillingPricingResponse | null): PricingTier[] {
  // Fallback numbers are pricing-v3 §7 placeholders, used ONLY when the billing
  // API is unreachable. The app must prefer live `/billing/pricing`.
  const fallback = raw ?? {
    monthly_list_price_ngn: 19_900, // Starter (Premium carried over)
    first_month_price_ngn: 9_900,
    yearly_price_ngn: 199_000,
    growth_monthly_price_ngn: 49_900,
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
    _cachedTiers = buildPricingTiers({ monthly_list_price_ngn: 19_900, first_month_price_ngn: 9_900, yearly_price_ngn: 199_000, growth_monthly_price_ngn: 49_900, first_month_discount_percent: 50 });
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
