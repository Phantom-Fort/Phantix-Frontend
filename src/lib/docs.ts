// ── Documentation catalog (public) ────────────────────────────────────────────
// Renders the client-facing help centre + public guides shipped in this repo
// under docs/ (marketing) and docs/user-docs/ (help centre). Engineering
// internals are intentionally not exposed here.

// Top-level public / marketing docs
import whatIsPhantix from "@docs/docs/01-what-is-phantix.md?raw";
import businessLeaders from "@docs/docs/02-for-business-leaders.md?raw";
import securityIt from "@docs/docs/03-for-security-and-it.md?raw";
import investorsPartners from "@docs/docs/04-for-investors-and-partners.md?raw";
import capabilities from "@docs/docs/05-product-capabilities.md?raw";
import privacyTrust from "@docs/docs/06-privacy-and-trust.md?raw";
import pricingPlans from "@docs/docs/07-pricing-and-plans.md?raw";
import howItWorks from "@docs/docs/08-how-it-works.md?raw";
import aiAccountability from "@docs/docs/09-ai-with-accountability.md?raw";
import forDevelopers from "@docs/docs/10-for-developers.md?raw";
import faq from "@docs/docs/11-faq.md?raw";
import gettingStarted from "@docs/docs/12-getting-started.md?raw";

// Help centre / setup docs
import hcGettingStarted from "@docs/docs/user-docs/01-getting-started.md?raw";
import hcSecurityDb from "@docs/docs/user-docs/02-security-database.md?raw";
import hcEmail from "@docs/docs/user-docs/03-email-and-smtp.md?raw";
import hcAlerts from "@docs/docs/user-docs/04-alert-channels.md?raw";
import hcGithub from "@docs/docs/user-docs/05-github-connection.md?raw";
import hcBilling from "@docs/docs/user-docs/06-plans-and-billing.md?raw";
import hcDaily from "@docs/docs/user-docs/07-daily-activities.md?raw";
import hcFeatures from "@docs/docs/user-docs/08-features-overview.md?raw";
import hcUsers from "@docs/docs/user-docs/09-users-and-approvals.md?raw";
import hcAiAgent from "@docs/docs/user-docs/10-ai-agent-api.md?raw";
import hcPrivacy from "@docs/docs/user-docs/11-privacy-and-security.md?raw";
import hcTroubleshoot from "@docs/docs/user-docs/12-troubleshooting.md?raw";

// In-app user manuals + task how-tos (Command Centre help centre)
import { manualDocs } from "@/lib/manualDocs";
import { howToDocs } from "@/lib/howToDocs";

export interface DocEntry {
  id: string;
  title: string;
  description: string;
  category: string;
  content: string;
  badge?: string;
}

export const docCategories = [
  { id: "help", label: "Help Centre", blurb: "Setup, day-to-day use and integrations" },
  { id: "how-to-platform", label: "How-to · Platform", blurb: "Step-by-step org admin tasks with process flows" },
  { id: "how-to-app", label: "How-to · Command Centre", blurb: "Operator activities: scans, SOC, reports, tracker" },
  { id: "how-to", label: "How-to index", blurb: "Platform and Command Centre at a glance" },
  { id: "guides", label: "Guides", blurb: "Public guides by audience and topic" },
  { id: "manuals", label: "User manuals", blurb: "Screenshotted guides for each product surface" },
] as const;

export const docs: DocEntry[] = [
  // Help Centre
  { id: "hc-getting-started", title: "Getting started", description: "Register your organization, complete setup, and take your first security actions.", category: "help", content: hcGettingStarted, badge: "Start here" },
  { id: "hc-security-database", title: "Connect a security database", description: "Set up PostgreSQL (Supabase, Neon, RDS, DigitalOcean, Railway) — Phantix-hosted coming soon.", category: "help", content: hcSecurityDb },
  { id: "hc-email-smtp", title: "Email & SMTP", description: "Configure SES, Brevo, Mailgun, SendGrid, Google, or Microsoft 365 for OTPs and alerts.", category: "help", content: hcEmail },
  { id: "hc-alert-channels", title: "Alert channels", description: "Set up WhatsApp (Meta) and Telegram Bot alerts for security events.", category: "help", content: hcAlerts },
  { id: "hc-github", title: "Connect GitHub", description: "Install the Phantix GitHub App and analyze public or private repositories.", category: "help", content: hcGithub },
  { id: "hc-plans-billing", title: "Plans & billing", description: "Understand Free, Premium, add-ons, and the public AI Agent API plan.", category: "help", content: hcBilling },
  { id: "hc-daily-activities", title: "Daily activities", description: "Recommended day/week/month workflows to keep your posture current.", category: "help", content: hcDaily },
  { id: "hc-features", title: "Features overview", description: "The public feature set — assets, scans, VAPT, risks, compliance, reporting.", category: "help", content: hcFeatures },
  { id: "hc-users-approvals", title: "Users & approvals", description: "Invite users, set up dual-control initiator/authorizer, and approve sensitive actions.", category: "help", content: hcUsers },
  { id: "hc-ai-agent", title: "AI Agent API", description: "Use the public Phantix Agent API for programmatic security investigations.", category: "help", content: hcAiAgent },
  { id: "hc-privacy", title: "Privacy & security", description: "How your security data stays under your keys with the hybrid database model.", category: "help", content: hcPrivacy },
  { id: "hc-troubleshooting", title: "Troubleshooting", description: "Common setup and connection issues and how to fix them.", category: "help", content: hcTroubleshoot },

  // Public guides
  { id: "what-is-phantix", title: "What is Phantix", description: "The one-liner, positioning, and value for organizations.", category: "guides", content: whatIsPhantix },
  { id: "for-business-leaders", title: "For business leaders", description: "Board-level outcomes: continuity, trust, and faster audits.", category: "guides", content: businessLeaders },
  { id: "for-security-it", title: "For security & IT", description: "What CISOs, IT managers, and security engineers get.", category: "guides", content: securityIt },
  { id: "for-investors-partners", title: "For investors & partners", description: "Investor, MSSP, and reseller perspective on the platform.", category: "guides", content: investorsPartners },
  { id: "product-capabilities", title: "Product capabilities", description: "Product depth across surfaces and modules.", category: "guides", content: capabilities },
  { id: "privacy-trust", title: "Privacy & trust", description: "The privacy model, NDPA, and dual-control safeguards.", category: "guides", content: privacyTrust },
  { id: "pricing-plans", title: "Pricing & plans", description: "Free, Premium, add-ons, and engagements — priced in NGN.", category: "guides", content: pricingPlans },
  { id: "how-it-works", title: "How it works", description: "The journey from signup to board-ready report.", category: "guides", content: howItWorks },
  { id: "ai-accountability", title: "AI with accountability", description: "AI that advises — it never invents security facts.", category: "guides", content: aiAccountability },
  { id: "for-developers", title: "For developers", description: "Public API overview and the AI Agent API plan.", category: "guides", content: forDevelopers },
  { id: "faq", title: "FAQ", description: "Answers for first contact and common questions.", category: "guides", content: faq },
  { id: "getting-started", title: "Getting started", description: "CTAs and the onboarding path for new organizations.", category: "guides", content: gettingStarted },
  ...(manualDocs as DocEntry[]),
  ...(howToDocs as DocEntry[]),
];

export function getDoc(id: string): DocEntry | undefined {
  return docs.find((d) => d.id === id);
}

export interface TocItem {
  depth: number;
  text: string;
  id: string;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]*>/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export function extractToc(markdown: string): TocItem[] {
  const items: TocItem[] = [];
  let inFence = false;
  for (const line of markdown.split("\n")) {
    if (line.trim().startsWith("```")) inFence = !inFence;
    if (inFence) continue;
    const m = /^(#{2,3})\s+(.+)$/.exec(line);
    if (m) {
      const text = m[2].replace(/\*\*/g, "").replace(/`/g, "").trim();
      items.push({ depth: m[1].length, text, id: slugify(text) });
    }
  }
  return items;
}
