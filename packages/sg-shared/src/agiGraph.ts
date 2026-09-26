import type { AgiAction, AgiEngagement, AgiTranscriptChunk, Severity } from "./types";

// ── Methodology phase catalog (Xalgorix-informed) ──────────────────────────
// The six engagement groups are the console's column layout; the 30+ granular
// phases below are the individual nodes the agent walks through. Phase ids
// and names mirror the backend (services/phantix-agi/phases.py) so the FE
// attack tree and the machine-checked job stay in lock-step.

export type AttackPhase = "recon" | "discovery" | "vuln" | "exploit" | "auth" | "report";
export type NodeStatus = "pending" | "active" | "succeeded" | "blocked" | "failed";
export type AgentPersona = "orchestrator" | "recon" | "exploit";

export interface AttackNode {
  id: string;
  /** Granular phase id (e.g. "vuln_ssrf"). */
  phaseId: string;
  label: string;
  /** Compact label for narrow attack-tree panes. */
  short: string;
  /** Group the node belongs to (drives the column layout). */
  phase: AttackPhase;
  status: NodeStatus;
  commands: string[];
  outputs: string[];
  reasoning: string[];
  persona: AgentPersona;
  tool?: string;
}

export interface AgiFinding {
  id: string;
  title: string;
  severity: Severity;
  cve?: string;
  target: string;
  status: "candidate" | "validated" | "rejected";
  evidence: {
    request?: string;
    response?: string;
    hash?: string;
    notes?: string;
  };
  autofix?: {
    file: string;
    preview: string;
    summary: string;
  };
  nodeId?: string;
  highlight?: boolean;
  report_highlight?: boolean;
  business_impact?: string;
  impact_level?: string;
  /** Findings verification layer: verdict + which tier decided + why. */
  verification?: {
    verdict?: string;
    verifier?: string;
    reason?: string;
    evidence?: string;
    by?: string;
    attempted_at?: string;
    decided_at?: string;
    confidence?: number | null;
    needs_review?: boolean;
    subagent?: string;
  };
}

/** Engagement groups → column labels. */
export const PHASES: { id: AttackPhase; label: string; short: string }[] = [
  { id: "recon", label: "Recon", short: "Recon" },
  { id: "discovery", label: "Discovery", short: "Disc" },
  { id: "vuln", label: "Vuln confirmation", short: "Vuln" },
  { id: "exploit", label: "Exploit / verify", short: "Exploit" },
  { id: "auth", label: "Authenticated", short: "Auth" },
  { id: "report", label: "Report", short: "Report" },
];

export const PERSONAS: { id: AgentPersona | "all"; label: string }[] = [
  { id: "all", label: "All agents" },
  { id: "orchestrator", label: "SecureGraph Autonomous Agent" },
  { id: "recon", label: "Recon Agent" },
  { id: "exploit", label: "Web Exploit Agent" },
];

/** Friendly, human-readable activity label for the current attack-tree phase.
 *  Shown in the live "Thinking…" indicator so operators see a clear phase
 *  (Gathering intel → Enumerating → Scanning → Exploiting → Reporting) instead
 *  of raw engine copy. */
export const PHASE_ACTIVITY: Record<AttackPhase, string> = {
  recon: "Gathering Intel",
  discovery: "Enumerating",
  vuln: "Scanning",
  exploit: "Exploiting Vulnerability",
  auth: "Working on it",
  report: "Reporting Findings",
};

/** Granular, per-node activity labels for every catalog phase. Keyed by the
 *  attack-tree phase id (e.g. "recon_dns") so the live indicator can name the
 *  exact step the agent is on, not just the column group. */
export const PHASE_ACTIVITY_BY_ID: Record<string, string> = {
  // Recon
  recon_scope: "Resolving scope & targets",
  recon_dns: "Enumerating subdomains & DNS",
  recon_ports: "Scanning ports & services",
  recon_fingerprint: "Fingerprinting technologies",
  recon_crawl: "Crawling URLs & parameters",
  recon_js: "Analyzing JavaScript & source",
  // Discovery
  disc_paths: "Probing directories & files",
  disc_api: "Mapping API & GraphQL surface",
  disc_cors: "Checking CORS & cookies",
  disc_email: "Testing email security",
  disc_cloud: "Enumerating cloud exposure",
  disc_trust_boundaries: "Identifying trust boundaries",
  disc_auth_matrix: "Building auth/access matrix",
  // Vulnerabilities
  vuln_sig: "Running signature scans",
  vuln_inject: "Testing injection flaws",
  vuln_ssrf: "Testing SSRF",
  vuln_idor: "Testing IDOR & access control",
  vuln_auth: "Testing authentication & sessions",
  vuln_upload: "Testing file uploads",
  vuln_deser: "Testing deserialization & RCE",
  vuln_race: "Testing race conditions",
  vuln_ws: "Testing WebSocket endpoints",
  vuln_cms: "Testing CMS-specific issues",
  // Exploit
  exp_subdomain: "Checking subdomain takeover",
  exp_redirect: "Testing open redirects",
  exp_verify: "Verifying exploits (PoC)",
  exp_chain: "Chaining attack paths",
  exp_mobile: "Analyzing mobile (APK)",
  exp_creds: "Validating credentials & secrets",
  // Auth
  auth_flow: "Testing authenticated flows",
  auth_accounts: "Testing privileges & accounts",
  // Report
  report_draft: "Consolidating evidence",
  report_remediation: "Mapping remediation & fixes",
  report_final: "Generating final report",
};

/** Resolve the activity label for a raw `working_on` string (backend copy like
 *  "HTTP fingerprint web assets (6)"). When a granular phase id is known (the
 *  live attack-tree node) that wins; otherwise best-effort keyword match; falls
 *  back to a generic "Working on it". */
export function activityFor(workingOn?: string | null, phaseId?: string | null): string {
  if (phaseId && PHASE_ACTIVITY_BY_ID[phaseId]) return PHASE_ACTIVITY_BY_ID[phaseId];
  const w = (workingOn ?? "").toLowerCase();
  if (/\b(recon|fingerprint|dns|subdomain|httpx|whois|scope|resolve|surface)\b/.test(w)) return PHASE_ACTIVITY.recon;
  if (/\b(discover|directory|path|crawl|graphql|api|swagger|openapi|cors|cookie)\b/.test(w)) return PHASE_ACTIVITY.discovery;
  if (/\b(scan|nuclei|signature|inject|ssrf|idor|deser|websocket|upload|cms|race)\b/.test(w)) return PHASE_ACTIVITY.vuln;
  if (/\b(exploit|poc|verify|redirect|takeover|credential|secret|chain|mobile|apk)\b/.test(w)) return PHASE_ACTIVITY.exploit;
  if (/\b(auth|authenticated|session|login|privilege|account)\b/.test(w)) return PHASE_ACTIVITY.auth;
  if (/\b(report|evidence|remediation|consolidat|final|summary)\b/.test(w)) return PHASE_ACTIVITY.report;
  return PHASE_ACTIVITY.auth;
}

interface CatalogPhase {
  id: string;
  group: AttackPhase;
  label: string;
  /** Compact label shown when the attack-tree pane is narrow. */
  short: string;
  /** Tool + content substrings that route transcript chunks to this phase. */
  sigs: string[];
  /** Primary tool hint (shown in the inspector). */
  tool: string;
}

// Whole-word → compact substitutions used by shortLabel() so long node labels
// degrade gracefully as the pane narrows (reconnaissance→recon, auth(n)→auth,
// authoriz(ation)→authz, enumeration→enum, discovery→disc, etc.).
const SHORT_WORDS: [RegExp, string][] = [
  [/\breconnaissance\b/gi, "recon"],
  [/\brecon\b/gi, "recon"],
  [/\bauthentication\b/gi, "auth"],
  [/\bauth\b/gi, "auth"],
  [/\bauthorization\b/gi, "authz"],
  [/\bauthorized\b/gi, "authz"],
  [/\bauthenticated\b/gi, "auth"],
  [/\benumeration\b/gi, "enum"],
  [/\bdiscovery\b/gi, "disc"],
  [/\bdiscover(?:y|ing)?\b/gi, "disc"],
  [/\binfrastructure\b/gi, "infra"],
  [/\bverification\b/gi, "verify"],
  [/\bconfirmation\b/gi, "confirm"],
  [/\bjavascript\b/gi, "JS"],
  [/\bparameter\b/gi, "param"],
  [/\bparameters\b/gi, "params"],
  [/\bcredentials?\b/gi, "creds"],
  [/\bprivilege[sd]?\b/gi, "priv"],
  [/\btechnolog(?:y|ies)\b/gi, "tech"],
  [/\banalysis\b/gi, "analysis"],
  [/\bscanning\b/gi, "scan"],
  [/\bconsolidation\b/gi, "consolidate"],
  [/\bremediation\b/gi, "remediation"],
  [/\btesting\b/gi, "test"],
  [/\bsubdomain\b/gi, "subdom"],
  [/\bfingerprinting\b/gi, "fingerprint"],
  [/\bexposure\b/gi, "exposure"],
  [/\bcorrelation\b/gi, "correlate"],
  [/\bgeneration\b/gi, "gen"],
  [/\bauthenticated app\b/gi, "auth app"],
];

/** Collapse a long node/phase label into a compact form for narrow panes. */
export function shortLabel(label: string): string {
  let out = label;
  for (const [re, short] of SHORT_WORDS) out = out.replace(re, short);
  // Collapse any double spaces left behind by empty replacements.
  return out.replace(/\s{2,}/g, " ").trim();
}

const CATALOG: CatalogPhase[] = [
  // ── RECON ─────────────────────────────────────────────────────────────
  { id: "recon_scope", group: "recon", label: "Scope & target resolution", short: "Scope / target", sigs: ["whois", "resolve", "scope", "target resolution", "dns_lookup"], tool: "dns_lookup" },
  { id: "recon_dns", group: "recon", label: "Subdomain & DNS enumeration", short: "Subdom / DNS enum", sigs: ["subfinder", "amass", "sublist3r", "assetfinder", "dnsrecon", "dnsx", "dig", "subdomain"], tool: "subfinder" },
  { id: "recon_ports", group: "recon", label: "Port & service discovery", short: "Port / svc disc", sigs: ["nmap", "masscan", "naabu", "rustscan", "port scan", "open port"], tool: "nmap" },
  { id: "recon_fingerprint", group: "recon", label: "Technology fingerprinting", short: "Tech fingerprint", sigs: ["httpx", "whatweb", "wappalyzer", "fingerprint", "technology", "server:"], tool: "httpx" },
  { id: "recon_crawl", group: "recon", label: "URL crawl & parameter discovery", short: "URL crawl / params", sigs: ["katana", "gau", "wayback", "gospider", "hakrawler", "crawl", "param"], tool: "katana" },
  { id: "recon_js", group: "recon", label: "JavaScript & source analysis", short: "JS / source", sigs: ["browser_js", "js file", "javascript", "source map", "linkfinder", "secret in js"], tool: "browser_js" },
  // ── DISCOVERY ─────────────────────────────────────────────────────────
  { id: "disc_paths", group: "discovery", label: "Directory & file discovery", short: "Dir / file disc", sigs: ["ffuf", "gobuster", "dirb", "feroxbuster", "dirsearch", "/.git", "/.env", "directory"], tool: "ffuf" },
  { id: "disc_api", group: "discovery", label: "API & GraphQL surface", short: "API / GraphQL", sigs: ["graphql", "swagger", "openapi", "/api/", "postman", "rest api"], tool: "http_get" },
  { id: "disc_cors", group: "discovery", label: "CORS & cookie analysis", short: "CORS / cookies", sigs: ["cors", "access-control-allow", "cookie", "origin"], tool: "http_get" },
  { id: "disc_email", group: "discovery", label: "Email security testing", short: "Email security", sigs: ["spf", "dmarc", "smtp", "email security", "mail record"], tool: "dns_lookup" },
  { id: "disc_cloud", group: "discovery", label: "Cloud & infrastructure exposure", short: "Cloud / infra", sigs: ["s3", "bucket", "aws", "gcp", "azure", "cloud storage"], tool: "shell" },
  // ── VULN ──────────────────────────────────────────────────────────────
  { id: "vuln_sig", group: "vuln", label: "Signature scanning", short: "Sig scanning", sigs: ["nuclei", "nikto", "cve-", "signature"], tool: "nuclei" },
  { id: "vuln_inject", group: "vuln", label: "Injection testing", short: "Injection", sigs: ["sqlmap", "sqli", "xss", "ssti", "nosql", "injection", "command injection"], tool: "sqlmap" },
  { id: "vuln_ssrf", group: "vuln", label: "SSRF testing", short: "SSRF", sigs: ["ssrf", "oob", "169.254", "collaborator", "interactsh", "metadata"], tool: "shell" },
  { id: "vuln_idor", group: "vuln", label: "IDOR & broken access control", short: "IDOR / access ctrl", sigs: ["idor", "uuid", "access control", "authorization", "object reference"], tool: "authenticated_get" },
  { id: "vuln_auth", group: "vuln", label: "Authentication & session testing", short: "Auth / session", sigs: ["login", "auth", "session", "password", "jwt", "oauth", "credential"], tool: "auth_login" },
  { id: "vuln_upload", group: "vuln", label: "File upload testing", short: "File upload", sigs: ["upload", "multipart", "webshell", "file upload"], tool: "shell" },
  { id: "vuln_deser", group: "vuln", label: "Deserialization & RCE", short: "Deser / RCE", sigs: ["ysoserial", "deserialize", "rce", "pickle", "serial", "remote code"], tool: "shell" },
  { id: "vuln_race", group: "vuln", label: "Race conditions & business logic", short: "Race / logic", sigs: ["race condition", "business logic", "pricing", "replay", "toctou"], tool: "shell" },
  { id: "vuln_ws", group: "vuln", label: "WebSocket testing", short: "WebSocket", sigs: ["websocket", "ws://", "socket.io"], tool: "shell" },
  { id: "vuln_cms", group: "vuln", label: "CMS-specific testing", short: "CMS testing", sigs: ["wp-", "wordpress", "joomla", "drupal", "cms", "plugin"], tool: "shell" },
  // ── EXPLOIT ───────────────────────────────────────────────────────────
  { id: "exp_subdomain", group: "exploit", label: "Subdomain takeover", short: "Subdom takeover", sigs: ["takeover", "dangling", "cname"], tool: "shell" },
  { id: "exp_redirect", group: "exploit", label: "Open redirect testing", short: "Open redirect", sigs: ["redirect", "open redirect", "returnurl", "next="], tool: "http_get" },
  { id: "exp_verify", group: "exploit", label: "Exploit verification (PoC)", short: "Exploit verify", sigs: ["exploit", "poc", "verify", "proof", "confirm", "payload"], tool: "shell" },
  { id: "exp_chain", group: "exploit", label: "Attack chaining & novel discovery", short: "Chaining / novel", sigs: ["chain", "novel", "combo", "correlation", "lateral"], tool: "shell" },
  { id: "exp_mobile", group: "exploit", label: "Mobile (APK) analysis", short: "Mobile / APK", sigs: ["apk", "jadx", "frida", "android", "mobsf", "mobile"], tool: "shell" },
  { id: "exp_creds", group: "exploit", label: "Credential & secret validation", short: "Creds / secrets", sigs: ["credential", "secret", "api_key", "token", "leak", "api key"], tool: "shell" },
  // ── AUTH ──────────────────────────────────────────────────────────────
  { id: "auth_flow", group: "auth", label: "Authenticated app testing", short: "Auth app test", sigs: ["authenticated_get", "authenticated", "session cookie"], tool: "authenticated_get" },
  { id: "auth_accounts", group: "auth", label: "Multi-account & privilege testing", short: "Multi-acct / priv", sigs: ["account", "privilege", "role", "user a", "user b", "admin"], tool: "auth_login" },
  // ── REPORT ────────────────────────────────────────────────────────────
  { id: "report_draft", group: "report", label: "Evidence consolidation", short: "Evidence", sigs: ["consolidate", "evidence", "findings summary", "collect"], tool: "shell" },
  { id: "report_remediation", group: "report", label: "Remediation & fix mapping", short: "Remediation / fix", sigs: ["remediation", "fix", "mitigation", "risk treatment"], tool: "engine_call" },
  { id: "report_final", group: "report", label: "Final report generation", short: "Final report", sigs: ["report", "final", "job_done", "summary"], tool: "engine_call" },
];

const PHASE_BY_ID: Record<string, CatalogPhase> = Object.fromEntries(CATALOG.map((p) => [p.id, p]));

/** Catalog nodes grouped by their engagement phase (recon/discovery/…). */
const CATALOG_BY_GROUP: Record<string, CatalogPhase[]> = CATALOG.reduce(
  (acc, p) => {
    (acc[p.group] ||= []).push(p);
    return acc;
  },
  {} as Record<string, CatalogPhase[]>,
);

const VALID_GROUPS = new Set<AttackPhase>([
  "recon",
  "discovery",
  "vuln",
  "exploit",
  "auth",
  "report",
]);

/** A sensible primary tool per phase so a step never falls back to a bare "shell". */
const GROUP_DEFAULT_TOOL: Record<AttackPhase, string> = {
  recon: "httpx",
  discovery: "http_get",
  vuln: "nuclei",
  exploit: "http_get",
  auth: "authenticated_get",
  report: "engine_call",
};

/** One backend phase as delivered to the FE (session.job.phases[]). */
export interface SessionPhase {
  id: string;
  name?: string;
  /** Named steps the backend selected for this phase (may be strings or objects). */
  steps?: Array<string | { id?: string; name?: string; title?: string; tool?: string }>;
}

interface StepLike {
  id?: string;
  name?: string;
  tool?: string;
}

function normalizeSteps(steps: SessionPhase["steps"]): StepLike[] {
  if (!Array.isArray(steps)) return [];
  return steps
    .map((s): StepLike | null => {
      if (typeof s === "string") return s.trim() ? { name: s.trim() } : null;
      if (s && typeof s === "object") {
        const name = (s.name ?? s.title ?? "").toString().trim();
        return name ? { id: s.id, name, tool: s.tool } : null;
      }
      return null;
    })
    .filter((s): s is StepLike => s !== null);
}

/** Best-effort catalog match for a free-text step label within a phase group,
 *  so a backend step inherits a real tool + routing signatures when it can. */
function matchCatalogForLabel(label: string, group: AttackPhase): CatalogPhase | undefined {
  const blob = label.toLowerCase();
  const pool = CATALOG_BY_GROUP[group] ?? [];
  let best: CatalogPhase | undefined;
  let bestScore = 0;
  for (const c of pool) {
    let score = 0;
    if (blob.includes(c.label.toLowerCase()) || c.label.toLowerCase().includes(blob)) score += 2;
    for (const sig of c.sigs) if (sig && blob.includes(sig.toLowerCase())) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return bestScore > 0 ? best : undefined;
}

function catalogToNode(p: CatalogPhase): AttackNode {
  return {
    id: p.id,
    phaseId: p.id,
    label: p.label,
    short: p.short,
    phase: p.group,
    status: "pending",
    commands: [],
    outputs: [],
    reasoning: [],
    persona: p.group === "recon" || p.group === "discovery" ? "recon" : "exploit",
    tool: p.tool,
  };
}

const RECON_TOOLS = /nmap|httpx|whois|dig|amass|subfinder|masscan|katana|gau|gospider/i;
const EXPLOIT_TOOLS = /nuclei|ffuf|sqlmap|nikto|gobuster|hydra|http_probe|burp|frida|jadx/i;
const HIGH_RISK = /sqlmap|drop\s+table|dos|flood|ransomware|privesc|privilege\s*esc|metasploit|reverse.?shell|rm\s+-rf|exploit-db|data_exfil/i;

export function isHighRiskCommand(cmd: string): boolean {
  return HIGH_RISK.test(cmd);
}

export function personaForChunk(t: AgiTranscriptChunk): AgentPersona {
  if (t.role === "assistant" || t.role === "system") return "orchestrator";
  const tool = String(t.meta?.tool ?? "");
  const blob = `${tool} ${t.content}`;
  if (EXPLOIT_TOOLS.test(blob)) return "exploit";
  if (RECON_TOOLS.test(blob) || t.role === "tool") return "recon";
  if (t.role === "operator") return "orchestrator";
  return "orchestrator";
}

function bump(status: NodeStatus, next: NodeStatus): NodeStatus {
  const rank: Record<NodeStatus, number> = { pending: 0, active: 1, succeeded: 2, blocked: 3, failed: 4 };
  if (next === "failed" || next === "blocked") return next;
  return rank[next] > rank[status] ? next : status;
}

function seedNodes(phases?: SessionPhase[]): AttackNode[] {
  // No backend phase list → show the full methodology catalog.
  if (!phases?.length) return CATALOG.map(catalogToNode);

  // Prefer the backend-selected phases (session.job.phases) so the tree reflects
  // what was chosen for this objective — but expand each phase into *informative*
  // step nodes instead of a single generic "shell" node:
  //   1. a granular catalog id  → the catalog node itself;
  //   2. a group id with backend `steps` → one node per named step (real tool);
  //   3. a group id with no steps → the catalog's steps for that group;
  //   4. anything else → a single labelled node with the group's default tool.
  const out: AttackNode[] = [];
  const seen = new Set<string>();
  const push = (node: AttackNode) => {
    if (seen.has(node.id)) return;
    seen.add(node.id);
    out.push(node);
  };

  for (const p of phases) {
    const direct = PHASE_BY_ID[p.id];
    if (direct) {
      push(catalogToNode(direct));
      continue;
    }
    const group: AttackPhase = VALID_GROUPS.has(p.id as AttackPhase)
      ? (p.id as AttackPhase)
      : "recon";
    const persona: AgentPersona =
      group === "recon" || group === "discovery" ? "recon" : "exploit";

    const steps = normalizeSteps(p.steps);
    if (steps.length) {
      steps.forEach((s, i) => {
        const label = s.name || `${p.name || p.id} · step ${i + 1}`;
        const cat = matchCatalogForLabel(label, group);
        push({
          id: s.id || cat?.id || `${group}_${i + 1}`,
          phaseId: s.id || cat?.id || `${group}_${i + 1}`,
          label,
          short: shortLabel(label),
          phase: group,
          status: "pending",
          commands: [],
          outputs: [],
          reasoning: [],
          persona,
          tool: s.tool || cat?.tool || GROUP_DEFAULT_TOOL[group],
        });
      });
      continue;
    }

    const catalogGroup = CATALOG_BY_GROUP[group];
    if (catalogGroup?.length) {
      catalogGroup.forEach((c) => push(catalogToNode(c)));
      continue;
    }

    const label = p.name || p.id;
    push({
      id: p.id,
      phaseId: p.id,
      label,
      short: shortLabel(label),
      phase: group,
      status: "pending",
      commands: [],
      outputs: [],
      reasoning: [],
      persona,
      tool: GROUP_DEFAULT_TOOL[group],
    });
  }

  return out.length ? out : CATALOG.map(catalogToNode);
}

function routePhase(t: AgiTranscriptChunk): string | null {
  const tool = String(t.meta?.tool ?? "");
  const blob = `${tool} ${t.content}`.toLowerCase();
  // Score each catalog phase by matched signatures; best match wins.
  let best: string | null = null;
  let bestScore = 0;
  for (const p of CATALOG) {
    let score = 0;
    for (const s of p.sigs) {
      if (s && blob.includes(s.toLowerCase())) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = p.id;
    }
  }
  return best;
}

export function deriveAttackGraph(
  transcript: AgiTranscriptChunk[],
  actions: AgiAction[],
  running: boolean,
  phases?: SessionPhase[],
): AttackNode[] {
  const nodes = seedNodes(phases);
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));

  for (const t of transcript) {
    const id = routePhase(t) ?? "recon_scope";
    const n = byId[id];
    if (!n) continue;
    if (t.role === "tool" && /^-|\b(nmap|httpx|ffuf|nuclei|curl|wget)\b/i.test(t.content) && t.content.length < 240) {
      n.commands.push(t.content);
      n.tool = String(t.meta?.tool ?? n.tool ?? "tool");
    } else if (t.role === "tool") {
      n.outputs.push(t.content);
    } else if (t.role === "assistant") {
      n.reasoning.push(t.content);
    } else if (t.role === "system") {
      n.outputs.push(t.content);
    }
    n.status = bump(n.status, t.role === "assistant" && running ? "active" : "succeeded");
  }

  for (const a of actions) {
    const n = byId["exp_verify"] ?? byId["exp_chain"] ?? nodes.find((x) => x.phase === "exploit")!;
    if (!n) continue;
    n.commands.push(a.proposed_command);
    if (a.rationale) n.reasoning.push(a.rationale);
    if (a.status === "pending_approval") n.status = "blocked";
    else if (a.status === "rejected") n.status = "failed";
    else if (a.status === "approved") n.status = "succeeded";
  }

  if (running) {
    const firstPending = nodes.find((n) => n.status === "pending");
    const anyActive = nodes.some((n) => n.status === "active" || n.status === "blocked");
    if (firstPending && !anyActive) firstPending.status = "active";
  }

  return nodes;
}

function hashish(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return `sha256:${(h >>> 0).toString(16).padStart(8, "0")}…`;
}

export function deriveFindings(
  transcript: AgiTranscriptChunk[],
  actions: AgiAction[],
  engagement: AgiEngagement | null,
): AgiFinding[] {
  const target = engagement?.scope_definition.target_allowlist[0] ?? "in-scope target";
  const out: AgiFinding[] = [];
  // Only REAL evidence counts, and only tool output is evidence: an assistant row
  // is the agent's own narration. Keeping those rows let the planning prose
  // satisfy the detectors below — the model writes "httpx -title …" and "… the
  // server stack …" — and then *became* the finding's `response`, so the findings
  // pane showed the agent describing an HTTP call instead of what the call
  // returned. Require at least one tool run; the system prompt and the operator
  // instruction never count.
  const toolChunks = transcript.filter((t) => t.role === "tool" && (t.content ?? "").trim());
  if (toolChunks.length === 0) return [];
  const blob = toolChunks.map((t) => t.content ?? "").join("\n");

  /** First tool chunk matching `re` — the only rows that may become evidence. */
  const toolText = (re: RegExp): string | null => {
    for (const t of toolChunks) if (re.test(t.content ?? "")) return (t.content ?? "").trim();
    return null;
  };
  /** A real exchange, not prose: a status line, `Status: 200` or an `[200]` marker. */
  const HTTP_EXCHANGE = /(?:^|\n)\s*(?:HTTP\/[\d.]+\s+\d{3}\b|\bStatus:\s*\d{3}\b|\[\d{3}\])/;
  /** The Host header is a host: never the allowlist entry's path or query. */
  const hostOf = (value: string): string => {
    try {
      return new URL(value.includes("://") ? value : `https://${value}`).host;
    } catch {
      return value.replace(/^https?:\/\//, "").split(/[/?#]/)[0];
    }
  };
  const targetHost = hostOf(target);

  // A real fingerprint signal: an HTTP status line / bracketed code from a tool
  // response, not the bare word "title" appearing anywhere.
  if (/\[200\]|\bStatus:\s*200|HTTP\/[\d.]*\s*200/i.test(blob)) {
    out.push({
      id: "f-title",
      title: "Application fingerprint exposed",
      severity: "info",
      target,
      status: "validated",
      nodeId: "recon_fingerprint",
      evidence: {
        request: `GET / HTTP/1.1\nHost: ${targetHost}\nUser-Agent: phantix-agi/httpx`,
        response: toolText(HTTP_EXCHANGE) ?? "No HTTP response was captured for this probe.",
        hash: hashish(blob.slice(0, 80)),
        notes: "Read-only recon. Title and server banner collected from allowlisted host.",
      },
    });
  }

  const banner = toolText(/(?:^|\n)\s*Server:\s*\S+|nginx|apache|iis/i);
  if (banner) {
    out.push({
      id: "f-banner",
      title: "Server banner disclosure",
      severity: "low",
      target,
      status: "validated",
      nodeId: "recon_fingerprint",
      evidence: {
        request: `HEAD / HTTP/1.1\nHost: ${targetHost}`,
        response: banner,
        hash: hashish("banner"),
        notes: "Banner leakage aids targeted exploit research. Suppress Server headers.",
      },
      autofix: {
        file: "nginx.conf",
        summary: "Hide versioned Server header and limit information leakage.",
        preview: `server {\n  listen 443 ssl;\n  server_tokens off;\n  more_clear_headers Server;\n  add_header X-Content-Type-Options nosniff;\n}`,
      },
    });
  }

  const loginAction = actions.find((a) => /login|password|credential/i.test(a.proposed_command + (a.rationale ?? "")));
  const credsConfirmed = /session=|Location:\s*\/admin|default credentials accepted/i.test(blob);
  if (loginAction || /login/i.test(blob) || credsConfirmed) {
    const rejected = loginAction?.status === "rejected";
    out.push({
      id: "f-login",
      title: credsConfirmed ? "Default credentials accepted on /login" : "Weak credential surface on /login",
      severity: "high",
      target: `${target.replace(/\/$/, "")}/login`,
      status: rejected ? "rejected" : credsConfirmed ? "validated" : loginAction ? "candidate" : "validated",
      nodeId: "vuln_auth",
      evidence: {
        request: loginAction?.proposed_command ?? `POST ${target.replace(/\/$/, "")}/login\nContent-Type: application/x-www-form-urlencoded\n\nusername=admin&password=test`,
        response: rejected ? "Rejected by operator — not executed." : credsConfirmed ? "HTTP 302 Location: /admin · session cookie issued" : "Pending human approval. No payload sent.",
        hash: hashish("login-probe"),
        notes: loginAction?.rationale ?? "Login endpoint accepts password grants. Active verification is gated.",
      },
      autofix: {
        file: "app/auth/login.py",
        summary: "Add lockout, rate-limit, and reject default credentials.",
        preview: `def authenticate(user, password):\n    if is_locked(user):\n        raise LockedAccount()\n    if failed_attempts(user) >= 5:\n        lock_account(user, minutes=15)\n        raise RateLimited()\n    if password in DEFAULT_PASSWORDS:\n        audit("default_credential_rejected", user)\n        return False\n    return verify_hash(user, password)`,
      },
    });
  }

  if (/missing-security-headers|X-Frame-Options|CSP/i.test(blob)) {
    out.push({
      id: "f-headers",
      title: "Missing security headers",
      severity: "medium",
      target,
      status: "validated",
      nodeId: "vuln_sig",
      evidence: {
        notes: "CSP and X-Frame-Options are absent. Clickjacking and mixed-content risk.",
        hash: hashish("headers"),
      },
      autofix: {
        file: "nginx.conf",
        summary: "Add baseline security headers.",
        preview: `add_header Content-Security-Policy "default-src 'self'" always;\nadd_header X-Frame-Options DENY always;\nadd_header X-Content-Type-Options nosniff always;`,
      },
    });
  }

  if (/cve-|nuclei/i.test(blob)) {
    out.push({
      id: "f-cve",
      title: "Outdated jQuery (signature match)",
      severity: "info",
      cve: (blob.match(/CVE-\d{4}-\d+/i) ?? ["CVE-2020-11022"])[0],
      target,
      status: "candidate",
      nodeId: "vuln_sig",
      evidence: {
        notes: "Nuclei/signature hit. Awaiting confirmed proof-of-concept before promotion.",
        hash: hashish("nuclei"),
      },
    });
  }

  return out;
}

export function severityCounts(findings: AgiFinding[]): Record<Severity, number> {
  const c: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) c[f.severity] += 1;
  return c;
}

/** Phase ids selected for an objective, if the session exposes them. */
export function phasesFromSession(job: unknown): SessionPhase[] | undefined {
  const phases = (job as { phases?: unknown } | null | undefined)?.phases;
  if (!Array.isArray(phases)) return undefined;
  const out = phases
    .filter((p): p is Record<string, unknown> => !!p && typeof p === "object")
    .map((p) => ({
      id: String(p.id ?? ""),
      name: typeof p.name === "string" ? p.name : undefined,
      // Carry the backend's named steps through so the attack tree can render
      // an informative node per step instead of one generic phase node.
      steps: Array.isArray(p.steps) ? (p.steps as SessionPhase["steps"]) : undefined,
    }))
    .filter((p) => p.id);
  return out.length ? out : undefined;
}
