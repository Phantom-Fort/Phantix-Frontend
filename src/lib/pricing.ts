// ── Pricing catalog ───────────────────────────────────────────────────────────
// PLACEHOLDER DATA — real list prices land soon. The backend source of truth is
// GET /api/v1/billing/pricing (monthly list price in NGN; yearly auto-calculated;
// first month 50% off). Swap these entries for the live payload when finalized.

export interface PricingTier {
  id: string;
  name: string;
  tagline: string;
  monthly_ngn: number | null; // null = talk to us
  first_month_ngn?: number | null;
  yearly_note?: string;
  highlighted?: boolean;
  cta: string;
  features: string[];
}

export const pricingTiers: PricingTier[] = [
  {
    id: "starter",
    name: "Starter",
    tagline: "Know your attack surface",
    monthly_ngn: 1000,
    first_month_ngn: 500,
    yearly_note: "Yearly auto-calculated",
    cta: "Start with Starter",
    features: [
      "Asset inventory + discovery (domain_enum, nmap, GitHub, OpenAPI)",
      "On-demand scans — one active job per org",
      "Verified-only findings with dedupe",
      "Markdown / JSON reporting",
      "2 org users with dual control",
      "Community support",
    ],
  },
  {
    id: "scale",
    name: "Scale",
    tagline: "Full VAPT + governance",
    monthly_ngn: 2500,
    first_month_ngn: 1250,
    yearly_note: "Yearly auto-calculated",
    highlighted: true,
    cta: "Go Scale",
    features: [
      "Everything in Starter",
      "VAPT campaigns — web pipeline, correlation, approvals",
      "Risk register with priority queue (P1–P5)",
      "Compliance assessments + evidence connectors",
      "PDF / DOCX client packages on the VAPT template",
      "Alert channels — email, WhatsApp, Telegram (critical)",
      "10 org users + application login links",
      "Priority support",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "Groups & regulated teams",
    monthly_ngn: null,
    cta: "Talk to us",
    features: [
      "Everything in Scale",
      "Multi-company groups — one service key per company",
      "AI consensus narratives (multi-model)",
      "Cross-org correlation mining (opt-in)",
      "Custom report retention & branding",
      "Staff-reviewed company verification",
      "Dedicated success engineer",
    ],
  },
];

export const pricingFootnote =
  "Prices in Nigerian Naira (₦), per company per month. First month 50% off on paid tiers. " +
  "List prices are placeholders — final pricing publishes soon.";
