// ── Documentation catalog ─────────────────────────────────────────────────────
// Renders the actual engineering guides shipped in this repository, in-app.

import readme from "@docs/frontend/README.md?raw";
import orgSetupFe from "@docs/frontend/01_ORG_SETUP_IMPLEMENTATION.md?raw";
import platformFe from "@docs/frontend/02_PLATFORM_IMPLEMENTATION.md?raw";
import applicationFe from "@docs/frontend/03_APPLICATION_IMPLEMENTATION.md?raw";
import staffFe from "@docs/frontend/04_STAFF_ADMIN_IMPLEMENTATION.md?raw";
import apiCatalog from "@docs/frontend/API_ENDPOINT_CATALOG.md?raw";
import twoPlatformAuth from "@docs/docs/TWO_PLATFORM_AUTH.md?raw";
import dualControlFe from "@docs/docs/DUAL_CONTROL_SETUP_FE.md?raw";
import checklistFe from "@docs/docs/PLATFORM_APP_FE_CHECKLIST.md?raw";
import rbacMfa from "@docs/docs/RBAC_MFA.md?raw";
import architecture from "@docs/docs/ARCHITECTURE.md?raw";
import engines from "@docs/docs/ENGINES.md?raw";
import orgSetup from "@docs/docs/ORG_SETUP.md?raw";
import connections from "@docs/docs/CONNECTIONS.md?raw";
import assetDiscovery from "@docs/docs/ASSET_DISCOVERY.md?raw";
import vapt from "@docs/docs/VAPT.md?raw";
import risk from "@docs/docs/RISK.md?raw";
import compliance from "@docs/docs/COMPLIANCE.md?raw";
import reporting from "@docs/docs/REPORTING.md?raw";
import alerts from "@docs/docs/ALERTS.md?raw";
import audit from "@docs/docs/AUDIT.md?raw";
import ai from "@docs/docs/AI.md?raw";
import staffPortal from "@docs/docs/STAFF_PORTAL.md?raw";
import serverOps from "@docs/docs/SERVER_OPS.md?raw";
import search from "@docs/docs/SEARCH.md?raw";
import localDev from "@docs/docs/LOCAL_DEV.md?raw";
import securityBacklog from "@docs/docs/SECURITY_AND_BACKLOG.md?raw";

export interface DocEntry {
  id: string;
  title: string;
  description: string;
  category: string;
  content: string;
  badge?: string;
}

export const docCategories = [
  { id: "start", label: "Getting started", blurb: "Orientation, conventions and environment setup" },
  { id: "auth", label: "Auth & access", blurb: "Four token realms, dual control, RBAC" },
  { id: "surfaces", label: "Surface guides", blurb: "Implementation contract per product surface" },
  { id: "modules", label: "Product modules", blurb: "Engine deep-dives behind every screen" },
  { id: "api", label: "API reference", blurb: "The full 326-route catalog" },
  { id: "ops", label: "Platform & ops", blurb: "Architecture, staff console, server ops" },
] as const;

export const docs: DocEntry[] = [
  // Getting started
  { id: "fe-readme", title: "Frontend README", description: "Document map, global conventions, headers, status-code handling for every Phantix frontend.", category: "start", content: readme, badge: "Start here" },
  { id: "local-dev", title: "Local development", description: "Run the backend locally and point the frontend at it.", category: "start", content: localDev },
  { id: "fe-checklist", title: "Platform vs Application checklist", description: "Token stores, sign-in journeys, route maps and the QA security checklist.", category: "start", content: checklistFe },

  // Auth & access
  { id: "two-platform-auth", title: "Two-platform auth", description: "Management vs application access, service keys, multi-company groups, IDOR and rate-limit rules.", category: "auth", content: twoPlatformAuth, badge: "Core model" },
  { id: "dual-control", title: "Dual-control setup (FE)", description: "End-to-end UX + API flow for initiator/authorizer operate sessions.", category: "auth", content: dualControlFe },
  { id: "rbac-mfa", title: "RBAC & MFA", description: "Roles, OTP flows and multi-factor rules across realms.", category: "auth", content: rbacMfa },

  // Surface guides
  { id: "surface-org-setup", title: "01 · Org setup", description: "Onboarding wizard: privacy, email OTP, domain/CAC/manual verification, complete.", category: "surfaces", content: orgSetupFe },
  { id: "surface-platform", title: "02 · Platform", description: "Customer management portal — identity, keys, people, connections and every product module.", category: "surfaces", content: platformFe, badge: "Main guide" },
  { id: "surface-application", title: "03 · Application", description: "Operator app on dual tokens: campaigns, findings, risks, reports.", category: "surfaces", content: applicationFe },
  { id: "surface-staff", title: "04 · Staff / Admin", description: "Internal console: clients, frameworks, tooling, AI, server ops.", category: "surfaces", content: staffFe },

  // Modules
  { id: "mod-assets", title: "Asset discovery", description: "Inventory, tags, history, domain_enum pipeline, GitHub/OpenAPI/APK imports.", category: "modules", content: assetDiscovery },
  { id: "mod-vapt", title: "VAPT engine", description: "Campaign lifecycle, web scanner pipeline, correlation, orchestrator, schedules.", category: "modules", content: vapt },
  { id: "mod-risk", title: "Risk engine", description: "Hybrid scoring, prioritization algorithm, treatments and expert export.", category: "modules", content: risk },
  { id: "mod-compliance", title: "Compliance engine", description: "Frameworks, merged questionnaire, assessments, evidence connectors.", category: "modules", content: compliance },
  { id: "mod-reporting", title: "Reporting engine", description: "Verified-only consolidation, CVSS, tracker, multi-format render.", category: "modules", content: reporting, badge: "FE-critical" },
  { id: "mod-alerts", title: "Alert engine", description: "Severity-routed email/WhatsApp/Telegram with the client SMTP split.", category: "modules", content: alerts },
  { id: "mod-audit", title: "Audit engine", description: "Immutable dual-control trail, pending queue, exports.", category: "modules", content: audit },
  { id: "mod-ai", title: "AI engine", description: "Governed narratives, providers, pentest gate, cost controls.", category: "modules", content: ai },
  { id: "mod-connections", title: "DB connections", description: "The hybrid privacy model, least privilege, bootstrap.", category: "modules", content: connections },
  { id: "mod-search", title: "Search", description: "Tenant-scoped Elasticsearch with graceful degradation.", category: "modules", content: search },

  // API
  { id: "api-catalog", title: "Endpoint catalog", description: "All 326 routes generated from the live FastAPI route table, grouped by surface.", category: "api", content: apiCatalog, badge: "326 routes" },

  // Platform & ops
  { id: "architecture", title: "Backend architecture", description: "Privacy-first hybrid model, modules, NFRs and the implementation map.", category: "ops", content: architecture },
  { id: "engines", title: "Engine registry", description: "The 11 engines, bus rules and cross-engine verification.", category: "ops", content: engines },
  { id: "org-setup-model", title: "Org setup model", description: "Verification modes and what 'setup complete' requires.", category: "ops", content: orgSetup },
  { id: "staff-portal", title: "Staff portal", description: "Internal admin surface capabilities.", category: "ops", content: staffPortal },
  { id: "server-ops", title: "Server ops", description: "Process management, resources, optimization.", category: "ops", content: serverOps },
  { id: "security-backlog", title: "Security & backlog", description: "Security posture notes and the product backlog.", category: "ops", content: securityBacklog },
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
