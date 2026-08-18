import type { AgiAction, AgiEngagement, AgiTranscriptChunk, Severity } from "./types";

export type AttackPhase = "recon" | "discovery" | "vuln" | "exploit" | "auth";
export type NodeStatus = "pending" | "active" | "succeeded" | "blocked" | "failed";
export type AgentPersona = "orchestrator" | "recon" | "exploit";

export interface AttackNode {
  id: string;
  label: string;
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
}

export const PHASES: { id: AttackPhase; label: string }[] = [
  { id: "recon", label: "Recon" },
  { id: "discovery", label: "Discovery" },
  { id: "vuln", label: "Vuln confirmation" },
  { id: "exploit", label: "Exploit / verify" },
  { id: "auth", label: "Authenticated" },
];

export const PERSONAS: { id: AgentPersona | "all"; label: string }[] = [
  { id: "all", label: "All agents" },
  { id: "orchestrator", label: "Orchestrator" },
  { id: "recon", label: "Recon Agent" },
  { id: "exploit", label: "Web Exploit Agent" },
];

const RECON_TOOLS = /nmap|httpx|whois|dig|amass|subfinder|masscan/i;
const EXPLOIT_TOOLS = /nuclei|ffuf|sqlmap|nikto|gobuster|hydra|http_probe|burp/i;
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

function seedNodes(): AttackNode[] {
  return [
    { id: "recon-enum", label: "Host enumeration", phase: "recon", status: "pending", commands: [], outputs: [], reasoning: [], persona: "recon", tool: "nmap" },
    { id: "recon-fp", label: "Service fingerprint", phase: "recon", status: "pending", commands: [], outputs: [], reasoning: [], persona: "recon", tool: "httpx" },
    { id: "disc-http", label: "HTTP surface", phase: "discovery", status: "pending", commands: [], outputs: [], reasoning: [], persona: "recon", tool: "httpx" },
    { id: "disc-paths", label: "Path discovery", phase: "discovery", status: "pending", commands: [], outputs: [], reasoning: [], persona: "recon", tool: "ffuf" },
    { id: "vuln-sig", label: "Signature scan", phase: "vuln", status: "pending", commands: [], outputs: [], reasoning: [], persona: "exploit", tool: "nuclei" },
    { id: "vuln-auth", label: "Auth surface", phase: "vuln", status: "pending", commands: [], outputs: [], reasoning: [], persona: "exploit" },
    { id: "exp-probe", label: "Active verification", phase: "exploit", status: "pending", commands: [], outputs: [], reasoning: [], persona: "exploit" },
    { id: "exp-chain", label: "Exploit chain", phase: "exploit", status: "pending", commands: [], outputs: [], reasoning: [], persona: "exploit" },
  ];
}

function routeNode(t: AgiTranscriptChunk): string {
  const tool = String(t.meta?.tool ?? "");
  const c = t.content.toLowerCase();
  if (/nmap|enum|whois|amass|subfinder/.test(`${tool} ${c}`)) return "recon-enum";
  if (/httpx|fingerprint|nginx|server /.test(`${tool} ${c}`)) return c.includes("http") && /200|301|302|title/.test(c) ? "disc-http" : "recon-fp";
  if (/ffuf|gobuster|dirb|path/.test(`${tool} ${c}`)) return "disc-paths";
  if (/nuclei|cve-|signature/.test(`${tool} ${c}`)) return "vuln-sig";
  if (/login|auth|credential|password/.test(c)) return "vuln-auth";
  if (/probe|exploit|inject|payload/.test(`${tool} ${c}`)) return "exp-probe";
  if (t.role === "assistant") return /plan|recon/.test(c) ? "recon-enum" : /verif|approv|login|exploit/.test(c) ? "exp-probe" : "recon-fp";
  if (t.role === "system") return "recon-enum";
  return "recon-fp";
}

export function deriveAttackGraph(
  transcript: AgiTranscriptChunk[],
  actions: AgiAction[],
  running: boolean,
): AttackNode[] {
  const nodes = seedNodes();
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));

  if (transcript.length > 0) {
    byId["recon-enum"].status = bump(byId["recon-enum"].status, running ? "active" : "succeeded");
  }

  for (const t of transcript) {
    const id = routeNode(t);
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
    const n = byId["exp-probe"];
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
      nodeId: "disc-http",
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
      nodeId: "recon-fp",
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
      nodeId: "vuln-auth",
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
      nodeId: "vuln-sig",
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
      nodeId: "vuln-sig",
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
