// Pricing catalog — fetches live pricing from backend. Fallback to defaults when offline.
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

interface BillingPricingResponse {
  monthly_list_price_ngn: number;
  first_month_price_ngn: number;
  subsequent_monthly_price_ngn: number;
  yearly_price_ngn: number;
  first_month_discount_percent: number;
}

const freeFeatures = [
  "Asset inventory + discovery (domain, nmap, GitHub, OpenAPI)",
  "On-demand scans — one active job per org",
  "Verified-only findings with dedupe",
  "Markdown / JSON reporting (free formats)",
  "Email alerts + dual-control / MFA",
  "Community support",
];

const premiumFeatures = [
  "Everything in Free",
  "VAPT campaigns — web pipeline, correlation, approvals",
  "Risk register with priority queue (P1—P5)",
  "Compliance assessments + evidence connectors",
  "PDF / DOCX / XLSX board-ready reports",
  "WA / Telegram alert channels",
  "AI-assisted remediation + executive summaries",
  "Continuous asset intelligence",
  "10 org users + application login links",
  "Priority support",
];

const enterpriseFeatures = [
  "Everything in Premium",
  "Multi-company groups — one service key per company",
  "AI multi-model consensus narratives",
  "Cross-org correlation mining (opt-in)",
  "Custom report retention & branding",
  "Staff-reviewed company verification",
  "Dedicated success engineer",
];

export function buildPricingTiers(raw: BillingPricingResponse | null): PricingTier[] {
  const fallback = raw ?? { monthly_list_price_ngn: 100000, first_month_price_ngn: 50000, subsequent_monthly_price_ngn: 100000, yearly_price_ngn: 1000000, first_month_discount_percent: 50 };
  const monthly = fallback.monthly_list_price_ngn;
  const firstMonth = fallback.first_month_price_ngn;
  const yearly = fallback.yearly_price_ngn;
  const yearlyMonthlyEq = yearly / monthly;
  const discountNote = fallback.first_month_discount_percent > 0 ? `First month ${fallback.first_month_discount_percent}% off` : "";

  return [
    {
      id: "free", name: "Free", tagline: "Know your attack surface",
      monthly_ngn: 0, first_month_ngn: 0,
      yearly_note: "No card required",
      cta: "Get started free",
      features: freeFeatures,
    },
    {
      id: "premium", name: "Premium", tagline: "Full VAPT + governance",
      monthly_ngn: monthly,
      first_month_ngn: firstMonth,
      yearly_price_ngn: yearly,
      yearly_note: `₦${yearly.toLocaleString()}/year (pay for ${yearlyMonthlyEq.toFixed(0)} months, get 12)`,
      highlighted: true,
      cta: "Upgrade to Premium",
      features: premiumFeatures,
    },
    {
      id: "enterprise", name: "Enterprise", tagline: "Groups & regulated teams",
      monthly_ngn: null, cta: "Talk to us",
      features: enterpriseFeatures,
    },
  ];
}

export const pricingFootnote =
  "Prices in Nigerian Naira (NGN), per company per month. Subscribe on the Platform — pricing updates from Phantix billing. No hidden fees.";

let _cachedTiers: PricingTier[] | null = null;

export async function loadPricing(): Promise<PricingTier[]> {
  if (_cachedTiers) return _cachedTiers;
  if (isDemoMode()) { _cachedTiers = buildPricingTiers({ monthly_list_price_ngn: 100000, first_month_price_ngn: 50000, subsequent_monthly_price_ngn: 100000, yearly_price_ngn: 1000000, first_month_discount_percent: 50 }); return _cachedTiers; }
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
