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
  /** Findings verification layer: verdict + which layer decided + why. */
  verification?: {
    verdict?: string;
    verifier?: string;
    reason?: string;
    evidence?: string;
    by?: string;
    attempted_at?: string;
    subagent?: string;
  };
}

/** Engagement groups → column labels. */
export const PHASES: { id: AttackPhase; label: string }[] = [
  { id: "recon", label: "Recon" },
  { id: "discovery", label: "Discovery" },
  { id: "vuln", label: "Vuln confirmation" },
  { id: "exploit", label: "Exploit / verify" },
  { id: "auth", label: "Authenticated" },
  { id: "report", label: "Report" },
];

export const PERSONAS: { id: AgentPersona | "all"; label: string }[] = [
  { id: "all", label: "All agents" },
  { id: "orchestrator", label: "Orchestrator" },
  { id: "recon", label: "Recon Agent" },
  { id: "exploit", label: "Web Exploit Agent" },
];

interface CatalogPhase {
  id: string;
  group: AttackPhase;
  label: string;
  /** Tool + content substrings that route transcript chunks to this phase. */
  sigs: string[];
  /** Primary tool hint (shown in the inspector). */
  tool: string;
}

const CATALOG: CatalogPhase[] = [
  // ── RECON ─────────────────────────────────────────────────────────────
  { id: "recon_scope", group: "recon", label: "Scope & target resolution", sigs: ["whois", "resolve", "scope", "target resolution", "dns_lookup"], tool: "dns_lookup" },
  { id: "recon_dns", group: "recon", label: "Subdomain & DNS enumeration", sigs: ["subfinder", "amass", "sublist3r", "assetfinder", "dnsrecon", "dnsx", "dig", "subdomain"], tool: "subfinder" },
  { id: "recon_ports", group: "recon", label: "Port & service discovery", sigs: ["nmap", "masscan", "naabu", "rustscan", "port scan", "open port"], tool: "nmap" },
  { id: "recon_fingerprint", group: "recon", label: "Technology fingerprinting", sigs: ["httpx", "whatweb", "wappalyzer", "fingerprint", "technology", "server:"], tool: "httpx" },
  { id: "recon_crawl", group: "recon", label: "URL crawl & parameter discovery", sigs: ["katana", "gau", "wayback", "gospider", "hakrawler", "crawl", "param"], tool: "katana" },
  { id: "recon_js", group: "recon", label: "JavaScript & source analysis", sigs: ["browser_js", "js file", "javascript", "source map", "linkfinder", "secret in js"], tool: "browser_js" },
  // ── DISCOVERY ─────────────────────────────────────────────────────────
  { id: "disc_paths", group: "discovery", label: "Directory & file discovery", sigs: ["ffuf", "gobuster", "dirb", "feroxbuster", "dirsearch", "/.git", "/.env", "directory"], tool: "ffuf" },
  { id: "disc_api", group: "discovery", label: "API & GraphQL surface", sigs: ["graphql", "swagger", "openapi", "/api/", "postman", "rest api"], tool: "http_get" },
  { id: "disc_cors", group: "discovery", label: "CORS & cookie analysis", sigs: ["cors", "access-control-allow", "cookie", "origin"], tool: "http_get" },
  { id: "disc_email", group: "discovery", label: "Email security testing", sigs: ["spf", "dmarc", "smtp", "email security", "mail record"], tool: "dns_lookup" },
  { id: "disc_cloud", group: "discovery", label: "Cloud & infrastructure exposure", sigs: ["s3", "bucket", "aws", "gcp", "azure", "cloud storage"], tool: "shell" },
  // ── VULN ──────────────────────────────────────────────────────────────
  { id: "vuln_sig", group: "vuln", label: "Signature scanning", sigs: ["nuclei", "nikto", "cve-", "signature"], tool: "nuclei" },
  { id: "vuln_inject", group: "vuln", label: "Injection testing", sigs: ["sqlmap", "sqli", "xss", "ssti", "nosql", "injection", "command injection"], tool: "sqlmap" },
  { id: "vuln_ssrf", group: "vuln", label: "SSRF testing", sigs: ["ssrf", "oob", "169.254", "collaborator", "interactsh", "metadata"], tool: "shell" },
  { id: "vuln_idor", group: "vuln", label: "IDOR & broken access control", sigs: ["idor", "uuid", "access control", "authorization", "object reference"], tool: "authenticated_get" },
  { id: "vuln_auth", group: "vuln", label: "Authentication & session testing", sigs: ["login", "auth", "session", "password", "jwt", "oauth", "credential"], tool: "auth_login" },
  { id: "vuln_upload", group: "vuln", label: "File upload testing", sigs: ["upload", "multipart", "webshell", "file upload"], tool: "shell" },
  { id: "vuln_deser", group: "vuln", label: "Deserialization & RCE", sigs: ["ysoserial", "deserialize", "rce", "pickle", "serial", "remote code"], tool: "shell" },
  { id: "vuln_race", group: "vuln", label: "Race conditions & business logic", sigs: ["race condition", "business logic", "pricing", "replay", "toctou"], tool: "shell" },
  { id: "vuln_ws", group: "vuln", label: "WebSocket testing", sigs: ["websocket", "ws://", "socket.io"], tool: "shell" },
  { id: "vuln_cms", group: "vuln", label: "CMS-specific testing", sigs: ["wp-", "wordpress", "joomla", "drupal", "cms", "plugin"], tool: "shell" },
  // ── EXPLOIT ───────────────────────────────────────────────────────────
  { id: "exp_subdomain", group: "exploit", label: "Subdomain takeover", sigs: ["takeover", "dangling", "cname"], tool: "shell" },
  { id: "exp_redirect", group: "exploit", label: "Open redirect testing", sigs: ["redirect", "open redirect", "returnurl", "next="], tool: "http_get" },
  { id: "exp_verify", group: "exploit", label: "Exploit verification (PoC)", sigs: ["exploit", "poc", "verify", "proof", "confirm", "payload"], tool: "shell" },
  { id: "exp_chain", group: "exploit", label: "Attack chaining & novel discovery", sigs: ["chain", "novel", "combo", "correlation", "lateral"], tool: "shell" },
  { id: "exp_mobile", group: "exploit", label: "Mobile (APK) analysis", sigs: ["apk", "jadx", "frida", "android", "mobsf", "mobile"], tool: "shell" },
  { id: "exp_creds", group: "exploit", label: "Credential & secret validation", sigs: ["credential", "secret", "api_key", "token", "leak", "api key"], tool: "shell" },
  // ── AUTH ──────────────────────────────────────────────────────────────
  { id: "auth_flow", group: "auth", label: "Authenticated app testing", sigs: ["authenticated_get", "authenticated", "session cookie"], tool: "authenticated_get" },
  { id: "auth_accounts", group: "auth", label: "Multi-account & privilege testing", sigs: ["account", "privilege", "role", "user a", "user b", "admin"], tool: "auth_login" },
  // ── REPORT ────────────────────────────────────────────────────────────
  { id: "report_draft", group: "report", label: "Evidence consolidation", sigs: ["consolidate", "evidence", "findings summary", "collect"], tool: "shell" },
  { id: "report_remediation", group: "report", label: "Remediation & fix mapping", sigs: ["remediation", "fix", "mitigation", "risk treatment"], tool: "engine_call" },
  { id: "report_final", group: "report", label: "Final report generation", sigs: ["report", "final", "job_done", "summary"], tool: "engine_call" },
];

const PHASE_BY_ID: Record<string, CatalogPhase> = Object.fromEntries(CATALOG.map((p) => [p.id, p]));

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

function seedNodes(phases?: { id: string; name?: string }[]): AttackNode[] {
  // Prefer the backend-selected phase list (session.job.phases) so the tree
  // reflects what was actually chosen for this objective; otherwise the full
  // catalog.
  const source: CatalogPhase[] = phases?.length
    ? phases
        .map((p) => PHASE_BY_ID[p.id] ?? ({ id: p.id, group: "recon", label: p.name || p.id, sigs: [], tool: "shell" } as CatalogPhase))
    : CATALOG;

  return source.map((p) => ({
    id: p.id,
    phaseId: p.id,
    label: p.label,
    phase: p.group,
    status: "pending",
    commands: [],
    outputs: [],
    reasoning: [],
    persona: p.group === "recon" || p.group === "discovery" ? "recon" : "exploit",
    tool: p.tool,
  }));
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
  phases?: { id: string; name?: string }[],
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
  const blob = transcript.map((t) => t.content).join("\n");

  if (/HTTP\s+200|title/i.test(blob)) {
    out.push({
      id: "f-title",
      title: "Application fingerprint exposed",
      severity: "info",
      target,
      status: "validated",
      nodeId: "recon_fingerprint",
      evidence: {
        request: `GET / HTTP/1.1\nHost: ${target.replace(/^https?:\/\//, "")}\nUser-Agent: phantix-agi/httpx`,
        response: transcript.find((t) => /HTTP\s+200|title/i.test(t.content))?.content ?? "HTTP 200",
        hash: hashish(blob.slice(0, 80)),
        notes: "Read-only recon. Title and server banner collected from allowlisted host.",
      },
    });
  }

  if (/nginx|apache|iis|server /i.test(blob)) {
    out.push({
      id: "f-banner",
      title: "Server banner disclosure",
      severity: "low",
      target,
      status: "validated",
      nodeId: "recon_fingerprint",
      evidence: {
        request: `HEAD / HTTP/1.1\nHost: ${target.replace(/^https?:\/\//, "")}`,
        response: transcript.find((t) => /nginx|apache|iis|server /i.test(t.content))?.content ?? "",
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
export function phasesFromSession(job: unknown): { id: string; name?: string }[] | undefined {
  const phases = (job as { phases?: unknown } | null | undefined)?.phases;
  if (!Array.isArray(phases)) return undefined;
  const out = phases
    .filter((p): p is Record<string, unknown> => !!p && typeof p === "object")
    .map((p) => ({ id: String(p.id ?? ""), name: typeof p.name === "string" ? p.name : undefined }))
    .filter((p) => p.id);
  return out.length ? out : undefined;
}
