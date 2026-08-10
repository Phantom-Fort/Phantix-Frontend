// Free, local "where do I find X" navigation guide for the Phantix assistant.
// Answers module-discovery questions without any AI/plan call.

export interface NavGuideResult {
  /** Short answer text (already rendered). */
  text: string;
  /** Page to jump to, when a single best match exists. */
  route: string;
  /** Page label (for the jump button). */
  label: string;
  /** Extra related pages. */
  also?: { route: string; label: string }[];
}

interface ModuleEntry {
  route: string;
  label: string;
  /** Where it lives in the sidebar (for the human answer). */
  section: string;
  /** What it does. */
  desc: string;
  /** Keywords matched against the question (lowercased). */
  keywords: string[];
  /** Alternative phrases (full match wins). */
  phrases?: string[];
}

const MODULES: ModuleEntry[] = [
  { route: "/dashboard", label: "Dashboard", section: "Overview", desc: "overall posture, key stats and shortcuts", keywords: ["dashboard", "overview", "home", "posture overview", "landing page", "main page", "summary page"] },
  { route: "/assets", label: "Assets", section: "Attack Surface", desc: "your attack-surface inventory and asset list", keywords: ["assets", "asset", "inventory", "attack surface", "hosts", "endpoints", "domains", "ip", "subdomain", "github repo"] },
  { route: "/assets/intelligence", label: "Intelligence", section: "Attack Surface", desc: "per-asset intelligence, exposure and priority", keywords: ["intelligence", "asset intelligence", "exposure", "asset risk", "priority", "asset analysis"] },
  { route: "/soc", label: "SOC Monitor", section: "Attack Surface", desc: "live detections, triage and SOC cases", keywords: ["soc", "detections", "triage", "alerts", "incidents", "monitor", "security operations", "cases"] },
  { route: "/scans", label: "Scans", section: "Attack Surface", desc: "discovery and vulnerability scans", keywords: ["scans", "scan", "vulnerability scan", "nmap", "nuclei", "discovery", "crawl", "results"] },
  { route: "/vapt", label: "VAPT Campaigns", section: "Attack Surface", desc: "VAPT campaigns, findings and approvals", keywords: ["vapt", "pentest", "penetration", "campaign", "web app test", "testing", "exploit", "vulnerability assessment"] },
  { route: "/risks", label: "Risks", section: "Governance", desc: "the risk register and treatment tracking", keywords: ["risks", "risk", "risk register", "treatment", "threats", "critical risks", "score"] },
  { route: "/compliance", label: "Compliance", section: "Governance", desc: "compliance frameworks, controls and gaps", keywords: ["compliance", "iso", "grc", "framework", "controls", "audit readiness", "evidence", "policy", "nist", "soc 2"] },
  { route: "/reports", label: "Reports", section: "Governance", desc: "generated reports and findings", keywords: ["reports", "report", "executive summary", "pdf", "findings report", "download"] },
  { route: "/agent", label: "Phantix Agent", section: "Assistant", desc: "the chat agent and investigations", keywords: ["agent", "chat", "assistant", "ai", "investigate", "investigation", "specialist"] },
  { route: "/alerts", label: "Alerts", section: "System", desc: "alert configuration and notifications", keywords: ["alerts", "alert", "notifications", "email alerts", "slack", "telegram", "wa"] },
  { route: "/audit", label: "Audit Trail", section: "System", desc: "the audit trail of actions", keywords: ["audit", "audit trail", "activity log", "history", "actions"] },
  { route: "/people", label: "People", section: "System", desc: "team members and access", keywords: ["people", "users", "team", "members", "access", "roles", "staff"] },
  { route: "/support", label: "Support", section: "System", desc: "support tickets and help", keywords: ["support", "ticket", "help", "contact", "bug"] },
  { route: "/authorizations", label: "Approvals", section: "Authorizer", desc: "your authorizer approval inbox", keywords: ["approval", "approvals", "authorizer", "authorization", "inbox", "pending actions", "sign off"] },
  { route: "/docs", label: "Documentation", section: "System", desc: "in-app documentation and guides", keywords: ["docs", "documentation", "guide", "manual", "how to", "help center", "faq"] },
  { route: "/settings", label: "Platform settings", section: "Tenant admin", desc: "company settings, billing and AI governance (opens the Platform)", keywords: ["settings", "billing", "plan", "subscription", "upgrade", "ai settings", "payment", "profile"] },
];

// Prefer phrase matches (stronger than loose keyword), then keyword counts.
function matchModules(q: string): ModuleEntry[] {
  const scored = MODULES.map((m) => {
    let score = 0;
    for (const p of m.phrases ?? []) {
      if (q.includes(p)) score += 3;
    }
    for (const k of m.keywords) {
      if (q.includes(k)) score += 1;
    }
    return { m, score };
  }).filter((x) => x.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.map((x) => x.m);
}

function resultFor(modules: ModuleEntry[]): NavGuideResult | null {
  if (modules.length === 0) return null;
  const top = modules[0];
  const section = top.section === "Overview" || top.section === "System" ? `the ${top.section}` : `${top.section} section`;
  const text = `You'll find it under **${section} → ${top.label}** (${top.desc}).`;
  const also = modules.slice(1, 3).map((m) => ({ route: m.route, label: m.label }));
  return { text, route: top.route, label: top.label, also };
}

/** Try to answer a "where do I find X" style question locally. Null = not a navigation question. */
export function tryNavigationAnswer(raw: string): NavGuideResult | null {
  const q = ` ${raw.toLowerCase().trim()} `.replace(/\s+/g, " ");

  // Gate on clear navigation intent.
  const intent =
    /where (do|can|would|should).*(find|get|see|locate|go|open|access|view)/.test(q) ||
    /how (do|can|would).*(find|get|see|go to|open|access|view|navigate)/.test(q) ||
    /where (is|are|does)\b/.test(q) ||
    /find.*(module|page|section|screen|tab)/.test(q) ||
    /go to.*(page|module|section|screen)/.test(q) ||
    /which (page|section|module|tab|menu|screen)/.test(q) ||
    /what (page|section|module|tab|menu|screen)/.test(q) ||
    /take me (to|there)/.test(q) ||
    /navigate (to|me to)/.test(q) ||
    /where.*(module|page|section|screen)/.test(q);
  if (!intent) return null;

  const modules = matchModules(q);
  return resultFor(modules);
}

/** Free, local "what can I do here / how do I" overview (no AI call). */
export function helpOverview(): string {
  return (
    "Here's where everything lives:\n" +
    "· Dashboard (/dashboard) — posture & key stats\n" +
    "· Assets (/assets) + Intelligence (/assets/intelligence) — inventory & exposure\n" +
    "· SOC Monitor (/soc), Scans (/scans), VAPT Campaigns (/vapt) — monitoring & testing\n" +
    "· Risks (/risks), Compliance (/compliance), Reports (/reports) — governance\n" +
    "· Phantix Agent (/agent) — chat & investigations\n" +
    "· Alerts (/alerts), Audit (/audit), People (/people), Support (/support)\n" +
    "· Documentation (/docs) — in-app guides\n\n" +
    "Ask me things like \"where do I find my risk register?\" and I'll point you to the right page."
  );
}
